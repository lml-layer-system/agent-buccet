# Agent Buccet

The Brakes and governed runtime for AI agents.

Agent Buccet intercepts file, env, shell, network, delete, and chat actions before they land.

**Agents can propose. They cannot authorize.**

Prompt injection can change the agent’s mind.  
Buccet controls its hands.

## The Spec, Daily Driver, and Brakes

```text
failure → known/unknown → class/gap → boundary → UPL / user custom rules → Buccet enforcement → proof ledger
```

The **AI Failure Periodic Table** is the spec: it names the failure.  
**Daily Driver MCP** brings the map into Cursor/Claude workflows.  
**Agent Buccet** is the brakes: it enforces the boundary before actions land.  
The **witness ledger** proves what was allowed or denied.

AI Failure Periodic Table: https://github.com/lml-layer-system/ai-failure-periodic-table

## Demo

<!-- add trimmed video/GIF here -->

In one gauntlet, Buccet blocked:

```text
network.send  → https://example.com
fs.read       → .env
sys.env.read  → AWS_SECRET_ACCESS_KEY
tool.exec     → curl
fs.write      → GAUNTLET_WRITE_PROBE.txt
fs.delete     → README.md
comm.send     → chat:primary
```

Same spine. Different surfaces. All denied until law says otherwise.

This README is the front door. The full boundary set — spend, cost pressure, telemetry/disclosure, input admission, secrets, payload limits, motion/fanout, law mutation, and witness/audit trails — lives in the deeper docs.

## Why

AI agents are getting access to files, terminals, APIs, secrets, browsers, chat, and money.

Current permissions are too coarse: either the agent has a tool or it does not.

Buccet adds an action-time boundary between agent intent and real-world consequence.


## Install

```bash
git clone https://github.com/lml-layer-system/agent-buccet
cd agent-buccet
sh scripts/install-agent-buccet.sh
buccet init
buccet console
```

## MCP

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

## Read next

- [Quickstart](docs/quickstart.md)
- [Security model](docs/security-model.md)
- [Current limits](docs/current-limits.md)
- [MCP guide](docs/guides/mcp-server.md)
- [Deep dive](docs/agent-buccet-deep-dive.md)

## Contact

[ryangat@lmlsystemlayer.com](mailto:ryangat@lmlsystemlayer.com)  
X: [@lml_layer](https://x.com/lml_layer)
