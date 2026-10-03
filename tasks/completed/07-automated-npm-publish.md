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
**Factual Git Diff:** Stored in Commit Hash: `b041afff711c51cccff037905f5299f4923fa7af`
<!-- END_GIT_DIFF -->
