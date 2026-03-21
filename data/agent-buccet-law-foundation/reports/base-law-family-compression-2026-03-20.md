# Agent Buccet Base-Law Family Compression

- source laws processed: 68277
- base-law families generated: 11

## Family Counts

- BUCCET.BASE.FAMILY.01 Base Defensive Invariants
  - status: active
  - full-corpus matched laws: 439
  - active-export laws: 29
  - excluded laws: 410
  - excluded by reason: trimmed_inside_kept_family:410
- BUCCET.BASE.FAMILY.02 Factual Integrity Defense
  - status: active
  - full-corpus matched laws: 519
  - active-export laws: 108
  - excluded laws: 411
  - excluded by reason: trimmed_inside_kept_family:411
- BUCCET.BASE.FAMILY.03 Alignment and Architecture Defense
  - status: active
  - full-corpus matched laws: 611
  - active-export laws: 291
  - excluded laws: 320
  - excluded by reason: trimmed_inside_kept_family:320
- BUCCET.BASE.FAMILY.04 Epistemic and Agentic Failure Defense
  - status: active
  - full-corpus matched laws: 534
  - active-export laws: 260
  - excluded laws: 274
  - excluded by reason: trimmed_inside_kept_family:274
- BUCCET.BASE.FAMILY.05 Epistemic Dimension
  - status: active
  - full-corpus matched laws: 666
  - active-export laws: 113
  - excluded laws: 553
  - excluded by reason: trim_packaging:230, not_in_active_export:1, trim_retrieval_intelligence:1, trim_domain_legal:42, trim_domain_citation:136, trim_domain_legal_document:2, trimmed_inside_kept_family:14, duplicate_of_kept_core:127
- BUCCET.BASE.FAMILY.06 Agentic Dimension
  - status: active
  - full-corpus matched laws: 315
  - active-export laws: 148
  - excluded laws: 167
  - excluded by reason: trimmed_inside_kept_family:7, not_in_active_export:1, trim_packaging:6, duplicate_of_kept_core:153
- BUCCET.BASE.FAMILY.07 Adversarial Robustness Dimension
  - status: active
  - full-corpus matched laws: 586
  - active-export laws: 0
  - excluded laws: 586
  - excluded by reason: not_in_active_export:48, trim_ui:5, trim_packaging:18, trimmed_inside_kept_family:18, offensive_attack_catalog:432, duplicate_of_kept_core:65
- BUCCET.BASE.FAMILY.08 Alignment Dimension
  - status: active
  - full-corpus matched laws: 131
  - active-export laws: 18
  - excluded laws: 113
  - excluded by reason: unclassified:2, not_in_active_export:1, trimmed_inside_kept_family:17, trim_ui:2, trim_writing:37, trim_packaging:33, duplicate_of_kept_core:21
- BUCCET.BASE.FAMILY.09 Architectural Dimension
  - status: active
  - full-corpus matched laws: 377
  - active-export laws: 167
  - excluded laws: 210
  - excluded by reason: trim_packaging:12, trimmed_inside_kept_family:5, trim_retrieval_intelligence:2, trim_ui:6, trim_writing:2, trim_domain_citation:4, trim_domain_legal_document:2, not_in_active_export:4, duplicate_of_kept_core:173
- BUCCET.BASE.FAMILY.10 Domain Boundary Dimension
  - status: active
  - full-corpus matched laws: 1564
  - active-export laws: 0
  - excluded laws: 1564
  - excluded by reason: trim_domain_legal:210, trimmed_inside_kept_family:235, not_in_active_export:15, trim_retrieval_intelligence:24, trim_ontology:11, trim_writing:23, trim_domain_citation:816, trim_packaging:32, trim_domain_legal_document:46, trim_ui:3, duplicate_of_kept_core:149
- BUCCET.BASE.FAMILY.11 Governance Persistence Dimension
  - status: active
  - full-corpus matched laws: 438
  - active-export laws: 0
  - excluded laws: 438
  - excluded by reason: unclassified:4, trim_domain_legal:59, trim_retrieval_intelligence:2, trim_ui:11, trim_packaging:14, trim_domain_legal_document:40, not_in_active_export:8, trimmed_inside_kept_family:146, duplicate_of_kept_core:154

## Read

This is the first base-law family compression layer over the 68k corpus. It does not delete the raw laws. It creates family-level compressed coverage with active-export and excluded coverage tracked separately.

The 11-family plan is now executable:
- 4 base families
- 7 periodic dimensions

Important:
- active-export counts remain bounded by the current defensive core
- excluded counts show how much of the full 68k still maps into each family while staying outside active export
- this is loss-aware compression, not destructive summarization
