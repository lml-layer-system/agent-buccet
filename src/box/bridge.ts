/**
 * Local desktop-box bridge. Transport only: the Buccet runtime still owns
 * law, approval validation, execution, and proof. Never trust an approval
 * message from an agent as authority.
 *
 * The desktop process writes an unpredictable capability to a user-private
 * file. This is a same-user convenience boundary, NOT protection against a
 * malicious process with access to the operator's home directory.
 */
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { BoundaryApprovalChoice } from "../runtime/types.ts";

export type BuccetBoxMode = "interactive" | "autonomous";
export type BuccetBoxChoice = BoundaryApprovalChoice;

type BridgeSettings = { version: 1; origin: string; token: string };
export type BuccetBoxBridge = {
  requestApproval(input: {
    requestId: string;
    sessionId: string;
    actorId: string;
    actionKind: string;
    target: string;
    reason: string;
    lawIds: string[];
    payloadSummary?: string;
    question?: string;
  }): Promise<{ mode: BuccetBoxMode; choice?: BuccetBoxChoice }>;
  record(input: {
    requestId: string;
    actorId: string;
    actionKind: string;
    target: string;
    decision: "allow" | "deny" | "require_approval";
    reason: string;
  }): Promise<void>;
};

export function boxBridgeSettingsPath(): string {
  return process.env.BUCCET_BOX_BRIDGE_FILE?.trim() ??
    path.join(process.env.AGENT_BUCCET_HOME?.trim() ?? path.join(os.homedir(), ".buccet"), "box", "bridge.json");
}

function isLoopbackOrigin(origin: string): boolean {
  try {
    const u = new URL(origin);
    return u.protocol === "http:" && u.hostname === "127.0.0.1" && u.username === "" &&
      u.password === "" && u.pathname === "/" && !u.search && !u.hash && !!u.port;
  } catch {
    return false;
  }
}

export async function loadBuccetBoxBridge(): Promise<BuccetBoxBridge | null> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await fs.readFile(boxBridgeSettingsPath(), "utf8"));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const settings = parsed as Partial<BridgeSettings>;
  if (settings.version !== 1 || typeof settings.origin !== "string" ||
      !isLoopbackOrigin(settings.origin) || typeof settings.token !== "string" ||
      !/^[a-f0-9]{64}$/.test(settings.token)) {
    // If the config is present but invalid, fail closed. Do not treat it as
    // "no box" and silently restore less interactive behavior.
    throw new Error("Invalid Buccet Box bridge configuration");
  }

  async function call(route: string, payload: object, timeoutMs: number): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(new URL(route, settings.origin), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${settings.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Box bridge returned HTTP ${response.status}`);
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }
  const choices: readonly BuccetBoxChoice[] = ["allow_once", "deny_once", "allow_as_law", "deny_as_law"];
  return {
    async requestApproval(input) {
      try {
        const result = await call("/v1/approval", input, 5 * 60_000 + 5_000) as
          { mode?: unknown; choice?: unknown };
        if (result?.mode === "autonomous") return { mode: "autonomous" };
        if (result?.mode === "interactive" &&
            typeof result.choice === "string" &&
            choices.includes(result.choice as BuccetBoxChoice)) {
          return { mode: "interactive", choice: result.choice as BuccetBoxChoice };
        }
      } catch {
        // Box closed, timed out, or lost connection. An unresolved action may
        // never execute by default.
      }
      return { mode: "interactive", choice: "deny_once" };
    },
    async record(input) {
      try { await call("/v1/event", input, 4_000); } catch {
        // Notifications are best-effort; a broken UI never weakens enforcement.
      }
    },
  };
}
