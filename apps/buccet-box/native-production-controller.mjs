/**
 * Trusted-controller integration probe for the *actual* Buccet filesystem
 * executor. Only the CI orchestrator uses sudo; agents never get sudo.
 *
 * This is a minimal controlled entrypoint for exercising executeScopedFileTool
 * with a real approved path law and the privileged broker, NOT a general
 * agent-facing privilege escalation helper or a service deployment recipe.
 */
import { executeScopedFileTool } from "../../src/box/confined-fs.ts";

if (process.geteuid?.() !== 0 || process.env.AGENT_BUCCET_REQUIRE_ISOLATED_FS !== "1") {
  throw new Error("BUCCET_CONTROLLER_DENIED: protected trusted controller required");
}
const root = process.env.AGENT_BUCCET_FS_BROKER_ROOT;
if (!root || !root.startsWith("/") || root === "/") {
  throw new Error("BUCCET_CONTROLLER_DENIED: managed root unavailable");
}
let input;
try {
  input = JSON.parse(process.argv[2] ?? "");
} catch {
  throw new Error("BUCCET_CONTROLLER_DENIED: invalid test operation");
}
if (!input || typeof input !== "object" ||
    !["read_file","write_file","append_file","delete_file","make_directory","move_file"].includes(input.tool)) {
  throw new Error("BUCCET_CONTROLLER_DENIED: unrecognized filesystem test operation");
}
const law = {
  lawId: "BUCCET.TEST.PROTECTED.ROOT",
  sessionId: "trusted-controller-probe",
  rootPath: root,
  grantedActions: ["fs.read", "fs.write", "fs.append", "fs.delete", "fs.mkdir", "fs.move"],
  issuedBy: "trusted-controller-probe",
  instantiatedAt: new Date().toISOString(),
};
try {
  const result = await executeScopedFileTool(input.tool, input.args ?? {}, [law]);
  process.stdout.write(JSON.stringify({ok:true,result}) + "\n");
} catch (error) {
  process.stderr.write("BUCCET_CONTROLLER_DENIED: " +
    (error instanceof Error ? error.message : String(error)) + "\n");
  process.exitCode = 73;
}
