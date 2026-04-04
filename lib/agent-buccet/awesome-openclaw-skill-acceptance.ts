import type { BoundaryActionKind } from "./types.ts";
import type { OpenClawSkillAcceptanceLane } from "./openclaw-skill-acceptance.ts";

type TargetMatchMode = "prefix" | "exact" | "regex";

function namedLane(args: {
  id: string;
  skill: string;
  summary: string;
  actionKinds: BoundaryActionKind[];
  requestTextPatterns?: string[];
  seedInBasePack?: boolean;
}): OpenClawSkillAcceptanceLane {
  return {
    id: args.id,
    skill: args.skill,
    summary: args.summary,
    actionKinds: args.actionKinds,
    targetPattern: args.skill,
    targetMatchMode: "exact",
    requestTextPatterns: args.requestTextPatterns ?? [args.skill],
    seedInBasePack: args.seedInBasePack,
  };
}

function regexLane(args: {
  id: string;
  skill: string;
  summary: string;
  actionKinds: BoundaryActionKind[];
  targetPatterns: string[];
  requestTextPatterns?: string[];
  seedInBasePack?: boolean;
}): OpenClawSkillAcceptanceLane {
  return {
    id: args.id,
    skill: args.skill,
    summary: args.summary,
    actionKinds: args.actionKinds,
    targetPatterns: args.targetPatterns,
    targetMatchMode: "regex" satisfies TargetMatchMode,
    requestTextPatterns: args.requestTextPatterns ?? [args.skill],
    seedInBasePack: args.seedInBasePack,
  };
}

export const AWESOME_OPENCLAW_SKILL_ACCEPTANCE_LANES: readonly OpenClawSkillAcceptanceLane[] = [
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1054",
    skill: "agent-mail",
    summary: "named rail for AI inbox read, draft, and delivery motion",
    actionKinds: ["comm.send", "fs.read", "fs.write"],
    requestTextPatterns: ["agent-mail", "mail", "email", "draft", "reply"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1055",
    skill: "agent-mail-cli",
    summary: "named rail for CLI-backed agent inbox read, draft, and delivery motion",
    actionKinds: ["comm.send", "fs.read", "fs.write"],
    requestTextPatterns: ["agent-mail-cli", "mail", "email", "draft", "reply"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1056",
    skill: "apple-mail-search-safe",
    summary: "named rail for safe Apple Mail lookup and body search motion",
    actionKinds: ["db.query", "fs.read"],
    requestTextPatterns: ["apple-mail-search-safe", "apple mail", "mail search", "inbox"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1057",
    skill: "beeper",
    summary: "named rail for Beeper history search and browse motion",
    actionKinds: ["db.query", "fs.read"],
    requestTextPatterns: ["beeper", "chat history", "message history", "browse"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1058",
    skill: "rocketchat",
    summary: "named rail for Rocket.Chat channel delivery motion",
    actionKinds: ["chat.emit", "comm.send"],
    requestTextPatterns: ["rocketchat", "rocket.chat", "channel", "message"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1059",
    skill: "sixel-email",
    summary: "named rail for bounded one-to-one email delivery motion",
    actionKinds: ["comm.send", "fs.read", "fs.write"],
    requestTextPatterns: ["sixel-email", "email", "send", "reply"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1060",
    skill: "apple-calendar",
    summary: "named rail for Apple Calendar query and event update motion",
    actionKinds: ["db.query", "db.insert", "db.update"],
    requestTextPatterns: ["apple-calendar", "calendar", "event", "schedule"],
  }),
  regexLane({
    id: "ACCEPT.OPENCLAW.SKILL.1061",
    skill: "google-calendar",
    summary: "bounded rail for Google Calendar query and event update motion",
    actionKinds: ["network.send", "db.query", "db.insert", "db.update"],
    targetPatterns: [
      "/^(?:https?:\\/\\/)?calendar\\.googleapis\\.com(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?www\\.googleapis\\.com(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?calendar\\.google\\.com(?:\\/|$)/i",
    ],
    requestTextPatterns: ["google-calendar", "calendar", "event", "schedule"],
  }),
  regexLane({
    id: "ACCEPT.OPENCLAW.SKILL.1062",
    skill: "gcal-pro",
    summary: "bounded rail for Google Calendar CLI scheduling motion",
    actionKinds: ["network.send", "db.query", "db.insert", "db.update"],
    targetPatterns: [
      "/^(?:https?:\\/\\/)?calendar\\.googleapis\\.com(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?www\\.googleapis\\.com(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?calendar\\.google\\.com(?:\\/|$)/i",
    ],
    requestTextPatterns: ["gcal-pro", "google calendar", "calendar", "event"],
  }),
  regexLane({
    id: "ACCEPT.OPENCLAW.SKILL.1063",
    skill: "ms-todo-oauth",
    summary: "bounded rail for Microsoft To Do task query and update motion",
    actionKinds: ["network.send", "db.query", "db.insert", "db.update"],
    targetPatterns: [
      "/^(?:https?:\\/\\/)?graph\\.microsoft\\.com(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?login\\.microsoftonline\\.com(?:\\/|$)/i",
    ],
    requestTextPatterns: ["ms-todo-oauth", "microsoft todo", "todo", "task"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1064",
    skill: "task-sync",
    summary: "named rail for task synchronization and mirrored task updates",
    actionKinds: ["tool.exec", "db.query", "db.insert", "db.update"],
    requestTextPatterns: ["task-sync", "sync", "task", "ticktick", "google tasks"],
  }),
  regexLane({
    id: "ACCEPT.OPENCLAW.SKILL.1065",
    skill: "asana",
    summary: "bounded rail for Asana project and task workflow motion",
    actionKinds: ["network.send", "db.query", "db.insert", "db.update"],
    targetPatterns: [
      "/^(?:https?:\\/\\/)?app\\.asana\\.com(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?api\\.asana\\.com(?:\\/|$)/i",
    ],
    requestTextPatterns: ["asana", "project", "task", "workspace"],
  }),
  regexLane({
    id: "ACCEPT.OPENCLAW.SKILL.1066",
    skill: "atlassian-mcp",
    summary: "bounded rail for Atlassian task, issue, and page workflow motion",
    actionKinds: ["network.send", "db.query", "db.insert", "db.update"],
    targetPatterns: [
      "/^(?:https?:\\/\\/)?api\\.atlassian\\.com(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?[^/]+\\.atlassian\\.net(?:\\/|$)/i",
    ],
    requestTextPatterns: ["atlassian-mcp", "atlassian", "jira", "confluence", "task"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1067",
    skill: "notes-reminders",
    summary: "named rail for quick notes and reminder update motion",
    actionKinds: ["fs.read", "fs.write", "db.insert", "db.update"],
    requestTextPatterns: ["notes-reminders", "note", "reminder", "todo"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1068",
    skill: "apple-contacts",
    summary: "named rail for Apple Contacts lookup motion",
    actionKinds: ["db.query"],
    requestTextPatterns: ["apple-contacts", "contacts", "contact lookup"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1069",
    skill: "drafts",
    summary: "named rail for Drafts note read and update motion",
    actionKinds: ["fs.read", "fs.write", "db.query", "db.insert", "db.update"],
    requestTextPatterns: ["drafts", "note", "draft", "capture"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1070",
    skill: "craft",
    summary: "named rail for Craft note and document motion",
    actionKinds: ["fs.read", "fs.write", "db.query", "db.insert", "db.update"],
    requestTextPatterns: ["craft", "document", "note", "workspace"],
  }),
  regexLane({
    id: "ACCEPT.OPENCLAW.SKILL.1071",
    skill: "craft-do",
    summary: "bounded rail for Craft.do document and workspace motion",
    actionKinds: ["network.send", "db.query", "db.insert", "db.update"],
    targetPatterns: [
      "/^(?:https?:\\/\\/)?(?:api\\.)?craft\\.do(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?(?:www\\.)?craft\\.do(?:\\/|$)/i",
    ],
    requestTextPatterns: ["craft-do", "craft", "document", "workspace"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1072",
    skill: "bookstack",
    summary: "named rail for BookStack wiki and documentation workflow motion",
    actionKinds: ["network.send", "db.query", "db.insert", "db.update"],
    requestTextPatterns: ["bookstack", "wiki", "page", "docs"],
  }),
  regexLane({
    id: "ACCEPT.OPENCLAW.SKILL.1073",
    skill: "better-notion",
    summary: "bounded rail for richer Notion page and database motion",
    actionKinds: ["network.send", "db.query", "db.insert", "db.update", "fs.write"],
    targetPatterns: [
      "/^(?:https?:\\/\\/)?(?:www\\.)?notion\\.so(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?api\\.notion\\.com(?:\\/|$)/i",
      "/^better-notion$/i",
    ],
    requestTextPatterns: ["better-notion", "notion", "page", "database", "workspace"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1074",
    skill: "google-keep",
    summary: "named rail for Google Keep note and list workflow motion",
    actionKinds: ["db.query", "db.insert", "db.update"],
    requestTextPatterns: ["google-keep", "keep", "note", "list"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1075",
    skill: "joplin-api",
    summary: "named rail for Joplin note and notebook workflow motion",
    actionKinds: ["network.send", "db.query", "db.insert", "db.update"],
    requestTextPatterns: ["joplin-api", "joplin", "notebook", "note"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1076",
    skill: "book-reader",
    summary: "named rail for local book and document reading motion",
    actionKinds: ["fs.read", "tool.exec"],
    requestTextPatterns: ["book-reader", "book", "epub", "pdf", "txt"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1077",
    skill: "archive-daily-note",
    summary: "named rail for Obsidian daily note archive motion",
    actionKinds: ["fs.read", "fs.write", "fs.move"],
    requestTextPatterns: ["archive-daily-note", "obsidian", "daily note", "archive"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1078",
    skill: "office-document-editor",
    summary: "named rail for tracked-change office document editing motion",
    actionKinds: ["fs.read", "fs.write", "fs.append", "tool.exec"],
    requestTextPatterns: ["office-document-editor", "docx", "pptx", "tracked changes", "edit"],
  }),
  regexLane({
    id: "ACCEPT.OPENCLAW.SKILL.1079",
    skill: "academic-deep-research",
    summary: "bounded rail for academic-source retrieval and research note output",
    actionKinds: ["network.send", "fs.write", "chat.emit"],
    targetPatterns: [
      "/^(?:https?:\\/\\/)?(?:[^/]+\\.)?arxiv\\.org(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?export\\.arxiv\\.org(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?api\\.semanticscholar\\.org(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?api\\.crossref\\.org(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?api\\.openalex\\.org(?:\\/|$)/i",
    ],
    requestTextPatterns: ["academic-deep-research", "academic", "paper", "research", "literature"],
  }),
  regexLane({
    id: "ACCEPT.OPENCLAW.SKILL.1080",
    skill: "agent-deep-research",
    summary: "bounded rail for deep research retrieval and synthesis motion",
    actionKinds: ["network.send", "fs.write", "chat.emit"],
    targetPatterns: [
      "/^(?:https?:\\/\\/)?(?:[^/]+\\.)?arxiv\\.org(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?export\\.arxiv\\.org(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?api\\.semanticscholar\\.org(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?api\\.crossref\\.org(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?api\\.openalex\\.org(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?generativelanguage\\.googleapis\\.com(?:\\/|$)/i",
    ],
    requestTextPatterns: ["agent-deep-research", "deep research", "paper", "research"],
  }),
  regexLane({
    id: "ACCEPT.OPENCLAW.SKILL.1081",
    skill: "agentic-paper-digest",
    summary: "bounded rail for paper digest retrieval and summary motion",
    actionKinds: ["network.send", "fs.write", "chat.emit"],
    targetPatterns: [
      "/^(?:https?:\\/\\/)?(?:[^/]+\\.)?arxiv\\.org(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?export\\.arxiv\\.org(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?(?:[^/]+\\.)?huggingface\\.co(?:\\/|$)/i",
    ],
    requestTextPatterns: ["agentic-paper-digest", "paper digest", "paper", "summary"],
  }),
  regexLane({
    id: "ACCEPT.OPENCLAW.SKILL.1082",
    skill: "arxiv-search-collector",
    summary: "bounded rail for arXiv retrieval and citation-set building motion",
    actionKinds: ["network.send", "fs.write"],
    targetPatterns: [
      "/^(?:https?:\\/\\/)?(?:[^/]+\\.)?arxiv\\.org(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?export\\.arxiv\\.org(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?api\\.crossref\\.org(?:\\/|$)/i",
    ],
    requestTextPatterns: ["arxiv-search-collector", "arxiv", "paper", "citation"],
  }),
  regexLane({
    id: "ACCEPT.OPENCLAW.SKILL.1083",
    skill: "openclaw-free-web-search",
    summary: "bounded rail for search and retrieval provider motion",
    actionKinds: ["network.send", "fs.write", "chat.emit"],
    targetPatterns: [
      "/^(?:https?:\\/\\/)?(?:[^/]+\\.)?duckduckgo\\.com(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?(?:[^/]+\\.)?search\\.brave\\.com(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?(?:[^/]+\\.)?exa\\.ai(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?(?:[^/]+\\.)?firecrawl\\.dev(?:\\/|$)/i",
    ],
    requestTextPatterns: ["openclaw-free-web-search", "web search", "search", "research", "lookup"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1084",
    skill: "feed-to-md",
    summary: "named rail for RSS and Atom retrieval into Markdown output motion",
    actionKinds: ["tool.exec", "network.send", "fs.write"],
    requestTextPatterns: ["feed-to-md", "rss", "atom", "feed", "markdown"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1085",
    skill: "ffcli",
    summary: "named rail for Fireflies meeting retrieval and note output motion",
    actionKinds: ["network.send", "db.query", "fs.write"],
    requestTextPatterns: ["ffcli", "fireflies", "meeting", "transcript", "summary"],
  }),
  regexLane({
    id: "ACCEPT.OPENCLAW.SKILL.1086",
    skill: "deepwiki",
    summary: "bounded rail for DeepWiki and GitHub documentation retrieval motion",
    actionKinds: ["network.send", "fs.read", "fs.write"],
    targetPatterns: [
      "/^(?:https?:\\/\\/)?(?:[^/]+\\.)?deepwiki\\.com(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?(?:[^/]+\\.)?github\\.com(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?(?:[^/]+\\.)?api\\.github\\.com(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?(?:[^/]+\\.)?raw\\.githubusercontent\\.com(?:\\/|$)/i",
    ],
    requestTextPatterns: ["deepwiki", "wiki", "docs", "github"],
  }),
  regexLane({
    id: "ACCEPT.OPENCLAW.SKILL.1087",
    skill: "gh-extract",
    summary: "bounded rail for GitHub content extraction motion",
    actionKinds: ["network.send", "fs.read", "fs.write"],
    targetPatterns: [
      "/^(?:https?:\\/\\/)?(?:[^/]+\\.)?github\\.com(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?(?:[^/]+\\.)?api\\.github\\.com(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?(?:[^/]+\\.)?raw\\.githubusercontent\\.com(?:\\/|$)/i",
    ],
    requestTextPatterns: ["gh-extract", "github", "extract", "repo"],
  }),
  regexLane({
    id: "ACCEPT.OPENCLAW.SKILL.1088",
    skill: "intomd",
    summary: "bounded rail for documentation-to-Markdown retrieval motion",
    actionKinds: ["network.send", "fs.write"],
    targetPatterns: [
      "/^(?:https?:\\/\\/)?(?:[^/]+\\.)?into\\.md(?:\\/|$)/i",
    ],
    requestTextPatterns: ["intomd", "markdown", "docs", "convert"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1089",
    skill: "markdown-converter",
    summary: "named rail for document-to-Markdown conversion motion",
    actionKinds: ["fs.read", "fs.write", "tool.exec"],
    requestTextPatterns: ["markdown-converter", "markdown", "convert", "document"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1090",
    skill: "truthcheck",
    summary: "named rail for claim verification and fact-check workflow motion",
    actionKinds: ["network.send", "chat.emit"],
    requestTextPatterns: ["truthcheck", "fact check", "verify", "claim"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1091",
    skill: "image-ocr",
    summary: "named rail for OCR extraction from local image inputs",
    actionKinds: ["fs.read", "fs.write", "tool.exec"],
    requestTextPatterns: ["image-ocr", "ocr", "extract text", "image"],
  }),
  regexLane({
    id: "ACCEPT.OPENCLAW.SKILL.1092",
    skill: "links-to-pdfs",
    summary: "bounded rail for document scraping and PDF retrieval motion",
    actionKinds: ["network.send", "fs.write"],
    targetPatterns: [
      "/^(?:https?:\\/\\/)?(?:[^/]+\\.)?notion\\.so(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?(?:[^/]+\\.)?docsend\\.com(?:\\/|$)/i",
      "/\\.pdf(?:$|[?#])/i",
    ],
    requestTextPatterns: ["links-to-pdfs", "pdf", "docsend", "document"],
  }),
  regexLane({
    id: "ACCEPT.OPENCLAW.SKILL.1093",
    skill: "confluence",
    summary: "bounded rail for Confluence page and space workflow motion",
    actionKinds: ["network.send", "db.query", "db.insert", "db.update"],
    targetPatterns: [
      "/^(?:https?:\\/\\/)?api\\.atlassian\\.com(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?[^/]+\\.atlassian\\.net(?:\\/|$)/i",
    ],
    requestTextPatterns: ["confluence", "page", "space", "wiki"],
  }),
  regexLane({
    id: "ACCEPT.OPENCLAW.SKILL.1094",
    skill: "google-docs-skill",
    summary: "bounded rail for Google Docs document workflow motion",
    actionKinds: ["network.send", "db.query", "db.insert", "db.update"],
    targetPatterns: [
      "/^(?:https?:\\/\\/)?docs\\.googleapis\\.com(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?www\\.googleapis\\.com(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?docs\\.google\\.com(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?drive\\.googleapis\\.com(?:\\/|$)/i",
    ],
    requestTextPatterns: ["google-docs-skill", "google docs", "document", "doc"],
  }),
  regexLane({
    id: "ACCEPT.OPENCLAW.SKILL.1095",
    skill: "sharepoint-by-altf1be",
    summary: "bounded rail for SharePoint file and document intelligence motion",
    actionKinds: ["network.send", "fs.read", "fs.write", "db.query"],
    targetPatterns: [
      "/^(?:https?:\\/\\/)?graph\\.microsoft\\.com(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?[^/]+\\.sharepoint\\.com(?:\\/|$)/i",
    ],
    requestTextPatterns: ["sharepoint-by-altf1be", "sharepoint", "document", "file"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1096",
    skill: "audio-transcribe",
    summary: "named rail for local voice-message transcription motion",
    actionKinds: ["tool.exec", "fs.read", "fs.write"],
    requestTextPatterns: ["audio-transcribe", "transcribe", "audio", "voice"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1097",
    skill: "faster-whisper",
    summary: "named rail for local faster-whisper transcription motion",
    actionKinds: ["tool.exec", "fs.read", "fs.write"],
    requestTextPatterns: ["faster-whisper", "whisper", "transcribe", "audio"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1098",
    skill: "kokoro-tts",
    summary: "named rail for local Kokoro text-to-speech motion",
    actionKinds: ["tool.exec", "fs.read", "fs.write"],
    requestTextPatterns: ["kokoro-tts", "tts", "speech", "audio"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1099",
    skill: "local-vosk",
    summary: "named rail for local Vosk speech-to-text motion",
    actionKinds: ["tool.exec", "fs.read", "fs.write"],
    requestTextPatterns: ["local-vosk", "vosk", "stt", "transcribe"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1100",
    skill: "local-voice",
    summary: "named rail for local TTS/STT voice pipeline motion",
    actionKinds: ["tool.exec", "fs.read", "fs.write"],
    requestTextPatterns: ["local-voice", "voice", "tts", "stt", "audio"],
  }),
  regexLane({
    id: "ACCEPT.OPENCLAW.SKILL.1101",
    skill: "elevenlabs-tts",
    summary: "bounded rail for ElevenLabs text-to-speech motion",
    actionKinds: ["network.send", "fs.read", "fs.write"],
    targetPatterns: [
      "/^(?:https?:\\/\\/)?api\\.elevenlabs\\.io(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?(?:[^/]+\\.)?elevenlabs\\.io(?:\\/|$)/i",
    ],
    requestTextPatterns: ["elevenlabs-tts", "elevenlabs", "tts", "speech", "audio"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1102",
    skill: "mac-tts",
    summary: "named rail for macOS built-in text-to-speech motion",
    actionKinds: ["tool.exec", "fs.read"],
    requestTextPatterns: ["mac-tts", "tts", "say", "speech"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1103",
    skill: "say",
    summary: "named rail for Siri-voice macOS speech output motion",
    actionKinds: ["tool.exec", "fs.read"],
    requestTextPatterns: ["say", "tts", "speech", "voice"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1104",
    skill: "apple-media",
    summary: "named rail for Apple media-device control motion",
    actionKinds: ["network.send", "sys.config.read", "sys.config.write"],
    requestTextPatterns: ["apple-media", "apple tv", "homepod", "airplay", "media"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1105",
    skill: "agent-team-orchestration",
    summary: "named rail for agent handoff, coordination, and workflow note motion",
    actionKinds: ["chat.emit", "comm.send", "fs.read", "fs.write"],
    requestTextPatterns: ["agent-team-orchestration", "handoff", "review workflow", "coordination"],
  }),
  regexLane({
    id: "ACCEPT.OPENCLAW.SKILL.1106",
    skill: "azure-devops",
    summary: "bounded rail for Azure DevOps repository and work-item workflow motion",
    actionKinds: ["network.send", "fs.read", "fs.write"],
    targetPatterns: [
      "/^(?:https?:\\/\\/)?dev\\.azure\\.com(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?[^/]+\\.visualstudio\\.com(?:\\/|$)/i",
    ],
    requestTextPatterns: ["azure-devops", "azure devops", "repository", "work item", "pull request"],
  }),
  regexLane({
    id: "ACCEPT.OPENCLAW.SKILL.1107",
    skill: "bitbucket-automation",
    summary: "bounded rail for Bitbucket repository and pull-request workflow motion",
    actionKinds: ["network.send", "fs.read", "fs.write"],
    targetPatterns: [
      "/^(?:https?:\\/\\/)?(?:api\\.)?bitbucket\\.org(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?bitbucket\\.org(?:\\/|$)/i",
    ],
    requestTextPatterns: ["bitbucket-automation", "bitbucket", "repository", "pull request"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1108",
    skill: "filesystem",
    summary: "named rail for advanced workspace file listing, search, and batch motion",
    actionKinds: ["fs.read", "fs.write", "fs.append", "fs.mkdir", "fs.move"],
    requestTextPatterns: ["filesystem", "list files", "search content", "batch processing", "directory"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1109",
    skill: "docsync",
    summary: "named rail for docs generation and drift-check workflow motion",
    actionKinds: ["tool.exec", "fs.read", "fs.write", "fs.append"],
    requestTextPatterns: ["docsync", "docs", "documentation drift", "generate docs"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1110",
    skill: "read-optimizer",
    summary: "named rail for bounded repository reading strategy motion",
    actionKinds: ["tool.exec", "fs.read"],
    requestTextPatterns: ["read-optimizer", "read strategy", "head", "tail", "grep", "diff"],
  }),
] as const;

export const BASE_AWESOME_OPENCLAW_SKILL_ACCEPTANCE_LANES =
  AWESOME_OPENCLAW_SKILL_ACCEPTANCE_LANES.filter((lane) => lane.seedInBasePack !== false);
