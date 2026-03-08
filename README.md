# lml_demo

Next.js TypeScript single-page demo with a backend API route for LML law/spec retrieval.

## Universe Ontology

This repository now describes the system with a universe metaphor:

- `Sun` = the base/core law body in `data/generated/law-web.json`
- `Ability planet` = the planet that holds ability laws such as coding and web search
- `Meta planet` = the planet that holds meta laws and auto-created meta laws
- `Universe` = the full loaded system at boot

Active runtime note:
- the live manifest path is `data/generated/canonical-planet-manifest.json`
- the live manifest env var is `LML_CANONICAL_PLANET_MANIFEST`
- old names are archived and not active

## Archive Boundary

- `handoff/` is archived reference material only
- `handoff/` files are not active runtime inputs
- `handoff/` files are never to be executed, boot-loaded, or wired into build/startup paths
- archived reports, stamps, and bible exports exist for reference and audit only
- active runtime inputs live in `app/`, `lib/`, `scripts/`, and `data/generated/`

## Data source

Default source directory:

`/Users/ryangatoloai-faupula/Desktop/LML LEGAL FINAL CONVERT/lml`

Override with:

```bash
LML_SOURCE_DIR="/path/to/files" npm run ingest
```

## Run (Local, Recommended)

```bash
npm install
npm run ingest
npm run validate
npm run compile:web
npm run demo:check
npm run dev
```

Open `http://localhost:3000`.

## Run With Colima (Container)

```bash
npm run demo:up:colima
```

Stop with:

```bash
npm run demo:down:colima
```

## API

- `GET /api/laws?stats=1` -> ingestion summary
- `GET /api/laws?q=...&source=...&dimension=...&level=...&page=1&pageSize=75`
