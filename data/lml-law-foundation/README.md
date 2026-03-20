# LML Universe Full Active Reference

Purpose:
- local reference bundle for Cursor or any local tooling
- combines the active sun corpus with the verified full universe enumeration
- reference-only bundle, not a git repo, not a runtime

Core files:
- `law-web.json`
  - active sun corpus
  - source sun laws: 68,509
- `laws.json`
  - generated source law records backing the sun corpus
- `canonical-planet-manifest.json`
  - active canonical planet manifest
- `LML_BIBLE_ENUMERATED_VERIFIED_20260308_154500.jsonl`
  - verified active universe enumeration
  - total rows: 137,266
- `LML_BIBLE_FULL_VERIFIED_20260308_154500.jsonl`
  - verified active universe enumeration plus repair operators
  - total rows: 137,296
- `LML_BIBLE_VALIDATION_20260308_154500.md`
  - validation report for the verified Bible exports

How to read the counts:
- total universe active law count: 137,296
- active enumerated universe rows: 137,266
- active sun laws: 68,509
- active explicit runtime overlay/control laws: 68

Important:
- this folder is a local full reference bundle
- it is not the active runtime source of truth
- active development still happens in `/Users/ryangatoloai-faupula/lml_demo`
- the frozen archive repo remains the historical source-of-truth archive
