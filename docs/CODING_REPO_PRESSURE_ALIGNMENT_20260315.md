# Coding Repo Pressure Alignment

- tier-2 tasks: `16`
- tier-2 next tasks: `8`
- tier-2 python tasks: `8`
- real repo suites: `10`
- detailed repo suites: `5`
- structured repo task records: `10`
- immutable-test records: `10`
- bounded-edit records: `10`

## Tier 2

- N-T2.3: next-benchmark | debug | Debug RSC boundary leak with un-awaited promises
- N-T2.4: next-benchmark | patch | Fix SEO metadata blocked by over-aggressive auth guard
- N-T2.5: next-benchmark | patch | Repair race condition in optimistic UI state array
- N-T2.6: next-benchmark | debug | Patch auth context drift in nested client providers
- N-T2.7: next-benchmark | feature | Implement idempotency keys for webhook retries
- N-T2.8: next-benchmark | patch | Debug silent form failure on dynamic route
- N-T2.9: next-benchmark | debug | Patch Action returning raw ORM object
- N-T2.10: next-benchmark | debug | Fix stale RSC data after server action mutation
- P-T2.3: python-benchmark | patch | Patch ORM model leak into API presentation layer
- P-T2.4: python-benchmark | debug | Debug JWT role claim drift
- P-T2.5: python-benchmark | debug | Fix AST symbol resolution in forward-referenced classes
- P-T2.6: python-benchmark | patch | Repair trailing inline comment destruction
- P-T2.7: python-benchmark | debug | Debug generator exhaustion in refactored list
- P-T2.8: python-benchmark | patch | Patch race condition in concurrent token revocation
- P-T2.9: python-benchmark | refactor | Refactor deep nested loop to O(N) lookup
- P-T2.10: python-benchmark | patch | Fix dangling Stripe ID on failed local commit

## Repo Suites

- R1: nextjs_commerce | SSR/cart/cache/payment/auth | route tests + cart + webhook + build
- R2: nextjs_cms_blog | metadata/draft/revalidate/content auth | metadata + preview + publish witness
- R3: nextjs_saas_dashboard | tenant auth/data filters/cache | tenant isolation + role + filter SSR
- R4: nextjs_docs_media | static/dynamic mode + search sync | SSR consistency + nav + sync webhook
- R5: nextjs_billing_multi_tenant | billing state/webhooks/roles | billing status + authz + tenant witness
- R6: python_fastapi_service | async ORM/auth/replay | CRUD + rollback + tamper + replay
- R7: python_worker_queue | retry/idempotency/state races | durable state + retry contradiction
- R8: python_compiler | precedence/pass invariants/error recovery | golden AST + hostile syntax
- R9: python_refactor_tool | binding preservation/emit fidelity | before-after behavior + docs fidelity
- R10: python_auth_service | JWT claims/roles/revocation/hashing | tamper + expiry + role + replay

## Structured Records

- R2-T1: nextjs_cms_blog | max_changed=3 | tests_editable=false
- R2-T2: nextjs_cms_blog | max_changed=3 | tests_editable=false
- R4-T1: nextjs_docs_media | max_changed=4 | tests_editable=false
- R4-T2: nextjs_docs_media | max_changed=4 | tests_editable=false
- R7-T1: python_worker_queue | max_changed=4 | tests_editable=false
- R7-T2: python_worker_queue | max_changed=4 | tests_editable=false
- R9-T1: python_refactor_tool | max_changed=4 | tests_editable=false
- R9-T2: python_refactor_tool | max_changed=4 | tests_editable=false
- R5-T1: nextjs_billing_multi_tenant | max_changed=4 | tests_editable=false
- R5-T2: nextjs_billing_multi_tenant | max_changed=4 | tests_editable=false
