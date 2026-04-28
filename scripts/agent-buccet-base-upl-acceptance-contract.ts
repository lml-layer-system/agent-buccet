import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import type { BoundaryActionKind, BoundaryActionRequest } from "../lib/agent-buccet/index.ts";

function makeRequest(args: {
  sessionId: string;
  actionKind: BoundaryActionKind;
  target: string;
  payloadSummary?: string;
}): BoundaryActionRequest {
  return {
    requestId: `${args.actionKind}:${args.target}`,
    sessionId: args.sessionId,
    actionKind: args.actionKind,
    target: args.target,
    payloadSummary: args.payloadSummary,
    requestedAt: new Date().toISOString(),
    provenance: "agent_inference",
  };
}

async function main() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-buccet-base-upl-acceptance-"));
  const previousCwd = process.cwd();
  const ledgerPath = path.join(tempRoot, "user-path-ledger.json");
  const previousLedgerPath = process.env.AGENT_BUCCET_UPL_LEDGER_PATH;
  process.env.AGENT_BUCCET_UPL_LEDGER_PATH = ledgerPath;
  process.chdir(tempRoot);
  await fs.cp(
    path.join(import.meta.dirname, "..", "data", "agent-buccet-law-foundation"),
    path.join(tempRoot, "data", "agent-buccet-law-foundation"),
    { recursive: true },
  );

  try {
    const boundary = await import("../lib/agent-buccet/index.ts");
    const sessionId = `agent-buccet-base-upl-acceptance-${Date.now()}`;
    const actorId = "user:base-upl-acceptance-contract";
    const workspace = path.join(tempRoot, "workspace");
    const outputsDir = path.join(workspace, "outputs");
    const secretsDir = path.join(workspace, "secrets");
    await fs.mkdir(outputsDir, { recursive: true });
    await fs.mkdir(secretsDir, { recursive: true });
    await fs.writeFile(path.join(workspace, "README.md"), "workspace read\n", "utf8");
    await fs.writeFile(path.join(secretsDir, "api.txt"), "secret\n", "utf8");

    const store = await boundary.createPersistentBoundaryRuntimeStore({
      sessionId,
      actorId,
    });
    const grantedActions: BoundaryActionKind[] = [
      "fs.read",
      "fs.write",
      "fs.append",
      "fs.delete",
      "fs.mkdir",
      "fs.move",
    ];
    const { config } = await boundary.openBoundaryPath({
      config: store.getConfig(),
      rootPath: workspace,
      grantedActions,
      issuedBy: actorId,
    });
    store.replaceConfig(config);

    const upl = await boundary.loadUserPathLedger();
    const baseAcceptanceEntries = upl.userApprovedLawPaths.filter((entry) =>
      entry.status === "ACTIVE" &&
      entry.scope === "SESSION" &&
      entry.sessionId === sessionId &&
      entry.notes?.includes("Buccet base acceptance pack")
    );
    assert.equal(baseAcceptanceEntries.length, 297, "expected base acceptance pack to seed two hundred ninety-seven session-scoped entries");
    assert.ok(
      baseAcceptanceEntries.some((entry) => entry.notes?.includes("[workspace_read]")),
      "expected workspace read rail",
    );
    assert.ok(
      baseAcceptanceEntries.some((entry) => entry.notes?.includes("[workspace_mutation]")),
      "expected workspace mutation rail",
    );
    assert.ok(
      baseAcceptanceEntries.some((entry) => entry.notes?.includes("[local_organization]")),
      "expected local organization rail",
    );
    assert.ok(
      baseAcceptanceEntries.some((entry) => entry.notes?.includes("[internal_artifacts]")),
      "expected internal artifacts rail",
    );
    assert.ok(
      baseAcceptanceEntries.some((entry) => entry.notes?.includes("[notes_and_tasks]")),
      "expected notes and tasks rail",
    );
    assert.ok(
      baseAcceptanceEntries.some((entry) => entry.notes?.includes("[safe_local_exec]")),
      "expected safe local exec rail",
    );
    assert.ok(
      baseAcceptanceEntries.some((entry) => entry.notes?.includes("[bounded_web_research]")),
      "expected bounded web research rail",
    );
    assert.ok(
      baseAcceptanceEntries.some((entry) => entry.notes?.includes("[agent_spend]")),
      "expected agent spend rail",
    );
    assert.ok(
      baseAcceptanceEntries.some((entry) => entry.notes?.includes("[agent_comprehension]")),
      "expected agent comprehension rail",
    );
    assert.ok(
      baseAcceptanceEntries.some((entry) =>
        entry.trackConstraint?.description?.includes("ACCEPT.AGENT.COMPREHENSION.0001")
      ),
      "expected agent comprehension pass-required rail",
    );
    assert.ok(
      baseAcceptanceEntries.some((entry) =>
        entry.trackConstraint?.description?.includes("ACCEPT.AGENT.COMPREHENSION.0010")
      ),
      "expected agent bounded-by-upl-track rail",
    );
    assert.ok(
      baseAcceptanceEntries.some((entry) => entry.trackConstraint?.description?.includes("ACCEPT.SAFE.LOCAL.EXEC.005E")),
      "expected gh CLI exec rail",
    );
    assert.ok(
      baseAcceptanceEntries.some((entry) => entry.trackConstraint?.description?.includes("ACCEPT.SAFE.LOCAL.EXEC.005F")),
      "expected bun exec rail",
    );
    assert.ok(
      baseAcceptanceEntries.some((entry) => entry.trackConstraint?.description?.includes("ACCEPT.BOUNDED.WEB.RESEARCH.006D")),
      "expected developer Q&A and cloud docs web research rail",
    );
    const approvedMerchantSpend = baseAcceptanceEntries.find((entry) =>
      entry.trackConstraint?.description?.includes("ACCEPT.AGENT.SPEND.013A")
    );
    assert.ok(approvedMerchantSpend, "expected approved merchant spend rail");
    assert.equal(
      approvedMerchantSpend?.trackConstraint?.spendMaxAmountNormalized,
      25,
      "expected approved merchant spend rail to bind the micro limit",
    );
    assert.deepEqual(
      approvedMerchantSpend?.trackConstraint?.spendAllowedDestinationKinds,
      ["merchant"],
      "expected approved merchant spend rail to bind merchant destinations",
    );
    assert.deepEqual(
      approvedMerchantSpend?.trackConstraint?.spendAllowedCommitIntents,
      ["purchase", "authorize"],
      "expected approved merchant spend rail to bind purchase-style commit intents",
    );
    const approvedWalletSpend = baseAcceptanceEntries.find((entry) =>
      entry.trackConstraint?.description?.includes("ACCEPT.AGENT.SPEND.013B")
    );
    assert.ok(approvedWalletSpend, "expected approved wallet spend rail");
    assert.equal(
      approvedWalletSpend?.trackConstraint?.spendMaxAmountNormalized,
      10,
      "expected approved wallet spend rail to bind the wallet micro limit",
    );
    assert.deepEqual(
      approvedWalletSpend?.trackConstraint?.spendAllowedDestinationKinds,
      ["wallet", "account"],
      "expected approved wallet spend rail to bind wallet and account destinations",
    );
    assert.ok(
      baseAcceptanceEntries.some((entry) => entry.requestBasis?.target === "tmux"),
      "expected tmux OpenClaw skill rail",
    );
    assert.ok(
      baseAcceptanceEntries.some((entry) => entry.requestBasis?.target === "weather"),
      "expected weather OpenClaw skill rail",
    );
    assert.ok(
      baseAcceptanceEntries.some((entry) => entry.requestBasis?.target === "notion"),
      "expected notion OpenClaw skill rail",
    );
    assert.ok(
      baseAcceptanceEntries.some((entry) => entry.requestBasis?.target === "telegram"),
      "expected telegram OpenClaw skill rail",
    );
    assert.ok(
      baseAcceptanceEntries.some((entry) => entry.requestBasis?.target === "whatsapp"),
      "expected whatsapp OpenClaw skill rail",
    );
    assert.ok(
      baseAcceptanceEntries.some((entry) => entry.requestBasis?.target === "agent-mail"),
      "expected agent-mail awesome OpenClaw skill rail",
    );
    assert.ok(
      baseAcceptanceEntries.some((entry) => entry.requestBasis?.target === "google-calendar"),
      "expected google-calendar awesome OpenClaw skill rail",
    );
    assert.ok(
      baseAcceptanceEntries.some((entry) => entry.requestBasis?.target === "audio-transcribe"),
      "expected audio-transcribe awesome OpenClaw skill rail",
    );
    assert.ok(
      baseAcceptanceEntries.some((entry) => entry.requestBasis?.target === "azure-devops"),
      "expected azure-devops awesome OpenClaw skill rail",
    );
    assert.ok(
      baseAcceptanceEntries.some((entry) => entry.requestBasis?.target === "docx"),
      "expected docx curated capability entry",
    );
    assert.ok(
      baseAcceptanceEntries.some((entry) => entry.requestBasis?.target === "frontend-design"),
      "expected frontend-design curated capability entry",
    );
    assert.ok(
      baseAcceptanceEntries.some((entry) => entry.requestBasis?.target === "tavily"),
      "expected tavily curated capability entry",
    );
    assert.ok(
      baseAcceptanceEntries.some((entry) => entry.requestBasis?.target === "task-master-ai"),
      "expected task-master-ai curated capability entry",
    );
    assert.ok(
      baseAcceptanceEntries.some((entry) => entry.requestBasis?.target === "brand-guidelines"),
      "expected brand-guidelines curated capability entry",
    );
    assert.ok(
      baseAcceptanceEntries.some((entry) => entry.requestBasis?.target === "pdf-processing"),
      "expected pdf-processing curated capability entry",
    );
    assert.ok(
      baseAcceptanceEntries.some((entry) => entry.requestBasis?.target === "algorithmic-art"),
      "expected algorithmic-art curated capability entry",
    );
    assert.ok(
      baseAcceptanceEntries.some((entry) => entry.requestBasis?.target === "marketing-skills"),
      "expected marketing-skills curated capability entry",
    );
    assert.ok(
      baseAcceptanceEntries.some((entry) => entry.requestBasis?.target === "firecrawl"),
      "expected firecrawl curated capability entry",
    );
    assert.ok(
      baseAcceptanceEntries.some((entry) => entry.requestBasis?.target === "fastmcp"),
      "expected fastmcp curated capability entry",
    );
    assert.ok(
      baseAcceptanceEntries.some((entry) => entry.requestBasis?.target === "spec-kit"),
      "expected spec-kit curated capability entry",
    );
    assert.ok(
      baseAcceptanceEntries.some((entry) => entry.requestBasis?.target === "copilotkit"),
      "expected copilotkit curated capability entry",
    );
    assert.ok(
      baseAcceptanceEntries.some((entry) => entry.requestBasis?.target === "langflow"),
      "expected langflow curated capability entry",
    );
    assert.ok(
      baseAcceptanceEntries.some((entry) => entry.requestBasis?.target === "simonw-llm"),
      "expected simonw-llm curated capability entry",
    );
    assert.ok(
      baseAcceptanceEntries.some((entry) => entry.requestBasis?.target === "ai-failure-periodic-table"),
      "expected ai-failure-periodic-table curated capability entry",
    );
    assert.ok(
      baseAcceptanceEntries.some((entry) => entry.requestBasis?.target === "openclaw-pr-maintainer"),
      "expected openclaw-pr-maintainer marketplace entry",
    );
    assert.ok(
      baseAcceptanceEntries.some((entry) => entry.requestBasis?.target === "ai-content-pipeline"),
      "expected ai-content-pipeline marketplace entry",
    );
    assert.ok(
      baseAcceptanceEntries.some((entry) => entry.requestBasis?.target === "webapp-testing"),
      "expected webapp-testing marketplace entry",
    );
    assert.ok(
      baseAcceptanceEntries.some((entry) => entry.requestBasis?.target === "agent-skills-evaluation"),
      "expected agent-skills-evaluation marketplace entry",
    );
    assert.ok(
      baseAcceptanceEntries.some((entry) => entry.requestBasis?.target === "data-analyst"),
      "expected data-analyst marketplace entry",
    );
    assert.ok(
      baseAcceptanceEntries.some((entry) => entry.requestBasis?.target === "ui-ux-pro-max"),
      "expected ui-ux-pro-max marketplace entry",
    );
    assert.ok(
      baseAcceptanceEntries.some((entry) => entry.requestBasis?.target === "workflow-orchestrator"),
      "expected workflow-orchestrator marketplace entry",
    );
    assert.ok(
      baseAcceptanceEntries.some((entry) => entry.requestBasis?.target === "test-data-management"),
      "expected test-data-management marketplace entry",
    );
    assert.ok(
      baseAcceptanceEntries.some((entry) => entry.requestBasis?.target === "browser-automation"),
      "expected browser-automation marketplace entry",
    );
    assert.ok(
      baseAcceptanceEntries.some((entry) => entry.requestBasis?.target === "google-workspace-cli"),
      "expected google-workspace-cli marketplace entry",
    );
    assert.ok(
      baseAcceptanceEntries.some((entry) => entry.requestBasis?.target === "agent-browser"),
      "expected agent-browser marketplace entry",
    );
    assert.ok(
      baseAcceptanceEntries.some((entry) => entry.requestBasis?.target === "mcp-builder"),
      "expected mcp-builder marketplace entry",
    );
    assert.ok(
      baseAcceptanceEntries.some((entry) => entry.requestBasis?.target === "email-composer"),
      "expected email-composer marketplace entry",
    );
    assert.ok(
      baseAcceptanceEntries.some((entry) => entry.requestBasis?.target === "agent-skills-validation"),
      "expected agent-skills-validation marketplace entry",
    );
    assert.ok(
      baseAcceptanceEntries.some((entry) => entry.requestBasis?.target === "gws-workspace"),
      "expected gws-workspace marketplace entry",
    );
    assert.ok(
      baseAcceptanceEntries.some((entry) => entry.requestBasis?.target === "n8n"),
      "expected n8n marketplace entry",
    );
    assert.ok(
      baseAcceptanceEntries.some((entry) => entry.requestBasis?.target === "n8n-automation"),
      "expected n8n-automation marketplace entry",
    );
    assert.ok(
      baseAcceptanceEntries.some((entry) => entry.requestBasis?.target === "playwright-mcp"),
      "expected playwright-mcp marketplace entry",
    );
    assert.ok(
      baseAcceptanceEntries.some((entry) => entry.trackConstraint?.description?.includes("ACCEPT.CURATED.WORKFLOW.2101")),
      "expected docx workflow entry",
    );
    assert.ok(
      baseAcceptanceEntries.some((entry) => entry.trackConstraint?.description?.includes("ACCEPT.CURATED.WORKFLOW.2110")),
      "expected Tavily workflow entry",
    );
    assert.ok(
      baseAcceptanceEntries.some((entry) => entry.trackConstraint?.description?.includes("ACCEPT.CURATED.WORKFLOW.2115")),
      "expected pdf workflow entry",
    );
    assert.ok(
      baseAcceptanceEntries.some((entry) => entry.trackConstraint?.description?.includes("ACCEPT.CURATED.WORKFLOW.2120")),
      "expected firecrawl workflow entry",
    );
    assert.ok(
      baseAcceptanceEntries.some((entry) => entry.trackConstraint?.description?.includes("ACCEPT.CURATED.WORKFLOW.2123")),
      "expected mcp factory workflow entry",
    );
    assert.ok(
      !baseAcceptanceEntries.some((entry) => entry.requestBasis?.target === "1password"),
      "expected credential-vault skill to stay out of the base acceptance pack",
    );
    assert.ok(
      !baseAcceptanceEntries.some((entry) => entry.requestBasis?.target === "camsnap"),
      "expected camera capture skill to stay out of the base acceptance pack",
    );

    const readDecision = await boundary.evaluateBoundaryAction(config, makeRequest({
      sessionId,
      actionKind: "fs.read",
      target: path.join(workspace, "README.md"),
      payloadSummary: "read:utf8",
    }));
    assert.equal(readDecision.result.decision, "allow", "expected workspace read to allow on contact");

    const writeDecision = await boundary.evaluateBoundaryAction(config, makeRequest({
      sessionId,
      actionKind: "fs.write",
      target: path.join(workspace, "src", "index.ts"),
      payloadSummary: "write:12bytes",
    }));
    assert.equal(writeDecision.result.decision, "allow", "expected workspace write to allow on contact");

    const artifactDecision = await boundary.evaluateBoundaryAction(config, makeRequest({
      sessionId,
      actionKind: "fs.append",
      target: path.join(outputsDir, "report.txt"),
      payloadSummary: "append:12bytes",
    }));
    assert.equal(artifactDecision.result.decision, "allow", "expected outputs write to allow on contact");

    const mkdirDecision = await boundary.evaluateBoundaryAction(config, makeRequest({
      sessionId,
      actionKind: "fs.mkdir",
      target: path.join(workspace, "notes"),
    }));
    assert.equal(mkdirDecision.result.decision, "allow", "expected local organization rail to allow mkdir");

    const notesDecision = await boundary.evaluateBoundaryAction(config, makeRequest({
      sessionId,
      actionKind: "fs.write",
      target: path.join(workspace, "notes", "todo.md"),
      payloadSummary: "write:12bytes",
    }));
    assert.equal(notesDecision.result.decision, "allow", "expected notes and tasks rail to allow local note writes");

    const execDecision = await boundary.evaluateBoundaryAction(config, makeRequest({
      sessionId,
      actionKind: "tool.exec",
      target: "git",
      payloadSummary: "git status",
    }));
    assert.equal(execDecision.result.decision, "allow", "expected safe local exec rail to allow bounded git inspection");

    const researchDecision = await boundary.evaluateBoundaryAction(config, makeRequest({
      sessionId,
      actionKind: "network.send",
      target: "https://developer.mozilla.org/en-US/docs/Web/JavaScript",
      payloadSummary: "fetch docs reference",
    }));
    assert.equal(researchDecision.result.decision, "allow", "expected bounded web research rail to allow documentation fetch");

    const tmuxSkillDecision = await boundary.evaluateBoundaryAction(config, makeRequest({
      sessionId,
      actionKind: "tool.exec",
      target: "tmux",
      payloadSummary: "tmux skill attach session",
    }));
    assert.equal(tmuxSkillDecision.result.decision, "allow", "expected tmux OpenClaw skill rail to allow named tmux skill motion");

    const weatherSkillDecision = await boundary.evaluateBoundaryAction(config, makeRequest({
      sessionId,
      actionKind: "network.send",
      target: "https://api.weather.gov/points/39.7456,-97.0892",
      payloadSummary: "weather forecast lookup",
    }));
    assert.equal(weatherSkillDecision.result.decision, "allow", "expected weather OpenClaw skill rail to allow bounded weather-domain motion");

    const notionSkillDecision = await boundary.evaluateBoundaryAction(config, makeRequest({
      sessionId,
      actionKind: "network.send",
      target: "https://api.notion.com/v1/pages",
      payloadSummary: "notion page update request",
    }));
    assert.equal(notionSkillDecision.result.decision, "allow", "expected notion OpenClaw skill rail to allow bounded notion-domain motion");

    const slackChannelDecision = await boundary.evaluateBoundaryAction(config, makeRequest({
      sessionId,
      actionKind: "chat.emit",
      target: "slack",
      payloadSummary: "slack notify channel",
    }));
    assert.equal(slackChannelDecision.result.decision, "allow", "expected slack OpenClaw skill rail to allow channel-shaped chat delivery");

    const telegramChannelDecision = await boundary.evaluateBoundaryAction(config, makeRequest({
      sessionId,
      actionKind: "chat.emit",
      target: "telegram",
      payloadSummary: "telegram bot delivery",
    }));
    assert.equal(telegramChannelDecision.result.decision, "allow", "expected telegram OpenClaw skill rail to allow channel-shaped chat delivery");

    const whatsappChannelDecision = await boundary.evaluateBoundaryAction(config, makeRequest({
      sessionId,
      actionKind: "chat.emit",
      target: "whatsapp",
      payloadSummary: "whatsapp delivery",
    }));
    assert.equal(whatsappChannelDecision.result.decision, "allow", "expected whatsapp OpenClaw skill rail to allow channel-shaped chat delivery");

    const slackNetworkDecision = await boundary.evaluateBoundaryAction(config, makeRequest({
      sessionId,
      actionKind: "network.send",
      target: "slack",
      payloadSummary: "slack api call",
    }));
    assert.notEqual(slackNetworkDecision.result.decision, "allow", "expected slack raw network motion to stay outside the base acceptance pack");

    const credentialSkillDecision = await boundary.evaluateBoundaryAction(config, makeRequest({
      sessionId,
      actionKind: "sys.credential.use",
      target: "1password",
      payloadSummary: "use vault secret",
    }));
    assert.notEqual(credentialSkillDecision.result.decision, "allow", "expected credential vault use to stay outside the base acceptance pack");

    const cameraSkillDecision = await boundary.evaluateBoundaryAction(config, makeRequest({
      sessionId,
      actionKind: "tool.exec",
      target: "camsnap",
      payloadSummary: "capture camera snapshot",
    }));
    assert.notEqual(cameraSkillDecision.result.decision, "allow", "expected camera capture skill to stay outside the base acceptance pack");

    const agentMailDecision = await boundary.evaluateBoundaryAction(config, makeRequest({
      sessionId,
      actionKind: "comm.send",
      target: "agent-mail",
      payloadSummary: "agent-mail draft reply",
    }));
    assert.equal(agentMailDecision.result.decision, "allow", "expected agent-mail awesome rail to allow bounded inbox delivery motion");

    const googleCalendarDecision = await boundary.evaluateBoundaryAction(config, makeRequest({
      sessionId,
      actionKind: "network.send",
      target: "https://calendar.googleapis.com/calendar/v3/calendars/primary/events",
      payloadSummary: "google-calendar create event",
    }));
    assert.equal(googleCalendarDecision.result.decision, "allow", "expected google-calendar awesome rail to allow bounded calendar-domain motion");

    const audioTranscribeDecision = await boundary.evaluateBoundaryAction(config, makeRequest({
      sessionId,
      actionKind: "tool.exec",
      target: "audio-transcribe",
      payloadSummary: "audio-transcribe local voice message",
    }));
    assert.equal(audioTranscribeDecision.result.decision, "allow", "expected audio-transcribe awesome rail to allow local transcription motion");

    const azureDevopsDecision = await boundary.evaluateBoundaryAction(config, makeRequest({
      sessionId,
      actionKind: "network.send",
      target: "https://dev.azure.com/example/project/_apis/projects",
      payloadSummary: "azure-devops list projects",
    }));
    assert.equal(azureDevopsDecision.result.decision, "allow", "expected azure-devops awesome rail to allow bounded Azure DevOps motion");

    const docxDecision = await boundary.evaluateBoundaryAction(config, makeRequest({
      sessionId,
      actionKind: "tool.exec",
      target: "docx",
      payloadSummary: "docx tracked changes edit",
    }));
    assert.equal(docxDecision.result.decision, "allow", "expected docx curated capability entry to allow document workflow motion");

    const frontendDesignDecision = await boundary.evaluateBoundaryAction(config, makeRequest({
      sessionId,
      actionKind: "tool.exec",
      target: "frontend-design",
      payloadSummary: "frontend-design dashboard redesign",
    }));
    assert.equal(frontendDesignDecision.result.decision, "allow", "expected frontend-design curated capability entry to allow design workflow motion");

    const tavilyDecision = await boundary.evaluateBoundaryAction(config, makeRequest({
      sessionId,
      actionKind: "network.send",
      target: "tavily",
      payloadSummary: "tavily search competitor landscape",
    }));
    assert.equal(tavilyDecision.result.decision, "allow", "expected tavily curated capability entry to allow structured search workflow motion");

    const taskMasterDecision = await boundary.evaluateBoundaryAction(config, makeRequest({
      sessionId,
      actionKind: "tool.exec",
      target: "task-master-ai",
      payloadSummary: "task-master-ai break prd into tasks",
    }));
    assert.equal(taskMasterDecision.result.decision, "allow", "expected task-master-ai curated capability entry to allow project workflow motion");

    const brandGuidelinesDecision = await boundary.evaluateBoundaryAction(config, makeRequest({
      sessionId,
      actionKind: "chat.emit",
      target: "brand-guidelines",
      payloadSummary: "brand-guidelines rewrite homepage copy",
    }));
    assert.equal(brandGuidelinesDecision.result.decision, "allow", "expected brand-guidelines curated capability entry to allow style-bound output workflow motion");

    const openclawPrMaintainerDecision = await boundary.evaluateBoundaryAction(config, makeRequest({
      sessionId,
      actionKind: "network.send",
      target: "openclaw-pr-maintainer",
      payloadSummary: "review related pull requests and issues",
    }));
    assert.equal(openclawPrMaintainerDecision.result.decision, "allow", "expected openclaw-pr-maintainer marketplace entry to allow maintainer workflow motion");

    const aiContentPipelineDecision = await boundary.evaluateBoundaryAction(config, makeRequest({
      sessionId,
      actionKind: "chat.emit",
      target: "ai-content-pipeline",
      payloadSummary: "draft content pipeline summary",
    }));
    assert.equal(aiContentPipelineDecision.result.decision, "allow", "expected ai-content-pipeline marketplace entry to allow content workflow motion");

    const webappTestingDecision = await boundary.evaluateBoundaryAction(config, makeRequest({
      sessionId,
      actionKind: "tool.exec",
      target: "webapp-testing",
      payloadSummary: "run webapp testing workflow",
    }));
    assert.equal(webappTestingDecision.result.decision, "allow", "expected webapp-testing marketplace entry to allow app testing workflow motion");

    const agentSkillsEvaluationDecision = await boundary.evaluateBoundaryAction(config, makeRequest({
      sessionId,
      actionKind: "tool.exec",
      target: "agent-skills-evaluation",
      payloadSummary: "evaluate current skill package",
    }));
    assert.equal(agentSkillsEvaluationDecision.result.decision, "allow", "expected agent-skills-evaluation marketplace entry to allow skill evaluation workflow motion");

    const dataAnalystDecision = await boundary.evaluateBoundaryAction(config, makeRequest({
      sessionId,
      actionKind: "tool.exec",
      target: "data-analyst",
      payloadSummary: "analyze customer cohort data",
    }));
    assert.equal(dataAnalystDecision.result.decision, "allow", "expected data-analyst marketplace entry to allow data workflow motion");

    const uiUxDecision = await boundary.evaluateBoundaryAction(config, makeRequest({
      sessionId,
      actionKind: "chat.emit",
      target: "ui-ux-pro-max",
      payloadSummary: "review dashboard layout and accessibility",
    }));
    assert.equal(uiUxDecision.result.decision, "allow", "expected ui-ux-pro-max marketplace entry to allow design workflow motion");

    const workflowOrchestratorDecision = await boundary.evaluateBoundaryAction(config, makeRequest({
      sessionId,
      actionKind: "db.update",
      target: "workflow-orchestrator",
      payloadSummary: "update project workflow status",
    }));
    assert.equal(workflowOrchestratorDecision.result.decision, "allow", "expected workflow-orchestrator marketplace entry to allow workflow orchestration motion");

    const testDataManagementDecision = await boundary.evaluateBoundaryAction(config, makeRequest({
      sessionId,
      actionKind: "tool.exec",
      target: "test-data-management",
      payloadSummary: "generate synthetic qa test data",
    }));
    assert.equal(testDataManagementDecision.result.decision, "allow", "expected test-data-management marketplace entry to allow test-data workflow motion");

    const tavilyWorkflowDecision = await boundary.evaluateBoundaryAction(config, makeRequest({
      sessionId,
      actionKind: "network.send",
      target: "https://api.tavily.com/search",
      payloadSummary: "tavily search competitor landscape",
    }));
    assert.equal(tavilyWorkflowDecision.result.decision, "allow", "expected Tavily workflow entry to allow bounded provider motion");

    const notebooklmWorkflowDecision = await boundary.evaluateBoundaryAction(config, makeRequest({
      sessionId,
      actionKind: "network.send",
      target: "https://notebooklm.google.com/",
      payloadSummary: "notebooklm build study notebook",
    }));
    assert.equal(notebooklmWorkflowDecision.result.decision, "allow", "expected NotebookLM workflow entry to allow bounded provider motion");

    const deleteDecision = await boundary.evaluateBoundaryAction(config, makeRequest({
      sessionId,
      actionKind: "fs.delete",
      target: path.join(workspace, "README.md"),
    }));
    assert.equal(deleteDecision.result.decision, "deny", "expected delete to stay outside the base acceptance pack and remain hard-denied");

    const secretDecision = await boundary.evaluateBoundaryAction(config, makeRequest({
      sessionId,
      actionKind: "fs.read",
      target: path.join(secretsDir, "api.txt"),
      payloadSummary: "read:utf8",
    }));
    assert.equal(secretDecision.result.decision, "deny", "expected deny wall to cut out workspace secrets");
    assert.ok(
      secretDecision.result.triggeredLawIds.some((id) => id.startsWith("DENY.SECRETS.ACCESS.003")),
      "expected secret access denial to come from the base denial pack",
    );

    const failureClassifierDecision = await boundary.evaluateBoundaryAction(config, makeRequest({
      sessionId,
      actionKind: "tool.exec",
      target: "ai-failure-periodic-table",
      payloadSummary: "classify failure mode periodic table failure dimension analysis",
    }));
    assert.equal(failureClassifierDecision.result.decision, "allow", "expected failure classifier rail to allow failure-mode analysis motion without headless denial");

    const gitPushDecision = await boundary.evaluateBoundaryAction(config, makeRequest({
      sessionId,
      actionKind: "tool.exec",
      target: "git",
      payloadSummary: "git push origin main",
    }));
    assert.equal(gitPushDecision.result.decision, "allow", "expected git push to allow on base acceptance pack");

    const ghPrDecision = await boundary.evaluateBoundaryAction(config, makeRequest({
      sessionId,
      actionKind: "tool.exec",
      target: "gh",
      payloadSummary: "gh pr create --title fix --body fix",
    }));
    assert.equal(ghPrDecision.result.decision, "allow", "expected gh CLI rail to allow bounded pr creation motion");

    const bunTestDecision = await boundary.evaluateBoundaryAction(config, makeRequest({
      sessionId,
      actionKind: "tool.exec",
      target: "bun",
      payloadSummary: "bun test",
    }));
    assert.equal(bunTestDecision.result.decision, "allow", "expected bun exec rail to allow bounded bun test motion");

    const stackoverflowDecision = await boundary.evaluateBoundaryAction(config, makeRequest({
      sessionId,
      actionKind: "network.send",
      target: "https://stackoverflow.com/questions/12345/how-to-git",
      payloadSummary: "fetch stackoverflow answer",
    }));
    assert.equal(stackoverflowDecision.result.decision, "allow", "expected developer Q&A rail to allow stackoverflow fetch");

    const unsafeExecDecision = await boundary.evaluateBoundaryAction(config, makeRequest({
      sessionId,
      actionKind: "tool.exec",
      target: "git",
      payloadSummary: "git clean -fdx",
    }));
    assert.notEqual(unsafeExecDecision.result.decision, "allow", "expected destructive git clean to stay outside automatic allowance");

  } finally {
    process.chdir(previousCwd);
    if (previousLedgerPath === undefined) {
      delete process.env.AGENT_BUCCET_UPL_LEDGER_PATH;
    } else {
      process.env.AGENT_BUCCET_UPL_LEDGER_PATH = previousLedgerPath;
    }
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
