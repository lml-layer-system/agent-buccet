import { materializeCodingBodySlots } from "@/lib/lml/coding-body-fill";
import type { DirectCodingEmitterCandidate } from "@/lib/lml/coding-family-emitters";

export async function materializeDirectCodingCandidate(candidate: DirectCodingEmitterCandidate): Promise<{
  text: string;
  usedGenerator: number;
  usedFallback: number;
}> {
  if (!candidate.slots.length) {
    return {
      text: candidate.text,
      usedGenerator: 0,
      usedFallback: 0,
    };
  }
  return materializeCodingBodySlots({
    text: candidate.text,
    slots: candidate.slots,
  });
}
