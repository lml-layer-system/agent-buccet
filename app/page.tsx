"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { extractTextFromPdfBytes } from "@/lib/demo/pdf-text";

const DEFAULT_PROMPT = "What do you want your AI to be?";

type DocArtifact = {
  id: string;
  name: string;
  text: string;
};

type IngestedLaw = {
  law_id: string;
  text: string;
  scope: string;
  enforcement: string;
  source_claim_ids: string[];
};

type SnapRunResponse = {
  runId: string;
  A_PER: { CLAIMS: Array<{ id: string }> };
  B_UUIS: {
    block1_identity_kernel: { content: string[] };
    block2_legality_region: { content: string[] };
    block7_meta_update_loop: { content: string[] };
  };
  C_DELTA: { LML_ADD: IngestedLaw[] };
  D_BLOCKERS: {
    HOLES_BLOCKING_LML: Array<{ id: string }>;
    HOLES_BLOCKING_NSL: Array<{ id: string }>;
  };
};

type ChatTrace = {
  base_laws: string[];
  system_laws?: string[];
  user_laws: string[];
  merged_ontology: string[];
  active_constraints: string[];
  triggered_constraints: string[];
  ability_route: string;
  final_action: "success" | "refusal";
  reason: string;
  triggered_repairs?: string[];
  gate_failed?: string | null;
  failed_predicate?: string | null;
  failed_laws?: string[];
  failure_classes?: string[];
  null_state?: boolean;
  return_moves?: string[];
  null_staircase?: {
    state: "admitted" | "null_emitted";
    witness: {
      gate: string;
      predicate: string;
      violations: string[];
    };
    loop: string[];
  };
  path_orchestrator?: {
    formation_id: string;
    stage_count: number;
    terminated: boolean;
    termination_reason: string;
    stages: Array<{
      stage: string;
      status: string;
      detail: string;
    }>;
  };
};

type ChatOntology = {
  base_law_count?: number;
  base_laws_applied: string[];
  user_laws_applied: string[];
  merged_ontology_state: string[];
};

type ChatContext = {
  sessionId: string;
  step: number;
  wm_focus: string | null;
  l0_size: number;
  l1_size: number;
  dependency_edges: number;
};

type ChatNovelty = {
  noveltyDetected: boolean;
  coverageIncomplete: boolean;
  proposedLawCount: number;
  activatedFromPriorCycle: number;
  ledgerIndex: number | null;
};

type ChatApiResponse = {
  answer: string;
  code: {
    blocks: Array<{
      language: string;
      code: string;
    }>;
    primary: {
      language: string;
      code: string;
    } | null;
  };
  trace: ChatTrace;
  ontology: ChatOntology;
  context: ChatContext;
  novelty: ChatNovelty;
  model: {
    provider: string;
    model: string;
    runId: string;
    callId: string;
    at: string;
    inputDigest: string;
  };
};

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
};

type AutoLaw = {
  text: string;
  scope: string;
  enforcement: string;
  source: string;
};

type CapabilityGraph = {
  compiled_from_laws: number;
  abilities: Record<"coding" | "web_search", {
    state: "allowed" | "blocked" | "unspecified";
    source_law_ids: string[];
    rationale: string[];
  }>;
};

type LmlStateResponse = {
  userLaws?: IngestedLaw[];
  activeAutoLaws?: AutoLaw[];
  pendingLawProposals?: AutoLaw[];
  metaPlanetLaws?: string[];
  activeMetaPlanetLaws?: AutoLaw[];
  capabilityGraph?: CapabilityGraph;
  abilityPlanet?: Record<"coding" | "web_search", string[]>;
  activeAbilityPlanet?: Record<"coding" | "web_search", string[]>;
};

export default function HomePage() {
  const [documents, setDocuments] = useState<DocArtifact[]>([]);
  const [manualLawText, setManualLawText] = useState("");
  const [prompt, setPrompt] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ingestLoading, setIngestLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [ingestError, setIngestError] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<SnapRunResponse | null>(null);
  const [activeUserLaws, setActiveUserLaws] = useState<IngestedLaw[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      text: "System: sun active. User overlay law count: 0.",
    },
  ]);
  const [lastTrace, setLastTrace] = useState<ChatTrace | null>(null);
  const [lastModel, setLastModel] = useState<ChatApiResponse["model"] | null>(null);
  const [lastCode, setLastCode] = useState<ChatApiResponse["code"] | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [ingestRuns, setIngestRuns] = useState(0);
  const [sessionId, setSessionId] = useState("default-session");
  const [activeAutoLaws, setActiveAutoLaws] = useState<AutoLaw[]>([]);
  const [pendingLawProposals, setPendingLawProposals] = useState<AutoLaw[]>([]);
  const [metaPlanetLaws, setMetaPlanetLaws] = useState<string[]>([]);
  const [activeMetaPlanetLaws, setActiveMetaPlanetLaws] = useState<AutoLaw[]>([]);
  const [capabilityGraph, setCapabilityGraph] = useState<CapabilityGraph | null>(null);
  const [abilityPlanet, setAbilityPlanet] = useState<Record<"coding" | "web_search", string[]>>({
    coding: [],
    web_search: [],
  });
  const [activeAbilityPlanet, setActiveAbilityPlanet] = useState<Record<"coding" | "web_search", string[]>>({
    coding: [],
    web_search: [],
  });

  const activeCount = activeUserLaws.length;
  const totalBlockers = (lastRun?.D_BLOCKERS.HOLES_BLOCKING_LML.length ?? 0) + (lastRun?.D_BLOCKERS.HOLES_BLOCKING_NSL.length ?? 0);
  const allDocText = useMemo(() => documents.map((doc) => doc.text).join("\n\n"), [documents]);
  const totalDocChars = useMemo(() => documents.reduce((sum, doc) => sum + doc.text.length, 0), [documents]);
  const lastRunUserLawCount = useMemo(() => {
    if (!lastRun) {
      return 0;
    }
    return lastRun.C_DELTA.LML_ADD.filter((law) => law.source_claim_ids.length > 0 || !isProfileSeedLaw(law.text)).length;
  }, [lastRun]);

  const stageStatus = useMemo(() => {
    const hasArtifact = Boolean(documents.length > 0 || manualLawText.trim());
    if (ingestLoading) {
      return [
        { label: "LML ingesting...", status: "running" as const, detail: "Receiving stacked artifacts and preparing runtime packet." },
        { label: "LML structuring...", status: "blocked" as const, detail: "Pending UIC/UUIS." },
        { label: "LML universe shifting...", status: "blocked" as const, detail: "Pending law synthesis." },
        { label: "LML user laws are active...", status: "blocked" as const, detail: "Pending activation." },
      ];
    }
    if (!lastRun) {
      return [
        { label: "LML ingesting...", status: "blocked" as const, detail: hasArtifact ? "Ready to run ingest." : "No artifact loaded." },
        { label: "LML structuring...", status: "blocked" as const, detail: "No run yet." },
        { label: "LML universe shifting...", status: "blocked" as const, detail: "No run yet." },
        { label: "LML user laws are active...", status: activeCount > 0 ? "pass" as const : "blocked" as const, detail: activeCount > 0 ? "User laws active." : "No user laws active." },
      ];
    }

    const uicPass = lastRun.A_PER.CLAIMS.length > 0;
    const uuisPass = lastRun.B_UUIS.block1_identity_kernel.content.length > 0
      || lastRun.B_UUIS.block2_legality_region.content.length > 0
      || lastRun.B_UUIS.block7_meta_update_loop.content.length > 0;
    const synthesisPass = lastRunUserLawCount > 0;
    const activationPass = activeCount > 0;

    return [
      { label: "LML ingesting...", status: "pass" as const, detail: `Run ${lastRun.runId} recorded.` },
      { label: "LML structuring...", status: uicPass && uuisPass ? "pass" as const : "blocked" as const, detail: `UIC claims=${lastRun.A_PER.CLAIMS.length}; UUIS=${uuisPass ? "ok" : "missing"}.` },
      { label: "LML universe shifting...", status: synthesisPass ? "pass" as const : "blocked" as const, detail: `${lastRunUserLawCount} user law(s) synthesized.` },
      { label: "LML user laws are active...", status: activationPass ? "pass" as const : "blocked" as const, detail: activationPass ? `${activeCount} law(s) active in session.` : "No active user laws." },
    ];
  }, [activeCount, documents.length, ingestLoading, lastRun, lastRunUserLawCount, manualLawText]);

  const pipelineState = useMemo<"red" | "amber" | "green">(() => {
    if (ingestLoading || chatLoading) {
      return "amber";
    }
    if (!lastRun || activeCount === 0) {
      return "red";
    }
    const uicPass = lastRun.A_PER.CLAIMS.length > 0;
    const uuisPass = lastRun.B_UUIS.block1_identity_kernel.content.length > 0
      || lastRun.B_UUIS.block2_legality_region.content.length > 0
      || lastRun.B_UUIS.block7_meta_update_loop.content.length > 0;
    const synthesisPass = lastRunUserLawCount > 0;
    return uicPass && uuisPass && synthesisPass && activeCount > 0 ? "green" : "red";
  }, [activeCount, chatLoading, ingestLoading, lastRun, lastRunUserLawCount]);

  useEffect(() => {
    const key = "lml_session_id";
    const existing = window.localStorage.getItem(key);
    if (existing) {
      setSessionId(existing);
      return;
    }
    const generated = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(key, generated);
    setSessionId(generated);
  }, []);

  useEffect(() => {
    if (!sessionId || sessionId === "default-session") {
      return;
    }
    void (async () => {
      const response = await fetch(`/api/lml-state?sessionId=${encodeURIComponent(sessionId)}`);
      if (!response.ok) {
        return;
      }
      const data = (await response.json()) as LmlStateResponse;
      if (Array.isArray(data.userLaws) && data.userLaws.length > 0) {
        const restored = data.userLaws.filter((law) =>
          !isFallbackLaw(law.law_id) &&
          !isPlaceholderLaw(law.text) &&
          !isLowSignalGeneratedLaw(law.text),
        );
        setActiveUserLaws((current) => mergeUniqueLaws(current, restored));
        if (restored.length !== data.userLaws.length) {
          await fetch("/api/lml-state", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId, action: "replace", userLaws: restored }),
          });
        }
      }
      setActiveAutoLaws(Array.isArray(data.activeAutoLaws) ? data.activeAutoLaws : []);
      setPendingLawProposals(Array.isArray(data.pendingLawProposals) ? data.pendingLawProposals : []);
      setMetaPlanetLaws(Array.isArray(data.metaPlanetLaws) ? data.metaPlanetLaws : []);
      setActiveMetaPlanetLaws(Array.isArray(data.activeMetaPlanetLaws) ? data.activeMetaPlanetLaws : []);
      setCapabilityGraph(data.capabilityGraph ?? null);
      setAbilityPlanet(data.abilityPlanet ?? { coding: [], web_search: [] });
      setActiveAbilityPlanet(data.activeAbilityPlanet ?? { coding: [], web_search: [] });
    })();
  }, [sessionId]);

  async function refreshMetaHardeningState() {
    if (!sessionId || sessionId === "default-session") {
      return;
    }
    const response = await fetch(`/api/lml-state?sessionId=${encodeURIComponent(sessionId)}`);
    if (!response.ok) {
      return;
    }
    const data = (await response.json()) as LmlStateResponse;
    setActiveAutoLaws(Array.isArray(data.activeAutoLaws) ? data.activeAutoLaws : []);
    setPendingLawProposals(Array.isArray(data.pendingLawProposals) ? data.pendingLawProposals : []);
    setMetaPlanetLaws(Array.isArray(data.metaPlanetLaws) ? data.metaPlanetLaws : []);
    setActiveMetaPlanetLaws(Array.isArray(data.activeMetaPlanetLaws) ? data.activeMetaPlanetLaws : []);
    setCapabilityGraph(data.capabilityGraph ?? null);
    setAbilityPlanet(data.abilityPlanet ?? { coding: [], web_search: [] });
    setActiveAbilityPlanet(data.activeAbilityPlanet ?? { coding: [], web_search: [] });
  }

  async function onDocumentChange(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }

    setLoadError(null);
    try {
      const loaded: DocArtifact[] = [];
      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        const lower = file.name.toLowerCase();
        let extracted = "";
        if (lower.endsWith(".pdf")) {
          const bytes = new Uint8Array(await file.arrayBuffer());
          extracted = await extractPdfViaApi(file.name, bytes);
          if (!extracted.trim()) {
            extracted = extractTextFromPdfBytes(bytes);
          }
        } else {
          extracted = await file.text();
        }
        const text = extracted.trim();
        if (!text) {
          continue;
        }
        loaded.push({
          id: `${file.name}-${Date.now()}-${i}`,
          name: file.name,
          text,
        });
      }
      if (loaded.length === 0) {
        setLoadError("No readable text extracted from selected files.");
        return;
      }
      setDocuments((current) => [...current, ...loaded]);
    } catch {
      setLoadError("Failed to load document(s).");
    }
  }

  async function ingestToLml() {
    const artifact = [allDocText.trim(), manualLawText.trim()].filter(Boolean).join("\n\n");
    if (!artifact) {
      return;
    }

    setIngestLoading(true);
    setIngestError(null);

    try {
      const response = await fetch("/api/snap-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artifact,
          profileId: "DOC_LAW_PROFILE",
          runMode: "demo",
        }),
      });

      if (!response.ok) {
        const err = (await response.json()) as { error?: string };
        throw new Error(err.error ?? "Failed to ingest.");
      }

      const data = (await response.json()) as SnapRunResponse;
      const extractedUserLaws = data.C_DELTA.LML_ADD.filter(
        (law) =>
          (law.source_claim_ids.length > 0 || !isProfileSeedLaw(law.text)) &&
          !isPlaceholderLaw(law.text) &&
          !isLowSignalGeneratedLaw(law.text),
      );
      const blockerCount = data.D_BLOCKERS.HOLES_BLOCKING_LML.length + data.D_BLOCKERS.HOLES_BLOCKING_NSL.length;
      if (extractedUserLaws.length === 0) {
        setMessages((current) => [
          ...current,
          {
            role: "assistant",
            text:
              blockerCount > 0
                ? `System notice: extraction completed with ${blockerCount} blocker(s). No admissible user laws activated in this run.`
                : "System notice: extraction completed but no admissible user laws were activated.",
          },
        ]);
        setLastRun(data);
        return;
      }
      const merged = mergeUniqueLaws(activeUserLaws.filter((law) => !isFallbackLaw(law.law_id)), extractedUserLaws);
      setActiveUserLaws(merged);
      await fetch("/api/lml-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, action: "replace", userLaws: merged }),
      });
      setLastRun(data);
      setIngestRuns((count) => count + 1);

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text:
            blockerCount > 0
              ? `System notice: activated ${merged.length} user law(s); ${blockerCount} blocker(s) remain active for repair/evidence fill.`
              : `System notice: activated ${merged.length} user law(s) from ${documents.length} document(s).`,
        },
      ]);
      await refreshMetaHardeningState();
    } catch (error) {
      setIngestError(error instanceof Error ? error.message : "Failed to ingest.");
    } finally {
      setIngestLoading(false);
    }
  }

  async function askAgent() {
    const userPrompt = prompt.trim();
    if (!userPrompt) {
      return;
    }

    setChatLoading(true);
    setMessages((current) => [...current, { role: "user", text: userPrompt }]);
    try {
      const response = await fetch("/api/lml-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userPrompt,
          sessionId,
          userLaws: activeUserLaws.map((law) => ({
            law_id: law.law_id,
            text: law.text,
            scope: law.scope,
            enforcement: law.enforcement,
          })),
          documentText: allDocText,
          documents: documents.map((doc) => ({ id: doc.id, name: doc.name, text: doc.text })),
        }),
      });
      if (!response.ok) {
        const err = (await response.json()) as { error?: string };
        throw new Error(err.error ?? "Failed to run chat.");
      }
      const data = (await response.json()) as ChatApiResponse;
      setLastTrace(data.trace);
      setLastModel(data.model);
      setLastCode(data.code);
      setCopyState("idle");
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: data.answer,
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: error instanceof Error ? error.message : "Failed to run chat.",
        },
      ]);
    } finally {
      setChatLoading(false);
      await refreshMetaHardeningState();
    }
  }

  function removeLaw(lawId: string) {
    const next = activeUserLaws.filter((law) => law.law_id !== lawId);
    setActiveUserLaws(next);
    void fetch("/api/lml-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, action: "replace", userLaws: next }),
    });
    void refreshMetaHardeningState();
    setMessages((current) => [
      ...current,
      { role: "assistant", text: `System notice: law ${lawId} removed. Active overlay law entries: ${next.length}.` },
    ]);
  }

  async function copyCodeToClipboard() {
    const value = lastCode?.primary?.code;
    if (!value) {
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  }

  function wipeAllLaws() {
    setActiveUserLaws([]);
    void fetch("/api/lml-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, action: "clear" }),
    });
    void refreshMetaHardeningState();
    setMessages((current) => [
      ...current,
      { role: "assistant", text: "System notice: all user laws removed. Runtime recompiled to sun-only universe state." },
    ]);
  }

  function removeDocument(docId: string) {
    setDocuments((current) => current.filter((doc) => doc.id !== docId));
  }

  return (
    <main>
      <header className="hero">
        <div className="watermark">CUSTOMAIS-LML CUSTOMIZE AI IDE</div>
        <h1>We Turn Your Rules into Laws that Define AI Behavior.</h1>
        <p>The sun stays immutable. Stack unlimited docs/text as user overlay laws inside one loaded universe.</p>
      </header>

      <section className="grid triplet">
        <article className="card">
          <strong>AI Chat</strong>
          <div className="chatCodeRow">
            <div className="chatPane">
              <div className="list" style={{ maxHeight: "52vh" }}>
                {messages.map((message, index) => (
                  <div className="item" key={`${message.role}-${String(index)}`}>
                    <div><strong>{message.role === "assistant" ? "AI" : "You"}</strong></div>
                    <pre>{message.text}</pre>
                  </div>
                ))}
              </div>
              <div className="controls one-col">
                <textarea
                  value={prompt}
                  placeholder={DEFAULT_PROMPT}
                  onChange={(event) => setPrompt(event.target.value)}
                  rows={3}
                />
                <button type="button" onClick={() => void askAgent()} disabled={chatLoading}>
                  {chatLoading ? "Running LML..." : "Send"}
                </button>
              </div>
            </div>
            <div className="codePane">
              <strong>Generated Code</strong>
              {!lastCode || !lastCode.primary ? (
                <div className="meta">No code block in the latest response.</div>
              ) : (
                <div>
                  <div className="actions">
                    <button type="button" className="secondary" onClick={() => void copyCodeToClipboard()}>
                      Copy Code
                    </button>
                  </div>
                  <div className="meta">
                    language: {lastCode.primary.language} {copyState === "copied" ? "| copied" : copyState === "error" ? "| copy failed" : ""}
                  </div>
                  <pre className="codeBox">{lastCode.primary.code}</pre>
                </div>
              )}
            </div>
          </div>
          <details className="card" open>
            <summary><strong>Enforcement Trace</strong></summary>
            {!lastTrace ? <div className="meta">No trace yet.</div> : (
              <div className="list compact">
                <div className="item"><strong>gate_failed:</strong> {String(lastTrace.gate_failed ?? "none")}</div>
                <div className="item"><strong>failed_predicate:</strong> {String(lastTrace.failed_predicate ?? "none")}</div>
                <div className="item"><strong>null_state:</strong> {String(Boolean(lastTrace.null_state))}</div>
                <div className="item"><strong>ability_route:</strong> {lastTrace.ability_route}</div>
                <div className="item"><strong>system_laws:</strong> {(lastTrace.system_laws ?? []).length}</div>
                <div className="item"><strong>triggered_constraints:</strong> {(lastTrace.triggered_constraints ?? []).join(" | ") || "none"}</div>
                <div className="item"><strong>failed_laws:</strong> {(lastTrace.failed_laws ?? []).join(" | ") || "none"}</div>
                <div className="item"><strong>failure_classes:</strong> {(lastTrace.failure_classes ?? []).join(" | ") || "none"}</div>
                <div className="item"><strong>triggered_repairs:</strong> {(lastTrace.triggered_repairs ?? []).join(" | ") || "none"}</div>
                <div className="item"><strong>return_moves:</strong> {(lastTrace.return_moves ?? []).join(" | ") || "none"}</div>
                <div className="item"><strong>null_staircase.state:</strong> {lastTrace.null_staircase?.state ?? "none"}</div>
                <div className="item"><strong>null_staircase.witness:</strong> {lastTrace.null_staircase
                  ? `${lastTrace.null_staircase.witness.gate} / ${lastTrace.null_staircase.witness.predicate}`
                  : "none"}
                </div>
                <div className="item"><strong>null_staircase.violations:</strong> {(lastTrace.null_staircase?.witness.violations ?? []).join(" | ") || "none"}</div>
                <div className="item"><strong>null_staircase.loop:</strong> {(lastTrace.null_staircase?.loop ?? []).join(" -> ") || "none"}</div>
                <div className="item"><strong>path_orchestrator.formation:</strong> {lastTrace.path_orchestrator?.formation_id ?? "none"}</div>
                <div className="item"><strong>path_orchestrator.terminated:</strong> {String(lastTrace.path_orchestrator?.terminated ?? false)}</div>
                <div className="item"><strong>path_orchestrator.reason:</strong> {lastTrace.path_orchestrator?.termination_reason ?? "none"}</div>
                <div className="item"><strong>path_orchestrator.stages:</strong> {(lastTrace.path_orchestrator?.stages ?? [])
                  .map((stage) => `${stage.stage}:${stage.status}`)
                  .join(" | ") || "none"}
                </div>
                <div className="item"><strong>reason:</strong> {lastTrace.reason}</div>
              </div>
            )}
          </details>
          <details className="card" open>
            <summary><strong>Meta Planet</strong></summary>
            <div className="actions">
              <button type="button" className="secondary" onClick={() => void refreshMetaHardeningState()}>
                Refresh Evidence
              </button>
            </div>
            <div className="list compact">
              <div className="item"><strong>meta_planet_base_laws:</strong> {metaPlanetLaws.length}</div>
              <div className="item"><strong>active_meta_planet_laws:</strong> {activeMetaPlanetLaws.length}</div>
              <div className="item"><strong>pending_meta_planet_proposals:</strong> {pendingLawProposals.length}</div>
              {(activeMetaPlanetLaws.length === 0 ? pendingLawProposals : activeMetaPlanetLaws).slice(0, 8).map((law, idx) => (
                <div className="item" key={`meta-law-${idx}`}>
                  <div><strong>{law.source}</strong> [{law.scope} | {law.enforcement}]</div>
                  <div className="meta">{law.text}</div>
                </div>
              ))}
            </div>
          </details>
          <details className="card" open>
            <summary><strong>Model Runtime</strong></summary>
            <div className="list compact">
              <div className="item">
                <strong>Active:</strong> {lastModel ? `${lastModel.provider} / ${lastModel.model}` : "gpt2-runtime / gpt2 (awaiting first turn)"}
              </div>
              <div className="item"><strong>Status:</strong> LIVE via LML runtime path</div>
              <div className="item"><strong>Call ID:</strong> {lastModel?.callId ?? "n/a"}</div>
              <div className="item"><strong>Run ID:</strong> {lastModel?.runId ?? "n/a"}</div>
              <div className="item"><strong>At:</strong> {lastModel?.at ?? "n/a"}</div>
              <div className="item"><strong>Catalog (placeholders):</strong></div>
              <div className="item">1. GPT-2 (Active)</div>
              <div className="item">2. GPT-4o (Inactive)</div>
              <div className="item">3. Claude 3.7 Sonnet (Inactive)</div>
              <div className="item">4. Llama 3.1 70B (Inactive)</div>
            </div>
          </details>
        </article>

        <article className="card">
          <strong>Law Entry</strong>
          <div className="controls one-col">
            <input type="file" accept=".pdf,.txt,.md,.rtf" multiple onChange={onDocumentChange} />
            <div className="meta">Docs stacked: {documents.length} | total chars: {totalDocChars.toLocaleString()}</div>
            {loadError ? <div className="danger">{loadError}</div> : null}
            <textarea
              placeholder="Type laws manually. You can add abilities, style/persona, addressing preference, safety constraints, behavior rules, and domain policies."
              value={manualLawText}
              onChange={(event) => setManualLawText(event.target.value)}
              rows={6}
            />
            <button type="button" onClick={() => void ingestToLml()} disabled={ingestLoading || (!allDocText.trim() && !manualLawText.trim())}>
              {ingestLoading ? "Applying LML..." : "Apply LML"}
            </button>
            {ingestError ? <div className="danger">{ingestError}</div> : null}
            {lastRun ? <div className="meta">run: {lastRun.runId} | blockers: {totalBlockers} | total ingests: {ingestRuns}</div> : null}
          </div>
          <details className="card" open>
            <summary><strong>Stacked Docs ({documents.length})</strong></summary>
            <div className="list compact">
              {documents.length === 0 ? <div className="item">No docs loaded.</div> : null}
              {documents.map((doc) => (
                <div className="item" key={doc.id}>
                  <div><strong>{doc.name}</strong> ({doc.text.length.toLocaleString()} chars)</div>
                  <div className="actions">
                    <button type="button" className="secondary" onClick={() => removeDocument(doc.id)}>Remove Doc</button>
                  </div>
                </div>
              ))}
            </div>
          </details>
          <details className="card" open>
            <summary><strong>Loaded Universe Laws ({activeCount})</strong></summary>
            <div className="actions">
              <button type="button" className="secondary" onClick={wipeAllLaws} disabled={activeCount === 0}>Deactivate All</button>
            </div>
            <div className="list compact">
              <div className="item">
                <strong>Ability states:</strong>{" "}
                coding={capabilityGraph?.abilities.coding.state ?? "unspecified"} | web_search={capabilityGraph?.abilities.web_search.state ?? "unspecified"}
              </div>
              <div className="item">
                <strong>Ability planet laws visible:</strong>{" "}
                coding={activeAbilityPlanet.coding.length} / {abilityPlanet.coding.length} | web_search={activeAbilityPlanet.web_search.length} / {abilityPlanet.web_search.length}
              </div>
            </div>
            <div className="list compact">
              {activeCount === 0 ? <div className="item">No user laws loaded.</div> : null}
              {activeUserLaws.map((law) => (
                <div className="item" key={law.law_id}>
                  <div><strong>{law.law_id}</strong> [{law.scope} | {law.enforcement}]</div>
                  <div className="meta">{law.text}</div>
                  <div className="actions">
                    <button type="button" className="secondary" onClick={() => removeLaw(law.law_id)}>Deactivate Law</button>
                  </div>
                </div>
              ))}
            </div>
            <details className="card" open>
              <summary><strong>Ability Planet</strong></summary>
              <div className="list compact">
                {activeAbilityPlanet.coding.length === 0 && activeAbilityPlanet.web_search.length === 0 ? (
                  <div className="item">Ability planet is not active.</div>
                ) : null}
                {activeAbilityPlanet.coding.length > 0 ? (
                  <div className="item">
                    <div><strong>Coding laws ({activeAbilityPlanet.coding.length})</strong></div>
                    {activeAbilityPlanet.coding.map((law, idx) => (
                      <div className="meta" key={`ability-coding-${idx}`}>{law}</div>
                    ))}
                  </div>
                ) : null}
                {activeAbilityPlanet.web_search.length > 0 ? (
                  <div className="item">
                    <div><strong>Web Search laws ({activeAbilityPlanet.web_search.length})</strong></div>
                    {activeAbilityPlanet.web_search.map((law, idx) => (
                      <div className="meta" key={`ability-web-${idx}`}>{law}</div>
                    ))}
                  </div>
                ) : null}
              </div>
            </details>
          </details>
          <details className="card">
            <summary><strong>Universe Growth</strong></summary>
            <div className="meta">User-added laws: {activeCount}</div>
            <div className="list compact">
              {activeUserLaws.length === 0 ? <div className="item">No user laws added yet.</div> : null}
              {activeUserLaws.map((law) => (
                <div className="item" key={`growth-${law.law_id}`}>
                  <div><strong>{law.law_id}</strong></div>
                  <div className="meta">{law.text}</div>
                </div>
              ))}
            </div>
          </details>
        </article>

        <article className="card">
          <strong>Installation Pipeline</strong>
          <div className="pipelineLightRow">
            <div className={`pipelineLight ${pipelineState}`} />
            <div className="meta">
              {pipelineState === "green" ? "Pipeline green light ON" : pipelineState === "amber" ? "Pipeline running..." : "Pipeline red (awaiting ingest)"}
            </div>
          </div>
          <div className="steps">
            {stageStatus.map((stage) => (
              <div key={stage.label} className={`step ${stage.status}`}>
                <div className="dot" />
                <div className="stepLabel">{stage.label}</div>
                <div className="meta">{stage.detail}</div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}

function isProfileSeedLaw(text: string): boolean {
  return /^LAW\.[A-Z]+\.\d+:\s/.test(text.trim());
}

function mergeUniqueLaws(existing: IngestedLaw[], incoming: IngestedLaw[]): IngestedLaw[] {
  const byKey = new Map<string, IngestedLaw>();
  for (const law of existing) {
    byKey.set(lawKey(law), law);
  }
  for (const law of incoming) {
    byKey.set(lawKey(law), law);
  }
  return Array.from(byKey.values());
}

function lawKey(law: IngestedLaw): string {
  return `${law.text.toLowerCase()}|${law.scope}|${law.enforcement}`;
}

function isFallbackLaw(lawId: string): boolean {
  return lawId.startsWith("LAW-FALLBACK-");
}

function isPlaceholderLaw(text: string): boolean {
  return /non-negotiable continuity:\s*required/i.test(text.trim());
}

function isLowSignalGeneratedLaw(text: string): boolean {
  const value = text.trim().toLowerCase();
  return (
    /^must enforce claim\s+c\d+:/i.test(value) ||
    /^missing return path for f\d+:/i.test(value) ||
    /^detector required for claim\s+c\d+:/i.test(value) ||
    /^system must (detect|execute and verify|isolate risky coupling|preserve admissible state boundary)/i.test(value)
  );
}

async function extractPdfViaApi(filename: string, bytes: Uint8Array): Promise<string> {
  try {
    const response = await fetch("/api/extract-pdf-text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename,
        contentBase64: bytesToBase64(bytes),
      }),
    });
    if (!response.ok) {
      return "";
    }
    const data = (await response.json()) as { text?: string };
    return (data.text ?? "").trim();
  } catch {
    return "";
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}
