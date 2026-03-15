import type { CodingIntentSpec } from "@/lib/lml/coding-intent-spec";
import type { CodingSkeletonContract } from "@/lib/lml/coding-skeleton-laws";

export const CODING_GROUNDING_LAWS = [
  "ABILITY.CODING.122: External library usage must be grounded to a verified framework surface before emission.",
  "ABILITY.CODING.123: Hallucinated framework or library symbols must collapse to NULL before coding emission.",
  "ABILITY.CODING.124: Coding family surfaces must bind to verified library calls, constructors, and harnesses rather than guessed names.",
  "ABILITY.CODING.128: Framework and library surfaces must stay version-coherent; cross-version API mixing is inadmissible before emission.",
] as const;

export type CodingGroundingValidation = {
  ok: boolean;
  reason: string;
  passed: string[];
  failed: string[];
};

export function validateCodingGrounding(args: {
  contract: CodingSkeletonContract;
  intentSpec: CodingIntentSpec;
  text: string;
}): CodingGroundingValidation {
  const lower = args.text.toLowerCase();
  const passed: string[] = [];
  const failed: string[] = [];
  const reqLines = extractRequirementLines(lower);

  if (args.contract.family === "api" || args.contract.family === "app" || args.contract.family === "auth") {
    if (/\bfastapi\b/.test(lower)) {
      const validFastApiSurface =
        /\bfrom fastapi import fastapi\b/.test(lower) ||
        /\bfrom fastapi import apirouter\b/.test(lower) ||
        /\bfrom fastapi import httpexception\b/.test(lower) ||
        /\bfrom fastapi\.testclient import testclient\b/.test(lower);
      if (!validFastApiSurface) failed.push("G3.1_FASTAPI_IMPORT_SURFACE");
      else passed.push("G3.1_FASTAPI_IMPORT_SURFACE");

      if (/\bfastapiclient\(/.test(lower) || /\bapp\.routez\(/.test(lower) || /\bfastapi\.route\(/.test(lower)) {
        failed.push("G3.2_FASTAPI_HALLUCINATED_SYMBOL");
      } else {
        passed.push("G3.2_FASTAPI_HALLUCINATED_SYMBOL");
      }

      const fastapiVersion = findPinnedMajor(reqLines, "fastapi");
      const pydanticVersion = findPinnedMajor(reqLines, "pydantic");
      const usesModelDump = /\.model_dump\(/.test(lower);
      const usesDict = /\.dict\(/.test(lower);
      if ((fastapiVersion === 0 || fastapiVersion === 1) && pydanticVersion === 1 && usesModelDump) {
        failed.push("G3.8_FASTAPI_PYDANTIC_VERSION_SURFACE");
      } else if (((fastapiVersion !== null && fastapiVersion >= 0) || pydanticVersion === 2) && usesDict && /class \w+\(basemodel\):/.test(lower)) {
        failed.push("G3.8_FASTAPI_PYDANTIC_VERSION_SURFACE");
      } else {
        passed.push("G3.8_FASTAPI_PYDANTIC_VERSION_SURFACE");
      }
    }
  }

  if (args.contract.family === "orm") {
    const hasSqlalchemy = /\bsqlalchemy\b/.test(lower);
    if (hasSqlalchemy) {
      const validSqlalchemySurface =
        /\bfrom sqlalchemy import select\b/.test(lower) ||
        /\bfrom sqlalchemy.orm import declarativebase\b/.test(lower) ||
        /\bmapped_column\b/.test(lower) ||
        /\bsession\b/.test(lower);
      if (!validSqlalchemySurface) failed.push("G3.3_SQLALCHEMY_IMPORT_SURFACE");
      else passed.push("G3.3_SQLALCHEMY_IMPORT_SURFACE");

      if (/\bsession\.persist\(/.test(lower) || /\bselect_one\(/.test(lower) || /\bmappedfield\(/.test(lower)) {
        failed.push("G3.4_SQLALCHEMY_HALLUCINATED_SYMBOL");
      } else {
        passed.push("G3.4_SQLALCHEMY_HALLUCINATED_SYMBOL");
      }

      const sqlalchemyVersion = findPinnedMajor(reqLines, "sqlalchemy");
      const usesDeclarativeBase = /\bclass base\(declarativebase\):|\bfrom sqlalchemy\.orm import declarativebase\b/.test(lower);
      const usesLegacyBase = /\bdeclarative_base\(/.test(lower);
      if ((sqlalchemyVersion === 1 && usesDeclarativeBase) || (sqlalchemyVersion !== null && sqlalchemyVersion >= 2 && usesLegacyBase)) {
        failed.push("G3.9_SQLALCHEMY_VERSION_SURFACE");
      } else {
        passed.push("G3.9_SQLALCHEMY_VERSION_SURFACE");
      }
    }
  }

  if (args.contract.family === "game") {
    const hasPygame = /\bpygame\b/.test(lower);
    if (hasPygame) {
      const validPygameSurface =
        /\bpygame\.init\(/.test(lower) ||
        /\bpygame\.quit\(/.test(lower) ||
        /\bpygame\.display\.set_mode\(/.test(lower) ||
        /\bpygame\.time\.clock\(/.test(lower) ||
        /\bpygame\.event\.get\(/.test(lower);
      if (!validPygameSurface) failed.push("G3.5_PYGAME_IMPORT_SURFACE");
      else passed.push("G3.5_PYGAME_IMPORT_SURFACE");

      if (/\bpygame\.render_frame\(/.test(lower) || /\bpygame\.tickrate\(/.test(lower)) {
        failed.push("G3.6_PYGAME_HALLUCINATED_SYMBOL");
      } else {
        passed.push("G3.6_PYGAME_HALLUCINATED_SYMBOL");
      }
    }
  }

  if (args.contract.family === "parser" || args.contract.family === "compiler") {
    passed.push("G3.7_LOCAL_SURFACE_ONLY");
  }

  return {
    ok: failed.length === 0,
    reason: failed.length === 0 ? "ok" : `grounding_failed:${failed[0]}`,
    passed,
    failed,
  };
}

function extractRequirementLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[a-z0-9_.-]+(==|>=|<=|~=)[a-z0-9_.-]+$/.test(line));
}

function findPinnedMajor(requirements: string[], name: string): number | null {
  const line = requirements.find((entry) => entry.startsWith(`${name}==`) || entry.startsWith(`${name}>=`) || entry.startsWith(`${name}~=`));
  if (!line) return null;
  const version = line.split(/[<>=~]/).filter(Boolean)[1] ?? "";
  const major = Number(version.split(".")[0]);
  return Number.isFinite(major) ? major : null;
}
