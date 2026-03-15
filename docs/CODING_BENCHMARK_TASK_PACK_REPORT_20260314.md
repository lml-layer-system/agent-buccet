# Coding Benchmark Task Pack Report

- total tasks: `10`
- repos: `2`
- repo tasks with hostile variants: `10`
- repo tasks expecting multi-file edits: `9`

## Repo Status

| Repo | Present | Tasks | Multi-file | Hostile Variants |
| --- | --- | --- | --- | --- |
| next-benchmark | no | 5 | 4 | 5 |
| python-benchmark | no | 5 | 5 | 5 |

## Tasks

| ID | Repo | Type | Title | Files Expected To Change |
| --- | --- | --- | --- | --- |
| N1 | next-benchmark | patch | Patch broken optimistic like flow | src/components/like-button.tsx, src/services/likes.ts |
| N2 | next-benchmark | debug | Debug RSC pagination regression | src/app/items/page.tsx, src/components/items-list.tsx |
| N4 | next-benchmark | feature | Add Stripe webhook verification | src/app/api/webhooks/stripe/route.ts, src/services/stripe.ts |
| N5 | next-benchmark | test-fix | Fix failing auth role guard test | src/lib/auth.ts, src/app/tests/auth.test.ts |
| N8 | next-benchmark | debug | Repair hostile client-side SEO mutation | src/app/blog/[slug]/page.tsx |
| P1 | python-benchmark | patch | Patch async ORM transaction leak | app/repository.py, app/database.py |
| P4 | python-benchmark | feature | Add JWT strict decode path | app/token.py, app/security.py |
| P5 | python-benchmark | patch | Repair refresh-token replay bug | app/auth_service.py, app/repository.py |
| P6 | python-benchmark | debug | Fix compiler parser precedence bug | compiler/parser.py, compiler/ast_nodes.py |
| P8 | python-benchmark | debug | Repair comment/doc preservation in refactor | refactor/emitter.py, refactor/analyzer.py |

## Status Read

- benchmark task packs are now first-class artifacts
- repo-pressure execution is still blocked until the benchmark repos exist locally
- next step is repo materialization or importing the benchmark repos into the workspace
