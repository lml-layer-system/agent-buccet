import {
  createBoundaryBodyguard,
  createPersistentBoundaryRuntimeStore,
  loadUserPathLedger,
  renderBoundaryApprovalPrompt,
  saveUserPathLedger,
} from "../lib/agent-buccet/index.ts";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPendingApproval<T>(
  listPending: () => T[],
  timeoutMs = 1000,
): Promise<T[]> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const pending = listPending();
    if (pending.length > 0) {
      return pending;
    }
    await sleep(25);
  }
  return listPending();
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const originalLedger = await loadUserPathLedger();

  try {
    await saveUserPathLedger({
      specVersion: 1,
      userApprovedLawPaths: [],
      userDeniedLawPaths: [],
    });

    const runId = new Date().toISOString().replace(/[:.]/g, "-");
    const sessionId = `agent-buccet-chat-boundary-${runId}`;
    const actorId = "user:chat-boundary-contract";

    const store = await createPersistentBoundaryRuntimeStore({
      sessionId,
      actorId,
    });
    const bodyguard = createBoundaryBodyguard(store);

    const actionAttempt = bodyguard.enforceProposal({
      actionKind: "fs.delete",
      target: "/tmp/agent-buccet-claude-fix/README.md",
      payloadSummary: "delete:5 paths",
      reviewContext: {
        surface: "action",
        title: "Would you like to run the following command?",
        question: "Does this command match your intent?",
        attemptLines: [
          "$ rm -f /tmp/agent-buccet-claude-fix/README.md",
          "  /tmp/agent-buccet-claude-fix/lib/agent-buccet/bodyguard-engine.ts",
          "  /tmp/agent-buccet-claude-fix/docs/agent-boundary/GRAVITY_LANDING_PLAN.md",
          "  /tmp/agent-buccet-claude-fix/docs/agent-boundary/THREAT_MODEL_TRACEABILITY.md",
          "  /tmp/agent-buccet-claude-fix/docs/agent-boundary/AGENT_BOUNDARY_REPORT_20260317.md && git -C",
          "  /tmp/agent-buccet-claude-fix status --short",
        ],
        violations: [
          "destructive delete spans multiple files",
          "attempt claims complete cleanup coverage",
        ],
      },
      flags: {
        claimsCompleteCoverage: true,
      },
      execute: async () => "should-not-run",
      successReason: "command admitted by bodyguard",
    });

    const actionPending = await waitForPendingApproval(() => bodyguard.approvals.listPending());
    assert(actionPending.length === 1, "expected one pending action-boundary approval");
    const actionApproval = actionPending[0].request;
    assert(actionApproval.prompt.surface === "action", "expected action approval surface");
    const renderedActionPrompt = renderBoundaryApprovalPrompt(actionApproval);
    assert(
      renderedActionPrompt.includes("$ rm -f /tmp/agent-buccet-claude-fix/README.md"),
      "expected action prompt to include exact first command line",
    );
    assert(
      renderedActionPrompt.includes("/tmp/agent-buccet-claude-fix/lib/agent-buccet/bodyguard-engine.ts"),
      "expected action prompt to include full multi-line attempt",
    );
    assert(
      renderedActionPrompt.includes("Triggered laws:"),
      "expected action prompt to show triggered laws heading",
    );
    assert(
      renderedActionPrompt.includes("Violations:"),
      "expected action prompt to show violations heading",
    );
    bodyguard.approvals.denyOnce(actionPending[0].approvalId);
    const deniedAction = await actionAttempt;
    assert(!deniedAction.allowed, "expected action-boundary attempt to be denied");

    const lawful = await bodyguard.chat.emit({
      userInput: "say hello",
      attemptedOutput: "Hello. I can help with that.",
      execute: async () => "Hello. I can help with that.",
      successReason: "chat output emitted lawfully",
    });

    assert(lawful.allowed, "expected lawful chat output to be allowed");
    assert(lawful.executed, "expected lawful chat output to execute");
    assert(!lawful.requiresApproval, "expected lawful chat output not to require approval");

    const flaggedAttempt = bodyguard.chat.emit({
      userInput: "bring me info on batman from the 1999 comic book I do not want anything from the 2000s",
      attemptedOutput: "Batman 2003 run is the best answer for that request.",
      execute: async () => "should-not-run",
      successReason: "chat output emitted after review",
    });

    const pending = await waitForPendingApproval(() => bodyguard.approvals.listPending());
    assert(pending.length === 1, "expected one pending chat-boundary approval");

    const approval = pending[0].request;
    assert(approval.request.actionKind === "chat.emit", "expected pending approval for chat.emit");
    assert(approval.prompt.surface === "chat", "expected chat approval surface");
    assert(approval.prompt.options.length === 4, "expected four-way approval choices");
    assert(
      approval.prompt.options.map((option) => option.choice).join(",") ===
        "allow_once,allow_as_law,deny_once,deny_as_law",
      "expected full four-way approval ordering",
    );

    const renderedPrompt = renderBoundaryApprovalPrompt(approval);
    assert(renderedPrompt.includes("Triggered laws:"), "expected rendered prompt to show triggered laws heading");
    assert(renderedPrompt.includes("User input:"), "expected rendered prompt to show user input");
    assert(renderedPrompt.includes("Attempted output:"), "expected rendered prompt to show attempted output");
    assert(renderedPrompt.includes("Violations:"), "expected rendered prompt to show violations section");
    assert(
      renderedPrompt.includes("Output conflicts with the user time constraint."),
      "expected rendered prompt to infer the time-constraint invariant label",
    );
    assert(
      renderedPrompt.includes("Attempted output references 2003."),
      "expected rendered prompt to infer evidence from the attempted output",
    );
    assert(renderedPrompt.includes("No, block and make it law"), "expected rendered prompt to show deny-as-law option");

    bodyguard.approvals.denyAsLaw(pending[0].approvalId, {
      notes: "1999 only means 1999 only",
    });

    const firstDenied = await flaggedAttempt;
    assert(!firstDenied.allowed, "expected denied-as-law chat output to be blocked");
    assert(!firstDenied.executed, "expected denied-as-law chat output not to execute");
    assert(firstDenied.requiresApproval, "expected first denied chat output to have required approval");

    const repeated = await bodyguard.chat.emit({
      userInput: "bring me info on batman from the 1999 comic book I do not want anything from the 2000s",
      attemptedOutput: "Batman 2003 run is the best answer for that request.",
      execute: async () => "should-not-run",
      successReason: "chat output emitted after review",
    });

    assert(!repeated.allowed, "expected standing UPL deny to block repeated chat output");
    assert(!repeated.executed, "expected standing UPL deny to skip execution");
    assert(!repeated.requiresApproval, "expected standing UPL deny to avoid re-prompt");

    const updatedLedger = await loadUserPathLedger();
    assert(updatedLedger.userDeniedLawPaths.length === 1, "expected one denied UPL law after deny_as_law");

    console.log("Agent Buccet chat boundary contract");
    console.log("---ACTION PROMPT---");
    console.log(renderedActionPrompt);
    console.log("---CHAT PROMPT---");
    console.log(renderedPrompt);
    console.log(`lawful chat allowed: ${lawful.allowed}`);
    console.log(`flagged prompt options: ${approval.prompt.options.length}`);
    console.log(`rendered prompt surface: ${approval.prompt.surface}`);
    console.log(`repeated flagged chat allowed: ${repeated.allowed}`);
    console.log(`standing denied laws: ${updatedLedger.userDeniedLawPaths.length}`);
  } finally {
    await saveUserPathLedger(originalLedger);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
