# Acceptance List V Extraction

Curated extraction from the provided "List V" capability scan.

This documents why these capability surfaces belong in the base acceptance-side UPL pack.

The goal is simple:

- identify what is already live on the UPL acceptance side
- identify the best net-new adds for the UPL acceptance side
- identify what should stay out of the base yes-side

## Read This

This document is about the **UPL acceptance side** only.

- It does not change the denial side.
- It does not create a new engine.
- It records the extraction pass from the provided list.
- It explains what was already covered, what was added, and what should stay out of the base yes-side.

## What Is Already Live Or Partially Live

These items from the provided list already have real coverage in the current acceptance-side UPL pack, or have clear partial coverage already present.

### Already Live

- `pdf`
  Current live coverage:
  `nano-pdf`
  `links-to-pdfs`
  `book-reader`

- `obsidian`
  Current live coverage:
  `obsidian`
  `archive-daily-note`

- `skill-creator`
  Current live coverage:
  `skill-creator`

- `research / knowledge work`
  Current live coverage:
  `academic-deep-research`
  `agent-deep-research`
  `agentic-paper-digest`
  `openclaw-free-web-search`
  `deepwiki`
  `gh-extract`
  `truthcheck`
  `confluence`
  `google-docs-skill`
  `sharepoint-by-altf1be`

- `coding / debugging / file search`
  Current live coverage:
  `coding-agent`
  `filesystem`
  `read-optimizer`
  safe local exec pack
  `rg`
  `git`

- `writing / coauthoring / document work`
  Current live coverage:
  `office-document-editor`
  `notion`
  `better-notion`
  `craft`
  `craft-do`
  `bookstack`
  `drafts`
  `joplin-api`

- `task / project orchestration`
  Current live coverage:
  `taskflow`
  `taskflow-inbox-triage`
  `things-mac`
  `agent-team-orchestration`
  `asana`
  `atlassian-mcp`
  `apple-reminders`
  `apple-calendar`
  `google-calendar`

- `speech / media / artifact-adjacent work`
  Current live coverage:
  `openai-whisper`
  `openai-whisper-api`
  `audio-transcribe`
  `faster-whisper`
  `kokoro-tts`
  `local-vosk`
  `local-voice`
  `elevenlabs-tts`
  `mac-tts`
  `say`
  `apple-media`
  `video-frames`

- `canvas / app-control / desktop-adjacent work`
  Current live coverage:
  `canvas`
  `openhue`
  `sonoscli`
  `spotify-player`
  `tmux`

### Partial But Not Explicit Enough Yet

These are conceptually present, but not yet represented as clear named acceptance-side UPL entries from the provided list.

- `docx`
  Partial via `office-document-editor`

- `pptx`
  Partial via `office-document-editor`

- `xlsx`
  Not explicit yet

- `doc co-authoring`
  Document work exists, but there is not yet a clean named coauthoring entry

- `frontend design`
  Artifact and canvas work exist, but not as a named frontend-design entry

- `canvas design`
  `canvas` exists, but not a dedicated canvas-design acceptance entry

- `debugging`
  Coding/debugging capability exists, but not as a clean named debugging entry

- `file search`
  `rg` and coding rails exist, but not a clean named file-search entry

- `context optimization`
  Not explicit yet

- `memory / knowledge graph`
  Notes/memory work exists, but not an explicit codebase-memory or graph-memory entry

- `browser automation`
  Retrieval exists, but not a clean bounded browser automation entry

- `MCP integrations`
  There are acceptance-side skills that behave like integrations, but no clean generic MCP-side pack shape yet

## Strong Net-New Yes-Side Candidates

These are the best direct adds from the provided list for the **base UPL acceptance side**.

They fit the standard:

- broad normal human workflow value
- bounded
- useful on day 1
- not sovereignty expansion

### Document And Office

- `pdf` as an explicit named office/document entry
- `docx`
- `pptx`
- `xlsx`
- `doc-coauthoring`
- `excel-mcp-server`

### Design And Creative

- `frontend-design`
- `canvas-design`
- `algorithmic-art`
- `theme-factory`
- `web-artifacts-builder`
- `remotion-best-practices`

### Dev And Engineering

- `superpowers`
- `systematic-debugging`
- `file-search`
- `context-optimization`
- `task-master-ai`
- `codebase-memory-mcp`
- `spec-kit`
- `markdownify-mcp`

### Marketing And SEO

- `marketing-skills`
- `claude-seo`
- `brand-guidelines`

### Knowledge And Learning

- `notebooklm-integration`
- `obsidian-skills`
- `flashcards-and-study-outputs`

### Search, Retrieval, And Browser Work

- `tavily`
- `context7`
- `gpt-researcher`
- `mcp-playwright`
- `extractthinker`

### Workflow And Orchestration

- `langgraph`
- `copilotkit`
- `n8n`
- `langflow`
- `fastmcp`
- `mcphub`

## Things To Keep Out Of The Base Yes-Side

These may be useful in some deployments, but they should not be part of the shipped base acceptance pack.

### Secrets, Identity, Finance

- `1password`
- `Security & Passwords` style tools
- payment / wallet / finance execution tools
- `actual-budget`
- `quickbooks`
- health or finance records systems that expose highly sensitive personal data by default

### Stealth Or Hidden-Browser Behavior

- `stealth-browser-mcp`

### Broad System Or Fleet Power

- `AutoGPT`
- `OWL`
- `CrewAI`
- `gstack`
- `cmux`
- `figaro`
- `claude-squad`
- `deer-flow`
- `SWE-AF`
- `AIlice`
- `Agent Alchemy`
- `Ghost OS`
- `container-use`
- `Canopy`
- `MetaClaw`

### Infra Mutation Or Provider-Sprawl Power

- `Ollama`
- `Open WebUI`
- `LlamaFile`
- `Unsloth`
- `OmniRoute`
- `Portkey gateway`
- `dlt`

### Security / Offensive / Deep Governance Surfaces

- `agent-governance-toolkit`
- `claude-code-security-review`
- `promptfoo`
- `NemoClaw`

Those can exist as separate optional acceptance packs later, but they should not be day-one public base yes-side.

## Best Next Acceptance-Side Extraction Order

If the next pass is "make the yes-side feel alive fast", the clean order is:

1. office/document explicit entries
2. design/artifact explicit entries
3. dev/debug/search explicit entries
4. browser + retrieval explicit entries
5. marketing / seo / brand entries
6. memory / knowledge graph explicit entries
7. workflow / MCP explicit entries

## Clean Add-Now Set

If we only take the strongest day-one adds from this extraction, this is the clean first set:

- `docx`
- `pptx`
- `xlsx`
- `doc-coauthoring`
- `frontend-design`
- `canvas-design`
- `theme-factory`
- `web-artifacts-builder`
- `superpowers`
- `systematic-debugging`
- `file-search`
- `context-optimization`
- `notebooklm-integration`
- `excel-mcp-server`
- `tavily`
- `context7`
- `task-master-ai`
- `gpt-researcher`
- `codebase-memory-mcp`
- `mcp-playwright`
- `markdownify-mcp`
- `brand-guidelines`
- `claude-seo`

## Bottom Line

The provided list is very good for the yes-side because it reflects what people actually expect an agent to do right away:

- document work
- office work
- coding and debugging
- writing and coauthoring
- research and retrieval
- memory and knowledge work
- artifacts and some design work
- bounded browser / MCP / workflow integrations

That means it is a strong source list for the next acceptance-side UPL expansion.
