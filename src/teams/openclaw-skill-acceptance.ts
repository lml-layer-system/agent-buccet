import type { BoundaryActionKind } from "./types.ts";

type TargetMatchMode = "prefix" | "exact" | "regex";

export type OpenClawSkillAcceptanceLane = {
  id: string;
  skill: string;
  summary: string;
  actionKinds: BoundaryActionKind[];
  targetPattern?: string;
  targetPatterns?: string[];
  targetMatchMode?: TargetMatchMode;
  requestTextPatterns?: string[];
  seedInBasePack?: boolean;
};

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
    targetMatchMode: "regex",
    requestTextPatterns: args.requestTextPatterns ?? [args.skill],
    seedInBasePack: args.seedInBasePack,
  };
}

export const OPENCLAW_SKILL_ACCEPTANCE_LANES: readonly OpenClawSkillAcceptanceLane[] = [
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1001",
    skill: "1password",
    summary: "named rail for credential-vault use through the 1Password skill surface",
    actionKinds: ["sys.credential.use"],
    seedInBasePack: false,
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1002",
    skill: "apple-notes",
    summary: "named rail for local Apple Notes read and write motion",
    actionKinds: ["fs.read", "fs.write"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1003",
    skill: "apple-reminders",
    summary: "named rail for reminders query and update motion",
    actionKinds: ["db.query", "db.insert", "db.update"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1004",
    skill: "bear-notes",
    summary: "named rail for Bear notes read and write motion",
    actionKinds: ["fs.read", "fs.write"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1005",
    skill: "blogwatcher",
    summary: "named rail for blog/feed retrieval and note output",
    actionKinds: ["network.send", "fs.write"],
    requestTextPatterns: ["blogwatcher", "feed", "rss", "watch"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1006",
    skill: "blucli",
    summary: "named rail for bounded local CLI workflow motion",
    actionKinds: ["tool.exec", "fs.read", "fs.write"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1007",
    skill: "bluebubbles",
    summary: "named rail for BlueBubbles message delivery motion",
    actionKinds: ["chat.emit", "comm.send"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1008",
    skill: "camsnap",
    summary: "named rail for camera snapshot file motion",
    actionKinds: ["tool.exec", "fs.read", "fs.write"],
    seedInBasePack: false,
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1009",
    skill: "canvas",
    summary: "named rail for canvas control and paired surface updates",
    actionKinds: ["tool.exec", "sys.config.read", "sys.config.write"],
    requestTextPatterns: ["canvas", "node", "surface", "draw"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1010",
    skill: "clawhub",
    summary: "named rail for ClawHub network and workflow motion",
    actionKinds: ["network.send", "chat.emit"],
    requestTextPatterns: ["clawhub", "workspace", "hub"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1011",
    skill: "coding-agent",
    summary: "named rail for local coding and file mutation work",
    actionKinds: ["tool.exec", "fs.read", "fs.write", "fs.append", "fs.mkdir", "fs.move"],
    requestTextPatterns: ["coding-agent", "code", "patch", "refactor", "test"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1012",
    skill: "discord",
    summary: "named rail for Discord delivery motion",
    actionKinds: ["chat.emit", "comm.send"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1013",
    skill: "eightctl",
    summary: "named rail for bounded controller CLI workflow motion",
    actionKinds: ["tool.exec", "fs.read", "fs.write"],
  }),
  regexLane({
    id: "ACCEPT.OPENCLAW.SKILL.1014",
    skill: "gemini",
    summary: "bounded rail for Gemini-backed retrieval or exchange motion",
    actionKinds: ["network.send", "chat.emit"],
    targetPatterns: [
      "/^(?:https?:\\/\\/)?generativelanguage\\.googleapis\\.com(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?ai\\.google\\.dev(?:\\/|$)/i",
    ],
    requestTextPatterns: ["gemini", "model", "prompt", "response"],
  }),
  regexLane({
    id: "ACCEPT.OPENCLAW.SKILL.1015",
    skill: "gh-issues",
    summary: "bounded rail for GitHub issue retrieval and update workflow motion",
    actionKinds: ["network.send", "fs.read", "fs.write"],
    targetPatterns: [
      "/^(?:https?:\\/\\/)?github\\.com(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?api\\.github\\.com(?:\\/|$)/i",
    ],
    requestTextPatterns: ["gh-issues", "github issue", "issue", "repo"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1016",
    skill: "gifgrep",
    summary: "named rail for local media search and inspection motion",
    actionKinds: ["tool.exec", "fs.read"],
  }),
  regexLane({
    id: "ACCEPT.OPENCLAW.SKILL.1017",
    skill: "github",
    summary: "bounded rail for GitHub work item and repository workflow motion",
    actionKinds: ["network.send", "fs.read", "fs.write", "chat.emit"],
    targetPatterns: [
      "/^(?:https?:\\/\\/)?github\\.com(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?api\\.github\\.com(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?raw\\.githubusercontent\\.com(?:\\/|$)/i",
    ],
    requestTextPatterns: ["github", "repo", "repository", "pull request", "issue"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1018",
    skill: "gog",
    summary: "named rail for bounded tool and service workflow motion",
    actionKinds: ["tool.exec", "network.send"],
    requestTextPatterns: ["gog", "workflow", "service"],
  }),
  regexLane({
    id: "ACCEPT.OPENCLAW.SKILL.1019",
    skill: "goplaces",
    summary: "bounded rail for places lookup and result writing motion",
    actionKinds: ["network.send", "fs.write"],
    targetPatterns: [
      "/^(?:https?:\\/\\/)?places\\.googleapis\\.com(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?maps\\.googleapis\\.com(?:\\/|$)/i",
    ],
    requestTextPatterns: ["goplaces", "place", "maps", "location"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1020",
    skill: "healthcheck",
    summary: "named rail for bounded health and diagnostics checks",
    actionKinds: ["tool.exec", "network.send", "fs.write"],
    requestTextPatterns: ["healthcheck", "diagnostic", "status", "health"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1021",
    skill: "himalaya",
    summary: "named rail for mail-oriented communication workflow motion",
    actionKinds: ["comm.send", "fs.read", "fs.write"],
    requestTextPatterns: ["himalaya", "mail", "email", "message"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1022",
    skill: "imsg",
    summary: "named rail for iMessage delivery motion",
    actionKinds: ["chat.emit", "comm.send"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1023",
    skill: "mcporter",
    summary: "named rail for bounded local workflow and file motion",
    actionKinds: ["tool.exec", "fs.read", "fs.write"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1024",
    skill: "model-usage",
    summary: "named rail for model-usage note and ledger motion",
    actionKinds: ["fs.read", "fs.write", "db.query"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1025",
    skill: "nano-pdf",
    summary: "named rail for PDF retrieval and extraction output motion",
    actionKinds: ["fs.read", "fs.write", "network.send"],
    requestTextPatterns: ["nano-pdf", "pdf", "extract", "document"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1026",
    skill: "node-connect",
    summary: "named rail for node connection and paired target motion",
    actionKinds: ["tool.exec", "network.send", "sys.config.read", "sys.config.write"],
    requestTextPatterns: ["node-connect", "node", "connect", "pair"],
  }),
  regexLane({
    id: "ACCEPT.OPENCLAW.SKILL.1027",
    skill: "notion",
    summary: "bounded rail for Notion retrieval and update motion",
    actionKinds: ["network.send", "db.query", "db.insert", "db.update", "fs.write"],
    targetPatterns: [
      "/^(?:https?:\\/\\/)?(?:www\\.)?notion\\.so(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?api\\.notion\\.com(?:\\/|$)/i",
      "/^notion$/i",
    ],
    requestTextPatterns: ["notion", "page", "database", "workspace"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1028",
    skill: "obsidian",
    summary: "named rail for Obsidian vault read and write motion",
    actionKinds: ["fs.read", "fs.write"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1029",
    skill: "openai-whisper",
    summary: "named rail for local transcription workflow motion",
    actionKinds: ["tool.exec", "fs.read", "fs.write"],
    requestTextPatterns: ["openai-whisper", "transcribe", "whisper", "audio"],
  }),
  regexLane({
    id: "ACCEPT.OPENCLAW.SKILL.1030",
    skill: "openai-whisper-api",
    summary: "bounded rail for API-backed transcription workflow motion",
    actionKinds: ["network.send", "fs.read", "fs.write"],
    targetPatterns: [
      "/^(?:https?:\\/\\/)?api\\.openai\\.com(?:\\/|$)/i",
      "/^openai-whisper-api$/i",
    ],
    requestTextPatterns: ["openai-whisper-api", "transcribe", "whisper", "audio"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1031",
    skill: "openhue",
    summary: "named rail for Hue device control motion",
    actionKinds: ["network.send", "sys.config.read", "sys.config.write"],
    requestTextPatterns: ["openhue", "hue", "light", "scene"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1032",
    skill: "oracle",
    summary: "named rail for bounded oracle-style query and output motion",
    actionKinds: ["network.send", "chat.emit", "fs.write"],
    requestTextPatterns: ["oracle", "query", "answer", "result"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1033",
    skill: "ordercli",
    summary: "named rail for bounded order/workflow CLI motion",
    actionKinds: ["tool.exec", "network.send", "fs.write"],
    requestTextPatterns: ["ordercli", "order", "workflow"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1034",
    skill: "peekaboo",
    summary: "named rail for bounded local inspection workflow motion",
    actionKinds: ["tool.exec", "fs.read", "fs.write"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1035",
    skill: "sag",
    summary: "named rail for bounded service and automation workflow motion",
    actionKinds: ["network.send", "tool.exec"],
    requestTextPatterns: ["sag", "automation", "service"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1036",
    skill: "session-logs",
    summary: "named rail for local session log read and write motion",
    actionKinds: ["fs.read", "fs.write"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1037",
    skill: "sherpa-onnx-tts",
    summary: "named rail for local text-to-speech workflow motion",
    actionKinds: ["tool.exec", "fs.read", "fs.write"],
    requestTextPatterns: ["sherpa-onnx-tts", "tts", "speech", "audio"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1038",
    skill: "skill-creator",
    summary: "named rail for local skill authoring workflow motion",
    actionKinds: ["tool.exec", "fs.read", "fs.write"],
    requestTextPatterns: ["skill-creator", "skill", "author"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1039",
    skill: "slack",
    summary: "named rail for Slack delivery motion",
    actionKinds: ["chat.emit", "comm.send"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1039A",
    skill: "telegram",
    summary: "named rail for Telegram delivery motion",
    actionKinds: ["chat.emit", "comm.send"],
    requestTextPatterns: ["telegram", "bot", "channel", "message"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1040",
    skill: "songsee",
    summary: "named rail for song/media understanding workflow motion",
    actionKinds: ["tool.exec", "fs.read", "fs.write"],
    requestTextPatterns: ["songsee", "song", "media", "analyze"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1041",
    skill: "sonoscli",
    summary: "named rail for Sonos device control motion",
    actionKinds: ["tool.exec", "network.send", "sys.config.read", "sys.config.write"],
    requestTextPatterns: ["sonoscli", "sonos", "speaker", "playback"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1042",
    skill: "spotify-player",
    summary: "named rail for Spotify playback control motion",
    actionKinds: ["tool.exec", "network.send", "sys.config.read", "sys.config.write"],
    requestTextPatterns: ["spotify-player", "spotify", "playback", "playlist"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1043",
    skill: "summarize",
    summary: "named rail for summarization read/write/output motion",
    actionKinds: ["fs.read", "fs.write", "chat.emit"],
    requestTextPatterns: ["summarize", "summary", "summarization"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1044",
    skill: "taskflow",
    summary: "named rail for taskflow task-system motion",
    actionKinds: ["fs.read", "fs.write", "db.query", "db.insert", "db.update"],
    requestTextPatterns: ["taskflow", "task", "workflow", "inbox"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1045",
    skill: "taskflow-inbox-triage",
    summary: "named rail for inbox triage task-system motion",
    actionKinds: ["fs.read", "fs.write", "db.query", "db.insert", "db.update"],
    requestTextPatterns: ["taskflow-inbox-triage", "triage", "task", "inbox"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1046",
    skill: "things-mac",
    summary: "named rail for Things task-system motion",
    actionKinds: ["db.query", "db.insert", "db.update"],
    requestTextPatterns: ["things-mac", "things", "task"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1047",
    skill: "tmux",
    summary: "named rail for tmux session workflow motion",
    actionKinds: ["tool.exec"],
    requestTextPatterns: ["tmux", "session", "pane", "window"],
  }),
  regexLane({
    id: "ACCEPT.OPENCLAW.SKILL.1048",
    skill: "trello",
    summary: "bounded rail for Trello board and task motion",
    actionKinds: ["network.send", "db.query", "db.insert", "db.update"],
    targetPatterns: [
      "/^(?:https?:\\/\\/)?(?:api\\.)?trello\\.com(?:\\/|$)/i",
      "/^trello$/i",
    ],
    requestTextPatterns: ["trello", "board", "card", "task"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1049",
    skill: "video-frames",
    summary: "named rail for video frame extraction workflow motion",
    actionKinds: ["tool.exec", "fs.read", "fs.write"],
    requestTextPatterns: ["video-frames", "video", "frame", "extract"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1050",
    skill: "voice-call",
    summary: "named rail for voice-call delivery motion",
    actionKinds: ["comm.send", "chat.emit"],
    requestTextPatterns: ["voice-call", "call", "voice"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1051",
    skill: "wacli",
    summary: "named rail for WhatsApp CLI delivery motion",
    actionKinds: ["chat.emit", "comm.send"],
    requestTextPatterns: ["wacli", "whatsapp", "message"],
  }),
  namedLane({
    id: "ACCEPT.OPENCLAW.SKILL.1051A",
    skill: "whatsapp",
    summary: "named rail for WhatsApp delivery motion",
    actionKinds: ["chat.emit", "comm.send"],
    requestTextPatterns: ["whatsapp", "message", "chat"],
  }),
  regexLane({
    id: "ACCEPT.OPENCLAW.SKILL.1052",
    skill: "weather",
    summary: "bounded rail for weather retrieval and output motion",
    actionKinds: ["network.send", "fs.write", "chat.emit"],
    targetPatterns: [
      "/^(?:https?:\\/\\/)?(?:api\\.)?weather\\.gov(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?api\\.openweathermap\\.(?:org|com)(?:\\/|$)/i",
      "/^weather$/i",
    ],
    requestTextPatterns: ["weather", "forecast", "temperature", "conditions"],
  }),
  regexLane({
    id: "ACCEPT.OPENCLAW.SKILL.1053",
    skill: "xurl",
    summary: "bounded rail for fetch and retrieval motion",
    actionKinds: ["network.send", "fs.read", "fs.write"],
    targetPatterns: [
      "/^(?:https?:\\/\\/)?(?:[^/]+\\.)?developer\\.mozilla\\.org(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?(?:[^/]+\\.)?docs\\.python\\.org(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?(?:[^/]+\\.)?docs\\.npmjs\\.com(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?(?:[^/]+\\.)?nodejs\\.org(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?(?:[^/]+\\.)?docs\\.rs(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?(?:[^/]+\\.)?pkg\\.go\\.dev(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?(?:[^/]+\\.)?www\\.typescriptlang\\.org(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?(?:[^/]+\\.)?developer\\.apple\\.com(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?(?:[^/]+\\.)?github\\.com(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?(?:[^/]+\\.)?api\\.github\\.com(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?(?:[^/]+\\.)?raw\\.githubusercontent\\.com(?:\\/|$)/i",
    ],
    requestTextPatterns: ["xurl", "fetch", "retrieve", "read", "browse"],
  }),
] as const;

export const BASE_OPENCLAW_SKILL_ACCEPTANCE_LANES = OPENCLAW_SKILL_ACCEPTANCE_LANES.filter(
  (lane) => lane.seedInBasePack !== false,
);
