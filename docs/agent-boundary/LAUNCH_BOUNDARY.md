# Agent Buccet Launch Boundary

## What Works Out Of The Box

Agent Buccet is launchable today as an add-on containment layer.

Out of the box, Agent Buccet already gives you:
- persistent sessions
- explicit scope and grants
- deny / allow / require approval enforcement
- append-only ledger with canonical entry structure
- ledger query, verify, rollup, and repair commands
- defensive meta-law enforcement
- thin user-space `buccet` command shell
- wrapper CLI for process-level attachment
- integration surfaces for existing agent stacks
- intercept server transport and intercept-daemon stdin/stdout proxy over that same path
- system-intercept seam for future low-level hooks
- gravity bridge front-layer for socket-fed deep intercept sensors
- hook daemon and native preload path for freeze-and-forward OS interception
- shared Gravity funnel normalization for raw gravity, system, and framework feeders
- gravity on the action path
- supervisor for restart and daemon health
- hosted-ready release artifacts under `dist/releases/`
- checkpoint witness publishing for stronger external attestation

Current install shell:
- `sh dist/releases/install.sh`
- `buccet status`
- `buccet scope add <path>`
- `buccet run -- <command>`
- `buccet hook build`
- `buccet hook start`
- `buccet hook run -- <command>`
- `buccet logs`
- `buccet uninstall`

## What We Can Claim Now

We can claim:
- Agent Buccet adds hard boundaries to existing agent stacks
- dangerous or out-of-scope actions are blocked or routed to approval
- prompt content does not become authority
- opened scope becomes lawful scope for the session
- the bodyguard persists across restart until the user ends the session
- the ledger is part of the trust boundary, not secondary logging
- developers can use the wrapper and intercept surfaces today without waiting for deep OS integration
- the public feeder surfaces collapse into one Gravity funnel before Buccet decides anything
- the native hook waits indefinitely for the Buccet brain unless the hook supervisor explicitly marks the brain dead
- hosted install can be served as a single `curl ... | sh` entrypoint once release artifacts are published

## What We Should Not Claim Yet

We should not claim:
- full OS/kernel interception is complete
- all possible process/syscall paths are already mediated
- the ledger has full remote witness/signing/checkpoint infrastructure
- Agent Buccet already includes every possible future deployment-depth layer

## Advanced Depth

The main advanced layer is deeper OS-level interception.

That means:
- kernel hooks
- low-level syscall interception
- platform-specific transport from OS events into Agent Buccet

The important point is that the seam already exists.
The current system-intercept bridge and intercept server are the stable handoff points for that deeper work.

That deeper layer is not required to validate the public containment model.
It is a higher-assurance deployment choice for personal or swarm environments that want an earlier catch net.

## Recommended Launch Wording

Use:
- Bring your own agent. Add Buccet for containment.
- Works today with wrapper and boundary transports.
- Optional deeper OS-level interception can be added on top of the same Buccet brain.

Avoid:
- claiming total kernel mediation today
- implying every process path is already impossible to bypass
- blurring current wrapper/intercept transport with final low-level interception depth
