# Coding Real Repo Suite R1 Report

- suite: `R1`
- repo: `r1-nextjs-commerce`
- failing commands: `0`

| Command | OK | Failure Count |
| --- | --- | --- |
| `npm test` | yes | 0 |
| `npm run typecheck` | yes | 0 |

## Command Surface

- command: `npm test`
- ok: `true`
- failure_count: `0`
- summary: > r1-nextjs-commerce@0.1.0 test | > vitest run | RUN  v3.2.4 /Users/ryangatoloai-faupula/r1-nextjs-commerce | ✓ src/app/__tests__/admin-order-guard.test.tsx (1 test) 8ms | ✓ src/app/__tests__/cart-badge-cache.test.tsx (1 test) 11ms | ✓ src/app/__tests__/coupon-summary-revalidate.test.tsx (1 test) 9ms | ✓ src/app/__tests__/stripe-webhook-idempotency.test.ts (1 test) 12ms | ✓ src/app/__tests__/checkout-metadata.test.tsx (1 test) 9ms | Test Files  5 passed (5) | Tests  5 passed (5) | Start at  20:22:10 | Duration  5.24s (transform 191ms, setup 0ms, collect 508ms, tests 49ms, environment 7.12s, prepare 1.32s)

- command: `npm run typecheck`
- ok: `true`
- failure_count: `0`
- summary: > r1-nextjs-commerce@0.1.0 typecheck | > tsc --noEmit

