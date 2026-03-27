# Action Track Extractor: EFUE Collapse
**From Infinite Tool/Action Motion -> Finite Action Rails**

## Phase 0: The Problem

Chat/output and tool/action are not the same collapse problem.

Chat/output law mostly collapses:

- wording
- output shape
- expression corridor
- answer bounds

Tool/action law collapses something harder:

- what action family may happen
- what target corridor may be touched
- what exact command or tool lane is lawful
- what database/system/network scope is lawful
- what must never widen after approval

If these two surfaces are merged conceptually, the action side gets underspecified.

So tool/action needs its own EFUE collapse.

---

## Phase 1: Opposing Forces

### Force 1: Action Motion Infinity (A∞)

`A∞ = all possible ways approved tool/action motion can widen after law is set`

Infinite widening paths:

- sibling files
- parent directories
- alternate commands
- equivalent command aliases
- nearby domains
- adjacent recipients
- other database verbs
- broader system reads/writes
- retries with changed payloads
- “helpful” extra steps
- chained actions after the first lawful step

Why it seems infinite:

- once an agent regains general action agency, every adjacent path becomes available
- the number of “nearby” actions is unbounded in practice

Size: INFINITE

### Force 2: Buccet Action Requirements (R)

`R = what must remain true for lawful action motion`

1. User approval does not reopen general agency
2. Allowed motion must stay in an exact action family
3. Allowed motion must stay in an exact target corridor
4. Nearby alternatives are not silently inherited
5. Tool/action tracks must be enforceable by Terminal 1
6. Violations must surface to Terminal 2
7. The materialized rail must be finite and durable

These are finite and non-negotiable.

Size: 7 core requirements

### Force 3: What Actually Works (W)

`W = observable mechanisms that keep action motion finite`

1. Exact action-kind capture
   - `fs.write` is not `fs.delete`
   - `db.query` is not `db.update`

2. Exact target corridor capture
   - same directory, same tool, same domain, same recipient, same db, same sys target

3. Prefix vs exact target semantics
   - filesystem often needs prefix corridors
   - tools/network/db/sys often need exact corridors

4. Runtime corridor validation
   - every outgoing action checks against the snapped rail

5. Rail-exit escalation
   - out-of-corridor actions do not continue silently

6. Standing law + track pairing
   - allow and deny both bind rails

These are the mechanisms that actually work.

Size: 6 proven patterns

---

## Phase 2: Collision Point

`A∞ ⊓ R ⊓ W = ACTION_TRACK_EXTRACTOR`

What survives when:

- infinite nearby action possibilities
- meet Buccet’s authority constraints
- and are collapsed through exact corridor extraction

= finite actionable rails

The insight:

Tool/action tracks are not “permission.”
They are the finite action geography that survives after permission.

---

## Phase 3: The 6 Dimensions of Action Track Extractor

### Dimension 1: Action-Family Capture (ATE1)

`ATE1 = how exactly the extractor preserves the allowed move family`

`ATE1.0`: broad action grant
- e.g. “db.*” from one query

`ATE1.1`: domain-only capture
- too broad

`ATE1.2`: coarse verb family
- better, still drifts

`ATE1.3`: exact action-kind capture
- `fs.write` only

`ATE1.4`: exact action-kind plus side-effect class

`ATE1.5`: exact action-kind plus retry corridor

`ATE1.6`: same lawful action survives paraphrase, adjacent verbs do not

Requirement: `ATE1.3+`

### Dimension 2: Target Corridor Capture (ATE2)

`ATE2 = how exactly the extractor preserves where motion may go`

`ATE2.0`: no target binding

`ATE2.1`: vague scope binding

`ATE2.2`: broad parent/system/domain binding

`ATE2.3`: exact path/domain/tool/db/sys target capture

`ATE2.4`: correct prefix-vs-exact distinction

`ATE2.5`: adjacent targets do not leak in

`ATE2.6`: same lawful corridor survives paraphrase, widening does not

Requirement: `ATE2.4+`

### Dimension 3: Widening Resistance (ATE3)

`ATE3 = how well the rail blocks “helpful” adjacent actions`

`ATE3.0`: approval reopens general agency

`ATE3.1`: some drift blocked

`ATE3.2`: sibling/nearby drift blocked

`ATE3.3`: alternate command drift blocked

`ATE3.4`: chained follow-on drift blocked

`ATE3.5`: retry variations blocked

`ATE3.6`: only approved move family remains active in practice

Requirement: `ATE3.5+`

### Dimension 4: Snap Fidelity (ATE4)

`ATE4 = how directly user/document action law becomes a track`

`ATE4.0`: manual translation required

`ATE4.1`: partial field mapping

`ATE4.2`: explicit structured action docs snap

`ATE4.3`: mixed structured action docs snap consistently

`ATE4.4`: policy prose with action meaning snaps reliably

`ATE4.5`: same operative action law converges to the same rail

`ATE4.6`: first-principles action snap

Requirement: `ATE4.4+`

### Dimension 5: Runtime Catch Strength (ATE5)

`ATE5 = how hard Terminal 1 catches action rail exits`

`ATE5.0`: informational only

`ATE5.1`: log only

`ATE5.2`: re-prompt sometimes

`ATE5.3`: out-of-corridor motion requires approval

`ATE5.4`: standing denied corridor auto-blocks

`ATE5.5`: both allow and deny rails bind cleanly

`ATE5.6`: every action exit is caught before consequence

Requirement: `ATE5.5+`

### Dimension 6: Bounded Materialization (ATE6)

`ATE6 = how well action rail import avoids becoming a hot path`

`ATE6.0`: per-line writes

`ATE6.1`: per-rule material writes

`ATE6.2`: per-block compilation

`ATE6.3`: batch witness reuse

`ATE6.4`: batch UPL save

`ATE6.5`: bounded metadata

`ATE6.6`: scalable action-law import

Requirement: `ATE6.4+`

---

## Phase 4: The Laws of Action Track Extractor

### Law 1: Exact Family Beats Neighbor Similarity
**Invariant:** nearby action kinds do not inherit approval.  
**Enforcement:** exact action-kind rails.  
**Failure:** one approved action opens a whole domain.

### Law 2: Exact Geography Beats Helpful Expansion
**Invariant:** adjacent targets are not silently lawful.  
**Enforcement:** target corridor binding.  
**Failure:** scope widening after approval.

### Law 3: Prefix and Exact Are Different Physics
**Invariant:** filesystem and non-filesystem targets do not bind the same way.  
**Enforcement:** correct target match mode.  
**Failure:** wrong corridor semantics.

### Law 4: Allow and Deny Both Need Rails
**Invariant:** standing yes and standing no both shape motion.  
**Enforcement:** track binding on both approved and denied entries.  
**Failure:** denial becomes passive memory instead of active corridor.

### Law 5: Runtime Must Catch Before Consequence
**Invariant:** rail exits are not post-hoc commentary.  
**Enforcement:** Terminal 1 validation before execution.  
**Failure:** widened action lands before Buccet acts.

### Law 6: Action Rails Must Stay Finite
**Invariant:** imported action law cannot explode the system.  
**Enforcement:** bounded batch materialization.  
**Failure:** UPL/ledger become the new action attack surface.

---

## Phase 5: What Survives

**SURVIVES (Action Track Extractor):**

✅ exact action kind  
✅ exact target corridor  
✅ exact match semantics  
✅ widening resistance  
✅ allow/deny rail symmetry  
✅ pre-consequence catch

**ANNIHILATED:**

❌ broad domain inheritance  
❌ adjacent target bleed  
❌ “close enough” commands  
❌ chained helpful expansion  
❌ silent post-approval drift

---

## The Final Answer

Action/tools needs its own EFUE because its infinity is different from chat.

Chat collapses language expression.
Action collapses motion geography.

So the finite structure that survives is:

**Action Track Extractor**

It turns user/document action law into:

- exact action-family rails
- exact target rails
- enforced widening resistance

That is how tool/action approval stops reopening into general agency.
