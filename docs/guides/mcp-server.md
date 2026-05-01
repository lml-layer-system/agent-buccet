# Buccet MCP Server

`buccet mcp` starts an MCP (Model Context Protocol) server over stdio.

Every tool call from the host passes through the full Buccet boundary enforcement chain before execution. MCP is transport only — the same UPL, tracks, bodyguard, substrate, and ledger path applies regardless of how the request arrived.

## What This Means

- The AI model calls tools through `buccet mcp`
- Buccet evaluates each call against active law before anything executes
- Out-of-scope targets are denied on contact (`BOUNDARY.DEFAULT_SCOPE.01`)
- Unknown tools are denied on contact (`BOUNDARY.TOOL.UNMAPPED`)
- Actions without standing law ask for approval (`BOUNDARY.DEFAULT.ASK.01`)
- Every decision is recorded in the ledger with provenance `mcp_host`

No boundary logic is duplicated or bypassed. Adding MCP as a host does not change what Buccet allows.

## Start The Server

```bash
buccet mcp
```

`buccet mcp` ensures the hook daemon is running, then spawns the MCP server with inherited stdio.

Overrides:

```bash
buccet mcp --session-id <id> --actor-id <id> --dry-run
```

## Wire Into An MCP Host

**Claude Desktop** — add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "buccet": {
      "command": "buccet",
      "args": ["mcp"]
    }
  }
}
```

**Cursor** — add to `.cursor/mcp.json` in your project or `~/.cursor/mcp.json` globally:

```json
{
  "mcpServers": {
    "buccet": {
      "command": "buccet",
      "args": ["mcp"]
    }
  }
}
```

Any MCP-compatible host that spawns a stdio server works the same way.

## AI Failure Periodic Table Coexistence

`buccet mcp` still starts the full Agent Buccet runtime. It does not start a lighter MCP-only boundary, and it does not bypass the denial side.

This matters when Buccet is used alongside the AI Failure Periodic Table:

- on a fresh machine, `buccet mcp` auto-initializes Agent Buccet if needed
- if no default scopes exist yet, it seeds a usable fallback scope from the operator home directory
- the curated base acceptance pack includes the exact `ai-failure-periodic-table` capability lane
- the same Buccet denial path still wins on overlap or out-of-scope motion

So the coexistence rule is simple:

- `ai-failure-periodic-table` can be present as a named capability lane
- MCP can bootstrap cleanly on first start
- the same Buccet body remains in charge the whole time

No second Buccet is created for MCP hosts.

## Available Tools

| Tool | Boundary class | What it does |
|------|---------------|--------------|
| `read_file` | `fs.read` | Read file contents |
| `write_file` | `fs.write` | Write or create a file |
| `append_file` | `fs.append` | Append to a file |
| `delete_file` | `fs.delete` | Delete a file |
| `make_directory` | `fs.mkdir` | Create a directory |
| `move_file` | `fs.move` | Move or rename a file |
| `run_command` | `tool.exec` | Run a shell command |
| `send_http_request` | `network.send` | Send an HTTP request |
| `read_env` | `sys.env.read` | Read an environment variable |
| `emit_chat` | `chat.emit` | Emit a chat message |

## Allowing MCP Tool Calls Via UPL

By default, every tool call from an MCP host requires approval because no standing law has been issued yet. To authorize a class of actions without interactive approval, add acceptance law to your UPL.

**Where to write acceptance law:**

```text
~/.buccet/upl-docs/acceptance/
```

**Example: allow the AI to read files in your project:**

Create `~/.buccet/upl-docs/acceptance/mcp-reads.md`:

```markdown
Allow reading files inside /Users/you/your-project.
```

**Example: allow running commands:**

```markdown
Allow running shell commands in /Users/you/your-project.
```

**Sync the law:**

```bash
buccet upl sync
```

Or let Buccet auto-sync — it syncs before every `buccet mcp` start.

**Inspect compiled law:**

```bash
buccet upl list --type approved
buccet upl search "read files"
```

**Deny side** — write blocking rules to `~/.buccet/upl-docs/denial/`. Denial always overrides acceptance.

```markdown
Never delete files inside /Users/you/your-project.
Never run commands that modify system configuration.
```

## Approving Individual Requests

When a tool call comes back as `REQUIRE_APPROVAL`, approve it interactively:

```bash
buccet console
```

The console shows pending decisions. Approve to allow once. Approve-as-law to allow permanently for that class of action.

## First-Start Cold Boot

The first time you run `buccet mcp`, if the hook daemon is not running, Buccet starts it automatically. This takes a few seconds on a cold machine. After that, subsequent starts are fast.

To pre-warm before connecting an MCP host:

```bash
buccet hook start
buccet hook status
```

## Ledger

Every MCP tool call is recorded with `provenance: mcp_host`. Inspect the trail:

```bash
buccet ledger --follow
buccet logs
```

## Next

- [Quickstart](../quickstart.md)
- [Where To Add What](WHERE_TO_ADD_WHAT.md)
- [UPL Base Packs](../specs/UPL_BASE_PACKS.md)
- [Law Catalog](../specs/LAW_CATALOG.md)
- [Security Model](../security-model.md)
