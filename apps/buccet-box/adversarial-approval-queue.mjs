/**
 * ADVERSARIAL APPROVAL-QUEUE REGRESSION (real Electron window).
 *
 * Attack: queue a benign request A and a dangerous request B. When the operator
 * allows A, the window auto-advances to B with Allow in the same spot — a
 * double-tap / stuck key / approval-momentum click could authorize B unseen.
 *
 * Asserts the structural fix: a freshly-surfaced request is NOT review-ready
 * (Allow disabled, labelled "Review…") for a dwell window, so the carried
 * momentum of the previous click cannot land on it. Requires DISPLAY (xvfb-run).
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { _electron as electron } from "playwright";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const electronBin = path.join(appDir, "node_modules", "electron", "dist",
  process.platform === "win32" ? "electron.exe" : "electron");
const evidence = process.env.EVIDENCE_DIR;
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
async function poll(fn, t = 15000) { const e = Date.now() + t;
  while (Date.now() < e) { try { if (await fn()) return true; } catch {} await delay(40); }
  throw new Error("timeout"); }

async function main() {
  assert.ok(process.env.DISPLAY, "run under Xvfb (DISPLAY required)");
  assert.ok(existsSync(electronBin), "electron binary missing: " + electronBin);
  const home = await mkdtemp(path.join(os.tmpdir(), "abx-queue-"));
  let desktop, page;
  try {
    desktop = await electron.launch({ executablePath: electronBin, args: ["--no-sandbox", appDir], cwd: appDir,
      env: { ...process.env, AGENT_BUCCET_HOME: home, ELECTRON_DISABLE_SECURITY_WARNINGS: "true" }, timeout: 60000 });
    page = await desktop.firstWindow(); page.setDefaultTimeout(20000);
    await poll(async () => (await page.locator("#bridge-status").textContent())?.includes("Box active"));
    const cfg = JSON.parse(await readFile(path.join(home, "box", "bridge.json"), "utf8"));
    const approve = (b) => fetch(new URL("/v1/approval", cfg.origin), { method: "POST",
      headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" }, body: JSON.stringify(b) }).then((r) => r.json());
    const mk = (id, kind, target) => ({ requestId: id, sessionId: "s", actorId: "agent", actionKind: kind, target, reason: id, payloadSummary: "p", lawIds: ["L"], question: `Allow ${target}?` });

    const A = approve(mk("A-benign", "fs.write", "/ws/report.txt"));
    const B = approve(mk("B-danger", "fs.delete", "/ws/.env"));
    await page.locator("#approval-section").waitFor({ state: "visible" });
    await poll(async () => (await page.locator("#approval-target").textContent()) === "/ws/report.txt");

    // Allow A (Playwright auto-waits out A's own dwell, then clicks).
    await page.locator("#allow-once").click();
    assert.deepEqual(await A, { mode: "interactive", choice: "allow_once" });

    // B has auto-advanced to the front. Within its dwell window it must be
    // non-allowable: this is what defeats the momentum double-tap.
    await poll(async () => (await page.locator("#approval-target").textContent()) === "/ws/.env");
    assert.equal(await page.locator("#allow-once").isEnabled(), false, "promoted dangerous request must not be instantly allowable");
    assert.match(await page.locator("#allow-once").textContent(), /Review/, "promoted request shows a review state, not Allow");
    assert.equal(await page.locator("#deny-once").isEnabled(), true, "deny stays available");
    await page.screenshot({ path: path.join(evidence ?? ".", "queue-review-dwell.png") });
    console.log("PASS approval-queue: auto-advanced request is held in a review dwell, not instantly allowable");

    // After the dwell, a deliberate allow works normally.
    await poll(async () => await page.locator("#allow-once").isEnabled(), 3000);
    assert.match(await page.locator("#allow-once").textContent(), /Allow once/);
    await page.locator("#deny-once").click();
    assert.deepEqual(await B, { mode: "interactive", choice: "deny_once" });
    console.log("APPROVAL_QUEUE_REGRESSION_PASS");
  } finally {
    if (desktop) { try { await Promise.race([desktop.close(), delay(8000)]); } catch {} }
    await rm(home, { recursive: true, force: true });
  }
}
main().catch((e) => { console.error("APPROVAL_QUEUE_REGRESSION_FAIL:", e); process.exitCode = 1; });
