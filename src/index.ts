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
import { compactNow, parseCompactArgs, scheduleTrim } from "./actions.js";
import { applySummaries } from "./apply.js";
import { applyOmissions, measureTokens, pruneToolResults, serializeResult } from "./prune.js";
import { applyStrategies } from "./strategies.js";
import { checkBudgetGuard, loadConfig, type SmartCompactConfig } from "./config.js";
import { loadState, saveState, type Ctx } from "./store.js";
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
  // Emergency budget guard runs before any mutation: an over-budget context
  // aborts with a visible message and the stored state is left unchanged
  // (no strategies applied, no save). A zero budget disables the guard.
  const measured = measureVisibleCost(messages, config);
  if (checkBudgetGuard(measured, config)) {
    const text =
      `[smart-compact] compaction aborted: measured ~${measured} tokens exceeds ` +
      `the emergency budget of ${config.tokens.emergencyBudgetTokens} tokens. ` +
      `Raise tokens.emergencyBudgetTokens (0 disables) and rerun.`;
    console.warn(text);
    await notify(ctx, sessionID, text);
    return state;
  }
  const strategies = applyStrategies(messages, config);
  const pruned = pruneToolResults(messages, state, config);
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
    });
  },
});
