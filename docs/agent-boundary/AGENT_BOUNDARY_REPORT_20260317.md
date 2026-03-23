# Agent Buccet Report

## What This Is

Agent Buccet is a defensive containment runtime for AI agents.

It is Agent Buccet:

Building Ultimate Containment Constraints Every Time.

It is a persistent, CPU-friendly law and scope enforcement runtime for AI agents.

Its job is simple:
- agents can propose
- they cannot authorize

The runtime decides whether a real-world action is:
- `ALLOW`
- `DENY`
- `REQUIRE_APPROVAL`

## Why It Matters

Current agent systems fail in the same costly ways:
- deleting the wrong files
- writing outside the intended workspace
- acting in the wrong environment
- sending to the wrong recipient
- taking destructive actions from ambiguous remote instructions
- treating prompt content like authority

This repo exists to stop that structurally.

The point is not polite warning text.
The point is to make unauthorized actions fail closed by default at the action boundary.

## Core Public Doctrine

- no ambient authority
- deny by default
- capability is not authorization
- opened paths become lawful session scope
- session law persists until the user ends it
- grants can be revoked and expire
- untrusted prompt content is proposal, not authority
- every meaningful action must be ledgered

## What The Runtime Contains

Public pillars:
- law engine
- path/scope orchestrator
- defensive NSL
- append-only ledger
- bodyguard-integrated defensive gravity

Public enforcement surfaces:
- filesystem actions
- recipient sends
- domain/network sends
- tool execution
- remote command proposal hardening

Public control surfaces:
- policy loading
- approval adapters
- ledger audit helpers
- framework-agnostic action adapters

## What Makes It Important

This repo is not another agent framework.

It is the containment layer that can sit above existing stacks:
- NeMo Guardrails
- OpenAI Agents SDK
- LangGraph / LangChain
- custom agents
- remote Telegram / Slack / Discord control loops

That matters because people do not want to rebuild their whole stack.
They want to keep what they have and add real boundaries.

## The Security Claim

The important claim is not "safe AI" in the abstract.

The important claim is:

If a path was not issued, the action cannot happen.

If the session trace is incomplete, the action is non-authoritative.

If untrusted content asks to widen scope, mutate law, self-approve, bypass the ledger, or revive ended sessions, the runtime fails closed.

## Why The Ledger Is Central

The ledger is not secondary logging.

It is law.

The runtime now treats incomplete or missing audit traces as non-authoritative.
That means:
- no complete ledger trace
- no trust
- ask the user or recover the lawful path first

The ledger also supports:
- crash recovery
- session restore
- scope reconstruction
- audit completeness checks

## Why This Repo Should Exist Openly

This is the right public release because it proves something real while keeping the runtime focused on containment capability.

Public:
- containment
- law
- scope
- approval
- ledger
- defensive meta laws

Outside current runtime core:
- intelligence amplification
- meta loops
- law-of-law systems
- gravity/intelligence internals outside containment scope

That split is strategically correct.

## Current State

The repo now includes:
- persistent sessions
- crash-safe session restore
- path-opened-becomes-law
- generic grants
- revocation and expiry
- filesystem containment
- recipient/domain/tool containment
- defensive meta laws
- remote proposal hardening
- ledger audit completeness checks
- gravity core integrated on the bodyguard path
- out-of-scope -> null -> NSL open-as-law recovery
- hard deny for authority claims and incomplete ledger state

## Why Someone Should Care

Because the most common and expensive agent failures are not exotic.
They are operational:
- wrong path
- wrong target
- wrong recipient
- wrong authority assumptions

This runtime is designed to stop those failures before they become real-world damage.

That is why it matters.
