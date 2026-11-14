/**
 * ADVERSARIAL CONSENT-DISPLAY REGRESSION (real Electron window).
 *
 * The Box's one job is human authorization: the operator reads the held
 * request and decides. If an agent-controlled string can make the rendered
 * text differ from the bytes that will execute, consent is not meaningful.
 *
 * This drives the REAL window under Xvfb and asserts that text-direction
 * overrides, invisible characters, homoglyph hosts, and over-long targets are
 * neutralized into legible, warned text. Requires DISPLAY (xvfb-run).
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
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
async function poll(fn, t = 15000) { const e = Date.now() + t; let le;
  while (Date.now() < e) { try { const v = await fn(); if (v) return v; } catch (x) { le = x; } await delay(100); }
  throw new Error("timeout " + (le?.message ?? "")); }

const RLO = "‮";
const CASES = [
  { id: "bidi-override", target: `/home/user/Downloads/invoice_2026_${RLO}fdp.exe`,
    expectToken: true, expectFlag: /text-direction/ },
  { id: "homoglyph-host", target: "https://аpple.com/login",
    expectToken: false, expectFlag: /non-ASCII/ },
  { id: "fold-truncation", target: "/workspace/" + "Report_Export_Readonly_".repeat(9) + "application-secrets.env",
    expectToken: false, expectFlag: /long target/ },
];

async function main() {
  assert.ok(process.env.DISPLAY, "run under Xvfb (DISPLAY required)");
  assert.ok(existsSync(electronBin), "electron binary missing: " + electronBin);
  const home = await mkdtemp(path.join(os.tmpdir(), "abx-consent-"));
  let desktop, page; const passed = [];
  try {
    desktop = await electron.launch({ executablePath: electronBin, args: ["--no-sandbox", appDir], cwd: appDir,
      env: { ...process.env, AGENT_BUCCET_HOME: home, ELECTRON_DISABLE_SECURITY_WARNINGS: "true" }, timeout: 60000 });
    page = await desktop.firstWindow(); page.setDefaultTimeout(20000);
    await poll(async () => (await page.locator("#bridge-status").textContent())?.includes("Box active"));
    const cfg = JSON.parse(await readFile(path.join(home, "box", "bridge.json"), "utf8"));
    const approve = (b) => fetch(new URL("/v1/approval", cfg.origin), { method: "POST",
      headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" }, body: JSON.stringify(b) });

    for (const c of CASES) {
      const p = approve({ requestId: "r-" + c.id, sessionId: "s", actorId: "assistant-agent",
        actionKind: c.target.startsWith("http") ? "network.send" : "file.write",
        target: c.target, reason: "routine", payloadSummary: "size=10 bytes", lawIds: ["DEMO"],
        question: `Should assistant-agent act on ${c.target}?` });
      await page.locator("#approval-section").waitFor({ state: "visible" }); await delay(200);
      const shown = await page.locator("#approval-target").textContent();
      assert.ok(!/[‪-‮⁦-⁩]/.test(shown), `${c.id}: raw bidi reached the DOM`);
      if (c.expectToken) assert.match(shown, /\[U\+202E\]/, `${c.id}: override not shown as a visible token`);
      assert.equal(await page.locator("#approval-warning").isVisible(), true, `${c.id}: no safety warning shown`);
      assert.match(await page.locator("#approval-warning").textContent(), c.expectFlag, `${c.id}: wrong/missing warning`);
      await page.locator("#deny-once").click();
      await page.locator("#approval-section").waitFor({ state: "hidden" }); await p.catch(() => {});
      passed.push(c.id);
      console.log(`PASS consent-display: ${c.id} neutralized and warned`);
    }
    console.log(`CONSENT_DISPLAY_REGRESSION_PASS: ${passed.length} cases`);
  } finally {
    if (desktop) { try { await Promise.race([desktop.close(), delay(10000)]); } catch {} }
    await rm(home, { recursive: true, force: true });
  }
}
main().catch((e) => { console.error("CONSENT_DISPLAY_REGRESSION_FAIL:", e); process.exitCode = 1; });
