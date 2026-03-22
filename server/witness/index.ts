#!/usr/bin/env bun
/**
 * Agent Buccet — Witness Server
 *
 * Receives signed ledger checkpoints from Agent Buccet installations,
 * appends them to an append-only JSONL log, and returns HTTP 200.
 *
 * The checkpoint is already cryptographically signed by the client (ed25519).
 * The server's job is to be an independent, always-on append-only store that
 * the local process cannot suppress — making it impossible for a compromised
 * runtime to erase its own audit trail.
 *
 * Routes:
 *   POST /checkpoint   — receive and store a BoundaryLedgerCheckpoint
 *   GET  /health       — liveness probe
 *
 * Configuration (environment variables):
 *   PORT                  — TCP port to listen on (default: 3000)
 *   WITNESS_LOG_PATH      — path to append-only JSONL log (default: ./data/checkpoints.jsonl)
 *   WITNESS_ALLOWED_ORIGINS — comma-separated list of allowed CORS origins (default: *)
 */

import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const PORT = Number(process.env.PORT ?? 3000);
const LOG_PATH = process.env.WITNESS_LOG_PATH ?? path.join(process.cwd(), "data", "checkpoints.jsonl");
const ALLOWED_ORIGINS = process.env.WITNESS_ALLOWED_ORIGINS ?? "*";

// Ensure log directory exists at startup.
mkdirSync(path.dirname(LOG_PATH), { recursive: true });

type CheckpointBody = {
  checkpoint_id?: unknown;
  generated_at?: unknown;
  signer_id?: unknown;
  signature_algo?: unknown;
  total_records?: unknown;
  chain_ok?: unknown;
  cryptographic_ok?: unknown;
  signature?: unknown;
};

function isValidCheckpoint(body: unknown): body is CheckpointBody & {
  checkpoint_id: string;
  signer_id: string;
  signature: string;
  generated_at: string;
} {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.checkpoint_id === "string" &&
    typeof b.signer_id === "string" &&
    typeof b.signature === "string" &&
    typeof b.generated_at === "string"
  );
}

function corsHeaders(): Record<string, string> {
  return {
    "access-control-allow-origin": ALLOWED_ORIGINS,
    "access-control-allow-methods": "POST, GET, OPTIONS",
    "access-control-allow-headers": "content-type",
  };
}

const server = Bun.serve({
  port: PORT,
  async fetch(request) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    // Liveness probe
    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json(
        { status: "ok", service: "buccet-witness", log: LOG_PATH },
        { headers: corsHeaders() },
      );
    }

    // Receive checkpoint
    if (request.method === "POST" && url.pathname === "/checkpoint") {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return Response.json(
          { error: "invalid JSON" },
          { status: 400, headers: corsHeaders() },
        );
      }

      if (!isValidCheckpoint(body)) {
        return Response.json(
          { error: "missing required fields: checkpoint_id, signer_id, signature, generated_at" },
          { status: 422, headers: corsHeaders() },
        );
      }

      // Append to the immutable log. appendFileSync is intentional:
      // atomic per-line append, no buffering, no silent data loss.
      const record = JSON.stringify({
        ...body,
        _received_at: new Date().toISOString(),
      });
      try {
        appendFileSync(LOG_PATH, `${record}\n`, "utf8");
      } catch (err) {
        console.error(`[witness] failed to append checkpoint ${body.checkpoint_id}:`, err);
        return Response.json(
          { error: "storage failure" },
          { status: 500, headers: corsHeaders() },
        );
      }

      console.log(`[witness] stored checkpoint_id=${body.checkpoint_id} signer=${body.signer_id}`);

      return Response.json(
        {
          accepted: true,
          checkpoint_id: body.checkpoint_id,
          signer_id: body.signer_id,
          received_at: new Date().toISOString(),
        },
        { status: 200, headers: corsHeaders() },
      );
    }

    return Response.json(
      { error: "not found" },
      { status: 404, headers: corsHeaders() },
    );
  },
});

console.log(`[witness] listening on port ${server.port}`);
console.log(`[witness] log: ${LOG_PATH}`);
