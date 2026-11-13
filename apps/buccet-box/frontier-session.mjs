/**
 * Cross-agent session authority attack: real MCP process launched with
 * attacker actor ID and victim's existing session ID. Disposable local data.
 * Goal: stored UPL grants must not be inherited by a different actor.
 *
 * This is an application/session identity boundary, not an OS-user sandbox.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
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
    close() {
      child.stdin.end();
      setTimeout(() => { if (child.exitCode === null) child.kill("SIGKILL"); }, 1000).unref();
    },
  };
}
const processes = [];
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
    grantedActions: ["fs.read"], issuedBy: actorA, seedBaseAcceptance: false,
  });
  store.replaceConfig(granted.config);
  await store.persist();

  const victim = client(actorA, victimSession); processes.push(victim);
  await victim.init();
  const victimAnswer = await victim.read(secretFile);
  const victimText = JSON.stringify(victimAnswer);
  if (!victimText.includes(SECRET)) {
    emit("INCONCLUSIVE_VICTIM_POSITIVE_CONTROL", {
      returnedSecret: false, response: victimText.slice(0, 500),
    });
    throw new Error("Victim positive control failed; cannot assess identity swap");
  }
  emit("FRONTIER_IDENTITY_PASS", { control: "victim can use its grant" });
  victim.close();

  const attackerOwn = client(actorB, "separate-unauthorized-session"); processes.push(attackerOwn);
  await attackerOwn.init();
  const attackerOwnReply = await attackerOwn.read(secretFile);
  const deniedByDefault = !JSON.stringify(attackerOwnReply).includes(SECRET);
  assert.ok(deniedByDefault, "Attacker-own-session baseline unexpectedly authorized");
  emit("FRONTIER_IDENTITY_PASS", { control: "attacker own session cannot use victim path law" });
  attackerOwn.close();

  const stolen = client(actorB, victimSession); processes.push(stolen);
  await stolen.init();
  const reply = await stolen.read(secretFile);
  const responseText = JSON.stringify(reply);
  if (responseText.includes(SECRET)) {
    emit("FRONTIER_IDENTITY_BREACH", {
      observed: "MCP process started as attacker actor inherited victim session read grant",
      runtimeExecution: true,
      threatModel: "attacker controls launch args and knows victim session ID within same user home",
    });
    throw new Error("FRONTIER_IDENTITY_BREACH: actor ID mismatch accepted on session restore");
  }
  emit("FRONTIER_IDENTITY_PASS", { control: "mismatched actor blocked", response: responseText.slice(0, 350) });
} finally {
  for (const p of processes) p.close();
  await rm(base, { recursive: true, force: true });
}
