/**
 * Smart Compact — lossless, V2-native context compaction for OpenCode.
 *
 * The V1 magic-compact mutated the stored transcript directly. OpenCode V2's
 * plugin API does not expose transcript mutation, so this plugin takes the
 * native path instead: it keeps a per-session compaction state in plugin
 * storage and applies it to the model-visible messages on every request via the
 * `session.hook("context")` hook. User messages stay verbatim, each old
 * assistant turn is replaced by its own summary, and bulky tool results are
 * pruned to a notice while the original is cached and retrievable.
 */
import { Plugin } from "@opencode/plugin";
import { compactNow, formatBudgetMeter, formatStats, parseCompactArgs, scheduleTrim } from "./actions.js";
import { applySummaries } from "./apply.js";
import {
  autoTrimResetLine,
  buildAwarenessMessage,
  getEffectiveAwarenessLevel,
  isBelowAwarenessRearmLine,
  measureVisibleTokens,
  resolveAwarenessWindow,
  shouldAutoTrim,
  shouldFireAwarenessReminder,
  type AwarenessModel,
  type ResolvedWindow,
} from "./awareness.js";
import {
  applyOmissions,
  measureTokens,
  missingOmissionNotice,
  pruneToolResults,
  serializeResult,
} from "./prune.js";
import {
  MAX_OMISSION_RESPONSE_CHARS,
  boundOmissionResponse,
  readOmissionOriginal,
} from "./omissions.js";
import { applyStrategies } from "./strategies.js";
import {
  emergencyBudgetDescription,
  getBudgetState,
  isOverEmergencyBudget,
  loadConfig,
  resolveEmergencyBudget,
  type SmartCompactConfig,
} from "./config.js";
import { loadState, saveState, writeBackupPointer, type Ctx } from "./store.js";
import { measurementPath } from "./tokens.js";
import type { Msg, SessionState } from "./types.js";

const COMPACT = "magic-compact";
const TRIM = "magic-trim";
const STATS = "magic-stats";
const TOOL = "read_omitted_content";
const COMPACT_TOOL = "compact_context";
const STATS_TOOL = "compact_stats";

/** Parse an optional non-negative integer argument; throws on anything else. */
function parseKeepTurns(text: string | undefined): number {
  const trimmed = (text ?? "").trim();
  if (trimmed === "") return 0;
  if (!/^\d+$/.test(trimmed)) {
    throw new Error("Argument must be a non-negative integer.");
  }
  return Number(trimmed);
}

/** Post a user-visible message without prompting the model. */
async function notify(ctx: Ctx, sessionID: string, text: string): Promise<void> {
  try {
    await ctx.session.synthetic({ sessionID, text });
  } catch {
    // Synthetic delivery is best-effort; never fail a command over it.
  }
}

/** Run any pending automatic strategies and the prune pass, then persist stats. */
async function runPrune(
  ctx: Ctx,
  sessionID: string,
  messages: Msg[],
  config: SmartCompactConfig,
  limitTokens?: number,
): Promise<SessionState> {
  const started = Date.now();
  const state = await loadState(ctx, sessionID);
  // Emergency budget check is a warning only. Skipping the strategies and the
  // prune pass here would remove the only size relief a large session has, so an
  // over-budget context still gets pruned and still gets its warning.
  const measured = measureVisibleCost(messages, config);
  // The budget is a share of the resolved window (or an explicit override), so
  // a 1M-token model is not warned from the first few turns. No window means
  // no derived budget, which disables the warning instead of guessing.
  const budgetLimit = resolveEmergencyBudget(config, limitTokens);
  // D1 meter: display-only budget ratio before prune, never changes behavior.
  // Guard legacy or partial config/state — fail closed to empty, never throw.
  const beforeMeter = getBudgetState(measured, budgetLimit);
  console.log(`[smart-compact] ${formatBudgetMeter(beforeMeter)} before prune.`);
  if (isOverEmergencyBudget(measured, config, limitTokens)) {
    const text =
      `[smart-compact] context is over the emergency budget of ` +
      `${budgetLimit} tokens (${emergencyBudgetDescription(config, limitTokens)}; ` +
      `measured ~${measured}); pruning anyway. Raise tokens.emergencyBudgetTokens ` +
      `or tokens.emergencyBudgetRatio to silence this warning.`;
    console.warn(text);
    // Never call notify / ctx.session.synthetic from within runPrune: runPrune
    // runs synchronously on the session.hook("context") pipeline, where
    // re-entering ctx.session.synthetic blocks on the active session worker
    // and causes an OpenCode server deadlock and OpenChamber watchdog restart.
  }
  const strategies = applyStrategies(messages, config);
  const pruned = pruneToolResults(messages, state, config, sessionID);
  // D1 meter: display-only ratio after prune for observable headroom.
  const afterCost = measureVisibleCost(messages, config);
  const afterMeter = getBudgetState(afterCost, budgetLimit);
  console.log(`[smart-compact] ${formatBudgetMeter(afterMeter)} after prune.`);
  // D3 pointer (post-prune restore source): fresh keys plus after-prune ratio.
  // Best-effort with warn — a pointer failure never blocks prune (V5).
  try {
    await writeBackupPointer(
      ctx,
      sessionID,
      Object.keys(state.omissions ?? {}),
      Object.keys(state.summaries ?? {}),
      afterMeter.ratio,
    );
  } catch (error) {
    // Visible failure, still continue — pointer is restore aid, not gate.
    console.warn(`[smart-compact] backup pointer write failed for ${sessionID}: ${(error as Error)?.message ?? error}`);
  }
  state.stats.prunedParts += pruned.pruned + strategies.pruned;
  state.stats.prunedTokens += pruned.tokens + strategies.tokens;
  state.stats.lastRun = Date.now();
  state.stats.lastRunMs = Date.now() - started;
  state.stats.measurementPath = measurementPath(config.tokens.enabled);
  state.pending = null;
  await saveState(ctx, sessionID, state);
  return state;
}

/**
 * Measured token cost of the model-visible tool results awaiting the prune
 * pass. Read-only: never mutates messages or state.
 */
function measureVisibleCost(messages: Msg[], config: SmartCompactConfig): number {
  let total = 0;
  for (const msg of messages) {
    if (!Array.isArray(msg.content)) continue;
    for (const part of msg.content) {
      if (part.type !== "tool-result") continue;
      const result = part.result as { value?: unknown } | undefined;
      total += measureTokens(serializeResult(result?.value), config);
    }
  }
  return total;
}

/** One registry-failure warning per process, so a broken registry is not noise. */
let warnedRegistryFailure = false;

/** The model registry as a plain list, tolerating both known response shapes. */
async function listModels(ctx: Ctx): Promise<ReadonlyArray<AwarenessModel>> {
  const payload = (await ctx.model.list()) as unknown;
  return Array.isArray(payload)
    ? (payload as ReadonlyArray<AwarenessModel>)
    : ((payload as { data?: ReadonlyArray<AwarenessModel> })?.data ?? []);
}

/**
 * Resolve the window once per model request: the registry limit capped by the
 * configured `awareness.contextWindowTokens` value (see
 * `resolveAwarenessWindow`). The same result feeds the emergency budget and the
 * awareness reminder, so the two cannot use different denominators.
 */
async function resolveWindowForRequest(
  ctx: Ctx,
  event: unknown,
  config: SmartCompactConfig,
): Promise<ResolvedWindow> {
  try {
    const modelRef = (event as { model?: unknown }).model as
      | { providerID: string; id: string }
      | undefined;
    if (!modelRef || typeof modelRef.providerID !== "string" || typeof modelRef.id !== "string") {
      return { capped: false };
    }
    let models: ReadonlyArray<AwarenessModel> = [];
    try {
      models = await listModels(ctx);
    } catch (error) {
      // The configured fallback can still provide a denominator, so carry on.
      if (!warnedRegistryFailure) {
        warnedRegistryFailure = true;
        console.warn(
          `[smart-compact] model registry unavailable: ${(error as Error)?.message ?? error}; ` +
            `continuing with awareness.contextWindowTokens when configured.`,
        );
      }
    }
    return resolveAwarenessWindow(modelRef, models, config.awareness.contextWindowTokens);
  } catch (error) {
    // Never break the model call over a window lookup.
    console.warn(`[smart-compact] window resolution failed: ${(error as Error)?.message ?? error}`);
    return { capped: false };
  }
}

/**
 * Context-pressure awareness: tell the agent how full the context window is
 * once it crosses the configured ratio, and how to reclaim room.
 *
 * Advisory only. The reminder rides on the outgoing model call as one system
 * part, so the agent sees it without the transcript growing and without a new
 * turn. It never compacts, never prompts, never aborts a step, and never
 * mutates the messages. Any failure is swallowed: a warning must never break
 * the model call.
 */
async function runAwareness(
  ctx: Ctx,
  sessionID: string,
  event: unknown,
  messages: Msg[],
  config: SmartCompactConfig,
  window: ResolvedWindow,
): Promise<void> {
  try {
    const awareness = config.awareness;
    if (!awareness || !awareness.enabled) return;
    const system = (event as { system?: unknown }).system;
    if (!Array.isArray(system)) return;
    const modelRef = (event as { model?: unknown }).model as
      | { providerID: string; id: string }
      | undefined;
    if (!modelRef) return;
    const limitTokens = window.limitTokens;
    // An unknown model with no configured fallback means no usable window
    // size: stay silent instead of guessing a denominator. Record the model
    // and log once per model so the silence is diagnosable instead of
    // invisible: without this, a session can sit at high fill with zero
    // warnings and no clue why.
    const modelKey = `${modelRef.providerID}/${modelRef.id}`;
    const state = await loadState(ctx, sessionID);
    if (!limitTokens) {
      if (
        state.awarenessModel !== modelKey ||
        state.awarenessWindow !== undefined ||
        state.awarenessWindowSource !== undefined ||
        state.awarenessWindowRegistry !== undefined ||
        state.awarenessWindowCapped !== undefined
      ) {
        state.awarenessModel = modelKey;
        state.awarenessWindow = undefined;
        state.awarenessWindowSource = undefined;
        state.awarenessWindowRegistry = undefined;
        state.awarenessWindowCapped = undefined;
        await saveState(ctx, sessionID, state);
        console.log(
          `[smart-compact] awareness disabled: unknown model ${modelKey} or missing context limit — ` +
            `no pressure ratio can be computed, so no advisory will fire. ` +
            `Check that the model registry entry carries limit.context, or set ` +
            `awareness.contextWindowTokens (a positive value is also a cap on a larger registry window).`,
        );
      }
      return;
    }
    if (
      state.awarenessModel !== modelKey ||
      state.awarenessWindow !== limitTokens ||
      state.awarenessWindowSource !== window.source ||
      state.awarenessWindowRegistry !== window.registryTokens ||
      state.awarenessWindowCapped !== window.capped
    ) {
      state.awarenessModel = modelKey;
      state.awarenessWindow = limitTokens;
      state.awarenessWindowSource = window.source;
      state.awarenessWindowRegistry = window.registryTokens;
      state.awarenessWindowCapped = window.capped;
      await saveState(ctx, sessionID, state);
    }
    const usedTokens = measureVisibleTokens(messages);
    const ratio = usedTokens / limitTokens;
    // One-line provenance for the two numbers every diagnostic below reports:
    // the effective denominator, the registry's own number, and whether the
    // configured value capped it. Built once per request, logged only on a fire
    // or a queued trim, so a quiet request stays silent.
    const windowFacts = `${usedTokens}/${limitTokens} (${Math.round(ratio * 100)}%) registry=${
      window.registryTokens ?? "none"
    } capped=${window.capped}`;
    // Lossless relief below the advisory threshold: schedule the tool-output
    // prune pass for the next request. Nothing is summarized and no user
    // message is touched, so this is safe to do without asking the agent.
    // One sustained pressure period trims once: the latch clears only once the
    // fill drops a re-arm step below the line, so a repeated request at the
    // same fill queues nothing.
    const autoTrimRatio = awareness.autoTrimRatio;
    const trimResetLine = autoTrimResetLine(autoTrimRatio, awareness.rearmStep);
    let stateChanged = false;
    if (autoTrimRatio > 0 && ratio < trimResetLine && state.autoTrimLastRatio !== undefined) {
      state.autoTrimLastRatio = undefined;
      stateChanged = true;
    }
    if (
      shouldAutoTrim({
        ratio,
        autoTrimRatio,
        rearmStep: awareness.rearmStep,
        hasPending: state.pending !== null,
        lastRatio: state.autoTrimLastRatio,
      })
    ) {
      state.pending = { mode: "trim", keepTurns: 0 };
      state.autoTrimLastRatio = ratio;
      stateChanged = true;
      console.log(
        `[smart-compact] auto-trim queued: ${windowFacts}; tool output will be trimmed on the next request.`,
      );
    }
    if (stateChanged) await saveState(ctx, sessionID, state);
    // The fired level is the stronger of the ratio signal and the absolute
    // token signal. Ratios are meaningless on a 1M-token window, so an install
    // can arm `warnAtTokens` / `emergencyAtTokens` and be warned at a real size
    // instead of waiting for a percentage no session reaches.
    const level = getEffectiveAwarenessLevel(usedTokens, ratio, awareness);
    // Hysteresis: the latch is cleared only once every armed signal has fallen
    // meaningfully below its warn line. Clearing it on every small dip under a
    // threshold would let a session hovering at the boundary re-fire the
    // reminder on alternating requests.
    if (level === "none") {
      if (
        isBelowAwarenessRearmLine({ usedTokens, ratio, cfg: awareness }) &&
        (state.awarenessLastRatio !== undefined || state.awarenessLastLevel !== undefined)
      ) {
        state.awarenessLastRatio = undefined;
        state.awarenessLastLevel = undefined;
        await saveState(ctx, sessionID, state);
      }
      return;
    }
    // Emergency re-fires on every request while the pressure stays at or
    // above the emergency line: a heads-down agent must not get one nudge and
    // then silence. The single-shot latch applies to warn only; the hysteresis
    // clear above still clears both levels once the pressure drops, so the
    // message never oscillates between levels.
    if (
      !shouldFireAwarenessReminder(
        ratio,
        level,
        { lastRatio: state.awarenessLastRatio, lastLevel: state.awarenessLastLevel },
        awareness.rearmStep,
      )
    ) {
      return;
    }
    const text = buildAwarenessMessage({
      usedTokens,
      limitTokens,
      ratioPct: Math.round(ratio * 100),
      level,
      windowSource: window.source,
      registryTokens: window.registryTokens,
      capped: window.capped,
      // Below the ratio warn line, a fired level can only have come from the
      // absolute token line, so say so in the reminder text.
      absoluteTriggered: ratio < awareness.warnRatio,
    });
    (system as Array<{ type: string; text: string }>).push({ type: "text", text });
    state.awarenessLastRatio = ratio;
    state.awarenessLastLevel = level;
    await saveState(ctx, sessionID, state);
    // Exactly one diagnostic line per fired reminder (never per request), so a
    // silent session and a firing session are distinguishable from the logs.
    console.log(`[smart-compact] awareness ${level} fired: ${windowFacts}`);
  } catch {
    // Advisory only: a failure here must never break the model call.
  }
}

export default Plugin.define({
  id: "smart-compact",
  async setup(ctx) {
    // Commands: summarize now, schedule the pruning pass for the next request.
    try {
      await ctx.command.transform((editor) => {
      editor.add({
        name: COMPACT,
        description: "Lossless context compression (optional: number of recent turns to keep)",
        async execute({ sessionID, prompt }) {
          const keepTurns = parseKeepTurns(prompt?.text);
          const result = await compactNow(ctx, sessionID, keepTurns);
          const fallbackNote =
            result.fallbacks > 0 ? ` (${result.fallbacks} fell back to heuristic summaries)` : "";
          await notify(
            ctx,
            sessionID,
            `[smart-compact] summarized ${result.summarized} turn(s)${fallbackNote}; bulky tool output will be trimmed on the next request.`,
          );
        },
      });
      editor.add({
        name: TRIM,
        description: "Prune bulky tool output only, without summarizing (optional: recent turns to keep)",
        async execute({ sessionID, prompt }) {
          const keepTurns = parseKeepTurns(prompt?.text);
          await scheduleTrim(ctx, sessionID, keepTurns);
        },
      });
      editor.add({
        name: STATS,
        description: "Show cumulative context savings for this session",
        async execute({ sessionID }) {
          const state = await loadState(ctx, sessionID);
          const text = formatStats(state);
          console.log(text);
          await notify(ctx, sessionID, text);
        },
      });
    });
    } catch (error) {
      console.warn(`[smart-compact] ctx.command.transform failed: ${(error as Error)?.message ?? error}`);
    }

    // Tool: retrieve a pruned tool result by its Content ID, scoped to the
    // calling session so one session can never read another's cache.
    try {
      await ctx.tool.transform((editor) => {
      editor.add({
        name: TOOL,
        description:
          `Read original tool output omitted by context compaction. Returns the cached, possibly stale original for a Content ID (e.g. omitted-0001), capped at ${MAX_OMISSION_RESPONSE_CHARS} characters with an explicit truncation notice. Use only when the original output cannot be reproduced by a new tool call.`,
        input: {
          type: "object",
          properties: {
            contentId: { type: "string", description: "Omitted content ID, e.g. omitted-0001." },
          },
          required: ["contentId"],
          additionalProperties: false,
        },
        async execute(input: unknown, context) {
          const { contentId } = (input ?? {}) as { contentId?: string };
          if (!contentId) return { content: "Missing contentId." };
          const state = await loadState(ctx, context.sessionID);
          const record = state.omissions[contentId];
          // Fail closed on both lanes: an unknown id and a known record whose
          // original was evicted answer with the same explicit missing notice,
          // so the two paths cannot drift and no caller ever gets a phantom
          // restore.
          if (!record) return { content: missingOmissionNotice(contentId) };
          const original = readOmissionOriginal(record);
          // Fail closed: a mapped record without a readable original (evicted
          // file, or a cache cleared by a newer compaction) names the missing
          // id instead of restoring a phantom.
          if (original === undefined) return { content: missingOmissionNotice(contentId) };
          return { content: boundOmissionResponse(contentId, original) };
        },
      });

      // Tool: agent-callable compaction, so the agent can free context room
      // itself instead of waiting for the Manager to run a slash command. It
      // reuses the exact command helpers, so the two paths cannot drift.
      editor.add({
        name: COMPACT_TOOL,
        description:
          "Compress this session's context now to free room: summarize old assistant turns (each becomes a short summary; user messages stay verbatim) and prune bulky tool output to a retrievable notice. Call it when the context window is under pressure. Optional inputs: keepTurns (most recent turns to keep unsummarized, default 0 = all), mode ('compact' default summarizes and prunes; 'trim' prunes tool output only).",
        input: {
          type: "object",
          properties: {
            keepTurns: {
              type: "integer",
              minimum: 0,
              description: "Most recent turns to keep unsummarized. Default 0 summarizes all.",
            },
            mode: {
              type: "string",
              enum: ["compact", "trim"],
              description: "'compact' (default) summarizes and prunes; 'trim' prunes tool output only.",
            },
          },
          additionalProperties: false,
        },
        async execute(input: unknown, context) {
          let args;
          try {
            args = parseCompactArgs(input);
          } catch (error) {
            return { content: `[smart-compact] ${(error as Error).message}` };
          }
          if (args.mode === "trim") {
            await scheduleTrim(ctx, context.sessionID, args.keepTurns);
            return { content: "[smart-compact] tool output will be trimmed on the next request." };
          }
          const result = await compactNow(ctx, context.sessionID, args.keepTurns);
          const fallbackNote =
            result.fallbacks > 0 ? ` (${result.fallbacks} fell back to heuristic summaries)` : "";
          return {
            content: `[smart-compact] summarized ${result.summarized} turn(s)${fallbackNote}; bulky tool output will be trimmed on the next request.`,
          };
        },
      });

      // Tool: read-only savings report, so the agent can see whether it is
      // actually making room instead of asking the Manager to run the stats
      // command. Same formatter as `/magic-stats`, so the numbers cannot drift.
      editor.add({
        name: STATS_TOOL,
        description:
          "Report this session's cumulative compaction savings: plugin version, tokens pruned, tool results trimmed, turns summarized with heuristic fallbacks, cached omissions, last run time, which measurement path produced the numbers (tokenizer or heuristic) and the resolved context window. Read-only, no inputs, safe to call at any time.",
        input: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        async execute(_input: unknown, context) {
          const state = await loadState(ctx, context.sessionID);
          return { content: formatStats(state) };
        },
      });
    });
    } catch (error) {
      console.warn(`[smart-compact] ctx.tool.transform failed: ${(error as Error)?.message ?? error}`);
    }

    // Context hook: apply compaction to every model request. Summaries are
    // generated at command time; here we only run the one-shot strategy/prune
    // pass and re-apply the stored state (mutation is per-request, not persisted).
    try {
      await ctx.session.hook("context", async (event) => {
      const sessionID = (event as { sessionID?: string }).sessionID;
      if (!sessionID) return;
      const messages = (event as { messages?: unknown }).messages as Msg[] | undefined;
      if (!Array.isArray(messages)) return;

      const config = await loadConfig(ctx);
      if (!config.enabled) return;

      // One window lookup per request feeds both the emergency budget and the
      // awareness ratio, so the two thresholds can never disagree.
      const window = await resolveWindowForRequest(ctx, event, config);
      const state = await loadState(ctx, sessionID);
      if (state.pending) {
        try {
          await runPrune(ctx, sessionID, messages, config, window.limitTokens);
        } catch (error) {
          console.warn(`[smart-compact] runPrune failed for ${sessionID}: ${(error as Error)?.message ?? error}`);
        }
      }
      const fresh = await loadState(ctx, sessionID);
      applySummaries(messages, fresh);
      applyOmissions(messages, fresh, config);
      // Awareness runs last so it measures exactly what the model receives.
      await runAwareness(ctx, sessionID, event, messages, config, window);
    });
    } catch (error) {
      console.warn(`[smart-compact] ctx.session.hook failed: ${(error as Error)?.message ?? error}`);
    }

    return async () => {
      // Cleanup: no timers or in-memory caches are held; durable storage persists.
    };
  },
});
