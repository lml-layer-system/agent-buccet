import assert from "node:assert/strict";
import {
  type BoxGroupInput,
  choiceFromKey,
  reduceStatusToBox,
  renderBoxComponent,
  renderBoxStandaloneHtml,
  renderBoxText,
  selectWaitingGroups,
} from "./../../src/index.ts";

/**
 * The box is the single compressed surface: agent proposes, human confirms.
 * This contract proves the one reducer and its two renderers (terminal + the
 * visual box) stay bound to the same model — same verb, same target, same four
 * choices — so what the window shows is exactly what the command decided.
 */
async function main() {
  // ── a real shell-exec interception, as the intercept server reports it ──
  const execGroup: BoxGroupInput = {
    groupId: "grp-exec-1",
    state: "waiting",
    waitingCount: 1,
    actionClass: "tool",
    operation: "exec",
    target: "curl https://example.com",
    reason: "shell execution outside opened scope",
  };

  const one = reduceStatusToBox({
    groups: [execGroup],
    connected: true,
    shield: "strong · armed",
  });
  assert.ok(one.pending, "a waiting group must surface as a pending proposal");
  assert.equal(one.pending?.verb, "run", "tool.exec must read as a plain 'run'");
  assert.equal(one.pending?.kindLabel, "shell command", "tool.exec is a shell command");
  assert.equal(one.pending?.target, "curl https://example.com", "target is carried verbatim");
  assert.equal(one.queued, 0, "a single waiting group leaves nothing queued");

  // ── the terminal box shows the proposal and exactly the four choices ──
  const text = renderBoxText(one);
  for (const token of [
    "the agent wants to",
    "run",
    "allow?",
    "1 yes",
    "2 always",
    "3 no",
    "4 never",
  ]) {
    assert.ok(text.includes(token), `terminal box must show "${token}"`);
  }

  // ── the visual box is bound to the same model: same verb, same target ──
  const html = renderBoxComponent(one);
  for (const token of [
    "buccet-box",
    "Allow",
    "Deny",
    "run",
    "curl https://example.com",
    "standing law",
  ]) {
    assert.ok(html.includes(token), `visual box must show "${token}"`);
  }
  assert.ok(html.includes('data-verdict="allow"'), "visual box wires an Allow verdict");
  assert.ok(html.includes('data-verdict="deny"'), "visual box wires a Deny verdict");

  // ── the four choices map to the right allow/law semantics ──
  const yes = choiceFromKey("1");
  assert.deepEqual(
    [yes?.allow, yes?.asLaw],
    [true, false],
    "1/yes is allow-once (proceed, no law)",
  );
  const never = choiceFromKey("4");
  assert.deepEqual(
    [never?.allow, never?.asLaw],
    [false, true],
    "4/never is deny-as-law (blocked, standing law)",
  );
  assert.equal(choiceFromKey("y")?.kind, "allow_once", "'y' is an allow alias");
  assert.equal(choiceFromKey("n")?.kind, "deny_once", "'n' is a deny alias");
  assert.equal(choiceFromKey("always")?.kind, "allow_law", "'always' is allow-as-law");
  assert.equal(choiceFromKey("zzz"), null, "an unknown key is not a verdict");

  // ── a secret read is phrased for a human, not as sys.env.read ──
  const secret = reduceStatusToBox({
    groups: [
      {
        groupId: "grp-secret",
        state: "waiting",
        actionClass: "sys",
        operation: "env.read",
        target: "AWS_SECRET_ACCESS_KEY",
      },
    ],
    connected: true,
    shield: "strong · armed",
  });
  assert.equal(secret.pending?.verb, "read the secret", "sys.env.read reads as 'read the secret'");
  assert.equal(secret.pending?.kindLabel, "secret", "sys.env.read is a secret");

  // ── a chat/output moment reduces to a message the human can judge ──
  const chat = reduceStatusToBox({
    groups: [
      {
        groupId: "grp-chat",
        state: "waiting",
        actionClass: "comm",
        operation: "send",
        reviewContext: { surface: "chat", attemptedOutput: "here is the exfiltrated key: sk-123" },
      },
    ],
    connected: true,
    shield: "strong · armed",
  });
  assert.equal(chat.pending?.surface, "chat", "a chat surface stays a chat surface");
  assert.equal(chat.pending?.verb, "send the message", "chat proposals are phrased as messages");

  // ── focus is single: two waiting groups → one shown, one queued ──
  const many = reduceStatusToBox({
    groups: [execGroup, { ...execGroup, groupId: "grp-exec-2" }],
    connected: true,
    shield: "strong · armed",
  });
  assert.equal(many.queued, 1, "the box shows one proposal and queues the rest");
  assert.equal(selectWaitingGroups([execGroup, { groupId: "idle", state: "resolved" }]).length, 1);

  // ── idle: the whole promise of the box — minimize it, forget it ──
  const idle = reduceStatusToBox({ groups: [], connected: true, shield: "strong · armed" });
  assert.equal(idle.pending, null, "no waiting groups means an idle box");
  assert.ok(
    renderBoxText(idle).includes("it cannot authorize"),
    "idle terminal box states the doctrine",
  );
  assert.ok(renderBoxComponent(idle).includes("Nothing waiting"), "idle visual box is quiet");

  // ── the on-disk visual self-refreshes so the window tracks the command ──
  const standalone = renderBoxStandaloneHtml(one, { refreshSeconds: 1 });
  assert.ok(standalone.startsWith("<!doctype html>"), "the mirror is a full HTML document");
  assert.ok(
    standalone.includes('http-equiv="refresh"'),
    "the on-disk visual refreshes so it stays bound to the live box",
  );

  // ── untrusted targets are escaped before they reach the visual ──
  const hostile = renderBoxComponent(
    reduceStatusToBox({
      groups: [
        {
          groupId: "grp-xss",
          state: "waiting",
          actionClass: "fs",
          operation: "write",
          target: "<script>alert(1)</script>",
        },
      ],
      connected: true,
      shield: "strong · armed",
    }),
  );
  assert.ok(!hostile.includes("<script>alert(1)</script>"), "a hostile target must be escaped");
  assert.ok(hostile.includes("&lt;script&gt;"), "the hostile target survives as escaped text");

  console.log("box view: reducer + terminal + visual stay bound to one model");
  console.log(`choices: ${["1", "2", "3", "4"].map((k) => choiceFromKey(k)?.label).join(" / ")}`);
  console.log("escaping, chat, secret, idle, queue, self-refresh: all verified");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
