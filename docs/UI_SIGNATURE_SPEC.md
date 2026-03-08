# Legal LML UI Signature Spec

Version: `1.0.0`
Date: `2026-02-16`
Status: `Canonical UI law spec`

## 0) System Shape
Two web apps in one system:
1. Lawyer Portal (control surface / power tool)
2. Client GPS Portal (read-only timeline + simple actions)

## 1) Non-Negotiable UI Laws
- `LML.UI.1` Capacity Constraint
- `LML.UI.2` Feedback Responsiveness
- `LML.UI.3` Error Recoverability
- `LML.UI.4` Learnability Fit
- `LML.UI.5` Navigation Transparency
- `LML.UI.6` Visual Hierarchy
- `LML.UI.7` Interaction Consistency
- `LML.UI.8` Dimensional Coherence
- `LML.UI.9` Accessibility Baseline (WCAG AA)

## 2) EFUE Signature Ranges

### 2.1 Lawyer Portal Signature
`UI_SIGNATURE_LAWYER`
- U1 Information Density: `3–5`
- U2 Interaction Directness: `4–6`
- U3 Feedback Immediacy: `2–3`
- U4 Error Tolerance: `2–4`
- U5 Learning Curve: `4–6`
- U6 Navigation Structure: `3–5`
- U7 Visual Hierarchy: `4–6`
- U8 Interaction Paradigm: `2–3`
- U9 Personalization: `3–5`

### 2.2 Client GPS Portal Signature
`UI_SIGNATURE_CLIENT`
- U1 Information Density: `1–2`
- U2 Interaction Directness: `1–3`
- U3 Feedback Immediacy: `2–3`
- U4 Error Tolerance: `0–2`
- U5 Learning Curve: `0–2`
- U6 Navigation Structure: `0–2`
- U7 Visual Hierarchy: `3–5`
- U8 Interaction Paradigm: `1–2`
- U9 Personalization: `0–1`

## 3) Global Architecture Rules
- Shared status banner, feedback system, a11y primitives, audit emitter.
- Auth identity split:
  - Lawyer: account + role + firm/workspace
  - Client: case-linked identity (magic link/OTP)
- Permission model:
  - Lawyer: full case controls
  - Staff: limited operations
  - Client: view timeline, submit question, upload requested docs

## 4) Lawyer Portal Screen Contract
Global nav max: `5–7` primary items:
1. Cases
2. Gates / Checks
3. Documents
4. Citations
5. Messages
6. Audit Log
7. Settings (optional)

Core screens:
- Cases List
- Case Dashboard
- Gates / Proof Chain Console
- Documents
- Citations (verified workflow only)
- Messages
- Audit Log

## 5) Client GPS Screen Contract
Core screens:
- Case Home (status + next step + last update + timeline)
- Timeline Detail
- Upload Task
- Ask a Question

Rules:
- No dense menus
- No legal jargon by default
- No unnecessary multistep forms
- Always one obvious next action

## 6) State Machine and Locks
- Hard gate blocks filing/export/mark-complete transitions.
- Proof events are immutable audit events:
  - `ATTESTATION`
  - `ARTIFACT_UPLOAD`
  - `SECOND_WITNESS`
  - `GATE_PASS`
  - `GATE_FAIL`

## 7) Performance Budgets
- Interaction feedback visible: `<200ms`
- Initial load target: `<2s`
- Long ops: progress + safe-to-leave messaging

## 8) Accessibility Baseline
- Keyboard-navigable primary flows
- Visible focus states
- Proper form labels + linked errors
- WCAG AA contrast/compliance

## 9) Forbidden UI Combos (Reject)
- Client portal dense dashboard patterns
- Destructive action without confirm/undo
- >7 simultaneous primary choices on one screen
- Inconsistent control behavior across screens
- Any legal claim that "AI says this is correct" in compliance contexts

## 10) Required Engineering Deliverables
1. Two frontends: lawyer portal + client GPS portal
2. Single source-of-truth signature config
3. Gate console with proof logging + locks
4. Audit log UI consuming immutable events
5. Client GPS timeline fed by case timeline entries

