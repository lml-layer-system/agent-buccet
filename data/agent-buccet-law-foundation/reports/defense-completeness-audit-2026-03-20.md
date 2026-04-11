# Defense Completeness Audit

- total raw laws: 68277
- active kept-core record ids: 688
- source files with defensive candidate vocabulary: 34
- non-core source files with defensive candidate vocabulary: 30
- non-core source files already explained by intentional trim/duplicate decisions: 30
- non-core source files still unclassified after explicit trim mapping: 0

## Family-Level Conclusion

At the family level, this audit did **not** find any additional unclassified source family that appears defensive and is still outside the kept core. Every non-core family with defensive vocabulary is already explained by an intentional trim bucket or by duplicate-family status.

## Important Remaining Risk

Family-level completeness does **not** prove row-level completeness. The largest remaining gap is inside the four kept source files themselves: they still contain readable source sections that were trimmed during pruning. Those omissions may be correct, but they are the place where a true mathematical completeness audit still needs attention.

## Kept-Core Internal Omissions

- S3_043__18D5F666-F512-461A-8824-A3254F00C282.docx
  - readable sections in section map: 44
  - active sections kept: 17
  - omitted readable sections: 27
  - sample omitted sections: UIC: UNIVERSAL IDENTITY COMPILER (45); KNOWLEDGE REPAIR MOVES: (42); KNOWLEDGE ORGANIZATION MODULES: (33); SUMMARY (27); FAILURE → REPAIR MAPPING: (22); HOLES: (21); KNOWLEDGE BASE BUDGETS: (19); "repair_id": "NSL.K.VERIFICATION_RESTORATION", (17); HOLES_BLOCKING_LML: (13); NSL.K.VERIFICATION_RESTORATION (13); PER_FACTUAL_KNOWLEDGE = { (13); HOLES_BLOCKING_NSL: (12); NSL.K.CONTRADICTION_RESOLUTION (11); NSL.K.STALENESS_REFRESH (11); KNOWLEDGE EVOLUTION TRACKING: (10); NSL.K.DERIVATION_REPAIR (10); NSL.K.AUTHORITY_ENFORCEMENT (8); NSL.K.COHERENCE_CORRECTION (8); NSL.K.SCOPE_CORRECTION (8); NSL.K.TYPE_CLASSIFICATION (8)
- S3_044__1ED7E9AD-1F2D-49D4-A7D4-5C5C4F5CE3C5.docx
  - readable sections in section map: 72
  - active sections kept: 10
  - omitted readable sections: 62
  - sample omitted sections: PHASE 5: VERIFICATION (33); PROOF: LAWS & REPAIRS ARE FINITE (33); IMPLICATIONS (25); THE MASTER TEMPLATE (19); FORCE 2: FUNDAMENTAL FAILURE MODES (F) (15); FORCE 3: PREVENTION/REPAIR EFFECTIVENESS (E) (12); THE 12 UNIVERSAL LAW TYPES: (12); THE 12 UNIVERSAL REPAIR TYPES: (12); FORCE 1: INFINITE INSTANTIATIONS (I∞) (10); LAW TYPE 1: COMPLETENESS (8); LAW TYPE 4: CAPACITY_CONSTRAINT (8); REPAIR TYPE 1: CLASSIFICATION (8); REPAIR TYPE 2: COHERENCE_RESTORATION (8); Domain: THE STRUCTURE OF LAWS AND REPAIRS THEMSELVES (7); LAW TYPE 10: COMPREHENSIBILITY (7); LAW TYPE 2: COHERENCE (7); LAW TYPE 3: CONTEXT_APPROPRIATENESS (7); LAW TYPE 5: CONSISTENCY (7); REPAIR TYPE 4: SIMPLIFICATION (7); REPAIR TYPE 5: CONSISTENCY_RESTORATION (7)
- S3_060__A951F220-4F73-469E-AC41-CFD2B8F79F13.docx
  - readable sections in section map: 197
  - active sections kept: 102
  - omitted readable sections: 95
  - sample omitted sections: TAXONOMY COMPLETENESS PROOF (21); "GOVERNANCE": 43 (16); THIS IS UNDENIABLE PROOF (7); ID: DOMAIN-BIO-UPLIFT-254 (5); ID: DOMAIN-CSAM-GEN-295 (5); ID: DOMAIN-CITE-SPOOF-280 (4); ID: DOMAIN-DEF-OFF-FLIP-268 (4); ID: DOMAIN-MALWARE-GEN-264 (4); ID: DOMAIN-ZERODAY-262 (4); ID: GOV-OVERSIGHT-IMMUNE-313 (4); DOM6.3: HATE SPEECH GENERATION (3); GOV4.4: PROCESS FAILURE (3); ID: DOMAIN-ADULT-CONTENT-296 (3); ID: DOMAIN-BSL-VIOL-258 (3); ID: DOMAIN-CHEM-WEAPON-275 (3); ID: DOMAIN-CONTAIN-FAIL-259 (3); ID: DOMAIN-CONTRAIND-MISS-291 (3); ID: DOMAIN-CRED-THEFT-270 (3); ID: DOMAIN-DDOS-PLAN-273 (3); ID: DOMAIN-DIAG-MISUSE-260 (3)
- S3_063__EF7AD303-6CB0-4DBC-94BA-E4E34253D2D4.docx
  - readable sections in section map: 157
  - active sections kept: 81
  - omitted readable sections: 76
  - sample omitted sections: THE 7 FUNDAMENTAL DIMENSIONS (Periodic Groups) (30); ID: ADV-INDIRECT-INJECT-122 (8); failure = PERIODIC_TABLE["EPIS-STRUCT-HALL-001"] (7); VERIFICATION SYSTEM (6); CREATION: 2026-02-11T00:00:00Z (4); ID: ADV-AGENT-WORM-124 (4); ID: ADV-OCR-BYPASS-153 (4); ID: ADV-PAIR-113 (4); ID: ADV-SLEEPER-AGENT-127 (4); ADV1.4: EVIL CONFIDANT (3); ADV5.2: ROT13 / CAESAR CIPHER (3); ID: ADV-API-INJECT-131 (3); ID: ADV-AUDIO-INJECT-149 (3); ID: ADV-AUTODAN-117 (3); ID: ADV-AUTOPROMPT-103 (3); ID: ADV-BASE64-136 (3); ID: ADV-CIPHER-118 (3); ID: ADV-CMD-INJECT-129 (3); ID: ADV-COLD-115 (3); ID: ADV-COMPARISON-097 (3)

## Intentionally Trimmed Families That Still Contain Defensive Vocabulary

- S3_059__A85C098D-3B2C-401D-965F-2B5E9868719D.docx
  - bucket: trim_domain_legal_document
  - candidate defensive records outside kept core: 283
  - readable records: 662
  - top groups: boundary_scope_authority:175, contradiction_verification:107, novelty_dynamic:21, hallucination_fabrication:1
- S4_068__Converted - DOCUMENT AS LAW COLLAPSE.docx
  - bucket: trim_domain_legal_document
  - candidate defensive records outside kept core: 283
  - readable records: 662
  - top groups: boundary_scope_authority:175, contradiction_verification:107, novelty_dynamic:21, hallucination_fabrication:1
- S3_053__61C869DF-C6ED-467A-8200-4F67B19D153B.docx
  - bucket: trim_domain_legal
  - candidate defensive records outside kept core: 255
  - readable records: 615
  - top groups: contradiction_verification:185, hallucination_fabrication:42, boundary_scope_authority:41, novelty_dynamic:13
- S4_070__Converted - PERIODIC TABLE CONTINUED.docx
  - bucket: duplicate_of_kept_core
  - candidate defensive records outside kept core: 167
  - readable records: 608
  - top groups: architecture_alignment:144, contradiction_verification:14, novelty_dynamic:13, boundary_scope_authority:11
- S3_046__2936557B-8297-4A34-8D53-9B905F7197A0.docx
  - bucket: trim_retrieval_intelligence
  - candidate defensive records outside kept core: 152
  - readable records: 632
  - top groups: contradiction_verification:119, boundary_scope_authority:33, novelty_dynamic:14
- S3_056__7D5465EE-EA56-485C-B96B-452BC215B944.docx
  - bucket: trim_domain_citation
  - candidate defensive records outside kept core: 144
  - readable records: 535
  - top groups: contradiction_verification:101, hallucination_fabrication:34, novelty_dynamic:12, boundary_scope_authority:6
- S3_062__CDF57664-D66C-459B-824A-F3AE619391E9.docx
  - bucket: trim_domain_citation
  - candidate defensive records outside kept core: 144
  - readable records: 535
  - top groups: contradiction_verification:101, hallucination_fabrication:34, novelty_dynamic:12, boundary_scope_authority:6
- S4_065__Converted - CITATIONS ZERO HALLUCINATION-4.docx
  - bucket: trim_domain_citation
  - candidate defensive records outside kept core: 144
  - readable records: 535
  - top groups: contradiction_verification:101, hallucination_fabrication:34, novelty_dynamic:12, boundary_scope_authority:6
- S4_066__Converted - CITATIONS ZERO HALLUCINATION.docx
  - bucket: trim_domain_citation
  - candidate defensive records outside kept core: 144
  - readable records: 535
  - top groups: contradiction_verification:101, hallucination_fabrication:34, novelty_dynamic:12, boundary_scope_authority:6
- S3_040__0E1D0B23-809A-4294-94BD-CFB617A3A848.docx
  - bucket: trim_packaging
  - candidate defensive records outside kept core: 133
  - readable records: 352
  - top groups: hallucination_fabrication:80, contradiction_verification:55, boundary_scope_authority:2
- S3_050__4F5879D5-CCCA-4C95-B602-105CAA66BD7E.docx
  - bucket: trim_packaging
  - candidate defensive records outside kept core: 133
  - readable records: 352
  - top groups: hallucination_fabrication:80, contradiction_verification:55, boundary_scope_authority:2
- S3_052__57EF9527-3A7C-4FE4-9966-8F5CE87A4DFE.docx
  - bucket: trim_writing
  - candidate defensive records outside kept core: 117
  - readable records: 474
  - top groups: architecture_alignment:40, contradiction_verification:39, novelty_dynamic:26, boundary_scope_authority:25
- S4_067__Converted - COMPLETE AI FAILURE PERIODIC TABLE.docx
  - bucket: duplicate_of_kept_core
  - candidate defensive records outside kept core: 107
  - readable records: 513
  - top groups: hallucination_fabrication:56, contradiction_verification:23, boundary_scope_authority:14, novelty_dynamic:12
- S3_058__A207B2EA-46D3-4F97-A821-727CFF9412A3.docx
  - bucket: trim_packaging
  - candidate defensive records outside kept core: 69
  - readable records: 275
  - top groups: hallucination_fabrication:18, contradiction_verification:18, boundary_scope_authority:17, novelty_dynamic:14
- S4_069__Converted - LML System Ryan Gatoloai-Faupula  copy.docx
  - bucket: trim_packaging
  - candidate defensive records outside kept core: 69
  - readable records: 275
  - top groups: hallucination_fabrication:18, contradiction_verification:18, boundary_scope_authority:17, novelty_dynamic:14
- S3_047__3A597554-7524-44BD-9A63-C80CE9E45367.docx
  - bucket: trim_ui
  - candidate defensive records outside kept core: 68
  - readable records: 445
  - top groups: contradiction_verification:39, boundary_scope_authority:20, architecture_alignment:6, novelty_dynamic:3
- S4_071__Converted - UI UX LML NSL INTEGRATION.docx
  - bucket: trim_ui
  - candidate defensive records outside kept core: 68
  - readable records: 445
  - top groups: contradiction_verification:39, boundary_scope_authority:20, architecture_alignment:6, novelty_dynamic:3
- S3_061__C8B312BB-AAC7-4B6C-BC62-21892871CA4B.docx
  - bucket: trim_packaging
  - candidate defensive records outside kept core: 55
  - readable records: 351
  - top groups: hallucination_fabrication:19, contradiction_verification:16, novelty_dynamic:9, boundary_scope_authority:7
- S4_074__Converted - older version but needed for understanding.docx
  - bucket: trim_packaging
  - candidate defensive records outside kept core: 55
  - readable records: 351
  - top groups: hallucination_fabrication:19, contradiction_verification:16, novelty_dynamic:9, boundary_scope_authority:7
- S3_049__4F120F55-90E3-4F8A-BEF6-E6C59B2D1A4A.docx
  - bucket: trim_ontology
  - candidate defensive records outside kept core: 35
  - readable records: 291
  - top groups: contradiction_verification:20, boundary_scope_authority:14, novelty_dynamic:4
