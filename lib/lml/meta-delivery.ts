import { appendMetaDeliveryLedger, appendMetaDeliveryPlanetRootLaw } from "../meta/index.ts";

export type PendingLawProposal = {
  text: string;
  scope: string;
  enforcement: string;
  source: string;
};

export function uniquePendingProposals<T extends PendingLawProposal>(items: T[]): T[] {
  const byKey = new Map<string, T>();
  for (const item of items) {
    byKey.set(`${item.text.toLowerCase()}|${item.scope}|${item.enforcement}|${item.source}`, item);
  }
  return Array.from(byKey.values());
}

export function isCriticalMetaProposal(proposal: PendingLawProposal): boolean {
  const lower = `${proposal.enforcement} ${proposal.source} ${proposal.text}`.toLowerCase();
  if (proposal.source === "meta_projection_loop") {
    return true;
  }
  if (proposal.source === "ai_model_planet_hardening") {
    return true;
  }
  if (/\b(meta_hardening|system_integrity|life_preservation)\b/.test(lower)) {
    return true;
  }
  return /\b(preserve life|life-preservation|life preservation|root lock|parent lock|parity|ledger|fail closed|fail-closed|nocr|nsl|system integrity|collapse clipped|null)\b/.test(lower);
}

export function proposalKey(proposal: PendingLawProposal): string {
  return `${proposal.text.toLowerCase()}|${proposal.scope}|${proposal.enforcement}|${proposal.source}`;
}

export async function appendMetaDeliveryRecords(
  sessionId: string,
  runId: string,
  proposals: PendingLawProposal[],
  autoApplySources: string[],
): Promise<void> {
  for (const proposal of proposals) {
    const critical = isCriticalMetaProposal(proposal);
    const queued = await appendMetaDeliveryLedger("DELIVERY_QUEUED", {
      sessionId,
      runId,
      source: proposal.source,
      text: proposal.text,
      scope: proposal.scope,
      enforcement: proposal.enforcement,
      critical,
      createdAt: new Date().toISOString(),
    });
    await appendMetaDeliveryPlanetRootLaw(queued);
    if (critical || autoApplySources.includes(proposal.source)) {
      const activated = await appendMetaDeliveryLedger("DELIVERY_ACTIVATED", {
        sessionId,
        runId,
        source: proposal.source,
        text: proposal.text,
        scope: proposal.scope,
        enforcement: proposal.enforcement,
        critical,
        createdAt: new Date().toISOString(),
      });
      await appendMetaDeliveryPlanetRootLaw(activated);
    }
  }
}
