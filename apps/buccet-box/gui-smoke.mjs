/**
 * REAL GUI SMOKE TEST.
 *
 * Launches the actual Agent Buccet Electron process under a virtual X display,
 * clicks the actual renderer controls through Playwright, injects decisions via
 * the real authenticated localhost bridge, and records real-window screenshots.
 *
 * This does not emulate Hermes/Cursor's other host-native tools. It proves
 * desktop surface and bridge behavior only, not complete host interception.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { _electron as electron } from "playwright";
import { appendBoundaryLedger } from "../../src/proof/ledger.ts";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(appDir, "../..");
const evidenceDir = path.resolve(
  process.env.BUCCET_BOX_EVIDENCE_DIR ?? path.join(repoRoot, "dist", "box-gui-evidence"),
);
const electronBin = path.join(
  appDir, "node_modules", "electron", "dist",
  process.platform === "win32" ? "electron.exe" : "electron",
);

const proposal = (requestId, actionKind = "network.send") => ({
  requestId,
  sessionId: "gui-test-session",
  actorId: "test-agent",
  actionKind,
  target: "https://blocked.example.test/upload",
  reason: "Outside established UPL network authority",
  payloadSummary: "test-file.csv (non-sensitive simulation)",
  lawIds: ["GUI.SMOKE.01"],
  question: "Should this agent send the test file?",
});

function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function poll(fn, timeoutMs = 15000) {
  const expires = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < expires) {
    try {
      const value = await fn();
      if (value) return value;
    } catch (error) { lastError = error; }
    await delay(100);
  }
  throw new Error(`Timed out waiting for GUI state: ${lastError?.message ?? "predicate not satisfied"}`);
}

async function main() {
  assert.ok(process.env.DISPLAY, "Must launch GUI smoke under Xvfb (DISPLAY required)");
  assert.ok(existsSync(electronBin), `Electron executable missing: ${electronBin}`);
  await mkdir(evidenceDir, { recursive: true });
  const home = await mkdtemp(path.join(os.tmpdir(), "agent-buccet-real-gui-"));
  const bridgeFile = path.join(home, "box", "bridge.json");
  let desktop;
  let page;
  const assertions = [];

  try {
    desktop = await electron.launch({
      executablePath: electronBin,
      args: ["--no-sandbox", appDir],
      cwd: appDir,
      env: {
        ...process.env,
        AGENT_BUCCET_HOME: home,
        ELECTRON_DISABLE_SECURITY_WARNINGS: "true",
      },
      timeout: 60000,
    });
    page = await desktop.firstWindow();
    page.setDefaultTimeout(20000);
    await poll(async () => (await page.locator("#bridge-status").textContent())?.includes("Box active"));
    assert.match(await page.title(), /Agent Buccet/);
    assertions.push("Actual Electron app window opened with a live local bridge");
    await page.screenshot({ path: path.join(evidenceDir, "01-real-window-initial.png") });

    const config = JSON.parse(await readFile(bridgeFile, "utf8"));
    assert.match(config.origin, /^http:\/\/127\.0\.0\.1:\d+\/$/);
    assert.match(config.token, /^[a-f0-9]{64}$/);
    async function api(route, body) {
      const response = await fetch(new URL(route, config.origin), {
        method: "POST",
        headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      assert.equal(response.status, 200, `Unexpected ${route} status ${response.status}`);
      return response.json();
    }

    async function signFixtureEvent(event) {
      // Renderer tests use signed synthetic ledger receipts, not invented
      // allow/deny claims. The Box must verify before displaying them.
      const previous = process.env.AGENT_BUCCET_HOME;
      process.env.AGENT_BUCCET_HOME = home;
      try {
        await appendBoundaryLedger(
          event.decision === "allow" ? "ACTION_EXECUTED" : "ACTION_BLOCKED",
          {
            sessionId: "gui-verification-fixture",
            actorId: event.actorId,
            requestId: event.requestId,
            actionKind: event.actionKind,
            target: event.target,
            decision: event.decision,
            reason: event.reason,
            createdAt: new Date().toISOString(),
          },
        );
      } finally {
        if (previous === undefined) delete process.env.AGENT_BUCCET_HOME;
        else process.env.AGENT_BUCCET_HOME = previous;
      }
    }

    async function signFixtureApproval(item) {
      // Match the real runtime: cryptographically bind the prompt and payload
      // before the local UI is allowed to display it.
      const previous = process.env.AGENT_BUCCET_HOME;
      process.env.AGENT_BUCCET_HOME = home;
      try {
        await appendBoundaryLedger("APPROVAL_REQUESTED", {
          sessionId: item.sessionId,
          actorId: item.actorId,
          requestId: item.requestId,
          actionKind: item.actionKind,
          target: item.target,
          reason: item.reason,
          decision: "require_approval",
          lawIds: item.lawIds,
          metadata: {
            approvalPayloadHash: createHash("sha256").update(item.payloadSummary ?? "").digest("hex"),
          },
          createdAt: new Date().toISOString(),
        });
      } finally {
        if (previous === undefined) delete process.env.AGENT_BUCCET_HOME;
        else process.env.AGENT_BUCCET_HOME = previous;
      }
    }

    // Automatic mode is deliberately notification-only.
    await page.locator("#autonomous-btn").click();
    await poll(async () => (await page.locator("#mode-badge").textContent()) === "Notification only");
    const autonomousResponse = await api("/v1/approval", proposal("gui-auto-1"));
    assert.deepEqual(autonomousResponse, { mode: "autonomous" });
    assert.equal(await page.locator("#approval-section").isVisible(), false);
    const allowedEvent = {
      requestId: "gui-event-allow", actorId: "test-agent", actionKind: "fs.read",
      target: "/workspace/authorized.txt", decision: "allow", reason: "Verified synthetic approval",
    };
    const deniedEvent = {
      requestId: "gui-event-deny", actorId: "test-agent", actionKind: "network.send",
      target: "https://blocked.example.test", decision: "deny", reason: "Verified synthetic denial",
    };
    await signFixtureEvent(allowedEvent);
    await signFixtureEvent(deniedEvent);
    await api("/v1/event", allowedEvent);
    await api("/v1/event", deniedEvent);
    await poll(async () => (await page.locator("#activity-list .event").count()) >= 2);
    assert.equal(await page.locator("#activity-list .event.denied").count(), 1);
    assertions.push("Autonomous GUI skipped approval prompts and displayed real allow/deny bridge events");
    await page.screenshot({ path: path.join(evidenceDir, "02-autonomous-activity.png") });

    // Switch to interactive and ensure the actual renderer displays
    // the request, pauses the bridge, and sends the clicked choice.
    await page.locator("#interactive-btn").click();
    await poll(async () => (await page.locator("#mode-badge").textContent()) === "Asks you");
    const allowProposal = proposal("gui-allow-1");
    await signFixtureApproval(allowProposal);
    const allowRequest = api("/v1/approval", allowProposal);
    await page.locator("#approval-section").waitFor({ state: "visible" });
    assert.equal(await page.locator("#approval-actor").textContent(), "test-agent");
    assert.equal(await page.locator("#approval-action").textContent(), "network.send");
    assert.match(await page.locator("#approval-payload").textContent(), /test-file.csv/);
    await page.screenshot({ path: path.join(evidenceDir, "03-real-human-approval-question.png") });
    await page.locator("#allow-once").click();
    assert.deepEqual(await allowRequest, { mode: "interactive", choice: "allow_once" });
    await page.locator("#approval-section").waitFor({ state: "hidden" });
    assertions.push("Actual Allow Once click resolved the held request with correct identity");

    const denyProposal = proposal("gui-deny-1", "fs.delete");
    await signFixtureApproval(denyProposal);
    const denyRequest = api("/v1/approval", denyProposal);
    await page.locator("#approval-section").waitFor({ state: "visible" });
    assert.equal(await page.locator("#approval-action").textContent(), "fs.delete");
    await page.locator("#deny-once").click();
    assert.deepEqual(await denyRequest, { mode: "interactive", choice: "deny_once" });
    await page.locator("#approval-section").waitFor({ state: "hidden" });
    assertions.push("Actual Deny click resolved the held request as denial");

    // Minimize to background; confirm the bridge still answers requests.
    await page.locator("#autonomous-btn").click();
    await page.locator("#hide-box").click();
    const visible = await desktop.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0];
      return window?.isVisible() ?? false;
    });
    assert.equal(visible, false, "window should be minimized/hidden");
    assert.deepEqual(await api("/v1/approval", proposal("gui-hidden-1")), { mode: "autonomous" });
    assertions.push("Real window minimized while the bridge kept responding");

    for (const item of assertions) console.log(`PASS real GUI: ${item}`);
    console.log(`REAL_GUI_SMOKE_PASS: ${assertions.length} assertions; screenshots at ${evidenceDir}`);
  } catch (error) {
    console.error("REAL_GUI_SMOKE_FAIL:", error);
    if (page && !page.isClosed()) {
      try { await page.screenshot({ path: path.join(evidenceDir, "FAIL-real-window.png") }); }
      catch { /* window may already be gone */ }
    }
    throw error;
  } finally {
    if (desktop) {
      try { await Promise.race([desktop.close(), delay(12000)]); }
      catch { /* process might already be closed */ }
    }
    await rm(home, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
