/**
 * Agent Buccet error hierarchy.
 *
 * All errors thrown by the boundary runtime extend `BoundaryError`, so callers
 * can catch the base class to handle any runtime failure:
 *
 * ```typescript
 * try {
 *   await runBoundaryWrappedCommand(args);
 * } catch (err) {
 *   if (err instanceof BoundaryProcessError) {
 *     // command was blocked by policy
 *   } else if (err instanceof BoundaryError) {
 *     // some other boundary runtime failure
 *   }
 * }
 * ```
 */

/**
 * Base class for all Agent Buccet runtime errors.
 * Every typed error in this hierarchy extends this class.
 *
 * @param code - Machine-readable error code (e.g. `"LEDGER_LOCK_TIMEOUT"`)
 * @param message - Human-readable error description
 */
export class BoundaryError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "BoundaryError";
    // Ensure instanceof checks work correctly across compiled output
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when a ledger operation fails — lock timeout, I/O failure, or
 * chain integrity error.
 *
 * Common codes:
 * - `"LEDGER_LOCK_TIMEOUT"` — could not acquire ledger lock within the deadline
 * - `"LEDGER_IO"` — filesystem read or write failure
 * - `"LEDGER_CHAIN_BROKEN"` — hash chain integrity check failed
 */
export class BoundaryLedgerError extends BoundaryError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = "BoundaryLedgerError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when policy loading or validation fails.
 *
 * Common codes:
 * - `"POLICY_PARSE"` — JSON parse error in policy file
 * - `"POLICY_INVALID"` — policy schema validation failed
 * - `"POLICY_NOT_FOUND"` — policy file does not exist at the specified path
 */
export class BoundaryPolicyError extends BoundaryError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = "BoundaryPolicyError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when a session operation fails — corrupted state, schema mismatch,
 * or missing required session data.
 *
 * Common codes:
 * - `"SESSION_CORRUPTED"` — session state file is unreadable or schema-invalid
 * - `"SESSION_NOT_FOUND"` — session cannot be restored from state or ledger
 */
export class BoundarySessionError extends BoundaryError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = "BoundarySessionError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when an approval request is not resolved within the configured
 * `approvalTimeoutMs` and `approvalTimeoutBehavior` is `"throw"`.
 *
 * Code: `"APPROVAL_TIMEOUT"`
 */
export class BoundaryApprovalTimeoutError extends BoundaryError {
  constructor(message: string) {
    super("APPROVAL_TIMEOUT", message);
    this.name = "BoundaryApprovalTimeoutError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when a process is blocked by the wrapper process policy — command
 * blocked, working directory out of scope, or environment validation failure.
 *
 * Common codes:
 * - `"PROCESS_COMMAND_BLOCKED"` — command is not in the allowed list
 * - `"PROCESS_CWD_OUT_OF_SCOPE"` — requested working directory is outside opened scope
 * - `"PROCESS_ENV_INVALID"` — environment variable validation failed
 */
export class BoundaryProcessError extends BoundaryError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = "BoundaryProcessError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
