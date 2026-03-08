import { randomUUID } from "node:crypto";
import { evaluateTimelineMutationPolicy } from "../../lib/product/mutation-policy.ts";
import { getAuthContext, requireRole } from "../../lib/auth/rbac.ts";
import { attachCaseArtifact, createCase } from "../../lib/storage/product-store.ts";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function makeRequest(headers: Record<string, string>): Request {
  return new Request("http://localhost/test", {
    method: "POST",
    headers,
  });
}

async function main() {
  const lawyerId = `lawyer-${randomUUID()}`;
  const clientId = `client-${randomUUID()}`;

  let missingAuthError = false;
  try {
    getAuthContext(makeRequest({}));
  } catch {
    missingAuthError = true;
  }
  assert(missingAuthError, "Expected missing auth headers to be rejected.");

  const lawyerContext = getAuthContext(
    makeRequest({
      "x-role": "lawyer",
      "x-user-id": lawyerId,
    }),
  );
  requireRole(lawyerContext, ["lawyer"]);

  let forbiddenRole = false;
  try {
    requireRole(lawyerContext, ["client"]);
  } catch {
    forbiddenRole = true;
  }
  assert(forbiddenRole, "Expected role mismatch to be rejected.");

  const created = await createCase({
    title: "Policy enforcement case",
    firmId: "firm-policy",
    clientId,
    clientName: "Policy Client",
    assignedLawyerId: lawyerId,
    createdBy: lawyerId,
  });

  const waitingPolicyFail = await evaluateTimelineMutationPolicy({
    caseId: created.id,
    status: "waiting",
    riskBand: "C6",
  });
  assert(!waitingPolicyFail.ok, "Expected waiting policy to fail without owner/dueAt.");

  const highRiskNoArtifact = await evaluateTimelineMutationPolicy({
    caseId: created.id,
    status: "in_progress",
    riskBand: "C1",
  });
  assert(!highRiskNoArtifact.ok, "Expected high-risk update to fail without artifacts.");

  await attachCaseArtifact({
    caseId: created.id,
    uploadedBy: lawyerId,
    name: "proof.txt",
    contentType: "text/plain",
    digest: "digest-test",
    sizeBytes: 5,
    storageRef: "data/product/artifacts/proof.txt",
    visibility: "private",
  });

  const highRiskAutoBind = await evaluateTimelineMutationPolicy({
    caseId: created.id,
    status: "in_progress",
    riskBand: "C1",
  });
  assert(highRiskAutoBind.ok, "Expected high-risk update to pass with auto-bound artifact refs.");
  assert(highRiskAutoBind.artifactRefs.length > 0, "Expected auto-bound artifact refs to be populated.");

  const waitingPass = await evaluateTimelineMutationPolicy({
    caseId: created.id,
    status: "waiting",
    ownerId: lawyerId,
    dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    riskBand: "C6",
  });
  assert(waitingPass.ok, "Expected waiting policy to pass with owner and dueAt.");

  console.log("Product API RBAC/fail-closed suite passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
