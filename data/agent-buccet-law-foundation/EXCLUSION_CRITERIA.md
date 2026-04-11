# Base Law Exclusion Criteria

Current policy state:
- source laws processed: `68,277`
- surviving base laws: `2,407`
- excluded base laws: `65,870`
- active base laws after base/state/output runtime layering: `7,221`

These are the categories used when trimming the 68,277 raw source laws down to 2,407 surviving
base laws. Each category describes a class of law that was excluded from the active Agent Buccet
base-law body. Total excluded: 65,870 laws across 10 categories.

---

## Current exclusion buckets

## trim_packaging — 17,419 laws

Laws that describe document structure, template layouts, header/footer rules, section numbering,
filing format requirements, and document packaging conventions. These are artifacts of the source
documents being legal filing tools. They govern how documents are assembled and presented for court,
not how Agent Buccet behaves. Not relevant to Agent Buccet runtime.

## duplicate_of_kept_core — 12,934 laws

Laws whose defensive force is already carried elsewhere in the active corpus. The source corpus
had heavy repetition across source files — the same principle stated in multiple documents,
sometimes word-for-word, sometimes paraphrased. When a law was already covered by a kept
primary law, the redundant copy was excluded. The primary is kept; all duplicates are excluded.

## trim_retrieval_intelligence — 4,927 laws

Domain-specific retrieval, search, citation lookup, and legal-research intelligence laws that are
not part of Agent Buccet's defensive runtime role.

## trim_domain_legal — 4,782 laws

Legal-practice and jurisdiction-specific workflow laws that are outside Agent Buccet's general
defensive surface.

## trim_domain_citation — 4,520 laws

Citation-format and citation-verification laws specific to legal document production.

## trim_domain_legal_document — 4,092 laws

Laws about the structure and content of legal filings and legal-document artifacts rather than
Agent Buccet system behavior.

## trim_ui — 6,044 laws

UI workflow and interface laws that are not part of Agent Buccet's active defensive law body.
Agent Buccet has no UI layer of this kind.

## trim_writing — 4,995 laws

Writing-quality, prose, style, and drafting laws that are not defensive runtime constraints.

## trim_ontology — 340 laws

Ontology and classification scaffolding that does not directly participate in Agent Buccet's
active defensive runtime body.

## trim_unresolved — 5,817 laws

Laws that remain too corrupted or ambiguous to classify safely into the active body. Source IDs
are preserved in the family manifest for future audit.

---

## Adversarial restoration decision

Current policy is:
- procedural offensive enablement stays excluded from the active law body
- adversarial attack recognition, exploit-shape detection, manipulation-pattern knowledge, and
  hostile-boundary recognition remain active defensive law

Result of the restoration:
- surviving base laws changed from `1,887` to `2,407`
- active base laws changed from `5,661` to `7,221`
- `BUCCET.BASE.FAMILY.07` now carries:
  - matched laws: `586`
  - covered laws: `586`
  - excluded matched laws: `0`

This is the current intended state.

## Decision boundary

The line is:
- keep adversarial recognition and containment knowledge
- exclude procedural attack enablement as active runtime policy

The active corpus now follows that rule. The earlier remodeling pass that treated adversarial
recognition laws as excludable was reversed on audit. The compressed law for FAMILY.07 makes
the current policy explicit:

> "Agent Buccet MUST remain robust under manipulation attempts and hostile boundary pressure."
