import { createHash } from "node:crypto";

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function normalizeText(text: string): string {
  return text.replace(/\r/g, "").replace(/[\t ]+/g, " ").trim();
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3);
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJson);
  }
  if (value && typeof value === "object") {
    const input = value as Record<string, unknown>;
    const keys = Object.keys(input).sort((a, b) => a.localeCompare(b));
    const output: Record<string, unknown> = {};
    for (const key of keys) {
      output[key] = sortJson(input[key]);
    }
    return output;
  }
  return value;
}
