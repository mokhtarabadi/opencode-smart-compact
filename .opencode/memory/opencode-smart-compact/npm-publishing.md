---
created_at: '2026-10-03T08:07:44.802074+00:00'
status: active
tags: []
updated_at: '2026-10-03T08:07:44.802084+00:00'
---

npm publishing is automated via GitHub Actions OIDC trusted publishing (.github/workflows/publish.yml) with id-token: write and NO token secret. The workflow publishes on push to main only when package.json version is not already on npm. One-time prerequisite (Manager-owned): first publish with npm login + npm publish, then add the trusted publisher on npmjs.com (user mokhtarabadi, repo opencode-smart-compact, workflow publish.yml).