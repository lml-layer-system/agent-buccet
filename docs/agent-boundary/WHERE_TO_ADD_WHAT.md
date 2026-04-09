# Where To Add What

This is the shortest correct map for Agent Buccet.

## Start Here

- initialize: `buccet init`
- operator cockpit: `buccet console`
- full machine posture: `buccet doctor --strict`
- full add-map from the CLI: `buccet where`

## Add Approved UPL

Put approved law or raw yes-side source material in:

```text
~/.buccet/upl-docs/acceptance
```

What can go there:

- markdown law docs
- raw skill text
- `SKILL.md`
- `README.md`
- extracted package markdown

Compile it:

```bash
buccet upl sync --lane acceptance
```

If you forget, Buccet auto-syncs changed UPL docs before runtime surfaces like:

- `buccet console`
- `buccet run -- ...`
- `buccet hook run -- ...`
- `buccet path run ...`
- `buccet path watch ...`

Inspect it:

```bash
buccet upl search <query>
buccet upl diff --search <query>
buccet upl show <upl-id>
```

## Add Denied UPL

Put denied law or raw no-side source material in:

```text
~/.buccet/upl-docs/denial
```

What can go there:

- markdown law docs
- raw skill text
- `SKILL.md`
- `README.md`
- extracted package markdown

Compile it:

```bash
buccet upl sync --lane denial
```

The same runtime auto-sync rule applies here too.

Inspect it:

```bash
buccet upl search <query> --type denied
buccet upl diff --type denied --search <query>
buccet upl show <upl-id>
```

## Add External Yes-Side Skills

Catalogs:

- `buccet upl sources --open skillsmp`
- `buccet upl sources --open aitmpl`
- `buccet upl sources --open skillhub`
- `buccet upl sources --open agentskills`

Guide and template:

```text
~/.buccet/upl-docs/acceptance/PIPELINE.txt
~/.buccet/upl-docs/acceptance/SKILL_INTAKE_TEMPLATE.txt
```

Fast scaffold:

```bash
cp ~/.buccet/upl-docs/acceptance/SKILL_INTAKE_TEMPLATE.txt ~/.buccet/upl-docs/acceptance/my-skill.md
```

## Add Path Sources

Path sources are domain context, not permissions.

Add them with:

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

Important:

- source files can live anywhere on disk
- Buccet ingests their content into the path
- this does not widen UPL

Persisted path library:

```text
~/.buccet/path-memory/library.json
```

## Add Scope

Open lawful scope with:

```bash
buccet scope add <path>
```

List active scopes:

```bash
buccet scope list
```

## Run The Path

Run it:

```bash
buccet path run <path-name> [--request <text>] [--steps <n>|--all]
```

Watch it:

```bash
buccet path watch <path-name|formation-id> [--follow]
```

List formations:

```bash
buccet path formations list
```

Close it:

```bash
buccet path close <path-name|formation-id>
```

## Rule

- approved UPL goes in acceptance
- denied UPL goes in denial
- domain context goes into path sources
- permissions come from UPL
- paths organize lawful work
