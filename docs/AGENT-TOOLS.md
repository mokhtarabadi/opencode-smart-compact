# SMART-COMPACT AGENT GUIDE — FOR AI AGENT ONLY

You are an OpenCode AI agent running in a session where the `smart-compact` plugin is installed. This file teaches you what it does and which tools YOU can call.

## 1. What this plugin is

Lossless V2-native context compaction. It never mutates stored transcript. It stores per-session state in plugin storage and transforms model-visible messages on every request via `session.hook("context")`.

What it does to your context:

- User messages: always kept verbatim, never summarized.
- Old assistant turns: each replaced by its own 2-4 sentence summary. Restored from `state.summaries` by message ID.
- Bulky tool results: pruned to `[omitted tool output ... Content ID: omitted-XXXX]` notice. Original cached in `state.omissions`, retrievable.
- Recent window: last user message + `preserveRecentTurns` (default 2 turns) is never pruned.
- Discard tools: replaced with fixed short text, never cached. Default: `todowrite -> "Successfully updated todos."`, `skill -> "Skill contents omitted..."`.
- Protected tools: never pruned. Default: `question`.
- Always-prune tools: always pruned when outside recent window. Default: `read`.
- Strategies run on prune pass: deduplication, purgeErrors (last 4 turns), stripReasoning (>500 chars).

## 2. Tools YOU as agent can call — only these two

You do NOT call slash commands. Slash commands `/magic-compact`, `/magic-trim`, `/magic-stats` are Manager-only. You call these two tools with native tool-call JSON.

### Tool A: compact_context — free context yourself

Description: Compress this session's context now. Summarize old turns + prune bulky tool output on next request.

When to call it:

- Context pressure high, before heavy payloads, after 50+ steps without progress, before QA/review handoff with large diff.
- Use `mode: "trim"` if only tool output is bulky and you want to keep reasoning. Use default `mode: "compact"` if turns are stale.

Input schema:

```json
{
  "keepTurns": 0,
  "mode": "compact"
}
```

- `keepTurns`: integer >=0, optional, default 0. Most recent turns to keep unsummarized. Example: 5 keeps last 5.
- `mode`: "compact" | "trim", optional, default "compact". "trim" = prune tool output only, no summarization.

Call examples in OpenCode tool-call language:

- Default full compact: `compact_context({})` or `compact_context({"mode":"compact","keepTurns":0})`
- Keep last 5, full: `compact_context({"keepTurns":5})`
- Trim only: `compact_context({"mode":"trim"})`
- Trim keep 3: `compact_context({"mode":"trim","keepTurns":3})`

Returns: `"[smart-compact] summarized N turn(s); bulky tool output will be trimmed on the next request."` or `"[smart-compact] tool output will be trimmed on the next request."` for trim. Invalid `keepTurns` returns `"[smart-compact] keepTurns must be a non-negative integer."`

Effect is async: summaries stored now, prune applies on next `context` hook run. Do not re-call to verify — continue work.

### Tool B: read_omitted_content — retrieve pruned output

Description: Read original tool output omitted by compaction. Scoped to calling session only.

When to call it:

- ONLY when you see `[omitted tool output ... Content ID: omitted-XXXX]` and you cannot reproduce output with a fresh tool call. Prefer re-running the source tool. Never call speculatively.

Input schema:

```json
{
  "contentId": "omitted-0001"
}
```

- `contentId`: string, required. Format `omitted-NNNN`.

Call example: `read_omitted_content({"contentId":"omitted-0001"})`

Returns: cached original text, possibly stale. If missing: `"No omitted content found for Content ID: X in this session. It was cleared by a newer compaction — rerun the tool..."` Then rerun source tool, do not retry IDs.

## 3. Rules for you

1. Never ask Manager to run slash commands in autopilot/auto mode. Call `compact_context` yourself and chain next turn.
2. Never re-run source tool for pruned output to save tokens — retrieve with `read_omitted_content` by Content ID, else re-run source once if cache miss.
3. `compact_context` never fails session on over-budget — over-budget still compacts with warning. Budget 0 disables warning.
4. Config you do not edit: `.opencode/smart-compact.jsonc` (project) overrides `~/.config/opencode/smart-compact.jsonc` (global) overrides defaults. Defaults: maxChars 1024, maxWords 128, taskMax 4096/512, truncate 1024, emergencyBudget 50000.
5. Human tools are out of scope. Only the two tools above are agent-callable. Ignore file-system, shell, or Manager UI tools.

## 4. Minimal decision flow

IF context heavy AND reasoning stale -> compact_context({"mode":"compact"})
ELSE IF only tool I/O bulky -> compact_context({"mode":"trim"})
ELSE IF see omitted-XXXX AND need original AND cannot re-run cheaply -> read_omitted_content({"contentId":"omitted-XXXX"})
ELSE -> do nothing.
