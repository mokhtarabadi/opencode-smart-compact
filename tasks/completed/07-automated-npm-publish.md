# Task 07: Automated npm publishing via GitHub Actions OIDC

**File:** `tasks/completed/07-automated-npm-publish.md`
**Source:** manager
**Type:** feature
**Status:** closed

> **Mode:** autopilot locked (Manager, this session).

## Goal

Publish `@mokhtarabadi/opencode-smart-compact` automatically from GitHub Actions using npm Trusted Publishing (OIDC), so pushing a version bump publishes the package with no long-lived token and no manual `npm publish`.

## Manager's Notes

The Manager does not want to handle npm tokens and wants publishing to happen automatically on push. npm supports OIDC trusted publishing for GitHub Actions (`id-token: write`, `npm publish`, automatic provenance). npm requires the package to already exist before a trusted publisher can be configured, so a single one-time first publish is required; every later release is hands-off.

## Local TODOs

- [ ] Add `.github/workflows/publish.yml` (push to main + manual dispatch, OIDC, publish-if-version-new)
- [ ] Document the one-time setup and the release flow in the README
- [ ] Validate the workflow YAML and re-run typecheck/tests

## Acceptance Criteria

- [x] Workflow grants `id-token: write` and publishes via OIDC with no token secret
- [x] Workflow skips publishing when the version is already on npm
- [x] README documents first-publish, trusted publisher config, and the push-to-release flow
- [x] Workflow YAML parses and `npm run typecheck` exits 0

## Verification Evidence

- **Test command:** rtk test npm test
- **Expected result:** typecheck and unit tests pass; workflow YAML parses
- **Actual result:** YAML parsed OK (jobs: publish, id-token: write); 14/14 tests pass; typecheck exit 0
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

- **Risk:** A workflow misconfiguration publishes a wrong version or fails silently
- **Rollback plan:** The version-exists guard prevents duplicate publishes; delete the workflow file to revert to manual publishing

---

## Execution Log & Reasoning

Autopilot locked (Manager). Chosen approach: npm Trusted Publishing (OIDC) from GitHub Actions — the only token-free, hands-off option. Verified against npm docs (`docs.npmjs.com/trusted-publishers`) and GitHub docs.

Changes:
- `.github/workflows/publish.yml`: triggers on push to `main` (ignoring docs-only paths) and `workflow_dispatch`; `permissions: id-token: write` for OIDC; Node 24; `npm ci`; `npm test`; a version-exists guard via `npm view`; publishes with `npm publish --access public` only when the version is new. No `NODE_AUTH_TOKEN` anywhere.
- `README.md`: "Releasing" section with the one-time setup and the push-to-release flow.
- `CHANGELOG.md`: documented.

Known prerequisite (from npm docs and the `azu/setup-npm-trusted-publish` note): npm requires the package to exist before a trusted publisher can be configured, so one initial publish is unavoidable; it can be done with a browser `npm login` (no token) rather than a token secret.

Verification: YAML parsed (jobs: publish, id-token: write); 14/14 tests; typecheck exit 0.

Blocker: the first publish and the npmjs.com trusted-publisher entry are Manager-owned (needs npm account interaction). After that, publishing is fully automatic on push.

## Factual Git Diff

<!-- BEGIN_GIT_DIFF -->
```diff
diff --git a/.github/workflows/publish.yml b/.github/workflows/publish.yml
new file mode 100644
index 00000000..d374e159
--- /dev/null
+++ b/.github/workflows/publish.yml
@@ -0,0 +1,60 @@
+name: Publish to npm
+
+# Publishes on every push to main, but only when the package.json version is not
+# already on npm. Authentication uses npm Trusted Publishing (OIDC) — there is
+# no token or secret to configure.
+#
+# One-time prerequisite: the package must exist on npm before its trusted
+# publisher can be configured. See README "Releasing" for the first publish.
+on:
+  push:
+    branches: [main]
+    paths-ignore:
+      - "**/*.md"
+      - "LICENSE"
+      - ".gitignore"
+  workflow_dispatch:
+
+permissions:
+  contents: read
+  id-token: write # required for npm OIDC trusted publishing
+
+concurrency:
+  group: npm-publish
+  cancel-in-progress: false
+
+jobs:
+  publish:
+    runs-on: ubuntu-latest
+    steps:
+      - uses: actions/checkout@v6
+
+      - uses: actions/setup-node@v6
+        with:
+          node-version: "24"
+          registry-url: "https://registry.npmjs.org"
+          package-manager-cache: false
+
+      - name: Install dependencies
+        run: npm ci
+
+      - name: Test
+        run: npm test
+
+      - name: Check whether this version is already published
+        id: check
+        run: |
+          set -euo pipefail
+          NAME="$(node -p "require('./package.json').name")"
+          VERSION="$(node -p "require('./package.json').version")"
+          if npm view "${NAME}@${VERSION}" version >/dev/null 2>&1; then
+            echo "publish=false" >> "$GITHUB_OUTPUT"
+            echo "${NAME}@${VERSION} is already published; nothing to do."
+          else
+            echo "publish=true" >> "$GITHUB_OUTPUT"
+            echo "${NAME}@${VERSION} is new; it will be published."
+          fi
+
+      - name: Publish
+        if: steps.check.outputs.publish == 'true'
+        run: npm publish --access public
diff --git a/CHANGELOG.md b/CHANGELOG.md
index 9f431e4a..67a62179 100644
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -25,6 +25,7 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
 - Omission ids are monotonic (`nextOmissionId`) and no longer collide across restarts.
 - `read_omitted_content` is scoped to the calling session's state.
 - Package renamed to `@mokhtarabadi/opencode-smart-compact` with `publishConfig.access: "public"` because the unscoped name is owned by another npm author.
+- Automated npm publishing via GitHub Actions OIDC trusted publishing (`.github/workflows/publish.yml`); publishes on push when the version is new, with no token secret.
 
 ### Fixed
 
diff --git a/README.md b/README.md
index 0db7aa73..74d5b2b1 100644
--- a/README.md
+++ b/README.md
@@ -119,6 +119,21 @@ npm run verify:package   # validates the npm payload
 
 Source layout: `src/index.ts` (plugin entry), `plan.ts` (turn planning), `summarize.ts` (per-turn summaries), `apply.ts` (summary application), `prune.ts` (tool-result pruning), `strategies.ts` (deduplication, purge-errors), `config.ts`, `store.ts` (per-session state).
 
+## Releasing
+
+Publishing is automated with GitHub Actions and npm [Trusted Publishing](https://docs.npmjs.com/trusted-publishers) (OIDC). There are no tokens or secrets to manage.
+
+One-time setup:
+
+1. `npm login`, then `npm publish` once to create the package on npm.
+2. On npmjs.com, open the package → **Settings** → **Trusted Publisher** → **GitHub Actions**, and set: organization/user `mokhtarabadi`, repository `opencode-smart-compact`, workflow `publish.yml`.
+3. Recommended: **Settings** → **Publishing access** → "Require two-factor authentication and disallow tokens".
+
+Every release after that:
+
+1. Bump `version` in `package.json`.
+2. Commit and push to `main`. The workflow runs the tests and publishes only when the version is new; provenance is attached automatically.
+
 ## License
 
 MIT
```
<!-- END_GIT_DIFF -->
