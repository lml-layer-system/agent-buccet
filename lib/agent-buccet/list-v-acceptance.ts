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
  namedLane({
    id: "ACCEPT.CURATED.CAPABILITY.2024",
    capability: "pdf-processing",
    summary: "named rail for PDF reading, extraction, form, merge, and split workflow motion",
    actionKinds: ["tool.exec", "fs.read", "fs.write", "fs.append"],
    requestTextPatterns: ["pdf-processing", "pdf", "extract tables", "fill forms", "merge pdf", "split pdf"],
  }),
  namedLane({
    id: "ACCEPT.CURATED.CAPABILITY.2025",
    capability: "algorithmic-art",
    summary: "named rail for generative p5.js, fractal, and geometric-art workflow motion",
    actionKinds: ["tool.exec", "fs.read", "fs.write", "fs.append", "chat.emit"],
    requestTextPatterns: ["algorithmic-art", "p5", "fractal", "geometric art", "generative art"],
  }),
  namedLane({
    id: "ACCEPT.CURATED.CAPABILITY.2026",
    capability: "remotion-best-practices",
    summary: "named rail for Remotion-driven video and motion-artifact workflow motion",
    actionKinds: ["tool.exec", "fs.read", "fs.write", "fs.append", "chat.emit"],
    requestTextPatterns: ["remotion-best-practices", "remotion", "video generation", "motion graphics", "render video"],
  }),
  namedLane({
    id: "ACCEPT.CURATED.CAPABILITY.2027",
    capability: "marketing-skills",
    summary: "named rail for copy, CRO, email sequence, and growth workflow motion",
    actionKinds: ["fs.read", "fs.write", "fs.append", "chat.emit", "network.send"],
    requestTextPatterns: ["marketing-skills", "copywriting", "cro", "email sequence", "growth workflow", "campaign"],
  }),
  namedLane({
    id: "ACCEPT.CURATED.CAPABILITY.2028",
    capability: "obsidian-skills",
    summary: "named rail for vault-native note, auto-linking, and PKM workflow motion",
    actionKinds: ["fs.read", "fs.write", "fs.append", "fs.move", "chat.emit"],
    requestTextPatterns: ["obsidian-skills", "obsidian", "vault", "auto-linking", "auto-tagging", "pkm"],
  }),
  namedLane({
    id: "ACCEPT.CURATED.CAPABILITY.2029",
    capability: "fastmcp",
    summary: "named rail for minimal MCP server design and implementation workflow motion",
    actionKinds: ["tool.exec", "fs.read", "fs.write", "fs.append", "chat.emit"],
    requestTextPatterns: ["fastmcp", "mcp server", "python mcp", "tool server", "fast mcp"],
  }),
  namedLane({
    id: "ACCEPT.CURATED.CAPABILITY.2030",
    capability: "mcphub",
    summary: "named rail for multi-MCP server management and connector routing workflow motion",
    actionKinds: ["tool.exec", "network.send", "fs.read", "fs.write", "chat.emit"],
    requestTextPatterns: ["mcphub", "mcp hub", "manage mcp servers", "connector routing", "http mcp"],
  }),
  namedLane({
    id: "ACCEPT.CURATED.CAPABILITY.2031",
    capability: "firecrawl",
    summary: "named rail for website crawling, extraction, and LLM-ready data workflow motion",
    actionKinds: ["network.send", "fs.write", "chat.emit"],
    requestTextPatterns: ["firecrawl", "crawl website", "extract website", "llm-ready data", "web data"],
  }),
  namedLane({
    id: "ACCEPT.CURATED.CAPABILITY.2032",
    capability: "vanna-ai",
    summary: "named rail for natural-language SQL and database-analysis workflow motion",
    actionKinds: ["db.query", "fs.read", "fs.write", "chat.emit", "network.send"],
    requestTextPatterns: ["vanna-ai", "sql", "database", "natural language sql", "analytics query"],
  }),
  namedLane({
    id: "ACCEPT.CURATED.CAPABILITY.2033",
    capability: "dspy",
    summary: "named rail for structured model-programming and optimization workflow motion",
    actionKinds: ["tool.exec", "fs.read", "fs.write", "fs.append", "chat.emit"],
    requestTextPatterns: ["dspy", "structured prompting", "model program", "optimize prompts", "program models"],
  }),
  namedLane({
    id: "ACCEPT.CURATED.CAPABILITY.2034",
    capability: "spec-kit",
    summary: "named rail for spec-driven development and implementation workflow motion",
    actionKinds: ["fs.read", "fs.write", "fs.append", "chat.emit"],
    requestTextPatterns: ["spec-kit", "spec driven", "write spec", "generate from spec", "implementation plan"],
  }),
  namedLane({
    id: "ACCEPT.CURATED.CAPABILITY.2035",
    capability: "copilotkit",
    summary: "named rail for embedded copilot and app-assistant workflow motion",
    actionKinds: ["tool.exec", "fs.read", "fs.write", "fs.append", "chat.emit"],
    requestTextPatterns: ["copilotkit", "embed copilot", "react copilot", "app assistant", "copilot ui"],
  }),
  namedLane({
    id: "ACCEPT.CURATED.CAPABILITY.2036",
    capability: "langflow",
    summary: "named rail for visual pipeline and drag-and-drop workflow builder motion",
    actionKinds: ["tool.exec", "fs.read", "fs.write", "fs.append", "chat.emit"],
    requestTextPatterns: ["langflow", "visual workflow", "drag and drop", "pipeline builder", "flow graph"],
  }),
  namedLane({
    id: "ACCEPT.CURATED.CAPABILITY.2037",
    capability: "extractthinker",
    summary: "named rail for document intelligence, extraction, and structured-field workflow motion",
    actionKinds: ["tool.exec", "fs.read", "fs.write", "fs.append", "chat.emit"],
    requestTextPatterns: ["extractthinker", "document intelligence", "extract fields", "structured extraction", "orm for docs"],
  }),
  namedLane({
    id: "ACCEPT.CURATED.CAPABILITY.2038",
    capability: "ck",
    summary: "named rail for semantic code search and meaning-based retrieval workflow motion",
    actionKinds: ["tool.exec", "fs.read", "chat.emit"],
    requestTextPatterns: ["ck", "semantic code search", "code meaning", "search code by meaning"],
  }),
  namedLane({
    id: "ACCEPT.CURATED.CAPABILITY.2039",
    capability: "rendergit",
    summary: "named rail for repo flattening and repo-to-single-file context workflow motion",
    actionKinds: ["tool.exec", "fs.read", "fs.write"],
    requestTextPatterns: ["rendergit", "repo to single file", "flatten repo", "repo context", "single-file repo"],
  }),
  namedLane({
    id: "ACCEPT.CURATED.CAPABILITY.2040",
    capability: "tdd-guard",
    summary: "named rail for test-first guardrails and TDD workflow motion",
    actionKinds: ["tool.exec", "fs.read", "fs.write", "fs.append", "chat.emit"],
    requestTextPatterns: ["tdd-guard", "test first", "tdd", "testing guard", "write tests before code"],
  }),
  namedLane({
    id: "ACCEPT.CURATED.CAPABILITY.2041",
    capability: "claude-deep-research-skill",
    summary: "named rail for long-form staged deep-research workflow motion",
    actionKinds: ["network.send", "fs.write", "chat.emit"],
    requestTextPatterns: ["claude-deep-research-skill", "deep research", "multi-phase research", "research continuation"],
  }),
  namedLane({
    id: "ACCEPT.CURATED.CAPABILITY.2042",
    capability: "pydantic-ai",
    summary: "named rail for type-safe agent and structured-model workflow motion",
    actionKinds: ["tool.exec", "fs.read", "fs.write", "fs.append", "chat.emit"],
    requestTextPatterns: ["pydantic-ai", "type-safe agent", "structured models", "typed agent", "pydantic"],
  }),
  namedLane({
    id: "ACCEPT.CURATED.CAPABILITY.2043",
    capability: "simonw-llm",
    summary: "named rail for lightweight local and remote LLM CLI workflow motion",
    actionKinds: ["tool.exec", "fs.read", "fs.write", "chat.emit"],
    requestTextPatterns: ["simonw-llm", "llm cli", "local llm", "remote llm", "llm command"],
  }),
  namedLane({
    id: "ACCEPT.CURATED.CAPABILITY.2044",
    capability: "ai-failure-periodic-table",
    summary: "named rail for AI failure periodic table classification, failure-mode analysis, and diagnostic report workflow motion",
    actionKinds: ["tool.exec", "fs.read", "fs.write", "chat.emit"],
    requestTextPatterns: [
      // Matches classifier invocation operations — not the failure terms themselves.
      // The failure terms (PROMPT INJECTION, CREDENTIAL EXFILTRATION, etc.) remain under
      // headless denial patterns. Deny still wins on overlap.
      "/\\b(?:classify|classifying|classification|diagnose|diagnosing|diagnostic|analyze failure|analysing failure|report failure|failure report|taxonomy lookup|catalog lookup|dimension lookup|run classifier|invoke classifier|ai-failure-periodic-table)\\b/i",
    ],
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
    regexLane({
      id: "ACCEPT.CURATED.WORKFLOW.2115",
      capability: "pdf-workflow",
      summary: "bounded workspace PDF extraction, merge, split, and form workflow motion",
      actionKinds: ["fs.read", "fs.write", "fs.append"],
      targetPatterns: [workspaceFilePattern(rootPath, ["pdf", "json", "csv", "md"])],
      requestTextPatterns: ["pdf", "extract tables", "merge pdf", "split pdf", "fill forms"],
    }),
    regexLane({
      id: "ACCEPT.CURATED.WORKFLOW.2116",
      capability: "algorithmic-art-workflow",
      summary: "bounded generative-art and visual-code artifact workflow motion",
      actionKinds: ["fs.read", "fs.write", "fs.append"],
      targetPatterns: [workspaceFilePattern(rootPath, ["js", "ts", "jsx", "tsx", "html", "svg", "png", "json"])],
      requestTextPatterns: ["algorithmic-art", "p5", "fractal", "generative art", "visual composition"],
    }),
    regexLane({
      id: "ACCEPT.CURATED.WORKFLOW.2117",
      capability: "video-artifact-workflow",
      summary: "bounded video, motion, and render artifact workflow motion",
      actionKinds: ["fs.read", "fs.write", "fs.append"],
      targetPatterns: [workspaceFilePattern(rootPath, ["tsx", "ts", "js", "json", "mp4", "mov", "gif", "webm"])],
      requestTextPatterns: ["remotion", "video generation", "motion graphics", "render video", "timeline"],
    }),
    regexLane({
      id: "ACCEPT.CURATED.WORKFLOW.2118",
      capability: "marketing-content-workflow",
      summary: "bounded campaign, brand, SEO, and content workflow motion",
      actionKinds: ["fs.read", "fs.write", "fs.append", "chat.emit"],
      targetPatterns: [workspaceFilePattern(rootPath, ["md", "txt", "html", "csv", "json", "xml"])],
      requestTextPatterns: ["marketing", "campaign", "seo", "brand", "copy", "content pipeline"],
    }),
    regexLane({
      id: "ACCEPT.CURATED.WORKFLOW.2119",
      capability: "obsidian-vault-workflow",
      summary: "bounded vault, note-linking, and PKM workflow motion",
      actionKinds: ["fs.read", "fs.write", "fs.append", "fs.move"],
      targetPatterns: [workspaceFilePattern(rootPath, ["md", "canvas", "json"])],
      requestTextPatterns: ["obsidian", "vault", "auto-link", "knowledge graph", "daily note"],
    }),
    regexLane({
      id: "ACCEPT.CURATED.WORKFLOW.2120",
      capability: "firecrawl-workflow",
      summary: "bounded crawl, extract, and LLM-ready web data workflow motion",
      actionKinds: ["network.send"],
      targetPatterns: [
        "/^(?:https?:\\/\\/)?(?:api\\.)?firecrawl\\.dev(?:\\/|$)/i",
        "/^(?:https?:\\/\\/)?(?:www\\.)?firecrawl\\.dev(?:\\/|$)/i",
      ],
      requestTextPatterns: ["firecrawl", "crawl website", "extract website", "web data"],
    }),
    regexLane({
      id: "ACCEPT.CURATED.WORKFLOW.2121",
      capability: "data-query-workflow",
      summary: "bounded SQL, workbook, and analytics report workflow motion",
      actionKinds: ["fs.read", "fs.write", "fs.append"],
      targetPatterns: [workspaceFilePattern(rootPath, ["sql", "csv", "tsv", "xlsx", "xls", "json", "parquet", "md"])],
      requestTextPatterns: ["sql", "query", "analytics", "report", "dashboard", "spreadsheet"],
    }),
    regexLane({
      id: "ACCEPT.CURATED.WORKFLOW.2122",
      capability: "app-builder-workflow",
      summary: "bounded spec-driven app, copilot, and flow-builder workflow motion",
      actionKinds: ["fs.read", "fs.write", "fs.append"],
      targetPatterns: [workspaceFilePattern(rootPath, ["ts", "tsx", "js", "jsx", "json", "yaml", "yml", "md"])],
      requestTextPatterns: ["spec-kit", "copilotkit", "langflow", "dspy", "app builder", "flow builder"],
    }),
    regexLane({
      id: "ACCEPT.CURATED.WORKFLOW.2123",
      capability: "mcp-factory-workflow",
      summary: "bounded MCP server, hub, and connector factory workflow motion",
      actionKinds: ["fs.read", "fs.write", "fs.append"],
      targetPatterns: [workspaceFilePattern(rootPath, ["py", "ts", "js", "json", "yaml", "yml", "toml", "md"])],
      requestTextPatterns: ["fastmcp", "mcphub", "mcp builder", "connector", "server scaffold"],
    }),
  ] as const;
}
