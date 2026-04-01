# Track Extractor

## Purpose

Track Extractor is a Buccet-native post-law compiler.

It does not decide law.
It does not create a second engine.
It does not compete with UPL.

It takes user/document law meaning and kills everything that is not operative
track meaning. What survives is snapped into a UPL Track.

Short form:

- UPL Law = what the user decided
- Track Extractor = what that law means in motion
- UPL Track = the snapped execution corridor

## Non-negotiable doctrine

- user is the law
- document is a law source
- Track Extractor does not reinterpret sovereignty
- Track Extractor only extracts the law's operative corridor
- Terminal 1 still catches any exit from the rail
- Terminal 2 still owns authority

This is not a new boundary.
This is not a new brain.
This is law in motion.

## Input

Track Extractor consumes already-lawful meaning from:

- direct user commands
- imported documents
- imported policies
- UPL entries and request basis

It is specifically looking for three things:

1. invariant
2. enforcement
3. corridor

## Negative extraction rule

Track Extractor is modeled after the fact extractor's negative method.

It does not try to recognize every possible valid track directly.
It kills everything that is not track meaning.

### Kill

- metaphor
- hype
- narrative flourish
- subjective framing
- perspective noise
- rhetorical emphasis
- decorative style that does not change the corridor
- commentary that does not alter enforcement

### Keep

- what must remain true
- what must never happen
- how that invariant is enforced
- what move family is allowed
- what move family is forbidden
- what output shape is required
- what expression corridor is required
- what completion corridor is required

## Output

Track Extractor emits track-ready structure only.

Current Buccet-native shape:

- `reviewInvariantLawId`
- `actionCorridor`
- `outputCorridor`
- `completionCorridor`
- `expressionCorridor`
- `allowedActionKinds`
- `targetPattern`
- `targetMatchMode`
- `requiredTextPatterns`
- `forbiddenTextPatterns`
- `outputShape`
- `completionGrammar`
- `expressionProfile`
- `description`

Structured corridors are the primary enforcement surface.
The flat fields remain for compatibility and display.

This is not a summary layer.
This is the minimal operational payload required to enforce the law in motion.

## Snap rule

UUIS snaps the extracted operative meaning into a concrete track.

Meaning:

1. user/document says the law
2. Track Extractor removes non-operative text
3. surviving invariant/enforcement/corridor is normalized
4. UUIS materializes the track
5. runtime enforces that track

If any operative part of a law block cannot be materialized into a real
enforceable corridor, the block is refused. Track Extractor does not partially
snap law.

## Chat / Tool scope

UPL Tracks apply to:

- chat/output boundary
- tool/action boundary

They do not apply to:

- ingress/front-line catch-freeze
- canyon containment itself
- physics ceilings

Ingress may later surface to Terminal 2 for operator law, but front-line reflex
is not Track Extractor territory.

## Expression corridors

Expression is law when the user makes it law.

Example:

- "talk like x"

That is not a preference.
That is an output corridor.

Track Extractor must convert that into enforceable rails, not a display-only
label. Known expression profiles are only shortcuts into the structured
`expressionCorridor`.

## Current implementation truth

Current runtime truth on this branch:

- explicit invariant/enforcement documents compile into tracks
- policy-like prose can compile into tracks when the prose contains low-entropy
  operational meaning
- expression law materializes into structured expression corridors and is
  enforced at runtime
- output/content law materializes into structured output corridors and is
  enforced at runtime
- completion law materializes into structured completion corridors and is
  enforced at runtime
- action law materializes into structured action corridors and is enforced at
  runtime
- legacy flat fields still exist for compatibility, but structured corridors are
  now the primary track surface

## What parses now

This is the current parseability contract. These are the things the branch is
expected to compile today when the wording carries low-entropy operational
meaning.

### Supported law shapes

- explicit invariant / enforcement blocks
- direct allow / deny law
- document-imported markdown law via `buccet upl import`
- policy-binding payloads that already carry structured request basis and, if
  needed, a track constraint

### Supported corridor families

- action corridors
- output corridors
- completion corridors
- expression corridors

### Supported parseable signals

- required text patterns
- forbidden text patterns
- output shape such as bullets
- completion grammar such as single sentence
- expression register/style constraints such as direct, objective, impersonal,
  brief, no metaphor, no hype
- action kind constraints such as `fs.write`
- target rails such as a concrete allowed path or parent directory corridor

### Supported examples

- `Return only 1999 material.` → required text pattern / output corridor
- `Never mention 2000s.` → forbidden text pattern / output corridor
- `The response must be in bullets.` → output shape
- `Invariant: Completion must stay single sentence.` plus
  `Completion grammar: single sentence` → completion corridor
- `Speak in a direct, objective, impersonal, no metaphor, no hype, brief style.`
  → expression corridor
- `Only permit fs.write inside "/workspace/rail/allowed.txt". Never write outside ...`
  → action corridor with `fs.write` target rail
- `Decision: deny` with explicit forbidden content such as spoilers
  → denied standing law with corridor

## What does not parse now

These inputs are not part of the guaranteed parse surface on this branch.

- vague aspiration without operative boundary meaning
- high-entropy poetry, metaphor, hype, or narrative style used as if it were a
  precise corridor
- arbitrary prose that does not state invariant, enforcement, or corridor
- content that would require Buccet to infer a hidden target, hidden action
  class, or hidden grammar
- partially specified law blocks where one operative piece is missing
- decorative phrases used as fake requirements when they do not map to an
  enforceable corridor

### Refused or intentionally killed examples

- `Expression: cosmic legendary phoenix storyteller voice`
- `Require: legendary unforgettable phoenix ascension`
- `Action: write` plus a non-real target like `legendary cosmic somewhere wonderful`
- mixed blocks that contain one enforceable corridor plus one non-materializable
  demand

The rule is simple:
- if it snaps to a real corridor, it can become law-in-motion
- if it cannot snap cleanly, it is refused
- Track Extractor does not partially snap a law block

Not yet complete:

- the remaining work is not a second parser or a second law system
- the remaining work is richer corridor materialization from lawful meaning
- completion grammar is still narrower than the full long-term vision

## Success condition

Track Extractor is doing its job when:

- user meaning becomes operative corridor
- non-operative language dies before it becomes law-in-motion
- tracks are snapped from first principles
- output/action cannot widen after law is set
- Terminal 1 catches any exit from the snapped rail
