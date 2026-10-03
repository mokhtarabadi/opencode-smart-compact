# Task 06: Rename package to scoped npm name

**File:** `tasks/completed/06-scoped-npm-rename.md`
**Source:** manager
**Type:** improvement
**Status:** closed

> **Mode:** autopilot locked (Manager, this session).

## Goal

Rename the package to `@mokhtarabadi/opencode-smart-compact` because the unscoped name is owned by another npm author, and mark it public so a scoped publish succeeds.

## Manager's Notes

`npm view opencode-smart-compact` shows version 0.1.0 maintained by `alpertarhan` (published 2026-09-25), unrelated to us. The Manager chose the scoped name `@mokhtarabadi/opencode-smart-compact`. A scoped package needs `publishConfig.access = "public"`. Local npm auth is absent, so the actual `npm publish` is Manager-owned.

## Local TODOs

- [ ] Set `name` to `@mokhtarabadi/opencode-smart-compact`
- [ ] Add `publishConfig: { "access": "public" }`
- [ ] Update README install commands to the scoped name
- [ ] Re-run typecheck, tests, and package verification

## Acceptance Criteria

- [x] `package.json` name is `@mokhtarabadi/opencode-smart-compact` with public access
- [x] README references the scoped package name for install
- [x] `npm pack --dry-run` still lists src, README, LICENSE
- [x] `npm run typecheck` exits 0 and unit tests pass

## Verification Evidence

- **Test command:** rtk test npm test
- **Expected result:** typecheck and unit tests pass; pack payload valid
- **Actual result:** 14/14 tests pass; verify:package OK (13 files); pack shows `@mokhtarabadi/opencode-smart-compact@0.2.0`
- **Exit code:** 0

> Verification runner rule: `npm test` is the complete underlying test command. The first verification run MUST use the `rtk test` prefix; record the exact prefixed command above. A raw rerun is allowed only after a failed RTK run for detailed diagnostics.

## Definition of Done

The task is NOT done unless ALL of the following are true (unconditional, applies to every source type):

- [x] Build/Test/Lint pass with exit code 0
- [ ] `lint_task_file` passes on the active task file
- [x] `CHANGELOG.md` updated via Parse-Then-Append
- [x] `verification-before-completion` applied and evidence recorded

> **Box-checking mandate:** During the implementation `<summary_phase>`, the Hands MUST check every `## Acceptance Criteria` and `## Definition of Done` box that is genuinely satisfied by the recorded `## Verification Evidence` — do NOT defer box-checking to a closure task. See `<hands_protocols>` for the authoritative instruction.

## Risk & Rollback

- **Risk:** Wrong scope name breaks the publish; a scoped package without public access is private
- **Rollback plan:** Revert `package.json` and README; no source code changes

---

## Execution Log & Reasoning

[LITE] Single logical change (package identity metadata plus its README reference); no source behavior, security, or financial impact; verification is a payload/typecheck check. Bridge QA/review skipped under the Lite carve-out.

Autopilot locked (Manager). The unscoped npm name `opencode-smart-compact` is owned by `alpertarhan` (0.1.0, 2026-09-25), so the Manager chose the scoped name.

Changes:
- `package.json`: `name` → `@mokhtarabadi/opencode-smart-compact`; added `publishConfig.access: "public"`; repository/homepage/bugs already point at `mokhtarabadi/opencode-smart-compact`.
- `README.md`: install commands and the `plugins` entry use the scoped name.
- `CHANGELOG.md`: documented the rename.

Verification: `npm pack --dry-run` shows `@mokhtarabadi/opencode-smart-compact@0.2.0`, 13 files; `verify:package` OK; 14/14 tests; typecheck exit 0.

Blocker: local npm auth is absent (`npm whoami` → ENEEDAUTH) and the `mokhtarabadi` scope must be owned by the Manager's npm account. So `npm publish --access public` is Manager-owned.

## Factual Git Diff

<!-- BEGIN_GIT_DIFF -->
**Factual Git Diff:** Stored in Commit Hash: `093ff31b986b6aa951a61b6db059308ce5a4e107`
<!-- END_GIT_DIFF -->
