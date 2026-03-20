# Agent Buccet Base Law Foundation

Purpose:
- local law foundation bundle for Agent Buccet
- combines the active base law corpus with the verified enumerated law set
- packaged with Agent Buccet so the runtime can load the carried foundation

Core files:
- `law-web.json`
  - active base law corpus
  - source base laws: 68,509
- `laws.json`
  - generated source law records backing the base law corpus
- `canonical-planet-manifest.json`
  - active canonical planet manifest
- `LML_BIBLE_ENUMERATED_VERIFIED_20260308_154500.jsonl`
  - verified active enumerated law set
  - total rows: 137,266
- `LML_BIBLE_FULL_VERIFIED_20260308_154500.jsonl`
  - verified active enumerated law set plus repair operators
  - total rows: 137,296
- `LML_BIBLE_VALIDATION_20260308_154500.md`
  - validation report for the verified Bible exports

How to read the counts:
- total active law count: 137,296
- active enumerated law rows: 137,266
- active base laws: 68,509
- active explicit runtime overlay/control laws: 68

Important:
- this folder is part of Agent Buccet's carried law foundation
- `laws.json` is used to load the active runtime law identity
- `law-web.json` remains the inspectable full corpus export
- active development still happens in `/Users/ryangatoloai-faupula/lml_demo`
- the historical archive remains provenance, not the public runtime identity
