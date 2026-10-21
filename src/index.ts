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
import { compactNow, formatBudgetMeter, parseCompactArgs, scheduleTrim } from "./actions.js";
import { applySummaries } from "./apply.js";
import {
  buildAwarenessMessage,
  getAwarenessLevel,
  measureVisibleTokens,
  resolveContextLimit,
  shouldFireAwareness,
  type AwarenessModel,
} from "./awareness.js";
import { applyOmissions, measureTokens, pruneToolResults, serializeResult } from "./prune.js";
import { applyStrategies } from "./strategies.js";
import { getBudgetState, isOverEmergencyBudget, loadConfig, type SmartCompactConfig } from "./config.js";
import { loadState, saveState, writeBackupPointer, type Ctx } from "./store.js";
import { isTokenizerAvailable } from "./tokens.js";
import type { Msg, SessionState } from "./types.js";

const COMPACT = "magic-compact";
const TRIM = "magic-trim";
const STATS = "magic-stats";
const TOOL = "read_omitted_content";
const COMPACT_TOOL = "compact_context";

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
): Promise<SessionState> {
  const started = Date.now();
  const state = await loadState(ctx, sessionID);
  // Emergency budget check is a warning only. Skipping the strategies and the
  // prune pass here would remove the only size relief a large session has, so an
  // over-budget context still gets pruned and still gets its warning.
  const measured = measureVisibleCost(messages, config);
  // D1 meter: display-only budget ratio before prune, never changes behavior.
  // Guard legacy or partial config/state — fail closed to empty, never throw.
  const budgetLimit = config?.tokens?.emergencyBudgetTokens ?? 0;
  const beforeMeter = getBudgetState(measured, budgetLimit);
  console.log(`[smart-compact] ${formatBudgetMeter(beforeMeter)} before prune.`);
  if (isOverEmergencyBudget(measured, config)) {
    const text =
      `[smart-compact] context is over the emergency budget of ` +
      `${config.tokens.emergencyBudgetTokens} tokens (measured ~${measured}); ` +
      `pruning anyway. Raise tokens.emergencyBudgetTokens to silence this warning.`;
    console.warn(text);
    await notify(ctx, sessionID, text);
  }
  const strategies = applyStrategies(messages, config);
  const pruned = pruneToolResults(messages, state, config);
  // D1 meter: display-only ratio after prune for observable headroom.
  const afterCost = measureVisibleCost(messages, config);
  const afterMeter = getBudgetState(afterCost, config?.tokens?.emergencyBudgetTokens ?? 0);
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
  state.stats.savedTokens += pruned.memoTokens;
  state.stats.lastRun = Date.now();
  state.stats.lastRunMs = Date.now() - started;
  state.stats.tokenizerUsed = isTokenizerAvailable();
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
    const payload = (await ctx.model.list()) as unknown;
    const models: ReadonlyArray<AwarenessModel> = Array.isArray(payload)
      ? (payload as ReadonlyArray<AwarenessModel>)
      : ((payload as { data?: ReadonlyArray<AwarenessModel> })?.data ?? []);
    const limitTokens = resolveContextLimit(modelRef, models);
    // An unknown model or a missing limit means no usable window size: stay
    // silent instead of guessing a denominator.
    if (!limitTokens) return;
    const usedTokens = measureVisibleTokens(messages);
    const ratio = usedTokens / limitTokens;
    const state = await loadState(ctx, sessionID);
    // Hysteresis: the latch is cleared only once the context has fallen
    // meaningfully below the warn threshold. Clearing it on every small dip
    // under the threshold would let a session hovering at the boundary re-fire
    // the reminder on alternating requests.
    if (ratio < awareness.warnRatio - awareness.rearmStep) {
      if (state.awarenessLastRatio !== undefined || state.awarenessLastLevel !== undefined) {
        state.awarenessLastRatio = undefined;
        state.awarenessLastLevel = undefined;
        await saveState(ctx, sessionID, state);
      }
      return;
    }
    // Between the clear line and the warn line: keep the latch, stay quiet.
    if (ratio < awareness.warnRatio) return;
    const level = getAwarenessLevel(ratio, awareness);
    if (level === "none") return;
    if (
      !shouldFireAwareness(
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
    });
    (system as Array<{ type: string; text: string }>).push({ type: "text", text });
    state.awarenessLastRatio = ratio;
    state.awarenessLastLevel = level;
    await saveState(ctx, sessionID, state);
  } catch {
    // Advisory only: a failure here must never break the model call.
  }
}

export default Plugin.define({
  id: "smart-compact",
  async setup(ctx) {
    // Commands: summarize now, schedule the pruning pass for the next request.
    await ctx.command.transform((editor) => {
      editor.add({
        name: COMPACT,
        description: "Lossless context compression (optional: number of recent turns to keep)",
        async execute({ sessionID, prompt }) {
          const keepTurns = parseKeepTurns(prompt?.text);
          const summarized = await compactNow(ctx, sessionID, keepTurns);
          await notify(
            ctx,
            sessionID,
            `[smart-compact] summarized ${summarized} turn(s); bulky tool output will be trimmed on the next request.`,
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
          const s = state.stats;
          const text =
            `[smart-compact] pruned ~${s.prunedTokens} tokens across ${s.prunedParts} tool results; ` +
            `summarized ${s.summarizedTurns} turns; ${Object.keys(state.omissions).length} cached omissions; ` +
            `memo-saved ~${s.savedTokens ?? 0} tokens; last run ${s.lastRunMs ?? 0}ms; ` +
            `tokenizer ${s.tokenizerUsed ? "on" : "off"}.`;
          console.log(text);
          await notify(ctx, sessionID, text);
        },
      });
    });

    // Tool: retrieve a pruned tool result by its Content ID, scoped to the
    // calling session so one session can never read another's cache.
    await ctx.tool.transform((editor) => {
      editor.add({
        name: TOOL,
        description:
          "Read original tool output omitted by context compaction. Returns the cached, possibly stale original for a Content ID (e.g. omitted-0001). Use only when the original output cannot be reproduced by a new tool call.",
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
          return {
            content:
              record?.content ??
              `No omitted content found for Content ID: ${contentId} in this session. ` +
                `It was cleared by a newer compaction — rerun the tool to reproduce the output instead of trusting a restore.`,
          };
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
          const summarized = await compactNow(ctx, context.sessionID, args.keepTurns);
          return {
            content: `[smart-compact] summarized ${summarized} turn(s); bulky tool output will be trimmed on the next request.`,
          };
        },
      });
    });

    // Context hook: apply compaction to every model request. Summaries are
    // generated at command time; here we only run the one-shot strategy/prune
    // pass and re-apply the stored state (mutation is per-request, not persisted).
    await ctx.session.hook("context", async (event) => {
      const sessionID = (event as { sessionID?: string }).sessionID;
      if (!sessionID) return;
      const messages = (event as { messages?: unknown }).messages as Msg[] | undefined;
      if (!Array.isArray(messages)) return;

      const config = await loadConfig(ctx);
      if (!config.enabled) return;

      const state = await loadState(ctx, sessionID);
      if (state.pending) {
        await runPrune(ctx, sessionID, messages, config);
      }
      const fresh = await loadState(ctx, sessionID);
      applySummaries(messages, fresh);
      applyOmissions(messages, fresh, config);
      // Awareness runs last so it measures exactly what the model receives.
      await runAwareness(ctx, sessionID, event, messages, config);
    });
  },
});
