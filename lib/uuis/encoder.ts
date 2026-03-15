import { runUUIS as runSnapUuis } from "@/lib/snap/uuis";
import type { PrimitiveExtractionRecord } from "@/lib/snap/types";
import type { SnapProfile } from "@/lib/profiles";
import type { UUISObject } from "@/lib/uuis/types";
export { extractRootParentsFromArtifact } from "@/lib/uuis/root-extraction";

export function encodeUuisEnvelope(per: PrimitiveExtractionRecord, profile?: SnapProfile): UUISObject {
  return runSnapUuis(per, profile);
}

export function summarizeUuisEnvelope(uuis: UUISObject): {
  identityKernelCount: number;
  legalityRegionCount: number;
  detectionStackCount: number;
  correctionStackCount: number;
  metaLoopCount: number;
} {
  return {
    identityKernelCount: uuis.block1_identity_kernel.content.length,
    legalityRegionCount: uuis.block2_legality_region.content.length,
    detectionStackCount: uuis.block3_detection_stack.content.length,
    correctionStackCount: uuis.block5_correction_stack.content.length,
    metaLoopCount: uuis.block7_meta_update_loop.content.length,
  };
}
