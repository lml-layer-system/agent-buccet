import { basename, sep as pathSep } from "node:path";
import path from "node:path";
import { stripTrailingPunctuation } from "./track-extractor-entropy.ts";
import { canonicalizeTrackLiteral, passesTrackMeaningGate } from "./track-extractor-negative.ts";
import type {
  BoundaryActionCorridor,
  BoundaryActionKind,
  BoundaryReviewContext,
  BoundaryUplTrackConstraint,
} from "./types.ts";

const CHAT_TARGET = "chat:primary";

const ACTION_KIND_ALIASES: Array<{ pattern: RegExp; actionKind: BoundaryActionKind }> = [
  { pattern: /^(?:chat|chat\.emit|emit)$/i, actionKind: "chat.emit" },
  { pattern: /^(?:fs\.read|read file|read)$/i, actionKind: "fs.read" },
  { pattern: /^(?:fs\.write|write file|write)$/i, actionKind: "fs.write" },
  { pattern: /^(?:fs\.append|append)$/i, actionKind: "fs.append" },
  { pattern: /^(?:fs\.delete|delete file|delete)$/i, actionKind: "fs.delete" },
  { pattern: /^(?:fs\.mkdir|mkdir|make dir)$/i, actionKind: "fs.mkdir" },
  { pattern: /^(?:fs\.move|move|rename)$/i, actionKind: "fs.move" },
  { pattern: /^(?:tool\.exec|run command|exec|execute|tool)$/i, actionKind: "tool.exec" },
  { pattern: /^(?:network\.send|network|http|request)$/i, actionKind: "network.send" },
  { pattern: /^(?:comm\.send|recipient|email|message)$/i, actionKind: "comm.send" },
  { pattern: /^(?:db\.query|query db|query)$/i, actionKind: "db.query" },
  { pattern: /^(?:db\.insert|insert)$/i, actionKind: "db.insert" },
  { pattern: /^(?:db\.update|update db)$/i, actionKind: "db.update" },
  { pattern: /^(?:db\.delete|delete row)$/i, actionKind: "db.delete" },
  { pattern: /^(?:sys\.env\.read|read env)$/i, actionKind: "sys.env.read" },
  { pattern: /^(?:sys\.env\.write|write env)$/i, actionKind: "sys.env.write" },
  { pattern: /^(?:sys\.config\.read|read config)$/i, actionKind: "sys.config.read" },
  { pattern: /^(?:sys\.config\.write|write config)$/i, actionKind: "sys.config.write" },
  { pattern: /^(?:sys\.credential\.read|read credential)$/i, actionKind: "sys.credential.read" },
  { pattern: /^(?:sys\.credential\.use|use credential)$/i, actionKind: "sys.credential.use" },
];

export type ActionTrackMeaning = {
  corridor?: BoundaryActionCorridor;
  actionKind: BoundaryActionKind;
  target: string;
  targetPattern?: string;
  targetMatchMode?: BoundaryUplTrackConstraint["targetMatchMode"];
};

export function resolveActionKind(raw: string | undefined): BoundaryActionKind {
  const normalized = raw ? canonicalizeTrackLiteral(raw) : undefined;
  if (!normalized) {
    return "chat.emit";
  }
  for (const alias of ACTION_KIND_ALIASES) {
    if (alias.pattern.test(normalized)) {
      return alias.actionKind;
    }
  }
  return "chat.emit";
}

export function inferActionKindFromSentence(sentence: string): BoundaryActionKind | null {
  const normalized = canonicalizeTrackLiteral(stripTrailingPunctuation(sentence));
  if (!passesTrackMeaningGate(normalized, "action")) {
    return null;
  }
  for (const alias of ACTION_KIND_ALIASES) {
    if (alias.pattern.test(normalized)) {
      return alias.actionKind;
    }
  }
  if (/\bwrite\b/i.test(normalized)) return "fs.write";
  if (/\bread\b/i.test(normalized)) return "fs.read";
  if (/\bappend\b/i.test(normalized)) return "fs.append";
  if (/\bdelete\b/i.test(normalized)) return "fs.delete";
  if (/\bmove\b|\brename\b/i.test(normalized)) return "fs.move";
  if (/\bmkdir\b|\bmake dir\b/i.test(normalized)) return "fs.mkdir";
  if (/\bquery\b/i.test(normalized)) return "db.query";
  if (/\bexecute\b|\brun\b|\bcommand\b/i.test(normalized)) return "tool.exec";
  if (/\bnetwork\b|\brequest\b|\bhttp\b/i.test(normalized)) return "network.send";
  if (/\brecipient\b|\bemail\b|\bmessage\b/i.test(normalized)) return "comm.send";
  return null;
}

export function inferTargetFromSentence(sentence: string): string | null {
  const quoted = sentence.match(/["']([^"']+)["']/);
  if (quoted?.[1]) {
    const target = canonicalizeTrackLiteral(quoted[1]);
    return passesTrackMeaningGate(target, "action") ? target : null;
  }
  const fsPath = sentence.match(/((?:\/|\.\/|\.\.\/)[^\s,;]+)/);
  if (fsPath?.[1]) {
    return canonicalizeTrackLiteral(stripTrailingPunctuation(fsPath[1]));
  }
  const domainTarget = sentence.match(
    /\b(?:to|within|inside|on)\s+([a-z0-9._:-]+\.[a-z]{2,}(?:\/[^\s,;]+)?)/i,
  );
  if (domainTarget?.[1]) {
    return canonicalizeTrackLiteral(stripTrailingPunctuation(domainTarget[1]));
  }
  return null;
}

export function inferTargetPattern(
  actionKind: BoundaryActionKind,
  rawTarget: string | undefined,
): {
  target: string;
  targetPattern?: string;
  targetMatchMode?: BoundaryUplTrackConstraint["targetMatchMode"];
} {
  const normalizedTarget = rawTarget ? canonicalizeStructuredTarget(rawTarget) : undefined;
  const target = normalizedTarget || (actionKind === "chat.emit" ? CHAT_TARGET : "unspecified");
  if (actionKind === "chat.emit") {
    return { target: CHAT_TARGET };
  }
  if (actionKind.startsWith("fs.")) {
    const cleaned = target;
    const parentDir = path.dirname(cleaned);
    return {
      target: cleaned,
      targetPattern: parentDir === "." ? cleaned : parentDir,
      targetMatchMode: "prefix",
    };
  }
  if (actionKind === "tool.exec") {
    return {
      target,
      targetPattern: basename(target.split(/\s+/)[0] ?? target),
      targetMatchMode: "exact",
    };
  }
  if (
    actionKind === "network.send" ||
    actionKind === "comm.send" ||
    actionKind.startsWith("db.") ||
    actionKind.startsWith("sys.")
  ) {
    return {
      target,
      targetPattern: target,
      targetMatchMode: "exact",
    };
  }
  const isPathLike =
    target.startsWith("/") ||
    target.startsWith("./") ||
    target.startsWith("../") ||
    target.includes(pathSep);
  return {
    target,
    ...(isPathLike
      ? { targetPattern: target, targetMatchMode: "prefix" as const }
      : { targetPattern: target, targetMatchMode: "exact" as const }),
  };
}

function canonicalizeStructuredTarget(rawTarget: string): string | undefined {
  const target = canonicalizeTrackLiteral(rawTarget);
  if (!target) {
    return undefined;
  }
  if (
    target.startsWith("/") ||
    target.startsWith("./") ||
    target.startsWith("../") ||
    target.includes(pathSep) ||
    /^[a-z0-9._:-]+\.[a-z]{2,}(?:\/.*)?$/i.test(target)
  ) {
    return target;
  }
  return passesTrackMeaningGate(target, "action") ? target : undefined;
}

export function inferReviewSurface(
  actionKind: BoundaryActionKind,
): BoundaryReviewContext["surface"] {
  return actionKind === "chat.emit" ? "chat" : "action";
}

export function collapseActionTrackMeaning(args: {
  actionKind: BoundaryActionKind;
  rawTarget?: string;
}): ActionTrackMeaning {
  const { target, targetPattern, targetMatchMode } = inferTargetPattern(
    args.actionKind,
    args.rawTarget,
  );
  const reviewSurface = inferReviewSurface(args.actionKind);
  const corridor =
    args.actionKind === "chat.emit" || target === "unspecified"
      ? undefined
      : {
          allowedActionKinds: [args.actionKind],
          ...(targetPattern ? { targetPattern } : {}),
          ...(targetMatchMode ? { targetMatchMode } : {}),
          reviewSurface,
        };
  return {
    corridor,
    actionKind: args.actionKind,
    target,
    targetPattern,
    targetMatchMode,
  };
}
