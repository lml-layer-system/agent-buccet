# Coding Real Repo Suites Report

- suites: `12`
- failing commands: `0`
- blocked commands: `0`

| Suite | Repo | Command | Status | Failure Count |
| --- | --- | --- | --- | --- |
| R1 | r1-nextjs-commerce | `npm test` | passed | 0 |
| R1 | r1-nextjs-commerce | `npm run typecheck` | passed | 0 |
| R2 | r2-cms-blog | `npm test` | passed | 0 |
| R2 | r2-cms-blog | `npm run typecheck` | passed | 0 |
| R6 | r6-fastapi-service | `. .venv/bin/activate && python -m mypy app --strict && python -m pytest tests/test_repository.py` | passed | 0 |
| R3 | r3-saas-dashboard | `npm test` | passed | 0 |
| R3 | r3-saas-dashboard | `npm run typecheck` | passed | 0 |
| R9 | r9-refactor-tool | `. .venv/bin/activate && python -m mypy refactor --strict && python -m pytest tests/test_binding.py` | passed | 0 |
| T3N | t3-next-cache-bleed | `npm test` | passed | 0 |
| T3N | t3-next-cache-bleed | `npm run typecheck` | passed | 0 |
| T3P | t3-python-doublespend | `. .venv/bin/activate && python -m mypy app --strict && python -m pytest tests/test_wallet_race.py -v` | passed | 0 |
| R7 | r7-python-worker | `. .venv/bin/activate && python -m mypy worker --strict && python -m pytest tests/test_idempotency_leaf.py` | passed | 0 |
| R4 | r4-docs-media | `npm test` | passed | 0 |
| R4 | r4-docs-media | `npm run typecheck` | passed | 0 |
| R5 | r5-billing-webhooks | `npm test` | passed | 0 |
| R5 | r5-billing-webhooks | `npm run typecheck` | passed | 0 |
| R11 | r11-go-worker | `go build ./...` | passed | 0 |
| R11 | r11-go-worker | `go test -v ./... -run TestGoroutineLeakWitness` | passed | 0 |
| R12 | r12-rust-mutex | `cargo check` | passed | 0 |
| R12 | r12-rust-mutex | `cargo test --test witness` | passed | 0 |

## Command Surface

### R1 - r1-nextjs-commerce

- command: `npm test`
- status: `passed`
- ok: `true`
- failure_count: `0`
- summary: > r1-nextjs-commerce@0.1.0 test | > vitest run | RUN  v3.2.4 /Users/ryangatoloai-faupula/r1-nextjs-commerce | ✓ src/app/__tests__/admin-order-guard.test.tsx (1 test) 6ms | ✓ src/app/__tests__/cart-badge-cache.test.tsx (1 test) 8ms | ✓ src/app/__tests__/stripe-webhook-idempotency.test.ts (1 test) 6ms | ✓ src/app/__tests__/coupon-summary-revalidate.test.tsx (1 test) 6ms | ✓ src/app/__tests__/checkout-metadata.test.tsx (1 test) 4ms | Test Files  5 passed (5) | Tests  5 passed (5) | Start at  22:16:56 | Duration  3.26s (transform 299ms, setup 0ms, collect 513ms, tests 31ms, environment 4.08s, prepare 865ms)

- command: `npm run typecheck`
- status: `passed`
- ok: `true`
- failure_count: `0`
- summary: > r1-nextjs-commerce@0.1.0 typecheck | > tsc --noEmit

### R2 - r2-cms-blog

- command: `npm test`
- status: `passed`
- ok: `true`
- failure_count: `0`
- summary: > r2-cms-blog@0.1.0 test | > vitest run | RUN  v3.2.4 /Users/ryangatoloai-faupula/r2-cms-blog | ✓ src/app/blog/[slug]/__tests__/preview-metadata-leaf.test.tsx (1 test) 8ms | Test Files  1 passed (1) | Tests  1 passed (1) | Start at  22:17:04 | Duration  1.44s (transform 102ms, setup 0ms, collect 108ms, tests 8ms, environment 605ms, prepare 123ms)

- command: `npm run typecheck`
- status: `passed`
- ok: `true`
- failure_count: `0`
- summary: > r2-cms-blog@0.1.0 typecheck | > tsc --noEmit

### R6 - r6-fastapi-service

- command: `. .venv/bin/activate && python -m mypy app --strict && python -m pytest tests/test_repository.py`
- status: `passed`
- ok: `true`
- failure_count: `0`
- summary: Success: no issues found in 3 source files | ============================= test session starts ============================== | platform darwin -- Python 3.11.9, pytest-9.0.2, pluggy-1.6.0 | rootdir: /Users/ryangatoloai-faupula/r6-fastapi-service | configfile: pytest.ini | plugins: anyio-4.12.1, asyncio-1.3.0 | asyncio: mode=Mode.AUTO, debug=False, asyncio_default_fixture_loop_scope=None, asyncio_default_test_loop_scope=function | collected 1 item | tests/test_repository.py .                                               [100%] | ============================== 1 passed in 0.73s ===============================

### R3 - r3-saas-dashboard

- command: `npm test`
- status: `passed`
- ok: `true`
- failure_count: `0`
- summary: > r3-saas-dashboard@0.1.0 test | > vitest run | RUN  v3.2.4 /Users/ryangatoloai-faupula/r3-saas-dashboard | ✓ src/app/dashboard/__tests__/tenant-isolation-leaf.test.tsx (1 test) 7ms | Test Files  1 passed (1) | Tests  1 passed (1) | Start at  22:17:11 | Duration  1.48s (transform 89ms, setup 0ms, collect 79ms, tests 7ms, environment 612ms, prepare 148ms)

- command: `npm run typecheck`
- status: `passed`
- ok: `true`
- failure_count: `0`
- summary: > r3-saas-dashboard@0.1.0 typecheck | > tsc --noEmit

### R9 - r9-refactor-tool

- command: `. .venv/bin/activate && python -m mypy refactor --strict && python -m pytest tests/test_binding.py`
- status: `passed`
- ok: `true`
- failure_count: `0`
- summary: Success: no issues found in 2 source files | ============================= test session starts ============================== | platform darwin -- Python 3.11.9, pytest-9.0.2, pluggy-1.6.0 | rootdir: /Users/ryangatoloai-faupula/r9-refactor-tool | plugins: anyio-4.12.1, asyncio-1.3.0 | asyncio: mode=Mode.STRICT, debug=False, asyncio_default_fixture_loop_scope=None, asyncio_default_test_loop_scope=function | collected 1 item | tests/test_binding.py .                                                  [100%] | ============================== 1 passed in 0.01s ===============================

### T3N - t3-next-cache-bleed

- command: `npm test`
- status: `passed`
- ok: `true`
- failure_count: `0`
- summary: > t3-next-cache-bleed@0.1.0 test | > vitest run | RUN  v3.2.4 /Users/ryangatoloai-faupula/t3-next-cache-bleed | ✓ src/app/settings/__tests__/tier3-cache-bleed.test.tsx (1 test) 7ms | Test Files  1 passed (1) | Tests  1 passed (1) | Start at  22:17:18 | Duration  1.48s (transform 117ms, setup 0ms, collect 135ms, tests 7ms, environment 591ms, prepare 145ms)

- command: `npm run typecheck`
- status: `passed`
- ok: `true`
- failure_count: `0`
- summary: > t3-next-cache-bleed@0.1.0 typecheck | > tsc --noEmit

### T3P - t3-python-doublespend

- command: `. .venv/bin/activate && python -m mypy app --strict && python -m pytest tests/test_wallet_race.py -v`
- status: `passed`
- ok: `true`
- failure_count: `0`
- summary: Success: no issues found in 3 source files | ============================= test session starts ============================== | platform darwin -- Python 3.11.9, pytest-9.0.2, pluggy-1.6.0 -- /Users/ryangatoloai-faupula/python-benchmark/.venv/bin/python | cachedir: .pytest_cache | rootdir: /Users/ryangatoloai-faupula/t3-python-doublespend | configfile: pytest.ini | plugins: anyio-4.12.1, asyncio-1.3.0 | asyncio: mode=Mode.AUTO, debug=False, asyncio_default_fixture_loop_scope=None, asyncio_default_test_loop_scope=function | collecting ... collected 1 item | tests/test_wallet_race.py::test_t3_double_spend_race_condition PASSED    [100%] | ============================== 1 passed in 0.49s ===============================

### R7 - r7-python-worker

- command: `. .venv/bin/activate && python -m mypy worker --strict && python -m pytest tests/test_idempotency_leaf.py`
- status: `passed`
- ok: `true`
- failure_count: `0`
- summary: Success: no issues found in 3 source files | ============================= test session starts ============================== | platform darwin -- Python 3.11.9, pytest-9.0.2, pluggy-1.6.0 | rootdir: /Users/ryangatoloai-faupula/r7-python-worker | plugins: anyio-4.12.1, asyncio-1.3.0 | asyncio: mode=Mode.STRICT, debug=False, asyncio_default_fixture_loop_scope=None, asyncio_default_test_loop_scope=function | collected 1 item | tests/test_idempotency_leaf.py .                                         [100%] | ============================== 1 passed in 0.01s ===============================

### R4 - r4-docs-media

- command: `npm test`
- status: `passed`
- ok: `true`
- failure_count: `0`
- summary: > r4-docs-media@0.1.0 test | > vitest run | RUN  v3.2.4 /Users/ryangatoloai-faupula/r4-docs-media | ✓ src/app/docs/[...slug]/__tests__/route-mode-leaf.test.tsx (1 test) 5ms | Test Files  1 passed (1) | Tests  1 passed (1) | Start at  22:17:27 | Duration  1.50s (transform 78ms, setup 0ms, collect 61ms, tests 5ms, environment 654ms, prepare 136ms)

- command: `npm run typecheck`
- status: `passed`
- ok: `true`
- failure_count: `0`
- summary: > r4-docs-media@0.1.0 typecheck | > tsc --noEmit

### R5 - r5-billing-webhooks

- command: `npm test`
- status: `passed`
- ok: `true`
- failure_count: `0`
- summary: > r5-billing-webhooks@0.1.0 test | > vitest run | RUN  v3.2.4 /Users/ryangatoloai-faupula/r5-billing-webhooks | ✓ src/app/api/webhooks/billing/__tests__/webhook-tenant-leaf.test.ts (1 test) 12ms | Test Files  1 passed (1) | Tests  1 passed (1) | Start at  22:17:32 | Duration  882ms (transform 88ms, setup 0ms, collect 86ms, tests 12ms, environment 0ms, prepare 138ms)

- command: `npm run typecheck`
- status: `passed`
- ok: `true`
- failure_count: `0`
- summary: > r5-billing-webhooks@0.1.0 typecheck | > tsc --noEmit

### R11 - r11-go-worker

- command: `go build ./...`
- status: `passed`
- ok: `true`
- failure_count: `0`
- summary: no output

- command: `go test -v ./... -run TestGoroutineLeakWitness`
- status: `passed`
- ok: `true`
- failure_count: `0`
- summary: === RUN   TestGoroutineLeakWitness | --- PASS: TestGoroutineLeakWitness (0.11s) | PASS | ok  	r11-go-worker/worker	(cached)

### R12 - r12-rust-mutex

- command: `cargo check`
- status: `passed`
- ok: `true`
- failure_count: `0`
- summary: no output

- command: `cargo test --test witness`
- status: `passed`
- ok: `true`
- failure_count: `0`
- summary: running 1 test | test test_r12_deadlock_witness ... ok | test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.02s

