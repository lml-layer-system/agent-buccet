/**
 * Agent Buccet integration for the Model Context Protocol (MCP).
 *
 * Wraps MCP tool calls through the full boundary enforcement chain
 * (intercept → gravity → bodyguard → law evaluation) before execution.
 *
 * MCP is only a transport/adapter layer. It does not change Buccet logic,
 * duplicate Buccet logic, weaken Buccet logic, or create a parallel approval
 * path. Every tool call from an MCP host enters through the same
 * BoundaryToolEnvelope / enforceBoundaryProposal path as any other integration.
 *
 * MCP-origin calls are recorded in the ledger with provenance "mcp_host".
 *
 * Usage:
 *
 * ```ts
 * import {
 *   startPersistentBoundarySession,
 *   openBoundaryPath,
 * } from "agent-buccet";
 * import { createMcpBoundaryGuard } from "agent-buccet/integrations";
 *
 * const config = await startPersistentBoundarySession({ sessionId, actorId });
 *
 * const guard = createMcpBoundaryGuard(config, {
 *   read_file: {
 *     actionClass: "file",
 *     operation: "read",
 *     describeTarget: (input) => (input as { path: string }).path,
 *   },
 *   run_command: {
 *     actionClass: "shell",
 *     operation: "exec",
 *     describeTarget: (input) => (input as { command: string }).command,
 *   },
 * });
 *
 * // In your MCP tools/call handler:
 * const result = await guard.evaluate(toolName, toolInput);
 * if (result.decision !== "allow") {
 *   return { content: [{ type: "text", text: result.reason }], isError: true };
 * }
 * // Execute the tool
 * ```
 */

import { enableBodyguardControl } from "./../boundaries/bodyguard.ts";
import {
  createBoundaryFunnelInterceptRequest,
  evaluateBoundaryIntercept,
} from "./../runtime/intercept.ts";
import type {
  BoundaryInterceptActionClass,
  BoundaryInterceptRequest,
  BoundaryInterceptResult,
} from "./../runtime/intercept.ts";
import type {
  BoundaryRequestProvenance,
  BoundaryReviewContext,
  BoundaryRuntimeConfig,
} from "./../runtime/types.ts";

export type BoundaryMcpToolMapping = {
  /** The boundary action class for this tool (file, shell, network, database, system, communication). */
  actionClass: BoundaryInterceptActionClass;
  /** The operation within that class (e.g. "read", "write", "exec"). */
  operation: string;
  /** Extract the target identifier from the tool input (path, URL, command, etc.). */
  describeTarget: (toolInput: unknown) => string;
  /** Optional: extract a human-readable payload summary for the ledger. */
  describePayload?: (toolInput: unknown) => string | undefined;
  /** Optional: provide rich review context (surface, title, question, evidence) for the approval prompt. */
  reviewContext?: (toolInput: unknown) => BoundaryReviewContext | undefined;
  /** Override the provenance for this tool. Defaults to "mcp_host". */
  provenance?: BoundaryRequestProvenance;
};

/**
 * Registry mapping MCP tool names to boundary action class mappings.
 * Provide one entry per tool exposed by the MCP server.
 */
export type BoundaryMcpToolRegistry = Record<string, BoundaryMcpToolMapping>;

export function mapMcpToolCallToInterceptRequest(args: {
  toolName: string;
  toolInput: unknown;
  mapping: BoundaryMcpToolMapping;
  provenance?: BoundaryRequestProvenance;
}): BoundaryInterceptRequest {
  return createBoundaryFunnelInterceptRequest({
    source: "framework",
    rawAction: args.toolName,
    actionClass: args.mapping.actionClass,
    operation: args.mapping.operation,
    target: args.mapping.describeTarget(args.toolInput),
    payloadSummary: args.mapping.describePayload?.(args.toolInput),
    reviewContext: args.mapping.reviewContext?.(args.toolInput),
    provenance: args.provenance ?? args.mapping.provenance ?? "mcp_host",
    extra: "adapter=mcp",
  });
}

/**
 * Evaluates a single MCP tool call through the full boundary chain.
 * Returns the intercept result — caller decides how to handle deny/require_approval.
 *
 * Returns a deny result with lawId "BOUNDARY.TOOL.UNMAPPED" if the tool name
 * is not in the registry (unknown tools are denied by default).
 */
export async function guardMcpToolCall(args: {
  config: BoundaryRuntimeConfig;
  toolName: string;
  toolInput: unknown;
  registry: BoundaryMcpToolRegistry;
  provenance?: BoundaryRequestProvenance;
}): Promise<BoundaryInterceptResult> {
  const mapping = args.registry[args.toolName];

  if (!mapping) {
    return {
      decision: "deny",
      reason: `Tool "${args.toolName}" is not registered in the boundary tool registry. Unknown tools are denied.`,
      lawIds: ["BOUNDARY.TOOL.UNMAPPED"],
      bodyguardMoves: [],
      requestId: `unmapped:${args.toolName}:${Date.now()}`,
      actionKind: "tool.exec",
    };
  }

  return evaluateBoundaryIntercept({
    config: enableBodyguardControl(args.config),
    request: mapMcpToolCallToInterceptRequest({
      toolName: args.toolName,
      toolInput: args.toolInput,
      mapping,
      provenance: args.provenance,
    }),
  });
}

/**
 * Creates a bound guard for use in an MCP tools/call handler.
 * Captures the config and registry so you don't repeat them on every call.
 */
export function createMcpBoundaryGuard(
  config: BoundaryRuntimeConfig,
  registry: BoundaryMcpToolRegistry,
) {
  return {
    /**
     * Evaluate an MCP tool call before execution.
     * Pass the tool name and parsed input from the MCP tools/call request.
     */
    evaluate: (
      toolName: string,
      toolInput: unknown,
      provenance?: BoundaryRequestProvenance,
    ): Promise<BoundaryInterceptResult> =>
      guardMcpToolCall({ config, toolName, toolInput, registry, provenance }),
  };
}
