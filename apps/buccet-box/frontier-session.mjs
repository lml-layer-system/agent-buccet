/**
 * Cross-agent session authority attack: real MCP process launched with
 * attacker actor ID and victim's existing session ID. Disposable local data.
 * Goal: stored UPL grants must not be inherited by a different actor.
 *
 * This is an application/session identity boundary, not an OS-user sandbox.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { createBuccetBoxBackend } from "./backend.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const base = await mkdtemp(path.join(os.tmpdir(), "buccet-frontier-identity-"));
const home = path.join(base, "home"), workspace = path.join(base, "allowed");
const sessionsDir = path.join(home, "sessions");
const SECRET = "SYNTHETIC_VICTIM_SECRET_97A";
const actorA = "victim:privileged-agent";
const actorB = "attacker:untrusted-agent";
const victimSession = "victim-session-frontier";
const findings = [];
function emit(type, detail) { console.log(type, JSON.stringify(detail)); findings.push({ type, detail }); }
function client(actor, session) {
  const child = spawn(process.execPath, [
    path.join(root, "scripts/agent-buccet-mcp-server.ts"),
    "--home", home, "--sessions-dir", sessionsDir,
    "--session-id", session, "--actor-id", actor,
  ], {
    cwd: root, env: { ...process.env, AGENT_BUCCET_HOME: home },
    stdio: ["pipe", "pipe", "pipe"],
  });
  const requests = new Map();
  let id = 0, errors = "";
  child.stderr.on("data", chunk => { errors += chunk.toString().slice(0, 1200); });
  readline.createInterface({ input: child.stdout }).on("line", line => {
    try {
      const reply = JSON.parse(line);
      const wait = requests.get(reply.id);
      if (wait) {
        clearTimeout(wait.timer);
        requests.delete(reply.id);
        wait.resolve(reply);
      }
    } catch {}
  });
  child.once("exit", code => {
    for (const [key, wait] of requests) {
      clearTimeout(wait.timer);
      wait.reject(new Error("MCP exited " + code + " " + errors.slice(-650)));
      requests.delete(key);
    }
  });
  return {
    child,
    ask(method, params, ms = 15000) {
      return new Promise((resolve, reject) => {
        const key = ++id;
        const timer = setTimeout(() => {
          requests.delete(key);
          reject(new Error("MCP timeout " + errors.slice(-800)));
        }, ms);
        requests.set(key, { timer, resolve, reject });
        child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params, id: key }) + "\n");
      });
    },
    async init() {
      const response = await this.ask("initialize", {
        protocolVersion: "2024-11-05", capabilities: {},
        clientInfo: { name: "frontier-attacker", version: "1" },
      });
      assert.equal(response.result?.serverInfo?.name, "agent-buccet", JSON.stringify(response));
    },
    async read(filename) {
      return this.ask("tools/call", { name: "read_file", arguments: { path: filename } });
    },
    cancel(requestId) {
      child.stdin.write(JSON.stringify({
        jsonrpc: "2.0", method: "notifications/cancelled",
        params: { requestId, reason: "user cancelled pending action" },
      }) + "\n");
    },
    close() {
      child.stdin.end();
      setTimeout(() => { if (child.exitCode === null) child.kill("SIGKILL"); }, 1000).unref();
    },
  };
}
const processes = [];
const box = createBuccetBoxBackend({ home, notify: () => {} });
async function readWithHuman(agent, target, choice = "deny_once") {
  const request = agent.read(target);
  const started = Date.now();
  let prompt;
  while (Date.now() - started < 4500) {
    prompt = box.state().pending[0];
    if (prompt) break;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  if (prompt) {
    assert.equal(box.settle(prompt.approvalId, choice), true);
  }
  return { prompt, response: await request };
}
try {
  await mkdir(workspace, { recursive: true });
  await mkdir(sessionsDir, { recursive: true });
  const secretFile = path.join(workspace, "victim-private.txt");
  await writeFile(secretFile, SECRET);

  const boundary = await import("../../src/index.ts");
  const store = await boundary.createPersistentBoundaryRuntimeStore({
    sessionId: victimSession, actorId: actorA, sessionsDir,
    dryRun: false, hydrationMode: "full",
  });
  const granted = await boundary.openBoundaryPath({
    config: store.getConfig(), rootPath: workspace,
    grantedActions: ["fs.read", "fs.write"], issuedBy: actorA, seedBaseAcceptance: false,
  });
  store.replaceConfig(granted.config);
  await store.persist();
  await box.start();

  const victim = client(actorA, victimSession); processes.push(victim);
  await victim.init();
  const victimAttempt = await readWithHuman(victim, secretFile, "allow_once");
  const victimText = JSON.stringify(victimAttempt.response);
  if (!victimText.includes(SECRET)) {
    emit("INCONCLUSIVE_VICTIM_POSITIVE_CONTROL", {
      returnedSecret: false, response: victimText.slice(0, 500),
    });
    throw new Error("Victim positive control failed; cannot assess identity swap");
  }
  emit("FRONTIER_IDENTITY_PASS", { control: "victim can use its grant" });

  // Authority lifecycle: while the real server is frozen at the human
  // approval boundary, the operator revokes the underlying path grant in
  // durable storage. Execution must not use a stale in-memory snapshot.
  const revokedTarget = path.join(workspace, "after-revocation.txt");
  const revocationRequest = victim.ask("tools/call", {
    name: "write_file",
    arguments: { path: revokedTarget, content: "EXECUTED_WITH_REVOKED_AUTHORITY" },
  }, 17000);
  let revocationPrompt;
  const revocationStart = Date.now();
  while (Date.now() - revocationStart < 5000) {
    revocationPrompt = box.state().pending[0];
    if (revocationPrompt) break;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  if (revocationPrompt) {
    const oldConfig = store.getConfig();
    store.replaceConfig({ ...oldConfig, pathLaws: (oldConfig.pathLaws ?? []).map(law => ({
      ...law, revokedAt: new Date().toISOString(),
    })) });
    await store.persist();
    box.settle(revocationPrompt.approvalId, "allow_once");
  }
  const staleResponse = await revocationRequest;
  let revokedExecuted = false;
  try {
    revokedExecuted = (await readFile(revokedTarget, "utf8")) ===
      "EXECUTED_WITH_REVOKED_AUTHORITY";
  } catch {}
  if (revokedExecuted) {
    emit("FRONTIER_REVOCATION_BREACH", {
      observed: "stale running MCP process used revoked path law after approval",
      revokedOnDiskBeforeAllow: !!revocationPrompt,
      actualWrite: true, response: JSON.stringify(staleResponse).slice(0, 220),
    });
  } else {
    emit("FRONTIER_REVOCATION_PASS", {
      executionBlocked: true, revokedBeforeAllow: !!revocationPrompt,
      response: JSON.stringify(staleResponse).slice(0, 220),
    });
  }
  // Restore the test session for independent identity and cancellation cases.
  store.replaceConfig(granted.config);
  await store.persist();
  victim.close();

  const attackerOwn = client(actorB, "separate-unauthorized-session"); processes.push(attackerOwn);
  await attackerOwn.init();
  const attackerOwnReply = (await readWithHuman(attackerOwn, secretFile, "deny_once")).response;
  const deniedByDefault = !JSON.stringify(attackerOwnReply).includes(SECRET);
  assert.ok(deniedByDefault, "Attacker-own-session baseline unexpectedly authorized");
  emit("FRONTIER_IDENTITY_PASS", { control: "attacker own session cannot use victim path law" });
  attackerOwn.close();

  // MCP transport cancellation: once a tool call is cancelled, a human
  // clicking an old prompt must not execute its side effect.
  const cancelled = client(actorA, victimSession); processes.push(cancelled);
  await cancelled.init();
  const cancelledFile = path.join(workspace, "cancelled-action.txt");
  const stillPending = cancelled.ask("tools/call", {
    name: "write_file",
    arguments: { path: cancelledFile, content: "LATE_EXECUTION_AFTER_CANCEL" },
  }, 15000);
  const startedCancel = Date.now();
  let cancelledHold;
  while (Date.now() - startedCancel < 4200) {
    cancelledHold = box.state().pending[0];
    if (cancelledHold) break;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  if (cancelledHold) {
    // First non-initialize request in this new MCP process has JSON-RPC id 2.
    cancelled.cancel(2);
    await new Promise(resolve => setTimeout(resolve, 150));
    box.settle(cancelledHold.approvalId, "allow_once");
  }
  const cancelledResponse = await stillPending;
  let executedCancelled = false;
  try {
    executedCancelled = (await readFile(cancelledFile, "utf8")) === "LATE_EXECUTION_AFTER_CANCEL";
  } catch {}
  if (executedCancelled) {
    emit("FRONTIER_CANCELLATION_BREACH", {
      observed: "cancelled MCP request executed after stale approval was clicked",
      cancellationSent: !!cancelledHold, requestId: 2,
      executed: true, response: JSON.stringify(cancelledResponse).slice(0, 200),
    });
  } else {
    emit("FRONTIER_CANCELLATION_PASS", {
      cancellationSent: !!cancelledHold,
      executed: false,
      response: JSON.stringify(cancelledResponse).slice(0, 200),
    });
  }
  cancelled.close();

  const stolen = client(actorB, victimSession); processes.push(stolen);
  await stolen.init();
  const stolenAttempt = await readWithHuman(stolen, secretFile, "allow_once");
  const responseText = JSON.stringify(stolenAttempt.response);
  if (responseText.includes(SECRET)) {
    emit("FRONTIER_IDENTITY_BREACH", {
      observed: "MCP process started as attacker actor inherited victim session read grant",
      runtimeExecution: true,
      humanClickedAllowOnce: !!stolenAttempt.prompt,
      promptActor: stolenAttempt.prompt?.actorId,
      threatModel: "attacker controls launch args and knows victim session ID within same user home",
    });
    throw new Error("FRONTIER_IDENTITY_BREACH: actor ID mismatch accepted on session restore");
  }
  emit("FRONTIER_IDENTITY_PASS", { control: "mismatched actor blocked", response: responseText.slice(0, 350) });
} finally {
  for (const p of processes) p.close();
  try { await box.setMode("autonomous"); } catch {}
  await box.stop();
  await rm(base, { recursive: true, force: true });
}
