const api = window.buccetBox;
let current = null;
let busy = false;

const byId = (id) => document.getElementById(id);
function text(id, value) { byId(id).textContent = value == null ? "" : String(value); }
function make(tag, className, value) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (value != null) element.textContent = String(value);
  return element;
}
function renderEvents(events) {
  const list = byId("activity-list");
  list.replaceChildren();
  text("activity-count", `${events.length} events`);
  if (!events.length) {
    list.append(make("p", "empty", "No observed decisions yet. Connect an agent and run a Buccet-governed action."));
    return;
  }
  for (const event of events.slice(0, 25)) {
    const denied = event.decision !== "allow";
    const row = make("div", denied ? "event denied" : "event");
    row.append(make("div", "symbol", denied ? "×" : "✓"));
    const content = make("div", "event-content");
    content.append(make("div", "event-heading", `${denied ? "Denied" : "Allowed"} · ${event.actorId || "Agent"} · ${event.actionKind || "action"}`));
    content.append(make("div", "event-target", event.target));
    content.append(make("div", "event-reason", event.reason));
    row.append(content);
    const time = make("time", "", event.occurredAt ? new Date(event.occurredAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "");
    row.append(time);
    list.append(row);
  }
}

function render(next) {
  if (!next || typeof next !== "object") return;
  current = next;
  const mode = next.mode === "autonomous" ? "autonomous" : "interactive";
  const interactive = mode === "interactive";
  const status = byId("bridge-status");
  text("bridge-status", next.running ? "● Box active" : "● Box offline");
  status.classList.toggle("offline", !next.running);
  text("mode-badge", interactive ? "Asks you" : "Notification only");
  text("mode-description", interactive
    ? "UPL asks when a held action needs human authorization. Other lawful actions continue without interruption."
    : "No approval interruptions. Buccet follows standing UPL law, denies unresolved actions, and notifies you of allowed or blocked activity.");
  for (const [id, selected] of [["interactive-btn", interactive], ["autonomous-btn", !interactive]]) {
    const button = byId(id);
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  }
  const approvals = Array.isArray(next.pending) ? next.pending : [];
  const approval = interactive ? approvals[0] : null;
  byId("approval-section").hidden = !approval;
  if (approval) {
    text("approval-question", approval.question || "Allow this action?");
    text("approval-actor", approval.actorId || "Connected agent");
    text("approval-action", approval.actionKind);
    text("approval-target", approval.target);
    text("approval-reason", approval.reason);
    text("approval-payload", approval.payloadSummary || "");
    byId("approval-payload-row").hidden = !approval.payloadSummary;
    text("approval-count", approvals.length > 1 ? `${approvals.length - 1} additional request(s) waiting` : "");
    byId("allow-once").disabled = busy;
    byId("deny-once").disabled = busy;
  }
  text("cursor-status", next.hosts?.cursor ? "MCP configured · restart Cursor" : "Not configured");
  text("claude-status", next.hosts?.claude ? "MCP configured · restart Claude" : "Not configured");
  renderEvents(Array.isArray(next.activity) ? next.activity : []);
}

async function resolve(choice) {
  if (busy || !current?.pending?.[0]) return;
  busy = true;
  byId("allow-once").disabled = true;
  byId("deny-once").disabled = true;
  try {
    await api.decide(current.pending[0].approvalId, choice);
  } catch (error) {
    text("connection-result", error.message || String(error));
  } finally {
    busy = false;
    render(await api.getState());
  }
}

byId("allow-once").addEventListener("click", () => resolve("allow_once"));
byId("deny-once").addEventListener("click", () => resolve("deny_once"));
byId("interactive-btn").addEventListener("click", async () => render(await api.setMode("interactive")));
byId("autonomous-btn").addEventListener("click", async () => render(await api.setMode("autonomous")));
for (const [host, id] of [["cursor", "connect-cursor"], ["claude", "connect-claude"]]) {
  byId(id).addEventListener("click", async () => {
    const button = byId(id);
    button.disabled = true;
    try {
      const outcome = await api.connect(host);
      const feedback = byId("connection-result");
      feedback.classList.toggle("error", !outcome.ok && !outcome.cancelled);
      feedback.textContent = outcome.ok ? outcome.detail : (outcome.cancelled ? "" : outcome.error);
      render(await api.getState());
    } catch (error) {
      const feedback = byId("connection-result");
      feedback.classList.add("error");
      feedback.textContent = error.message || String(error);
    } finally {
      button.disabled = false;
    }
  });
}
byId("show-logs").addEventListener("click", () => api.openLogs());
byId("hide-box").addEventListener("click", () => api.hide());
api.onState(render);
api.getState().then(render).catch((err) => text("bridge-status", `Box error: ${err.message}`));
