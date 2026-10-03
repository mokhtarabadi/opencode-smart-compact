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
- **Retrievable pruning** — bulky completed tool output is replaced with a notice; the original is cached and can be read back with `read_omitted_content`.
- **Automatic strategies** — repeated identical tool calls are deduplicated (newest kept) and the arguments of stale errored tool calls are blanked.
- **Zero ongoing prompt overhead** — compaction is command-driven, not a background loop, so cache invalidation happens once per compaction.
- **Observable** — `/magic-stats` reports tokens pruned, turns summarized, and cached omissions.

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

Compaction is scheduled by the command and applied on the next model request.

### The agent-callable tool

`compact_context` lets the agent compress the session itself when the context window is under pressure, instead of waiting for the Manager to run a slash command. It reuses the exact command logic, so the two paths cannot drift.

| Input | Effect |
| --- | --- |
| `keepTurns` (optional) | Most recent turns to keep unsummarized. Default `0` summarizes all. |
| `mode` (optional) | `compact` (default) summarizes and prunes; `trim` prunes tool output only. |

### The omitted-content tool

`read_omitted_content` returns the cached original for a Content ID (e.g. `omitted-0001`) that appears in a pruning notice. The lookup is scoped to the current session. Use it only when the original cannot be reproduced by a new tool call.

## Pruning rules

- Completed tool results over the configured size limit (default 1024 chars / 128 words) are pruned to a notice; the original is cached.
- With `pruning.useTokens`, the word thresholds double as token budgets and measured tokens decide instead of chars/words.
- The preserve-recent window (default last 2 turns, plus always the last user message) keeps full text; sessions with no user message get no window.
- Results over `truncateToolsChars` (default 1024) are pruned even under the size limit; `task` keeps its higher bar and is never capped below `taskMaxChars`.
- `read` output is always pruned (reloadable).
- `task` output uses a higher bar (default 4096 chars / 512 words).
- `question` output is never pruned (it captures an explicit user decision); `write`, `edit`, and plan tools can join the protected list via config only.
- `todowrite` and `skill` output is replaced with a short notice and not cached (redundant or reloadable).
- Pending and errored calls are never pruned.
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

Defaults are applied automatically; only override what you need.

```jsonc
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
    "useTokens": false
  },
  "strategies": {
    "deduplication": { "enabled": true, "protectedTools": ["question"] },
    "purgeErrors": { "enabled": true, "turns": 4, "protectedTools": ["question"] },
    "stripReasoning": { "enabled": true, "thresholdChars": 500 }
  },
  "tokens": { "enabled": false, "emergencyBudgetTokens": 50000 }
}
```

`tokens.enabled` routes measurements through the optional `@anthropic-ai/tokenizer` package when installed, with the built-in estimate as fallback. Unknown config keys produce a warning naming the exact key path. When measured cost exceeds `emergencyBudgetTokens` (0 disables), the run aborts and state is left unchanged. `/magic-stats` also reports memo-saved tokens, last-run time, and whether the tokenizer backed the run.

## Comparison

Compared with runtime context managers that compress inside the agent loop, Smart Compact is deliberately explicit: it compacts once on your command, preserves user messages verbatim, keeps tool structure, and does not inject recurring prompts into every turn. The trade-off is that compaction is user-driven rather than automatic.

## Development

```bash
npm install
npm run typecheck   # tsc --noEmit
npm test            # compiles src + tests, runs node --test
npm run verify:package   # validates the npm payload
```

Source layout: `src/index.ts` (plugin entry), `plan.ts` (turn planning), `summarize.ts` (per-turn summaries), `apply.ts` (summary application), `prune.ts` (tool-result pruning), `strategies.ts` (deduplication, purge-errors), `config.ts`, `store.ts` (per-session state).

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
