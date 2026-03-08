# Case GPS Engineering Brief (Lawyer + Client Portals)

Version: `1.0.0`
Date: `2026-02-16`
Status: `Implementation baseline`

## 1) Product Intent
Build a **single secure system** with **two UIs**:
1. Lawyer Portal (control plane)
2. Client Portal (Case GPS read-mostly timeline)

Goal: reduce client anxiety and communication overload via transparent case motion tracking.

## 2) Hard Safety Rules (Non-Negotiable)
1. **No AI touches case decisions, legal strategy, legal advice, or client legal answers.**
2. AI may only be used for non-substantive UX formatting (optional).
3. Lawyer-authored content is the source of truth for case timeline/status/notes.
4. Non-admissible legal state returns `NULL` per LML contract.
5. Full audit trail for all case updates and communications.

## 3) Architecture (One System, Two Doors)
Single deployment boundary (same trusted runtime), two role-scoped experiences:
- `/legal` -> Lawyer Portal
- `/case` -> Client Portal

Shared backend services:
- Auth/RBAC
- Case timeline service
- Message service
- Document service
- LML/SNAP enforcement service
- Audit ledger

## 4) Role and Permission Model
### Lawyer
Can:
- create/edit case timeline steps
- update status, ETA, and one-line notes
- upload documents (mark client-visible vs private)
- configure auto-responses per case
- view all own-firm cases authorized to that user

### Client
Can:
- view only own case timeline
- view latest status, next step, ETA, update notes
- download client-visible docs only
- submit async question
Cannot:
- edit timeline
- view private/legal-strategy notes
- access AI tools

## 5) Core UX Behavior
### Lawyer Portal
- Case list -> Case detail -> Timeline editor
- Update action should be fast (target <= 10 seconds):
  - status change
  - short reason note
  - optional ETA
  - optional client-visible flag
- “Client View Preview” mirrors client-visible output exactly

### Client Portal (Case GPS)
- Progress view like delivery tracking:
  - current stage
  - last update timestamp
  - next expected step + ETA
  - short reason notes for delays/changes
- 24/7 self-serve visibility to reduce panic and repetitive calls

## 6) Messaging Pattern (Async, Not Chat)
Client may submit questions anytime.
System sends immediate lawyer-authored auto-acknowledgment (preset template), e.g.:
- "Message received. I will review during my update window."

Lawyer responds when available.
No live-chat obligation.
No AI-generated legal responses.

## 7) Timeline Data Contract (Minimum)
CaseTimelineStep:
- id
- case_id
- stage_key
- status (`waiting|in_progress|delayed|complete`)
- note_public (lawyer-authored short text)
- eta_text (optional)
- last_action_at
- updated_by
- client_visible (bool)

CaseMessage:
- id
- case_id
- sender_role (`client|lawyer|system`)
- body
- auto_ack (bool)
- created_at
- visible_to_client (bool)

CaseDocument:
- id
- case_id
- file_ref
- visibility (`client|lawyer_private`)
- uploaded_by
- created_at

## 8) Audit and Compliance
Every state mutation logs immutable event:
- actor
- action
- case_id
- before/after summary
- timestamp
- visibility scope

This supports proof of communication and timeline transparency.

## 9) Demo vs Product Boundary
### Demo (public proof mode)
- one document/run
- no multi-turn case workflow
- no external legal retrieval
- no export pipeline for filing use
- watermark: not legal product

### Product (paid operational mode)
- full case lifecycle
- lawyer/client portals enabled
- strict legal gates fail-closed
- immutable audit/ledger required

## 10) Out of Scope (V1)
1. AI-generated legal advice to clients
2. autonomous legal strategy generation
3. auto-filing or court submission automation
4. cross-client analytics in client portal

## 11) Acceptance Criteria (V1)
1. Lawyer can define full case journey and update steps quickly.
2. Client can always see current stage, latest movement, next step, ETA.
3. Client can submit question and receive immediate preset acknowledgment.
4. Lawyer can respond asynchronously from centralized inbox.
5. Private notes and strategy never leak to client view.
6. All updates are timestamped and auditable.
7. Product mode enforces LML admissibility and fail-closed behavior.

