# Smart Compact

Lossless, **OpenCode V2-native** context compaction. User messages stay verbatim, each old assistant turn is replaced by its own summary, and bulky tool output is pruned to a notice while the original is cached and retrievable.

This is a clean-room rewrite of the idea behind `magic-compact`, built on OpenCode 2's plugin API. The V1 plugin mutated the stored transcript directly; V2 does not expose that, so Smart Compact keeps a per-session compaction state in plugin storage and applies it to the model-visible messages on every request through the `session.hook("context")` hook.

## Why V2-native

| V1 approach | Smart Compact (V2) |
| --- | --- |
| Mutate the stored transcript | Transform model-visible messages per request |
| `session.messages` / `part.update` / `tui.showToast` | `session.hook("context")`, `ctx.command.transform`, `ctx.tool.transform`, `ctx.storage` |
| One lossy summary blob | Per-turn summaries + verbatim user messages + retrievable pruning |

## Commands

| Command | Effect |
| --- | --- |
| `/magic-compact [N]` | Summarize old assistant turns, keeping the last N; prune bulky tool output |
| `/magic-trim [N]` | Prune bulky tool output only, without summarizing |
| `/magic-stats` | Log cumulative savings for the session |

Compaction is scheduled by the command and applied on the next model request.

## Tool

`read_omitted_content` returns the cached original for a Content ID (e.g. `omitted-0001`) that appears in a pruning notice. Use it only when the original cannot be reproduced by a new tool call.

## Pruning rules

- Completed tool results over ~1024 chars or ~128 words are pruned to a notice; the original is cached.
- `read`, `write`, `edit`, `apply_patch`, `todowrite`, and `skill` outputs are always prunable (reloadable).
- Pending and errored calls are never pruned.

## Install

```
opencode plugin add /absolute/path/to/opencode-smart-compact
```

or add the directory to `plugins` in `opencode.json`:

```json
{ "plugins": ["/absolute/path/to/opencode-smart-compact"] }
```

## Development

```
npm install
npm run typecheck
```

## License

MIT
