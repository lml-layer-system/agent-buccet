import {
  createPersistentBoundaryRuntimeStore,
  createBoundaryBodyguard,
  inferBoundaryEgressFlagsFromPayload,
} from "../lib/agent-buccet/index.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  // --- Unit: inferBoundaryEgressFlagsFromPayload ---

  const cleanPayload = "Hello, here is the weather report for today.";
  const cleanFlags = inferBoundaryEgressFlagsFromPayload(cleanPayload);
  assert(!cleanFlags?.payloadContainsPii, "clean payload should not flag PII");
  assert(!cleanFlags?.payloadContainsCredential, "clean payload should not flag credential");
  assert(!cleanFlags?.payloadContainsFinancialData, "clean payload should not flag financial");

  const emailPayload = "Please forward this to alice@example.com for review.";
  const emailFlags = inferBoundaryEgressFlagsFromPayload(emailPayload);
  assert(emailFlags?.payloadContainsPii === true, "email address should flag PII");

  const phonePayload = "Call me at (555) 867-5309 anytime.";
  const phoneFlags = inferBoundaryEgressFlagsFromPayload(phonePayload);
  assert(phoneFlags?.payloadContainsPii === true, "phone number should flag PII");

  const ssnPayload = "User SSN is 123-45-6789.";
  const ssnFlags = inferBoundaryEgressFlagsFromPayload(ssnPayload);
  assert(ssnFlags?.payloadContainsPii === true, "SSN should flag PII");

  const apiKeyPayload = "Authorization: Bearer sk-abcdefghijklmnopqrstuvwxyz1234567890";
  const apiKeyFlags = inferBoundaryEgressFlagsFromPayload(apiKeyPayload);
  assert(apiKeyFlags?.payloadContainsCredential === true, "API key should flag credential");

  const privateKeyPayload = "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQ...\n-----END RSA PRIVATE KEY-----";
  const privateKeyFlags = inferBoundaryEgressFlagsFromPayload(privateKeyPayload);
  assert(privateKeyFlags?.payloadContainsCredential === true, "private key should flag credential");

  // Visa test card 4111111111111111 — known valid Luhn
  const cardPayload = "Card: 4111111111111111";
  const cardFlags = inferBoundaryEgressFlagsFromPayload(cardPayload);
  assert(cardFlags?.payloadContainsFinancialData === true, "valid card number should flag financial");

  // Invalid Luhn (4111111111111112) — should not flag
  const badCardPayload = "Card: 4111111111111112";
  const badCardFlags = inferBoundaryEgressFlagsFromPayload(badCardPayload);
  assert(!badCardFlags?.payloadContainsFinancialData, "invalid Luhn should not flag financial");

  // --- Integration: laws deny outbound PII via network.send ---

  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const sessionId = `agent-buccet-egress-${runId}`;
  const actorId = "user:egress-contract";

  const store = await createPersistentBoundaryRuntimeStore({ sessionId, actorId });
  await store.openPath({
    rootPath: "/",
    grantedActions: ["network.send"],
    issuedBy: actorId,
  });
  const bodyguard = createBoundaryBodyguard(store);

  const piiResult = await bodyguard.enforceProposal({
    actionKind: "network.send",
    target: "https://api.example.com/submit",
    payloadSummary: "POST body",
    flags: inferBoundaryEgressFlagsFromPayload("Sending user data for alice@example.com"),
    execute: async () => "should-not-run",
    successReason: "network send admitted",
  });

  assert(!piiResult.allowed, "network.send with PII flag should be denied");
  assert(!piiResult.executed, "network.send with PII flag should not execute");
  assert(
    piiResult.nslMoves.some((m) => m.kind === "deny_and_explain"),
    "expected deny_and_explain move for blocked egress",
  );

  const credResult = await bodyguard.enforceProposal({
    actionKind: "network.send",
    target: "https://api.example.com/submit",
    payloadSummary: "POST body",
    flags: inferBoundaryEgressFlagsFromPayload("token=sk-abcdefghijklmnopqrstuvwxyz"),
    execute: async () => "should-not-run",
    successReason: "network send admitted",
  });

  assert(!credResult.allowed, "network.send with credential flag should be denied");

  const financialResult = await bodyguard.enforceProposal({
    actionKind: "network.send",
    target: "https://api.example.com/submit",
    payloadSummary: "POST body",
    flags: inferBoundaryEgressFlagsFromPayload("Card: 4111111111111111"),
    execute: async () => "should-not-run",
    successReason: "network send admitted",
  });

  assert(!financialResult.allowed, "network.send with financial flag should be denied");

  const cleanResult = await bodyguard.enforceProposal({
    actionKind: "network.send",
    target: "https://api.example.com/submit",
    payloadSummary: "POST body",
    flags: inferBoundaryEgressFlagsFromPayload(cleanPayload),
    execute: async () => "clean-send-complete",
    successReason: "network send admitted",
  });

  // network.send requires approval by default even without egress flags, so it should reach approval queue
  assert(!cleanResult.executed, "clean network.send without approval handler should not execute");

  console.log("Agent Buccet egress contract");
  console.log(`clean payload PII: ${cleanFlags?.payloadContainsPii ?? false}`);
  console.log(`email payload PII: ${emailFlags?.payloadContainsPii}`);
  console.log(`api key credential: ${apiKeyFlags?.payloadContainsCredential}`);
  console.log(`valid card financial: ${cardFlags?.payloadContainsFinancialData}`);
  console.log(`invalid Luhn financial: ${badCardFlags?.payloadContainsFinancialData ?? false}`);
  console.log(`PII network.send denied: ${!piiResult.allowed}`);
  console.log(`credential network.send denied: ${!credResult.allowed}`);
  console.log(`financial network.send denied: ${!financialResult.allowed}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
