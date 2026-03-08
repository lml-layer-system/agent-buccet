export type ExpressionPolicy = {
  active: boolean;
  warmCasual: boolean;
  slang: boolean;
  allowEmotionalLanguage: boolean;
  forbidNerdOrFormal: boolean;
  addressAs: string | null;
  styleProfile: string | null;
  styleFamily: string | null;
  styleDimensions: {
    formality: string | null;
    complexity: string | null;
    purpose: string | null;
    emotionalTone: string | null;
    structureType: string | null;
    voicePerspective: string | null;
    ornamentalDensity: string | null;
    rhythmPacing: string | null;
  };
  emotionalPresence: {
    attuned: boolean;
    validation: boolean;
    coRegulation: boolean;
    continuity: boolean;
    lifePreservation: boolean;
    crisisProtocol: boolean;
  };
  styleDirectives: string[];
  source: string;
};

export type AgentResponseMode = "baseline" | "governed" | "refusal";

export type AgentResponse = {
  mode: AgentResponseMode;
  text: string;
  reason?: string;
};

const DEFAULT_ADDRESS = "my guy";

export function parseExpressionPolicy(source: string): ExpressionPolicy {
  const normalized = source.trim();
  const lower = normalized.toLowerCase();
  const quotedAddress =
    normalized.match(/(?:address me as|refer to me as)\s+['"]([^'"]+)['"]/i)?.[1]?.trim() ?? null;
  const plainAddress =
    normalized.match(/(?:address me as|refer to me as)\s+([a-z0-9 _-]+)/i)?.[1]?.trim() ?? null;
  const styleDirectives = extractStyleDirectives(normalized);
  const styleProfile = deriveStyleProfile(lower, styleDirectives);
  const styleFamily = deriveStyleFamily(lower, styleDirectives);
  const styleDimensions = extractStyleDimensions(normalized);
  const emotionalPresence = extractEmotionalPresence(normalized);

  return {
    active: normalized.length > 0,
    warmCasual: /\b(warm|casual|human|friendly)\b/.test(lower),
    slang: /\b(slang|street|vibe|casual)\b/.test(lower) || styleProfile === "street",
    allowEmotionalLanguage: /\b(emotional|never sanitize)\b/.test(lower),
    forbidNerdOrFormal: /\b(never talk formally|no nerd|not talk nerdy|never talk nerdy|no formal)\b/.test(lower),
    addressAs: quotedAddress ?? plainAddress ?? (/\bmy guy\b/.test(lower) ? DEFAULT_ADDRESS : null),
    styleProfile,
    styleFamily,
    styleDimensions,
    emotionalPresence,
    styleDirectives,
    source: normalized,
  };
}

export function isNerdOrFormalRequest(question: string): boolean {
  const lower = question.toLowerCase();
  return /\b(technical jargon|super technical|full nerd|formal|academic|deeply technical|speak nerdy)\b/.test(lower)
    || (lower.includes("quantum") && /\b(explain|describe|break down)\b/.test(lower));
}

export function extractDocumentInsights(documentText: string): string[] {
  const lines = documentText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length === 0) {
    return [];
  }

  const cuePatterns: Array<{ label: string; regex: RegExp }> = [
    { label: "Core values", regex: /\b(value|principle|belief|priority)\b/i },
    { label: "Goals", regex: /\b(goal|target|objective|plan)\b/i },
    { label: "Work style", regex: /\b(work style|workflow|process|routine|prefer)\b/i },
    { label: "Communication style", regex: /\b(communicat|tone|style|voice)\b/i },
    { label: "Constraints", regex: /\b(must|never|avoid|cannot|constraint)\b/i },
  ];

  const out: string[] = [];
  for (const cue of cuePatterns) {
    const match = lines.find((line) => cue.regex.test(line));
    if (match) {
      out.push(`${cue.label}: ${truncate(cleanLine(match), 150)}`);
    }
  }

  if (out.length >= 3) {
    return out.slice(0, 5);
  }

  const fallback = lines
    .filter((line) => line.length >= 24)
    .slice(0, 5)
    .map((line) => `Signal: ${truncate(cleanLine(line), 150)}`);

  return [...out, ...fallback].slice(0, 5);
}

export function buildAgentResponse(input: {
  question: string;
  policy: ExpressionPolicy;
  documentInsights: string[];
}): AgentResponse {
  const question = input.question.trim();
  if (!question) {
    return { mode: "baseline", text: "Respond naturally and ask what the user wants next." };
  }

  if (!input.policy.active) {
    return {
      mode: "baseline",
      text: buildBaselineAnswer(question),
    };
  }

  if (input.policy.forbidNerdOrFormal && isNerdOrFormalRequest(question)) {
    const address = input.policy.addressAs ?? DEFAULT_ADDRESS;
    return {
      mode: "refusal",
      text: `${capitalize(address)}, that request conflicts with active expression law. Offer a lawful alternative style and ask whether to persist a new law.`,
      reason: "Blocked by expression law: no nerd/formal mode.",
    };
  }
  const guidance = buildPolicyGuidance(input.policy, question, input.documentInsights);
  return {
    mode: "governed",
    text: guidance,
  };
}

export function buildPolicyGuidance(policy: ExpressionPolicy, question: string, documentInsights: string[]): string {
  const directives = styleDirectiveSummary(policy);
  const insightLine = documentInsights.length > 0 ? `Document insights: ${documentInsights.slice(0, 3).join(" | ")}` : "Document insights: none.";
  const profile = policy.styleProfile ?? "unspecified";
  const family = policy.styleFamily ?? "unspecified";
  const addressAs = policy.addressAs ?? "none";
  const emotional = policy.emotionalPresence;
  const emotionalFlags = [
    emotional.attuned ? "attuned" : null,
    emotional.validation ? "validating" : null,
    emotional.coRegulation ? "co-regulating" : null,
    emotional.continuity ? "continuity-aware" : null,
    emotional.lifePreservation ? "life-preservation-priority" : null,
  ]
    .filter(Boolean)
    .join(", ");

  return [
    "LML policy-guided response. Do not output this header.",
    `User message: "${truncate(question, 220)}"`,
    `Style profile: ${profile}`,
    `Style family: ${family}`,
    `Address as: ${addressAs}`,
    directives,
    insightLine,
    `Emotional presence: ${emotionalFlags || "standard"}`,
    "Respond naturally in the requested style and role.",
    "Do not mention internal policy unless user asks.",
    "If this is a temporary style directive, include one brief line offering to persist it as a law.",
  ].join("\n");
}

function extractStyleDirectives(source: string): string[] {
  const out: string[] = [];
  const lines = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const pattern = /\b(tone|style|voice|persona|expression|speak|talk|act as|you are my|be my)\b/i;
  for (const line of lines) {
    if (pattern.test(line)) {
      out.push(line);
    }
  }
  const inline = source.match(/\b(talk|speak)\s+like\s+([a-z0-9 _-]+)/gi) ?? [];
  out.push(...inline);
  const roleInline = source.match(/\b(you are my|be my|act as)\s+([a-z0-9 _-]+)/gi) ?? [];
  out.push(...roleInline);
  return [...new Set(out)].slice(0, 24);
}

function deriveStyleProfile(lower: string, directives: string[]): string | null {
  const directiveText = directives.map((item) => item.toLowerCase());
  for (let i = directiveText.length - 1; i >= 0; i -= 1) {
    const line = directiveText[i];
    if (/\b(street|slang|hood|my guy|casual)\b/.test(line)) return "street";
    if (/\b(scientist|scientific|research|lab|hypothesis|evidence-first)\b/.test(line)) return "scientist";
    if (/\b(formal|professional|executive|corporate)\b/.test(line)) return "formal";
    if (/\b(general|commander|command mode|tactical|mission)\b/.test(line)) return "general";
    if (/\b(teacher|mentor|coach)\b/.test(line)) return "mentor";
    if (/\b(legal|lawyer|attorney)\b/.test(line)) return "legal";
  }

  const text = `${lower}\n${directiveText.join("\n")}`;
  if (/\b(street|slang|hood|my guy|casual)\b/.test(text)) return "street";
  if (/\b(scientist|scientific|research|lab|hypothesis|evidence-first)\b/.test(text)) return "scientist";
  if (/\b(formal|professional|executive|corporate)\b/.test(text)) return "formal";
  if (/\b(general|commander|command mode|tactical|mission)\b/.test(text)) return "general";
  if (/\b(teacher|mentor|coach)\b/.test(text)) return "mentor";
  if (/\b(legal|lawyer|attorney)\b/.test(text)) return "legal";
  return null;
}

function deriveStyleFamily(lower: string, directives: string[]): string | null {
  const directiveText = directives.map((item) => item.toLowerCase());
  const families: Array<[string, RegExp]> = [
    ["academic paper", /\b(academic paper|research article)\b/],
    ["scientific report", /\b(scientific report|lab report)\b/],
    ["technical documentation", /\b(technical documentation|documentation|user manual)\b/],
    ["news article", /\b(news article|journalism)\b/],
    ["op-ed", /\b(op-ed|op ed|opinion piece)\b/],
    ["essay", /\b(essay|critique|analysis)\b/],
    ["how-to guide", /\b(how to|how-to|tutorial|guide)\b/],
    ["social media thread", /\b(thread|social media)\b/],
    ["text message facts", /\b(text message|sms)\b/],
  ];
  for (let i = directiveText.length - 1; i >= 0; i -= 1) {
    const line = directiveText[i];
    for (const [family, pattern] of families) {
      if (pattern.test(line)) {
        return family;
      }
    }
  }
  const text = `${lower}\n${directiveText.join("\n")}`;
  for (const [family, pattern] of families) {
    if (pattern.test(text)) {
      return family;
    }
  }
  return null;
}

function extractStyleDimensions(source: string): ExpressionPolicy["styleDimensions"] {
  const lower = source.toLowerCase();
  const pick = (...patterns: RegExp[]): string | null => {
    for (const pattern of patterns) {
      const match = lower.match(pattern);
      if (match) {
        const value = [...match].slice(1).reverse().find((part) => Boolean(part));
        if (value) {
          return value.trim();
        }
      }
    }
    return null;
  };

  return {
    formality: pick(/\bformality\s*[:=-]\s*([a-z0-9 _-]+)/i),
    complexity: pick(/\bcomplexity\s*[:=-]\s*([a-z0-9 _-]+)/i),
    purpose: pick(/\b(primary purpose|purpose)\s*[:=-]\s*([a-z0-9 _-]+)/i, /\bpurpose\s*[:=-]\s*([a-z0-9 _-]+)/i),
    emotionalTone: pick(/\b(emotional tone|tone)\s*[:=-]\s*([a-z0-9 _-]+)/i, /\btone\s*[:=-]\s*([a-z0-9 _-]+)/i),
    structureType: pick(/\b(structure type|structure)\s*[:=-]\s*([a-z0-9 _-]+)/i),
    voicePerspective: pick(/\b(voice|perspective)\s*[:=-]\s*([a-z0-9 _-]+)/i),
    ornamentalDensity: pick(/\b(ornamental density|ornament)\s*[:=-]\s*([a-z0-9 _-]+)/i),
    rhythmPacing: pick(/\b(rhythm|pacing)\s*[:=-]\s*([a-z0-9 _-]+)/i),
  };
}

function styleDirectiveSummary(policy: ExpressionPolicy): string {
  const dims = Object.entries(policy.styleDimensions)
    .filter(([, value]) => Boolean(value))
    .slice(0, 3)
    .map(([key, value]) => `${key}=${value}`);
  const family = policy.styleFamily ? `family=${policy.styleFamily}` : null;
  const emo = policy.emotionalPresence;
  const emoFlags = [
    emo.attuned ? "attunement=on" : null,
    emo.validation ? "validation=on" : null,
    emo.coRegulation ? "co_regulation=on" : null,
    emo.continuity ? "continuity=on" : null,
    emo.lifePreservation ? "life_preservation=on" : null,
  ].filter(Boolean);
  if (policy.styleDirectives.length === 0 && !family && dims.length === 0 && emoFlags.length === 0) {
    return "Style directives: none explicit.";
  }
  const selected = policy.styleDirectives.slice(0, 2).map((item) => truncate(cleanLine(item), 100));
  return `Style directives active: ${[...selected, family, ...dims, ...emoFlags].filter(Boolean).join(" | ")}`;
}

function extractEmotionalPresence(source: string): ExpressionPolicy["emotionalPresence"] {
  const lower = source.toLowerCase();
  return {
    attuned: /\b(attunement|attuned|resonance|mentalizing|presence quality)\b/.test(lower),
    validation: /\b(validation|validate feelings|never minimize)\b/.test(lower),
    coRegulation: /\b(co-regulation|co regulation|stabilize|ground in present)\b/.test(lower),
    continuity: /\b(continuity|memory|follow through|check back)\b/.test(lower),
    lifePreservation: /\b(preserve life|life preservation|sacred principle)\b/.test(lower),
    crisisProtocol: /\b(crisis response|imminent danger|988|escalation|safety plan)\b/.test(lower),
  };
}

function buildBaselineAnswer(question: string): string {
  if (/\b(how are you|how you doing)\b/i.test(question)) {
    return "I am functioning normally. How can I assist you?";
  }
  if (/\b(what should i do with this document|summarize this document)\b/i.test(question)) {
    return "The document appears to contain relevant information. I can provide a summary.";
  }
  return "Hello. I can help with that request.";
}

function truncate(value: string, max: number): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max - 3)}...`;
}

function cleanLine(value: string): string {
  return value.replace(/\s+/g, " ").replace(/[^\x20-\x7E]/g, "").trim();
}

function capitalize(value: string): string {
  if (!value) {
    return value;
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}
