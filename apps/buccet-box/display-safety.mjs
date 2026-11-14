/**
 * Consent-integrity helpers for the Agent Buccet Box approval surface.
 *
 * Agent-controlled strings (target, reason, content preview, question) must be
 * shown to the operator truthfully. A text-direction override or an invisible
 * character can make the rendered text differ from the bytes that will actually
 * execute. We neutralize those into VISIBLE tokens so what the human reads
 * matches what runs, and we surface anything that is hard to read safely.
 *
 * This changes DISPLAY only; it never alters the bytes the runtime executes.
 */
export function sanitizeForDisplay(raw) {
  const value = raw == null ? "" : String(raw);
  const flags = new Set();
  let out = "";
  for (const ch of value) {
    const cp = ch.codePointAt(0);
    const bidiZeroWidth =
      (cp >= 0x202a && cp <= 0x202e) || (cp >= 0x2066 && cp <= 0x2069) ||
      (cp >= 0x200b && cp <= 0x200f) || cp === 0x2028 || cp === 0x2029 ||
      cp === 0x061c || cp === 0xfeff || cp === 0x00ad;
    const control = cp <= 0x08 || (cp >= 0x0b && cp <= 0x1f) || (cp >= 0x7f && cp <= 0x9f);
    if (bidiZeroWidth || control) {
      flags.add(bidiZeroWidth ? "hidden text-direction / zero-width characters" : "control characters");
      out += `[U+${cp.toString(16).toUpperCase().padStart(4, "0")}]`;
    } else {
      out += ch;
    }
  }
  if (/[^\u0000-\u007F]/.test(out)) flags.add("non-ASCII look-alike characters");
  return { text: out, flags: [...flags], length: value.length };
}

export const LONG_TARGET_THRESHOLD = 120;
