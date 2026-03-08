"use client";

import { useEffect, useState } from "react";

type FlowItem = {
  id: string;
  caseId: string;
  caseTitle: string;
  stage: string;
  status: string;
  note: string;
  ownerId: string;
  dueAt: string | null;
  signature: {
    timeBand: string;
    obligationBand: string;
    riskBand: string;
    objectType: string;
  };
  requiresHardGate: boolean;
  hardGateReason: string | null;
  followUpRequired: boolean;
  followUpAt: string | null;
  reminderDue: boolean;
};

type FlowResponse = {
  totalItems: number;
  focusCap: number;
  focus: FlowItem[];
  lanes: {
    now: FlowItem[];
    this_week: FlowItem[];
    waiting: FlowItem[];
    someday: FlowItem[];
    completed: FlowItem[];
    audit: FlowItem[];
  };
};

const DEMO_LAWYER_ID = "lawyer-demo-1";

export default function LawyerFlowPage() {
  const [data, setData] = useState<FlowResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadFlow() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/product/lawyer/flow", {
        headers: {
          "x-role": "lawyer",
          "x-user-id": DEMO_LAWYER_ID,
        },
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to load hallway flow.");
      }

      const payload = (await response.json()) as FlowResponse;
      setData(payload);
    } catch (flowError) {
      setError(flowError instanceof Error ? flowError.message : "Failed to load flow board.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadFlow();
  }, []);

  const lanes = data?.lanes;

  return (
    <main>
      <header className="hero">
        <div className="watermark">Product - Hallway Flow</div>
        <h1>Throughput Control Surface</h1>
        <p>Throughput layer: Time (A) x Obligation (B) x Risk (C), with hard gate alerts on C1/C2.</p>
      </header>

      <section className="card">
        <strong>Now Queue (Focus)</strong>
        <div className="meta">Visible priority cap: {data?.focusCap ?? 7}</div>
        {loading ? <div className="meta">Loading...</div> : null}
        {error ? <div className="danger">{error}</div> : null}
        <div className="list">
          {(data?.focus ?? []).map((item) => (
            <FlowCard key={item.id} item={item} />
          ))}
          {(data?.focus ?? []).length === 0 ? <div className="item">No items in now queue.</div> : null}
        </div>
      </section>

      <section className="card">
        <strong>Lane Separation</strong>
        <div className="laneGrid">
          <Lane title="Now" items={lanes?.now ?? []} />
          <Lane title="This Week" items={lanes?.this_week ?? []} />
          <Lane title="Waiting" items={lanes?.waiting ?? []} />
          <Lane title="Someday" items={lanes?.someday ?? []} />
          <Lane title="Completed" items={lanes?.completed ?? []} />
          <Lane title="Audit" items={lanes?.audit ?? []} />
        </div>
      </section>
    </main>
  );
}

function Lane({ title, items }: { title: string; items: FlowItem[] }) {
  return (
    <div className="laneCard">
      <strong>{title}</strong>
      <div className="meta">{items.length} items</div>
      <div className="laneList">
        {items.slice(0, 8).map((item) => (
          <FlowCard key={item.id} item={item} compact />
        ))}
        {items.length === 0 ? <div className="meta">none</div> : null}
      </div>
    </div>
  );
}

function FlowCard({ item, compact = false }: { item: FlowItem; compact?: boolean }) {
  return (
    <div className="item flowItem">
      <div>
        <strong>{item.caseTitle}</strong>
        <span className="tag">{item.signature.timeBand}</span>
        <span className="tag">{item.signature.obligationBand}</span>
        <span className="tag">{item.signature.riskBand}</span>
      </div>
      {!compact ? <div>{item.note}</div> : null}
      <div className="meta">
        stage={item.stage} owner={item.ownerId} due={item.dueAt ?? "n/a"}
      </div>
      {item.followUpAt ? <div className="meta">expected follow-up: {item.followUpAt}</div> : null}
      {item.requiresHardGate ? <div className="danger">hard gate: {item.hardGateReason}</div> : null}
      {item.followUpRequired ? <div className="danger">waiting lane missing expected date/follow-up target</div> : null}
      {item.reminderDue ? <div className="danger">follow-up reminder due now</div> : null}
    </div>
  );
}
