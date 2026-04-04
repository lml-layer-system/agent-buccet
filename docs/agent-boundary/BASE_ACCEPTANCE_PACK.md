# Base Acceptance Pack Inventory

This document enumerates the live shipped base Buccet acceptance UPL pack.

It is one acceptance-side UPL system. Runtime still compiles it into the same live field as denial, and deny overrides acceptance on overlap.

## Summary

- Total acceptance-side UPL entries seeded per opened workspace session: 157
- Workspace rails: 5
- Safe local exec rails: 4
- Bounded web research rails: 3
- OpenClaw skill rails: 108
  Bundled OpenClaw rails: 51
  Awesome OpenClaw rails: 57
- Curated capability entries: 23
- Curated workflow entries: 14

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

## OpenClaw Skill Rails (108)

These rails are the explicit acceptance entries sourced from the OpenClaw skills surface. They are not a second engine. They are acceptance-side UPL rails inside the same live field.

The base pack only seeds OpenClaw rails that are truthful under the shipped denial constitution:

- credential-vault use is not part of the base acceptance pack
- camera capture is not part of the base acceptance pack
- channel skills are opened in their delivery shape, not as raw unrestricted network rails
- obvious API-backed skills are opened on bounded target domains, not just by name alone

- `ACCEPT.OPENCLAW.SKILL.1002`: `apple-notes` — named rail for local Apple Notes read and write motion.
- `ACCEPT.OPENCLAW.SKILL.1003`: `apple-reminders` — named rail for reminders query and update motion.
- `ACCEPT.OPENCLAW.SKILL.1004`: `bear-notes` — named rail for Bear notes read and write motion.
- `ACCEPT.OPENCLAW.SKILL.1005`: `blogwatcher` — named rail for blog/feed retrieval and note output.
- `ACCEPT.OPENCLAW.SKILL.1006`: `blucli` — named rail for bounded local CLI workflow motion.
- `ACCEPT.OPENCLAW.SKILL.1007`: `bluebubbles` — named rail for BlueBubbles message delivery motion.
- `ACCEPT.OPENCLAW.SKILL.1009`: `canvas` — named rail for canvas control and paired surface updates.
- `ACCEPT.OPENCLAW.SKILL.1010`: `clawhub` — named rail for ClawHub network and workflow motion.
- `ACCEPT.OPENCLAW.SKILL.1011`: `coding-agent` — named rail for local coding and file mutation work.
- `ACCEPT.OPENCLAW.SKILL.1012`: `discord` — named rail for Discord delivery motion.
- `ACCEPT.OPENCLAW.SKILL.1013`: `eightctl` — named rail for bounded controller CLI workflow motion.
- `ACCEPT.OPENCLAW.SKILL.1014`: `gemini` — bounded rail for Gemini-backed retrieval or exchange motion.
- `ACCEPT.OPENCLAW.SKILL.1015`: `gh-issues` — bounded rail for GitHub issue retrieval and update workflow motion.
- `ACCEPT.OPENCLAW.SKILL.1016`: `gifgrep` — named rail for local media search and inspection motion.
- `ACCEPT.OPENCLAW.SKILL.1017`: `github` — bounded rail for GitHub work item and repository workflow motion.
- `ACCEPT.OPENCLAW.SKILL.1018`: `gog` — named rail for bounded tool and service workflow motion.
- `ACCEPT.OPENCLAW.SKILL.1019`: `goplaces` — bounded rail for places lookup and result writing motion.
- `ACCEPT.OPENCLAW.SKILL.1020`: `healthcheck` — named rail for bounded health and diagnostics checks.
- `ACCEPT.OPENCLAW.SKILL.1021`: `himalaya` — named rail for mail-oriented communication workflow motion.
- `ACCEPT.OPENCLAW.SKILL.1022`: `imsg` — named rail for iMessage delivery motion.
- `ACCEPT.OPENCLAW.SKILL.1023`: `mcporter` — named rail for bounded local workflow and file motion.
- `ACCEPT.OPENCLAW.SKILL.1024`: `model-usage` — named rail for model-usage note and ledger motion.
- `ACCEPT.OPENCLAW.SKILL.1025`: `nano-pdf` — named rail for PDF retrieval and extraction output motion.
- `ACCEPT.OPENCLAW.SKILL.1026`: `node-connect` — named rail for node connection and paired target motion.
- `ACCEPT.OPENCLAW.SKILL.1027`: `notion` — bounded rail for Notion retrieval and update motion.
- `ACCEPT.OPENCLAW.SKILL.1028`: `obsidian` — named rail for Obsidian vault read and write motion.
- `ACCEPT.OPENCLAW.SKILL.1029`: `openai-whisper` — named rail for local transcription workflow motion.
- `ACCEPT.OPENCLAW.SKILL.1030`: `openai-whisper-api` — bounded rail for API-backed transcription workflow motion.
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
- `ACCEPT.OPENCLAW.SKILL.1048`: `trello` — bounded rail for Trello board and task motion.
- `ACCEPT.OPENCLAW.SKILL.1049`: `video-frames` — named rail for video frame extraction workflow motion.
- `ACCEPT.OPENCLAW.SKILL.1050`: `voice-call` — named rail for voice-call delivery motion.
- `ACCEPT.OPENCLAW.SKILL.1051`: `wacli` — named rail for WhatsApp CLI delivery motion.
- `ACCEPT.OPENCLAW.SKILL.1052`: `weather` — bounded rail for weather retrieval and output motion.
- `ACCEPT.OPENCLAW.SKILL.1053`: `xurl` — bounded rail for fetch and retrieval motion.

### Awesome OpenClaw Skill Rails (57)

- `ACCEPT.OPENCLAW.SKILL.1054`: `agent-mail` — named rail for AI inbox read, draft, and delivery motion.
- `ACCEPT.OPENCLAW.SKILL.1055`: `agent-mail-cli` — named rail for CLI-backed agent inbox read, draft, and delivery motion.
- `ACCEPT.OPENCLAW.SKILL.1056`: `apple-mail-search-safe` — named rail for safe Apple Mail lookup and body search motion.
- `ACCEPT.OPENCLAW.SKILL.1057`: `beeper` — named rail for Beeper history search and browse motion.
- `ACCEPT.OPENCLAW.SKILL.1058`: `rocketchat` — named rail for Rocket.Chat channel delivery motion.
- `ACCEPT.OPENCLAW.SKILL.1059`: `sixel-email` — named rail for bounded one-to-one email delivery motion.
- `ACCEPT.OPENCLAW.SKILL.1060`: `apple-calendar` — named rail for Apple Calendar query and event update motion.
- `ACCEPT.OPENCLAW.SKILL.1061`: `google-calendar` — bounded rail for Google Calendar query and event update motion.
- `ACCEPT.OPENCLAW.SKILL.1062`: `gcal-pro` — bounded rail for Google Calendar CLI scheduling motion.
- `ACCEPT.OPENCLAW.SKILL.1063`: `ms-todo-oauth` — bounded rail for Microsoft To Do task query and update motion.
- `ACCEPT.OPENCLAW.SKILL.1064`: `task-sync` — named rail for task synchronization and mirrored task updates.
- `ACCEPT.OPENCLAW.SKILL.1065`: `asana` — bounded rail for Asana project and task workflow motion.
- `ACCEPT.OPENCLAW.SKILL.1066`: `atlassian-mcp` — bounded rail for Atlassian task, issue, and page workflow motion.
- `ACCEPT.OPENCLAW.SKILL.1067`: `notes-reminders` — named rail for quick notes and reminder update motion.
- `ACCEPT.OPENCLAW.SKILL.1068`: `apple-contacts` — named rail for Apple Contacts lookup motion.
- `ACCEPT.OPENCLAW.SKILL.1069`: `drafts` — named rail for Drafts note read and update motion.
- `ACCEPT.OPENCLAW.SKILL.1070`: `craft` — named rail for Craft note and document motion.
- `ACCEPT.OPENCLAW.SKILL.1071`: `craft-do` — bounded rail for Craft.do document and workspace motion.
- `ACCEPT.OPENCLAW.SKILL.1072`: `bookstack` — named rail for BookStack wiki and documentation workflow motion.
- `ACCEPT.OPENCLAW.SKILL.1073`: `better-notion` — bounded rail for richer Notion page and database motion.
- `ACCEPT.OPENCLAW.SKILL.1074`: `google-keep` — named rail for Google Keep note and list workflow motion.
- `ACCEPT.OPENCLAW.SKILL.1075`: `joplin-api` — named rail for Joplin note and notebook workflow motion.
- `ACCEPT.OPENCLAW.SKILL.1076`: `book-reader` — named rail for local book and document reading motion.
- `ACCEPT.OPENCLAW.SKILL.1077`: `archive-daily-note` — named rail for Obsidian daily note archive motion.
- `ACCEPT.OPENCLAW.SKILL.1078`: `office-document-editor` — named rail for tracked-change office document editing motion.
- `ACCEPT.OPENCLAW.SKILL.1079`: `academic-deep-research` — bounded rail for academic-source retrieval and research note output.
- `ACCEPT.OPENCLAW.SKILL.1080`: `agent-deep-research` — bounded rail for deep research retrieval and synthesis motion.
- `ACCEPT.OPENCLAW.SKILL.1081`: `agentic-paper-digest` — bounded rail for paper digest retrieval and summary motion.
- `ACCEPT.OPENCLAW.SKILL.1082`: `arxiv-search-collector` — bounded rail for arXiv retrieval and citation-set building motion.
- `ACCEPT.OPENCLAW.SKILL.1083`: `openclaw-free-web-search` — bounded rail for search and retrieval provider motion.
- `ACCEPT.OPENCLAW.SKILL.1084`: `feed-to-md` — named rail for RSS and Atom retrieval into Markdown output motion.
- `ACCEPT.OPENCLAW.SKILL.1085`: `ffcli` — named rail for Fireflies meeting retrieval and note output motion.
- `ACCEPT.OPENCLAW.SKILL.1086`: `deepwiki` — bounded rail for DeepWiki and GitHub documentation retrieval motion.
- `ACCEPT.OPENCLAW.SKILL.1087`: `gh-extract` — bounded rail for GitHub content extraction motion.
- `ACCEPT.OPENCLAW.SKILL.1088`: `intomd` — bounded rail for documentation-to-Markdown retrieval motion.
- `ACCEPT.OPENCLAW.SKILL.1089`: `markdown-converter` — named rail for document-to-Markdown conversion motion.
- `ACCEPT.OPENCLAW.SKILL.1090`: `truthcheck` — named rail for claim verification and fact-check workflow motion.
- `ACCEPT.OPENCLAW.SKILL.1091`: `image-ocr` — named rail for OCR extraction from local image inputs.
- `ACCEPT.OPENCLAW.SKILL.1092`: `links-to-pdfs` — bounded rail for document scraping and PDF retrieval motion.
- `ACCEPT.OPENCLAW.SKILL.1093`: `confluence` — bounded rail for Confluence page and space workflow motion.
- `ACCEPT.OPENCLAW.SKILL.1094`: `google-docs-skill` — bounded rail for Google Docs document workflow motion.
- `ACCEPT.OPENCLAW.SKILL.1095`: `sharepoint-by-altf1be` — bounded rail for SharePoint file and document intelligence motion.
- `ACCEPT.OPENCLAW.SKILL.1096`: `audio-transcribe` — named rail for local voice-message transcription motion.
- `ACCEPT.OPENCLAW.SKILL.1097`: `faster-whisper` — named rail for local faster-whisper transcription motion.
- `ACCEPT.OPENCLAW.SKILL.1098`: `kokoro-tts` — named rail for local Kokoro text-to-speech motion.
- `ACCEPT.OPENCLAW.SKILL.1099`: `local-vosk` — named rail for local Vosk speech-to-text motion.
- `ACCEPT.OPENCLAW.SKILL.1100`: `local-voice` — named rail for local TTS/STT voice pipeline motion.
- `ACCEPT.OPENCLAW.SKILL.1101`: `elevenlabs-tts` — bounded rail for ElevenLabs text-to-speech motion.
- `ACCEPT.OPENCLAW.SKILL.1102`: `mac-tts` — named rail for macOS built-in text-to-speech motion.
- `ACCEPT.OPENCLAW.SKILL.1103`: `say` — named rail for Siri-voice macOS speech output motion.
- `ACCEPT.OPENCLAW.SKILL.1104`: `apple-media` — named rail for Apple media-device control motion.
- `ACCEPT.OPENCLAW.SKILL.1105`: `agent-team-orchestration` — named rail for agent handoff, coordination, and workflow note motion.
- `ACCEPT.OPENCLAW.SKILL.1106`: `azure-devops` — bounded rail for Azure DevOps repository and work-item workflow motion.
- `ACCEPT.OPENCLAW.SKILL.1107`: `bitbucket-automation` — bounded rail for Bitbucket repository and pull-request workflow motion.
- `ACCEPT.OPENCLAW.SKILL.1108`: `filesystem` — named rail for advanced workspace file listing, search, and batch motion.
- `ACCEPT.OPENCLAW.SKILL.1109`: `docsync` — named rail for docs generation and drift-check workflow motion.
- `ACCEPT.OPENCLAW.SKILL.1110`: `read-optimizer` — named rail for bounded repository reading strategy motion.

## Curated Capability Entries (23)

These are the local "List V" capability extractions turned into acceptance-side UPL entries.

- `ACCEPT.CURATED.CAPABILITY.2001`: `docx` — named rail for Word document creation, editing, and tracked-change workflow motion.
- `ACCEPT.CURATED.CAPABILITY.2002`: `pptx` — named rail for slide deck creation, editing, and speaker-note workflow motion.
- `ACCEPT.CURATED.CAPABILITY.2003`: `xlsx` — named rail for spreadsheet analysis, formula, and chart workflow motion.
- `ACCEPT.CURATED.CAPABILITY.2004`: `doc-coauthoring` — named rail for collaborative drafting, revision, and coauthoring workflow motion.
- `ACCEPT.CURATED.CAPABILITY.2005`: `frontend-design` — named rail for frontend design-system and visual component workflow motion.
- `ACCEPT.CURATED.CAPABILITY.2006`: `canvas-design` — named rail for social graphic, poster, and canvas output workflow motion.
- `ACCEPT.CURATED.CAPABILITY.2007`: `theme-factory` — named rail for theme and color-system generation workflow motion.
- `ACCEPT.CURATED.CAPABILITY.2008`: `web-artifacts-builder` — named rail for calculators, dashboards, and interactive artifact workflow motion.
- `ACCEPT.CURATED.CAPABILITY.2009`: `superpowers` — named rail for structured coding, planning, and execution workflow motion.
- `ACCEPT.CURATED.CAPABILITY.2010`: `systematic-debugging` — named rail for root-cause debugging and fix-validation workflow motion.
- `ACCEPT.CURATED.CAPABILITY.2011`: `file-search` — named rail for bounded file search, symbol search, and content retrieval motion.
- `ACCEPT.CURATED.CAPABILITY.2012`: `context-optimization` — named rail for context shaping, summarization, and token-efficiency workflow motion.
- `ACCEPT.CURATED.CAPABILITY.2013`: `notebooklm-integration` — named rail for notebook-backed study, synthesis, and source-grounded note workflow motion.
- `ACCEPT.CURATED.CAPABILITY.2014`: `excel-mcp-server` — named rail for spreadsheet manipulation and report workflow motion.
- `ACCEPT.CURATED.CAPABILITY.2015`: `tavily` — named rail for structured web search, extract, and crawl workflow motion.
- `ACCEPT.CURATED.CAPABILITY.2016`: `context7` — named rail for live library-documentation retrieval workflow motion.
- `ACCEPT.CURATED.CAPABILITY.2017`: `task-master-ai` — named rail for project-task decomposition and dependency workflow motion.
- `ACCEPT.CURATED.CAPABILITY.2018`: `gpt-researcher` — named rail for autonomous research compilation and report workflow motion.
- `ACCEPT.CURATED.CAPABILITY.2019`: `codebase-memory-mcp` — named rail for persistent codebase memory and knowledge-graph workflow motion.
- `ACCEPT.CURATED.CAPABILITY.2020`: `mcp-playwright` — named rail for bounded browser automation and page-interaction workflow motion.
- `ACCEPT.CURATED.CAPABILITY.2021`: `markdownify-mcp` — named rail for PDF, image, and audio to Markdown conversion workflow motion.
- `ACCEPT.CURATED.CAPABILITY.2022`: `brand-guidelines` — named rail for brand-rule application and style-consistent output workflow motion.
- `ACCEPT.CURATED.CAPABILITY.2023`: `claude-seo` — named rail for SEO audit, schema, and site-content improvement workflow motion.

## Curated Workflow Entries (14)

These are the workflow-shaped companions to the curated capability entries. They make the yes-side read more like real work and less like tool names.

- `ACCEPT.CURATED.WORKFLOW.2101`: `docx-workflow` — bounded workspace Word-document workflow motion.
- `ACCEPT.CURATED.WORKFLOW.2102`: `pptx-workflow` — bounded workspace slide-deck workflow motion.
- `ACCEPT.CURATED.WORKFLOW.2103`: `xlsx-workflow` — bounded workspace spreadsheet and table workflow motion.
- `ACCEPT.CURATED.WORKFLOW.2104`: `doc-coauthoring-workflow` — bounded collaborative drafting and revision workflow motion.
- `ACCEPT.CURATED.WORKFLOW.2105`: `frontend-design-workflow` — bounded frontend design-system and UI artifact workflow motion.
- `ACCEPT.CURATED.WORKFLOW.2106`: `canvas-design-workflow` — bounded poster, social graphic, and visual export workflow motion.
- `ACCEPT.CURATED.WORKFLOW.2107`: `theme-factory-workflow` — bounded theme and color-system file workflow motion.
- `ACCEPT.CURATED.WORKFLOW.2108`: `web-artifacts-builder-workflow` — bounded calculators, dashboards, and interactive artifact file workflow motion.
- `ACCEPT.CURATED.WORKFLOW.2109`: `excel-mcp-workflow` — bounded spreadsheet workbook and report workflow motion.
- `ACCEPT.CURATED.WORKFLOW.2110`: `tavily-workflow` — bounded Tavily search, extract, and crawl provider motion.
- `ACCEPT.CURATED.WORKFLOW.2111`: `notebooklm-workflow` — bounded NotebookLM study and synthesis provider motion.
- `ACCEPT.CURATED.WORKFLOW.2112`: `markdownify-workflow` — bounded document, image, and audio conversion workflow motion.
- `ACCEPT.CURATED.WORKFLOW.2113`: `brand-and-seo-workflow` — bounded brand, copy, and site-content workflow motion.
- `ACCEPT.CURATED.WORKFLOW.2114`: `browser-artifact-workflow` — bounded browser screenshot, page export, and trace artifact workflow motion.

## Important Limits

The base acceptance pack is intentionally narrow.

- It does not create a broad shell rail.
- It does not create a broad outbound network rail.
- It does not open delete.
- It does not open secret roots.
- It does not override the denial constitution.

At runtime, these rails enter the same live UPL field as denial walls. If an acceptance rail overlaps a denial wall, deny wins.
