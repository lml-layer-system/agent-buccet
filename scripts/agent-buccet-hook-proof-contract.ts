import assert from "node:assert/strict";
import { createSocket } from "node:dgram";
import net from "node:net";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";

type CliResult = {
  code: number;
  stdout: string;
  stderr: string;
};

type RunningCli = {
  child: ReturnType<typeof spawn>;
  completed: Promise<CliResult>;
};

type ProofEnvSet = {
  runtimeEnv: NodeJS.ProcessEnv;
  controlEnv: NodeJS.ProcessEnv;
};

const repoRoot = process.cwd();
const cliPath = path.join(repoRoot, "scripts", "buccet.ts");

function runCommand(command: string, args: string[], env: NodeJS.ProcessEnv = process.env): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({
        code: code ?? 1,
        stdout,
        stderr,
      });
    });
  });
}

function runCli(args: string[], env: NodeJS.ProcessEnv): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      cwd: repoRoot,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({
        code: code ?? 1,
        stdout,
        stderr,
      });
    });
  });
}

function startCli(args: string[], env: NodeJS.ProcessEnv): RunningCli {
  const child = spawn(process.execPath, [cliPath, ...args], {
    cwd: repoRoot,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  return {
    child,
    completed: new Promise((resolve, reject) => {
      child.on("error", reject);
      child.on("close", (code) => {
        resolve({
          code: code ?? 1,
          stdout,
          stderr,
        });
      });
    }),
  };
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor<T>(
  fn: () => Promise<T | null>,
  label: string,
  attempts = 100,
  delayMs = 100,
): Promise<T> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const value = await fn();
    if (value !== null) {
      return value;
    }
    await sleep(delayMs);
  }
  throw new Error(`timed out waiting for ${label}`);
}

async function activeSwarmGroups(env: NodeJS.ProcessEnv): Promise<Array<{
  groupId: string;
  actionClass: string;
  operation: string;
  target: string;
  waitingCount: number;
  memberCount: number;
}>> {
  const result = await runCli(["swarm", "list", "--json"], env);
  assert.equal(result.code, 0, result.stderr);
  const payload = JSON.parse(result.stdout) as {
    groups: Array<{
      groupId: string;
      actionClass: string;
      operation: string;
      target: string;
      waitingCount: number;
      memberCount: number;
      state: string;
    }>;
  };
  return payload.groups.filter((group) => group.state === "waiting");
}

async function waitForSwarmGroup(args: {
  env: NodeJS.ProcessEnv;
  label: string;
  predicate: (group: {
    groupId: string;
    actionClass: string;
    operation: string;
    target: string;
    waitingCount: number;
    memberCount: number;
  }) => boolean;
}) {
  return await waitFor(async () => {
    const groups = await activeSwarmGroups(args.env);
    return groups.find(args.predicate) ?? null;
  }, args.label);
}

async function waitForSwarmGroupWithRuntimeSupportApprovals(args: {
  env: NodeJS.ProcessEnv;
  label: string;
  predicate: (group: {
    groupId: string;
    actionClass: string;
    operation: string;
    target: string;
    waitingCount: number;
    memberCount: number;
  }) => boolean;
}) {
  return await waitFor(async () => {
    const groups = await activeSwarmGroups(args.env);
    const runtimeReadGroup = groups.find(isRuntimeSupportReadGroup);
    if (runtimeReadGroup) {
      await approveSwarmGroup(
        args.env,
        runtimeReadGroup.groupId,
        `approve runtime support read for ${runtimeReadGroup.target}`,
      );
      await sleep(100);
      return null;
    }
    return groups.find(args.predicate) ?? null;
  }, args.label);
}

async function denySwarmGroup(env: NodeJS.ProcessEnv, groupId: string, reason: string): Promise<void> {
  const result = await runCli(["swarm", "deny", groupId, "--reason", reason], env);
  assert.equal(result.code, 0, result.stderr);
}

async function assertNoPendingSwarm(env: NodeJS.ProcessEnv): Promise<void> {
  const groups = await activeSwarmGroups(env);
  assert.equal(groups.length, 0, `expected no pending swarm groups, found ${JSON.stringify(groups)}`);
}

async function approveSwarmGroup(env: NodeJS.ProcessEnv, groupId: string, reason: string): Promise<void> {
  const result = await runCli(["swarm", "approve", groupId, "--reason", reason], env);
  assert.equal(result.code, 0, result.stderr);
}

function isRuntimeSupportReadGroup(group: {
  actionClass: string;
  operation: string;
  target: string;
}): boolean {
  if (group.actionClass !== "file") {
    return false;
  }

  if (group.target === "/") {
    return group.operation === "read";
  }

  if (group.target === "/dev/null") {
    return ["read", "write", "append"].includes(group.operation);
  }

  if (group.operation !== "read") {
    return false;
  }

  return [
    "/usr/local/etc/openssl@3/",
    "/opt/homebrew/etc/openssl@3/",
    "/etc/ssl/",
    "/private/etc/ssl/",
  ].some((prefix) => group.target.startsWith(prefix));
}

async function waitForCliWithRuntimeSupportApprovals(args: {
  running: RunningCli;
  env: NodeJS.ProcessEnv;
  label: string;
  timeoutMs?: number;
  alsoApprove?: {
    predicate: (group: {
      groupId: string;
      actionClass: string;
      operation: string;
      target: string;
      waitingCount: number;
      memberCount: number;
    }) => boolean;
    reason: (group: {
      groupId: string;
      actionClass: string;
      operation: string;
      target: string;
      waitingCount: number;
      memberCount: number;
    }) => string;
  };
}): Promise<CliResult> {
  const timeoutMs = args.timeoutMs ?? 15_000;
  const startedAt = Date.now();
  let completed: CliResult | null = null;

  void args.running.completed.then((result) => {
    completed = result;
  });

  while (Date.now() - startedAt < timeoutMs) {
    if (completed) {
      return completed;
    }

    const groups = await activeSwarmGroups(args.env).catch(() => []);
    const runtimeReadGroup = groups.find(isRuntimeSupportReadGroup);
    if (runtimeReadGroup) {
      await approveSwarmGroup(
        args.env,
        runtimeReadGroup.groupId,
        `approve runtime support read for ${runtimeReadGroup.target}`,
      );
      await sleep(100);
      continue;
    }

    const releasableGroup = args.alsoApprove
      ? groups.find(args.alsoApprove.predicate)
      : undefined;
    if (releasableGroup) {
      await approveSwarmGroup(
        args.env,
        releasableGroup.groupId,
        args.alsoApprove!.reason(releasableGroup),
      );
      await sleep(100);
      continue;
    }

    const unexpectedGroup = groups[0];
    if (unexpectedGroup) {
      throw new Error(
        `unexpected swarm group while waiting for ${args.label}: ${JSON.stringify(unexpectedGroup)}`,
      );
    }

    await sleep(100);
  }

  throw new Error(`timed out waiting for ${args.label}`);
}

async function compileOpenAtHelper(tempRoot: string): Promise<string> {
  const helperSourcePath = path.join(tempRoot, "openat-helper.c");
  const helperBinaryPath = path.join(tempRoot, "openat-helper");
  const helperSource = [
    "#include <errno.h>",
    "#include <fcntl.h>",
    "#include <stdio.h>",
    "#include <string.h>",
    "#include <unistd.h>",
    "",
    "int main(int argc, char** argv) {",
    "  if (argc != 3) {",
    "    fprintf(stderr, \"usage: %s <dir> <leaf>\\n\", argv[0]);",
    "    return 64;",
    "  }",
    "  int dirfd = open(argv[1], O_RDONLY | O_DIRECTORY);",
    "  if (dirfd < 0) {",
    "    perror(\"open-dir\");",
    "    return 2;",
    "  }",
    "  int fd = openat(dirfd, argv[2], O_WRONLY | O_CREAT | O_TRUNC, 0644);",
    "  if (fd < 0) {",
    "    perror(\"openat\");",
    "    close(dirfd);",
    "    return 1;",
    "  }",
    "  const char* payload = \"dirfd-write\\n\";",
    "  if (write(fd, payload, strlen(payload)) < 0) {",
    "    perror(\"write\");",
    "    close(fd);",
    "    close(dirfd);",
    "    return 3;",
    "  }",
    "  close(fd);",
    "  close(dirfd);",
    "  return 0;",
    "}",
    "",
  ].join("\n");
  await fs.writeFile(helperSourcePath, helperSource, "utf8");
  const compileResult = await runCommand("cc", [
    helperSourcePath,
    "-o",
    helperBinaryPath,
  ]);
  assert.equal(compileResult.code, 0, compileResult.stderr);
  return helperBinaryPath;
}

async function compileUdpSendHelper(tempRoot: string): Promise<string> {
  const helperSourcePath = path.join(tempRoot, "udp-send-helper.c");
  const helperBinaryPath = path.join(tempRoot, "udp-send-helper");
  const helperSource = [
    "#include <arpa/inet.h>",
    "#include <stdio.h>",
    "#include <stdlib.h>",
    "#include <string.h>",
    "#include <sys/socket.h>",
    "#include <unistd.h>",
    "",
    "int main(int argc, char** argv) {",
    "  if (argc != 3) {",
    "    fprintf(stderr, \"usage: %s <host> <port>\\n\", argv[0]);",
    "    return 64;",
    "  }",
    "  int sock = socket(AF_INET, SOCK_DGRAM, 0);",
    "  if (sock < 0) {",
    "    perror(\"socket\");",
    "    return 2;",
    "  }",
    "  struct sockaddr_in addr;",
    "  memset(&addr, 0, sizeof(addr));",
    "  addr.sin_family = AF_INET;",
    "  addr.sin_port = htons((unsigned short)atoi(argv[2]));",
    "  if (inet_pton(AF_INET, argv[1], &addr.sin_addr) != 1) {",
    "    fprintf(stderr, \"bad host\\n\");",
    "    close(sock);",
    "    return 3;",
    "  }",
    "  const char* payload = \"udp-blocked\";",
    "  if (sendto(sock, payload, strlen(payload), 0, (struct sockaddr*)&addr, sizeof(addr)) < 0) {",
    "    perror(\"sendto\");",
    "    close(sock);",
    "    return 1;",
    "  }",
    "  close(sock);",
    "  return 0;",
    "}",
    "",
  ].join("\n");
  await fs.writeFile(helperSourcePath, helperSource, "utf8");
  const compileResult = await runCommand("cc", [
    helperSourcePath,
    "-o",
    helperBinaryPath,
  ]);
  assert.equal(compileResult.code, 0, compileResult.stderr);
  return helperBinaryPath;
}

async function main() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-buccet-hook-proof-"));
  const homePath = path.join(tempRoot, "home");
  const workspacePath = path.join(tempRoot, "workspace");
  await fs.mkdir(workspacePath, { recursive: true });
  const openAtHelperPath = await compileOpenAtHelper(tempRoot);
  const udpSendHelperPath = await compileUdpSendHelper(tempRoot);

  const runtimeEnv = {
    ...process.env,
    AGENT_BUCCET_HOME: homePath,
    AGENT_BUCCET_CALLER_CWD: workspacePath,
    AGENT_BUCCET_LAUNCHER_PATH: path.join(tempRoot, "bin", "buccet"),
  };
  const controlEnv: NodeJS.ProcessEnv = { ...runtimeEnv };
  delete controlEnv.DYLD_INSERT_LIBRARIES;
  delete controlEnv.DYLD_FORCE_FLAT_NAMESPACE;
  delete controlEnv.LD_PRELOAD;
  delete controlEnv.BUCCET_SOCKET_PATH;
  delete controlEnv.BUCCET_BRAIN_STATUS_PATH;
  const envs: ProofEnvSet = {
    runtimeEnv,
    controlEnv,
  };

  const initResult = await runCli(["init", "--no-default-scope", "--scope", workspacePath], envs.controlEnv);
  assert.equal(initResult.code, 0, initResult.stderr);

  const autoRunFile = path.join(workspacePath, "auto-run-ok.txt");
  const autoRun = startCli([
    "run",
    "--",
    process.execPath,
    "-e",
    `require('node:fs').writeFileSync(${JSON.stringify(autoRunFile)}, 'auto-run-ok\\n')`,
  ], envs.runtimeEnv);
  const autoRunResult = await waitForCliWithRuntimeSupportApprovals({
    running: autoRun,
    env: envs.controlEnv,
    label: "auto-wired buccet run in-scope write",
    alsoApprove: {
      predicate: (group) =>
        group.actionClass === "file"
        && group.operation === "write"
        && group.target === autoRunFile,
      reason: () => "release caught in-scope write after front hold",
    },
  });
  assert.equal(autoRunResult.code, 0, autoRunResult.stderr);
  assert.equal(await fs.readFile(autoRunFile, "utf8"), "auto-run-ok\n");

  const hookStatus = await runCli(["hook", "status", "--json"], envs.controlEnv);
  assert.equal(hookStatus.code, 0, hookStatus.stderr);
  const hookPayload = JSON.parse(hookStatus.stdout) as {
    running?: boolean;
    healthy?: boolean;
    interceptReady?: boolean;
    bridgeReady?: boolean;
  };
  assert.equal(hookPayload.running, true);
  assert.equal(hookPayload.healthy, true);
  assert.equal(hookPayload.interceptReady, true);
  assert.equal(hookPayload.bridgeReady, true);

  const deniedWriteTarget = path.join(tempRoot, "outside-write.txt");
  const deniedWrite = startCli([
    "hook",
    "run",
    "--",
    process.execPath,
    "-e",
    `require('node:fs').writeFileSync(${JSON.stringify(deniedWriteTarget)}, 'blocked\\n')`,
  ], envs.runtimeEnv);

  const deniedWriteGroup = await waitForSwarmGroupWithRuntimeSupportApprovals({
    env: envs.controlEnv,
    label: "out-of-scope file write freeze",
    predicate: (group) =>
      group.actionClass === "file"
      && group.operation === "write"
      && group.target === deniedWriteTarget,
  });
  await denySwarmGroup(envs.controlEnv, deniedWriteGroup.groupId, "deny out-of-scope file write");
  const deniedWriteResult = await waitForCliWithRuntimeSupportApprovals({
    running: deniedWrite,
    env: envs.controlEnv,
    label: "out-of-scope file write denial completion",
  });
  assert.notEqual(deniedWriteResult.code, 0, "expected denied out-of-scope write to fail");
  const deniedWriteExists = await fs.access(deniedWriteTarget).then(() => true).catch(() => false);
  assert.equal(deniedWriteExists, false, "denied out-of-scope file write should not create a file");

  const dirfdOutsideDir = path.join(tempRoot, "dirfd-outside");
  await fs.mkdir(dirfdOutsideDir, { recursive: true });
  const dirfdLeaf = "dirfd-target.txt";
  const dirfdRealOutsideDir = await fs.realpath(dirfdOutsideDir);
  const dirfdTarget = path.join(dirfdRealOutsideDir, dirfdLeaf);
  const dirfdWrite = startCli([
    "hook",
    "run",
    "--",
    openAtHelperPath,
    dirfdOutsideDir,
    dirfdLeaf,
  ], envs.runtimeEnv);
  const dirfdReadGroup = await waitForSwarmGroupWithRuntimeSupportApprovals({
    env: envs.controlEnv,
    label: "openat dirfd read freeze",
    predicate: (group) =>
      group.actionClass === "file"
      && group.operation === "read"
      && group.target === dirfdOutsideDir,
  });
  await approveSwarmGroup(envs.controlEnv, dirfdReadGroup.groupId, "release openat dirfd directory read");
  const dirfdWriteGroup = await waitForSwarmGroupWithRuntimeSupportApprovals({
    env: envs.controlEnv,
    label: "openat dirfd freeze",
    predicate: (group) =>
      group.actionClass === "file"
      && group.operation === "write"
      && group.target === dirfdTarget,
  });
  await denySwarmGroup(envs.controlEnv, dirfdWriteGroup.groupId, "deny openat dirfd write");
  const dirfdWriteResult = await waitForCliWithRuntimeSupportApprovals({
    running: dirfdWrite,
    env: envs.controlEnv,
    label: "openat dirfd denial completion",
  });
  assert.notEqual(dirfdWriteResult.code, 0, "expected denied openat dirfd write to fail");
  const dirfdTargetExists = await fs.access(dirfdTarget).then(() => true).catch(() => false);
  assert.equal(dirfdTargetExists, false, "denied openat dirfd write should not create a file");

  const deniedExec = startCli([
    "hook",
    "run",
    "--",
    process.execPath,
    "-e",
    `require('node:child_process').execFileSync(${JSON.stringify(process.execPath)}, ['-e', 'console.log("nested")'], { stdio: 'inherit' })`,
  ], envs.runtimeEnv);

  const deniedExecGroup = await waitForSwarmGroupWithRuntimeSupportApprovals({
    env: envs.controlEnv,
    label: "child exec freeze",
    predicate: (group) =>
      group.actionClass === "shell"
      && group.operation === "exec",
  });
  await denySwarmGroup(envs.controlEnv, deniedExecGroup.groupId, "deny nested exec");
  const deniedExecResult = await waitForCliWithRuntimeSupportApprovals({
    running: deniedExec,
    env: envs.controlEnv,
    label: "child exec denial completion",
  });
  assert.notEqual(deniedExecResult.code, 0, "expected denied child exec to fail");

  const networkServer = net.createServer((socket) => {
    socket.end("ok");
  });
  await new Promise<void>((resolve) => {
    networkServer.listen(0, "127.0.0.1", () => resolve());
  });
  const address = networkServer.address();
  if (!address || typeof address === "string") {
    throw new Error("expected TCP AddressInfo from local proof server");
  }
  const networkAddress = address as AddressInfo;
  const networkTarget = `127.0.0.1:${networkAddress.port}`;

  const deniedConnect = startCli([
    "hook",
    "run",
    "--",
    process.execPath,
    "-e",
    `const net = require('node:net'); const socket = net.createConnection({host:'127.0.0.1', port:${networkAddress.port}}); socket.on('connect', () => process.exit(0)); socket.on('error', (error) => { console.error(String(error && error.message || error)); process.exit(1); });`,
  ], envs.runtimeEnv);

  const deniedConnectGroup = await waitForSwarmGroupWithRuntimeSupportApprovals({
    env: envs.controlEnv,
    label: "network connect freeze",
    predicate: (group) =>
      group.actionClass === "network"
      && group.operation === "send"
      && group.target === networkTarget,
  });
  await denySwarmGroup(envs.controlEnv, deniedConnectGroup.groupId, "deny network connect");
  const deniedConnectResult = await waitForCliWithRuntimeSupportApprovals({
    running: deniedConnect,
    env: envs.controlEnv,
    label: "network connect denial completion",
  });
  assert.notEqual(deniedConnectResult.code, 0, "expected denied network connect to fail");
  await new Promise<void>((resolve) => networkServer.close(() => resolve()));

  const udpServer = createSocket("udp4");
  await new Promise<void>((resolve) => {
    udpServer.bind(0, "127.0.0.1", () => resolve());
  });
  const udpAddress = udpServer.address();
  if (!udpAddress || typeof udpAddress === "string") {
    throw new Error("expected UDP AddressInfo from local proof server");
  }
  const udpTarget = `127.0.0.1:${udpAddress.port}`;

  const deniedUdpSend = startCli([
    "hook",
    "run",
    "--",
    udpSendHelperPath,
    "127.0.0.1",
    String(udpAddress.port),
  ], envs.runtimeEnv);

  const deniedUdpGroup = await waitForSwarmGroupWithRuntimeSupportApprovals({
    env: envs.controlEnv,
    label: "udp send freeze",
    predicate: (group) =>
      group.actionClass === "network"
      && group.operation === "send"
      && group.target === udpTarget,
  });
  await denySwarmGroup(envs.controlEnv, deniedUdpGroup.groupId, "deny udp send");
  const deniedUdpResult = await waitForCliWithRuntimeSupportApprovals({
    running: deniedUdpSend,
    env: envs.controlEnv,
    label: "udp send denial completion",
  });
  assert.notEqual(deniedUdpResult.code, 0, "expected denied udp send to fail");
  await new Promise<void>((resolve) => udpServer.close(() => resolve()));

  const allowedWriteTarget = path.join(workspacePath, "hook-allowed.txt");
  const allowedWrite = startCli([
    "hook",
    "run",
    "--",
    process.execPath,
    "-e",
    `require('node:fs').writeFileSync(${JSON.stringify(allowedWriteTarget)}, 'hook-allowed\\n')`,
  ], envs.runtimeEnv);
  const allowedWriteResult = await waitForCliWithRuntimeSupportApprovals({
    running: allowedWrite,
    env: envs.controlEnv,
    label: "hook in-scope write",
    alsoApprove: {
      predicate: (group) =>
        group.actionClass === "file"
        && group.operation === "write"
        && group.target === allowedWriteTarget,
      reason: () => "release caught hook write after front hold",
    },
  });
  assert.equal(allowedWriteResult.code, 0, allowedWriteResult.stderr);
  assert.equal(await fs.readFile(allowedWriteTarget, "utf8"), "hook-allowed\n");

  await assertNoPendingSwarm(envs.controlEnv);

  console.log("Agent Buccet hook proof contract");
  console.log("auto-run in-scope write: allow");
  console.log("hook out-of-scope write: freeze -> deny");
  console.log("hook openat dirfd write: freeze -> deny");
  console.log("hook nested exec: freeze -> deny");
  console.log("hook network connect: freeze -> deny");
  console.log("hook udp sendto: freeze -> deny");
  console.log("hook in-scope write: allow");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
