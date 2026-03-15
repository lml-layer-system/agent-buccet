# Coding Benchmark Tier 2 Report

- total tier-2 tasks: `16`
- repos: `2`
- failing commands: `0`

## Repo Runs

| Repo | Tier-2 Tasks | Command | OK | Failure Count |
| --- | --- | --- | --- | --- |
| next-benchmark | 8 | `npm test` | yes | 0 |
| next-benchmark | 8 | `npm run typecheck` | yes | 0 |
| python-benchmark | 8 | `. .venv/bin/activate && python -m pytest` | yes | 0 |

## Failure Surface

### next-benchmark

- command: `npm test`
- ok: `true`
- failure_count: `0`
- summary: > next-benchmark@0.1.0 test | > vitest run | RUN  v3.2.4 /Users/ryangatoloai-faupula/next-benchmark | ✓ src/app/__tests__/r4-search-ssr.test.tsx (1 test) 39ms | ✓ src/app/tasks/__tests__/items-page.test.tsx (1 test) 22ms | ✓ src/app/tasks/__tests__/optimistic.test.tsx (1 test) 235ms | ✓ src/app/__tests__/r2-metadata-drift.test.tsx (1 test) 14ms | ✓ src/app/tasks/__tests__/stripe-webhook.test.ts (1 test) 26ms | ✓ src/app/__tests__/t2-tenant-billing-isolation.test.tsx (1 test) 10ms | ✓ src/app/__tests__/t2-publish-revalidate.test.tsx (1 test) 9ms | ✓ src/app/__tests__/t2-server-action-audit.test.tsx (1 test) 10ms | ✓ src/app/__tests__/t2-optimistic-cache.test.tsx (1 test) 8ms

- command: `npm run typecheck`
- ok: `true`
- failure_count: `0`
- summary: > next-benchmark@0.1.0 typecheck | > tsc --noEmit

### python-benchmark

- command: `. .venv/bin/activate && python -m pytest`
- ok: `true`
- failure_count: `0`
- summary: ============================= test session starts ============================== | platform darwin -- Python 3.11.9, pytest-9.0.2, pluggy-1.6.0 | rootdir: /Users/ryangatoloai-faupula/python-benchmark | configfile: pytest.ini (WARNING: ignoring pytest config in pyproject.toml!) | testpaths: tests | plugins: anyio-4.12.1, asyncio-1.3.0 | asyncio: mode=Mode.AUTO, debug=False, asyncio_default_fixture_loop_scope=None, asyncio_default_test_loop_scope=function | collected 18 items | tests/test_auth.py ...                                                   [ 16%] | tests/test_auth_audit_revoke.py .                                        [ 22%] | tests/test_compiler.py .                                                 [ 27%] | tests/test_compiler_error_location.py .                                  [ 33%]

