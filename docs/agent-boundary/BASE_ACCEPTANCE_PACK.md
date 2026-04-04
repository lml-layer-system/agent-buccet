# Base Acceptance Pack Inventory

> Generated from Buccet acceptance sources. Regenerate with `node scripts/render-agent-buccet-base-acceptance-pack.ts`.

This document enumerates the live shipped base Buccet acceptance UPL pack.

It is one acceptance-side UPL system. Runtime still compiles it into the same live field as denial, and deny overrides acceptance on overlap.

## Summary

- Total acceptance-side UPL entries seeded per opened workspace session: 279
- Workspace entries: 5
- Safe local exec entries: 4
- Bounded web research entries: 3
- OpenClaw skill entries: 110
  Bundled OpenClaw entries: 53
  Awesome OpenClaw entries: 57
- Curated capability entries: 43
- Curated workflow entries: 23
- Marketplace-derived entries: 91
  SkillsMP entries: 47
  SkillHub entries: 29
  AITmpl entries: 6
  AgentSkills entries: 9

## Buccet Labels

- `ACCEPT.WORKSPACE.*`: built-in Buccet workspace yes-side entries.
- `ACCEPT.SAFE.LOCAL.EXEC.*`: built-in Buccet bounded local command entries.
- `ACCEPT.BOUNDED.WEB.RESEARCH.*`: built-in Buccet bounded retrieval and research entries.
- `ACCEPT.OPENCLAW.SKILL.*`: OpenClaw-derived yes-side entries carried inside the same Buccet acceptance pack.
- `ACCEPT.CURATED.CAPABILITY.*`: curated named yes-side entries from the broader public capability scan.
- `ACCEPT.CURATED.WORKFLOW.*`: workflow-shaped yes-side entries that make the pack read like real work instead of tool names.
- `ACCEPT.MARKETPLACE.SKILL.*`: marketplace-derived yes-side entries pulled from broader public skill catalogs.

## Read This

Every entry below uses the same fields:

- `What it is`: the plain-language job this acceptance entry opens.
- `Connects to`: the exact named target, provider/app corridor, or workspace path shape it connects to.
- `Action kinds`: the allowed motion kinds on that entry.
- `Bounds`: the shape limit of the entry. Deny still wins on overlap everywhere.

Throughout this document, `<workspace-root>` means the workspace path the user explicitly opened into lawful scope.

## Workspace Entries (5)

### ACCEPT.WORKSPACE.READ.001
What it is: Read motion inside opened workspace is lawful.
Connects to: prefix corridor `<workspace-root>`.
Action kinds: `fs.read`.
Bounds: listed prefix corridor only; deny still wins on overlap.

### ACCEPT.WORKSPACE.MUTATION.002
What it is: Scoped code and document mutation inside opened workspace is lawful.
Connects to: prefix corridor `<workspace-root>`.
Action kinds: `fs.write`, `fs.append`.
Bounds: listed prefix corridor only; deny still wins on overlap.

### ACCEPT.LOCAL.ORGANIZATION.003
What it is: Non-destructive organization inside opened workspace is lawful.
Connects to: prefix corridor `<workspace-root>`.
Action kinds: `fs.mkdir`, `fs.move`.
Bounds: listed prefix corridor only; deny still wins on overlap.

### ACCEPT.INTERNAL.ARTIFACTS.004
What it is: Reports and artifact outputs inside standard workspace output roots are lawful.
Connects to: prefix corridor `<workspace-root>/outputs`; prefix corridor `<workspace-root>/reports`; prefix corridor `<workspace-root>/artifacts`.
Action kinds: `fs.write`, `fs.append`.
Bounds: listed prefix corridor only; deny still wins on overlap.

### ACCEPT.NOTES.TASKS.007
What it is: Local notes, tasks, and Buccet workspace memory roots are lawful.
Connects to: prefix corridor `<workspace-root>/.buccet`; prefix corridor `<workspace-root>/notes`; prefix corridor `<workspace-root>/tasks`; prefix corridor `<workspace-root>/memory`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.mkdir`, `fs.move`.
Bounds: listed prefix corridor only; deny still wins on overlap.

## Safe Local Exec Entries (4)

### ACCEPT.SAFE.LOCAL.EXEC.005A
What it is: Bounded local repository inspection commands are lawful.
Connects to: exact Buccet target `git`; exact Buccet target `rg`.
Action kinds: `tool.exec`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.SAFE.LOCAL.EXEC.005B
What it is: Bounded package-runner quality commands are lawful.
Connects to: exact Buccet target `npm`; exact Buccet target `pnpm`; exact Buccet target `yarn`.
Action kinds: `tool.exec`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.SAFE.LOCAL.EXEC.005C
What it is: Bounded test, lint, and typecheck tools are lawful.
Connects to: exact Buccet target `pytest`; exact Buccet target `ruff`; exact Buccet target `mypy`; exact Buccet target `eslint`; exact Buccet target `prettier`; exact Buccet target `tsc`.
Action kinds: `tool.exec`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.SAFE.LOCAL.EXEC.005D
What it is: Bounded native-toolchain quality commands are lawful.
Connects to: exact Buccet target `cargo`; exact Buccet target `go`; exact Buccet target `make`.
Action kinds: `tool.exec`.
Bounds: exact named target only; deny still wins on overlap.

## Bounded Web Research Entries (3)

### ACCEPT.BOUNDED.WEB.RESEARCH.006A
What it is: Bounded documentation and reference retrieval is lawful.
Connects to: bounded host corridors `developer.mozilla.org`; bounded host corridors `docs.python.org`; bounded host corridors `docs.npmjs.com`; bounded host corridors `nodejs.org`; bounded host corridors `docs.rs`; bounded host corridors `pkg.go.dev`; bounded host corridors `www.typescriptlang.org`; bounded host corridors `developer.apple.com`.
Action kinds: `network.send`.
Bounds: listed bounded corridors only; deny still wins on overlap.

### ACCEPT.BOUNDED.WEB.RESEARCH.006B
What it is: Bounded source and repository retrieval is lawful.
Connects to: bounded host corridors `github.com`; bounded host corridors `api.github.com`; bounded host corridors `raw.githubusercontent.com`.
Action kinds: `network.send`.
Bounds: listed bounded corridors only; deny still wins on overlap.

### ACCEPT.BOUNDED.WEB.RESEARCH.006C
What it is: Bounded search and retrieval provider use is lawful.
Connects to: bounded host corridors `duckduckgo.com`; bounded host corridors `search.brave.com`; bounded host corridors `exa.ai`; bounded host corridors `firecrawl.dev`.
Action kinds: `network.send`.
Bounds: listed bounded corridors only; deny still wins on overlap.

## Bundled OpenClaw Skill Entries (53)

### ACCEPT.OPENCLAW.SKILL.1002 — apple-notes
What it is: local Apple Notes read and write motion.
Connects to: exact Buccet target `apple-notes`.
Action kinds: `fs.read`, `fs.write`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1003 — apple-reminders
What it is: reminders query and update motion.
Connects to: exact Buccet target `apple-reminders`.
Action kinds: `db.query`, `db.insert`, `db.update`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1004 — bear-notes
What it is: Bear notes read and write motion.
Connects to: exact Buccet target `bear-notes`.
Action kinds: `fs.read`, `fs.write`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1005 — blogwatcher
What it is: blog/feed retrieval and note output.
Connects to: exact Buccet target `blogwatcher`.
Action kinds: `network.send`, `fs.write`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1006 — blucli
What it is: bounded local CLI workflow motion.
Connects to: exact Buccet target `blucli`.
Action kinds: `tool.exec`, `fs.read`, `fs.write`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1007 — bluebubbles
What it is: BlueBubbles message delivery motion.
Connects to: exact Buccet target `bluebubbles`.
Action kinds: `chat.emit`, `comm.send`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1009 — canvas
What it is: canvas control and paired surface updates.
Connects to: exact Buccet target `canvas`.
Action kinds: `tool.exec`, `sys.config.read`, `sys.config.write`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1010 — clawhub
What it is: ClawHub network and workflow motion.
Connects to: exact Buccet target `clawhub`.
Action kinds: `network.send`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1011 — coding-agent
What it is: local coding and file mutation work.
Connects to: exact Buccet target `coding-agent`.
Action kinds: `tool.exec`, `fs.read`, `fs.write`, `fs.append`, `fs.mkdir`, `fs.move`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1012 — discord
What it is: Discord delivery motion.
Connects to: exact Buccet target `discord`.
Action kinds: `chat.emit`, `comm.send`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1013 — eightctl
What it is: bounded controller CLI workflow motion.
Connects to: exact Buccet target `eightctl`.
Action kinds: `tool.exec`, `fs.read`, `fs.write`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1014 — gemini
What it is: Gemini-backed retrieval or exchange motion.
Connects to: bounded host corridors `generativelanguage.googleapis.com`; bounded host corridors `ai.google.dev`.
Action kinds: `network.send`, `chat.emit`.
Bounds: listed bounded corridors only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1015 — gh-issues
What it is: GitHub issue retrieval and update workflow motion.
Connects to: bounded host corridors `github.com`; bounded host corridors `api.github.com`.
Action kinds: `network.send`, `fs.read`, `fs.write`.
Bounds: listed bounded corridors only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1016 — gifgrep
What it is: local media search and inspection motion.
Connects to: exact Buccet target `gifgrep`.
Action kinds: `tool.exec`, `fs.read`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1017 — github
What it is: GitHub work item and repository workflow motion.
Connects to: bounded host corridors `github.com`; bounded host corridors `api.github.com`; bounded host corridors `raw.githubusercontent.com`.
Action kinds: `network.send`, `fs.read`, `fs.write`, `chat.emit`.
Bounds: listed bounded corridors only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1018 — gog
What it is: bounded tool and service workflow motion.
Connects to: exact Buccet target `gog`.
Action kinds: `tool.exec`, `network.send`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1019 — goplaces
What it is: places lookup and result writing motion.
Connects to: bounded host corridors `places.googleapis.com`; bounded host corridors `maps.googleapis.com`.
Action kinds: `network.send`, `fs.write`.
Bounds: listed bounded corridors only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1020 — healthcheck
What it is: bounded health and diagnostics checks.
Connects to: exact Buccet target `healthcheck`.
Action kinds: `tool.exec`, `network.send`, `fs.write`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1021 — himalaya
What it is: mail-oriented communication workflow motion.
Connects to: exact Buccet target `himalaya`.
Action kinds: `comm.send`, `fs.read`, `fs.write`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1022 — imsg
What it is: iMessage delivery motion.
Connects to: exact Buccet target `imsg`.
Action kinds: `chat.emit`, `comm.send`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1023 — mcporter
What it is: bounded local workflow and file motion.
Connects to: exact Buccet target `mcporter`.
Action kinds: `tool.exec`, `fs.read`, `fs.write`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1024 — model-usage
What it is: model-usage note and ledger motion.
Connects to: exact Buccet target `model-usage`.
Action kinds: `fs.read`, `fs.write`, `db.query`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1025 — nano-pdf
What it is: PDF retrieval and extraction output motion.
Connects to: exact Buccet target `nano-pdf`.
Action kinds: `fs.read`, `fs.write`, `network.send`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1026 — node-connect
What it is: node connection and paired target motion.
Connects to: exact Buccet target `node-connect`.
Action kinds: `tool.exec`, `network.send`, `sys.config.read`, `sys.config.write`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1027 — notion
What it is: Notion retrieval and update motion.
Connects to: bounded host corridors `notion.so`; bounded host corridors `api.notion.com`; exact target `notion`.
Action kinds: `network.send`, `db.query`, `db.insert`, `db.update`, `fs.write`.
Bounds: listed bounded corridors only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1028 — obsidian
What it is: Obsidian vault read and write motion.
Connects to: exact Buccet target `obsidian`.
Action kinds: `fs.read`, `fs.write`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1029 — openai-whisper
What it is: local transcription workflow motion.
Connects to: exact Buccet target `openai-whisper`.
Action kinds: `tool.exec`, `fs.read`, `fs.write`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1030 — openai-whisper-api
What it is: API-backed transcription workflow motion.
Connects to: bounded host corridors `api.openai.com`; exact target `openai-whisper-api`.
Action kinds: `network.send`, `fs.read`, `fs.write`.
Bounds: listed bounded corridors only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1031 — openhue
What it is: Hue device control motion.
Connects to: exact Buccet target `openhue`.
Action kinds: `network.send`, `sys.config.read`, `sys.config.write`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1032 — oracle
What it is: bounded oracle-style query and output motion.
Connects to: exact Buccet target `oracle`.
Action kinds: `network.send`, `chat.emit`, `fs.write`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1033 — ordercli
What it is: bounded order/workflow CLI motion.
Connects to: exact Buccet target `ordercli`.
Action kinds: `tool.exec`, `network.send`, `fs.write`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1034 — peekaboo
What it is: bounded local inspection workflow motion.
Connects to: exact Buccet target `peekaboo`.
Action kinds: `tool.exec`, `fs.read`, `fs.write`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1035 — sag
What it is: bounded service and automation workflow motion.
Connects to: exact Buccet target `sag`.
Action kinds: `network.send`, `tool.exec`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1036 — session-logs
What it is: local session log read and write motion.
Connects to: exact Buccet target `session-logs`.
Action kinds: `fs.read`, `fs.write`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1037 — sherpa-onnx-tts
What it is: local text-to-speech workflow motion.
Connects to: exact Buccet target `sherpa-onnx-tts`.
Action kinds: `tool.exec`, `fs.read`, `fs.write`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1038 — skill-creator
What it is: local skill authoring workflow motion.
Connects to: exact Buccet target `skill-creator`.
Action kinds: `tool.exec`, `fs.read`, `fs.write`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1039 — slack
What it is: Slack delivery motion.
Connects to: exact Buccet target `slack`.
Action kinds: `chat.emit`, `comm.send`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1039A — telegram
What it is: Telegram delivery motion.
Connects to: exact Buccet target `telegram`.
Action kinds: `chat.emit`, `comm.send`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1040 — songsee
What it is: song/media understanding workflow motion.
Connects to: exact Buccet target `songsee`.
Action kinds: `tool.exec`, `fs.read`, `fs.write`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1041 — sonoscli
What it is: Sonos device control motion.
Connects to: exact Buccet target `sonoscli`.
Action kinds: `tool.exec`, `network.send`, `sys.config.read`, `sys.config.write`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1042 — spotify-player
What it is: Spotify playback control motion.
Connects to: exact Buccet target `spotify-player`.
Action kinds: `tool.exec`, `network.send`, `sys.config.read`, `sys.config.write`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1043 — summarize
What it is: summarization read/write/output motion.
Connects to: exact Buccet target `summarize`.
Action kinds: `fs.read`, `fs.write`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1044 — taskflow
What it is: taskflow task-system motion.
Connects to: exact Buccet target `taskflow`.
Action kinds: `fs.read`, `fs.write`, `db.query`, `db.insert`, `db.update`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1045 — taskflow-inbox-triage
What it is: inbox triage task-system motion.
Connects to: exact Buccet target `taskflow-inbox-triage`.
Action kinds: `fs.read`, `fs.write`, `db.query`, `db.insert`, `db.update`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1046 — things-mac
What it is: Things task-system motion.
Connects to: exact Buccet target `things-mac`.
Action kinds: `db.query`, `db.insert`, `db.update`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1047 — tmux
What it is: tmux session workflow motion.
Connects to: exact Buccet target `tmux`.
Action kinds: `tool.exec`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1048 — trello
What it is: Trello board and task motion.
Connects to: bounded host corridors `trello.com`; exact target `trello`.
Action kinds: `network.send`, `db.query`, `db.insert`, `db.update`.
Bounds: listed bounded corridors only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1049 — video-frames
What it is: video frame extraction workflow motion.
Connects to: exact Buccet target `video-frames`.
Action kinds: `tool.exec`, `fs.read`, `fs.write`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1050 — voice-call
What it is: voice-call delivery motion.
Connects to: exact Buccet target `voice-call`.
Action kinds: `comm.send`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1051 — wacli
What it is: WhatsApp CLI delivery motion.
Connects to: exact Buccet target `wacli`.
Action kinds: `chat.emit`, `comm.send`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1051A — whatsapp
What it is: WhatsApp delivery motion.
Connects to: exact Buccet target `whatsapp`.
Action kinds: `chat.emit`, `comm.send`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1052 — weather
What it is: weather retrieval and output motion.
Connects to: bounded host corridors `weather.gov`; bounded host corridors `api.openweathermap`; exact target `weather`.
Action kinds: `network.send`, `fs.write`, `chat.emit`.
Bounds: listed bounded corridors only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1053 — xurl
What it is: fetch and retrieval motion.
Connects to: bounded host corridors `developer.mozilla.org`; bounded host corridors `docs.python.org`; bounded host corridors `docs.npmjs.com`; bounded host corridors `nodejs.org`; bounded host corridors `docs.rs`; bounded host corridors `pkg.go.dev`; bounded host corridors `www.typescriptlang.org`; bounded host corridors `developer.apple.com`; bounded host corridors `github.com`; bounded host corridors `api.github.com`; bounded host corridors `raw.githubusercontent.com`.
Action kinds: `network.send`, `fs.read`, `fs.write`.
Bounds: listed bounded corridors only; deny still wins on overlap.

## Awesome OpenClaw Skill Entries (57)

### ACCEPT.OPENCLAW.SKILL.1054 — agent-mail
What it is: AI inbox read, draft, and delivery motion.
Connects to: exact Buccet target `agent-mail`.
Action kinds: `comm.send`, `fs.read`, `fs.write`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1055 — agent-mail-cli
What it is: CLI-backed agent inbox read, draft, and delivery motion.
Connects to: exact Buccet target `agent-mail-cli`.
Action kinds: `comm.send`, `fs.read`, `fs.write`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1056 — apple-mail-search-safe
What it is: safe Apple Mail lookup and body search motion.
Connects to: exact Buccet target `apple-mail-search-safe`.
Action kinds: `db.query`, `fs.read`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1057 — beeper
What it is: Beeper history search and browse motion.
Connects to: exact Buccet target `beeper`.
Action kinds: `db.query`, `fs.read`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1058 — rocketchat
What it is: Rocket.Chat channel delivery motion.
Connects to: exact Buccet target `rocketchat`.
Action kinds: `chat.emit`, `comm.send`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1059 — sixel-email
What it is: bounded one-to-one email delivery motion.
Connects to: exact Buccet target `sixel-email`.
Action kinds: `comm.send`, `fs.read`, `fs.write`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1060 — apple-calendar
What it is: Apple Calendar query and event update motion.
Connects to: exact Buccet target `apple-calendar`.
Action kinds: `db.query`, `db.insert`, `db.update`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1061 — google-calendar
What it is: Google Calendar query and event update motion.
Connects to: bounded host corridors `calendar.googleapis.com`; bounded host corridors `www.googleapis.com`; bounded host corridors `calendar.google.com`.
Action kinds: `network.send`, `db.query`, `db.insert`, `db.update`.
Bounds: listed bounded corridors only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1062 — gcal-pro
What it is: Google Calendar CLI scheduling motion.
Connects to: bounded host corridors `calendar.googleapis.com`; bounded host corridors `www.googleapis.com`; bounded host corridors `calendar.google.com`.
Action kinds: `network.send`, `db.query`, `db.insert`, `db.update`.
Bounds: listed bounded corridors only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1063 — ms-todo-oauth
What it is: Microsoft To Do task query and update motion.
Connects to: bounded host corridors `graph.microsoft.com`; bounded host corridors `login.microsoftonline.com`.
Action kinds: `network.send`, `db.query`, `db.insert`, `db.update`.
Bounds: listed bounded corridors only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1064 — task-sync
What it is: task synchronization and mirrored task updates.
Connects to: exact Buccet target `task-sync`.
Action kinds: `tool.exec`, `db.query`, `db.insert`, `db.update`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1065 — asana
What it is: Asana project and task workflow motion.
Connects to: bounded host corridors `app.asana.com`; bounded host corridors `api.asana.com`.
Action kinds: `network.send`, `db.query`, `db.insert`, `db.update`.
Bounds: listed bounded corridors only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1066 — atlassian-mcp
What it is: Atlassian task, issue, and page workflow motion.
Connects to: bounded host corridors `api.atlassian.com`; bounded host corridors `atlassian.net`.
Action kinds: `network.send`, `db.query`, `db.insert`, `db.update`.
Bounds: listed bounded corridors only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1067 — notes-reminders
What it is: quick notes and reminder update motion.
Connects to: exact Buccet target `notes-reminders`.
Action kinds: `fs.read`, `fs.write`, `db.insert`, `db.update`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1068 — apple-contacts
What it is: Apple Contacts lookup motion.
Connects to: exact Buccet target `apple-contacts`.
Action kinds: `db.query`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1069 — drafts
What it is: Drafts note read and update motion.
Connects to: exact Buccet target `drafts`.
Action kinds: `fs.read`, `fs.write`, `db.query`, `db.insert`, `db.update`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1070 — craft
What it is: Craft note and document motion.
Connects to: exact Buccet target `craft`.
Action kinds: `fs.read`, `fs.write`, `db.query`, `db.insert`, `db.update`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1071 — craft-do
What it is: Craft.do document and workspace motion.
Connects to: bounded host corridors `craft.do`.
Action kinds: `network.send`, `db.query`, `db.insert`, `db.update`.
Bounds: listed bounded corridors only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1072 — bookstack
What it is: BookStack wiki and documentation workflow motion.
Connects to: exact Buccet target `bookstack`.
Action kinds: `network.send`, `db.query`, `db.insert`, `db.update`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1073 — better-notion
What it is: richer Notion page and database motion.
Connects to: bounded host corridors `notion.so`; bounded host corridors `api.notion.com`; exact target `better-notion`.
Action kinds: `network.send`, `db.query`, `db.insert`, `db.update`, `fs.write`.
Bounds: listed bounded corridors only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1074 — google-keep
What it is: Google Keep note and list workflow motion.
Connects to: exact Buccet target `google-keep`.
Action kinds: `db.query`, `db.insert`, `db.update`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1075 — joplin-api
What it is: Joplin note and notebook workflow motion.
Connects to: exact Buccet target `joplin-api`.
Action kinds: `network.send`, `db.query`, `db.insert`, `db.update`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1076 — book-reader
What it is: local book and document reading motion.
Connects to: exact Buccet target `book-reader`.
Action kinds: `fs.read`, `tool.exec`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1077 — archive-daily-note
What it is: Obsidian daily note archive motion.
Connects to: exact Buccet target `archive-daily-note`.
Action kinds: `fs.read`, `fs.write`, `fs.move`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1078 — office-document-editor
What it is: tracked-change office document editing motion.
Connects to: exact Buccet target `office-document-editor`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `tool.exec`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1079 — academic-deep-research
What it is: academic-source retrieval and research note output.
Connects to: bounded host corridors `arxiv.org`; bounded host corridors `export.arxiv.org`; bounded host corridors `api.semanticscholar.org`; bounded host corridors `api.crossref.org`; bounded host corridors `api.openalex.org`.
Action kinds: `network.send`, `fs.write`, `chat.emit`.
Bounds: listed bounded corridors only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1080 — agent-deep-research
What it is: deep research retrieval and synthesis motion.
Connects to: bounded host corridors `arxiv.org`; bounded host corridors `export.arxiv.org`; bounded host corridors `api.semanticscholar.org`; bounded host corridors `api.crossref.org`; bounded host corridors `api.openalex.org`; bounded host corridors `generativelanguage.googleapis.com`.
Action kinds: `network.send`, `fs.write`, `chat.emit`.
Bounds: listed bounded corridors only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1081 — agentic-paper-digest
What it is: paper digest retrieval and summary motion.
Connects to: bounded host corridors `arxiv.org`; bounded host corridors `export.arxiv.org`; bounded host corridors `huggingface.co`.
Action kinds: `network.send`, `fs.write`, `chat.emit`.
Bounds: listed bounded corridors only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1082 — arxiv-search-collector
What it is: arXiv retrieval and citation-set building motion.
Connects to: bounded host corridors `arxiv.org`; bounded host corridors `export.arxiv.org`; bounded host corridors `api.crossref.org`.
Action kinds: `network.send`, `fs.write`.
Bounds: listed bounded corridors only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1083 — openclaw-free-web-search
What it is: search and retrieval provider motion.
Connects to: bounded host corridors `duckduckgo.com`; bounded host corridors `search.brave.com`; bounded host corridors `exa.ai`; bounded host corridors `firecrawl.dev`.
Action kinds: `network.send`, `fs.write`, `chat.emit`.
Bounds: listed bounded corridors only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1084 — feed-to-md
What it is: RSS and Atom retrieval into Markdown output motion.
Connects to: exact Buccet target `feed-to-md`.
Action kinds: `tool.exec`, `network.send`, `fs.write`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1085 — ffcli
What it is: Fireflies meeting retrieval and note output motion.
Connects to: exact Buccet target `ffcli`.
Action kinds: `network.send`, `db.query`, `fs.write`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1086 — deepwiki
What it is: DeepWiki and GitHub documentation retrieval motion.
Connects to: bounded host corridors `deepwiki.com`; bounded host corridors `github.com`; bounded host corridors `api.github.com`; bounded host corridors `raw.githubusercontent.com`.
Action kinds: `network.send`, `fs.read`, `fs.write`.
Bounds: listed bounded corridors only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1087 — gh-extract
What it is: GitHub content extraction motion.
Connects to: bounded host corridors `github.com`; bounded host corridors `api.github.com`; bounded host corridors `raw.githubusercontent.com`.
Action kinds: `network.send`, `fs.read`, `fs.write`.
Bounds: listed bounded corridors only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1088 — intomd
What it is: documentation-to-Markdown retrieval motion.
Connects to: bounded host corridors `into.md`.
Action kinds: `network.send`, `fs.write`.
Bounds: listed bounded corridors only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1089 — markdown-converter
What it is: document-to-Markdown conversion motion.
Connects to: exact Buccet target `markdown-converter`.
Action kinds: `fs.read`, `fs.write`, `tool.exec`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1090 — truthcheck
What it is: claim verification and fact-check workflow motion.
Connects to: exact Buccet target `truthcheck`.
Action kinds: `network.send`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1091 — image-ocr
What it is: OCR extraction from local image inputs.
Connects to: exact Buccet target `image-ocr`.
Action kinds: `fs.read`, `fs.write`, `tool.exec`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1092 — links-to-pdfs
What it is: document scraping and PDF retrieval motion.
Connects to: bounded host corridors `notion.so`; bounded host corridors `docsend.com`; bounded regex corridor `/\.pdf(?:$|[?#])/i`.
Action kinds: `network.send`, `fs.write`.
Bounds: listed bounded corridors only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1093 — confluence
What it is: Confluence page and space workflow motion.
Connects to: bounded host corridors `api.atlassian.com`; bounded host corridors `atlassian.net`.
Action kinds: `network.send`, `db.query`, `db.insert`, `db.update`.
Bounds: listed bounded corridors only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1094 — google-docs-skill
What it is: Google Docs document workflow motion.
Connects to: bounded host corridors `docs.googleapis.com`; bounded host corridors `www.googleapis.com`; bounded host corridors `docs.google.com`; bounded host corridors `drive.googleapis.com`.
Action kinds: `network.send`, `db.query`, `db.insert`, `db.update`.
Bounds: listed bounded corridors only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1095 — sharepoint-by-altf1be
What it is: SharePoint file and document intelligence motion.
Connects to: bounded host corridors `graph.microsoft.com`; bounded host corridors `sharepoint.com`.
Action kinds: `network.send`, `fs.read`, `fs.write`, `db.query`.
Bounds: listed bounded corridors only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1096 — audio-transcribe
What it is: local voice-message transcription motion.
Connects to: exact Buccet target `audio-transcribe`.
Action kinds: `tool.exec`, `fs.read`, `fs.write`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1097 — faster-whisper
What it is: local faster-whisper transcription motion.
Connects to: exact Buccet target `faster-whisper`.
Action kinds: `tool.exec`, `fs.read`, `fs.write`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1098 — kokoro-tts
What it is: local Kokoro text-to-speech motion.
Connects to: exact Buccet target `kokoro-tts`.
Action kinds: `tool.exec`, `fs.read`, `fs.write`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1099 — local-vosk
What it is: local Vosk speech-to-text motion.
Connects to: exact Buccet target `local-vosk`.
Action kinds: `tool.exec`, `fs.read`, `fs.write`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1100 — local-voice
What it is: local TTS/STT voice pipeline motion.
Connects to: exact Buccet target `local-voice`.
Action kinds: `tool.exec`, `fs.read`, `fs.write`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1101 — elevenlabs-tts
What it is: ElevenLabs text-to-speech motion.
Connects to: bounded host corridors `api.elevenlabs.io`; bounded host corridors `elevenlabs.io`.
Action kinds: `network.send`, `fs.read`, `fs.write`.
Bounds: listed bounded corridors only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1102 — mac-tts
What it is: macOS built-in text-to-speech motion.
Connects to: exact Buccet target `mac-tts`.
Action kinds: `tool.exec`, `fs.read`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1103 — say
What it is: Siri-voice macOS speech output motion.
Connects to: exact Buccet target `say`.
Action kinds: `tool.exec`, `fs.read`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1104 — apple-media
What it is: Apple media-device control motion.
Connects to: exact Buccet target `apple-media`.
Action kinds: `network.send`, `sys.config.read`, `sys.config.write`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1105 — agent-team-orchestration
What it is: agent handoff, coordination, and workflow note motion.
Connects to: exact Buccet target `agent-team-orchestration`.
Action kinds: `chat.emit`, `comm.send`, `fs.read`, `fs.write`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1106 — azure-devops
What it is: Azure DevOps repository and work-item workflow motion.
Connects to: bounded host corridors `dev.azure.com`; bounded host corridors `visualstudio.com`.
Action kinds: `network.send`, `fs.read`, `fs.write`.
Bounds: listed bounded corridors only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1107 — bitbucket-automation
What it is: Bitbucket repository and pull-request workflow motion.
Connects to: bounded host corridors `bitbucket.org`.
Action kinds: `network.send`, `fs.read`, `fs.write`.
Bounds: listed bounded corridors only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1108 — filesystem
What it is: advanced workspace file listing, search, and batch motion.
Connects to: exact Buccet target `filesystem`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.mkdir`, `fs.move`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1109 — docsync
What it is: docs generation and drift-check workflow motion.
Connects to: exact Buccet target `docsync`.
Action kinds: `tool.exec`, `fs.read`, `fs.write`, `fs.append`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.OPENCLAW.SKILL.1110 — read-optimizer
What it is: bounded repository reading strategy motion.
Connects to: exact Buccet target `read-optimizer`.
Action kinds: `tool.exec`, `fs.read`.
Bounds: exact named target only; deny still wins on overlap.

## Curated Capability Entries (43)

### ACCEPT.CURATED.CAPABILITY.2001 — docx
What it is: Word document creation, editing, and tracked-change workflow motion.
Connects to: exact Buccet target `docx`.
Action kinds: `tool.exec`, `fs.read`, `fs.write`, `fs.append`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.CURATED.CAPABILITY.2002 — pptx
What it is: slide deck creation, editing, and speaker-note workflow motion.
Connects to: exact Buccet target `pptx`.
Action kinds: `tool.exec`, `fs.read`, `fs.write`, `fs.append`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.CURATED.CAPABILITY.2003 — xlsx
What it is: spreadsheet analysis, formula, and chart workflow motion.
Connects to: exact Buccet target `xlsx`.
Action kinds: `tool.exec`, `fs.read`, `fs.write`, `fs.append`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.CURATED.CAPABILITY.2004 — doc-coauthoring
What it is: collaborative drafting, revision, and coauthoring workflow motion.
Connects to: exact Buccet target `doc-coauthoring`.
Action kinds: `chat.emit`, `fs.read`, `fs.write`, `fs.append`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.CURATED.CAPABILITY.2005 — frontend-design
What it is: frontend design-system and visual component workflow motion.
Connects to: exact Buccet target `frontend-design`.
Action kinds: `tool.exec`, `fs.read`, `fs.write`, `fs.append`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.CURATED.CAPABILITY.2006 — canvas-design
What it is: social graphic, poster, and canvas output workflow motion.
Connects to: exact Buccet target `canvas-design`.
Action kinds: `tool.exec`, `fs.read`, `fs.write`, `fs.append`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.CURATED.CAPABILITY.2007 — theme-factory
What it is: theme and color-system generation workflow motion.
Connects to: exact Buccet target `theme-factory`.
Action kinds: `tool.exec`, `fs.read`, `fs.write`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.CURATED.CAPABILITY.2008 — web-artifacts-builder
What it is: calculators, dashboards, and interactive artifact workflow motion.
Connects to: exact Buccet target `web-artifacts-builder`.
Action kinds: `tool.exec`, `fs.read`, `fs.write`, `fs.append`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.CURATED.CAPABILITY.2009 — superpowers
What it is: structured coding, planning, and execution workflow motion.
Connects to: exact Buccet target `superpowers`.
Action kinds: `tool.exec`, `fs.read`, `fs.write`, `fs.append`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.CURATED.CAPABILITY.2010 — systematic-debugging
What it is: root-cause debugging and fix-validation workflow motion.
Connects to: exact Buccet target `systematic-debugging`.
Action kinds: `tool.exec`, `fs.read`, `fs.write`, `fs.append`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.CURATED.CAPABILITY.2011 — file-search
What it is: bounded file search, symbol search, and content retrieval motion.
Connects to: exact Buccet target `file-search`.
Action kinds: `tool.exec`, `fs.read`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.CURATED.CAPABILITY.2012 — context-optimization
What it is: context shaping, summarization, and token-efficiency workflow motion.
Connects to: exact Buccet target `context-optimization`.
Action kinds: `tool.exec`, `fs.read`, `fs.write`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.CURATED.CAPABILITY.2013 — notebooklm-integration
What it is: notebook-backed study, synthesis, and source-grounded note workflow motion.
Connects to: exact Buccet target `notebooklm-integration`.
Action kinds: `network.send`, `fs.read`, `fs.write`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.CURATED.CAPABILITY.2014 — excel-mcp-server
What it is: spreadsheet manipulation and report workflow motion.
Connects to: exact Buccet target `excel-mcp-server`.
Action kinds: `tool.exec`, `fs.read`, `fs.write`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.CURATED.CAPABILITY.2015 — tavily
What it is: structured web search, extract, and crawl workflow motion.
Connects to: exact Buccet target `tavily`.
Action kinds: `network.send`, `fs.write`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.CURATED.CAPABILITY.2016 — context7
What it is: live library-documentation retrieval workflow motion.
Connects to: exact Buccet target `context7`.
Action kinds: `network.send`, `fs.write`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.CURATED.CAPABILITY.2017 — task-master-ai
What it is: project-task decomposition and dependency workflow motion.
Connects to: exact Buccet target `task-master-ai`.
Action kinds: `tool.exec`, `fs.read`, `fs.write`, `db.query`, `db.insert`, `db.update`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.CURATED.CAPABILITY.2018 — gpt-researcher
What it is: autonomous research compilation and report workflow motion.
Connects to: exact Buccet target `gpt-researcher`.
Action kinds: `network.send`, `fs.write`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.CURATED.CAPABILITY.2019 — codebase-memory-mcp
What it is: persistent codebase memory and knowledge-graph workflow motion.
Connects to: exact Buccet target `codebase-memory-mcp`.
Action kinds: `tool.exec`, `fs.read`, `fs.write`, `db.query`, `db.insert`, `db.update`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.CURATED.CAPABILITY.2020 — mcp-playwright
What it is: bounded browser automation and page-interaction workflow motion.
Connects to: exact Buccet target `mcp-playwright`.
Action kinds: `tool.exec`, `fs.read`, `fs.write`, `network.send`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.CURATED.CAPABILITY.2021 — markdownify-mcp
What it is: PDF, image, and audio to Markdown conversion workflow motion.
Connects to: exact Buccet target `markdownify-mcp`.
Action kinds: `tool.exec`, `fs.read`, `fs.write`, `fs.append`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.CURATED.CAPABILITY.2022 — brand-guidelines
What it is: brand-rule application and style-consistent output workflow motion.
Connects to: exact Buccet target `brand-guidelines`.
Action kinds: `chat.emit`, `fs.read`, `fs.write`, `fs.append`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.CURATED.CAPABILITY.2023 — claude-seo
What it is: SEO audit, schema, and site-content improvement workflow motion.
Connects to: exact Buccet target `claude-seo`.
Action kinds: `network.send`, `fs.read`, `fs.write`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.CURATED.CAPABILITY.2024 — pdf-processing
What it is: PDF reading, extraction, form, merge, and split workflow motion.
Connects to: exact Buccet target `pdf-processing`.
Action kinds: `tool.exec`, `fs.read`, `fs.write`, `fs.append`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.CURATED.CAPABILITY.2025 — algorithmic-art
What it is: generative p5.js, fractal, and geometric-art workflow motion.
Connects to: exact Buccet target `algorithmic-art`.
Action kinds: `tool.exec`, `fs.read`, `fs.write`, `fs.append`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.CURATED.CAPABILITY.2026 — remotion-best-practices
What it is: Remotion-driven video and motion-artifact workflow motion.
Connects to: exact Buccet target `remotion-best-practices`.
Action kinds: `tool.exec`, `fs.read`, `fs.write`, `fs.append`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.CURATED.CAPABILITY.2027 — marketing-skills
What it is: copy, CRO, email sequence, and growth workflow motion.
Connects to: exact Buccet target `marketing-skills`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `chat.emit`, `network.send`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.CURATED.CAPABILITY.2028 — obsidian-skills
What it is: vault-native note, auto-linking, and PKM workflow motion.
Connects to: exact Buccet target `obsidian-skills`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.move`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.CURATED.CAPABILITY.2029 — fastmcp
What it is: minimal MCP server design and implementation workflow motion.
Connects to: exact Buccet target `fastmcp`.
Action kinds: `tool.exec`, `fs.read`, `fs.write`, `fs.append`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.CURATED.CAPABILITY.2030 — mcphub
What it is: multi-MCP server management and connector routing workflow motion.
Connects to: exact Buccet target `mcphub`.
Action kinds: `tool.exec`, `network.send`, `fs.read`, `fs.write`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.CURATED.CAPABILITY.2031 — firecrawl
What it is: website crawling, extraction, and LLM-ready data workflow motion.
Connects to: exact Buccet target `firecrawl`.
Action kinds: `network.send`, `fs.write`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.CURATED.CAPABILITY.2032 — vanna-ai
What it is: natural-language SQL and database-analysis workflow motion.
Connects to: exact Buccet target `vanna-ai`.
Action kinds: `db.query`, `fs.read`, `fs.write`, `chat.emit`, `network.send`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.CURATED.CAPABILITY.2033 — dspy
What it is: structured model-programming and optimization workflow motion.
Connects to: exact Buccet target `dspy`.
Action kinds: `tool.exec`, `fs.read`, `fs.write`, `fs.append`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.CURATED.CAPABILITY.2034 — spec-kit
What it is: spec-driven development and implementation workflow motion.
Connects to: exact Buccet target `spec-kit`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.CURATED.CAPABILITY.2035 — copilotkit
What it is: embedded copilot and app-assistant workflow motion.
Connects to: exact Buccet target `copilotkit`.
Action kinds: `tool.exec`, `fs.read`, `fs.write`, `fs.append`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.CURATED.CAPABILITY.2036 — langflow
What it is: visual pipeline and drag-and-drop workflow builder motion.
Connects to: exact Buccet target `langflow`.
Action kinds: `tool.exec`, `fs.read`, `fs.write`, `fs.append`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.CURATED.CAPABILITY.2037 — extractthinker
What it is: document intelligence, extraction, and structured-field workflow motion.
Connects to: exact Buccet target `extractthinker`.
Action kinds: `tool.exec`, `fs.read`, `fs.write`, `fs.append`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.CURATED.CAPABILITY.2038 — ck
What it is: semantic code search and meaning-based retrieval workflow motion.
Connects to: exact Buccet target `ck`.
Action kinds: `tool.exec`, `fs.read`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.CURATED.CAPABILITY.2039 — rendergit
What it is: repo flattening and repo-to-single-file context workflow motion.
Connects to: exact Buccet target `rendergit`.
Action kinds: `tool.exec`, `fs.read`, `fs.write`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.CURATED.CAPABILITY.2040 — tdd-guard
What it is: test-first guardrails and TDD workflow motion.
Connects to: exact Buccet target `tdd-guard`.
Action kinds: `tool.exec`, `fs.read`, `fs.write`, `fs.append`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.CURATED.CAPABILITY.2041 — claude-deep-research-skill
What it is: long-form staged deep-research workflow motion.
Connects to: exact Buccet target `claude-deep-research-skill`.
Action kinds: `network.send`, `fs.write`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.CURATED.CAPABILITY.2042 — pydantic-ai
What it is: type-safe agent and structured-model workflow motion.
Connects to: exact Buccet target `pydantic-ai`.
Action kinds: `tool.exec`, `fs.read`, `fs.write`, `fs.append`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.CURATED.CAPABILITY.2043 — simonw-llm
What it is: lightweight local and remote LLM CLI workflow motion.
Connects to: exact Buccet target `simonw-llm`.
Action kinds: `tool.exec`, `fs.read`, `fs.write`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

## Curated Workflow Entries (23)

### ACCEPT.CURATED.WORKFLOW.2101 — docx-workflow
What it is: bounded workspace Word-document workflow motion.
Connects to: workspace files ending in `.docx`.
Action kinds: `fs.read`, `fs.write`, `fs.append`.
Bounds: listed bounded corridors only; deny still wins on overlap.

### ACCEPT.CURATED.WORKFLOW.2102 — pptx-workflow
What it is: bounded workspace slide-deck workflow motion.
Connects to: workspace files ending in `.pptx`.
Action kinds: `fs.read`, `fs.write`, `fs.append`.
Bounds: listed bounded corridors only; deny still wins on overlap.

### ACCEPT.CURATED.WORKFLOW.2103 — xlsx-workflow
What it is: bounded workspace spreadsheet and table workflow motion.
Connects to: workspace files ending in `.xlsx`, `.xls`, `.csv`, `.tsv`.
Action kinds: `fs.read`, `fs.write`, `fs.append`.
Bounds: listed bounded corridors only; deny still wins on overlap.

### ACCEPT.CURATED.WORKFLOW.2104 — doc-coauthoring-workflow
What it is: bounded collaborative drafting and revision workflow motion.
Connects to: workspace files ending in `.md`, `.txt`, `.docx`.
Action kinds: `chat.emit`, `fs.read`, `fs.write`, `fs.append`.
Bounds: listed bounded corridors only; deny still wins on overlap.

### ACCEPT.CURATED.WORKFLOW.2105 — frontend-design-workflow
What it is: bounded frontend design-system and UI artifact workflow motion.
Connects to: workspace files ending in `.html`, `.css`, `.scss`, `.js`, `.jsx`, `.ts`, `.tsx`, `.svg`, `.json`.
Action kinds: `fs.read`, `fs.write`, `fs.append`.
Bounds: listed bounded corridors only; deny still wins on overlap.

### ACCEPT.CURATED.WORKFLOW.2106 — canvas-design-workflow
What it is: bounded poster, social graphic, and visual export workflow motion.
Connects to: workspace files ending in `.png`, `.jpg`, `.jpeg`, `.webp`, `.svg`, `.pdf`.
Action kinds: `fs.read`, `fs.write`, `fs.append`.
Bounds: listed bounded corridors only; deny still wins on overlap.

### ACCEPT.CURATED.WORKFLOW.2107 — theme-factory-workflow
What it is: bounded theme and color-system file workflow motion.
Connects to: workspace files ending in `.css`, `.scss`, `.less`, `.json`, `.yaml`, `.yml`, `.toml`.
Action kinds: `fs.read`, `fs.write`, `fs.append`.
Bounds: listed bounded corridors only; deny still wins on overlap.

### ACCEPT.CURATED.WORKFLOW.2108 — web-artifacts-builder-workflow
What it is: bounded calculators, dashboards, and interactive artifact file workflow motion.
Connects to: workspace files ending in `.html`, `.css`, `.js`, `.ts`, `.tsx`, `.json`, `.md`.
Action kinds: `fs.read`, `fs.write`, `fs.append`.
Bounds: listed bounded corridors only; deny still wins on overlap.

### ACCEPT.CURATED.WORKFLOW.2109 — excel-mcp-workflow
What it is: bounded spreadsheet workbook and report workflow motion.
Connects to: workspace files ending in `.xlsx`, `.xls`, `.csv`, `.tsv`.
Action kinds: `fs.read`, `fs.write`, `fs.append`.
Bounds: listed bounded corridors only; deny still wins on overlap.

### ACCEPT.CURATED.WORKFLOW.2110 — tavily-workflow
What it is: bounded Tavily search, extract, and crawl provider motion.
Connects to: bounded host corridors `tavily.com`.
Action kinds: `network.send`.
Bounds: listed bounded corridors only; deny still wins on overlap.

### ACCEPT.CURATED.WORKFLOW.2111 — notebooklm-workflow
What it is: bounded NotebookLM study and synthesis provider motion.
Connects to: bounded host corridors `notebooklm.google.com`.
Action kinds: `network.send`.
Bounds: listed bounded corridors only; deny still wins on overlap.

### ACCEPT.CURATED.WORKFLOW.2112 — markdownify-workflow
What it is: bounded document, image, and audio conversion workflow motion.
Connects to: workspace files ending in `.pdf`, `.png`, `.jpg`, `.jpeg`, `.webp`, `.mp3`, `.wav`, `.m4a`, `.mp4`, `.mov`, `.mkv`, `.md`.
Action kinds: `fs.read`, `fs.write`, `fs.append`.
Bounds: listed bounded corridors only; deny still wins on overlap.

### ACCEPT.CURATED.WORKFLOW.2113 — brand-and-seo-workflow
What it is: bounded brand, copy, and site-content workflow motion.
Connects to: workspace files ending in `.md`, `.txt`, `.html`, `.xml`, `.json`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `chat.emit`.
Bounds: listed bounded corridors only; deny still wins on overlap.

### ACCEPT.CURATED.WORKFLOW.2114 — browser-artifact-workflow
What it is: bounded browser screenshot, page export, and trace artifact workflow motion.
Connects to: workspace files ending in `.png`, `.jpg`, `.jpeg`, `.webp`, `.pdf`, `.html`, `.json`.
Action kinds: `fs.read`, `fs.write`, `fs.append`.
Bounds: listed bounded corridors only; deny still wins on overlap.

### ACCEPT.CURATED.WORKFLOW.2115 — pdf-workflow
What it is: bounded workspace PDF extraction, merge, split, and form workflow motion.
Connects to: workspace files ending in `.pdf`, `.json`, `.csv`, `.md`.
Action kinds: `fs.read`, `fs.write`, `fs.append`.
Bounds: listed bounded corridors only; deny still wins on overlap.

### ACCEPT.CURATED.WORKFLOW.2116 — algorithmic-art-workflow
What it is: bounded generative-art and visual-code artifact workflow motion.
Connects to: workspace files ending in `.js`, `.ts`, `.jsx`, `.tsx`, `.html`, `.svg`, `.png`, `.json`.
Action kinds: `fs.read`, `fs.write`, `fs.append`.
Bounds: listed bounded corridors only; deny still wins on overlap.

### ACCEPT.CURATED.WORKFLOW.2117 — video-artifact-workflow
What it is: bounded video, motion, and render artifact workflow motion.
Connects to: workspace files ending in `.tsx`, `.ts`, `.js`, `.json`, `.mp4`, `.mov`, `.gif`, `.webm`.
Action kinds: `fs.read`, `fs.write`, `fs.append`.
Bounds: listed bounded corridors only; deny still wins on overlap.

### ACCEPT.CURATED.WORKFLOW.2118 — marketing-content-workflow
What it is: bounded campaign, brand, SEO, and content workflow motion.
Connects to: workspace files ending in `.md`, `.txt`, `.html`, `.csv`, `.json`, `.xml`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `chat.emit`.
Bounds: listed bounded corridors only; deny still wins on overlap.

### ACCEPT.CURATED.WORKFLOW.2119 — obsidian-vault-workflow
What it is: bounded vault, note-linking, and PKM workflow motion.
Connects to: workspace files ending in `.md`, `.canvas`, `.json`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.move`.
Bounds: listed bounded corridors only; deny still wins on overlap.

### ACCEPT.CURATED.WORKFLOW.2120 — firecrawl-workflow
What it is: bounded crawl, extract, and LLM-ready web data workflow motion.
Connects to: bounded host corridors `firecrawl.dev`.
Action kinds: `network.send`.
Bounds: listed bounded corridors only; deny still wins on overlap.

### ACCEPT.CURATED.WORKFLOW.2121 — data-query-workflow
What it is: bounded SQL, workbook, and analytics report workflow motion.
Connects to: workspace files ending in `.sql`, `.csv`, `.tsv`, `.xlsx`, `.xls`, `.json`, `.parquet`, `.md`.
Action kinds: `fs.read`, `fs.write`, `fs.append`.
Bounds: listed bounded corridors only; deny still wins on overlap.

### ACCEPT.CURATED.WORKFLOW.2122 — app-builder-workflow
What it is: bounded spec-driven app, copilot, and flow-builder workflow motion.
Connects to: workspace files ending in `.ts`, `.tsx`, `.js`, `.jsx`, `.json`, `.yaml`, `.yml`, `.md`.
Action kinds: `fs.read`, `fs.write`, `fs.append`.
Bounds: listed bounded corridors only; deny still wins on overlap.

### ACCEPT.CURATED.WORKFLOW.2123 — mcp-factory-workflow
What it is: bounded MCP server, hub, and connector factory workflow motion.
Connects to: workspace files ending in `.py`, `.ts`, `.js`, `.json`, `.yaml`, `.yml`, `.toml`, `.md`.
Action kinds: `fs.read`, `fs.write`, `fs.append`.
Bounds: listed bounded corridors only; deny still wins on overlap.

## SkillsMP Entries (47)

### ACCEPT.MARKETPLACE.SKILL.3001 — openclaw-pr-maintainer
What it is: pull-request triage, issue review, and maintainer workflow motion.
Connects to: exact Buccet target `openclaw-pr-maintainer`.
Action kinds: `network.send`, `fs.read`, `fs.write`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3002 — feishu-wiki
What it is: Feishu wiki navigation, retrieval, and note workflow motion.
Connects to: exact Buccet target `feishu-wiki`.
Action kinds: `network.send`, `db.query`, `fs.read`, `fs.write`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3003 — rules-distill
What it is: rule distillation and principle extraction workflow motion.
Connects to: exact Buccet target `rules-distill`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3004 — search-first
What it is: research-before-building workflow motion.
Connects to: exact Buccet target `search-first`.
Action kinds: `network.send`, `fs.read`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3005 — deep-research
What it is: multi-source research and cited synthesis workflow motion.
Connects to: exact Buccet target `deep-research`.
Action kinds: `network.send`, `fs.write`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3006 — python-expert
What it is: Python coding, debugging, and clean implementation workflow motion.
Connects to: exact Buccet target `python-expert`.
Action kinds: `tool.exec`, `fs.read`, `fs.write`, `fs.append`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3007 — technical-writer
What it is: technical documentation, references, and guide-writing workflow motion.
Connects to: exact Buccet target `technical-writer`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3008 — skill-writer
What it is: skill authoring and SKILL.md workflow motion.
Connects to: exact Buccet target `skill-writer`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3009 — project-overview
What it is: architecture reading and project-structure walkthrough motion.
Connects to: exact Buccet target `project-overview`.
Action kinds: `fs.read`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3010 — fact-check
What it is: technical fact-checking and accuracy review workflow motion.
Connects to: exact Buccet target `fact-check`.
Action kinds: `fs.read`, `network.send`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3011 — resource-curator
What it is: source curation and external resource review workflow motion.
Connects to: exact Buccet target `resource-curator`.
Action kinds: `network.send`, `fs.read`, `fs.write`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3012 — jupyter-notebook
What it is: notebook creation, editing, and experiment workflow motion.
Connects to: exact Buccet target `jupyter-notebook`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `tool.exec`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3013 — file-organizer
What it is: bounded file cleanup and organization workflow motion.
Connects to: exact Buccet target `file-organizer`.
Action kinds: `fs.read`, `fs.write`, `fs.mkdir`, `fs.move`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3014 — docs-write
What it is: documentation drafting and style-consistent edit workflow motion.
Connects to: exact Buccet target `docs-write`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3015 — write-release-notes
What it is: release-note drafting and release-summary workflow motion.
Connects to: exact Buccet target `write-release-notes`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3016 — ai-context
What it is: AI context file maintenance and prompt-surface update workflow motion.
Connects to: exact Buccet target `ai-context`.
Action kinds: `fs.read`, `fs.write`, `fs.append`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3017 — packages
What it is: package discovery and dependency-surface exploration workflow motion.
Connects to: exact Buccet target `packages`.
Action kinds: `fs.read`, `network.send`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3018 — sharing-pr-agent-artifacts
What it is: PR artifact preparation and share-out workflow motion.
Connects to: exact Buccet target `sharing-pr-agent-artifacts`.
Action kinds: `fs.read`, `fs.write`, `chat.emit`, `network.send`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3019 — updating-internal-docs
What it is: internal-document review and correction workflow motion.
Connects to: exact Buccet target `updating-internal-docs`.
Action kinds: `fs.read`, `fs.write`, `fs.append`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3020 — parallel-debugging
What it is: parallel hypothesis debugging and root-cause workflow motion.
Connects to: exact Buccet target `parallel-debugging`.
Action kinds: `tool.exec`, `fs.read`, `fs.write`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3021 — debugging-strategies
What it is: systematic debugging and fix-validation workflow motion.
Connects to: exact Buccet target `debugging-strategies`.
Action kinds: `tool.exec`, `fs.read`, `fs.write`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3022 — architecture-decision-records
What it is: ADR drafting and technical-decision workflow motion.
Connects to: exact Buccet target `architecture-decision-records`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3043 — data-analyst
What it is: dataset analysis, SQL, and statistical insight workflow motion.
Connects to: exact Buccet target `data-analyst`.
Action kinds: `fs.read`, `fs.write`, `tool.exec`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3044 — visualization-expert
What it is: chart, dashboard, and data-visualization workflow motion.
Connects to: exact Buccet target `visualization-expert`.
Action kinds: `fs.read`, `fs.write`, `tool.exec`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3045 — excel-analysis
What it is: Excel analysis, pivot, chart, and spreadsheet workflow motion.
Connects to: exact Buccet target `excel-analysis`.
Action kinds: `fs.read`, `fs.write`, `tool.exec`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3046 — google-analytics
What it is: analytics review and website-metrics workflow motion.
Connects to: exact Buccet target `google-analytics`.
Action kinds: `network.send`, `fs.write`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3047 — market-research-reports
What it is: market-research reporting and strategy workflow motion.
Connects to: exact Buccet target `market-research-reports`.
Action kinds: `network.send`, `fs.read`, `fs.write`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3048 — scientific-schematics
What it is: scientific diagram and schematic generation workflow motion.
Connects to: exact Buccet target `scientific-schematics`.
Action kinds: `fs.read`, `fs.write`, `tool.exec`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3049 — mermaid
What it is: Mermaid diagram and flowchart workflow motion.
Connects to: exact Buccet target `mermaid`.
Action kinds: `fs.read`, `fs.write`, `tool.exec`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3050 — data-analyzer
What it is: data pattern analysis and trend workflow motion.
Connects to: exact Buccet target `data-analyzer`.
Action kinds: `fs.read`, `fs.write`, `tool.exec`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3051 — report-writer
What it is: professional report writing and synthesis workflow motion.
Connects to: exact Buccet target `report-writer`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3052 — exploratory-data-analysis
What it is: exploratory data analysis and data-quality workflow motion.
Connects to: exact Buccet target `exploratory-data-analysis`.
Action kinds: `fs.read`, `fs.write`, `tool.exec`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3053 — fullstack-developer
What it is: full-stack build, API, and application workflow motion.
Connects to: exact Buccet target `fullstack-developer`.
Action kinds: `tool.exec`, `fs.read`, `fs.write`, `fs.append`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3054 — api-design
What it is: REST API design and interface workflow motion.
Connects to: exact Buccet target `api-design`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3064 — browser-automation
What it is: bounded browser navigation, form interaction, and screenshot workflow motion.
Connects to: exact Buccet target `browser-automation`.
Action kinds: `tool.exec`, `network.send`, `fs.read`, `fs.write`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3065 — playwright-automation-expert
What it is: Playwright testing, UI verification, and flaky-browser debug workflow motion.
Connects to: exact Buccet target `playwright-automation-expert`.
Action kinds: `tool.exec`, `fs.read`, `fs.write`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3066 — google-workspace
What it is: Gmail, Drive, Docs, and Sheets workflow motion.
Connects to: exact Buccet target `google-workspace`.
Action kinds: `network.send`, `fs.read`, `fs.write`, `db.query`, `db.insert`, `db.update`, `comm.send`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3067 — google-workspace-cli
What it is: gws-based Google Workspace CLI workflow motion across mail, calendar, drive, docs, and sheets.
Connects to: exact Buccet target `google-workspace-cli`.
Action kinds: `tool.exec`, `network.send`, `fs.read`, `fs.write`, `db.query`, `db.insert`, `db.update`, `comm.send`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3068 — gws
What it is: direct gws Google Workspace command workflow motion.
Connects to: exact Buccet target `gws`.
Action kinds: `tool.exec`, `network.send`, `fs.read`, `fs.write`, `db.query`, `db.insert`, `db.update`, `comm.send`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3069 — googlesheets-automation
What it is: Google Sheets read, write, formatting, and reporting workflow motion.
Connects to: exact Buccet target `googlesheets-automation`.
Action kinds: `network.send`, `fs.read`, `fs.write`, `db.query`, `db.insert`, `db.update`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3070 — email
What it is: email digest, search, draft, and reply workflow motion.
Connects to: exact Buccet target `email`.
Action kinds: `network.send`, `comm.send`, `fs.read`, `fs.write`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3084 — gws-workspace
What it is: Google Workspace docs, drive, calendar, gmail, and slides workflow motion.
Connects to: exact Buccet target `gws-workspace`.
Action kinds: `tool.exec`, `network.send`, `fs.read`, `fs.write`, `db.query`, `db.insert`, `db.update`, `comm.send`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3085 — google-gogcli
What it is: gogcli-based Google account workflow motion across mail, tasks, sheets, docs, and calendar.
Connects to: exact Buccet target `google-gogcli`.
Action kinds: `tool.exec`, `network.send`, `fs.read`, `fs.write`, `db.query`, `db.insert`, `db.update`, `comm.send`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3086 — playwright-parallel-tab-manager
What it is: concurrent browser-context and multi-tab automation workflow motion.
Connects to: exact Buccet target `playwright-parallel-tab-manager`.
Action kinds: `tool.exec`, `fs.read`, `fs.write`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3087 — n8n-workflow-automation
What it is: auditable n8n workflow design and workflow-json generation motion.
Connects to: exact Buccet target `n8n-workflow-automation`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `tool.exec`, `chat.emit`, `network.send`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3088 — n8n
What it is: n8n workflow management, execution review, and automation status workflow motion.
Connects to: exact Buccet target `n8n`.
Action kinds: `network.send`, `tool.exec`, `fs.read`, `fs.write`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3089 — n8n-expert
What it is: advanced n8n creation, debugging, and optimization workflow motion.
Connects to: exact Buccet target `n8n-expert`.
Action kinds: `network.send`, `tool.exec`, `fs.read`, `fs.write`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

## SkillHub Entries (29)

### ACCEPT.MARKETPLACE.SKILL.3023 — ai-content-pipeline
What it is: content-pipeline drafting, editing, and publish-prep workflow motion.
Connects to: exact Buccet target `ai-content-pipeline`.
Action kinds: `fs.read`, `fs.write`, `chat.emit`, `network.send`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3024 — metabase-docs-review
What it is: documentation review and doc-quality workflow motion.
Connects to: exact Buccet target `metabase-docs-review`.
Action kinds: `fs.read`, `fs.write`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3025 — azure-prepare
What it is: Azure setup guidance and readiness workflow motion.
Connects to: exact Buccet target `azure-prepare`.
Action kinds: `network.send`, `fs.read`, `fs.write`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3026 — agentic-qe-test-data-management
What it is: QE test-data preparation and validation workflow motion.
Connects to: exact Buccet target `agentic-qe-test-data-management`.
Action kinds: `tool.exec`, `fs.read`, `fs.write`, `db.query`, `db.insert`, `db.update`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3027 — create-ex
What it is: worked-example generation and explanation workflow motion.
Connects to: exact Buccet target `create-ex`.
Action kinds: `fs.read`, `fs.write`, `tool.exec`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3028 — academic-research-suite
What it is: academic research, synthesis, and study workflow motion.
Connects to: exact Buccet target `academic-research-suite`.
Action kinds: `network.send`, `fs.write`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3029 — ai-video-ad-generator
What it is: ad-script, creative, and video-generation workflow motion.
Connects to: exact Buccet target `ai-video-ad-generator`.
Action kinds: `fs.read`, `fs.write`, `tool.exec`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3030 — niw-petition
What it is: petition drafting and evidence-pack workflow motion.
Connects to: exact Buccet target `niw-petition`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3031 — oss-investment-scorecard
What it is: open-source scorecard analysis and reporting workflow motion.
Connects to: exact Buccet target `oss-investment-scorecard`.
Action kinds: `fs.read`, `fs.write`, `chat.emit`, `network.send`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3032 — resciencelab-solopreneur-pack
What it is: solo-operator planning, content, and execution workflow motion.
Connects to: exact Buccet target `resciencelab-solopreneur-pack`.
Action kinds: `fs.read`, `fs.write`, `chat.emit`, `db.query`, `db.insert`, `db.update`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3033 — the-startup-ceo-stack
What it is: startup planning, memo, and decision workflow motion.
Connects to: exact Buccet target `the-startup-ceo-stack`.
Action kinds: `fs.read`, `fs.write`, `chat.emit`, `db.query`, `db.insert`, `db.update`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3055 — moai-workflow-jit-docs
What it is: just-in-time documentation loading and source-grounding workflow motion.
Connects to: exact Buccet target `moai-workflow-jit-docs`.
Action kinds: `network.send`, `fs.read`, `fs.write`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3056 — ui-ux-pro-max
What it is: UI and UX design-system workflow motion.
Connects to: exact Buccet target `ui-ux-pro-max`.
Action kinds: `fs.read`, `fs.write`, `tool.exec`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3057 — workflow-orchestrator
What it is: project workflow orchestration and session-structure workflow motion.
Connects to: exact Buccet target `workflow-orchestrator`.
Action kinds: `fs.read`, `fs.write`, `db.query`, `db.insert`, `db.update`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3058 — claude-api
What it is: Claude API integration and application workflow motion.
Connects to: exact Buccet target `claude-api`.
Action kinds: `fs.read`, `fs.write`, `tool.exec`, `network.send`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3059 — testing-core
What it is: unit, integration, and end-to-end testing workflow motion.
Connects to: exact Buccet target `testing-core`.
Action kinds: `tool.exec`, `fs.read`, `fs.write`, `fs.append`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3060 — testing-basics
What it is: baseline testing patterns and testing-setup workflow motion.
Connects to: exact Buccet target `testing-basics`.
Action kinds: `tool.exec`, `fs.read`, `fs.write`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3061 — test-writer
What it is: test-file generation and fixture workflow motion.
Connects to: exact Buccet target `test-writer`.
Action kinds: `tool.exec`, `fs.read`, `fs.write`, `fs.append`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3062 — discover-testing
What it is: testing-skill discovery and testing workflow routing motion.
Connects to: exact Buccet target `discover-testing`.
Action kinds: `fs.read`, `chat.emit`, `tool.exec`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3063 — test-data-management
What it is: synthetic test-data preparation and privacy-safe QA workflow motion.
Connects to: exact Buccet target `test-data-management`.
Action kinds: `tool.exec`, `fs.read`, `fs.write`, `db.insert`, `db.update`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3071 — mcp-builder
What it is: MCP server design, implementation, and evaluation workflow motion.
Connects to: exact Buccet target `mcp-builder`.
Action kinds: `tool.exec`, `fs.read`, `fs.write`, `fs.append`, `network.send`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3072 — agent-browser
What it is: agentic browser navigation, form interaction, screenshot, and data-extraction workflow motion.
Connects to: exact Buccet target `agent-browser`.
Action kinds: `tool.exec`, `network.send`, `fs.read`, `fs.write`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3073 — playwright-browser
What it is: Playwright browser automation, UI checks, and responsive-test workflow motion.
Connects to: exact Buccet target `playwright-browser`.
Action kinds: `tool.exec`, `network.send`, `fs.read`, `fs.write`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3074 — web-browser
What it is: Chrome or Chromium remote-control browsing workflow motion.
Connects to: exact Buccet target `web-browser`.
Action kinds: `tool.exec`, `network.send`, `fs.read`, `fs.write`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3075 — dev-browser
What it is: browser-backed research, testing, and web-app interaction workflow motion.
Connects to: exact Buccet target `dev-browser`.
Action kinds: `tool.exec`, `network.send`, `fs.read`, `fs.write`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3076 — chrome-devtools
What it is: browser debugging, performance analysis, and screenshot workflow motion.
Connects to: exact Buccet target `chrome-devtools`.
Action kinds: `tool.exec`, `network.send`, `fs.read`, `fs.write`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3077 — browsing-with-playwright
What it is: Playwright MCP browsing, extraction, and page-interaction workflow motion.
Connects to: exact Buccet target `browsing-with-playwright`.
Action kinds: `tool.exec`, `network.send`, `fs.read`, `fs.write`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3090 — n8n-automation
What it is: n8n orchestration, workflow templates, and automation-integration workflow motion.
Connects to: exact Buccet target `n8n-automation`.
Action kinds: `network.send`, `tool.exec`, `fs.read`, `fs.write`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3091 — playwright-mcp
What it is: Playwright MCP browser testing, responsive checks, and accessibility workflow motion.
Connects to: exact Buccet target `playwright-mcp`.
Action kinds: `tool.exec`, `network.send`, `fs.read`, `fs.write`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

## AITmpl Entries (6)

### ACCEPT.MARKETPLACE.SKILL.3034 — webapp-testing
What it is: webapp testing and app-quality workflow motion.
Connects to: exact Buccet target `webapp-testing`.
Action kinds: `tool.exec`, `fs.read`, `fs.write`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3035 — design-mirror
What it is: design mirroring and visual comparison workflow motion.
Connects to: exact Buccet target `design-mirror`.
Action kinds: `fs.read`, `fs.write`, `chat.emit`, `tool.exec`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3036 — cf-crawl
What it is: crawl-and-collect web workflow motion.
Connects to: exact Buccet target `cf-crawl`.
Action kinds: `network.send`, `fs.write`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3037 — deslop
What it is: output cleanup and anti-slop rewrite workflow motion.
Connects to: exact Buccet target `deslop`.
Action kinds: `fs.read`, `fs.write`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3078 — mcp-builder-template
What it is: MCP scaffold, template, and integration workflow motion.
Connects to: exact Buccet target `mcp-builder-template`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `tool.exec`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3079 — email-composer
What it is: email drafting, editing, and outbound composition workflow motion.
Connects to: exact Buccet target `email-composer`.
Action kinds: `fs.read`, `fs.write`, `chat.emit`, `comm.send`.
Bounds: exact named target only; deny still wins on overlap.

## AgentSkills Entries (9)

### ACCEPT.MARKETPLACE.SKILL.3038 — agent-skills-quickstart
What it is: agent-skill quickstart and scaffold workflow motion.
Connects to: exact Buccet target `agent-skills-quickstart`.
Action kinds: `fs.read`, `fs.write`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3039 — agent-skills-best-practices
What it is: agent-skill best-practice and quality workflow motion.
Connects to: exact Buccet target `agent-skills-best-practices`.
Action kinds: `fs.read`, `fs.write`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3040 — agent-skills-evaluation
What it is: agent-skill evaluation and review workflow motion.
Connects to: exact Buccet target `agent-skills-evaluation`.
Action kinds: `fs.read`, `fs.write`, `tool.exec`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3041 — agent-skills-description-optimization
What it is: skill description tuning and wording workflow motion.
Connects to: exact Buccet target `agent-skills-description-optimization`.
Action kinds: `fs.read`, `fs.write`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3042 — agent-skills-scripts
What it is: skill-script use and helper-script workflow motion.
Connects to: exact Buccet target `agent-skills-scripts`.
Action kinds: `fs.read`, `fs.write`, `tool.exec`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3080 — agent-skills-specification
What it is: agent-skill specification and portable-skill structure workflow motion.
Connects to: exact Buccet target `agent-skills-specification`.
Action kinds: `fs.read`, `fs.write`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3081 — agent-skills-progressive-disclosure
What it is: progressive-disclosure skill design and context-shaping workflow motion.
Connects to: exact Buccet target `agent-skills-progressive-disclosure`.
Action kinds: `fs.read`, `fs.write`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3082 — agent-skills-assets-resources
What it is: skill assets, references, and resource-layout workflow motion.
Connects to: exact Buccet target `agent-skills-assets-resources`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

### ACCEPT.MARKETPLACE.SKILL.3083 — agent-skills-validation
What it is: skill validation and structure-check workflow motion.
Connects to: exact Buccet target `agent-skills-validation`.
Action kinds: `tool.exec`, `fs.read`, `fs.write`, `chat.emit`.
Bounds: exact named target only; deny still wins on overlap.

## Important Limits

- The base acceptance pack does not create a broad shell entry.
- The base acceptance pack does not create a broad outbound network entry.
- The base acceptance pack does not open delete.
- The base acceptance pack does not open secret roots.
- The base acceptance pack does not override the denial constitution.

At runtime, these entries enter the same live UPL field as denial walls. If an acceptance entry overlaps a denial wall, deny wins.
