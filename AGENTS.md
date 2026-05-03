# AGENTS.md

## Cursor Cloud specific instructions

### Product overview

Agent Buccet is a full-boundary enforcement runtime for AI agents. It intercepts tool calls, network sends, file writes, and spend commitments against user-authored standing law (UPL) at runtime. There is no web frontend or database — the entire product runs as a Node.js TypeScript runtime with a CLI operator interface.

### Development requirements

- **Node.js 22+** and **npm 10+** are required. See `CONTRIBUTING.md` for setup.
- Run `npm install` to install all dependencies.

### Key commands

| Task | Command |
|------|---------|
| Typecheck | `npm run typecheck` |
| Lint | `npm run lint` |
| Lint + fix | `npm run lint:fix` |
| Foundation contract | `npm run test:agent-buccet:foundation` |
| Core blocking contracts | See `CONTRIBUTING.md` "Blocking contracts" section |
| Full stable contract suite | `npm run check:agent-buccet:contracts-stable` |
| E2E demo | `npm run demo:agent-buccet` |
| Quickstart demo | `npm run demo:quickstart` |
| CLI entry | `node cli/buccet.ts <command>` |

### Testing model

This codebase uses **executable contract tests** (in `contracts/`), not a traditional test framework like Jest or Vitest. Each contract is a standalone Node.js script that uses `assert` and exits with code 0 on success. All contract scripts are listed as `test:agent-buccet:*` scripts in `package.json`.

### Non-obvious gotchas

- `npm run lint` exits with code 0. There are ~90 remaining warnings (`noNonNullAssertion`, `noUnusedVariables`) which are configured as `warn` in `biome.json` and are acceptable.
- The `demo:agent-buccet` script has one expected assertion failure ("Track violation surfaced") — this is a known condition in the demo where a track corridor exit is not flagged as a violation.
- `buccet run` and `buccet hook start` require the native hook daemon (`libbuccet-hook.so`) to be running. In Cloud Agent environments, the hook daemon may not stay running because it requires specific session parameters. Use the programmatic API or `npm run demo:quickstart` for end-to-end testing instead.
- The MCP contract (`test:agent-buccet:mcp`) depends on the native hook daemon and may fail in environments where it can't persist.
- The `chat-boundary` contract (`test:agent-buccet:chat-boundary`) has a pre-existing failure related to `deny_as_law` UPL materialization.
- CI runs on Node.js 22. The CI workflow is at `.github/workflows/ci.yml`.
- PR template is at `.github/PULL_REQUEST_TEMPLATE.md`.
