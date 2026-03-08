# Universe Ontology

Status: `Active terminology reference`
Date: `2026-03-08`

## Core Metaphor

- `Sun`: the original core law body
- `Ability planet`: the planet that holds ability laws
- `Meta planet`: the planet that holds meta laws, including auto-created meta laws
- `Planet`: a named law world for a domain
- `Universe`: the total system when all required parts are loaded
- `Missing planet`: a required law world is absent or failed to load

## Practical Mapping In This Repo

- The compiled base corpus in `data/generated/law-web.json` is the `sun`
- Ability laws live in the `ability planet`
- Meta laws live in the `meta planet`
- User overlays add laws into the active universe
- The total loaded runtime state at boot is the `universe`

Examples:
- ability planet -> coding laws, web-search laws
- meta planet
- user overlay laws
- universe trace

## Non-Ranking Rule

- `Planet` does not mean lesser
- The metaphor describes structure and relation, not value ranking
- Required planets and the sun load together to form one governed universe

## Compatibility Terms That Stay For Now

The following active terms remain in code, artifacts, or file names:

- `UNIVERSE_RUNTIME_LAWS`
- `SUN.*`
- `META.*`
- `ABILITY.CODING.*`
- `base_law_count`
- `base_laws_applied`
- `system_laws_applied`
- `merged_ontology_state`
- `canonical-planet-manifest.json`
- `LML_CANONICAL_PLANET_MANIFEST`
- stamped handoff reports and generated bible/jsonl artifacts

Archived-only legacy names such as `canonical-lawpack.json`, `LML_CANONICAL_LAWPACK`, and `DEMO.FUNDAMENTAL.*` are not active runtime terminology.

## Archive Boundary

- `handoff/` is archived and reference-only
- archived handoff outputs are not part of the active universe
- archived handoff outputs must never be used as boot inputs, runtime dependencies, or executable sources
- current runtime truth comes from active source code and active generated artifacts, not archived handoff snapshots
