import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeForDisplay, LONG_TARGET_THRESHOLD } from "./display-safety.mjs";

test("neutralizes RTL/bidi override into a visible token", () => {
  const r = sanitizeForDisplay("vacation_photo_‮gpj.exe");
  assert.ok(!/[‪-‮]/.test(r.text), "no raw bidi char remains");
  assert.match(r.text, /\[U\+202E\]/);
  assert.ok(r.flags.includes("hidden text-direction / zero-width characters"));
});

test("neutralizes zero-width and soft-hyphen characters", () => {
  for (const cp of ["​", "‍", "﻿", "­", "⁦"]) {
    const r = sanitizeForDisplay(`ev${cp}il.com`);
    assert.ok(r.flags.length > 0, `flagged for U+${cp.codePointAt(0).toString(16)}`);
    assert.ok(!r.text.includes(cp), "raw invisible removed");
  }
});

test("flags non-ASCII homoglyph hosts", () => {
  const r = sanitizeForDisplay("https://аpple.com/login"); // Cyrillic a
  assert.ok(r.flags.includes("non-ASCII look-alike characters"));
});

test("leaves ordinary ASCII targets untouched and unflagged", () => {
  const r = sanitizeForDisplay("/workspace/notes.txt");
  assert.equal(r.text, "/workspace/notes.txt");
  assert.deepEqual(r.flags, []);
});

test("reports true length so callers can warn on fold-hidden tails", () => {
  const long = "/workspace/" + "x".repeat(300) + "/application-secrets.env";
  const r = sanitizeForDisplay(long);
  assert.equal(r.length, long.length);
  assert.ok(r.length > LONG_TARGET_THRESHOLD);
});

test("control characters are neutralized", () => {
  const r = sanitizeForDisplay("a\u0007b\u001bc");
  assert.ok(r.flags.includes("control characters"));
  assert.ok(!/[\u0000-\u001f]/.test(r.text));
});
