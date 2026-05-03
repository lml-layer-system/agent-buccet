import { evaluateBoundaryUplTraffic } from "./../law/upl-traffic.ts";
import type {
  BoundaryApprovalDecision,
  BoundaryApprovalHandler,
  BoundaryApprovalRequest,
  BoundaryRuntimeConfig,
  BoundaryUserPathLedger,
} from "./../runtime/types.ts";

/**
 * Headless approval policy — replaces the human in the chair for automated pipelines.
 *
 * Most agent deployments are fully automated: no human at Terminal 2, no one to
 * approve or deny frozen proposals. Without a headless policy, `require_approval`
 * results hang indefinitely.
 *
 * Pick the mode that matches your risk tolerance:
 *
 *   deny_all            — Maximum safety. Every approval request is auto-denied.
 *                         Good for read-only agents or when you want to discover
 *                         what would have needed approval before enabling it.
 *
 *   allow_if_law_clear  — Deny when a hard invariant law tripped (safety law).
 *                         Allow when this is purely a scope expansion request
 *                         (no invariant law, just outside current grants).
 *                         Good for agents that need to navigate their scope
 *                         but should not override safety laws.
 *
 *   follow_upl          — Apply existing UPL standing law decisions automatically.
 *                         If the user previously recorded allow_as_law or deny_as_law
 *                         for this action+target, re-apply it without prompting.
 *                         Deny if no standing law matches (fail-safe).
 *                         Good for agents running in scheduled/batch mode after
 *                         an initial interactive session where laws were recorded.
 *
 *   allow_all           — Allow every approval request. ONLY for dev/test.
 *                         Never use in production — this removes all approval-gating.
 */
export type BoundaryHeadlessPolicy =
  | { mode: "deny_all" }
  | { mode: "allow_if_law_clear" }
  | { mode: "follow_upl"; getLedger: () => Promise<BoundaryUserPathLedger> }
  | { mode: "allow_all" };

/**
 * Creates a BoundaryApprovalHandler that resolves approval requests automatically
 * according to the given policy. Plug it in wherever BoundaryApprovalHandler is
 * accepted — no other changes required.
 *
 * Example:
 *
 *   const store = createBoundaryRuntimeStore({
 *     ...config,
 *     approvalHandler: createBoundaryHeadlessApprovalHandler({ mode: "deny_all" }),
 *   });
 */
export function createBoundaryHeadlessApprovalHandler(
  policy: BoundaryHeadlessPolicy,
): BoundaryApprovalHandler {
  return async (approval: BoundaryApprovalRequest): Promise<BoundaryApprovalDecision> => {
    switch (policy.mode) {
      case "deny_all":
        return {
          choice: "deny_once",
          notes: "headless:deny_all",
        };

      case "allow_all":
        return {
          choice: "allow_once",
          notes: "headless:allow_all",
        };

      case "allow_if_law_clear": {
        // BOUNDARY.* law IDs are base safety laws (fs.write, delete, network, exec, db, sys, comm).
        // These fire when an action needs human confirmation for safety reasons.
        // A headless agent should not auto-approve them — deny to stay safe.
        //
        // SCOPE.* law IDs (e.g. SCOPE.GRANT.CLOSED) are scope expansion gates —
        // the action is structurally legal but the target is outside current grants.
        // A headless agent can safely allow these to expand scope as the agent operates.
        //
        // Only pure scope-expansion prompts are auto-allowed here.
        // Track-wall collisions and other non-scope approval reasons must deny.
        const scopeOnly =
          approval.lawIds.length > 0 && approval.lawIds.every((id) => id.startsWith("SCOPE."));
        if (!scopeOnly) {
          return {
            choice: "deny_once",
            notes: "headless:allow_if_law_clear — non-scope approval required",
          };
        }
        return {
          choice: "allow_once",
          notes: "headless:allow_if_law_clear",
        };
      }

      case "follow_upl": {
        let ledger: BoundaryUserPathLedger;
        try {
          ledger = await policy.getLedger();
        } catch {
          // Cannot load UPL ledger — fail safe: deny
          return {
            choice: "deny_once",
            notes: "headless:follow_upl — ledger unavailable",
          };
        }
        const config: BoundaryRuntimeConfig = {
          session: approval.session,
          laws: [],
          grants: [],
          pathLaws: [],
          approvalRequiredFor: [],
          userLawIds: [],
          upl: ledger,
          persistence: {
            enabled: false,
          },
        };
        const traffic = evaluateBoundaryUplTraffic({
          config,
          request: approval.request,
        });
        if (traffic.decision === "allow" && traffic.entry) {
          return {
            choice: "allow_once",
            notes: `headless:follow_upl — traffic rail: ${traffic.entry.id}`,
          };
        }
        if (traffic.entry) {
          return {
            choice: "deny_once",
            notes: `headless:follow_upl — traffic ${traffic.decision}: ${traffic.entry.id}`,
          };
        }
        return {
          choice: "deny_once",
          notes: "headless:follow_upl — no traffic match",
        };
      }
    }
  };
}
