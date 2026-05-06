# Post-public hardening: npm package and global CLI install

## Context

The GitHub repo is public and the codebase passes all gate checks (typecheck, lint, 56/56 stable contracts, quickstart demo, docs, license). However, the npm packaging and global CLI install surface has not been finalized.

## Tasks

- [ ] **Decide `bin.buccet` strategy** — should `package.json` declare `"bin": { "buccet": "./cli/buccet.ts" }`? Raw `.ts` entry requires Node 22+ type stripping or Bun. Evaluate whether a compiled wrapper or shebang adjustment is needed for broad compatibility.
- [ ] **Test `npm install -g ./agent-buccet-0.2.0.tgz`** — verify the tarball installs cleanly and the CLI is usable without the standalone installer.
- [ ] **Verify `buccet --help`, `buccet init`, `buccet doctor --strict`** — end-to-end smoke test of the global CLI after npm install.
- [ ] **Decide repo-root `npm publish` vs `dist/agent-buccet`** — the release workflow currently runs `prepare-agent-buccet-package.ts` (which builds a rich standalone tree under `dist/agent-buccet`) AND publishes from repo root. These are two different surfaces. Align them or document the split.
- [ ] **Consider `prepublishOnly` / `prepack`** — add a safety gate (e.g. `npm run typecheck`) so `npm publish` cannot ship broken types.
- [ ] **Wire `types` if publishing declarations** — `tsconfig.build.json` emits declarations to `dist/` but nothing in the publish surface references that output. Decide whether to ship `.d.ts` files and point `"types"` at them, or document the raw-TS-only model.

## Additional context

- `"engines": { "node": ">=22" }` is already set.
- The standalone installer (`scripts/install-agent-buccet.sh`) and release workflow (`release.yml`) with Bun-compiled binaries are a separate distribution path that works today.
- The `./integrations` export exists in repo-root `package.json` but not in the standalone `package.json` — reconcile if needed.
- 90 lint warnings remain (84 `noNonNullAssertion`, 6 `noUnusedVariables`) — all at `warn` level, not blocking.
