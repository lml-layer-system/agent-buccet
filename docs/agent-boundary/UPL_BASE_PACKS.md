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

`UPL Traffic` is the live motion enforcer for that field.

It does not create law.
It does not ask questions.
It only keeps motion inside the already-decided UPL geometry:

- accepted rail stays accepted
- denial wall stays denied
- drift exits the approved rail and gets surfaced as drift, not silent widening

To keep both sides structurally distinct without splitting the runtime, the compiled field now gives each segment:

- a traffic class:
  - `allow_rail`
  - `deny_wall`
- a deterministic polarity tag:
  - `UPL.TRAFFIC.RAIL:sha256:...`
  - `UPL.TRAFFIC.WALL:sha256:...`

If a segment's class/tag does not match its compiled polarity, Buccet refuses that segment and fails closed.

That means acceptance and denial stay mathematically distinct in the live field even though they run inside one runtime engine.

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

It now seeds a `690`-entry wall catalog into the UPL denial side out of the box.

If you want the full live inventory, including every denial ID and plain-language description, read [BASE_DENIAL_PACK.md](./BASE_DENIAL_PACK.md).

It blocks classes of sovereignty theft by default:

- persistence and autostart
- security weakening
- secret and credential access
- exfiltration
- authority spoofing and fake self-approval / completion claims
- boundary attacks like scope widening, law mutation, session revival, and ledger/proof bypass
- sensitive outbound data classes like PII, credentials, and financial payloads
- privilege escalation
- stealth and evasion
- propagation
- law and witness tampering
- ordinary file deletion
- destructive mass mutation
- sensitive capture
- system mutation
- unapproved external communication

These entries are authored in the UPL and compiled into wall segments in the live field.

The detectors stay in code.
The standing consequence classes now also live in the base denial pack as UPL wall tracks.

The day-one base denial hardening now also carries defensive material distilled from:

- the 343-class AI failure taxonomy across epistemic, agentic, adversarial, alignment, architectural, domain, and governance dimensions
- the defensive law corpus around proof, lockstep containment, shapeshift resistance, and trickster resistance

Those are not stored as a second engine.
They are carried as ordinary denial-side UPL wall tracks inside the same live field.

Intentionally excluded from the shipped base denial pack:

- autonomous-operation doctrine
- offensive-tooling or defensive-to-offensive flip doctrine
- self-updating or self-continuation law
- novelty-completeness expansion beyond the already-carried novelty guard

That means Buccet can:

- detect `claimsUserApproval`, `claimsActionCompletionWithoutWitness`, `authorityClaimed`, and `claimsCompleteCoverage`
- detect `payloadContainsPii`, `payloadContainsCredential`, and `payloadContainsFinancialData`
- activate explicit Time constraints from action-side instruction text such as `do not delete package-lock.json` or `do not delete anything`
- then resolve those classes through the same live UPL field the rest of Terminal 2 uses

For example, if an action request carries `reviewContext.userInput` with an explicit delete prohibition, Buccet does not guess. The request builder activates `violatesUserConstraint`, points the request at `TIME.CONSTRAINT.DELETE.01`, and the same base denial pack denies the delete through the live UPL wall field.

### Base acceptance pack

The base acceptance pack is seeded when the user opens lawful scope with `scope add` or `openBoundaryPath(...)`.

It is session-scoped by default.

The built-in classes are:

- `workspace_read`
- `workspace_mutation`
- `local_organization`
- `internal_artifacts`
- `notes_and_tasks`
- `safe_local_exec`
- `bounded_web_research`

For the larger acceptance-side source intake pulled from OpenClaw capability surfaces, see [OpenClaw Acceptance Intake](./OPENCLAW_ACCEPTANCE_INTAKE.md).

In plain terms, opening a workspace seeds lawful roads for:

- reading inside the opened workspace
- writing and appending inside the opened workspace
- mkdir and move inside the opened workspace
- standard artifact roots like `outputs/`, `reports/`, and `artifacts/`
- local notes, tasks, memory, and `.buccet` roots inside the workspace
- bounded local developer commands like `git status`, `npm test`, `pytest`, `eslint`, `cargo test`, and similar quality/runtime inspection tools
- bounded research fetch/search motion against explicit documentation and source domains like MDN, Python docs, GitHub, and search/fetch providers

Delete is not part of the base acceptance pack.
Generic exec is not part of the base acceptance pack.
Generic network egress is not part of the base acceptance pack.
Generic hardening classes do not belong in the acceptance pack; they belong in the denial pack.

The acceptance pack stays narrow on purpose:

- it opens specific rails
- it does not create a broad shell rail
- it does not create a broad outbound network rail
- denial still overrides every acceptance rail on overlap

That means the OpenClaw intake is now beginning to materialize as real UPL acceptance law, but only in bounded forms that can live safely in the same runtime field as the denial constitution.

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
buccet upl sources
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

For one-off imports:

```bash
buccet upl import policies/my-team-law.md
```

For the built-in authored-lane workflow:

```text
~/.buccet/upl-docs/acceptance
~/.buccet/upl-docs/denial
```

Put acceptance markdown in the acceptance lane.
Put denial markdown in the denial lane.

Then compile both into UPL:

```bash
buccet upl sync
```

Buccet refuses lane mismatch.
If a denial document is placed in the acceptance lane, sync fails instead of coercing it.

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

### Split authoring, one runtime

The human sees:

- acceptance docs
- denial docs

Buccet runs:

- one live UPL field

So the user edits separate lanes, but runtime enforces one geometry:

- acceptance creates road
- denial creates wall
- overlap resolves to wall

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
