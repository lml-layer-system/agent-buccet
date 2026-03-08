"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type TimelineStatus = "waiting" | "in_progress" | "delayed" | "complete";

type ProductCase = {
  id: string;
  title: string;
  clientName: string;
  currentStage: string;
  currentStatus: TimelineStatus;
  nextStep: string;
  eta: string | null;
  updatedAt: string;
};

type LawyerQuestion = {
  id: string;
  caseId: string;
  caseTitle: string;
  clientName: string;
  text: string;
  autoAck: string;
  lawyerReply: string | null;
  createdAt: string;
};

const DEMO_LAWYER_ID = "lawyer-demo-1";

export default function LawyerPortalPage() {
  const [cases, setCases] = useState<ProductCase[]>([]);
  const [questions, setQuestions] = useState<LawyerQuestion[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newCaseTitle, setNewCaseTitle] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [newClientId, setNewClientId] = useState("");

  const [stage, setStage] = useState("discovery");
  const [status, setStatus] = useState<TimelineStatus>("in_progress");
  const [note, setNote] = useState("");
  const [eta, setEta] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [visibility, setVisibility] = useState<"client" | "private">("client");
  const [dueAt, setDueAt] = useState("");
  const [obligationBand, setObligationBand] = useState<"B1" | "B2" | "B3" | "B4" | "B5" | "B6" | "B7">("B4");
  const [riskBand, setRiskBand] = useState<"C1" | "C2" | "C3" | "C4" | "C5" | "C6" | "C7">("C6");
  const [objectType, setObjectType] = useState<"action" | "waiting" | "document" | "deadline" | "message" | "gate">("action");
  const [artifactRefsRaw, setArtifactRefsRaw] = useState("");
  const [artifactName, setArtifactName] = useState("");
  const [artifactContent, setArtifactContent] = useState("");

  const selectedCase = useMemo(() => cases.find((entry) => entry.id === selectedCaseId) ?? null, [cases, selectedCaseId]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const headers = {
        "x-role": "lawyer",
        "x-user-id": DEMO_LAWYER_ID,
      };

      const [caseResponse, messageResponse] = await Promise.all([
        fetch("/api/product/lawyer/cases", { headers }),
        fetch("/api/product/lawyer/messages", { headers }),
      ]);

      if (!caseResponse.ok) {
        throw new Error("Failed to load cases.");
      }

      if (!messageResponse.ok) {
        throw new Error("Failed to load messages.");
      }

      const casePayload = (await caseResponse.json()) as { items: ProductCase[] };
      const messagePayload = (await messageResponse.json()) as { items: LawyerQuestion[] };

      setCases(casePayload.items);
      setQuestions(messagePayload.items);
      if (!selectedCaseId && casePayload.items.length > 0) {
        setSelectedCaseId(casePayload.items[0].id);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load lawyer portal data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      const response = await fetch("/api/product/lawyer/cases", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-role": "lawyer",
          "x-user-id": DEMO_LAWYER_ID,
        },
        body: JSON.stringify({
          title: newCaseTitle,
          firmId: "firm-demo-1",
          clientId: newClientId,
          clientName: newClientName,
          assignedLawyerId: DEMO_LAWYER_ID,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to create case.");
      }

      setNewCaseTitle("");
      setNewClientName("");
      setNewClientId("");
      await loadData();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create case.");
    }
  }

  async function submitTimelineUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCaseId) {
      return;
    }

    setError(null);
    try {
      const response = await fetch(`/api/product/lawyer/cases/${selectedCaseId}/updates`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-role": "lawyer",
          "x-user-id": DEMO_LAWYER_ID,
        },
        body: JSON.stringify({
          stage,
          status,
          note,
          eta: eta || null,
          dueAt: dueAt || null,
          nextStep,
          visibility,
          obligationBand,
          riskBand,
          objectType,
          artifactRefs: artifactRefsRaw
            .split(",")
            .map((entry) => entry.trim())
            .filter(Boolean),
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to update case.");
      }

      setNote("");
      setEta("");
      setDueAt("");
      setNextStep("");
      setArtifactRefsRaw("");
      await loadData();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to apply update.");
    }
  }

  async function uploadArtifact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCaseId || !artifactName || !artifactContent) {
      return;
    }

    setError(null);
    try {
      const contentBase64 = btoa(artifactContent);
      const response = await fetch(`/api/product/lawyer/cases/${selectedCaseId}/artifacts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-role": "lawyer",
          "x-user-id": DEMO_LAWYER_ID,
        },
        body: JSON.stringify({
          fileName: artifactName,
          contentType: "text/plain",
          contentBase64,
          visibility,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to attach artifact.");
      }

      setArtifactName("");
      setArtifactContent("");
    } catch (artifactError) {
      setError(artifactError instanceof Error ? artifactError.message : "Failed to attach artifact.");
    }
  }

  return (
    <main>
      <header className="hero">
        <div className="watermark">Product - Lawyer Portal</div>
        <h1>Case Control Plane</h1>
        <p>Lawyer-authored timeline updates only. No AI-generated legal advice. All actions are role-gated.</p>
        <p>
          <Link href="/product/lawyer/flow">Open Hallway Flow Board</Link>
        </p>
      </header>

      <section className="card">
        <strong>Cases</strong>
        {loading ? <div className="meta">Loading...</div> : null}
        {error ? <div className="danger">{error}</div> : null}
        <div className="list">
          {cases.map((entry) => (
            <button key={entry.id} className="item" type="button" onClick={() => setSelectedCaseId(entry.id)}>
              <div>
                <strong>{entry.title}</strong> · {entry.clientName}
              </div>
              <div className="meta">
                stage={entry.currentStage} status={entry.currentStatus} next={entry.nextStep}
              </div>
            </button>
          ))}
          {cases.length === 0 ? <div className="meta">No cases yet.</div> : null}
        </div>
      </section>

      <section className="card">
        <strong>Create Case</strong>
        <form className="controls one-col" onSubmit={createCase}>
          <input value={newCaseTitle} onChange={(event) => setNewCaseTitle(event.target.value)} placeholder="Case title" required />
          <input value={newClientName} onChange={(event) => setNewClientName(event.target.value)} placeholder="Client name" required />
          <input value={newClientId} onChange={(event) => setNewClientId(event.target.value)} placeholder="Client ID (used for client login header)" required />
          <button type="submit">Create Case</button>
        </form>
      </section>

      <section className="card">
        <strong>Timeline Update</strong>
        <div className="meta">Selected case: {selectedCase?.title ?? "none"}</div>
        <form className="controls one-col" onSubmit={submitTimelineUpdate}>
          <input value={stage} onChange={(event) => setStage(event.target.value)} placeholder="Stage" required />
          <select value={status} onChange={(event) => setStatus(event.target.value as TimelineStatus)}>
            <option value="waiting">waiting</option>
            <option value="in_progress">in_progress</option>
            <option value="delayed">delayed</option>
            <option value="complete">complete</option>
          </select>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Short lawyer-authored update note" rows={4} required />
          <input value={eta} onChange={(event) => setEta(event.target.value)} placeholder="ETA (optional)" />
          <input value={nextStep} onChange={(event) => setNextStep(event.target.value)} placeholder="Next step" />
          <input value={dueAt} onChange={(event) => setDueAt(event.target.value)} placeholder="Due at (ISO or date string)" />
          <select value={obligationBand} onChange={(event) => setObligationBand(event.target.value as typeof obligationBand)}>
            <option value="B1">B1 Court-Owed</option>
            <option value="B2">B2 Client-Owed</option>
            <option value="B3">B3 Opposing-Owed</option>
            <option value="B4">B4 Internal-Owed</option>
            <option value="B5">B5 Promised</option>
            <option value="B6">B6 Optional</option>
            <option value="B7">B7 Unknown</option>
          </select>
          <select value={riskBand} onChange={(event) => setRiskBand(event.target.value as typeof riskBand)}>
            <option value="C1">C1 Sanction/default risk</option>
            <option value="C2">C2 Malpractice risk</option>
            <option value="C3">C3 Rights forfeiture risk</option>
            <option value="C4">C4 Financial risk</option>
            <option value="C5">C5 Reputation risk</option>
            <option value="C6">C6 Delay risk</option>
            <option value="C7">C7 Noise</option>
          </select>
          <select value={objectType} onChange={(event) => setObjectType(event.target.value as typeof objectType)}>
            <option value="action">action</option>
            <option value="waiting">waiting</option>
            <option value="document">document</option>
            <option value="deadline">deadline</option>
            <option value="message">message</option>
            <option value="gate">gate</option>
          </select>
          <input
            value={artifactRefsRaw}
            onChange={(event) => setArtifactRefsRaw(event.target.value)}
            placeholder="Artifact refs (comma-separated, required for C1/C2 completion)"
          />
          <select value={visibility} onChange={(event) => setVisibility(event.target.value as "client" | "private") }>
            <option value="client">client-visible</option>
            <option value="private">lawyer-private</option>
          </select>
          <button type="submit" disabled={!selectedCaseId}>Apply Update</button>
        </form>
      </section>

      <section className="card">
        <strong>Attach Proof Artifact (Immutable Ref)</strong>
        <div className="meta">Use this to attach evidence/proof references that can be linked in timeline updates.</div>
        <form className="controls one-col" onSubmit={uploadArtifact}>
          <input value={artifactName} onChange={(event) => setArtifactName(event.target.value)} placeholder="Artifact filename" required />
          <textarea
            rows={4}
            value={artifactContent}
            onChange={(event) => setArtifactContent(event.target.value)}
            placeholder="Artifact content (demo text payload)"
            required
          />
          <button type="submit" disabled={!selectedCaseId}>Attach Artifact</button>
        </form>
      </section>

      <section className="card">
        <strong>Client Questions Inbox</strong>
        <div className="list">
          {questions.map((question) => (
            <div key={question.id} className="item">
              <div>
                <strong>{question.clientName}</strong> · {question.caseTitle}
              </div>
              <div>{question.text}</div>
              <div className="meta">auto-ack: {question.autoAck}</div>
              <div className="meta">reply: {question.lawyerReply ?? "pending"}</div>
            </div>
          ))}
          {questions.length === 0 ? <div className="meta">No questions yet.</div> : null}
        </div>
      </section>
    </main>
  );
}
