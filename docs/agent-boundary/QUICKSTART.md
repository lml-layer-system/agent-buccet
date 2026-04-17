# Quickstart

This quickstart is the shortest correct path into Agent Buccet.

Goal:

- install Buccet
- initialize the machine
- open lawful scope
- run one guarded command
- add law
- add path sources
- run one path

## 1. Install

```bash
git clone https://github.com/lml-layer-system/agent-buccet
cd agent-buccet
sh scripts/install-agent-buccet.sh
```

Hosted install coming soon.

After install:

```bash
buccet init
buccet console
```

`buccet init` now does the fast machine bring-up.

If the packaged native layer is present, `buccet init` also arms strong-path immediately on a cold machine.

If you need to re-arm or recover the hook path manually:

```bash
buccet hook start
```

Useful first commands:

```bash
buccet where
buccet doctor --strict
buccet status
```

## 2. Open Scope And Run One Guarded Command

Open lawful scope:

```bash
buccet scope add .
```

Run:

```bash
buccet run -- /bin/echo protected
```

Inspect:

```bash
buccet status
buccet logs
```

The runtime returns only:

- `ALLOW`
- `DENY`
- `REQUIRE_APPROVAL`

## 3. Add Approved Or Denied Law

Approved UPL goes here:

```text
~/.buccet/upl-docs/acceptance
```

Denied UPL goes here:

```text
~/.buccet/upl-docs/denial
```

Compile manually:

```bash
buccet upl sync
```

If you forget, Buccet auto-syncs changed UPL docs before runtime surfaces like:

- `buccet console`
- `buccet run -- ...`
- `buccet hook run -- ...`
- `buccet path run ...`
- `buccet path watch ...`

Inspect compiled law:

```bash
buccet upl search <query>
buccet upl diff --search <query>
buccet upl show <upl-id>
```

## 4. Import External Yes-Side Material

Open the supported catalogs directly:

```bash
buccet upl sources --open skillsmp
buccet upl sources --open aitmpl
buccet upl sources --open skillhub
buccet upl sources --open agentskills
```

You can paste any of this into the acceptance or denial lanes:

- raw skill text
- `SKILL.md`
- `README.md`
- extracted package markdown

Operator map:

- [Where To Add What](WHERE_TO_ADD_WHAT.md)
- [UPL Acceptance Source Pipeline](UPL_ACCEPTANCE_SOURCE_PIPELINE.md)

## 5. Add Path Sources

Path sources are domain context, not permissions.

Add them:

```bash
buccet path sources add <path-name> <file...> [--domain <domain>]
```

List them:

```bash
buccet path sources list <path-name>
```

Show the path:

```bash
buccet path show <path-name>
```

## 6. Run A Path

Run:

```bash
buccet path run <path-name> [--request <text>] [--steps <n>|--all]
```

Watch:

```bash
buccet path watch <path-name|formation-id> [--follow]
```

List formations:

```bash
buccet path formations list
```

Close a formation:

```bash
buccet path close <path-name|formation-id>
```

## 7. Mental Model

The short version:

- UPL is the authority
- denial overrides acceptance
- paths organize lawful work
- path sources enrich lawful work
- the ledger proves what happened
- interactive and headless are the same Buccet body underneath

## 8. Next Docs

- [MCP Server](MCP_SERVER.md)
- [Where To Add What](WHERE_TO_ADD_WHAT.md)
- [Buccet Path Memory](BUCCET_PATH_MEMORY.md)
- [UPL Base Packs](UPL_BASE_PACKS.md)
- [Law Catalog](LAW_CATALOG.md)
- [Security Model](SECURITY_MODEL.md)
- [Launch Proof](LAUNCH_PROOF.md)
