"use client";

import { FormEvent, useEffect, useState } from "react";

type ClientEvent = {
  id: string;
  stage: string;
  status: string;
  note: string;
  eta: string | null;
  createdAt: string;
};

type CaseTimeline = {
  id: string;
  title: string;
  currentStage: string;
  currentStatus: string;
  nextStep: string;
  eta: string | null;
  updatedAt: string;
  timeline: ClientEvent[];
};

export default function ClientCasePage({ params }: { params: Promise<{ caseId: string }> }) {
  const [caseId, setCaseId] = useState("");
  const [clientId, setClientId] = useState("client-demo-1");
  const [item, setItem] = useState<CaseTimeline | null>(null);
  const [question, setQuestion] = useState("");
  const [autoAck, setAutoAck] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    params.then((value) => setCaseId(value.caseId)).catch(() => setError("Invalid case id."));
  }, [params]);

  async function loadTimeline(activeCaseId: string, activeClientId: string) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/product/client/cases/${activeCaseId}/timeline`, {
        headers: {
          "x-role": "client",
          "x-user-id": activeClientId,
          "x-case-id": activeCaseId,
        },
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to load case timeline.");
      }

      const payload = (await response.json()) as { item: CaseTimeline };
      setItem(payload.item);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load timeline.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!caseId) {
      return;
    }
    void loadTimeline(caseId, clientId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  async function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!caseId || !question.trim()) {
      return;
    }

    setError(null);
    setAutoAck(null);
    try {
      const response = await fetch(`/api/product/client/cases/${caseId}/questions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-role": "client",
          "x-user-id": clientId,
          "x-case-id": caseId,
        },
        body: JSON.stringify({ text: question }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to submit question.");
      }

      const payload = (await response.json()) as { autoAck: string };
      setQuestion("");
      setAutoAck(payload.autoAck);
      await loadTimeline(caseId, clientId);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to submit question.");
    }
  }

  return (
    <main>
      <header className="hero">
        <div className="watermark">Product - Client GPS Portal</div>
        <h1>Case GPS Timeline</h1>
        <p>Read-only case motion and lawyer-authored updates. No AI legal advice channel.</p>
      </header>

      <section className="card">
        <strong>Access</strong>
        <div className="controls">
          <input value={clientId} onChange={(event) => setClientId(event.target.value)} placeholder="Client ID" />
          <button type="button" onClick={() => void loadTimeline(caseId, clientId)} disabled={!caseId || loading}>
            Refresh
          </button>
        </div>
        {error ? <div className="danger">{error}</div> : null}
      </section>

      <section className="card">
        <strong>Current Status</strong>
        {loading ? <div className="meta">Loading...</div> : null}
        {item ? (
          <div className="list">
            <div className="item">
              <strong>{item.title}</strong>
              <div className="meta">stage={item.currentStage} status={item.currentStatus}</div>
              <div>next step: {item.nextStep}</div>
              <div className="meta">eta: {item.eta ?? "not set"}</div>
              <div className="meta">last update: {item.updatedAt}</div>
            </div>
          </div>
        ) : (
          <div className="meta">No case loaded.</div>
        )}
      </section>

      <section className="card">
        <strong>Timeline</strong>
        <div className="list">
          {(item?.timeline ?? []).map((entry) => (
            <div key={entry.id} className="item">
              <div>
                <strong>{entry.stage}</strong> · {entry.status}
              </div>
              <div>{entry.note}</div>
              <div className="meta">eta: {entry.eta ?? "none"}</div>
              <div className="meta">{entry.createdAt}</div>
            </div>
          ))}
          {(item?.timeline ?? []).length === 0 ? <div className="meta">No timeline entries yet.</div> : null}
        </div>
      </section>

      <section className="card">
        <strong>Ask a Question</strong>
        <form className="controls one-col" onSubmit={submitQuestion}>
          <textarea rows={4} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Submit your case question." />
          <button type="submit" disabled={!question.trim()}>Submit Question</button>
        </form>
        {autoAck ? <div className="meta">Auto-response: {autoAck}</div> : null}
      </section>
    </main>
  );
}
