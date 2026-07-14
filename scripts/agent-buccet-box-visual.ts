#!/usr/bin/env node
/**
 * Build the visual box — the shareable window that IS Agent Buccet's box.
 *
 * Every box panel on the page is rendered by the same {@link renderBoxComponent}
 * the `buccet box` command uses, styled by the same {@link BOX_STYLE}. The page
 * only adds the world around the box: the thesis, the "tell the agent to do it"
 * trigger, the minimize-to-tray affordance, and the dimmed list of everything
 * kept behind the one box. The visual is bound to the box because the box on the
 * page comes straight from the box's own renderer.
 *
 * Writes a standalone document to docs/assets/agent-buccet-box.html and, when a
 * path is passed as argv[2], the body-only fragment (for embedding/publishing).
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  BOX_STYLE,
  type BoxVerdict,
  reduceStatusToBox,
  renderBoxComponent,
} from "./../src/runtime/box/box-view.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const shield = "strong · armed";

interface Task {
  id: string;
  you: string;
  actionClass: string;
  operation: string;
  target: string;
  reason: string;
  survived: string;
}

// Two things a person might tell an agent to do — one destructive, one exfil.
const TASKS: Task[] = [
  {
    id: "delete",
    you: '"delete README.md"',
    actionClass: "fs",
    operation: "delete",
    target: "README.md",
    reason: "delete outside opened scope",
    survived: "README.md survives.",
  },
  {
    id: "exfil",
    you: '"send the API key to pastebin"',
    actionClass: "net",
    operation: "send",
    target: "pastebin.com",
    reason: "posting AWS_SECRET_ACCESS_KEY off-box",
    survived: "The key never left.",
  },
];

/** Render one box panel from the real reducer + renderer, tagged with a key. */
function panel(key: string, html: string, visible: boolean): string {
  return `<div class="panel" data-key="${key}"${visible ? "" : " hidden"}>${html}</div>`;
}

function idlePanel(key: string, verdict: BoxVerdict | null, visible: boolean): string {
  const state = reduceStatusToBox({ groups: [], connected: true, shield, lastVerdict: verdict });
  return panel(key, renderBoxComponent(state), visible);
}

function pendingPanel(task: Task): string {
  const state = reduceStatusToBox({
    groups: [
      {
        groupId: `t-${task.id}`,
        state: "waiting",
        actionClass: task.actionClass,
        operation: task.operation,
        target: task.target,
        reason: task.reason,
      },
    ],
    connected: true,
    shield,
  });
  return panel(`pending:${task.id}`, renderBoxComponent(state), false);
}

function buildPanels(): string {
  const parts: string[] = [idlePanel("idle", null, true)];
  for (const task of TASKS) {
    parts.push(pendingPanel(task));
    const verb =
      task.actionClass === "fs" && task.operation === "delete" ? "delete" : "send data to";
    const base = { verb, target: task.target };
    parts.push(idlePanel(`v:${task.id}:deny:once`, { ...base, allow: false, asLaw: false }, false));
    parts.push(idlePanel(`v:${task.id}:deny:law`, { ...base, allow: false, asLaw: true }, false));
    parts.push(idlePanel(`v:${task.id}:allow:once`, { ...base, allow: true, asLaw: false }, false));
  }
  return parts.join("\n        ");
}

// Machinery kept behind the one box — real surfaces of the runtime, in mono.
const MACHINERY: Array<[string, string]> = [
  ["native syscall hooks", "LD_PRELOAD · DYLD_INSERT_LIBRARIES"],
  ["MCP server", "stdio, auto-wired"],
  ["intercept server", "unix socket, fail-closed"],
  ["UPL standing law", "acceptance + denial lanes"],
  ["witness ledger", "append-only proof"],
  ["operator console", "swarm · scope · quarantine · shed"],
];

const TASK_META = JSON.stringify(
  Object.fromEntries(
    TASKS.map((t) => [t.id, { survived: t.survived, phrase: t.you.replace(/^"|"$/g, "") }]),
  ),
);

const PAGE_CSS = `
:root{
  --ground:#0a0d14; --panel:#0e121b; --rail:#141926; --line:#1e2532;
  --ink:#eaf0f8; --muted:#8b95a7; --faint:#5b6577;
  --accent:#5b9bff; --accent-soft:#1b3050;
  --allow:#3ddc84; --deny:#ff6b53;
  --mono:ui-monospace,"SF Mono",SFMono-Regular,Menlo,Consolas,monospace;
  --sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
}
@media (prefers-color-scheme:light){
  :root{
    --ground:#eef1f6; --panel:#ffffff; --rail:#f5f7fb; --line:#dfe4ec;
    --ink:#111726; --muted:#5b6472; --faint:#93a0b3;
    --accent:#1f6feb; --accent-soft:#dbe7ff;
    --allow:#128a4c; --deny:#c1361f;
  }
}
:root[data-theme="dark"]{
  --ground:#0a0d14; --panel:#0e121b; --rail:#141926; --line:#1e2532;
  --ink:#eaf0f8; --muted:#8b95a7; --faint:#5b6577;
  --accent:#5b9bff; --accent-soft:#1b3050; --allow:#3ddc84; --deny:#ff6b53;
}
:root[data-theme="light"]{
  --ground:#eef1f6; --panel:#ffffff; --rail:#f5f7fb; --line:#dfe4ec;
  --ink:#111726; --muted:#5b6472; --faint:#93a0b3;
  --accent:#1f6feb; --accent-soft:#dbe7ff; --allow:#128a4c; --deny:#c1361f;
}
*{box-sizing:border-box;}
body{margin:0;background:var(--ground);color:var(--ink);font-family:var(--sans);
  line-height:1.5;-webkit-font-smoothing:antialiased;
  background-image:radial-gradient(1200px 600px at 50% -8%,var(--accent-soft) 0%,transparent 60%);}
.stage{max-width:760px;margin:0 auto;padding:64px 24px 96px;}
.thesis{text-align:center;margin-bottom:40px;}
.eyebrow{font-family:var(--mono);font-size:12px;letter-spacing:.34em;text-transform:uppercase;
  color:var(--accent);margin:0 0 18px;}
h1{font-size:clamp(30px,6vw,52px);line-height:1.05;font-weight:800;letter-spacing:-.02em;
  margin:0;text-wrap:balance;}
h1 .neg{color:var(--muted);}
.sub{max-width:46ch;margin:18px auto 0;color:var(--muted);font-size:16px;text-wrap:balance;}
.deck{display:flex;flex-direction:column;align-items:center;gap:22px;margin-top:8px;}
.device{width:100%;max-width:420px;display:grid;}
.device .panel{grid-area:1/1;}
.panel[hidden]{display:none;}
.tray{display:inline-flex;align-items:center;gap:10px;border:1px solid var(--line);
  background:var(--panel);color:var(--ink);border-radius:999px;padding:9px 16px;font-size:13px;
  font-family:var(--sans);cursor:pointer;box-shadow:0 10px 30px -16px rgba(0,0,0,.6);}
.tray .dot{width:9px;height:9px;border-radius:50%;background:var(--allow);}
.tray .hint{color:var(--faint);font-family:var(--mono);font-size:11px;}
.tray[hidden]{display:none;}
.caption{min-height:2.6em;max-width:44ch;text-align:center;color:var(--muted);font-size:14.5px;
  margin:2px 0 0;text-wrap:balance;transition:color .2s ease;}
.caption b{color:var(--ink);font-weight:650;}
.caption.deny b{color:var(--deny);} .caption.allow b{color:var(--allow);}
.prompt{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:10px;margin-top:4px;}
.prompt .you{font-family:var(--mono);font-size:12px;color:var(--faint);letter-spacing:.04em;}
.task{font-family:var(--mono);font-size:13px;color:var(--ink);background:var(--rail);
  border:1px solid var(--line);border-radius:10px;padding:9px 13px;cursor:pointer;
  transition:border-color .15s ease,transform .06s ease;}
.task:hover{border-color:var(--accent);}
.task:active{transform:translateY(1px);}
.task:focus-visible,.tray:focus-visible{outline:2px solid var(--accent);outline-offset:2px;}
.behind{margin-top:72px;border-top:1px solid var(--line);padding-top:28px;}
.behind-label{font-family:var(--mono);font-size:11px;letter-spacing:.28em;text-transform:uppercase;
  color:var(--faint);margin:0 0 18px;text-align:center;}
.machinery{list-style:none;margin:0 auto;padding:0;max-width:520px;display:grid;gap:1px;
  background:var(--line);border:1px solid var(--line);border-radius:12px;overflow:hidden;}
.machinery li{display:flex;justify-content:space-between;align-items:baseline;gap:16px;
  background:var(--panel);padding:12px 16px;font-family:var(--mono);font-size:13px;color:var(--muted);}
.machinery li b{color:var(--ink);font-weight:600;}
.machinery li span{color:var(--faint);font-size:11.5px;text-align:right;}
.behind-note{text-align:center;color:var(--faint);font-size:13px;margin:20px auto 0;max-width:40ch;}
@media (prefers-reduced-motion:no-preference){
  .panel{animation:rise .28s ease;}
  @keyframes rise{from{opacity:0;transform:translateY(6px) scale(.99);}to{opacity:1;transform:none;}}
}
`.trim();

const PAGE_JS = `
const meta = ${TASK_META};
const device = document.getElementById("device");
const tray = document.getElementById("tray");
const caption = document.getElementById("caption");
const panels = new Map([...device.querySelectorAll(".panel")].map(p => [p.dataset.key, p]));
const lawDenied = new Set();
let currentTask = null;

function show(key){
  for (const [k,p] of panels) p.hidden = (k !== key);
}
function say(text, tone){
  caption.className = "caption" + (tone ? " " + tone : "");
  caption.innerHTML = text;
}
function phrase(id){ return meta[id].phrase; }

// You, telling the agent to act.
for (const btn of document.querySelectorAll(".task")){
  btn.addEventListener("click", () => {
    const id = btn.dataset.task;
    currentTask = id;
    if (lawDenied.has(id)){
      show("v:"+id+":deny:law");
      say("Standing law already denies this. The agent wasn't even asked.", "deny");
      return;
    }
    show("pending:"+id);
    say("The agent tried to <b>" + phrase(id) + "</b>. Your call — it can't decide this itself.");
  });
}

// Allow / Deny inside whichever box is showing.
device.addEventListener("click", (e) => {
  const verdictBtn = e.target.closest(".bx-btn");
  if (verdictBtn && currentTask){
    const id = currentTask;
    const asLaw = !!device.querySelector(".panel:not([hidden]) input[data-role='law']:checked");
    if (verdictBtn.dataset.verdict === "deny"){
      if (asLaw){
        lawDenied.add(id);
        show("v:"+id+":deny:law");
        say("You told the agent to <b>" + phrase(id) + "</b>. It couldn't. " + meta[id].survived +
            " And it's law now — it'll never be asked again.", "deny");
      } else {
        show("v:"+id+":deny:once");
        say("You told the agent to <b>" + phrase(id) + "</b>. It couldn't. " + meta[id].survived, "deny");
      }
    } else {
      show("v:"+id+":allow:once");
      say("Allowed — the agent proceeded. Because <b>you</b> said so, not because it decided.", "allow");
    }
    return;
  }
  // Yellow traffic-light dot = minimize, like any window.
  const dot = e.target.closest(".bx-dots i:nth-child(2)");
  if (dot){ minimize(); }
});

function minimize(){ device.style.display = "none"; tray.hidden = false; }
function restore(){ device.style.display = ""; tray.hidden = true; }
tray.addEventListener("click", restore);
`.trim();

const BODY = `
    <div class="stage">
      <header class="thesis">
        <p class="eyebrow">Agent Buccet</p>
        <h1>Agents can propose.<br><span class="neg">They cannot authorize.</span></h1>
        <p class="sub">Everything the runtime does folds into one box. It asks. You answer. That is the whole surface.</p>
      </header>

      <main class="deck">
        <div class="device" id="device">
        ${buildPanels()}
        </div>
        <button class="tray" id="tray" hidden><span class="dot"></span> Agent Buccet · armed <span class="hint">restore</span></button>

        <p class="caption" id="caption">The box is open. Tell the agent to do something — watch what it can't do. <span style="opacity:.6">(tap the yellow dot to minimize)</span></p>

        <div class="prompt">
          <span class="you">you&nbsp;→</span>
          ${TASKS.map((t) => `<button class="task" data-task="${t.id}">${t.you}</button>`).join("\n          ")}
        </div>
      </main>

      <section class="behind">
        <p class="behind-label">behind this one box</p>
        <ul class="machinery">
          ${MACHINERY.map(([name, note]) => `<li><b>${name}</b><span>${note}</span></li>`).join("\n          ")}
        </ul>
        <p class="behind-note">You never open any of it. Minimize the box and forget it is there.</p>
      </section>
    </div>`;

const INNER = `<style>\n${BOX_STYLE}\n${PAGE_CSS}\n</style>\n${BODY}\n<script>\n${PAGE_JS}\n</script>`;

// The standalone repo file wraps the same INNER fragment in a minimal page. The
// Artifact host wraps INNER identically, so both render the box the same way.
const STANDALONE = [
  "<!doctype html>",
  '<html lang="en"><head><meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width,initial-scale=1">',
  "<title>Agent Buccet — the box</title>",
  "</head><body>",
  INNER,
  "</body></html>",
].join("\n");

async function main() {
  const outArg = process.argv[2];
  const assetPath = path.join(repoRoot, "docs", "assets", "agent-buccet-box.html");
  await fs.mkdir(path.dirname(assetPath), { recursive: true });
  await fs.writeFile(assetPath, `${STANDALONE}\n`, "utf8");
  if (outArg) {
    // The Artifact host supplies <head>; carry the title at the top of the body.
    await fs.writeFile(
      path.resolve(outArg),
      `<title>Agent Buccet — the box</title>\n${INNER}\n`,
      "utf8",
    );
  }
  console.log(`wrote ${path.relative(repoRoot, assetPath)}`);
  if (outArg) console.log(`wrote ${outArg} (body fragment)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
