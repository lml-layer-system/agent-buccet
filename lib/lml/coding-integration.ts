import type { CodingIntentSpec } from "./coding-intent-spec.ts";
import type { CodingSkeletonContract } from "./coding-skeleton-laws.ts";
import { validateOracleWitnesses } from "./coding-oracle/witnesses.ts";

export const CODING_INTEGRATION_LAWS = [
  "ABILITY.CODING.85: Integration legality must bind family-specific framework surfaces, dependency surfaces, and test harness surfaces before emission.",
  "ABILITY.CODING.86: API/application families require explicit route surface, executable framework surface, and test harness surface; missing any one is an integration failure.",
  "ABILITY.CODING.87: ORM families require one coherent dependency universe; mixed SQL/document-model surfaces are inadmissible.",
  "ABILITY.CODING.88: Game and refactor families require declared dependency surface and executable runtime/import continuity before emission.",
] as const;

export type CodingIntegrationValidation = {
  ok: boolean;
  reason: string;
  passed: string[];
  failed: string[];
};

export function validateCodingIntegration(args: {
  contract: CodingSkeletonContract;
  intentSpec: CodingIntentSpec;
  text: string;
}): CodingIntegrationValidation {
  const oracle = validateOracleWitnesses({
    contract: args.contract,
    text: args.text,
  });
  if (!oracle.ok) {
    const failed: string[] = [];
    const passed = [...oracle.passed];
    const family = args.contract.family;
    for (const reason of oracle.failed) {
      if (/ORACLE\.IMPORT/.test(reason)) {
        if (family === "refactor") failed.push("I2.9_REFACTOR_IMPORT_CONTINUITY:oracle_import_contract");
        else if (family === "compiler") failed.push("I0_SURFACE_BINDING:oracle_import_contract");
        else if (family === "app") failed.push("I2.4_APP_FRAMEWORK_SURFACE:oracle_import_contract");
        else if (family === "orm") failed.push("I2.7_ORM_SINGLE_DEPENDENCY_UNIVERSE:oracle_import_contract");
        else failed.push("I0_SURFACE_BINDING:oracle_import_contract");
      } else if (/ORACLE\.EXPORT/.test(reason)) {
        if (family === "api") failed.push("I2.1_API_FRAMEWORK_SURFACE:oracle_export_surface");
        else if (family === "auth") failed.push("I2.1_API_FRAMEWORK_SURFACE:oracle_export_surface");
        else if (family === "app") failed.push("I2.4_APP_FRAMEWORK_SURFACE:oracle_export_surface");
        else if (family === "orm") failed.push("I2.7_ORM_SINGLE_DEPENDENCY_UNIVERSE:oracle_export_surface");
        else if (family === "compiler") failed.push("I0_SURFACE_BINDING:oracle_export_surface");
        else if (family === "game") failed.push("I2.8_GAME_RUNTIME_DEPENDENCY_SURFACE:oracle_export_surface");
        else if (family === "refactor") failed.push("I2.9_REFACTOR_IMPORT_CONTINUITY:oracle_export_surface");
        else failed.push("I0_SURFACE_BINDING:oracle_export_surface");
      } else if (/ORACLE\.FILESET/.test(reason)) {
        if (family === "api") failed.push("I2.1_API_FRAMEWORK_SURFACE:oracle_required_fileset");
        else if (family === "auth") failed.push("I2.1_API_FRAMEWORK_SURFACE:oracle_required_fileset");
        else if (family === "app") failed.push("I2.4_APP_FRAMEWORK_SURFACE:oracle_required_fileset");
        else if (family === "orm") failed.push("I2.7_ORM_SINGLE_DEPENDENCY_UNIVERSE:oracle_required_fileset");
        else if (family === "game") failed.push("I2.8_GAME_RUNTIME_DEPENDENCY_SURFACE:oracle_required_fileset");
        else if (family === "refactor") failed.push("I2.9_REFACTOR_IMPORT_CONTINUITY:oracle_required_fileset");
        else failed.push("I0_SURFACE_BINDING:oracle_required_fileset");
      }
    }
    const fallback = family === "api" || family === "auth"
      ? "I2.1_API_FRAMEWORK_SURFACE:oracle_surface"
      : family === "app"
        ? "I2.4_APP_FRAMEWORK_SURFACE:oracle_surface"
      : family === "orm"
        ? "I2.7_ORM_SINGLE_DEPENDENCY_UNIVERSE:oracle_surface"
        : family === "game"
          ? "I2.8_GAME_RUNTIME_DEPENDENCY_SURFACE:oracle_surface"
          : family === "refactor"
            ? "I2.9_REFACTOR_IMPORT_CONTINUITY:oracle_surface"
             : "I0_SURFACE_BINDING:oracle_surface";
    return {
      ok: false,
      reason: `integration_failed:${failed[0] ?? fallback}`,
      passed,
      failed: failed.length > 0 ? failed : [fallback],
    };
  }

  const lower = args.text.toLowerCase();
  const passed: string[] = [];
  const failed: string[] = [];

  if (args.contract.family === "api") {
    const hasFrameworkImport = /\bfrom\s+fastapi\s+import\b|\bimport\s+fastapi\b|\bfrom\s+flask\s+import\b|\bimport\s+flask\b/.test(lower);
    const hasAppConstructor = /\bapp\s*=\s*fastapi\(|\bapp\s*=\s*flask\(|\brouter\s*=/.test(lower);
    const hasRouteDecorator = /@app\.(get|post|put|delete|patch)\b|\brouter\.(get|post|put|delete|patch)\b/.test(lower);
    const hasHandler = /def\s+[a-z0-9_]+\([^)]*\)\s*(->\s*[^:]+)?:/.test(lower);

    if (!hasFrameworkImport) failed.push("I2.1_API_FRAMEWORK_SURFACE:no_framework_import");
    else if (!hasAppConstructor) failed.push("I2.1_API_FRAMEWORK_SURFACE:no_app_constructor");
    else passed.push("I2.1_API_FRAMEWORK_SURFACE");

    if (!hasRouteDecorator) failed.push("I2.2_API_ROUTE_SURFACE:no_route_decorator");
    else if (!hasHandler) failed.push("I2.2_API_ROUTE_SURFACE:no_handler");
    else passed.push("I2.2_API_ROUTE_SURFACE");

    if (/\btestclient\b|\bresponse\.status_code\b|\bresponse\.json\(\)/.test(lower)) passed.push("I2.3_API_TEST_HARNESS");
    else failed.push("I2.3_API_TEST_HARNESS:no_test_harness");
  }

  if (args.contract.family === "app") {
    const hasAppRouterSurface =
      /['"]use client['"]|['"]use server['"]/.test(lower)
      || /\bexport\s+default\s+async\s+function\s+page\b/.test(lower)
      || /\bexport\s+default\s+function\s+items?page\b/.test(lower)
      || /\bfrom\s+['"]next\//.test(lower)
      || /\brevalidatepath\(/.test(lower)
      || /\bgeneratemetadata\s*\(/.test(lower);
    if (hasAppRouterSurface) passed.push("I2.4_APP_FRAMEWORK_SURFACE");
    else failed.push("I2.4_APP_FRAMEWORK_SURFACE");

    if (/@testing-library\/react|\bexpect\(screen\.getbyrole\b|\btest\(|\bit\(|\brendertostaticmarkup\b|\bres\.status\b|\bgeneratemetadata\s*\(/.test(lower)) passed.push("I2.5_APP_TEST_SURFACE");
    else failed.push("I2.5_APP_TEST_SURFACE");

    if (/from\s+['"][^'"]*services\/|from\s+['"][^'"]*components\/|revalidatepath\(|getsession\(|getitemspage\(|parsepageparam\(|getpostbyslug\(|handlestripeevent\(|\.map\(\s*\(\w+\)\s*=>/.test(lower)) passed.push("I2.6_APP_SERVICE_BINDING");
    else failed.push("I2.6_APP_SERVICE_BINDING");
  }

  if (args.contract.family === "orm") {
    const sqlalchemyImport = /\bfrom\s+sqlalchemy\b|\bimport\s+sqlalchemy\b/.test(lower);
    const sqlalchemyUsage = /declarativebase|mapped_column|session\.add\(|select\(/.test(lower);
    const docModelSurface = /\bmongoose\b|\bschema\b|\bmodel\(/.test(lower);
    if (!sqlalchemyImport) failed.push("I2.7_ORM_SINGLE_DEPENDENCY_UNIVERSE:no_sqlalchemy_import");
    else if (!sqlalchemyUsage) failed.push("I2.7_ORM_SINGLE_DEPENDENCY_UNIVERSE:no_sqlalchemy_usage");
    else if (docModelSurface) failed.push("I2.7_ORM_SINGLE_DEPENDENCY_UNIVERSE:mixed_doc_model_surface");
    else passed.push("I2.7_ORM_SINGLE_DEPENDENCY_UNIVERSE");
  }

  if (args.contract.family === "game") {
    if (/\bpygame\b|\bgodot\b|\bclock\.tick\(|render\(|update\(/.test(lower)) passed.push("I2.8_GAME_RUNTIME_DEPENDENCY_SURFACE");
    else failed.push("I2.8_GAME_RUNTIME_DEPENDENCY_SURFACE");
  }

  if (args.contract.family === "refactor") {
    if (/\bfrom\s+[a-z0-9_.]+\s+import\b/.test(lower)) passed.push("I2.9_REFACTOR_IMPORT_CONTINUITY");
    else failed.push("I2.9_REFACTOR_IMPORT_CONTINUITY");
  }

  return {
    ok: failed.length === 0,
    reason: failed.length === 0 ? "ok" : `integration_failed:${failed[0]}`,
    passed,
    failed,
  };
}
