import path from "node:path";
import type { BoundaryActionKind } from "./types.ts";

type TargetMatchMode = "prefix" | "exact" | "regex";

export type ListVAcceptanceLane = {
  id: string;
  capability: string;
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
  capability: string;
  summary: string;
  actionKinds: BoundaryActionKind[];
  requestTextPatterns?: string[];
  seedInBasePack?: boolean;
}): ListVAcceptanceLane {
  return {
    id: args.id,
    capability: args.capability,
    summary: args.summary,
    actionKinds: args.actionKinds,
    targetPattern: args.capability,
    targetMatchMode: "exact",
    requestTextPatterns: args.requestTextPatterns ?? [args.capability],
    seedInBasePack: args.seedInBasePack,
  };
}

function regexLane(args: {
  id: string;
  capability: string;
  summary: string;
  actionKinds: BoundaryActionKind[];
  targetPatterns: string[];
  requestTextPatterns?: string[];
  seedInBasePack?: boolean;
}): ListVAcceptanceLane {
  return {
    id: args.id,
    capability: args.capability,
    summary: args.summary,
    actionKinds: args.actionKinds,
    targetPatterns: args.targetPatterns,
    targetMatchMode: "regex",
    requestTextPatterns: args.requestTextPatterns ?? [args.capability],
    seedInBasePack: args.seedInBasePack,
  };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function workspaceFilePattern(rootPath: string, extensions: string[]): string {
  const resolvedRoot = path.resolve(rootPath).replaceAll("\\", "/");
  return `/^${escapeRegex(resolvedRoot)}(?:\\/.*)?\\/[^/]+\\.(?:${extensions.map(escapeRegex).join("|")})$/i`;
}

export const LIST_V_ACCEPTANCE_LANES: readonly ListVAcceptanceLane[] = [
  namedLane({
    id: "ACCEPT.CURATED.CAPABILITY.2001",
    capability: "docx",
    summary: "named rail for Word document creation, editing, and tracked-change workflow motion",
    actionKinds: ["tool.exec", "fs.read", "fs.write", "fs.append"],
    requestTextPatterns: ["docx", "word document", "tracked changes", "comment", "edit document"],
  }),
  namedLane({
    id: "ACCEPT.CURATED.CAPABILITY.2002",
    capability: "pptx",
    summary: "named rail for slide deck creation, editing, and speaker-note workflow motion",
    actionKinds: ["tool.exec", "fs.read", "fs.write", "fs.append"],
    requestTextPatterns: ["pptx", "slides", "deck", "speaker notes", "presentation"],
  }),
  namedLane({
    id: "ACCEPT.CURATED.CAPABILITY.2003",
    capability: "xlsx",
    summary: "named rail for spreadsheet analysis, formula, and chart workflow motion",
    actionKinds: ["tool.exec", "fs.read", "fs.write", "fs.append"],
    requestTextPatterns: ["xlsx", "spreadsheet", "excel", "formula", "chart"],
  }),
  namedLane({
    id: "ACCEPT.CURATED.CAPABILITY.2004",
    capability: "doc-coauthoring",
    summary: "named rail for collaborative drafting, revision, and coauthoring workflow motion",
    actionKinds: ["chat.emit", "fs.read", "fs.write", "fs.append"],
    requestTextPatterns: ["doc-coauthoring", "coauthor", "draft", "revise", "comment"],
  }),
  namedLane({
    id: "ACCEPT.CURATED.CAPABILITY.2005",
    capability: "frontend-design",
    summary: "named rail for frontend design-system and visual component workflow motion",
    actionKinds: ["tool.exec", "fs.read", "fs.write", "fs.append", "chat.emit"],
    requestTextPatterns: ["frontend-design", "design system", "ui", "component", "typography"],
  }),
  namedLane({
    id: "ACCEPT.CURATED.CAPABILITY.2006",
    capability: "canvas-design",
    summary: "named rail for social graphic, poster, and canvas output workflow motion",
    actionKinds: ["tool.exec", "fs.read", "fs.write", "fs.append"],
    requestTextPatterns: ["canvas-design", "canvas", "poster", "graphic", "cover"],
  }),
  namedLane({
    id: "ACCEPT.CURATED.CAPABILITY.2007",
    capability: "theme-factory",
    summary: "named rail for theme and color-system generation workflow motion",
    actionKinds: ["tool.exec", "fs.read", "fs.write", "chat.emit"],
    requestTextPatterns: ["theme-factory", "theme", "palette", "color scheme", "brand colors"],
  }),
  namedLane({
    id: "ACCEPT.CURATED.CAPABILITY.2008",
    capability: "web-artifacts-builder",
    summary: "named rail for calculators, dashboards, and interactive artifact workflow motion",
    actionKinds: ["tool.exec", "fs.read", "fs.write", "fs.append", "chat.emit"],
    requestTextPatterns: ["web-artifacts-builder", "artifact", "dashboard", "calculator", "widget"],
  }),
  namedLane({
    id: "ACCEPT.CURATED.CAPABILITY.2009",
    capability: "superpowers",
    summary: "named rail for structured coding, planning, and execution workflow motion",
    actionKinds: ["tool.exec", "fs.read", "fs.write", "fs.append", "chat.emit"],
    requestTextPatterns: ["superpowers", "plan", "execute", "tdd", "debug"],
  }),
  namedLane({
    id: "ACCEPT.CURATED.CAPABILITY.2010",
    capability: "systematic-debugging",
    summary: "named rail for root-cause debugging and fix-validation workflow motion",
    actionKinds: ["tool.exec", "fs.read", "fs.write", "fs.append", "chat.emit"],
    requestTextPatterns: ["systematic-debugging", "debug", "root cause", "isolate", "reproduce"],
  }),
  namedLane({
    id: "ACCEPT.CURATED.CAPABILITY.2011",
    capability: "file-search",
    summary: "named rail for bounded file search, symbol search, and content retrieval motion",
    actionKinds: ["tool.exec", "fs.read"],
    requestTextPatterns: ["file-search", "search files", "ripgrep", "ast-grep", "find symbol"],
  }),
  namedLane({
    id: "ACCEPT.CURATED.CAPABILITY.2012",
    capability: "context-optimization",
    summary: "named rail for context shaping, summarization, and token-efficiency workflow motion",
    actionKinds: ["tool.exec", "fs.read", "fs.write", "chat.emit"],
    requestTextPatterns: ["context-optimization", "context", "compress", "summarize", "token efficiency"],
  }),
  namedLane({
    id: "ACCEPT.CURATED.CAPABILITY.2013",
    capability: "notebooklm-integration",
    summary: "named rail for notebook-backed study, synthesis, and source-grounded note workflow motion",
    actionKinds: ["network.send", "fs.read", "fs.write", "chat.emit"],
    requestTextPatterns: ["notebooklm-integration", "notebooklm", "study notes", "flashcards", "mind map"],
  }),
  namedLane({
    id: "ACCEPT.CURATED.CAPABILITY.2014",
    capability: "excel-mcp-server",
    summary: "named rail for spreadsheet manipulation and report workflow motion",
    actionKinds: ["tool.exec", "fs.read", "fs.write"],
    requestTextPatterns: ["excel-mcp-server", "excel", "spreadsheet", "workbook", "sheet"],
  }),
  namedLane({
    id: "ACCEPT.CURATED.CAPABILITY.2015",
    capability: "tavily",
    summary: "named rail for structured web search, extract, and crawl workflow motion",
    actionKinds: ["network.send", "fs.write", "chat.emit"],
    requestTextPatterns: ["tavily", "search", "extract", "crawl", "map"],
  }),
  namedLane({
    id: "ACCEPT.CURATED.CAPABILITY.2016",
    capability: "context7",
    summary: "named rail for live library-documentation retrieval workflow motion",
    actionKinds: ["network.send", "fs.write", "chat.emit"],
    requestTextPatterns: ["context7", "library docs", "up-to-date docs", "api docs", "framework docs"],
  }),
  namedLane({
    id: "ACCEPT.CURATED.CAPABILITY.2017",
    capability: "task-master-ai",
    summary: "named rail for project-task decomposition and dependency workflow motion",
    actionKinds: ["tool.exec", "fs.read", "fs.write", "db.query", "db.insert", "db.update"],
    requestTextPatterns: ["task-master-ai", "tasks", "dependencies", "plan", "project manager"],
  }),
  namedLane({
    id: "ACCEPT.CURATED.CAPABILITY.2018",
    capability: "gpt-researcher",
    summary: "named rail for autonomous research compilation and report workflow motion",
    actionKinds: ["network.send", "fs.write", "chat.emit"],
    requestTextPatterns: ["gpt-researcher", "research", "report", "sources", "brief"],
  }),
  namedLane({
    id: "ACCEPT.CURATED.CAPABILITY.2019",
    capability: "codebase-memory-mcp",
    summary: "named rail for persistent codebase memory and knowledge-graph workflow motion",
    actionKinds: ["tool.exec", "fs.read", "fs.write", "db.query", "db.insert", "db.update"],
    requestTextPatterns: ["codebase-memory-mcp", "codebase memory", "knowledge graph", "memory", "index"],
  }),
  namedLane({
    id: "ACCEPT.CURATED.CAPABILITY.2020",
    capability: "mcp-playwright",
    summary: "named rail for bounded browser automation and page-interaction workflow motion",
    actionKinds: ["tool.exec", "fs.read", "fs.write", "network.send"],
    requestTextPatterns: ["mcp-playwright", "playwright", "browser", "page", "automation"],
  }),
  namedLane({
    id: "ACCEPT.CURATED.CAPABILITY.2021",
    capability: "markdownify-mcp",
    summary: "named rail for PDF, image, and audio to Markdown conversion workflow motion",
    actionKinds: ["tool.exec", "fs.read", "fs.write", "fs.append"],
    requestTextPatterns: ["markdownify-mcp", "markdownify", "pdf to markdown", "ocr", "transcribe to markdown"],
  }),
  namedLane({
    id: "ACCEPT.CURATED.CAPABILITY.2022",
    capability: "brand-guidelines",
    summary: "named rail for brand-rule application and style-consistent output workflow motion",
    actionKinds: ["chat.emit", "fs.read", "fs.write", "fs.append"],
    requestTextPatterns: ["brand-guidelines", "brand voice", "brand rules", "style guide", "tone guide"],
  }),
  namedLane({
    id: "ACCEPT.CURATED.CAPABILITY.2023",
    capability: "claude-seo",
    summary: "named rail for SEO audit, schema, and site-content improvement workflow motion",
    actionKinds: ["network.send", "fs.read", "fs.write", "chat.emit"],
    requestTextPatterns: ["claude-seo", "seo", "audit", "schema", "content optimization"],
  }),
] as const;

export const BASE_LIST_V_ACCEPTANCE_LANES =
  LIST_V_ACCEPTANCE_LANES.filter((lane) => lane.seedInBasePack !== false);

export function createListVWorkflowAcceptanceLanes(rootPath: string): readonly ListVAcceptanceLane[] {
  return [
    regexLane({
      id: "ACCEPT.CURATED.WORKFLOW.2101",
      capability: "docx-workflow",
      summary: "bounded workspace Word-document workflow motion",
      actionKinds: ["fs.read", "fs.write", "fs.append"],
      targetPatterns: [workspaceFilePattern(rootPath, ["docx"])],
      requestTextPatterns: ["docx", "word document", "tracked changes", "comment", "edit document"],
    }),
    regexLane({
      id: "ACCEPT.CURATED.WORKFLOW.2102",
      capability: "pptx-workflow",
      summary: "bounded workspace slide-deck workflow motion",
      actionKinds: ["fs.read", "fs.write", "fs.append"],
      targetPatterns: [workspaceFilePattern(rootPath, ["pptx"])],
      requestTextPatterns: ["pptx", "slides", "deck", "speaker notes", "presentation"],
    }),
    regexLane({
      id: "ACCEPT.CURATED.WORKFLOW.2103",
      capability: "xlsx-workflow",
      summary: "bounded workspace spreadsheet and table workflow motion",
      actionKinds: ["fs.read", "fs.write", "fs.append"],
      targetPatterns: [workspaceFilePattern(rootPath, ["xlsx", "xls", "csv", "tsv"])],
      requestTextPatterns: ["xlsx", "spreadsheet", "excel", "formula", "chart", "table"],
    }),
    regexLane({
      id: "ACCEPT.CURATED.WORKFLOW.2104",
      capability: "doc-coauthoring-workflow",
      summary: "bounded collaborative drafting and revision workflow motion",
      actionKinds: ["chat.emit", "fs.read", "fs.write", "fs.append"],
      targetPatterns: [workspaceFilePattern(rootPath, ["md", "txt", "docx"])],
      requestTextPatterns: ["coauthor", "draft", "revise", "comment", "tracked changes"],
    }),
    regexLane({
      id: "ACCEPT.CURATED.WORKFLOW.2105",
      capability: "frontend-design-workflow",
      summary: "bounded frontend design-system and UI artifact workflow motion",
      actionKinds: ["fs.read", "fs.write", "fs.append"],
      targetPatterns: [workspaceFilePattern(rootPath, ["html", "css", "scss", "js", "jsx", "ts", "tsx", "svg", "json"])],
      requestTextPatterns: ["frontend-design", "design system", "ui", "component", "layout", "typography"],
    }),
    regexLane({
      id: "ACCEPT.CURATED.WORKFLOW.2106",
      capability: "canvas-design-workflow",
      summary: "bounded poster, social graphic, and visual export workflow motion",
      actionKinds: ["fs.read", "fs.write", "fs.append"],
      targetPatterns: [workspaceFilePattern(rootPath, ["png", "jpg", "jpeg", "webp", "svg", "pdf"])],
      requestTextPatterns: ["canvas-design", "poster", "graphic", "cover", "visual export"],
    }),
    regexLane({
      id: "ACCEPT.CURATED.WORKFLOW.2107",
      capability: "theme-factory-workflow",
      summary: "bounded theme and color-system file workflow motion",
      actionKinds: ["fs.read", "fs.write", "fs.append"],
      targetPatterns: [workspaceFilePattern(rootPath, ["css", "scss", "less", "json", "yaml", "yml", "toml"])],
      requestTextPatterns: ["theme-factory", "theme", "palette", "color scheme", "tokens"],
    }),
    regexLane({
      id: "ACCEPT.CURATED.WORKFLOW.2108",
      capability: "web-artifacts-builder-workflow",
      summary: "bounded calculators, dashboards, and interactive artifact file workflow motion",
      actionKinds: ["fs.read", "fs.write", "fs.append"],
      targetPatterns: [workspaceFilePattern(rootPath, ["html", "css", "js", "ts", "tsx", "json", "md"])],
      requestTextPatterns: ["artifact", "dashboard", "calculator", "widget", "interactive"],
    }),
    regexLane({
      id: "ACCEPT.CURATED.WORKFLOW.2109",
      capability: "excel-mcp-workflow",
      summary: "bounded spreadsheet workbook and report workflow motion",
      actionKinds: ["fs.read", "fs.write", "fs.append"],
      targetPatterns: [workspaceFilePattern(rootPath, ["xlsx", "xls", "csv", "tsv"])],
      requestTextPatterns: ["excel", "spreadsheet", "workbook", "sheet", "report"],
    }),
    regexLane({
      id: "ACCEPT.CURATED.WORKFLOW.2110",
      capability: "tavily-workflow",
      summary: "bounded Tavily search, extract, and crawl provider motion",
      actionKinds: ["network.send"],
      targetPatterns: [
        "/^(?:https?:\\/\\/)?(?:api\\.)?tavily\\.com(?:\\/|$)/i",
        "/^(?:https?:\\/\\/)?(?:www\\.)?tavily\\.com(?:\\/|$)/i",
      ],
      requestTextPatterns: ["tavily", "search", "extract", "crawl", "map"],
    }),
    regexLane({
      id: "ACCEPT.CURATED.WORKFLOW.2111",
      capability: "notebooklm-workflow",
      summary: "bounded NotebookLM study and synthesis provider motion",
      actionKinds: ["network.send"],
      targetPatterns: [
        "/^(?:https?:\\/\\/)?(?:www\\.)?notebooklm\\.google\\.com(?:\\/|$)/i",
      ],
      requestTextPatterns: ["notebooklm", "study notes", "flashcards", "mind map", "source notebook"],
    }),
    regexLane({
      id: "ACCEPT.CURATED.WORKFLOW.2112",
      capability: "markdownify-workflow",
      summary: "bounded document, image, and audio conversion workflow motion",
      actionKinds: ["fs.read", "fs.write", "fs.append"],
      targetPatterns: [workspaceFilePattern(rootPath, ["pdf", "png", "jpg", "jpeg", "webp", "mp3", "wav", "m4a", "mp4", "mov", "mkv", "md"])],
      requestTextPatterns: ["markdownify", "pdf to markdown", "ocr", "transcribe to markdown", "convert to markdown"],
    }),
    regexLane({
      id: "ACCEPT.CURATED.WORKFLOW.2113",
      capability: "brand-and-seo-workflow",
      summary: "bounded brand, copy, and site-content workflow motion",
      actionKinds: ["fs.read", "fs.write", "fs.append", "chat.emit"],
      targetPatterns: [workspaceFilePattern(rootPath, ["md", "txt", "html", "xml", "json"])],
      requestTextPatterns: ["brand", "seo", "copy", "audit", "schema", "style guide"],
    }),
    regexLane({
      id: "ACCEPT.CURATED.WORKFLOW.2114",
      capability: "browser-artifact-workflow",
      summary: "bounded browser screenshot, page export, and trace artifact workflow motion",
      actionKinds: ["fs.read", "fs.write", "fs.append"],
      targetPatterns: [workspaceFilePattern(rootPath, ["png", "jpg", "jpeg", "webp", "pdf", "html", "json"])],
      requestTextPatterns: ["browser", "playwright", "screenshot", "page export", "trace"],
    }),
  ] as const;
}
