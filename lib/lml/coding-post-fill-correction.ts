import type { CodingBodyFillSlot } from "@/lib/lml/coding-body-fill";

export type CodingPostFillAudit = {
  ok: boolean;
  correctedLines: string[];
  reasons: string[];
};

export function applyPostFillSemanticCorrections(
  slot: CodingBodyFillSlot,
  lines: string[],
): CodingPostFillAudit {
  const reasons: string[] = [];
  const joined = lines.join("\n");

  if (catchesDatabaseErrors(joined) && !hasSessionRollback(joined)) {
    reasons.push("caught_db_error_without_session_rollback");
  }

  if (looksLikeClientRoleBypass(slot, joined)) {
    reasons.push("client_payload_auth_bypass");
  }

  return {
    ok: reasons.length === 0,
    correctedLines: lines,
    reasons,
  };
}

function catchesDatabaseErrors(code: string): boolean {
  return /except\s+(IntegrityError|SQLAlchemyError|Exception)\b/.test(code);
}

function hasSessionRollback(code: string): boolean {
  return /\b(?:await\s+)?session\.rollback\(/.test(code);
}

function looksLikeClientRoleBypass(slot: CodingBodyFillSlot, code: string): boolean {
  if (slot.kind !== "auth_session" && slot.kind !== "service_payload" && slot.kind !== "route_delegate") {
    return false;
  }
  return /\b(clientRole|userRole|payload\.role|request\.body\.role)\b/.test(code);
}
