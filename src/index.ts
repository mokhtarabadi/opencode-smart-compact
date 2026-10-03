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
import { applySummaries } from "./apply.js";
import { applyOmissions, pruneToolResults } from "./prune.js";
import { summarizeOldTurns } from "./summarize.js";
import { loadState, saveState, type Ctx } from "./store.js";
import type { Msg, SessionState } from "./types.js";

const COMPACT = "magic-compact";
const TRIM = "magic-trim";
const STATS = "magic-stats";
const TOOL = "read_omitted_content";

/** Parse an optional non-negative integer argument; throws on anything else. */
function parseKeepTurns(text: string | undefined): number {
  const trimmed = (text ?? "").trim();
  if (trimmed === "") return 0;
  if (!/^\d+$/.test(trimmed)) {
    throw new Error("Argument must be a non-negative integer.");
  }
  return Number(trimmed);
}

/** Run a compaction or trim request and persist the resulting state. */
async function runCompaction(
  ctx: Ctx,
  sessionID: string,
  mode: "compact" | "trim",
  keepTurns: number,
  messages: Msg[],
): Promise<SessionState> {
  const state = await loadState(ctx, sessionID);
  if (mode === "compact") {
    state.stats.summarizedTurns += await summarizeOldTurns(ctx, messages, keepTurns, state);
  }
  const pruned = pruneToolResults(messages, state);
  state.stats.prunedParts += pruned.pruned;
  state.stats.prunedTokens += pruned.tokens;
  state.stats.lastRun = Date.now();
  await saveState(ctx, sessionID, state);
  return state;
}

export default Plugin.define({
  id: "smart-compact",
  async setup(ctx) {
    // Commands: schedule a compaction/trim, applied on the next model request.
    await ctx.command.transform((editor) => {
      editor.add({
        name: COMPACT,
        description: "Lossless context compression (optional: number of recent turns to keep)",
        async execute({ sessionID, prompt }) {
          const keepTurns = parseKeepTurns(prompt?.text);
          const state = await loadState(ctx, sessionID);
          state.pending = { mode: "compact", keepTurns };
          await saveState(ctx, sessionID, state);
        },
      });
      editor.add({
        name: TRIM,
        description: "Prune bulky tool output only, without summarizing (optional: recent turns to keep)",
        async execute({ sessionID, prompt }) {
          const keepTurns = parseKeepTurns(prompt?.text);
          const state = await loadState(ctx, sessionID);
          state.pending = { mode: "trim", keepTurns };
          await saveState(ctx, sessionID, state);
        },
      });
      editor.add({
        name: STATS,
        description: "Show cumulative context savings for this session",
        async execute({ sessionID }) {
          const state = await loadState(ctx, sessionID);
          const s = state.stats;
          console.log(
            `[smart-compact] pruned ${s.prunedTokens} tokens across ${s.prunedParts} tool results; ` +
              `summarized ${s.summarizedTurns} turns; ${Object.keys(state.omissions).length} cached omissions.`,
          );
        },
      });
    });

    // Tool: retrieve a pruned tool result by its Content ID.
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
        async execute(input: unknown) {
          const { contentId } = (input ?? {}) as { contentId?: string };
          if (!contentId) return { content: "Missing contentId." };
          // Session scoping is applied by the caller's storage namespace; here
          // we scan all sessions' omissions for the requested id.
          const record = await findOmission(ctx, contentId);
          return {
            content:
              record ??
              `No omitted content found for Content ID: ${contentId}. It may have been cleared by a newer compaction.`,
          };
        },
      });
    });

    // Context hook: apply compaction to every model request.
    await ctx.session.hook("context", async (event) => {
      const sessionID = (event as { sessionID?: string }).sessionID;
      if (!sessionID) return;
      const messages = (event as { messages?: unknown }).messages as Msg[] | undefined;
      if (!Array.isArray(messages)) return;

      const state = await loadState(ctx, sessionID);
      const pending = state.pending;
      if (pending) {
        state.pending = null;
        await saveState(ctx, sessionID, state);
        await runCompaction(ctx, sessionID, pending.mode, pending.keepTurns, messages);
      }
      const fresh = await loadState(ctx, sessionID);
      applySummaries(messages, fresh);
      applyOmissions(messages, fresh);
    });
  },
});

/** Find a cached omission by id across the plugin's stored sessions. */
async function findOmission(ctx: Ctx, contentId: string): Promise<string | undefined> {
  const scan = await ctx.storage.scan({ prefix: "session:" });
  for (const entry of scan.entries) {
    const state = entry.value as Partial<SessionState> | undefined;
    const hit = state?.omissions?.[contentId];
    if (hit?.content) return hit.content;
  }
  return undefined;
}
