/**
 * Agent Buccet integration for the Anthropic Claude SDK.
 *
 * Wraps Claude tool_use calls through the full boundary enforcement chain
 * (intercept → gravity → bodyguard → law evaluation) before execution.
 *
 * This module has no dependency on @anthropic-ai/sdk — it works with any
 * loop that receives Claude tool_use blocks and needs to enforce boundaries
 * before executing tool calls.
 *
 * Usage:
 *
 * ```ts
 * import {
 *   startPersistentBoundarySession,
 *   openBoundaryPath,
 * } from "agent-buccet";
 * import { createClaudeSDKBoundaryGuard } from "agent-buccet/integrations";
 *
 * const config = await startPersistentBoundarySession({ sessionId, actorId });
 * const { config: scopedConfig } = await openBoundaryPath({ config, rootPath: workspace, ... });
 *
 * const guard = createClaudeSDKBoundaryGuard(scopedConfig, {
 *   read_file: {
 *     actionClass: "file",
 *     operation: "read",
 *     describeTarget: (input) => (input as { path: string }).path,
 *   },
 *   write_file: {
 *     actionClass: "file",
 *     operation: "write",
 *     describeTarget: (input) => (input as { path: string }).path,
 *   },
 *   run_shell: {
 *     actionClass: "shell",
 *     operation: "exec",
 *     describeTarget: (input) => (input as { command: string }).command,
 *   },
 * });
 *
 * // In your Claude tool_use loop:
 * for (const block of response.content) {
 *   if (block.type === "tool_use") {
 *     const result = await guard.evaluate(block.name, block.input);
 *     if (result.decision !== "allow") {
 *       // Surface result.reason + result.nslMoves to the user
 *       // Return tool_result with the boundary decision
 *       continue;
 *     }
 *     // Execute the tool
 *   }
 * }
 * ```
 */

import { evaluateBoundaryIntercept } from "../intercept.ts";
import type { BoundaryInterceptActionClass, BoundaryInterceptResult } from "../intercept.ts";
import type { BoundaryRequestProvenance, BoundaryRuntimeConfig } from "../types.ts";

export type BoundaryClaudeToolMapping = {
  /** The boundary action class for this tool (file, shell, network, database, system, communication). */
  actionClass: BoundaryInterceptActionClass;
  /** The operation within that class (e.g. "read", "write", "exec"). */
  operation: string;
  /** Extract the target identifier from the tool input (path, URL, command, etc.). */
  describeTarget: (toolInput: unknown) => string;
  /** Optional: extract a human-readable payload summary for the ledger. */
  describePayload?: (toolInput: unknown) => string | undefined;
  /** Override the provenance for this tool. Defaults to "agent_inference". */
  provenance?: BoundaryRequestProvenance;
};

/**
 * Registry mapping Claude tool names to boundary action class mappings.
 * Provide one entry per tool defined in your Claude API call.
 */
export type BoundaryClaudeToolRegistry = Record<string, BoundaryClaudeToolMapping>;

/**
 * Evaluates a single Claude tool_use block through the full boundary chain.
 * Returns the intercept result — caller decides how to handle deny/require_approval.
 *
 * Returns a deny result with lawId "BOUNDARY.TOOL.UNMAPPED" if the tool name
 * is not in the registry (unknown tools are denied by default).
 */
export async function guardClaudeToolUse(args: {
  config: BoundaryRuntimeConfig;
  toolName: string;
  toolInput: unknown;
  registry: BoundaryClaudeToolRegistry;
  provenance?: BoundaryRequestProvenance;
}): Promise<BoundaryInterceptResult> {
  const mapping = args.registry[args.toolName];

  if (!mapping) {
    return {
      decision: "deny",
      reason: `Tool "${args.toolName}" is not registered in the boundary tool registry. Unknown tools are denied.`,
      lawIds: ["BOUNDARY.TOOL.UNMAPPED"],
      nslMoves: [],
      requestId: `unmapped:${args.toolName}:${Date.now()}`,
      actionKind: "tool.exec",
    };
  }

  return evaluateBoundaryIntercept({
    config: args.config,
    request: {
      actionClass: mapping.actionClass,
      operation: mapping.operation,
      target: mapping.describeTarget(args.toolInput),
      payloadSummary: mapping.describePayload?.(args.toolInput),
      provenance: args.provenance ?? mapping.provenance ?? "agent_inference",
    },
  });
}

/**
 * Creates a bound guard for use in a Claude tool_use loop.
 * Captures the config and registry so you don't repeat them on every call.
 */
export function createClaudeSDKBoundaryGuard(
  config: BoundaryRuntimeConfig,
  registry: BoundaryClaudeToolRegistry,
) {
  return {
    /**
     * Evaluate a Claude tool_use block before execution.
     * Pass block.name and block.input from the Claude API response.
     */
    evaluate: (
      toolName: string,
      toolInput: unknown,
      provenance?: BoundaryRequestProvenance,
    ): Promise<BoundaryInterceptResult> =>
      guardClaudeToolUse({ config, toolName, toolInput, registry, provenance }),
  };
}
