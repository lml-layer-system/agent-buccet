/**
 * The Box — the single compressed surface of Agent Buccet.
 *
 * Everything the runtime does — file, env, shell, network, delete, chat, spend
 * interception across the MCP path and the native hook path — folds down to one
 * human moment: the agent proposes an action, and the box asks the human one
 * question. Allow or deny. That is all the operator ever has to see.
 *
 * This module is the one source of truth for that moment. It reduces a live
 * intercept/swarm status into a minimal {@link BoxState} and renders that exact
 * same state two ways:
 *
 *   - {@link renderBoxText} for the terminal (`buccet box`)
 *   - {@link renderBoxComponent} / {@link renderBoxStandaloneHtml} for the
 *     visual box (the window you open, minimize, and forget)
 *
 * The visual is bound to the box because both come from this reducer and these
 * renderers. What you see in the window is what the command decided — same
 * words, same choices, same law.
 *
 * Pure and dependency-free so it can be unit-tested and reused by the CLI, the
 * `--render` snapshot, and the shareable visual without drift.
 */

// ─── Model ───────────────────────────────────────────────────────────────────

/** The four verdicts the box ever asks for. Simple by design. */
export type BoxChoiceKind = "allow_once" | "allow_law" | "deny_once" | "deny_law";

export interface BoxChoice {
  /** Single-key shortcut in the terminal box. */
  readonly key: string;
  readonly kind: BoxChoiceKind;
  /** What the human sees: "yes" / "always" / "no" / "never". */
  readonly label: string;
  /** One-line meaning: "allow once" / "allow as law" / … */
  readonly hint: string;
  /** Does the agent get to proceed. */
  readonly allow: boolean;
  /** Does this verdict become standing law (asked once, never again). */
  readonly asLaw: boolean;
}

/** The fixed four choices, in box order. */
export const BOX_CHOICES: readonly BoxChoice[] = [
  { key: "1", kind: "allow_once", label: "yes", hint: "allow once", allow: true, asLaw: false },
  { key: "2", kind: "allow_law", label: "always", hint: "allow as law", allow: true, asLaw: true },
  { key: "3", kind: "deny_once", label: "no", hint: "deny once", allow: false, asLaw: false },
  { key: "4", kind: "deny_law", label: "never", hint: "deny as law", allow: false, asLaw: true },
];

/** A single thing the agent wants to do, reduced to the one line a human reads. */
export interface BoxProposal {
  readonly groupId: string;
  /** Who is asking. Almost always "the agent". */
  readonly actor: string;
  /** Plain verb: "run", "read", "write to", "delete", "send data to". */
  readonly verb: string;
  /** What the verb acts on: "curl example.com", ".env", "README.md". */
  readonly target: string;
  /** Short class tag for context: "shell command", "file", "network", "secret". */
  readonly kindLabel: string;
  /** One extra line of why, if the runtime gave one. */
  readonly detail?: string;
  /** How many identical requests are folded into this one question. */
  readonly waiting: number;
  readonly surface: "action" | "chat";
}

/** The most recent verdict, shown for a beat so the human sees it landed. */
export interface BoxVerdict {
  readonly verb: string;
  readonly target: string;
  readonly allow: boolean;
  readonly asLaw: boolean;
}

/** The complete state the box paints, terminal or visual. */
export interface BoxState {
  /** Are the hooks armed and the intercept surface reachable. */
  readonly connected: boolean;
  /** Short shield summary, e.g. "strong · armed". */
  readonly shield: string;
  /** The one proposal in focus. `null` when nothing is waiting (idle). */
  readonly pending: BoxProposal | null;
  /** How many more proposals are queued behind the focused one. */
  readonly queued: number;
  /** Last landed verdict, shown while idle. */
  readonly lastVerdict?: BoxVerdict | null;
}

/**
 * Structural shape of one swarm-status group, as the intercept server reports
 * it. Kept as a loose subset so this module never has to import runtime types.
 */
export interface BoxGroupInput {
  groupId: string;
  state?: string;
  waitingCount?: number;
  actionClass?: string;
  operation?: string;
  target?: string;
  reason?: string;
  payloadSummary?: string;
  reviewContext?: {
    surface?: "action" | "chat";
    title?: string;
    question?: string;
    actorLabel?: string;
    userInput?: string;
    attemptedOutput?: string;
  };
}

// ─── Reduce ──────────────────────────────────────────────────────────────────

/** Trim a value to one readable line, adding an ellipsis when it is too long. */
function shorten(value: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, Math.max(0, max - 1))}…`;
}

/** Collapse a runtime reason/question into a single tidy detail line. */
function cleanDetail(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const collapsed = raw.replace(/\s+/g, " ").trim();
  return collapsed ? shorten(collapsed, 72) : undefined;
}

interface Phrasing {
  readonly verb: string;
  readonly kindLabel: string;
}

/**
 * Turn a machine action class into a plain verb a person can answer to. The
 * point of the box is that no one has to know what "sys.env.read" means.
 */
function phraseAction(actionClass: string, operation: string): Phrasing {
  const key = `${actionClass}.${operation}`.toLowerCase();
  const cls = actionClass.toLowerCase();
  const op = operation.toLowerCase();

  const table: Record<string, Phrasing> = {
    "fs.read": { verb: "read", kindLabel: "file" },
    "fs.write": { verb: "write to", kindLabel: "file" },
    "fs.delete": { verb: "delete", kindLabel: "file" },
    "fs.move": { verb: "move", kindLabel: "file" },
    "net.send": { verb: "send data to", kindLabel: "network" },
    "network.send": { verb: "send data to", kindLabel: "network" },
    "sys.env.read": { verb: "read the secret", kindLabel: "secret" },
    "env.read": { verb: "read the secret", kindLabel: "secret" },
    "tool.exec": { verb: "run", kindLabel: "shell command" },
    "proc.exec": { verb: "run", kindLabel: "shell command" },
    "process.exec": { verb: "run", kindLabel: "shell command" },
    "comm.send": { verb: "message", kindLabel: "chat" },
    "chat.send": { verb: "message", kindLabel: "chat" },
    "spend.commit": { verb: "spend", kindLabel: "money" },
  };

  if (table[key]) return table[key];

  // Fall back on the class, then the operation, then the raw pair.
  const byClass: Record<string, Phrasing> = {
    fs: { verb: op || "touch", kindLabel: "file" },
    net: { verb: "send data to", kindLabel: "network" },
    network: { verb: "send data to", kindLabel: "network" },
    sys: { verb: "read the secret", kindLabel: "secret" },
    env: { verb: "read the secret", kindLabel: "secret" },
    tool: { verb: "run", kindLabel: "shell command" },
    proc: { verb: "run", kindLabel: "shell command" },
    process: { verb: "run", kindLabel: "shell command" },
    comm: { verb: "message", kindLabel: "chat" },
    chat: { verb: "message", kindLabel: "chat" },
    spend: { verb: "spend", kindLabel: "money" },
  };
  if (byClass[cls]) return byClass[cls];
  return { verb: op || key, kindLabel: actionClass || "action" };
}

/** Reduce one raw swarm group into the single line the box shows. */
export function reduceGroupToBox(group: BoxGroupInput): BoxProposal {
  const actionClass = group.actionClass ?? "action";
  const operation = group.operation ?? "";
  const surface = group.reviewContext?.surface ?? "action";

  if (surface === "chat") {
    // A chat/output moment: the agent wants to say something that tripped law.
    const said = group.reviewContext?.attemptedOutput ?? group.target ?? "a message";
    return {
      groupId: group.groupId,
      actor: group.reviewContext?.actorLabel ?? "the agent",
      verb: "send the message",
      target: shorten(said, 60),
      kindLabel: "chat",
      detail: cleanDetail(group.reviewContext?.question ?? group.reason),
      waiting: Math.max(1, group.waitingCount ?? 1),
      surface,
    };
  }

  const { verb, kindLabel } = phraseAction(actionClass, operation);
  return {
    groupId: group.groupId,
    actor: group.reviewContext?.actorLabel ?? "the agent",
    verb,
    target: shorten(group.target ?? "", 60) || "(unspecified)",
    kindLabel,
    detail: cleanDetail(group.reason),
    waiting: Math.max(1, group.waitingCount ?? 1),
    surface,
  };
}

/** Which groups are actually waiting on a human. */
export function selectWaitingGroups(groups: readonly BoxGroupInput[]): BoxGroupInput[] {
  return groups.filter((g) => g.state === "waiting" || (g.waitingCount ?? 0) > 0);
}

/** Reduce a whole live status snapshot into the box's single-focus state. */
export function reduceStatusToBox(args: {
  groups: readonly BoxGroupInput[];
  connected: boolean;
  shield: string;
  lastVerdict?: BoxVerdict | null;
}): BoxState {
  const waiting = selectWaitingGroups(args.groups);
  const focus = waiting[0] ?? null;
  return {
    connected: args.connected,
    shield: args.shield,
    pending: focus ? reduceGroupToBox(focus) : null,
    queued: Math.max(0, waiting.length - 1),
    lastVerdict: args.lastVerdict ?? null,
  };
}

/** Map a keypress or typed token to a verdict, or `null` if it is not one. */
export function choiceFromKey(raw: string): BoxChoice | null {
  const token = raw.trim().toLowerCase();
  if (!token) return null;
  const byKey = BOX_CHOICES.find((c) => c.key === token);
  if (byKey) return byKey;
  const aliases: Record<string, BoxChoiceKind> = {
    y: "allow_once",
    yes: "allow_once",
    allow: "allow_once",
    a: "allow_law",
    always: "allow_law",
    law: "allow_law",
    n: "deny_once",
    no: "deny_once",
    deny: "deny_once",
    never: "deny_law",
  };
  const kind = aliases[token];
  return kind ? (BOX_CHOICES.find((c) => c.kind === kind) ?? null) : null;
}

// ─── Terminal renderer ───────────────────────────────────────────────────────

export interface BoxPalette {
  reset: string;
  bold: string;
  dim: string;
  green: string;
  red: string;
  cyan: string;
}

const NO_COLOR: BoxPalette = { reset: "", bold: "", dim: "", green: "", red: "", cyan: "" };
// biome-ignore lint/suspicious/noControlCharactersInRegex: matching real ANSI SGR escapes
const ANSI = /\x1b\[[0-9;]*m/g;

function visibleLen(s: string): number {
  return s.replace(ANSI, "").length;
}
function padVisible(s: string, width: number): string {
  const pad = Math.max(0, width - visibleLen(s));
  return s + " ".repeat(pad);
}
/**
 * Truncate to `width` visible columns, preserving ANSI escapes and never
 * cutting one in half. The hard safety net so no content — however long the
 * target or however colored — can push the box's right border.
 */
function clampVisible(s: string, width: number, reset: string): string {
  let out = "";
  let visible = 0;
  let index = 0;
  let sawColor = false;
  while (index < s.length) {
    if (s[index] === "\x1b") {
      // biome-ignore lint/suspicious/noControlCharactersInRegex: matching real ANSI SGR escapes
      const match = /^\x1b\[[0-9;]*m/.exec(s.slice(index));
      if (match) {
        out += match[0];
        index += match[0].length;
        sawColor = true;
        continue;
      }
    }
    if (visible >= width) break;
    out += s[index];
    visible += 1;
    index += 1;
  }
  // If we cut inside a colored run, close it so color cannot bleed into padding.
  return sawColor && reset ? `${out}${reset}` : out;
}

const BOX_WIDTH = 50;

/**
 * Render the box for a terminal. One box, one question, nothing else — this is
 * the whole operator surface. Colors are optional and width-safe.
 */
export function renderBoxText(state: BoxState, palette: BoxPalette = NO_COLOR): string {
  const p = palette;
  const top = `  ${p.cyan}┌${"─".repeat(BOX_WIDTH + 2)}┐${p.reset}`;
  const bot = `  ${p.cyan}└${"─".repeat(BOX_WIDTH + 2)}┘${p.reset}`;
  const row = (content: string) =>
    `  ${p.cyan}│${p.reset} ${padVisible(clampVisible(content, BOX_WIDTH, p.reset), BOX_WIDTH)} ${p.cyan}│${p.reset}`;
  const blank = row("");
  const lines: string[] = [top, blank];

  if (state.pending) {
    const pr = state.pending;
    lines.push(row(`${p.dim}${pr.actor} wants to${p.reset}`));
    // Build the plain line first, ellipsis-fit it, then color as one run so the
    // width stays exact no matter how long the target is.
    const action = shorten(`▸ ${pr.verb}  ${pr.target}`, BOX_WIDTH);
    lines.push(row(`${p.bold}${action}${p.reset}`));
    lines.push(blank);
    const contextPlain = [pr.kindLabel, pr.detail].filter(Boolean).join(" · ");
    if (contextPlain) lines.push(row(`${p.dim}${shorten(contextPlain, BOX_WIDTH)}${p.reset}`));
    if (pr.waiting > 1) lines.push(row(`${p.dim}(${pr.waiting} identical requests)${p.reset}`));
    if (state.queued > 0)
      lines.push(row(`${p.dim}+${state.queued} more waiting behind this${p.reset}`));
    lines.push(blank);
    lines.push(row(`${p.bold}allow?${p.reset}`));
    lines.push(
      row(
        `  ${p.green}1 yes${p.reset}       ${p.green}2 always${p.reset}` +
          `      ${p.dim}(allow · make it law)${p.reset}`,
      ),
    );
    lines.push(
      row(
        `  ${p.red}3 no${p.reset}        ${p.red}4 never${p.reset}` +
          `       ${p.dim}(deny · make it law)${p.reset}`,
      ),
    );
  } else {
    // Idle. The whole promise of the box: minimize it, forget it.
    const dot = state.connected ? `${p.green}●${p.reset}` : `${p.red}●${p.reset}`;
    lines.push(row(`${dot} ${p.bold}Agent Buccet${p.reset}  ${p.dim}${state.shield}${p.reset}`));
    lines.push(blank);
    if (state.lastVerdict) {
      const v = state.lastVerdict;
      const mark = v.allow ? `${p.green}✓${p.reset}` : `${p.red}✗${p.reset}`;
      const word = v.allow ? "allowed" : "denied";
      const law = v.asLaw ? " · now law" : "";
      lines.push(row(`${mark} ${p.dim}last: ${word} ${v.verb} ${v.target}${law}${p.reset}`));
    } else {
      lines.push(row(`${p.dim}nothing waiting.${p.reset}`));
    }
    lines.push(row(`${p.dim}the agent can propose. it cannot authorize.${p.reset}`));
    lines.push(row(`${p.dim}minimize it — asked only when it matters.${p.reset}`));
  }

  lines.push(blank, bot);
  return lines.join("\n");
}

// ─── Visual renderer (the box, as a window) ──────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * The stylesheet for the visual box. Self-contained, theme-aware. Exported so
 * the `--render` snapshot and the shareable visual share exactly one look.
 */
export const BOX_STYLE = `
.buccet-box{--bg:#ffffff;--fg:#0b0f19;--muted:#5b6472;--line:#e6e8ee;--chrome:#f4f5f8;
  --allow:#128a4c;--allow-bg:#e7f6ee;--deny:#c1361f;--deny-bg:#fdecea;--accent:#1f6feb;
  width:100%;max-width:420px;border:1px solid var(--line);border-radius:14px;overflow:hidden;
  background:var(--bg);color:var(--fg);box-shadow:0 18px 50px -18px rgba(9,14,26,.35);
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;}
.buccet-box *{box-sizing:border-box;}
.bx-bar{display:flex;align-items:center;gap:8px;padding:10px 14px;background:var(--chrome);
  border-bottom:1px solid var(--line);}
.bx-dots{display:flex;gap:6px;}
.bx-dots i{width:11px;height:11px;border-radius:50%;display:block;}
.bx-dots i:nth-child(1){background:#ff5f57;} .bx-dots i:nth-child(2){background:#febc2e;}
.bx-dots i:nth-child(3){background:#28c840;}
.bx-title{font-size:13px;font-weight:600;letter-spacing:.01em;}
.bx-title .pulse{color:var(--allow);} .bx-title.off .pulse{color:var(--deny);}
.bx-shield{margin-left:auto;font-size:11px;color:var(--muted);}
.bx-body{padding:22px 20px 20px;}
.bx-lead{font-size:12.5px;color:var(--muted);margin:0 0 6px;}
.bx-act{font-size:20px;font-weight:700;line-height:1.3;margin:0 0 2px;word-break:break-word;}
.bx-act .verb{color:var(--accent);}
.bx-ctx{font-size:12px;color:var(--muted);margin:10px 0 0;}
.bx-ctx .tag{display:inline-block;padding:2px 8px;border:1px solid var(--line);border-radius:999px;
  font-size:11px;margin-right:6px;color:var(--fg);}
.bx-ask{font-size:13px;font-weight:600;margin:20px 0 12px;}
.bx-btns{display:flex;gap:10px;}
.bx-btn{flex:1;border:1px solid var(--line);border-radius:10px;padding:12px 10px;font-size:14px;
  font-weight:650;cursor:pointer;background:var(--bg);color:var(--fg);transition:transform .06s ease;}
.bx-btn:active{transform:translateY(1px);}
.bx-btn.allow{color:var(--allow);border-color:var(--allow);background:var(--allow-bg);}
.bx-btn.deny{color:var(--deny);border-color:var(--deny);background:var(--deny-bg);}
.bx-law{display:flex;align-items:center;gap:8px;margin-top:14px;font-size:12px;color:var(--muted);}
.bx-law input{width:15px;height:15px;accent-color:var(--accent);}
.bx-idle{padding:26px 20px;}
.bx-idle .headline{font-size:14px;font-weight:600;margin:0 0 8px;display:flex;align-items:center;gap:8px;}
.bx-idle .pulse{width:9px;height:9px;border-radius:50%;background:var(--allow);display:inline-block;}
.bx-idle.off .pulse{background:var(--deny);}
.bx-idle p{font-size:12.5px;color:var(--muted);margin:4px 0;line-height:1.5;}
.bx-verdict{font-size:12.5px;margin-top:10px;}
.bx-verdict.ok{color:var(--allow);} .bx-verdict.no{color:var(--deny);}
@media (prefers-color-scheme:dark){.buccet-box{--bg:#12151c;--fg:#eef1f6;--muted:#98a2b3;
  --line:#252a35;--chrome:#1a1e27;--allow:#3ddc84;--allow-bg:#12281d;--deny:#ff6b53;
  --deny-bg:#2a1512;--accent:#5b9bff;}}
:root[data-theme="dark"] .buccet-box{--bg:#12151c;--fg:#eef1f6;--muted:#98a2b3;--line:#252a35;
  --chrome:#1a1e27;--allow:#3ddc84;--allow-bg:#12281d;--deny:#ff6b53;--deny-bg:#2a1512;--accent:#5b9bff;}
:root[data-theme="light"] .buccet-box{--bg:#ffffff;--fg:#0b0f19;--muted:#5b6472;--line:#e6e8ee;
  --chrome:#f4f5f8;--allow:#128a4c;--allow-bg:#e7f6ee;--deny:#c1361f;--deny-bg:#fdecea;--accent:#1f6feb;}
`.trim();

/**
 * Render the visual box for one state — the same window whether it is painted
 * live by `buccet box --render` or shown in the shareable visual. Markup only;
 * pair with {@link BOX_STYLE}.
 */
export function renderBoxComponent(state: BoxState): string {
  const connected = state.connected;
  const titleClass = connected ? "bx-title" : "bx-title off";
  const bar = [
    '<div class="bx-bar"><span class="bx-dots"><i></i><i></i><i></i></span>',
    `<span class="${titleClass}"><span class="pulse">●</span> Agent Buccet</span>`,
    `<span class="bx-shield">${esc(state.shield)}</span></div>`,
  ].join("");

  if (state.pending) {
    const pr = state.pending;
    const waiting =
      pr.waiting > 1 ? `<span class="tag">${pr.waiting} identical requests</span>` : "";
    const queued = state.queued > 0 ? `<span class="tag">+${state.queued} behind</span>` : "";
    const detail = pr.detail ? ` · ${esc(pr.detail)}` : "";
    const body = [
      '<div class="bx-body">',
      `<p class="bx-lead">${esc(pr.actor)} wants to</p>`,
      `<p class="bx-act"><span class="verb">${esc(pr.verb)}</span> ${esc(pr.target)}</p>`,
      `<p class="bx-ctx">${waiting}${queued}<span class="tag">${esc(pr.kindLabel)}</span>${detail}</p>`,
      '<p class="bx-ask">Allow this?</p>',
      '<div class="bx-btns">',
      '<button class="bx-btn allow" data-verdict="allow">Allow</button>',
      '<button class="bx-btn deny" data-verdict="deny">Deny</button>',
      "</div>",
      '<label class="bx-law"><input type="checkbox" data-role="law"> remember my choice — make it standing law</label>',
      "</div>",
    ].join("");
    return `<div class="buccet-box">${bar}${body}</div>`;
  }

  const idleClass = connected ? "bx-idle" : "bx-idle off";
  let verdict = "";
  if (state.lastVerdict) {
    const v = state.lastVerdict;
    const cls = v.allow ? "bx-verdict ok" : "bx-verdict no";
    const mark = v.allow ? "✓" : "✗";
    const word = v.allow ? "allowed" : "denied";
    const law = v.asLaw ? " · now standing law" : "";
    verdict = `<p class="${cls}">${mark} last: ${word} ${esc(v.verb)} ${esc(v.target)}${law}</p>`;
  }
  const headline = connected ? "Armed. Nothing waiting." : "Not connected.";
  const body = [
    `<div class="${idleClass}">`,
    `<p class="headline"><span class="pulse"></span> ${headline}</p>`,
    "<p>The agent can propose. It cannot authorize.</p>",
    "<p>Minimize this — you're asked only when it matters.</p>",
    verdict,
    "</div>",
  ].join("");
  return `<div class="buccet-box">${bar}${body}</div>`;
}

/**
 * A full standalone HTML page wrapping a single box state — what
 * `buccet box` mirrors to disk so the visual is a true, live snapshot of the
 * box. Opened in a browser it self-refreshes, so the window on screen tracks
 * the command: the visual is bound to the box.
 */
export function renderBoxStandaloneHtml(
  state: BoxState,
  opts: { refreshSeconds?: number } = {},
): string {
  const refresh =
    opts.refreshSeconds && opts.refreshSeconds > 0
      ? `<meta http-equiv="refresh" content="${opts.refreshSeconds}">`
      : "";
  return [
    "<!doctype html>",
    '<html lang="en"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    refresh,
    "<title>Agent Buccet</title>",
    `<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0f19;padding:24px}${BOX_STYLE}</style>`,
    "</head><body>",
    renderBoxComponent(state),
    "</body></html>",
  ].join("\n");
}
