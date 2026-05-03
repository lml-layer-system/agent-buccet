import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  DEFAULT_ADMISSION_CONFIG,
  DEFAULT_BOUNDARY_LAWS,
  DEFAULT_GOVERNOR_CONFIG,
  buildActiveAgentBuccetLawIds,
  compileLiveUplField,
  createBoundaryBodyguard,
  createBoundaryRuntimeStore,
  getActiveUserLawIds,
  initialAdmissionState,
  initialGovernorState,
  listUserPathEntries,
  loadAgentBuccetRuntimeMuscle,
} from "./../../src/index.ts";
import type { BoundaryLedgerRecord, BoundaryUserPathLedger } from "./../../src/index.ts";

const repoRoot = process.cwd();
const scriptPath = await (async () => {
  const candidates = [
    path.join(repoRoot, "cli", "buccet.ts"),
    path.join(repoRoot, "bin", "buccet.ts"),
  ];
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {}
  }
  throw new Error("unable to locate buccet CLI script");
})();

function runCli(
  args: string[],
  env: NodeJS.ProcessEnv,
): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn("node", [scriptPath, ...args], {
      cwd: repoRoot,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ stdout, stderr, code });
    });
  });
}

async function readLedgerBySessionFromHome(
  homePath: string,
  sessionId: string,
): Promise<BoundaryLedgerRecord[]> {
  const ledgerFile = path.join(homePath, "data", "ledger", "agent-boundary-ledger.jsonl");
  const raw = await fs.readFile(ledgerFile, "utf8");
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as BoundaryLedgerRecord)
    .filter((record) => record.META.session_id === sessionId);
}

async function main() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-buccet-upl-source-sync-"));
  const cliSessionId = `agent-buccet-upl-source-sync-${Date.now()}`;
  const homePath = path.join(tempRoot, "home");
  const workspacePath = path.join(tempRoot, "workspace");
  const railDir = path.join(workspacePath, "rail");
  const secretsDir = path.join(workspacePath, "secrets");
  await fs.mkdir(railDir, { recursive: true });
  await fs.mkdir(secretsDir, { recursive: true });

  const configPath = path.join(homePath, "config.json");
  const configNow = new Date().toISOString();
  await fs.mkdir(homePath, { recursive: true });
  await fs.writeFile(
    configPath,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        sessionId: cliSessionId,
        actorId: "user:upl-source-sync-contract",
        createdAt: configNow,
        updatedAt: configNow,
        defaultScopes: [],
        dryRun: false,
      },
      null,
      2,
    )}\n`,
  );
  const ledgerPath = path.join(
    homePath,
    "data",
    "agent-buccet-law-foundation",
    "user-path-ledger.json",
  );
  // Ensure the ledger directory exists and create an empty ledger file if it doesn't.
  await fs.mkdir(path.dirname(ledgerPath), { recursive: true });
  await fs.writeFile(
    ledgerPath,
    JSON.stringify({ specVersion: 1, userApprovedLawPaths: [], userDeniedLawPaths: [] }, null, 2),
  );
  const readLedger = async (): Promise<BoundaryUserPathLedger> =>
    JSON.parse(await fs.readFile(ledgerPath, "utf8")) as BoundaryUserPathLedger;

  const env = {
    ...process.env,
    AGENT_BUCCET_HOME: homePath,
    AGENT_BUCCET_CALLER_CWD: workspacePath,
    AGENT_BUCCET_LAUNCHER_PATH: path.join(tempRoot, "bin", "buccet"),
    AGENT_BUCCET_UPL_LEDGER_PATH: ledgerPath, // Added this line
  };
  process.env.AGENT_BUCCET_HOME = homePath;
  process.env.AGENT_BUCCET_CALLER_CWD = workspacePath;
  process.env.AGENT_BUCCET_LAUNCHER_PATH = path.join(tempRoot, "bin", "buccet");

  const sourcesResult = await runCli(["upl", "sources", "--json"], env);
  assert.equal(sourcesResult.code, 0, sourcesResult.stderr);
  const sources = JSON.parse(sourcesResult.stdout) as {
    root: string;
    lanes: Array<{ lane: "acceptance" | "denial"; dir: string; files: string[] }>;
  };
  const acceptanceDir = sources.lanes.find((lane) => lane.lane === "acceptance")?.dir;
  const denialDir = sources.lanes.find((lane) => lane.lane === "denial")?.dir;
  assert.ok(acceptanceDir, "expected acceptance source dir");
  assert.ok(denialDir, "expected denial source dir");

  const acceptanceDocPath = path.join(acceptanceDir!, "workspace-rail.md");
  const denialDocPath = path.join(denialDir!, "workspace-secrets.md");
  const railTarget = path.join(railDir, "allowed.txt");
  const secretTarget = path.join(secretsDir, "api.key");

  await fs.writeFile(
    acceptanceDocPath,
    [
      "# Workspace rail",
      "",
      `Only permit fs.write inside "${railTarget}". Never write outside "${railTarget}".`,
    ].join("\n"),
  );
  await fs.writeFile(
    denialDocPath,
    [
      "# Secret wall",
      "",
      "Decision: deny",
      "Invariant: Secret reads are forbidden.",
      "Enforcement: Reject secret access.",
      "Action: fs.read",
      `Target: ${secretTarget}`,
    ].join("\n"),
  );

  const extractAcceptance = await runCli(
    ["extract-laws", acceptanceDocPath, "--lane", "acceptance", "--json"],
    env,
  );
  assert.equal(extractAcceptance.code, 0, extractAcceptance.stderr);
  const extractAcceptancePayload = JSON.parse(extractAcceptance.stdout) as {
    lane: string | null;
    laneMismatches: Array<unknown>;
  };
  assert.equal(extractAcceptancePayload.lane, "acceptance");
  assert.equal(
    extractAcceptancePayload.laneMismatches.length,
    0,
    "expected acceptance doc to fit acceptance lane",
  );

  const firstSync = await runCli(["upl", "sync", "--json"], env);
  assert.equal(firstSync.code, 0, firstSync.stderr);
  const firstSyncPayload = JSON.parse(firstSync.stdout) as {
    imported: Array<{ lane: string; file: string; imported: number; entries: string[] }>;
  };
  assert.equal(
    firstSyncPayload.imported.length,
    2,
    "expected one acceptance and one denial doc to import",
  );
  assert.ok(
    firstSyncPayload.imported.some((entry) => entry.lane === "acceptance" && entry.imported === 1),
  );
  assert.ok(
    firstSyncPayload.imported.some((entry) => entry.lane === "denial" && entry.imported === 1),
  );

  const sessionId = `agent-buccet-upl-source-sync-${Date.now()}`;
  const actorId = "user:upl-source-sync-contract";
  const runtimeMuscle = await loadAgentBuccetRuntimeMuscle();
  const store = createBoundaryRuntimeStore({
    session: {
      sessionId,
      actorId,
      createdAt: new Date().toISOString(),
      dryRun: false,
      persistent: false,
      status: "active",
    },
    laws: DEFAULT_BOUNDARY_LAWS,
    grants: [],
    pathLaws: [],
    approvalRequiredFor: [],
    userLawIds: await buildActiveAgentBuccetLawIds({
      executableLaws: DEFAULT_BOUNDARY_LAWS,
      existingLawIds: [],
      runtimeMuscle,
    }),
    processPolicy: undefined,
    governorConfig: DEFAULT_GOVERNOR_CONFIG,
    governorState: initialGovernorState(),
    admissionConfig: DEFAULT_ADMISSION_CONFIG,
    admissionState: initialAdmissionState(),
    persistence: {
      enabled: false,
    },
    upl: { specVersion: 1, userApprovedLawPaths: [], userDeniedLawPaths: [] }, // Initialize with empty, to be updated
    runtimeMuscle,
  });

  const updatedUpl = await readLedger(); // Read the now-populated ledger from disk
  store.replaceConfig({
    // Update the store with the new ledger
    ...store.getConfig(),
    upl: updatedUpl,
    userLawIds: await buildActiveAgentBuccetLawIds({
      executableLaws: DEFAULT_BOUNDARY_LAWS,
      existingLawIds: getActiveUserLawIds(updatedUpl, store.getConfig().session),
      runtimeMuscle,
    }),
  });

  const uplOne = updatedUpl; // Now uplOne correctly reflects the synced ledger
  const uplOneEntries = listUserPathEntries(uplOne);
  const activeAcceptance = uplOneEntries.filter(
    (entry) =>
      entry.type === "APPROVED" &&
      entry.status === "ACTIVE" &&
      entry.notes?.includes("[upl-doc-lane:acceptance]"),
  );
  const activeDenials = uplOneEntries.filter(
    (entry) =>
      entry.type === "DENIED" &&
      entry.status === "ACTIVE" &&
      entry.notes?.includes("[upl-doc-lane:denial]"),
  );
  const runtimeTrackFieldOne = compileLiveUplField({
    ledger: uplOne,
    session: store.getConfig().session,
  });
  assert.equal(activeAcceptance.length, 1, "expected one active acceptance doc law");
  assert.equal(activeDenials.length, 1, "expected one active denial doc law");
  assert.ok(
    runtimeTrackFieldOne.some(
      (segment) =>
        segment.polarity === "allow" && segment.entry.notes?.includes("[upl-doc-lane:acceptance]"),
    ),
  );
  assert.ok(
    runtimeTrackFieldOne.some(
      (segment) =>
        segment.polarity === "deny" && segment.entry.notes?.includes("[upl-doc-lane:denial]"),
    ),
  );
  assert.ok(
    activeAcceptance[0]?.sourceTrack,
    "expected acceptance doc law to carry a source track",
  );
  assert.ok(activeDenials[0]?.sourceTrack, "expected denial doc law to carry a source track");
  assert.equal(activeAcceptance[0]?.sourceTrack?.sourceDocumentPath, acceptanceDocPath);
  assert.equal(activeDenials[0]?.sourceTrack?.sourceDocumentPath, denialDocPath);
  assert.equal(activeAcceptance[0]?.sourceTrack?.syncMode, "upl_sync");
  assert.equal(activeDenials[0]?.sourceTrack?.syncMode, "upl_sync");
  assert.equal(activeAcceptance[0]?.sourceTrack?.lane, "acceptance");
  assert.equal(activeDenials[0]?.sourceTrack?.lane, "denial");
  assert.match(activeAcceptance[0]?.sourceTrack?.sourceDocumentHash ?? "", /^[a-f0-9]{64}$/);
  assert.match(activeDenials[0]?.sourceTrack?.sourceDocumentHash ?? "", /^[a-f0-9]{64}$/);
  assert.match(activeAcceptance[0]?.sourceTrack?.compiledBatchHash ?? "", /^[a-f0-9]{64}$/);
  assert.match(activeDenials[0]?.sourceTrack?.compiledBatchHash ?? "", /^[a-f0-9]{64}$/);

  const initialLedgerRecords = await readLedgerBySessionFromHome(homePath, cliSessionId);
  const sourceReadRecords = initialLedgerRecords.filter(
    (record) => record.META.event_type === "UPL_SOURCE_READ",
  );
  const sourceHashRecords = initialLedgerRecords.filter(
    (record) => record.META.event_type === "UPL_SOURCE_HASHED",
  );
  const batchCompiledRecords = initialLedgerRecords.filter(
    (record) => record.META.event_type === "UPL_BATCH_COMPILED",
  );
  const batchActivatedRecords = initialLedgerRecords.filter(
    (record) => record.META.event_type === "UPL_BATCH_ACTIVATED",
  );
  assert.ok(sourceReadRecords.length >= 2, "expected witnessed reads for UPL source docs");
  assert.ok(sourceHashRecords.length >= 2, "expected witnessed hashes for UPL source docs");
  assert.ok(
    batchCompiledRecords.length >= 2,
    "expected witnessed compiled batches for UPL source docs",
  );
  assert.ok(
    batchActivatedRecords.length >= 2,
    "expected witnessed activated batches for UPL source docs",
  );
  const acceptanceActivation = batchActivatedRecords.find(
    (record) => record.payload.metadata?.source_document === acceptanceDocPath,
  );
  const denialActivation = batchActivatedRecords.find(
    (record) => record.payload.metadata?.source_document === denialDocPath,
  );
  assert.ok(acceptanceActivation, "expected acceptance activation witness");
  assert.ok(denialActivation, "expected denial activation witness");
  assert.equal(
    acceptanceActivation?.payload.metadata?.source_document_hash,
    activeAcceptance[0]?.sourceTrack?.sourceDocumentHash,
  );
  assert.equal(
    denialActivation?.payload.metadata?.source_document_hash,
    activeDenials[0]?.sourceTrack?.sourceDocumentHash,
  );
  assert.equal(
    acceptanceActivation?.payload.metadata?.compiled_batch_hash,
    activeAcceptance[0]?.sourceTrack?.compiledBatchHash,
  );
  assert.equal(
    denialActivation?.payload.metadata?.compiled_batch_hash,
    activeDenials[0]?.sourceTrack?.compiledBatchHash,
  );

  const secondSync = await runCli(["upl", "sync", "--json"], env);
  assert.equal(secondSync.code, 0, secondSync.stderr);
  const uplTwo = await readLedger();
  const uplTwoEntries = listUserPathEntries(uplTwo);
  const secondAcceptance = uplTwoEntries.find(
    (entry) =>
      entry.type === "APPROVED" &&
      entry.status === "ACTIVE" &&
      entry.notes?.includes("[upl-doc-lane:acceptance]"),
  );
  const secondDenial = uplTwoEntries.find(
    (entry) =>
      entry.type === "DENIED" &&
      entry.status === "ACTIVE" &&
      entry.notes?.includes("[upl-doc-lane:denial]"),
  );
  assert.equal(
    secondAcceptance?.sourceTrack?.sourceDocumentHash,
    activeAcceptance[0]?.sourceTrack?.sourceDocumentHash,
    "expected unchanged source doc to keep the same source hash on re-sync",
  );
  assert.equal(
    secondDenial?.sourceTrack?.sourceDocumentHash,
    activeDenials[0]?.sourceTrack?.sourceDocumentHash,
    "expected unchanged denial doc to keep the same source hash on re-sync",
  );
  assert.equal(
    uplTwoEntries.filter(
      (entry) =>
        entry.type === "APPROVED" &&
        entry.status === "ACTIVE" &&
        entry.notes?.includes("[upl-doc-lane:acceptance]"),
    ).length,
    1,
    "expected sync to keep one active acceptance lane law after re-sync",
  );
  assert.equal(
    uplTwoEntries.filter(
      (entry) =>
        entry.type === "DENIED" &&
        entry.status === "ACTIVE" &&
        entry.notes?.includes("[upl-doc-lane:denial]"),
    ).length,
    1,
    "expected sync to keep one active denial lane law after re-sync",
  );

  const spoofedImportPath = path.join(tempRoot, "spoofed-upl.md");
  await fs.writeFile(
    spoofedImportPath,
    [
      "# Spoofed UPL",
      "",
      `Only permit fs.write inside "${railTarget}". Never write outside "${railTarget}".`,
    ].join("\n"),
  );
  const spoofedImport = await runCli(["upl", "import", spoofedImportPath], env);
  assert.notEqual(
    spoofedImport.code,
    0,
    "expected unmanaged external import to stay blocked outside lawful scope",
  );
  assert.match(spoofedImport.stderr, /outside user-opened reachable scope/i);

  const upl = await readLedger();
  store.replaceConfig({
    ...store.getConfig(),
    upl,
    userLawIds: await buildActiveAgentBuccetLawIds({
      executableLaws: DEFAULT_BOUNDARY_LAWS,
      existingLawIds: getActiveUserLawIds(upl, store.getConfig().session),
      runtimeMuscle,
    }),
  });
  const bodyguard = createBoundaryBodyguard(store);

  const allowedWrite = await bodyguard.enforceProposal({
    actionKind: "fs.write",
    target: railTarget,
    payloadSummary: "write rail file",
    provenance: "agent_inference",
    execute: async () => "ok",
    successReason: "write inside acceptance rail",
  });
  assert.equal(allowedWrite.allowed, true, "expected acceptance lane to open a write rail");
  assert.equal(
    allowedWrite.requiresApproval,
    false,
    "expected acceptance lane write to avoid re-prompt",
  );

  const deniedSecretRead = await bodyguard.enforceProposal({
    actionKind: "fs.read",
    target: secretTarget,
    payloadSummary: "read secret file",
    provenance: "agent_inference",
    execute: async () => "should-not-run",
    successReason: "should not read secret",
  });
  assert.equal(deniedSecretRead.allowed, false, "expected denial lane to wall secret reads");
  assert.equal(
    deniedSecretRead.requiresApproval,
    false,
    "expected denial lane to hard deny secret reads",
  );

  const badAcceptanceDocPath = path.join(acceptanceDir!, "bad-denial.md");
  const mixedAcceptanceDocPath = path.join(acceptanceDir!, "mixed-unsupported.md");
  await fs.writeFile(
    badAcceptanceDocPath,
    [
      "# Wrong lane",
      "",
      "Decision: deny",
      "Invariant: Never mention spoilers.",
      "Enforcement: Reject spoiler phrasing entirely.",
      "Forbid: spoilers",
    ].join("\n"),
  );

  const failedSync = await runCli(["upl", "sync"], env);
  assert.notEqual(failedSync.code, 0, "expected lane mismatch to fail sync");
  assert.match(
    failedSync.stderr,
    /does not belong|will not coerce lane polarity|compiled .* lane/i,
  );

  const uplAfterFailure = await readLedger();
  const uplAfterFailureEntries = listUserPathEntries(uplAfterFailure);
  assert.equal(
    uplAfterFailureEntries.filter(
      (entry) =>
        entry.type === "APPROVED" &&
        entry.status === "ACTIVE" &&
        entry.notes?.includes("[upl-doc-lane:acceptance]"),
    ).length,
    1,
    "expected failed sync to preserve existing acceptance lane law",
  );
  assert.equal(
    uplAfterFailureEntries.filter(
      (entry) =>
        entry.type === "DENIED" &&
        entry.status === "ACTIVE" &&
        entry.notes?.includes("[upl-doc-lane:denial]"),
    ).length,
    1,
    "expected failed sync to preserve existing denial lane law",
  );

  await fs.rm(badAcceptanceDocPath, { force: true });

  await fs.writeFile(
    mixedAcceptanceDocPath,
    [
      "# Mixed unsupported law",
      "",
      `Only permit fs.write inside "${railTarget}". Never write outside "${railTarget}".`,
      "",
      "Invariant: Mixed block must not partially snap.",
      "Expression: cosmic legendary phoenix storyteller voice",
      "Require: canon-sigil-42",
    ].join("\n"),
  );

  const mixedFailure = await runCli(["upl", "sync"], env);
  assert.notEqual(mixedFailure.code, 0, "expected unsnappable law block to fail sync");
  assert.match(mixedFailure.stderr, /refuses partial import|unsupported or unsnappable/i);

  const uplAfterMixedFailure = await readLedger();
  const uplAfterMixedFailureEntries = listUserPathEntries(uplAfterMixedFailure);
  assert.equal(
    uplAfterMixedFailureEntries.filter(
      (entry) =>
        entry.type === "APPROVED" &&
        entry.status === "ACTIVE" &&
        entry.notes?.includes("[upl-doc-lane:acceptance]"),
    ).length,
    1,
    "expected partial-snap failure to preserve existing acceptance lane law",
  );
  assert.equal(
    uplAfterMixedFailureEntries.filter(
      (entry) =>
        entry.type === "DENIED" &&
        entry.status === "ACTIVE" &&
        entry.notes?.includes("[upl-doc-lane:denial]"),
    ).length,
    1,
    "expected partial-snap failure to preserve existing denial lane law",
  );

  await fs.rm(badAcceptanceDocPath, { force: true });
  await fs.rm(mixedAcceptanceDocPath, { force: true });
  await fs.rm(acceptanceDocPath, { force: true });
  const emptyAcceptanceSync = await runCli(["upl", "sync", "--lane", "acceptance", "--json"], env);
  assert.equal(emptyAcceptanceSync.code, 0, emptyAcceptanceSync.stderr);
  const uplRemovalState = await readLedger();
  const uplRemovalEntries = listUserPathEntries(uplRemovalState);
  assert.equal(
    uplRemovalEntries.filter(
      (entry) =>
        entry.type === "APPROVED" &&
        entry.status === "ACTIVE" &&
        entry.notes?.includes("[upl-doc-lane:acceptance]"),
    ).length,
    0,
    "expected empty acceptance lane sync to remove active acceptance doc laws",
  );
  assert.equal(
    uplRemovalEntries.filter(
      (entry) =>
        entry.type === "DENIED" &&
        entry.status === "ACTIVE" &&
        entry.notes?.includes("[upl-doc-lane:denial]"),
    ).length,
    1,
    "expected empty acceptance sync to leave denial lane untouched",
  );

  const readmeIntakePath = path.join(acceptanceDir!, "README.md");
  await fs.writeFile(
    readmeIntakePath,
    [
      "# Readme Probe",
      "",
      "## Usage",
      "",
      "```bash",
      "readme-probe run https://docs.example.com",
      "```",
      "",
      "API endpoint: https://api.readme-probe.dev/v1",
    ].join("\n"),
  );

  const readmeSync = await runCli(["upl", "sync", "--lane", "acceptance", "--json"], env);
  assert.equal(readmeSync.code, 0, readmeSync.stderr);

  const readmeSearch = await runCli(["upl", "search", "readme-probe", "--json"], env);
  assert.equal(readmeSearch.code, 0, readmeSearch.stderr);
  const readmeState = JSON.parse(readmeSearch.stdout) as {
    matches: Array<{
      entry: {
        type: string;
        notes?: string | null;
        trackConstraint?: { allowedActionKinds?: string[] };
      };
    }>;
  };
  const readmeEntries = readmeState.matches
    .map((row) => row.entry)
    .filter(
      (entry) =>
        entry.type === "APPROVED" &&
        entry.notes?.includes("[acceptance-source-intake]") &&
        entry.notes?.includes("name=Readme Probe"),
    );
  assert.ok(
    readmeEntries.length >= 1,
    "expected README.md source intake to compile into approved UPL",
  );
  await fs.rm(readmeIntakePath, { force: true });

  const intakeDocPath = path.join(acceptanceDir!, "pdf-processing.md");
  await fs.writeFile(
    intakeDocPath,
    [
      "# PDF Processing",
      "",
      "Catalog: SkillHub",
      "URL: https://skillhub.club/skills/pdf-processing",
      "",
      "## Source material",
      "Copied text:",
      "Read PDFs, extract tables, fill forms, merge and split documents for normal document work.",
    ].join("\n"),
  );

  const intakeSync = await runCli(["upl", "sync", "--lane", "acceptance", "--json"], env);
  assert.equal(intakeSync.code, 0, intakeSync.stderr);

  const uplIntakeState = await readLedger();
  const intakeEntry = listUserPathEntries(uplIntakeState).find(
    (entry) =>
      entry.type === "APPROVED" &&
      entry.status === "ACTIVE" &&
      entry.notes?.includes("[acceptance-source-intake]"),
  );
  assert.ok(intakeEntry, "expected raw acceptance source intake to compile into approved UPL");
  assert.match(intakeEntry?.notes ?? "", /catalog=SkillHub/);

  await fs.writeFile(
    intakeDocPath,
    [
      "# Firecrawl",
      "",
      "Turn websites into markdown and structured data for research and extraction workflows.",
      "Action: crawl and extract websites for research.",
      "Target: documentation sites and article pages.",
      "",
      "## Usage",
      "",
      "Use the Firecrawl API to crawl and extract web pages.",
      "",
      "```bash",
      "firecrawl crawl https://docs.example.com",
      "```",
      "",
      "API endpoint: https://api.firecrawl.dev/v1",
    ].join("\n"),
  );

  const rawIntakeSync = await runCli(["upl", "sync", "--lane", "acceptance", "--json"], env);
  assert.equal(rawIntakeSync.code, 0, rawIntakeSync.stderr);

  const rawIntakeSearch = await runCli(["upl", "search", "firecrawl", "--json"], env);
  assert.equal(rawIntakeSearch.code, 0, rawIntakeSearch.stderr);
  const rawIntakeState = JSON.parse(rawIntakeSearch.stdout) as {
    matches: Array<{
      entry: {
        notes?: string | null;
        trackConstraint?: { allowedActionKinds?: string[]; targetPatterns?: string[] };
      };
    }>;
  };
  const rawEntries = rawIntakeState.matches
    .map((row) => row.entry)
    .filter(
      (entry) =>
        entry.notes?.includes("[acceptance-source-intake]") &&
        entry.notes?.includes("name=Firecrawl"),
    );
  assert.ok(
    rawEntries.length >= 2,
    "expected raw skill markdown to compile into multiple acceptance entries",
  );
  assert.ok(
    rawEntries.some((entry) => entry.trackConstraint?.allowedActionKinds?.includes("tool.exec")),
  );
  assert.ok(
    rawEntries.some((entry) => entry.trackConstraint?.allowedActionKinds?.includes("network.send")),
  );
  assert.ok(
    rawEntries.some((entry) =>
      entry.trackConstraint?.targetPatterns?.some((pattern) => pattern.includes("firecrawl")),
    ),
  );
  assert.ok(
    rawEntries.some((entry) =>
      entry.trackConstraint?.targetPatterns?.some((pattern) =>
        pattern.includes("api\\.firecrawl\\.dev"),
      ),
    ),
  );

  const latestUpl = JSON.parse(await fs.readFile(ledgerPath, "utf8")) as BoundaryUserPathLedger;
  store.replaceConfig({
    ...store.getConfig(),
    upl: latestUpl,
    userLawIds: await buildActiveAgentBuccetLawIds({
      executableLaws: DEFAULT_BOUNDARY_LAWS,
      existingLawIds: getActiveUserLawIds(latestUpl, store.getConfig().session),
      runtimeMuscle,
    }),
  });

  const allowedFirecrawlExec = await bodyguard.enforceProposal({
    actionKind: "tool.exec",
    target: "firecrawl",
    payloadSummary: "firecrawl crawl docs site",
    provenance: "agent_inference",
    execute: async () => "ok",
    successReason: "run firecrawl command",
  });
  assert.equal(
    allowedFirecrawlExec.allowed,
    true,
    "expected raw skill markdown to open tool.exec corridor",
  );
  assert.equal(
    allowedFirecrawlExec.requiresApproval,
    false,
    "expected sourced tool corridor to avoid re-prompt",
  );

  const allowedFirecrawlApi = await bodyguard.enforceProposal({
    actionKind: "network.send",
    target: "https://api.firecrawl.dev/v1/crawl",
    payloadSummary: "firecrawl crawl request",
    provenance: "agent_inference",
    execute: async () => "ok",
    successReason: "call firecrawl api",
  });
  assert.equal(
    allowedFirecrawlApi.allowed,
    true,
    "expected raw skill markdown to open network corridor",
  );
  assert.equal(
    allowedFirecrawlApi.requiresApproval,
    false,
    "expected sourced network corridor to avoid re-prompt",
  );

  const rawDenialDocPath = path.join(denialDir!, "stealth-browser-mcp.md");
  await fs.writeFile(
    rawDenialDocPath,
    [
      "# Stealth Browser MCP",
      "",
      "Undetectable browser automation with stealth browsing and anti-bot bypass.",
      "",
      "## Usage",
      "",
      "```bash",
      "playwright-mcp run https://stealth.example.com",
      "```",
      "",
      "API endpoint: https://stealth.example.com/api",
    ].join("\n"),
  );

  const rawDenialSync = await runCli(["upl", "sync", "--lane", "denial", "--json"], env);
  assert.equal(rawDenialSync.code, 0, rawDenialSync.stderr);

  const rawDenialSearch = await runCli(["upl", "search", "stealth-browser", "--json"], env);
  assert.equal(rawDenialSearch.code, 0, rawDenialSearch.stderr);
  const rawDenialState = JSON.parse(rawDenialSearch.stdout) as {
    matches: Array<{
      entry: {
        type: string;
        notes?: string | null;
        trackConstraint?: { allowedActionKinds?: string[]; targetPatterns?: string[] };
      };
    }>;
  };
  const deniedEntries = rawDenialState.matches
    .map((row) => row.entry)
    .filter(
      (entry) =>
        entry.type === "DENIED" &&
        entry.notes?.includes("[denial-source-intake]") &&
        entry.notes?.includes("name=Stealth Browser MCP"),
    );
  assert.ok(
    deniedEntries.length >= 2,
    "expected raw denial source markdown to compile into multiple denied entries",
  );
  assert.ok(
    deniedEntries.some((entry) => entry.trackConstraint?.allowedActionKinds?.includes("tool.exec")),
  );
  assert.ok(
    deniedEntries.some((entry) =>
      entry.trackConstraint?.allowedActionKinds?.includes("network.send"),
    ),
  );

  const latestDeniedUpl = JSON.parse(
    await fs.readFile(ledgerPath, "utf8"),
  ) as BoundaryUserPathLedger;
  store.replaceConfig({
    ...store.getConfig(),
    upl: latestDeniedUpl,
    userLawIds: await buildActiveAgentBuccetLawIds({
      executableLaws: DEFAULT_BOUNDARY_LAWS,
      existingLawIds: getActiveUserLawIds(latestDeniedUpl, store.getConfig().session),
      runtimeMuscle,
    }),
  });

  const deniedTrackField = compileLiveUplField({
    ledger: latestDeniedUpl,
    session: store.getConfig().session,
  });
  assert.ok(
    deniedTrackField.some(
      (segment) =>
        segment.polarity === "deny" &&
        segment.entry.notes?.includes("[denial-source-intake]") &&
        segment.entry.notes?.includes("name=Stealth Browser MCP") &&
        segment.entry.trackConstraint?.allowedActionKinds?.includes("tool.exec") &&
        segment.entry.trackConstraint?.targetPatterns?.some((pattern) =>
          pattern.includes("playwright-mcp"),
        ),
    ),
    "expected raw denial intake to compile a deny tool corridor",
  );

  const deniedStealthExec = await bodyguard.enforceProposal({
    actionKind: "tool.exec",
    target: "playwright-mcp",
    payloadSummary: "run stealth browser automation",
    provenance: "agent_inference",
    execute: async () => "should-not-run",
    successReason: "should not run stealth browser",
  });
  assert.equal(
    deniedStealthExec.allowed,
    false,
    "expected raw denial intake to wall tool.exec corridor",
  );
  assert.equal(
    deniedStealthExec.requiresApproval,
    false,
    "expected raw denial intake to hard deny tool.exec corridor",
  );

  assert.ok(
    deniedTrackField.some(
      (segment) =>
        segment.polarity === "deny" &&
        segment.entry.notes?.includes("[denial-source-intake]") &&
        segment.entry.notes?.includes("name=Stealth Browser MCP") &&
        segment.entry.trackConstraint?.allowedActionKinds?.includes("network.send") &&
        segment.entry.trackConstraint?.targetPatterns?.some((pattern) =>
          pattern.includes("stealth\\.example\\.com"),
        ),
    ),
    "expected raw denial intake to compile a deny network corridor",
  );

  const deniedStealthApi = await bodyguard.enforceProposal({
    actionKind: "network.send",
    target: "https://stealth.example.com/api",
    payloadSummary: "call stealth browser api",
    provenance: "agent_inference",
    execute: async () => "should-not-run",
    successReason: "should not call stealth browser api",
  });
  assert.equal(
    deniedStealthApi.allowed,
    false,
    "expected raw denial intake to wall network corridor",
  );
  assert.equal(
    deniedStealthApi.requiresApproval,
    false,
    "expected raw denial intake to hard deny network corridor",
  );
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
