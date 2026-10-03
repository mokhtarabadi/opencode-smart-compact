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
```diff
diff --git a/CHANGELOG.md b/CHANGELOG.md
index 45577a91..9f431e4a 100644
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -24,6 +24,7 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
 - Summarization runs in the command handler via `ctx.generate.text`, out of the `context` hook.
 - Omission ids are monotonic (`nextOmissionId`) and no longer collide across restarts.
 - `read_omitted_content` is scoped to the calling session's state.
+- Package renamed to `@mokhtarabadi/opencode-smart-compact` with `publishConfig.access: "public"` because the unscoped name is owned by another npm author.
 
 ### Fixed
 
diff --git a/README.md b/README.md
index 6ebdd9dd..0db7aa73 100644
--- a/README.md
+++ b/README.md
@@ -28,7 +28,7 @@ Because the transcript is never modified, a compaction can be recomputed from st
 Publish-aware install once the package is on npm:
 
 ```bash
-opencode plugin add opencode-smart-compact
+opencode plugin add @mokhtarabadi/opencode-smart-compact
 ```
 
 Or add the directory directly while developing:
@@ -40,7 +40,7 @@ opencode plugin add /absolute/path/to/opencode-smart-compact
 or list it in `opencode.json(c)`:
 
 ```json
-{ "plugins": ["opencode-smart-compact"] }
+{ "plugins": ["@mokhtarabadi/opencode-smart-compact"] }
 ```
 
 ## Usage
diff --git a/package.json b/package.json
index 2c6296ca..591d35a6 100644
--- a/package.json
+++ b/package.json
@@ -1,5 +1,5 @@
 {
-  "name": "opencode-smart-compact",
+  "name": "@mokhtarabadi/opencode-smart-compact",
   "version": "0.2.0",
   "description": "Lossless, V2-native context compaction for OpenCode: per-turn summaries, verbatim user messages, retrievable tool-I/O pruning.",
   "type": "module",
@@ -45,6 +45,9 @@
   "peerDependencies": {
     "@opencode/plugin": ">=2.0.0"
   },
+  "publishConfig": {
+    "access": "public"
+  },
   "devDependencies": {
     "@opencode/plugin": "2.0.22",
     "typescript": "^5.9.0"
```
<!-- END_GIT_DIFF -->
