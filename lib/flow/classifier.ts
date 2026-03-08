import type { ProductCase } from "@/lib/storage/product-types";
import type { FlowItem, FlowLane, TimeBand } from "./types";
import { evaluateRiskGates } from "./risk-gates";

const MS_PER_HOUR = 60 * 60 * 1000;

export function classifyCaseFlow(caseItem: ProductCase, now = new Date()): FlowItem[] {
  return caseItem.timeline.map((event) => {
    const timeBand = classifyTimeBand(event.dueAt, event.status, now);
    const lane = classifyLane(timeBand, event.status);
    const hardGate = evaluateRiskGates({
      riskBand: event.riskBand,
      artifactRefs: event.artifactRefs,
    });

    const followUpAt = event.dueAt ?? null;
    const reminderDue = lane === "waiting" && followUpAt ? new Date(followUpAt).getTime() <= now.getTime() : false;

    return {
      id: event.id,
      caseId: caseItem.id,
      caseTitle: caseItem.title,
      stage: event.stage,
      status: event.status,
      note: event.note,
      ownerId: event.ownerId,
      dueAt: event.dueAt,
      createdAt: event.createdAt,
      signature: {
        timeBand,
        obligationBand: event.obligationBand,
        riskBand: event.riskBand,
        objectType: event.objectType,
      },
      lane,
      requiresHardGate: hardGate.requiresHardGate,
      hardGateReason: hardGate.reason,
      followUpRequired: lane === "waiting" && !event.dueAt,
      followUpAt,
      reminderDue,
    };
  });
}

export function buildHallwayQueues(items: FlowItem[], focusCap = 7) {
  const prioritized = [...items].sort(compareFlowPriority);
  const laneMap: Record<FlowLane, FlowItem[]> = {
    now: [],
    this_week: [],
    waiting: [],
    someday: [],
    completed: [],
    audit: [],
  };

  for (const item of prioritized) {
    laneMap[item.lane].push(item);
  }

  return {
    focusCap,
    focus: laneMap.now.slice(0, focusCap),
    lanes: laneMap,
  };
}

function compareFlowPriority(a: FlowItem, b: FlowItem): number {
  const riskWeight: Record<FlowItem["signature"]["riskBand"], number> = {
    C1: 0,
    C2: 1,
    C3: 2,
    C4: 3,
    C5: 4,
    C6: 5,
    C7: 6,
  };
  const obligationWeight: Record<FlowItem["signature"]["obligationBand"], number> = {
    B1: 0,
    B2: 1,
    B3: 2,
    B4: 3,
    B5: 4,
    B6: 5,
    B7: 6,
  };
  const timeWeight: Record<FlowItem["signature"]["timeBand"], number> = {
    A1: 0,
    A2: 1,
    A3: 2,
    A4: 3,
    A5: 4,
    A7: 5,
    A6: 6,
  };

  return (
    riskWeight[a.signature.riskBand] - riskWeight[b.signature.riskBand] ||
    obligationWeight[a.signature.obligationBand] - obligationWeight[b.signature.obligationBand] ||
    timeWeight[a.signature.timeBand] - timeWeight[b.signature.timeBand] ||
    a.createdAt.localeCompare(b.createdAt)
  );
}

function classifyLane(timeBand: TimeBand, status: FlowItem["status"]): FlowLane {
  if (status === "complete") {
    return "completed";
  }
  if (timeBand === "A7") {
    return "waiting";
  }
  if (timeBand === "A1" || timeBand === "A2" || timeBand === "A3") {
    return "now";
  }
  if (timeBand === "A4" || timeBand === "A5") {
    return "this_week";
  }
  return "someday";
}

function classifyTimeBand(dueAt: string | null, status: FlowItem["status"], now: Date): TimeBand {
  if (status === "waiting") {
    return "A7";
  }
  if (!dueAt) {
    return "A6";
  }

  const target = new Date(dueAt);
  if (Number.isNaN(target.getTime())) {
    return "A6";
  }

  const diffHours = (target.getTime() - now.getTime()) / MS_PER_HOUR;
  if (diffHours <= 2) {
    return "A1";
  }
  if (diffHours <= 24) {
    return "A2";
  }
  if (diffHours <= 48) {
    return "A3";
  }
  if (diffHours <= 24 * 7) {
    return "A4";
  }
  if (diffHours <= 24 * 14) {
    return "A5";
  }
  return "A6";
}
