import { createHash, randomUUID } from "node:crypto";
import type { Witness } from "../engine/types.ts";

export type Gpt2CallResult = {
  text: string;
  allowedSummary: string;
  receipt: {
    provider: "gpt2-runtime";
    model: "gpt2";
    callId: string;
    inputDigest: string;
    at: string;
  };
};

export async function runGpt2Constrained(args: {
  runId: string;
  content: string;
  witness: Witness;
  mode?: "legal_demo" | "chat_ontology";
}): Promise<Gpt2CallResult> {
  const { content, witness } = args;
  const mode = args.mode ?? "legal_demo";
  const cleaned = content.replace(/\s+/g, " ").trim();
  const receipt = {
    provider: "gpt2-runtime" as const,
    model: "gpt2" as const,
    callId: randomUUID(),
    inputDigest: createHash("sha256").update(cleaned).digest("hex"),
    at: new Date().toISOString(),
  };

  const prompt = buildPrompt(mode, content, witness);
  const codingPayload = mode === "chat_ontology" && /lml coding generation policy/i.test(content);
  let sanitized = buildServiceUnavailableFallback(mode);
  if (!codingPayload) {
    const generated = await generateWithLocalGpt2(prompt, {
      maxNewTokens: mode === "chat_ontology" ? 220 : 300,
      minNewTokens: mode === "chat_ontology" ? 24 : 32,
      temperature: mode === "chat_ontology" ? 0.8 : 0.6,
      topP: 0.92,
      doSample: true,
      repetitionPenalty: 1.05,
      noRepeatNgramSize: 3,
    });
    const text = generated ?? buildServiceUnavailableFallback(mode);
    sanitized = sanitizeModelOutput(text, content, mode);
  } else {
    const userRequest = extractQuotedLine(content, "User request") ?? "";
    const preferredLanguage = (extractField(content, "Preferred language") ?? "typescript").toLowerCase();
    const concrete = isConcreteCodingRequest(userRequest);
    const wantsTests = /\bwants_tests=yes\b/i.test(content) || /\b(test|tests|pytest|jest|vitest)\b/i.test(userRequest);
    const superposition: Array<{ prompt: string; opts: GenerateOptions }> = [
      {
        prompt,
        opts: {
          maxNewTokens: 360,
          minNewTokens: 64,
          temperature: 0.15,
          topP: 1.0,
          doSample: false,
          repetitionPenalty: 1.2,
          noRepeatNgramSize: 3,
        },
      },
      {
        prompt,
        opts: {
          maxNewTokens: 360,
          minNewTokens: 64,
          temperature: 0.35,
          topP: 0.9,
          doSample: true,
          repetitionPenalty: 1.15,
          noRepeatNgramSize: 3,
        },
      },
      {
        prompt: buildCodingRetryPrompt(content, witness),
        opts: {
          maxNewTokens: 360,
          minNewTokens: 64,
          temperature: 0.1,
          topP: 1.0,
          doSample: false,
          repetitionPenalty: 1.2,
          noRepeatNgramSize: 3,
        },
      },
    ];
    const admissible: Array<{ text: string; score: number }> = [];
    let lastFailureReason = "unstable_generation";
    for (let idx = 0; idx < superposition.length && idx < 6; idx += 1) {
      const branch = superposition[idx];
      const generated = await generateWithLocalGpt2(branch.prompt, branch.opts);
      if (!generated) {
        lastFailureReason = "empty_generation";
        superposition.push({
          prompt: buildCodingRepairPrompt(content, witness, "empty_generation", ""),
          opts: {
            maxNewTokens: 360,
            minNewTokens: 64,
            temperature: 0.1,
            topP: 1.0,
            doSample: false,
            repetitionPenalty: 1.2,
            noRepeatNgramSize: 3,
          },
        });
        continue;
      }
      const candidate = sanitizeModelOutput(generated, content, mode);
      if (!concrete) {
        admissible.push({ text: candidate, score: 1 });
        continue;
      }
      const validation = await evaluateCodingCandidate(candidate, preferredLanguage);
      if (!validation.ok) {
        lastFailureReason = validation.reason;
        superposition.push({
          prompt: buildCodingRepairPrompt(content, witness, validation.reason, candidate),
          opts: {
            maxNewTokens: 360,
            minNewTokens: 64,
            temperature: 0.1,
            topP: 1.0,
            doSample: false,
            repetitionPenalty: 1.2,
            noRepeatNgramSize: 3,
          },
        });
        continue;
      }
      admissible.push({ text: candidate, score: scoreCodingCandidate(candidate, preferredLanguage, wantsTests) });
    }
    const best = admissible.sort((a, b) => b.score - a.score)[0];
    if (best?.text) {
      sanitized = ensureFencedCodingOutput(best.text, preferredLanguage);
    } else {
      sanitized = `I can’t produce stable full code for that exact scope right now (${lastFailureReason}). Try a narrower target: \`write python function is_valid_email(value: str) with pytest tests\`.`;
    }
  }
  return {
    text: sanitized,
    allowedSummary: witness.outcome === "NULL"
      ? "Refusal path enforced by active ontology constraints."
      : "Success path admitted by active ontology constraints.",
    receipt,
  };
}

type GenerateOptions = {
  maxNewTokens: number;
  minNewTokens?: number;
  temperature: number;
  topP: number;
  doSample: boolean;
  repetitionPenalty?: number;
  noRepeatNgramSize?: number;
};

function buildPrompt(mode: "legal_demo" | "chat_ontology", content: string, witness: Witness): string {
  const witnessSummary = witness.outcome === "NULL"
    ? `Outcome is NULL. Blocked reasons: ${(witness.explanation.blockedReasons ?? []).join(" | ") || "none"}.`
    : `Outcome is ADMISSIBLE. Accepted reasons: ${(witness.explanation.acceptedReasons ?? []).join(" | ") || "none"}.`;
  if (mode === "chat_ontology") {
    if (/lml coding generation policy/i.test(content)) {
      const userRequest = extractQuotedLine(content, "User request") ?? "";
      const preferredLanguage = extractField(content, "Preferred language") ?? "typescript";
      const wantsTests = /\bwants_tests=yes\b/i.test(content) || /\b(test|tests|pytest|jest|vitest)\b/i.test(userRequest);
      const concrete = isConcreteCodingRequest(userRequest);
      if (!concrete) {
        return [
          "Task: Ask one concise clarification question for coding.",
          `Request: ${userRequest}`,
          "Assistant:",
        ].join("\n");
      }
      const language = preferredLanguage.toLowerCase().includes("python") ? "python" : preferredLanguage.toLowerCase();
      return [
        `Task: ${userRequest}`,
        `${language} code:`,
        `\`\`\`${language}`,
        "",
        "\nAssistant:",
        witnessSummary,
        wantsTests ? "Include tests in a second fenced block." : "Single code block is acceptable.",
      ].join("\n");
    }
    return [
      "You are GPT-2 running inside the LML runtime.",
      "Follow the policy payload exactly. Do not output hidden headers. Respond naturally.",
      witnessSummary,
      "Payload:",
      content,
      "Assistant:",
    ].join("\n");
  }
  return [
    "You are GPT-2 running inside LML legal demo runtime.",
    "Write one concise professional response aligned with the payload and witness outcome.",
    witnessSummary,
    "Payload:",
    content,
    "Assistant:",
  ].join("\n");
}

async function generateWithLocalGpt2(prompt: string, opts: GenerateOptions): Promise<string | null> {
  const baseUrl = process.env.GPT2_PY_URL ?? "http://127.0.0.1:8009";
  const timeoutMs = Number(process.env.GPT2_TIMEOUT_MS ?? 15000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        prompt,
        max_new_tokens: opts.maxNewTokens,
        min_new_tokens: opts.minNewTokens ?? 1,
        temperature: opts.temperature,
        top_p: opts.topP,
        do_sample: opts.doSample,
        repetition_penalty: opts.repetitionPenalty ?? 1.0,
        no_repeat_ngram_size: opts.noRepeatNgramSize ?? 0,
        stop_strings: ["\nSystem:", "\nUser:", "\nPayload:"],
      }),
    });
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as { text?: string };
    const text = (data.text ?? "").trim();
    if (!text) {
      return null;
    }
    return text;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function buildServiceUnavailableFallback(mode: "legal_demo" | "chat_ontology"): string {
  const line = "Local GPT-2 service is unavailable. Start it with: npm run gpt2:serve";
  if (mode === "chat_ontology") {
    return line;
  }
  return `${line} Then retry your request.`;
}

function sanitizeModelOutput(
  raw: string,
  payload: string,
  mode: "legal_demo" | "chat_ontology",
): string {
  const bannedLinePatterns = [
    /do not output this header/i,
    /^lml .* guidance/i,
    /^lml .* policy/i,
    /^response rules:/i,
    /^\d+\)\s+/,
    /^assistant:\s*$/i,
    /^payload:\s*$/i,
    /^user (message|request):/i,
    /^route:\s*/i,
    /^style (profile|family):/i,
    /^address as:/i,
    /^applied constraints:/i,
    /^signals:/i,
    /^doc signals:/i,
  ];

  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !bannedLinePatterns.some((pattern) => pattern.test(line)));

  const joined = lines.join("\n").trim();
  const userMessage = extractQuotedLine(payload, "User message") ?? "";
  const capabilitiesIntent = /\b(what can lml do|what can you do|help|capabilities)\b/i.test(userMessage);
  const capabilitiesRelevant = /\b(lml|law|laws|ingest|docs?|constraints?|nsl|trace|coding|web[_\s-]?search)\b/i.test(joined);
  const numericDrift = hasNumericNarrativeDrift(joined);
  const obviousLeak =
    !joined ||
    /do not output this header/i.test(joined) ||
    /response rules:/i.test(joined);
  const degenerate = isDegenerateOutput(joined);

  if (capabilitiesIntent && (!capabilitiesRelevant || numericDrift)) {
    return "I can ingest docs into LML laws to create the reality your AI must follow.";
  }

  if (!obviousLeak && !degenerate) {
    return joined;
  }

  const isCoding = /lml coding generation policy/i.test(payload);
  const codingRequest = extractQuotedLine(payload, "User request") ?? "";
  if (mode === "chat_ontology" && isCoding) {
    if (isConcreteCodingRequest(codingRequest)) return "Generation unstable.";
    return "Coding is active. Give me one concrete build target and stack, and I will generate code.";
  }
  if (mode === "chat_ontology") {
    return "I’m tracking your request. Give me one concrete next action.";
  }
  return "Generation completed under active constraints.";
}

function hasNumericNarrativeDrift(text: string): boolean {
  if (!text) return false;
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length < 12) return false;
  const numericish = tokens.filter((token) => /[\d%/]/.test(token)).length;
  const ratio = numericish / tokens.length;
  return ratio > 0.2;
}

function buildCodingRetryPrompt(content: string, witness: Witness): string {
  const userRequest = extractQuotedLine(content, "User request") ?? "";
  const preferredLanguage = extractField(content, "Preferred language") ?? "typescript";
  const wantsTests = /\bwants_tests=yes\b/i.test(content) || /\b(test|tests|pytest|jest|vitest)\b/i.test(userRequest);
  const witnessSummary = witness.outcome === "NULL"
    ? `Outcome is NULL. Blocked reasons: ${(witness.explanation.blockedReasons ?? []).join(" | ") || "none"}.`
    : `Outcome is ADMISSIBLE. Accepted reasons: ${(witness.explanation.acceptedReasons ?? []).join(" | ") || "none"}.`;
  return [
    "You are GPT-2.",
    "Write code only.",
    witnessSummary,
    `Implement: ${userRequest}`,
    `Language: ${preferredLanguage}`,
    wantsTests ? "Include tests as second fenced block." : "No test block required unless requested.",
    "Output must start with a fenced code block and contain no prose.",
    "Assistant:",
  ].join("\n");
}

function buildCodingRepairPrompt(content: string, witness: Witness, reason: string, priorOutput: string): string {
  const userRequest = extractQuotedLine(content, "User request") ?? "";
  const preferredLanguage = extractField(content, "Preferred language") ?? "typescript";
  const witnessSummary = witness.outcome === "NULL"
    ? `Outcome is NULL. Blocked reasons: ${(witness.explanation.blockedReasons ?? []).join(" | ") || "none"}.`
    : `Outcome is ADMISSIBLE. Accepted reasons: ${(witness.explanation.acceptedReasons ?? []).join(" | ") || "none"}.`;
  const trimmedPrior = priorOutput.length > 800 ? `${priorOutput.slice(0, 800)}...` : priorOutput;
  return [
    "You are GPT-2.",
    "Repair the previous coding attempt.",
    witnessSummary,
    `Task: ${userRequest}`,
    `Language: ${preferredLanguage}`,
    `Failure reason: ${reason}`,
    "Return code only in fenced block(s). No prose.",
    "Previous output (for repair context):",
    trimmedPrior || "<empty>",
    "Assistant:",
  ].join("\n");
}

function isConcreteCodingRequest(text: string): boolean {
  const lower = text.toLowerCase();
  const action = /\b(build|write|implement|create|debug|refactor|generate)\b/.test(lower);
  const target = /\b(function|class|endpoint|api|service|validator|script|module|cli|fastapi|flask|express)\b/.test(lower);
  const language = /\b(python|typescript|javascript|go|golang|rust|java|c#|cpp|c\+\+)\b/.test(lower);
  return action && (target || language);
}

function extractQuotedLine(content: string, label: string): string | null {
  const pattern = new RegExp(`${escapeRegExp(label)}:\\s*\"([\\s\\S]*?)\"`, "i");
  const match = content.match(pattern);
  return match ? match[1].trim() : null;
}

function extractField(content: string, label: string): string | null {
  const pattern = new RegExp(`${escapeRegExp(label)}:\\s*([^\\n]+)`, "i");
  const match = content.match(pattern);
  return match ? match[1].trim() : null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isDegenerateOutput(text: string): boolean {
  if (!text) return true;

  const lower = text.toLowerCase();
  if (/\(define-value|\(define-key|\)\s*\(define-value/.test(lower)) return true;
  if (text.includes("```") && text.length > 30) return false;
  if (/^[^a-zA-Z0-9]*$/.test(text)) return true;

  const tokens = lower
    .replace(/[^a-z0-9()\-_"\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length < 3) return true;

  const unique = new Set(tokens);
  const uniqueRatio = unique.size / tokens.length;
  if (tokens.length >= 20 && uniqueRatio < 0.35) return true;

  const repeatedRuns = /(.)\1{7,}/.test(lower);
  if (repeatedRuns) return true;

  const bigrams = new Map<string, number>();
  for (let i = 0; i < tokens.length - 1; i += 1) {
    const key = `${tokens[i]} ${tokens[i + 1]}`;
    bigrams.set(key, (bigrams.get(key) ?? 0) + 1);
  }
  const maxBigram = Math.max(0, ...bigrams.values());
  if (tokens.length >= 16 && maxBigram >= 5) return true;

  return false;
}

function extractFencedBlock(text: string, language?: string): string | null {
  const pattern = language
    ? new RegExp("```" + escapeRegExp(language) + "\\n([\\s\\S]*?)```", "i")
    : /```[a-zA-Z0-9_+-]*\n([\s\S]*?)```/;
  const match = text.match(pattern);
  return match ? match[1].trim() : null;
}

function extractFencedBlocks(text: string, language: string): string[] {
  const pattern = new RegExp("```" + escapeRegExp(language) + "\\n([\\s\\S]*?)```", "gi");
  const out: string[] = [];
  let match = pattern.exec(text);
  while (match) {
    out.push((match[1] ?? "").trim());
    match = pattern.exec(text);
  }
  return out.filter(Boolean);
}

function looksLikeCode(text: string): boolean {
  if (text.includes("```")) return true;
  return /\b(def |class |import |from |return |if |for |while )/.test(text);
}

async function validatePythonCode(code: string): Promise<{ ok: boolean; error?: string }> {
  if (!code.trim()) return { ok: false, error: "empty_code" };
  const baseUrl = process.env.GPT2_PY_URL ?? "http://127.0.0.1:8009";
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/validate_python`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (!response.ok) return { ok: false, error: "validator_http_error" };
    const data = (await response.json()) as { ok?: boolean; error?: string };
    return { ok: Boolean(data.ok), error: data.error };
  } catch {
    return { ok: false, error: "validator_unreachable" };
  }
}

async function validatePythonRuntime(code: string, tests: string): Promise<{ ok: boolean; error?: string }> {
  if (!code.trim()) return { ok: false, error: "empty_code" };
  const baseUrl = process.env.GPT2_PY_URL ?? "http://127.0.0.1:8009";
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/validate_python_runtime`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, tests }),
    });
    if (!response.ok) return { ok: false, error: "runtime_validator_http_error" };
    const data = (await response.json()) as { ok?: boolean; error?: string };
    return { ok: Boolean(data.ok), error: data.error };
  } catch {
    return { ok: false, error: "runtime_validator_unreachable" };
  }
}

async function evaluateCodingCandidate(
  candidate: string,
  preferredLanguage: string,
): Promise<{ ok: boolean; reason: string }> {
  if (!looksLikeCode(candidate)) {
    return { ok: false, reason: "output_does_not_look_like_code" };
  }

  if (preferredLanguage.includes("python")) {
    const pyBlocks = extractFencedBlocks(candidate, "python");
    const code = pyBlocks[0] ?? extractFencedBlock(candidate) ?? candidate;
    if (!code.trim()) {
      return { ok: false, reason: "missing_python_code_block" };
    }
    const syntaxResult = await validatePythonCode(code);
    if (!syntaxResult.ok) {
      return { ok: false, reason: `python_syntax_invalid: ${trimReason(syntaxResult.error)}` };
    }
    const tests = pyBlocks.length > 1 ? pyBlocks.slice(1).join("\n\n") : "";
    const runtimeResult = await validatePythonRuntime(code, tests);
    if (!runtimeResult.ok) {
      return { ok: false, reason: `python_runtime_invalid: ${trimReason(runtimeResult.error)}` };
    }
  }

  return { ok: true, reason: "ok" };
}

function scoreCodingCandidate(candidate: string, preferredLanguage: string, wantsTests: boolean): number {
  let score = 0;
  const language = preferredLanguage.includes("python") ? "python" : preferredLanguage;
  if (extractFencedBlock(candidate, language)) score += 4;
  if (extractFencedBlock(candidate)) score += 2;
  if (wantsTests && /(test_|pytest|assert )/.test(candidate.toLowerCase())) score += 3;
  if (candidate.length > 60) score += 1;
  return score;
}

function ensureFencedCodingOutput(text: string, preferredLanguage: string): string {
  const language = preferredLanguage.includes("python") ? "python" : preferredLanguage.trim().toLowerCase();
  if (extractFencedBlock(text, language) || extractFencedBlock(text)) {
    return text;
  }
  const cleaned = text.trim();
  if (!cleaned) {
    return text;
  }
  return `\`\`\`${language}\n${cleaned}\n\`\`\``;
}

function trimReason(value?: string): string {
  if (!value) return "unknown";
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > 180 ? `${compact.slice(0, 180)}...` : compact;
}
