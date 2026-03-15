import { CODING_ORACLE_FAMILIES } from "./graphs.ts";
import { CODING_ORACLE_HOSTILE_PACKS } from "./hostile.ts";
import { HOSTILE_APP_TASK_PACKS, LAWFUL_APP_TASK_PACKS, type HostileAppTaskPack, type LawfulAppTaskPack } from "./app-task-pack.ts";
import { BENCHMARK_TASK_PACKS, type BenchmarkTaskPack } from "./benchmark-task-pack.ts";
import { BENCHMARK_TIER2_TASK_PACKS, type BenchmarkTier2TaskPack } from "./benchmark-tier2-task-pack.ts";
import { REAL_REPO_SUITE_PACKS, type RealRepoSuitePack } from "./real-repo-suite-pack.ts";
import { REAL_REPO_TASK_RECORDS, type RealRepoTaskRecord } from "./real-repo-task-records.ts";
import type { OracleFamily, OracleFamilyDefinition, OracleHostileFamily, OracleHostilePack } from "./types.ts";

export function getCodingOracleFamily(family: OracleFamily): OracleFamilyDefinition {
  return CODING_ORACLE_FAMILIES[family];
}

export function hasCodingOracleFamily(family: string): family is OracleFamily {
  return family in CODING_ORACLE_FAMILIES;
}

export function getCodingOracleHostilePacks(
  family?: OracleHostileFamily,
): OracleHostilePack[] {
  if (!family) {
    return CODING_ORACLE_HOSTILE_PACKS;
  }
  return CODING_ORACLE_HOSTILE_PACKS.filter((pack) => pack.family === family);
}

export function getLawfulAppTaskPacks(): LawfulAppTaskPack[] {
  return LAWFUL_APP_TASK_PACKS;
}

export function getHostileAppTaskPacks(): HostileAppTaskPack[] {
  return HOSTILE_APP_TASK_PACKS;
}

export function getBenchmarkTaskPacks(): BenchmarkTaskPack[] {
  return BENCHMARK_TASK_PACKS;
}

export function getBenchmarkTier2TaskPacks(): BenchmarkTier2TaskPack[] {
  return BENCHMARK_TIER2_TASK_PACKS;
}

export function getRealRepoSuitePacks(): RealRepoSuitePack[] {
  return REAL_REPO_SUITE_PACKS;
}

export function getRealRepoTaskRecords(): RealRepoTaskRecord[] {
  return REAL_REPO_TASK_RECORDS;
}
