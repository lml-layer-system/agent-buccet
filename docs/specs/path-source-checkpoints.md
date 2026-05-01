# Buccet Path Source Checkpoints

## Purpose

This document defines the storage fix for very large path sources.

It does not add a new user-facing system.

It keeps:

- the same path-source interface
- the same UPL governance
- the same track extractor
- the same agent / Pi runtime surfaces

It changes only the backing storage body under path sources so large intake does not bloat prompt context or raw storage.

## No Drift

This is not:

- a second source system
- a second memory system users must learn
- a second law body
- a second storage abstraction exposed as a product concept

Publicly, it is still:

- a path source

Internally, the path source is backed by:

- a checkpoint body
- a projection surface

The path source remains the interface.

## Core Rule

`Path source = interface`

`Checkpoint body = durable storage`

`Projection surface = opened working view`

The user adds a path source.
Buccet stores it in checkpoint form.
When an agent or runtime surface touches it, Buccet opens the needed projection.

## The Storage Problem

Without a backing checkpoint layer, large path sources create two kinds of waste:

1. raw storage duplication
2. prompt/context bloat when agents try to reason over giant inputs directly

The old bad pattern is:

`raw giant input -> repeated search -> repeated loading -> repeated token burn`

The intended pattern is:

`raw giant input -> checkpoint body -> projection open on touch`

## Intake Rule

When a user ingests large text/code/law/document/data material:

1. it becomes a path source
2. track extractor can still operate on that path source
3. the backing storage is converted into a Buccet checkpoint body
4. agents work through projections opened from that checkpoint body

The path source identity must not change.

This preparation happens before a team run begins.

By the time a user sends a live request into a team, the large source field should already be checkpointed, indexed, and ready to open as a whole-view.

## Checkpoint Body

The checkpoint body is the cheapest stable computable storage form that still preserves the source faithfully.

It must be:

- deterministic
- reversible or evidence-preserving
- hashable
- addressable by shard / span / region
- stable under projection open

It must not be:

- a lossy summary
- a vague embedding-only store
- a second hidden corpus with different truth than the path source

## Projection Surface

The projection surface is what opens when the runtime touches a path source.

A projection may expose:

- whole-shape view
- file view
- module view
- law-family view
- dependency view
- interface view
- diff view
- span/range view
- shard view

The projection is not a copy of the whole raw source in prompt memory.
It is an opened working surface from the checkpoint body.

## Whole-View Rule

Large intake should behave like a world map on the wall:

- the whole is visible at once
- stable locations are already fixed
- the agent can look closer instantly
- no repeated rediscovery
- no full-ocean token scan every turn

So the path-source checkpoint layer must support:

- global whole-view
- local zoom
- direct addressability
- stable location and relation

The right experience is:

`not searching, just looking closer`

## Fracture Map

Very large path sources must support a fracture map.

The fracture map is how the whole source is broken into bounded working regions without losing whole-shape visibility.

A fracture map should carry:

- region id
- source id
- source kind
- stable address
- parent/child relations
- dependency edges
- interface edges
- law-relevant notes
- hash / freshness data
- reopen handles

The fracture map exists above raw storage and below specialist runtime.

## Agent Runtime Use

Agents do not hold the whole source in prompt memory.

Agents hold:

- their active task
- current intent
- constraints
- current region/shard
- relevant interfaces

The rest remains externalized in the checkpoint/projection surface.

When an agent needs more detail, it opens a closer projection.

## Track Extractor Compatibility

Track extractor remains unchanged in role.

It still answers:

- what lawful lanes apply to this path source?

The checkpoint/projection layer answers a different question:

- how do we hold and inspect the whole source efficiently?

So the split is:

- track extractor -> law
- checkpoint/projection -> storage + working memory

## Agent Memory Effect

This creates active external memory for agents.

The model window becomes:

- local working attention

The checkpoint/projection layer becomes:

- externalized durable working reality

That is how agents remain useful on very large material without burning context on every turn.

## Storage Shape

The checkpoint body may internally use any efficient computable form, as long as reversibility and addressability are preserved.

Likely ingredients:

- schema
- symbols
- deltas
- compressed blocks
- structural indexes
- dependency maps
- stable hashes

Those are implementation details.
They must remain under the path-source interface.

## On-Touch Projection

The storage rule is:

- do not keep everything expanded all the time
- do not push everything into prompt context
- expand only on touch

So:

- storage stays cheap
- whole-view stays immediate
- close-up raw inspection stays possible
- projection cost happens only where work is active

## Truth Requirement

Checkpoint bodies must preserve truth.

That means:

- exact spans can be reopened
- structure can be reopened
- dependencies can be reopened
- raw view can be reopened
- proofs/hashes remain stable

If the system cannot reopen the source faithfully enough for audit or exact reasoning, it is not a valid path-source checkpoint body.

## Media Boundary

This storage model is aimed first at non-media inputs:

- code
- text
- law
- docs
- structured data

Media is a separate ingestion class because it typically needs:

- OCR
- transcription
- segmentation
- frame extraction
- feature projection

before it can join the same checkpoint/projection model cleanly.

## Runtime Contract

For large non-media path sources, the intended flow is:

`Raw intake -> Path source identity -> Checkpoint body -> Whole-view projection -> Fracture map -> Specialist touch/zoom -> Pi reconcile`

Every action taken from that work still remains bounded by UPL.

## Tightest Statement

Buccet path-source checkpoints solve storage and context pressure by keeping path sources the same at the interface while changing their backing body into reversible checkpoint storage that opens projections on touch.
