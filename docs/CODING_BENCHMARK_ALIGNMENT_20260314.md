# Coding Benchmark Alignment

- planet: `ability`
- ontology status: `aligned`
- benchmark layer: `lawed and ledgered`

## Laws

| Law | Present |
| --- | --- |
| ABILITY.CODING.147 | yes |
| ABILITY.CODING.148 | yes |
| ABILITY.CODING.149 | yes |
| ABILITY.CODING.150 | yes |
| ABILITY.CODING.151 | yes |
| ABILITY.CODING.152 | yes |
| ABILITY.CODING.153 | yes |
| ABILITY.CODING.154 | yes |
| ABILITY.CODING.155 | yes |
| ABILITY.CODING.156 | yes |

## Repo State

| Repo | Present | Command | Passing | Tasks | Passed Tasks |
| --- | --- | --- | --- | --- | --- |
| next-benchmark | yes | npm test | yes | 5 | 5 |
| python-benchmark | yes | zsh -lc . .venv/bin/activate && pytest | yes | 5 | 5 |

## Read

- benchmark task execution remains inside the coding slice of the ability planet
- no new planet was introduced by the benchmark layer
- benchmark state is now append-only recorded in `data/ledger/coding-benchmark-ledger.jsonl`