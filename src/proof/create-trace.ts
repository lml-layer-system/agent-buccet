/**
 * Proof-of-work trace for a single Buccet team.
 *
 * Read-only. Formats TeamPathSourceMemoryRecord entries from persisted
 * path-source-memory.jsonl into a clean, inspectable trace.
 *
 * No write paths. No model-memory assumptions. No prompt reconstruction.
 */

export type ProofOfWorkEntry = {
  id: string;
  at: string;
  kind: string;
  title: string;
  /** First 240 chars of the persisted text field — stable snippet, not a re-render. */
  snippet: string;
  team: string;
  meta: Record<string, unknown> | undefined;
};

export type ProofOfWorkTraceOutput = {
  team: string;
  totalEntries: number;
  /** Number of entries in `entries` (may be < totalEntries when --tail is applied). */
  showing: number;
  entries: ProofOfWorkEntry[];
};

/** Input shape — field names mirror TeamPathSourceMemoryRecord exactly. */
export type RawMemoryRecord = {
  id: string;
  at: string;
  kind: string;
  title: string;
  text: string;
  team: string;
  meta?: Record<string, unknown>;
};

export function buildProofOfWorkTraceOutput(
  slug: string,
  records: RawMemoryRecord[],
  opts?: { tail?: number },
): ProofOfWorkTraceOutput {
  const tail = opts?.tail !== undefined && opts.tail > 0 ? opts.tail : undefined;
  const sliced = tail !== undefined ? records.slice(-tail) : records;

  return {
    team: slug,
    totalEntries: records.length,
    showing: sliced.length,
    entries: sliced.map((r) => ({
      id: r.id,
      at: r.at,
      kind: r.kind,
      title: r.title,
      snippet: r.text.slice(0, 240),
      team: r.team,
      meta: r.meta,
    })),
  };
}

const KIND_WIDTH = 22;

export function renderProofOfWorkTraceText(output: ProofOfWorkTraceOutput): string {
  if (output.totalEntries === 0) {
    return `  No proof-of-work entries recorded yet for team "${output.team}".`;
  }

  const tailNote = output.showing < output.totalEntries
    ? `  (showing ${output.showing} of ${output.totalEntries} — latest)`
    : `  (${output.totalEntries} ${output.totalEntries === 1 ? "entry" : "entries"} total)`;

  const lines: string[] = [`Team ${output.team} · proof-of-work trace`, tailNote, ""];

  for (const entry of output.entries) {
    const kindPad = entry.kind.length <= KIND_WIDTH
      ? entry.kind.padEnd(KIND_WIDTH)
      : entry.kind.slice(0, KIND_WIDTH - 1) + "…";
    lines.push(`  ${entry.at}  ${kindPad}  ${entry.title}`);
    if (entry.snippet.trim().length > 0) {
      const oneLiner = entry.snippet.replaceAll("\n", " ").trim();
      const display = oneLiner.length > 120 ? oneLiner.slice(0, 119) + "…" : oneLiner;
      lines.push(`    ${display}`);
    }
  }

  return lines.join("\n");
}
