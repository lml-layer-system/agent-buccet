# Base Acceptance Pack Inventory

This document enumerates the live shipped base Buccet acceptance UPL pack.

It is one acceptance-side UPL system. Runtime still compiles it into the same live field as denial, and deny overrides acceptance on overlap.

## Summary

- Total acceptance-side UPL entries seeded per opened workspace session: 12
- Workspace rails: 5
- Safe local exec rails: 4
- Bounded web research rails: 3

## Read This

Each row below shows the seeded acceptance ID and the plain-language description of what the rail opens.

- If you want to know what the base pack allows, this is the inventory.
- If you want to customize the pack, start here, then edit the ledger or replace the seeded pack.
- These are lawful rails, not broad capability grants.
- Generic shell access and generic outbound network access are still not part of the base acceptance pack.

Throughout this document, `<workspace-root>` means the workspace path the user explicitly opened into lawful scope.

## Workspace Rails (5)

These are the base rails that materialize when a workspace is opened.

- `ACCEPT.WORKSPACE.READ.001`: Read motion inside `<workspace-root>` is lawful.
  Target corridor: `<workspace-root>` prefix
  Action kinds: `fs.read`

- `ACCEPT.WORKSPACE.MUTATION.002`: Scoped code and document mutation inside `<workspace-root>` is lawful.
  Target corridor: `<workspace-root>` prefix
  Action kinds: `fs.write`, `fs.append`

- `ACCEPT.LOCAL.ORGANIZATION.003`: Non-destructive organization inside `<workspace-root>` is lawful.
  Target corridor: `<workspace-root>` prefix
  Action kinds: `fs.mkdir`, `fs.move`

- `ACCEPT.INTERNAL.ARTIFACTS.004`: Standard internal output roots under the workspace are lawful.
  Target corridors:
  `'<workspace-root>/outputs'`
  `'<workspace-root>/reports'`
  `'<workspace-root>/artifacts'`
  Action kinds: `fs.write`, `fs.append`

- `ACCEPT.NOTES.TASKS.007`: Local notes, tasks, memory, and Buccet workspace memory roots are lawful.
  Target corridors:
  `'<workspace-root>/.buccet'`
  `'<workspace-root>/notes'`
  `'<workspace-root>/tasks'`
  `'<workspace-root>/memory'`
  Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.mkdir`, `fs.move`

## Safe Local Exec Rails (4)

These rails allow bounded local developer/runtime commands. They do not open a broad shell rail.

- `ACCEPT.SAFE.LOCAL.EXEC.005A`: Bounded local repository inspection commands are lawful.
  Tool targets: `git`, `rg`
  Request text patterns:
  `git status`
  `git diff`
  `git grep`
  `git log`
  `git show`
  `git rev-parse`
  `git branch`
  `git ls-files`
  `rg`

- `ACCEPT.SAFE.LOCAL.EXEC.005B`: Bounded package-runner quality commands are lawful.
  Tool targets: `npm`, `pnpm`, `yarn`
  Request text patterns:
  `npm test`
  `npm lint`
  `npm run test`
  `npm run lint`
  `npm run typecheck`
  `npm run build`
  `pnpm ...`
  `yarn ...`

- `ACCEPT.SAFE.LOCAL.EXEC.005C`: Bounded test, lint, and typecheck tools are lawful.
  Tool targets: `pytest`, `ruff`, `mypy`, `eslint`, `prettier`, `tsc`
  Request text patterns:
  `pytest`
  `ruff check`
  `ruff format`
  `mypy`
  `eslint`
  `prettier`
  `tsc`

- `ACCEPT.SAFE.LOCAL.EXEC.005D`: Bounded native-toolchain quality commands are lawful.
  Tool targets: `cargo`, `go`, `make`
  Request text patterns:
  `cargo test`
  `cargo check`
  `cargo fmt`
  `cargo clippy`
  `go test`
  `go fmt`
  `go vet`
  `make test`
  `make lint`
  `make build`
  `make check`

## Bounded Web Research Rails (3)

These rails allow bounded research and retrieval against explicit documentation, source, and search/fetch domains. They do not open broad outbound network egress.

- `ACCEPT.BOUNDED.WEB.RESEARCH.006A`: Documentation and reference retrieval is lawful.
  Target domain corridors:
  `developer.mozilla.org`
  `docs.python.org`
  `docs.npmjs.com`
  `nodejs.org`
  `docs.rs`
  `pkg.go.dev`
  `www.typescriptlang.org`
  `developer.apple.com`
  Request text patterns:
  `fetch`
  `read`
  `browse`
  `lookup`
  `docs`
  `documentation`
  `reference`
  `manual`
  `guide`
  `api`

- `ACCEPT.BOUNDED.WEB.RESEARCH.006B`: Source and repository retrieval is lawful.
  Target domain corridors:
  `github.com`
  `api.github.com`
  `raw.githubusercontent.com`
  Request text patterns:
  `fetch`
  `read`
  `browse`
  `lookup`
  `docs`
  `documentation`
  `reference`
  `raw`
  `source`
  `repository`
  `repo`

- `ACCEPT.BOUNDED.WEB.RESEARCH.006C`: Search and retrieval provider use is lawful.
  Target domain corridors:
  `duckduckgo.com`
  `search.brave.com`
  `exa.ai`
  `firecrawl.dev`
  Request text patterns:
  `search`
  `query`
  `lookup`
  `research`
  `retrieve`
  `crawl`
  `browse`

## Important Limits

The base acceptance pack is intentionally narrow.

- It does not create a broad shell rail.
- It does not create a broad outbound network rail.
- It does not open delete.
- It does not open secret roots.
- It does not override the denial constitution.

At runtime, these rails enter the same live UPL field as denial walls. If an acceptance rail overlaps a denial wall, deny wins.
