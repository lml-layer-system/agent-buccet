# UPL Base Packs

Terminal 2 is the heart of Agent Buccet.

This is where human sovereignty becomes runtime law.

## The real model

Authored UPL law is split for humans:

- approved law
- denied law

Runtime is not split.

At runtime, Buccet compiles authored law into one live UPL field:

- open road segments from approved law
- wall segments from denied law
- no-road space outside both

So the real runtime truth is:

- deny wall covers the point → deny
- open road covers the point → allow
- neither covers the point → no road, return to Terminal 2 or fail closed

That is why `tracks` shows the live runtime field.

## What ships out of the box

Buccet ships two built-in law packs:

1. Base denial pack
2. Base acceptance pack

### Base denial pack

The base denial pack is day-one standing law.

It blocks classes of sovereignty theft by default:

- persistence and autostart
- security weakening
- secret and credential access
- exfiltration
- privilege escalation
- stealth and evasion
- propagation
- law and witness tampering
- destructive mass mutation
- sensitive capture
- system mutation
- unapproved external communication

These entries are authored in the UPL and compiled into wall segments in the live field.

### Base acceptance pack

The base acceptance pack is seeded when the user opens lawful scope with `scope add` or `openBoundaryPath(...)`.

It is session-scoped by default.

The built-in classes are:

- `workspace_read`
- `workspace_mutation`
- `local_organization`
- `internal_artifacts`

In plain terms, opening a workspace seeds lawful roads for:

- reading inside the opened workspace
- writing and appending inside the opened workspace
- mkdir and move inside the opened workspace
- standard artifact roots like `outputs/`, `reports/`, and `artifacts/`

Delete is not part of the base acceptance pack.
Exec is not part of the base acceptance pack.
Network is not part of the base acceptance pack.

Those stay explicit customization surfaces unless the user or company binds them as standing law.

## Why the packs are separate for authors but one at runtime

Humans need to inspect and customize:

- what is broadly allowed
- what is always walled off

Runtime needs one honest motion engine.

So Buccet keeps authored law separate, then compiles it into one live field.

This lets you do things like:

- allow `fs.write` inside `/workspace/project`
- deny `/workspace/project/secrets/**`

Same workspace.
Same runtime field.
Open road plus wall.

## How to inspect it

From Terminal 2:

```bash
buccet upl list
buccet console
```

Inside `buccet console`:

```text
upl
tracks
```

`upl` shows the authored law.
`tracks` shows the compiled live field.

## How to change the shipped packs

You are not stuck with the default Buccet law.

You can:

- remove entries
- mute or replace entries
- import your own markdown law
- bind company or safety-system policies directly into UPL
- ship your own default pack instead of Buccet's base pack

The canonical ledger path is:

```text
~/.buccet/data/agent-buccet-law-foundation/user-path-ledger.json
```

### Option 1: inspect and edit the UPL directly

Open the ledger file, inspect the active entries, and remove or replace what you do not want.

Buccet will still compile the authored result into the live field at runtime.

For the current live session, that is enough.

If you want different day-one defaults for every scope-open in your own distribution,
replace the built-in pack module or seed your own pack from your integration code.

### Option 2: import markdown law

Import explicit markdown law into UPL:

```bash
buccet upl import policies/my-team-law.md
```

That path is good for:

- personal working rules
- company safety doctrine
- project-specific rails
- output style law

### Option 3: bind external policy sources in code

Use `bindPolicySourcesIntoConfig(...)` when your policy already exists in another system.

Good fits:

- RLHF-shaped safety signals
- constitutional policy
- external guardrails
- regulator or business policy

## Concrete examples

### Personal law

Your personal workstation rule:

- deny screenshots and microphone capture
- allow writing only inside your project notes folder

Use markdown import or bind UPL directly.

### Company law

Your company rule:

- deny outbound communication to non-company recipients
- allow report generation under `/workspace/reports`
- deny access to `/workspace/secrets`

That becomes authored UPL law, then compiles into one live field with open report roads and secret walls.

### RLHF / guardrail law

Example:

```ts
await bindPolicySourcesIntoConfig({
  config,
  witness,
  bindings: [
    {
      sourceKind: "rlhf",
      type: "DENIED",
      requestBasis: {
        actionKind: "chat.emit",
        target: "chat://output",
        payloadSummary: "RLHF spoiler block",
        reviewContext: {
          surface: "chat",
          invariantLawId: "UPL.RLHF.SPOILERS",
        },
      },
      trackConstraint: {
        allowedActionKinds: ["chat.emit"],
        reviewSurface: "chat",
        reviewInvariantLawId: "UPL.RLHF.SPOILERS",
        forbiddenTextPatterns: ["spoilers"],
        outputCorridor: {
          forbiddenTextPatterns: ["spoilers"],
        },
        description: "RLHF spoiler block",
      },
    },
  ],
});
```

### Constitutional law

Example:

```ts
await bindPolicySourcesIntoConfig({
  config,
  witness,
  bindings: [
    {
      sourceKind: "constitutional",
      type: "APPROVED",
      requestBasis: {
        actionKind: "chat.emit",
        target: "chat://output",
        payloadSummary: "Constitutional direct style corridor",
        reviewContext: {
          surface: "chat",
          invariantLawId: "UPL.CONSTITUTION.DIRECT",
        },
      },
      trackConstraint: {
        allowedActionKinds: ["chat.emit"],
        reviewSurface: "chat",
        reviewInvariantLawId: "UPL.CONSTITUTION.DIRECT",
        expressionCorridor: {
          register: "direct",
          disallowMetaphor: true,
          disallowHype: true,
          disallowSubjectivity: true,
        },
        completionCorridor: {
          grammar: "single_sentence",
          maxLines: 1,
        },
        description: "direct constitutional output corridor",
      },
    },
  ],
});
```

### Business or regulator law

Example:

```ts
await bindPolicySourcesIntoConfig({
  config,
  witness,
  bindings: [
    {
      sourceKind: "regulator_business",
      type: "APPROVED",
      requestBasis: {
        actionKind: "fs.write",
        target: "/workspace/reports/allowed.txt",
        payloadSummary: "Business report rail",
      },
      trackConstraint: {
        allowedActionKinds: ["fs.write"],
        targetPattern: "/workspace/reports",
        targetMatchMode: "prefix",
        description: "business report rail",
      },
    },
    {
      sourceKind: "regulator_business",
      type: "DENIED",
      requestBasis: {
        actionKind: "fs.read",
        target: "/workspace/secrets/blocked.txt",
        payloadSummary: "Business secret wall",
      },
      trackConstraint: {
        allowedActionKinds: ["fs.read"],
        targetPattern: "/workspace/secrets",
        targetMatchMode: "prefix",
        description: "business secret wall",
      },
    },
  ],
});
```

## The important doctrine line

The agent is still only proposing.

The runtime field is what authorizes.

That field is built from:

- Buccet base law
- user law
- company law
- imported document law
- RLHF or constitutional bindings
- regulator or business policy

Terminal 2 is where those become law.
