export function extractTextFromPdfBytes(bytes: Uint8Array): string {
  if (bytes.length === 0) {
    return "";
  }

  const raw = new TextDecoder("latin1").decode(bytes);
  const snippets = new Set<string>();

  // Best-effort extraction of text strings from PDF text operators.
  const parenMatches = raw.match(/\((?:\\.|[^\\)]){3,}\)/g) ?? [];
  for (const token of parenMatches) {
    const decoded = decodePdfString(token.slice(1, -1)).trim();
    if (decoded.length >= 3) {
      snippets.add(decoded);
    }
  }

  // Fallback for already-readable text segments.
  const plainMatches = raw.match(/[A-Za-z0-9][A-Za-z0-9 ,.;:'"!?()/_-]{25,}/g) ?? [];
  for (const token of plainMatches) {
    snippets.add(token.trim());
  }

  const joined = Array.from(snippets)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n");

  return joined;
}

function decodePdfString(value: string): string {
  return value
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\")
    .replace(/\\([0-7]{1,3})/g, (_match, octal: string) => String.fromCharCode(parseInt(octal, 8)));
}
