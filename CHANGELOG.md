# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added

- Phase 0 bootstrap: Kanban dirs (`tasks/backlog`, `in-progress`, `qa`, `completed`, `archive`), `AGENTS.md` project hub, `docs/conventions.md` standards, validated `opencode.json` project config.
- Turn-based compaction planning (`src/plan.ts`) that groups history by user boundary.
- Unit test suite (`tests/`) run through a compiled build (`tsconfig.test.json`), wired to `npm test`.
- Automatic strategies (`src/strategies.ts`): deduplication of identical tool calls and purge-errors of stale errored tool inputs.
- Configuration (`src/config.ts`): `.opencode/smart-compact.jsonc` over global `~/.config/opencode/smart-compact.jsonc` over built-in defaults.
- `/magic-stats` and `/magic-compact` now post a user-visible synthetic message instead of logging only to the server.
- README rewritten for OpenCode V2: install, commands, pruning rules, strategies, and configuration.
- `LICENSE` (MIT) and `scripts/verify-package.mjs` publish gate added; `prepublishOnly` runs typecheck, tests, and payload verification.

### Changed

- `package.json` completed for publishing: exports map, `files` allowlist, `@opencode/plugin` peer dependency, repository metadata, engines, and package scripts; version bumped to 0.2.0.
- Summaries now preserve tool-call/tool-result/media structure and replace only prose and reasoning, instead of collapsing the whole assistant message.
- Summarization runs in the command handler via `ctx.generate.text`, out of the `context` hook.
- Omission ids are monotonic (`nextOmissionId`) and no longer collide across restarts.
- `read_omitted_content` is scoped to the calling session's state.
- Package renamed to `@mokhtarabadi/opencode-smart-compact` with `publishConfig.access: "public"` because the unscoped name is owned by another npm author.
- Automated npm publishing via GitHub Actions OIDC trusted publishing (`.github/workflows/publish.yml`); publishes on push when the version is new, with no token secret.

### Fixed

- Per-tool pruning rules: `question` is never pruned, `task` uses a higher threshold, `todowrite`/`skill` are discarded without caching, `read` is always pruned.
