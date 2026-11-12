# Smart Compact

Lossless, **OpenCode V2-native** context compaction. User messages stay verbatim, each old assistant turn is replaced by its own summary, and bulky tool output is pruned to a notice while the original is cached and retrievable.

Smart Compact is a clean-room rewrite of the idea behind `magic-compact`, built on OpenCode 2's plugin API. The V1 plugin mutated the stored transcript directly; V2 does not expose that, so Smart Compact keeps a per-session compaction state in plugin storage and applies it to the model-visible messages on every request through the `session.hook("context")` hook.

## Why V2-native

| V1 approach | Smart Compact (V2) |
| --- | --- |
| Mutate the stored transcript | Transform model-visible messages per request |
| `session.messages` / `part.update` | `session.hook("context")`, `ctx.command.transform`, `ctx.tool.transform`, `ctx.storage` |
| One lossy summary blob | Per-turn summaries + verbatim user messages + retrievable pruning |

Because the transcript is never modified, a compaction can be recomputed from storage on the next request and a bad run never corrupts history.

## Features

- **Turn-aware summaries** — old assistant turns are condensed per conversation turn, and the tool-call/tool-result structure is preserved so nothing is orphaned. Eligible turns are batched into a single model call per compaction, so cost stays low.
- **Verbatim user messages** — your instructions are never summarized away.
- **Retrievable pruning** — bulky completed tool output is replaced with a notice that names the recovery path (`read_omitted_content`, the `contentId` argument, and the exact Content ID) and states that the original is recoverable, not lost; the original is cached and can be read back with `read_omitted_content`.
- **Automatic strategies** — repeated identical tool calls are deduplicated (newest kept) and the arguments of stale errored tool calls are blanked.
- **Zero ongoing prompt overhead** — summarization is command-driven, not a background loop, so cache invalidation happens once per compaction; only the lossless tool-output trim runs automatically at the configured pressure.
- **Observable** — `/magic-stats` reports tokens pruned, turns summarized, and cached omissions, and the agent-callable `compact_stats` tool reports the same figures without the Manager.

## Installation

Publish-aware install once the package is on npm:

```bash
opencode plugin add @mokhtarabadi/opencode-smart-compact
```

Or add the directory directly while developing:

```bash
opencode plugin add /absolute/path/to/opencode-smart-compact
```

or list it in `opencode.json(c)`:

```json
{ "plugins": ["@mokhtarabadi/opencode-smart-compact"] }
```

## Usage

| Command | Effect |
| --- | --- |
| `/magic-compact [N]` | Summarize old assistant turns, keeping the last `N` turns; prune bulky tool output. |
| `/magic-trim [N]` | Prune bulky tool output only, without summarizing. |
| `/magic-stats` | Report cumulative savings for the session as a visible message. |
| `compact_stats` | Agent tool: same savings report, callable without the Manager. Ends with the awareness denominator (`window <tokens> (<model>)`) or `window unknown (<model> — awareness off)` when the registry has no usable limit; a denominator capped by config appends `, capped from <registry tokens>`. |

Compaction is scheduled by the command and applied on the next model request.

### The agent-callable tool

`compact_context` lets the agent compress the session itself when the context window is under pressure, instead of waiting for the Manager to run a slash command. It reuses the exact command logic, so the two paths cannot drift.

| Input | Effect |
| --- | --- |
| `keepTurns` (optional) | Most recent turns to keep unsummarized. Default `0` summarizes all. |
| `mode` (optional) | `compact` (default) summarizes and prunes; `trim` prunes tool output only. |

### The omitted-content tool

`read_omitted_content` returns the cached original for a Content ID (e.g. `omitted-0001`) that appears in a pruning notice. The lookup is scoped to the current session. Use it only when the original cannot be reproduced by a new tool call.

Every pruning notice names the whole recovery path, so an agent that reads a notice knows exactly what to call: the tool `read_omitted_content`, the argument `contentId`, and the id to pass — plus the sentence that the original output is **recoverable, not lost**, because a notice that reads like a deletion is never acted on. A known id returns the original text (capped at 20000 characters with an explicit truncation notice); an unknown or evicted id returns an explicit missing notice naming the id and asking for a rerun instead of a phantom restore.

### The stats tool

`compact_stats` reports the same cumulative figures as `/magic-stats` — plugin version, tokens pruned, tool results trimmed, turns summarized with their heuristic fallbacks, cached omissions, last run time, which measurement path produced the numbers (tokenizer or heuristic), and the awareness denominator — without the Manager having to run anything. It takes no inputs, only reads storage, and shares the formatter with the slash command, so the two lanes cannot report different numbers.

## Pruning rules

- Completed tool results over the configured size limit (default 1024 chars / 128 words) are pruned to a notice that names `read_omitted_content`, the `contentId` argument, and the exact Content ID, and states that the original is recoverable; the original is cached in a per-session file store, not in the session state blob.
- The omission store is bounded (500 files / 8 MiB per session, oldest evicted first), and a single `read_omitted_content` response is capped at 20000 characters with an explicit truncation notice.
- With `pruning.useTokens`, the word thresholds double as token budgets and measured tokens decide instead of chars/words.
- The preserve-recent window (default last 2 turns, plus always the last user message) keeps full text; sessions with no user message get no window.
- Results over `truncateToolsChars` (default 1024) are pruned even under the size limit; `task` keeps its higher bar and is never capped below `taskMaxChars`.
- `read` output is always pruned (reloadable).
- `task` output uses a higher bar (default 4096 chars / 512 words).
- `question` output is never pruned (it captures an explicit user decision); `write`, `edit`, and plan tools can join the protected list via config only.
- `todowrite` and `skill` output is replaced with a short notice and not cached (redundant or reloadable).
- Pending and errored calls are never pruned: a call with no finished result has nothing to replace, and the failure text of an errored call is what the agent needs to diagnose the failure.
- A pruned result whose cached original was cleared by a newer compaction fails closed: the notice names the missing Content ID and asks for a rerun instead of restoring a phantom.

## Automatic strategies

- **Deduplication** — identical tool calls (same tool, same normalized arguments) keep only their most recent output; earlier ones are replaced with a notice.
- **Purge errors** — the arguments of errored tool calls are blanked after a configurable number of turns. Error text is preserved.
- **Reasoning strip** — reasoning parts over `thresholdChars` (default 500) are replaced with a marker. Messages carrying a protected tool keep their reasoning.

Both run as part of the scheduled compaction pass.

## Configuration

Smart Compact reads JSONC, with project settings overriding global settings:

1. Global: `~/.config/opencode/smart-compact.jsonc`
2. Project: `.opencode/smart-compact.jsonc`

Copy this recommended file to `~/.config/opencode/smart-compact.jsonc` for the best global setup. The project file overrides it; defaults apply for missing keys. If the global file is missing, create it with this exact content.

```jsonc
// Recommended global config. Create it on install if missing.
{
  "enabled": true,
  "pruning": {
    "maxChars": 1024,
    "maxWords": 128,
    "taskMaxChars": 4096,
    "taskMaxWords": 512,
    "protectedTools": ["question"],
    "alwaysPruneTools": ["read"],
    "discardTools": {
      "todowrite": "Successfully updated todos.",
      "skill": "Skill contents omitted after compaction; recall the skill if needed."
    },
    "preserveRecentTurns": 2,
    "truncateToolsChars": 1024,
    "useTokens": true
  },
  "strategies": {
    "deduplication": { "enabled": true, "protectedTools": ["question"] },
    "purgeErrors": { "enabled": true, "turns": 4, "protectedTools": ["question"] },
    "stripReasoning": { "enabled": true, "thresholdChars": 500 }
  },
  "tokens": { "enabled": true, "emergencyBudgetTokens": 0, "emergencyBudgetRatio": 0.6 },
  "awareness": {
    "enabled": true,
    "warnRatio": 0.5,
    "emergencyRatio": 0.8,
    "rearmStep": 0.05,
    "autoTrimRatio": 0.55,
    "contextWindowTokens": 0,
    "warnAtTokens": 0,
    "emergencyAtTokens": 0
  }
}
```

`tokens.enabled` routes measurements through the optional `@anthropic-ai/tokenizer` package when installed, with the built-in estimate as fallback. The built-in estimate assumes about four characters per token, while tool JSON and code usually sit closer to 3.2–3.5, so treat the reported numbers as a lower bound. Unknown config keys produce a warning naming the exact key path. The emergency budget scales with the model: `emergencyBudgetTokens` pins an exact number, and when it is `0` the budget is `emergencyBudgetRatio` (default `0.6`) of the resolved context window — the same denominator awareness uses, so a configured `awareness.contextWindowTokens` cap also lowers the derived budget. With no known window — or with `emergencyBudgetRatio: 0` — the warning stays off instead of firing against a guessed denominator. **Migration:** `emergencyBudgetTokens: 0` now means "derive from the window" rather than "disable". If you previously set it to `0` to silence the warning, set `emergencyBudgetRatio` to `0` instead; a positive `emergencyBudgetTokens` still pins an exact number and behaves exactly as before. When the measured cost exceeds the effective budget the run warns and still compacts: the budget is an early signal that a session is getting large, never a gate, because refusing to compact an over-budget session would deadlock it. `/magic-stats` also reports the plugin version, the measurement path that produced the numbers, heuristic-summary fallbacks, and the last-run time.

`awareness` is the context-pressure reminder. When the model-visible context of a session crosses `warnRatio` (default `0.5`) of the model's context window, the agent gets an unmissable directive on the next model call: the first line is the action itself ("ACT NOW — search your tool list for `compact_context` and call it"), followed by the current fill percentage with the token numbers behind it, the concrete reclaim action named right next to that ratio ("Reclaim action: call `compact_context` with `mode: \"trim\"` … or `mode: \"compact\"` …" — the plugin's own strategy names, so the sentence can be followed as a verbatim call), what is lost if it is ignored (overflow drops in-flight work), and a reminder to re-orient on the project before compacting. It is advisory only: the plugin never summarizes on its own, never aborts a step, and never mutates stored history. At warn level it fires once per crossing and re-arms only after the fill grows by `rearmStep`; at `emergencyRatio` (default `0.8`) it re-fires on every request until the pressure drops, so a heads-down agent cannot get one nudge and then silence — the emergency level bypasses the single-shot latch, while the hysteresis that clears the latch below the re-arm line is unchanged, so the wording never oscillates between levels. The latch clears automatically once every armed signal has fallen meaningfully below its warn line (the ratio line is `warnRatio` minus `rearmStep`; an armed `warnAtTokens` line uses the same step as a relative margin, 5% of the line). The measured percentage is a lower bound, because provider system prompts and tool schemas are invisible to the plugin. `awareness.contextWindowTokens` has two jobs. When a provider's model entry carries no `limit.context`, it is the fallback window, and both the reminder and the stats line say the denominator is configured rather than measured. When the registry DOES report a window, a positive value is a **hard cap**: the effective window is `min(registry, contextWindowTokens)`, the reminder says `capped=true` with the registry number behind it, and `compact_stats` appends `, capped from <registry tokens>`. That cap is the fix for very large windows, where `warnRatio 0.5` on a 1,000,000-token model would need ~500,000 visible tokens — a fill the plugin's own pruning keeps out of reach, so the reminder and the auto-trim would never fire. A value equal to or larger than the registry number is not a cap; it never raises the denominator above the model's real capacity. With neither a registry limit nor a configured value the advisory stays silent. Set `awareness.enabled` to `false` to silence it.

`awareness.warnAtTokens` and `awareness.emergencyAtTokens` are absolute thresholds in measured tokens, and they exist because a ratio cannot express "this session is already too big" at 1M. Both default to `0` (disabled). When armed, the fired level is the stronger of the ratio level and the token level, so `warnAtTokens: 150000` warns at 150,000 measured tokens even on a window where that is only 15%, and `emergencyAtTokens` escalates the wording (and the per-request re-fire) on count alone; the reminder says when an absolute line is the reason, so a low percentage is never unexplained. Order matters only when both are set: `emergencyAtTokens` must not be smaller than `warnAtTokens`, or the pair is rejected with a config warning and both fall back to the defaults. Every fired reminder writes one `[smart-compact] awareness <level> fired: <used>/<limit> (<pct>%) registry=<n> capped=<bool>` line, and every queued trim writes one `[smart-compact] auto-trim queued: …` line; a request that neither fires nor queues logs nothing, so a long session produces a handful of lines, not one per request.

`awareness.autoTrimRatio` is the one automatic action, and it is lossless: at or above that fill the plugin queues a tool-output-only trim for the next request, so bulky completed tool results become notices while their originals stay cached under a Content ID. No turn is summarized, no user message is touched, and a compaction already queued is never overwritten. It is armed by default at `0.55`, just above `warnRatio`, so a long session reclaims tool output without anyone remembering to call `compact_context`. One sustained high-pressure period trims once: after the queued trim is consumed the per-session latch keeps the next request quiet, and it re-arms either once the fill has grown by a re-arm step, or after it drops below the line and rises again. `0` disables it.

## Comparison

Compared with runtime context managers that compress inside the agent loop, Smart Compact is deliberately explicit: it compacts once on your command, preserves user messages verbatim, keeps tool structure, and never summarizes a turn without being asked. The trade-off is that compaction is agent-driven rather than automatic — the context-pressure reminder only tells the agent how full the window is and what to call; the agent (or you) still decides when to summarize. Tool-output trimming is the exception: armed by default at `awareness.autoTrimRatio`, it runs on its own at that fill, and it is lossless because every pruned original stays cached.

## Development

```bash
npm install
npm run typecheck   # tsc --noEmit
npm test            # compiles src + tests, runs node --test
npm run verify:package   # validates the npm payload
```

Source layout: `src/index.ts` (plugin entry), `plan.ts` (turn planning), `summarize.ts` (per-turn summaries), `apply.ts` (summary application), `prune.ts` (tool-result pruning), `omissions.ts` (bounded on-disk original store and retrieval cap), `strategies.ts` (deduplication, purge-errors), `awareness.ts` (context-pressure reminder), `config.ts`, `store.ts` (per-session state), `version.ts` (package version for stats).

## Releasing

Publishing is automated with GitHub Actions and npm [Trusted Publishing](https://docs.npmjs.com/trusted-publishers) (OIDC). There are no tokens or secrets to manage.

One-time setup:

1. `npm login`, then `npm publish` once to create the package on npm.
2. On npmjs.com, open the package → **Settings** → **Trusted Publisher** → **GitHub Actions**, and set: organization/user `mokhtarabadi`, repository `opencode-smart-compact`, workflow `publish.yml`.
3. Recommended: **Settings** → **Publishing access** → "Require two-factor authentication and disallow tokens".

Every release after that:

1. Bump `version` in `package.json`.
2. Commit and push to `main`. The workflow runs the tests and publishes only when the version is new; provenance is attached automatically.

## License

MIT
