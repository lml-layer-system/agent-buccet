import type { NextRequest } from "next/server";
import type { ProductRole } from "@/lib/storage/product-types";

export type AuthContext = {
  role: ProductRole;
  userId: string;
  caseId?: string;
};

export function getAuthContext(request: Request | NextRequest): AuthContext {
  const headers = request.headers;
  const role = (headers.get("x-role") ?? "").trim() as ProductRole;
  const userId = (headers.get("x-user-id") ?? "").trim();
  const caseId = (headers.get("x-case-id") ?? "").trim();

  if (!role || !userId) {
    throw new Error("Missing auth headers: x-role and x-user-id are required.");
  }

  if (!isRole(role)) {
    throw new Error(`Invalid role: ${role}`);
  }

  return {
    role,
    userId,
    caseId: caseId || undefined,
  };
}

export function requireRole(context: AuthContext, allowed: ProductRole[]): void {
  if (!allowed.includes(context.role)) {
    throw new Error(`Forbidden for role=${context.role}`);
  }
}

function isRole(value: string): value is ProductRole {
  return value === "lawyer" || value === "staff" || value === "client";
}
