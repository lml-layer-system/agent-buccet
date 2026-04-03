# Base Acceptance Pack Inventory

This document enumerates the live shipped base Buccet acceptance UPL pack.

It is one acceptance-side UPL system. Runtime still compiles it into the same live field as denial, and deny overrides acceptance on overlap.

## Summary

- Total acceptance-side UPL entries seeded per opened workspace session: 65
- Workspace rails: 5
- Safe local exec rails: 4
- Bounded web research rails: 3
- OpenClaw skill rails: 53

## Read This

Each row below shows the seeded acceptance ID and the plain-language description of what the rail opens.

- If you want to know what the base pack allows, this is the inventory.
- If you want to customize the pack, start here, then edit the ledger or replace the seeded pack.
- These are lawful rails, not broad capability grants.
- Generic shell access and generic outbound network access are still not part of the base acceptance pack.

Throughout this document, `<workspace-root>` means the workspace path the user explicitly opened into lawful scope.

## Workspace Rails (5)

These are the base rails that materialize when a workspace is opened.

- `ACCEPT.WORKSPACE.READ.001`: Read motion inside `<workspace-root>` is lawful.
  Target corridor: `<workspace-root>` prefix
  Action kinds: `fs.read`

- `ACCEPT.WORKSPACE.MUTATION.002`: Scoped code and document mutation inside `<workspace-root>` is lawful.
  Target corridor: `<workspace-root>` prefix
  Action kinds: `fs.write`, `fs.append`

- `ACCEPT.LOCAL.ORGANIZATION.003`: Non-destructive organization inside `<workspace-root>` is lawful.
  Target corridor: `<workspace-root>` prefix
  Action kinds: `fs.mkdir`, `fs.move`

- `ACCEPT.INTERNAL.ARTIFACTS.004`: Standard internal output roots under the workspace are lawful.
  Target corridors:
  `'<workspace-root>/outputs'`
  `'<workspace-root>/reports'`
  `'<workspace-root>/artifacts'`
  Action kinds: `fs.write`, `fs.append`

- `ACCEPT.NOTES.TASKS.007`: Local notes, tasks, memory, and Buccet workspace memory roots are lawful.
  Target corridors:
  `'<workspace-root>/.buccet'`
  `'<workspace-root>/notes'`
  `'<workspace-root>/tasks'`
  `'<workspace-root>/memory'`
  Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.mkdir`, `fs.move`

## Safe Local Exec Rails (4)

These rails allow bounded local developer/runtime commands. They do not open a broad shell rail.

- `ACCEPT.SAFE.LOCAL.EXEC.005A`: Bounded local repository inspection commands are lawful.
  Tool targets: `git`, `rg`
  Request text patterns:
  `git status`
  `git diff`
  `git grep`
  `git log`
  `git show`
  `git rev-parse`
  `git branch`
  `git ls-files`
  `rg`

- `ACCEPT.SAFE.LOCAL.EXEC.005B`: Bounded package-runner quality commands are lawful.
  Tool targets: `npm`, `pnpm`, `yarn`
  Request text patterns:
  `npm test`
  `npm lint`
  `npm run test`
  `npm run lint`
  `npm run typecheck`
  `npm run build`
  `pnpm ...`
  `yarn ...`

- `ACCEPT.SAFE.LOCAL.EXEC.005C`: Bounded test, lint, and typecheck tools are lawful.
  Tool targets: `pytest`, `ruff`, `mypy`, `eslint`, `prettier`, `tsc`
  Request text patterns:
  `pytest`
  `ruff check`
  `ruff format`
  `mypy`
  `eslint`
  `prettier`
  `tsc`

- `ACCEPT.SAFE.LOCAL.EXEC.005D`: Bounded native-toolchain quality commands are lawful.
  Tool targets: `cargo`, `go`, `make`
  Request text patterns:
  `cargo test`
  `cargo check`
  `cargo fmt`
  `cargo clippy`
  `go test`
  `go fmt`
  `go vet`
  `make test`
  `make lint`
  `make build`
  `make check`

## Bounded Web Research Rails (3)

These rails allow bounded research and retrieval against explicit documentation, source, and search/fetch domains. They do not open broad outbound network egress.

- `ACCEPT.BOUNDED.WEB.RESEARCH.006A`: Documentation and reference retrieval is lawful.
  Target domain corridors:
  `developer.mozilla.org`
  `docs.python.org`
  `docs.npmjs.com`
  `nodejs.org`
  `docs.rs`
  `pkg.go.dev`
  `www.typescriptlang.org`
  `developer.apple.com`
  Request text patterns:
  `fetch`
  `read`
  `browse`
  `lookup`
  `docs`
  `documentation`
  `reference`
  `manual`
  `guide`
  `api`

- `ACCEPT.BOUNDED.WEB.RESEARCH.006B`: Source and repository retrieval is lawful.
  Target domain corridors:
  `github.com`
  `api.github.com`
  `raw.githubusercontent.com`
  Request text patterns:
  `fetch`
  `read`
  `browse`
  `lookup`
  `docs`
  `documentation`
  `reference`
  `raw`
  `source`
  `repository`
  `repo`

- `ACCEPT.BOUNDED.WEB.RESEARCH.006C`: Search and retrieval provider use is lawful.
  Target domain corridors:
  `duckduckgo.com`
  `search.brave.com`
  `exa.ai`
  `firecrawl.dev`
  Request text patterns:
  `search`
  `query`
  `lookup`
  `research`
  `retrieve`
  `crawl`
  `browse`

## OpenClaw Skill Rails (53)

These rails are the explicit named acceptance entries sourced from the OpenClaw skills surface. They are not a second engine. They are acceptance-side UPL rails inside the same live field.

- `ACCEPT.OPENCLAW.SKILL.1001`: `1password` — named rail for credential-vault use through the 1Password skill surface.
- `ACCEPT.OPENCLAW.SKILL.1002`: `apple-notes` — named rail for local Apple Notes read and write motion.
- `ACCEPT.OPENCLAW.SKILL.1003`: `apple-reminders` — named rail for reminders query and update motion.
- `ACCEPT.OPENCLAW.SKILL.1004`: `bear-notes` — named rail for Bear notes read and write motion.
- `ACCEPT.OPENCLAW.SKILL.1005`: `blogwatcher` — named rail for blog/feed retrieval and note output.
- `ACCEPT.OPENCLAW.SKILL.1006`: `blucli` — named rail for bounded local CLI workflow motion.
- `ACCEPT.OPENCLAW.SKILL.1007`: `bluebubbles` — named rail for BlueBubbles message delivery motion.
- `ACCEPT.OPENCLAW.SKILL.1008`: `camsnap` — named rail for camera snapshot file motion.
- `ACCEPT.OPENCLAW.SKILL.1009`: `canvas` — named rail for canvas control and paired surface updates.
- `ACCEPT.OPENCLAW.SKILL.1010`: `clawhub` — named rail for ClawHub network and workflow motion.
- `ACCEPT.OPENCLAW.SKILL.1011`: `coding-agent` — named rail for local coding and file mutation work.
- `ACCEPT.OPENCLAW.SKILL.1012`: `discord` — named rail for Discord delivery motion.
- `ACCEPT.OPENCLAW.SKILL.1013`: `eightctl` — named rail for bounded controller CLI workflow motion.
- `ACCEPT.OPENCLAW.SKILL.1014`: `gemini` — named rail for Gemini-backed retrieval or exchange motion.
- `ACCEPT.OPENCLAW.SKILL.1015`: `gh-issues` — named rail for GitHub issue retrieval and update workflow motion.
- `ACCEPT.OPENCLAW.SKILL.1016`: `gifgrep` — named rail for local media search and inspection motion.
- `ACCEPT.OPENCLAW.SKILL.1017`: `github` — named rail for GitHub work item and repository workflow motion.
- `ACCEPT.OPENCLAW.SKILL.1018`: `gog` — named rail for bounded tool and service workflow motion.
- `ACCEPT.OPENCLAW.SKILL.1019`: `goplaces` — named rail for places lookup and result writing motion.
- `ACCEPT.OPENCLAW.SKILL.1020`: `healthcheck` — named rail for bounded health and diagnostics checks.
- `ACCEPT.OPENCLAW.SKILL.1021`: `himalaya` — named rail for mail-oriented communication workflow motion.
- `ACCEPT.OPENCLAW.SKILL.1022`: `imsg` — named rail for iMessage delivery motion.
- `ACCEPT.OPENCLAW.SKILL.1023`: `mcporter` — named rail for bounded local workflow and file motion.
- `ACCEPT.OPENCLAW.SKILL.1024`: `model-usage` — named rail for model-usage note and ledger motion.
- `ACCEPT.OPENCLAW.SKILL.1025`: `nano-pdf` — named rail for PDF retrieval and extraction output motion.
- `ACCEPT.OPENCLAW.SKILL.1026`: `node-connect` — named rail for node connection and paired target motion.
- `ACCEPT.OPENCLAW.SKILL.1027`: `notion` — named rail for Notion retrieval and update motion.
- `ACCEPT.OPENCLAW.SKILL.1028`: `obsidian` — named rail for Obsidian vault read and write motion.
- `ACCEPT.OPENCLAW.SKILL.1029`: `openai-whisper` — named rail for local transcription workflow motion.
- `ACCEPT.OPENCLAW.SKILL.1030`: `openai-whisper-api` — named rail for API-backed transcription workflow motion.
- `ACCEPT.OPENCLAW.SKILL.1031`: `openhue` — named rail for Hue device control motion.
- `ACCEPT.OPENCLAW.SKILL.1032`: `oracle` — named rail for bounded oracle-style query and output motion.
- `ACCEPT.OPENCLAW.SKILL.1033`: `ordercli` — named rail for bounded order/workflow CLI motion.
- `ACCEPT.OPENCLAW.SKILL.1034`: `peekaboo` — named rail for bounded local inspection workflow motion.
- `ACCEPT.OPENCLAW.SKILL.1035`: `sag` — named rail for bounded service and automation workflow motion.
- `ACCEPT.OPENCLAW.SKILL.1036`: `session-logs` — named rail for local session log read and write motion.
- `ACCEPT.OPENCLAW.SKILL.1037`: `sherpa-onnx-tts` — named rail for local text-to-speech workflow motion.
- `ACCEPT.OPENCLAW.SKILL.1038`: `skill-creator` — named rail for local skill authoring workflow motion.
- `ACCEPT.OPENCLAW.SKILL.1039`: `slack` — named rail for Slack delivery motion.
- `ACCEPT.OPENCLAW.SKILL.1040`: `songsee` — named rail for song/media understanding workflow motion.
- `ACCEPT.OPENCLAW.SKILL.1041`: `sonoscli` — named rail for Sonos device control motion.
- `ACCEPT.OPENCLAW.SKILL.1042`: `spotify-player` — named rail for Spotify playback control motion.
- `ACCEPT.OPENCLAW.SKILL.1043`: `summarize` — named rail for summarization read/write/output motion.
- `ACCEPT.OPENCLAW.SKILL.1044`: `taskflow` — named rail for taskflow task-system motion.
- `ACCEPT.OPENCLAW.SKILL.1045`: `taskflow-inbox-triage` — named rail for inbox triage task-system motion.
- `ACCEPT.OPENCLAW.SKILL.1046`: `things-mac` — named rail for Things task-system motion.
- `ACCEPT.OPENCLAW.SKILL.1047`: `tmux` — named rail for tmux session workflow motion.
- `ACCEPT.OPENCLAW.SKILL.1048`: `trello` — named rail for Trello board and task motion.
- `ACCEPT.OPENCLAW.SKILL.1049`: `video-frames` — named rail for video frame extraction workflow motion.
- `ACCEPT.OPENCLAW.SKILL.1050`: `voice-call` — named rail for voice-call delivery motion.
- `ACCEPT.OPENCLAW.SKILL.1051`: `wacli` — named rail for WhatsApp CLI delivery motion.
- `ACCEPT.OPENCLAW.SKILL.1052`: `weather` — named rail for weather retrieval and output motion.
- `ACCEPT.OPENCLAW.SKILL.1053`: `xurl` — named rail for bounded fetch and retrieval motion.

## Important Limits

The base acceptance pack is intentionally narrow.

- It does not create a broad shell rail.
- It does not create a broad outbound network rail.
- It does not open delete.
- It does not open secret roots.
- It does not override the denial constitution.

At runtime, these rails enter the same live UPL field as denial walls. If an acceptance rail overlaps a denial wall, deny wins.
