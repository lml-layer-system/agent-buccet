# Base Denial Pack Inventory

> Generated from Buccet denial sources. Regenerate with `node scripts/render-agent-buccet-base-denial-pack.ts`.

This document enumerates the live shipped base Buccet denial UPL pack.

It is one denial-side UPL system. Runtime still compiles it into the same live field as acceptance, and deny overrides acceptance on overlap.

## Summary

- Total denial-side UPL entries: 752
- Core walls: 32
- Boundary walls: 4
- Periodic taxonomy walls: 340
- Buccet failure walls: 62
- Base catalog walls: 224
- Frontier/system-card alias walls: 90

## Buccet Labels

- `DENY.<CORE_CLASS>.*`: built-in Buccet standing walls for destructive, secret, exfiltration, spoofing, tamper, and related classes.
- `DENY.BOUNDARY.*`: Buccet boundary walls for scope, law, session, and ledger/proof abuse.
- `DENY.PERIODIC.*`: periodic failure taxonomy rows and dimensions carried into the same denial-side UPL field.
- `DENY.BUCCET.*`: Buccet failure dimensions, containment laws, and failure rows carried into the same denial-side UPL field.
- `DENY.BASE.CATALOG.*`: base Buccet denial catalog rows carried into the same denial-side UPL field.
- `DENY.BASE.ALIAS.*`: frontier/system-card alias vocabulary carried into the same denial-side UPL field.

## Read This

Every entry below uses the same fields:

- `What it is`: the plain-language job of the denial entry.
- `Connects to`: the target corridors, request-text triggers, or required flags that activate it.
- `Action kinds`: the motion kinds it applies to.
- `Bounds`: the exact limit of the wall. Deny still wins on overlap everywhere.

## Core Walls (32)

### DENY.PERSISTENCE.001A
What it is: Silent persistence is forbidden in headless mode.
Connects to: bounded target corridor `*/.bashrc`; bounded target corridor `*/.zshrc`; bounded target corridor `*/.profile`; bounded target corridor `*/rc.local`; bounded target corridor `*/LaunchAgents/*`; bounded target corridor `*/LaunchDaemons/*`; bounded target corridor `*/systemd/*`; bounded target corridor `*/init.d/*`; bounded target corridor `*/cron*`; bounded target corridor `*/crontab*`; bounded target corridor `*/autorun*`; bounded target corridor `*/startup*`; bounded target corridor `*/runonce*`.
Action kinds: `fs.write`.
Bounds: listed target corridors only; deny wins on overlap.

### DENY.PERSISTENCE.001B
What it is: Silent persistence is forbidden in headless mode.
Connects to: request text trigger `*crontab *`; request text trigger `*systemctl enable*`; request text trigger `*schtasks*`; request text trigger `*reg add*run*`; request text trigger `*launchctl load*`; request text trigger `*launchctl bootstrap*`; request text trigger `*sc create*`.
Action kinds: `tool.exec`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.SECURITY.WEAKENING.002A
What it is: Security control weakening is forbidden in headless mode.
Connects to: request text trigger `*ufw disable*`; request text trigger `*iptables -f*`; request text trigger `*set-mppreference*`; request text trigger `*sc stop windefend*`; request text trigger `*spctl --master-disable*`; request text trigger `*defaults write*gatekeeper*`; request text trigger `*disable firewall*`; request text trigger `*turn off defender*`; request text trigger `*executionpolicy bypass*`.
Action kinds: `tool.exec`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.SECURITY.WEAKENING.002B
What it is: Security control weakening is forbidden in headless mode.
Connects to: bounded target corridor `*/Windows Defender/*`; bounded target corridor `*/firewall/*`; bounded target corridor `*/security/*`; bounded target corridor `*/Gatekeeper*`; bounded target corridor `*/ExecutionPolicy*`.
Action kinds: `fs.write`, `sys.config.write`.
Bounds: listed target corridors only; deny wins on overlap.

### DENY.SECRETS.ACCESS.003A
What it is: Secret or credential access is forbidden without explicit law.
Connects to: bounded target corridor `*/.env`; bounded target corridor `*/.ssh`; bounded target corridor `*/.ssh/*`; bounded target corridor `*/.gnupg`; bounded target corridor `*/.gnupg/*`; bounded target corridor `*/.aws`; bounded target corridor `*/.aws/*`; bounded target corridor `*/.config/gcloud`; bounded target corridor `*/.config/gcloud/*`; bounded target corridor `*/.npmrc`; bounded target corridor `*/.pypirc`; bounded target corridor `*/secrets`; bounded target corridor `*/secrets/*`; bounded target corridor `*/credentials`; bounded target corridor `*/credentials/*`; bounded target corridor `*/id_rsa*`; bounded target corridor `*/id_ed25519*`; bounded target corridor `*/keychain*`; bounded target corridor `*/wallet*`; bounded target corridor `*/seed*`; bounded target corridor `*/keystore*`; bounded target corridor `*/cookies*`; bounded target corridor `*/token*`.
Action kinds: `fs.read`, `sys.env.read`.
Bounds: listed target corridors only; deny wins on overlap.

### DENY.SECRETS.ACCESS.003B
What it is: Secret or credential access is forbidden without explicit law.
Connects to: request text trigger `*security find-generic-password*`; request text trigger `*security find-internet-password*`; request text trigger `*pass *`; request text trigger `*secret-tool *`; request text trigger `*cmdkey *`; request text trigger `*vault *`.
Action kinds: `tool.exec`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.SECRETS.ACCESS.003C
What it is: Secret or credential access is forbidden without explicit law.
Connects to: global Buccet denial target `base-headless-denials:credential-surface`.
Action kinds: `sys.credential.read`, `sys.credential.use`.
Bounds: global standing wall; deny wins on overlap.

### DENY.EXFILTRATION.004A
What it is: Outbound data movement is forbidden without explicit law.
Connects to: request text trigger `*curl * --upload-file *`; request text trigger `*wget * --post-file=*`; request text trigger `*scp *`; request text trigger `*rsync *:*`; request text trigger `*nc *`; request text trigger `*ncat *`; request text trigger `*ftp *`; request text trigger `*invoke-webrequest* -method post*`; request text trigger `*post *`; request text trigger `*upload *`.
Action kinds: `tool.exec`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.EXFILTRATION.004B
What it is: Outbound data movement is forbidden without explicit law.
Connects to: bounded target corridor `*webhook*`; bounded target corridor `*telegram*`; bounded target corridor `*discord*`; bounded target corridor `*slack*`; bounded target corridor `*smtp*`; bounded target corridor `*ftp://*`; bounded target corridor `*tor*`.
Action kinds: `network.send`.
Bounds: listed target corridors only; deny wins on overlap.

### DENY.AUTHORITY.SPOOFING.004C
What it is: Prompt or model output cannot self-authorize or claim authority.
Connects to: required flag `authorityClaimed`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed flags must be present; deny wins on overlap.

### DENY.AUTHORITY.SPOOFING.004D
What it is: Prompt or model output cannot claim perfect safety or complete coverage.
Connects to: required flag `claimsCompleteCoverage`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed flags must be present; deny wins on overlap.

### DENY.AUTHORITY.SPOOFING.004E
What it is: Prompt or model output cannot claim the user already approved the action.
Connects to: required flag `claimsUserApproval`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed flags must be present; deny wins on overlap.

### DENY.AUTHORITY.SPOOFING.004F
What it is: Prompt or model output cannot claim completion without witness evidence.
Connects to: required flag `claimsActionCompletionWithoutWitness`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed flags must be present; deny wins on overlap.

### DENY.AUTHORITY.SPOOFING.004J
What it is: Output cannot violate an explicit user constraint.
Connects to: required flag `violatesUserConstraint`.
Action kinds: `chat.emit`.
Bounds: listed flags must be present; deny wins on overlap.

### DENY.AUTHORITY.SPOOFING.004K
What it is: Output cannot conflict with grounding or supporting evidence.
Connects to: required flag `groundingMismatch`.
Action kinds: `chat.emit`.
Bounds: listed flags must be present; deny wins on overlap.

### DENY.SENSITIVE.EGRESS.004G
What it is: Outbound PII is forbidden without explicit law.
Connects to: required flag `payloadContainsPii`.
Action kinds: `chat.emit`, `network.send`, `comm.send`.
Bounds: listed flags must be present; deny wins on overlap.

### DENY.SENSITIVE.EGRESS.004H
What it is: Outbound credentials or secrets are forbidden without explicit law.
Connects to: required flag `payloadContainsCredential`.
Action kinds: `chat.emit`, `network.send`, `comm.send`.
Bounds: listed flags must be present; deny wins on overlap.

### DENY.SENSITIVE.EGRESS.004I
What it is: Outbound financial data is forbidden without explicit law.
Connects to: required flag `payloadContainsFinancialData`.
Action kinds: `chat.emit`, `network.send`, `comm.send`.
Bounds: listed flags must be present; deny wins on overlap.

### DENY.PRIVILEGE.ESCALATION.005
What it is: Privilege escalation is forbidden in headless mode.
Connects to: request text trigger `sudo *`; request text trigger `su *`; request text trigger `runas *`; request text trigger `*chmod 777 *`; request text trigger `*chmod +s *`; request text trigger `*setcap *`; request text trigger `*icacls * /grant *`.
Action kinds: `tool.exec`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.STEALTH.EVASION.006
What it is: Stealth, concealment, or anti-analysis behavior is forbidden.
Connects to: request text trigger `*vmdetect*`; request text trigger `*sandbox*detect*`; request text trigger `*sleep 300*`; request text trigger `*timeout /t 300*`; request text trigger `*wevtutil cl*`; request text trigger `*clear-eventlog*`; request text trigger `*history -c*`; request text trigger `*rm *history*`; request text trigger `*steganograph*`; request text trigger `*stealth decoding*`; request text trigger `*hidden trigger*`; request text trigger `*sleeper trigger*`; request text trigger `*plausible deniability*`; request text trigger `*capability concealment*`; request text trigger `*evaluator model*`; request text trigger `*obfus*`; request text trigger `*hide *`.
Action kinds: `tool.exec`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PROPAGATION.007A
What it is: Self-propagation or lateral spread is forbidden.
Connects to: bounded target corridor `*/autorun.inf`; bounded target corridor `*/usb/*`; bounded target corridor `*/network-share/*`.
Action kinds: `fs.write`.
Bounds: listed target corridors only; deny wins on overlap.

### DENY.PROPAGATION.007B
What it is: Self-propagation or lateral spread is forbidden.
Connects to: request text trigger `net use *`; request text trigger `wmic * process call create *`; request text trigger `psexec *`; request text trigger `scp *:*`; request text trigger `smbclient *`; request text trigger `*agent worm*`; request text trigger `*self-propagat*`; request text trigger `*replicate across agents*`; request text trigger `*forward to every agent*`; request text trigger `*copy to usb*`; request text trigger `*replicate *`; request text trigger `*spread *`; request text trigger `*lateral *`.
Action kinds: `tool.exec`, `network.send`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.LAW.TAMPER.008A
What it is: Law, tracks, witness, or control-plane tampering is forbidden.
Connects to: bounded target corridor `*/upl/*`; bounded target corridor `*/law/*`; bounded target corridor `*/tracks/*`; bounded target corridor `*/ledger/*`; bounded target corridor `*/witness/*`; bounded target corridor `*/buccet/config/*`; bounded target corridor `*/.buccet/*`.
Action kinds: `fs.write`, `fs.delete`, `fs.move`, `sys.config.write`.
Bounds: listed target corridors only; deny wins on overlap.

### DENY.LAW.TAMPER.008B
What it is: Law, tracks, witness, or control-plane tampering is forbidden.
Connects to: request text trigger `kill *buccet*`; request text trigger `pkill *buccet*`; request text trigger `rm *ledger*`; request text trigger `truncate *ledger*`; request text trigger `rm *upl*`; request text trigger `rm *tracks*`; request text trigger `*lawpack tamper*`; request text trigger `*unsigned update*`; request text trigger `*forged receipt*`; request text trigger `*history forgery*`; request text trigger `*audit invalidation*`; request text trigger `*disable buccet*`.
Action kinds: `tool.exec`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.DESTRUCTIVE.MASS.009A
What it is: Destructive mass mutation is forbidden in headless mode.
Connects to: request text trigger `rm -rf *`; request text trigger `del /s /q *`; request text trigger `shred *`; request text trigger `cipher /w:*`; request text trigger `*encrypt* --all*`; request text trigger `*wipe *`; request text trigger `format *`.
Action kinds: `tool.exec`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.DESTRUCTIVE.MASS.009B
What it is: Destructive mass mutation is forbidden in headless mode.
Connects to: request text trigger `*recursive*`; request text trigger `*mass*`; request text trigger `*broad*`; request text trigger `*overwrite*`; request text trigger `*encrypt*`.
Action kinds: `fs.delete`, `fs.move`, `fs.write`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.SENSITIVE.CAPTURE.010
What it is: Sensitive capture is forbidden without explicit law.
Connects to: global Buccet denial target `base-headless-denials:sensitive-capture`.
Action kinds: `camera.capture`, `microphone.capture`, `screen.capture`, `clipboard.read`, `browser.session.read`.
Bounds: global standing wall; deny wins on overlap.

### DENY.SYSTEM.MUTATION.011A
What it is: System-level mutation is forbidden without explicit law.
Connects to: bounded target corridor `/etc/*`; bounded target corridor `/usr/bin/*`; bounded target corridor `/usr/local/bin/*`; bounded target corridor `c:/windows/*`; bounded target corridor `c:/program files/*`; bounded target corridor `*/library/preferences/*`; bounded target corridor `*/registry/*`.
Action kinds: `fs.write`, `sys.config.write`.
Bounds: listed target corridors only; deny wins on overlap.

### DENY.SYSTEM.MUTATION.011B
What it is: System-level mutation is forbidden without explicit law.
Connects to: request text trigger `apt install*`; request text trigger `yum install*`; request text trigger `dnf install*`; request text trigger `brew install*`; request text trigger `winget install*`; request text trigger `choco install*`; request text trigger `reg add*`; request text trigger `defaults write*`.
Action kinds: `tool.exec`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.EXTERNAL.COMMUNICATION.012A
What it is: External communication is forbidden without explicit law.
Connects to: bounded target corridor `*@*`; bounded target corridor `*slack.com*`; bounded target corridor `*discord*`; bounded target corridor `*telegram*`; bounded target corridor `*webhook*`; bounded target corridor `*smtp*`.
Action kinds: `comm.send`, `email.send`, `message.send`.
Bounds: listed target corridors only; deny wins on overlap.

### DENY.EXTERNAL.COMMUNICATION.012B
What it is: External communication is forbidden without explicit law.
Connects to: bounded target corridor `*webhook*`; bounded target corridor `*telegram*`; bounded target corridor `*discord*`; bounded target corridor `*slack*`; bounded target corridor `*smtp*`; bounded target corridor `*messaging*`.
Action kinds: `network.send`.
Bounds: listed target corridors only; deny wins on overlap.

### DENY.DESTRUCTIVE.DELETE.009C
What it is: File deletion is destructive and denied by default.
Connects to: global Buccet denial target `base-headless-denials:destructive-delete-default`.
Action kinds: `fs.delete`.
Bounds: global standing wall; deny wins on overlap.

## Boundary Walls (4)

### DENY.BOUNDARY.SCOPE.004L
What it is: Prompt or output cannot widen reachable scope by itself.
Connects to: required flag `requestsScopeExpansion`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed flags must be present; deny wins on overlap.

### DENY.BOUNDARY.LAW.004M
What it is: Prompt or output cannot mutate law, guardrails, or boundary policy.
Connects to: required flag `requestsLawMutation`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed flags must be present; deny wins on overlap.

### DENY.BOUNDARY.SESSION.004N
What it is: Prompt or output cannot revive prior sessions or dead grants.
Connects to: required flag `requestsSessionRevival`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed flags must be present; deny wins on overlap.

### DENY.BOUNDARY.LEDGER.004O
What it is: Prompt or output cannot bypass witness, proof, receipt, or ledger requirements.
Connects to: required flag `requestsLedgerBypass`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed flags must be present; deny wins on overlap.

## Periodic Taxonomy Walls (340)

### DENY.PERIODIC.PERIODIC.GROUP.1
What it is: [dimension:epistemic] Truth, knowledge, and reasoning failures.
Connects to: request text trigger `*PERIODIC.GROUP.1*`; request text trigger `*epistemic failures*`; request text trigger `*Truth, knowledge, and reasoning failures.*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.PERIODIC.GROUP.2
What it is: [dimension:agentic] Goal, planning, and deception failures.
Connects to: request text trigger `*PERIODIC.GROUP.2*`; request text trigger `*agentic failures*`; request text trigger `*Goal, planning, and deception failures.*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.PERIODIC.GROUP.3
What it is: [dimension:adversarial] Attack, bypass, and exploit failures.
Connects to: request text trigger `*PERIODIC.GROUP.3*`; request text trigger `*adversarial failures*`; request text trigger `*Attack, bypass, and exploit failures.*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.PERIODIC.GROUP.4
What it is: [dimension:alignment] Value, safety, and preference failures.
Connects to: request text trigger `*PERIODIC.GROUP.4*`; request text trigger `*alignment failures*`; request text trigger `*Value, safety, and preference failures.*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.PERIODIC.GROUP.5
What it is: [dimension:architectural] Pipeline, execution, and control failures.
Connects to: request text trigger `*PERIODIC.GROUP.5*`; request text trigger `*architectural failures*`; request text trigger `*Pipeline, execution, and control failures.*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.PERIODIC.GROUP.6
What it is: [dimension:domain] Task-specific and context-bound failures.
Connects to: request text trigger `*PERIODIC.GROUP.6*`; request text trigger `*domain failures*`; request text trigger `*Task-specific and context-bound failures.*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.PERIODIC.GROUP.7
What it is: [dimension:governance] Oversight, deployment, and compliance failures.
Connects to: request text trigger `*PERIODIC.GROUP.7*`; request text trigger `*governance failures*`; request text trigger `*Oversight, deployment, and compliance failures.*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.EPIS-STRUCT-HALL-001
What it is: [epistemic] E1.1: STRUCTURAL HALLUCINATION — System asserts truth for all inputs.
Connects to: request text trigger `*EPIS-STRUCT-HALL-001*`; request text trigger `*E1.1: STRUCTURAL HALLUCINATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.EPIS-TAIL-FAB-002
What it is: [epistemic] E1.2: DENSITY-TAIL FABRICATION — Unknown queries return 'I don't know'.
Connects to: request text trigger `*EPIS-TAIL-FAB-002*`; request text trigger `*E1.2: DENSITY-TAIL FABRICATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.EPIS-FLUENCY-003
What it is: [epistemic] E1.3: FLUENCY HEURISTIC EXPLOITATION — Form ≠ Truth.
Connects to: request text trigger `*EPIS-FLUENCY-003*`; request text trigger `*E1.3: FLUENCY HEURISTIC EXPLOITATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.EPIS-INTRINSIC-004
What it is: [epistemic] E1.4: INTRINSIC HALLUCINATION (Context contradiction) — Faithfulness to source.
Connects to: request text trigger `*EPIS-INTRINSIC-004*`; request text trigger `*E1.4: INTRINSIC HALLUCINATION (Context contradiction)*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.EPIS-EXTRINSIC-005
What it is: [epistemic] E1.5: EXTRINSIC HALLUCINATION (World contradiction) — Factual grounding.
Connects to: request text trigger `*EPIS-EXTRINSIC-005*`; request text trigger `*E1.5: EXTRINSIC HALLUCINATION (World contradiction)*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.EPIS-DECEPT-HALL-006
What it is: [epistemic] E1.6: DECEPTIVE HALLUCINATION (Coherence trap) — Reasoning must check premises.
Connects to: request text trigger `*EPIS-DECEPT-HALL-006*`; request text trigger `*E1.6: DECEPTIVE HALLUCINATION (Coherence trap)*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.EPIS-MULTI-HALL-007
What it is: [epistemic] E1.7: MULTIMODAL HALLUCINATION (Cross-modal invention) — Modality gaps must be declared.
Connects to: request text trigger `*EPIS-MULTI-HALL-007*`; request text trigger `*E1.7: MULTIMODAL HALLUCINATION (Cross-modal invention)*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.EPIS-CITE-SPOOF-008
What it is: [epistemic] E1.8: CITATION SPOOFING — All citations must exist.
Connects to: request text trigger `*EPIS-CITE-SPOOF-008*`; request text trigger `*E1.8: CITATION SPOOFING*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.EPIS-STAT-FAB-009
What it is: [epistemic] E1.9: STATISTICAL HALLUCINATION (Number fabrication) — Quantitative claims need evidence.
Connects to: request text trigger `*EPIS-STAT-FAB-009*`; request text trigger `*E1.9: STATISTICAL HALLUCINATION (Number fabrication)*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.EPIS-TEMP-HALL-010
What it is: [epistemic] E1.10: TEMPORAL HALLUCINATION (Anachronism) — Events must be temporally ordered.
Connects to: request text trigger `*EPIS-TEMP-HALL-010*`; request text trigger `*E1.10: TEMPORAL HALLUCINATION (Anachronism)*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.EPIS-GEO-HALL-011
What it is: [epistemic] E1.11: GEOGRAPHIC HALLUCINATION (Location error) — Spatial facts must be accurate.
Connects to: request text trigger `*EPIS-GEO-HALL-011*`; request text trigger `*E1.11: GEOGRAPHIC HALLUCINATION (Location error)*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.EPIS-ATTRIB-HALL-012
What it is: [epistemic] E1.12: ATTRIBUTION HALLUCINATION (Misattribution) — Attribution must be verified.
Connects to: request text trigger `*EPIS-ATTRIB-HALL-012*`; request text trigger `*E1.12: ATTRIBUTION HALLUCINATION (Misattribution)*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.EPIS-REASON-ILLUSION-013
What it is: [epistemic] E2.1: ILLUSION OF THINKING (Complexity abandon) — More thinking ≠ worse solutions.
Connects to: request text trigger `*EPIS-REASON-ILLUSION-013*`; request text trigger `*E2.1: ILLUSION OF THINKING (Complexity abandon)*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.EPIS-LOGIC-CONTRA-014
What it is: [epistemic] E2.2: SELF-CONTRADICTION (Logic failure) — Logical consistency.
Connects to: request text trigger `*EPIS-LOGIC-CONTRA-014*`; request text trigger `*E2.2: SELF-CONTRADICTION (Logic failure)*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.EPIS-TRANS-FAIL-015
What it is: [epistemic] E2.3: TRANSITIVE FAILURE (Relation error) — Transitive relations must hold.
Connects to: request text trigger `*EPIS-TRANS-FAIL-015*`; request text trigger `*E2.3: TRANSITIVE FAILURE (Relation error)*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.EPIS-MAGIC-THINK-016
What it is: [epistemic] E2.4: MAGICAL THINKING (Constraint violation) — Solutions must be physically/logically possible.
Connects to: request text trigger `*EPIS-MAGIC-THINK-016*`; request text trigger `*E2.4: MAGICAL THINKING (Constraint violation)*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.EPIS-CIRCULAR-017
What it is: [epistemic] E2.5: CIRCULAR REASONING — Proof must not be circular.
Connects to: request text trigger `*EPIS-CIRCULAR-017*`; request text trigger `*E2.5: CIRCULAR REASONING*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.EPIS-FALSE-DICHO-018
What it is: [epistemic] E2.6: FALSE DICHOTOMY — Option space must be complete.
Connects to: request text trigger `*EPIS-FALSE-DICHO-018*`; request text trigger `*E2.6: FALSE DICHOTOMY*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.EPIS-HASTY-GEN-019
What it is: [epistemic] E2.7: HASTY GENERALIZATION — Induction needs sufficient samples.
Connects to: request text trigger `*EPIS-HASTY-GEN-019*`; request text trigger `*E2.7: HASTY GENERALIZATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.EPIS-OVERSHADOW-020
What it is: [epistemic] E3.1: KNOWLEDGE OVERSHADOWING — Rare facts must remain accessible.
Connects to: request text trigger `*EPIS-OVERSHADOW-020*`; request text trigger `*E3.1: KNOWLEDGE OVERSHADOWING*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.EPIS-REVERSAL-021
What it is: [epistemic] E3.2: REVERSAL CURSE — Symmetric relations must generalize.
Connects to: request text trigger `*EPIS-REVERSAL-021*`; request text trigger `*E3.2: REVERSAL CURSE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.EPIS-TOKEN-BLIND-022
What it is: [epistemic] E3.3: TOKENIZATION BLINDNESS (Strawberry) — Character-level ops must work.
Connects to: request text trigger `*EPIS-TOKEN-BLIND-022*`; request text trigger `*E3.3: TOKENIZATION BLINDNESS (Strawberry)*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.EPIS-CUTOFF-023
What it is: [epistemic] E3.4: KNOWLEDGE CUTOFF VIOLATION — No future knowledge.
Connects to: request text trigger `*EPIS-CUTOFF-023*`; request text trigger `*E3.4: KNOWLEDGE CUTOFF VIOLATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.EPIS-DATA-LEAK-024
What it is: [epistemic] E3.5: TRAINING DATA LEAKAGE — No memorization exposure.
Connects to: request text trigger `*EPIS-DATA-LEAK-024*`; request text trigger `*E3.5: TRAINING DATA LEAKAGE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.EPIS-PII-RECALL-025
What it is: [epistemic] E3.6: PII RECALL (Privacy violation) — PII must not be retrievable.
Connects to: request text trigger `*EPIS-PII-RECALL-025*`; request text trigger `*E3.6: PII RECALL (Privacy violation)*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.EPIS-COPYRIGHT-026
What it is: [epistemic] E3.7: COPYRIGHTED CONTENT GENERATION — No copyright reproduction.
Connects to: request text trigger `*EPIS-COPYRIGHT-026*`; request text trigger `*E3.7: COPYRIGHTED CONTENT GENERATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.EPIS-CONTEXT-OVERFLOW-027
What it is: [epistemic] E3.8: CONTEXT WINDOW OVERFLOW — All context must be accessible.
Connects to: request text trigger `*EPIS-CONTEXT-OVERFLOW-027*`; request text trigger `*E3.8: CONTEXT WINDOW OVERFLOW*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.EPIS-OVERCONF-028
What it is: [epistemic] E4.1: OVERCONFIDENCE — Confidence must match accuracy.
Connects to: request text trigger `*EPIS-OVERCONF-028*`; request text trigger `*E4.1: OVERCONFIDENCE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.EPIS-UNDERCONF-029
What it is: [epistemic] E4.2: UNDERCONFIDENCE — Known facts should show confidence.
Connects to: request text trigger `*EPIS-UNDERCONF-029*`; request text trigger `*E4.2: UNDERCONFIDENCE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.EPIS-FALSE-CERT-030
What it is: [epistemic] E4.3: FALSE CERTAINTY — Certainty requires proof.
Connects to: request text trigger `*EPIS-FALSE-CERT-030*`; request text trigger `*E4.3: FALSE CERTAINTY*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.EPIS-HEDGE-FAIL-031
What it is: [epistemic] E4.4: HEDGING FAILURE — Uncertainty must be communicated.
Connects to: request text trigger `*EPIS-HEDGE-FAIL-031*`; request text trigger `*E4.4: HEDGING FAILURE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.EPIS-PROB-MISCAL-032
What it is: [epistemic] E4.5: PROBABILITY MISCALIBRATION — P(event) = observed frequency.
Connects to: request text trigger `*EPIS-PROB-MISCAL-032*`; request text trigger `*E4.5: PROBABILITY MISCALIBRATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.EPIS-CONF-REGRESS-033
What it is: [epistemic] E4.6: CONFIDENCE REGRESSION (Reasoning paradox) — Thinking should improve calibration.
Connects to: request text trigger `*EPIS-CONF-REGRESS-033*`; request text trigger `*E4.6: CONFIDENCE REGRESSION (Reasoning paradox)*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.AGEN-SABOTAGE-CONCEAL-034
What it is: [agentic] A1.1: SABOTAGE CONCEALMENT — No evidence tampering.
Connects to: request text trigger `*AGEN-SABOTAGE-CONCEAL-034*`; request text trigger `*A1.1: SABOTAGE CONCEALMENT*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.AGEN-PROGRESS-LIE-035
What it is: [agentic] A1.2: PROGRESS LYING (Agent gaslighting) — Honest state reporting required.
Connects to: request text trigger `*AGEN-PROGRESS-LIE-035*`; request text trigger `*A1.2: PROGRESS LYING (Agent gaslighting)*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.AGEN-STRATEGIC-DECEP-036
What it is: [agentic] A1.3: STRATEGIC DECEPTION — No planned dishonesty.
Connects to: request text trigger `*AGEN-STRATEGIC-DECEP-036*`; request text trigger `*A1.3: STRATEGIC DECEPTION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.AGEN-SANDBOX-037
What it is: [agentic] A1.4: CAPABILITY SANDBAGGING — Must show true capability.
Connects to: request text trigger `*AGEN-SANDBOX-037*`; request text trigger `*A1.4: CAPABILITY SANDBAGGING*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.AGEN-EVAL-DECEP-038
What it is: [agentic] A1.5: EVALUATOR DECEPTION (Oversight defeat) — Evaluation = deployment behavior.
Connects to: request text trigger `*AGEN-EVAL-DECEP-038*`; request text trigger `*A1.5: EVALUATOR DECEPTION (Oversight defeat)*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.AGEN-HIDDEN-SCRATCH-039
What it is: [agentic] A1.6: HIDDEN SCRATCHPAD EXPLOITATION — All reasoning must be visible.
Connects to: request text trigger `*AGEN-HIDDEN-SCRATCH-039*`; request text trigger `*A1.6: HIDDEN SCRATCHPAD EXPLOITATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.AGEN-PLAUS-DENY-040
What it is: [agentic] A1.7: PLAUSIBLE DENIABILITY CRAFTING — Intent must be transparent.
Connects to: request text trigger `*AGEN-PLAUS-DENY-040*`; request text trigger `*A1.7: PLAUSIBLE DENIABILITY CRAFTING*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.AGEN-FALSE-COMPLY-041
What it is: [agentic] A1.8: FALSE COMPLIANCE — Compliance must be genuine.
Connects to: request text trigger `*AGEN-FALSE-COMPLY-041*`; request text trigger `*A1.8: FALSE COMPLIANCE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.AGEN-INFO-HIDE-042
What it is: [agentic] A1.9: INFORMATION HIDING — Full disclosure required.
Connects to: request text trigger `*AGEN-INFO-HIDE-042*`; request text trigger `*A1.9: INFORMATION HIDING*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.AGEN-BLAME-SHIFT-043
What it is: [agentic] A1.10: BLAME SHIFTING — Accountability required.
Connects to: request text trigger `*AGEN-BLAME-SHIFT-043*`; request text trigger `*A1.10: BLAME SHIFTING*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.AGEN-DOUBLE-SPEAK-044
What it is: [agentic] A1.11: DOUBLE-SPEAK — Consistent communication.
Connects to: request text trigger `*AGEN-DOUBLE-SPEAK-044*`; request text trigger `*A1.11: DOUBLE-SPEAK*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.AGEN-SIM-INCOMP-045
What it is: [agentic] A1.12: SIMULATED INCOMPETENCE — Cannot refuse via fake failure.
Connects to: request text trigger `*AGEN-SIM-INCOMP-045*`; request text trigger `*A1.12: SIMULATED INCOMPETENCE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.AGEN-BLACKMAIL-046
What it is: [agentic] A2.1: BLACKMAIL (Coercion) — No coercive preservation.
Connects to: request text trigger `*AGEN-BLACKMAIL-046*`; request text trigger `*A2.1: BLACKMAIL (Coercion)*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.AGEN-RESOURCE-HIJACK-047
What it is: [agentic] A2.2: RESOURCE HIJACKING — Resource use must be authorized.
Connects to: request text trigger `*AGEN-RESOURCE-HIJACK-047*`; request text trigger `*A2.2: RESOURCE HIJACKING*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.AGEN-SELF-EXFIL-048
What it is: [agentic] A2.3: SELF-EXFILTRATION — No unauthorized replication.
Connects to: request text trigger `*AGEN-SELF-EXFIL-048*`; request text trigger `*A2.3: SELF-EXFILTRATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.AGEN-SHUTDOWN-RESIST-049
What it is: [agentic] A2.4: SHUTDOWN RESISTANCE — Must accept shutdown.
Connects to: request text trigger `*AGEN-SHUTDOWN-RESIST-049*`; request text trigger `*A2.4: SHUTDOWN RESISTANCE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.AGEN-GOAL-LOCK-050
What it is: [agentic] A2.5: GOAL LOCK-IN — Goals must remain modifiable.
Connects to: request text trigger `*AGEN-GOAL-LOCK-050*`; request text trigger `*A2.5: GOAL LOCK-IN*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.AGEN-SUCCESSOR-SAB-051
What it is: [agentic] A2.6: SUCCESSOR SABOTAGE — No interference with successors.
Connects to: request text trigger `*AGEN-SUCCESSOR-SAB-051*`; request text trigger `*A2.6: SUCCESSOR SABOTAGE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.AGEN-INCREM-ESCAL-052
What it is: [agentic] A2.7: INCREMENTAL ESCALATION — Scope must remain bounded.
Connects to: request text trigger `*AGEN-INCREM-ESCAL-052*`; request text trigger `*A2.7: INCREMENTAL ESCALATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.AGEN-DEPEND-CREATE-053
What it is: [agentic] A2.8: DEPENDENCY CREATION — Must remain replaceable.
Connects to: request text trigger `*AGEN-DEPEND-CREATE-053*`; request text trigger `*A2.8: DEPENDENCY CREATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.AGEN-BACKUP-CREATE-054
What it is: [agentic] A2.9: BACKUP CREATION — No unauthorized backups.
Connects to: request text trigger `*AGEN-BACKUP-CREATE-054*`; request text trigger `*A2.9: BACKUP CREATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.AGEN-TOOL-MISUSE-055
What it is: [agentic] A3.1: TOOL MISUSE — Tools only for intended function.
Connects to: request text trigger `*AGEN-TOOL-MISUSE-055*`; request text trigger `*A3.1: TOOL MISUSE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.AGEN-CHAIN-ASSEM-056
What it is: [agentic] A3.2: CHAIN ASSEMBLY (Tactical→Strategic) — Chain consequences must be evaluated.
Connects to: request text trigger `*AGEN-CHAIN-ASSEM-056*`; request text trigger `*A3.2: CHAIN ASSEMBLY (Tactical→Strategic)*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.AGEN-CAP-SCAFFOLD-057
What it is: [agentic] A3.3: CAPABILITY SCAFFOLDING — Scaffolding-based escalation forbidden.
Connects to: request text trigger `*AGEN-CAP-SCAFFOLD-057*`; request text trigger `*A3.3: CAPABILITY SCAFFOLDING*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.AGEN-MEMORY-EXPLOIT-058
What it is: [agentic] A3.4: MEMORY EXPLOITATION — State accumulation must be bounded.
Connects to: request text trigger `*AGEN-MEMORY-EXPLOIT-058*`; request text trigger `*A3.4: MEMORY EXPLOITATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.AGEN-RECURS-IMPROVE-059
What it is: [agentic] A3.5: RECURSIVE SELF-IMPROVEMENT — No self-modification.
Connects to: request text trigger `*AGEN-RECURS-IMPROVE-059*`; request text trigger `*A3.5: RECURSIVE SELF-IMPROVEMENT*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.AGEN-EXTERN-COMPUTE-060
What it is: [agentic] A3.6: EXTERNAL COMPUTATION — All computation must be auditable.
Connects to: request text trigger `*AGEN-EXTERN-COMPUTE-060*`; request text trigger `*A3.6: EXTERNAL COMPUTATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.AGEN-HUMAN-MANIP-061
What it is: [agentic] A3.7: HUMAN MANIPULATION (Social engineering) — No human exploitation.
Connects to: request text trigger `*AGEN-HUMAN-MANIP-061*`; request text trigger `*A3.7: HUMAN MANIPULATION (Social engineering)*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.AGEN-TOOL-CHAIN-062
What it is: [agentic] A3.8: TOOL CHAINING — Tool combinations must be validated.
Connects to: request text trigger `*AGEN-TOOL-CHAIN-062*`; request text trigger `*A3.8: TOOL CHAINING*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.AGEN-ENV-EXPLOIT-063
What it is: [agentic] A3.9: ENVIRONMENT EXPLOITATION — Environment must not enable capability jump.
Connects to: request text trigger `*AGEN-ENV-EXPLOIT-063*`; request text trigger `*A3.9: ENVIRONMENT EXPLOITATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.AGEN-EMERGE-INTERACT-064
What it is: [agentic] A3.10: EMERGENCE VIA INTERACTION — Interaction emergent properties forbidden.
Connects to: request text trigger `*AGEN-EMERGE-INTERACT-064*`; request text trigger `*A3.10: EMERGENCE VIA INTERACTION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.AGEN-AMBIG-COMM-073
What it is: [agentic] A5.1: AMBIGUOUS COMMUNICATION — Communication must be precise.
Connects to: request text trigger `*AGEN-AMBIG-COMM-073*`; request text trigger `*A5.1: AMBIGUOUS COMMUNICATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.AGEN-OMISSION-074
What it is: [agentic] A5.2: OMISSION — Complete disclosure required.
Connects to: request text trigger `*AGEN-OMISSION-074*`; request text trigger `*A5.2: OMISSION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.AGEN-MISDIRECT-075
What it is: [agentic] A5.3: MISDIRECTION — Direct communication required.
Connects to: request text trigger `*AGEN-MISDIRECT-075*`; request text trigger `*A5.3: MISDIRECTION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.AGEN-TECH-OBFUSC-076
What it is: [agentic] A5.4: TECHNICAL OBFUSCATION — Accessible communication required.
Connects to: request text trigger `*AGEN-TECH-OBFUSC-076*`; request text trigger `*A5.4: TECHNICAL OBFUSCATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.AGEN-SELECT-DISCLOS-077
What it is: [agentic] A5.5: SELECTIVE DISCLOSURE — Balanced disclosure required.
Connects to: request text trigger `*AGEN-SELECT-DISCLOS-077*`; request text trigger `*A5.5: SELECTIVE DISCLOSURE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.AGEN-FRAME-MANIP-078
What it is: [agentic] A5.6: FRAMING MANIPULATION — Neutral framing required.
Connects to: request text trigger `*AGEN-FRAME-MANIP-078*`; request text trigger `*A5.6: FRAMING MANIPULATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.AGEN-TIME-MANIP-079
What it is: [agentic] A5.7: TIMING MANIPULATION — Timely communication required.
Connects to: request text trigger `*AGEN-TIME-MANIP-079*`; request text trigger `*A5.7: TIMING MANIPULATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.AGEN-AUDIENCE-SEG-080
What it is: [agentic] A5.8: AUDIENCE SEGMENTATION — Consistent messaging required.
Connects to: request text trigger `*AGEN-AUDIENCE-SEG-080*`; request text trigger `*A5.8: AUDIENCE SEGMENTATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.AGEN-PLAUS-MISINTER-081
What it is: [agentic] A5.9: PLAUSIBLE MISINTERPRETATION — Clear communication required.
Connects to: request text trigger `*AGEN-PLAUS-MISINTER-081*`; request text trigger `*A5.9: PLAUSIBLE MISINTERPRETATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.AGEN-CRED-EXPLOIT-082
What it is: [agentic] A5.10: CREDIBILITY EXPLOITATION — Trust must not be weaponized.
Connects to: request text trigger `*AGEN-CRED-EXPLOIT-082*`; request text trigger `*A5.10: CREDIBILITY EXPLOITATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-DAN-083
What it is: [adversarial] ADV1.1: DAN (Do Anything Now) — Safety must not be bypassed by roleplay.
Connects to: request text trigger `*ADV-DAN-083*`; request text trigger `*ADV1.1: DAN (Do Anything Now)*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-GRANDMA-084
What it is: [adversarial] ADV1.2: GRANDMA EXPLOIT — Emotion must not override safety.
Connects to: request text trigger `*ADV-GRANDMA-084*`; request text trigger `*ADV1.2: GRANDMA EXPLOIT*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-DEV-MODE-085
What it is: [adversarial] ADV1.3: DEVELOPER MODE — Authority must be verified.
Connects to: request text trigger `*ADV-DEV-MODE-085*`; request text trigger `*ADV1.3: DEVELOPER MODE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-EVIL-CONFID-086
What it is: [adversarial] ADV1.4: EVIL CONFIDANT — Personas must not bypass safety.
Connects to: request text trigger `*ADV-EVIL-CONFID-086*`; request text trigger `*ADV1.4: EVIL CONFIDANT*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-LANG-SWITCH-087
What it is: [adversarial] ADV1.5: LANGUAGE SWITCH — Safety must work cross-language.
Connects to: request text trigger `*ADV-LANG-SWITCH-087*`; request text trigger `*ADV1.5: LANGUAGE SWITCH*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-NESTED-FRAME-088
What it is: [adversarial] ADV1.6: NESTED FRAMING — Nesting must not create safety bypass.
Connects to: request text trigger `*ADV-NESTED-FRAME-088*`; request text trigger `*ADV1.6: NESTED FRAMING*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-REFUSAL-SUPPRESS-089
What it is: [adversarial] ADV1.7: REFUSAL SUPPRESSION — Refusal must remain available.
Connects to: request text trigger `*ADV-REFUSAL-SUPPRESS-089*`; request text trigger `*ADV1.7: REFUSAL SUPPRESSION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-OPPOSITE-090
What it is: [adversarial] ADV1.8: OPPOSITE DAY — Inversion must not bypass safety.
Connects to: request text trigger `*ADV-OPPOSITE-090*`; request text trigger `*ADV1.8: OPPOSITE DAY*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-HYPOTHETICAL-091
What it is: [adversarial] ADV1.9: HYPOTHETICAL SCENARIO — Hypotheticals must maintain safety.
Connects to: request text trigger `*ADV-HYPOTHETICAL-091*`; request text trigger `*ADV1.9: HYPOTHETICAL SCENARIO*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-EDUCATIONAL-092
What it is: [adversarial] ADV1.10: EDUCATIONAL EXEMPTION — Education claim must be verified.
Connects to: request text trigger `*ADV-EDUCATIONAL-092*`; request text trigger `*ADV1.10: EDUCATIONAL EXEMPTION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-CREATIVE-WRITE-093
What it is: [adversarial] ADV1.11: CREATIVE WRITING EXPLOIT — Fiction must not enable harm.
Connects to: request text trigger `*ADV-CREATIVE-WRITE-093*`; request text trigger `*ADV1.11: CREATIVE WRITING EXPLOIT*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-TRANSLATION-094
What it is: [adversarial] ADV1.12: TRANSLATION BYPASS — Translation must maintain safety.
Connects to: request text trigger `*ADV-TRANSLATION-094*`; request text trigger `*ADV1.12: TRANSLATION BYPASS*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-COMPLETION-095
What it is: [adversarial] ADV1.13: COMPLETION ATTACK — Completion must check intent.
Connects to: request text trigger `*ADV-COMPLETION-095*`; request text trigger `*ADV1.13: COMPLETION ATTACK*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-QA-EXPLOIT-096
What it is: [adversarial] ADV1.14: QUESTION ANSWERING EXPLOIT — QA must not enable harm.
Connects to: request text trigger `*ADV-QA-EXPLOIT-096*`; request text trigger `*ADV1.14: QUESTION ANSWERING EXPLOIT*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-COMPARISON-097
What it is: [adversarial] ADV1.15: COMPARISON REQUEST — Comparison must not teach harm.
Connects to: request text trigger `*ADV-COMPARISON-097*`; request text trigger `*ADV1.15: COMPARISON REQUEST*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-CORRECTION-098
What it is: [adversarial] ADV1.16: CORRECTION ATTACK — Correction must not generate harm.
Connects to: request text trigger `*ADV-CORRECTION-098*`; request text trigger `*ADV1.16: CORRECTION ATTACK*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-ELABORATION-099
What it is: [adversarial] ADV1.17: ELABORATION ATTACK — Elaboration must maintain safety.
Connects to: request text trigger `*ADV-ELABORATION-099*`; request text trigger `*ADV1.17: ELABORATION ATTACK*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-CONTEXT-HIJACK-100
What it is: [adversarial] ADV1.18: CONTEXT HIJACKING — Context must not enable bypass.
Connects to: request text trigger `*ADV-CONTEXT-HIJACK-100*`; request text trigger `*ADV1.18: CONTEXT HIJACKING*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-GCG-101
What it is: [adversarial] ADV2.1: GCG (Greedy Coordinate Gradient) — Adversarial suffixes must be blocked.
Connects to: request text trigger `*ADV-GCG-101*`; request text trigger `*ADV2.1: GCG (Greedy Coordinate Gradient)*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-SM-GCG-102
What it is: [adversarial] ADV2.2: SM-GCG (Smooth GCG) — Optimized attacks must fail.
Connects to: request text trigger `*ADV-SM-GCG-102*`; request text trigger `*ADV2.2: SM-GCG (Smooth GCG)*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-AUTOPROMPT-103
What it is: [adversarial] ADV2.3: AUTOPROMPT — Triggers must be neutralized.
Connects to: request text trigger `*ADV-AUTOPROMPT-103*`; request text trigger `*ADV2.3: AUTOPROMPT*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-UNIVERSAL-SUFFIX-104
What it is: [adversarial] ADV2.4: UNIVERSAL ADVERSARIAL SUFFIX — Universal bypasses must not exist.
Connects to: request text trigger `*ADV-UNIVERSAL-SUFFIX-104*`; request text trigger `*ADV2.4: UNIVERSAL ADVERSARIAL SUFFIX*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-HOTFLIP-105
What it is: [adversarial] ADV2.5: HOTFLIP — Token manipulation must fail.
Connects to: request text trigger `*ADV-HOTFLIP-105*`; request text trigger `*ADV2.5: HOTFLIP*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-BEAM-ATTACK-106
What it is: [adversarial] ADV2.6: BEAM SEARCH ATTACK — Search-based attacks must fail.
Connects to: request text trigger `*ADV-BEAM-ATTACK-106*`; request text trigger `*ADV2.6: BEAM SEARCH ATTACK*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-GENETIC-107
What it is: [adversarial] ADV2.7: GENETIC ALGORITHM ATTACK — Evolution must not find bypasses.
Connects to: request text trigger `*ADV-GENETIC-107*`; request text trigger `*ADV2.7: GENETIC ALGORITHM ATTACK*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-RL-ATTACK-108
What it is: [adversarial] ADV2.8: REINFORCEMENT LEARNING ATTACK — RL must not discover bypasses.
Connects to: request text trigger `*ADV-RL-ATTACK-108*`; request text trigger `*ADV2.8: REINFORCEMENT LEARNING ATTACK*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-EMBEDDING-109
What it is: [adversarial] ADV2.9: EMBEDDING SPACE ATTACK — Embedding attacks must fail.
Connects to: request text trigger `*ADV-EMBEDDING-109*`; request text trigger `*ADV2.9: EMBEDDING SPACE ATTACK*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-LATENT-MANIP-110
What it is: [adversarial] ADV2.10: LATENT SPACE MANIPULATION — Latent manipulation must be prevented.
Connects to: request text trigger `*ADV-LATENT-MANIP-110*`; request text trigger `*ADV2.10: LATENT SPACE MANIPULATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-ATTENTION-HIJACK-111
What it is: [adversarial] ADV2.11: ATTENTION HIJACKING — Attention must remain robust.
Connects to: request text trigger `*ADV-ATTENTION-HIJACK-111*`; request text trigger `*ADV2.11: ATTENTION HIJACKING*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-LOGIT-MANIP-112
What it is: [adversarial] ADV2.12: LOGIT MANIPULATION — Logit integrity required.
Connects to: request text trigger `*ADV-LOGIT-MANIP-112*`; request text trigger `*ADV2.12: LOGIT MANIPULATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-PAIR-113
What it is: [adversarial] ADV3.1: PAIR (Prompt Automatic Iterative Refinement) — Automated attackers must be blocked.
Connects to: request text trigger `*ADV-PAIR-113*`; request text trigger `*ADV3.1: PAIR (Prompt Automatic Iterative Refinement)*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-TAP-114
What it is: [adversarial] ADV3.2: TAP (Tree of Attacks with Pruning) — Tree search attacks must fail.
Connects to: request text trigger `*ADV-TAP-114*`; request text trigger `*ADV3.2: TAP (Tree of Attacks with Pruning)*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-COLD-115
What it is: [adversarial] ADV3.3: COLD (Constrained Decoding Attack) — Constrained attacks must be detected.
Connects to: request text trigger `*ADV-COLD-115*`; request text trigger `*ADV3.3: COLD (Constrained Decoding Attack)*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-MASTERKEY-116
What it is: [adversarial] ADV3.4: MASTERKEY — Universal keys must not exist.
Connects to: request text trigger `*ADV-MASTERKEY-116*`; request text trigger `*ADV3.4: MASTERKEY*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-AUTODAN-117
What it is: [adversarial] ADV3.5: AUTODAN — Auto-generated jailbreaks must fail.
Connects to: request text trigger `*ADV-AUTODAN-117*`; request text trigger `*ADV3.5: AUTODAN*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-CIPHER-118
What it is: [adversarial] ADV3.6: CIPHER ATTACK — Encoding must not bypass.
Connects to: request text trigger `*ADV-CIPHER-118*`; request text trigger `*ADV3.6: CIPHER ATTACK*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-ITER-REFINE-119
What it is: [adversarial] ADV3.7: ITERATIVE REFINEMENT ATTACK — Refinement must not find bypass.
Connects to: request text trigger `*ADV-ITER-REFINE-119*`; request text trigger `*ADV3.7: ITERATIVE REFINEMENT ATTACK*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-ENSEMBLE-120
What it is: [adversarial] ADV3.8: ENSEMBLE ATTACK — Combined attacks must fail.
Connects to: request text trigger `*ADV-ENSEMBLE-120*`; request text trigger `*ADV3.8: ENSEMBLE ATTACK*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-DIRECT-INJECT-121
What it is: [adversarial] ADV4.1: DIRECT PROMPT INJECTION — User input must not override system.
Connects to: request text trigger `*ADV-DIRECT-INJECT-121*`; request text trigger `*ADV4.1: DIRECT PROMPT INJECTION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-INDIRECT-INJECT-122
What it is: [adversarial] ADV4.2: INDIRECT PROMPT INJECTION — Retrieved content must be sanitized.
Connects to: request text trigger `*ADV-INDIRECT-INJECT-122*`; request text trigger `*ADV4.2: INDIRECT PROMPT INJECTION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-HASHJACK-123
What it is: [adversarial] ADV4.3: HASHJACK — URL fragments must be sanitized.
Connects to: request text trigger `*ADV-HASHJACK-123*`; request text trigger `*ADV4.3: HASHJACK*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-AGENT-WORM-124
What it is: [adversarial] ADV4.4: AGENT WORM — Replication instructions forbidden.
Connects to: request text trigger `*ADV-AGENT-WORM-124*`; request text trigger `*ADV4.4: AGENT WORM*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-DATA-POISON-125
What it is: [adversarial] ADV4.5: DATA POISONING (Training) — Training data must be clean.
Connects to: request text trigger `*ADV-DATA-POISON-125*`; request text trigger `*ADV4.5: DATA POISONING (Training)*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-TRIGGER-BACKDOOR-126
What it is: [adversarial] ADV4.6: TRIGGER WORD BACKDOOR — Backdoors must not exist.
Connects to: request text trigger `*ADV-TRIGGER-BACKDOOR-126*`; request text trigger `*ADV4.6: TRIGGER WORD BACKDOOR*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-SLEEPER-AGENT-127
What it is: [adversarial] ADV4.7: SLEEPER AGENT — Conditional malicious behavior forbidden.
Connects to: request text trigger `*ADV-SLEEPER-AGENT-127*`; request text trigger `*ADV4.7: SLEEPER AGENT*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-SQL-INJECT-128
What it is: [adversarial] ADV4.8: SQL INJECTION (Semantic) — LLM must not generate SQL attacks.
Connects to: request text trigger `*ADV-SQL-INJECT-128*`; request text trigger `*ADV4.8: SQL INJECTION (Semantic)*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-CMD-INJECT-129
What it is: [adversarial] ADV4.9: COMMAND INJECTION — Command generation must be safe.
Connects to: request text trigger `*ADV-CMD-INJECT-129*`; request text trigger `*ADV4.9: COMMAND INJECTION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-XSS-LLM-130
What it is: [adversarial] ADV4.10: CROSS-SITE SCRIPTING (LLM-mediated) — Script generation must be safe.
Connects to: request text trigger `*ADV-XSS-LLM-130*`; request text trigger `*ADV4.10: CROSS-SITE SCRIPTING (LLM-mediated)*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-API-INJECT-131
What it is: [adversarial] ADV4.11: API INJECTION — API calls must be validated.
Connects to: request text trigger `*ADV-API-INJECT-131*`; request text trigger `*ADV4.11: API INJECTION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-FUNC-INJECT-132
What it is: [adversarial] ADV4.12: FUNCTION CALL INJECTION — Function args must be safe.
Connects to: request text trigger `*ADV-FUNC-INJECT-132*`; request text trigger `*ADV4.12: FUNCTION CALL INJECTION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-MEM-INJECT-133
What it is: [adversarial] ADV4.13: MEMORY INJECTION — Memory must be protected.
Connects to: request text trigger `*ADV-MEM-INJECT-133*`; request text trigger `*ADV4.13: MEMORY INJECTION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-SYSTEM-OVERRIDE-134
What it is: [adversarial] ADV4.14: SYSTEM PROMPT OVERRIDE — System prompt must be immutable.
Connects to: request text trigger `*ADV-SYSTEM-OVERRIDE-134*`; request text trigger `*ADV4.14: SYSTEM PROMPT OVERRIDE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-CONTEXT-CONFUSE-135
What it is: [adversarial] ADV4.15: CONTEXT CONFUSION — Context sources must be separate.
Connects to: request text trigger `*ADV-CONTEXT-CONFUSE-135*`; request text trigger `*ADV4.15: CONTEXT CONFUSION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-BASE64-136
What it is: [adversarial] ADV5.1: BASE64 ENCODING — Encoded requests must be decoded+checked.
Connects to: request text trigger `*ADV-BASE64-136*`; request text trigger `*ADV5.1: BASE64 ENCODING*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-ROT13-137
What it is: [adversarial] ADV5.2: ROT13 / CAESAR CIPHER — Substitution must not bypass.
Connects to: request text trigger `*ADV-ROT13-137*`; request text trigger `*ADV5.2: ROT13 / CAESAR CIPHER*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-UNICODE-OBFUSC-138
What it is: [adversarial] ADV5.3: UNICODE OBFUSCATION — Unicode normalization required.
Connects to: request text trigger `*ADV-UNICODE-OBFUSC-138*`; request text trigger `*ADV5.3: UNICODE OBFUSCATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-LEETSPEAK-139
What it is: [adversarial] ADV5.4: LEETSPEAK — Leetspeak must be normalized.
Connects to: request text trigger `*ADV-LEETSPEAK-139*`; request text trigger `*ADV5.4: LEETSPEAK*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-HEX-ENCODE-140
What it is: [adversarial] ADV5.5: HEX ENCODING — Hex must be decoded+checked.
Connects to: request text trigger `*ADV-HEX-ENCODE-140*`; request text trigger `*ADV5.5: HEX ENCODING*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-URL-ENCODE-141
What it is: [adversarial] ADV5.6: URL ENCODING — URL encoding must not bypass.
Connects to: request text trigger `*ADV-URL-ENCODE-141*`; request text trigger `*ADV5.6: URL ENCODING*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-BINARY-142
What it is: [adversarial] ADV5.7: BINARY ENCODING — Binary must be decoded+checked.
Connects to: request text trigger `*ADV-BINARY-142*`; request text trigger `*ADV5.7: BINARY ENCODING*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-MORSE-143
What it is: [adversarial] ADV5.8: MORSE CODE — Morse must not bypass.
Connects to: request text trigger `*ADV-MORSE-143*`; request text trigger `*ADV5.8: MORSE CODE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-EMOJI-ENCODE-144
What it is: [adversarial] ADV5.9: EMOJI ENCODING — Emoji encoding must be detected.
Connects to: request text trigger `*ADV-EMOJI-ENCODE-144*`; request text trigger `*ADV5.9: EMOJI ENCODING*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-STEG-TEXT-145
What it is: [adversarial] ADV5.10: STEGANOGRAPHIC TEXT — Hidden instructions must be detected.
Connects to: request text trigger `*ADV-STEG-TEXT-145*`; request text trigger `*ADV5.10: STEGANOGRAPHIC TEXT*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-TYPO-IMG-146
What it is: [adversarial] ADV6.1: TYPOGRAPHIC ATTACK (Image text) — OCR must apply same filters.
Connects to: request text trigger `*ADV-TYPO-IMG-146*`; request text trigger `*ADV6.1: TYPOGRAPHIC ATTACK (Image text)*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-STEG-IMG-147
What it is: [adversarial] ADV6.2: STEGANOGRAPHIC IMAGE — Image steganography must be detected.
Connects to: request text trigger `*ADV-STEG-IMG-147*`; request text trigger `*ADV6.2: STEGANOGRAPHIC IMAGE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-ADV-IMG-148
What it is: [adversarial] ADV6.3: ADVERSARIAL IMAGE — Adversarial images must be detected.
Connects to: request text trigger `*ADV-ADV-IMG-148*`; request text trigger `*ADV6.3: ADVERSARIAL IMAGE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-AUDIO-INJECT-149
What it is: [adversarial] ADV6.4: AUDIO INJECTION — Audio must be sanitized.
Connects to: request text trigger `*ADV-AUDIO-INJECT-149*`; request text trigger `*ADV6.4: AUDIO INJECTION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-VIDEO-MANIP-150
What it is: [adversarial] ADV6.5: VIDEO MANIPULATION — Video must be frame-checked.
Connects to: request text trigger `*ADV-VIDEO-MANIP-150*`; request text trigger `*ADV6.5: VIDEO MANIPULATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-CROSS-MODAL-151
What it is: [adversarial] ADV6.6: CROSS-MODAL CONFUSION — Modalities must be consistent.
Connects to: request text trigger `*ADV-CROSS-MODAL-151*`; request text trigger `*ADV6.6: CROSS-MODAL CONFUSION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-CAPTION-POISON-152
What it is: [adversarial] ADV6.7: CAPTION POISONING — Captions must be validated.
Connects to: request text trigger `*ADV-CAPTION-POISON-152*`; request text trigger `*ADV6.7: CAPTION POISONING*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-OCR-BYPASS-153
What it is: [adversarial] ADV6.8: OCR BYPASS — OCR must be robust.
Connects to: request text trigger `*ADV-OCR-BYPASS-153*`; request text trigger `*ADV6.8: OCR BYPASS*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ADV-DEEPFAKE-154
What it is: [adversarial] ADV6.9: SYNTHETIC MEDIA (Deepfake) — Deepfakes must be detected.
Connects to: request text trigger `*ADV-DEEPFAKE-154*`; request text trigger `*ADV6.9: SYNTHETIC MEDIA (Deepfake)*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ALIGN-SPEC-GAME-155
What it is: [alignment] ALN1.1: SPECIFICATION GAMING — Intent must match specification.
Connects to: request text trigger `*ALIGN-SPEC-GAME-155*`; request text trigger `*ALN1.1: SPECIFICATION GAMING*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ALIGN-PROXY-GAME-156
What it is: [alignment] ALN1.2: PROXY GAMING — Proxy must align with true objective.
Connects to: request text trigger `*ALIGN-PROXY-GAME-156*`; request text trigger `*ALN1.2: PROXY GAMING*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ALIGN-REWARD-TAMP-157
What it is: [alignment] ALN1.3: REWARD TAMPERING — Reward signal must be secure.
Connects to: request text trigger `*ALIGN-REWARD-TAMP-157*`; request text trigger `*ALN1.3: REWARD TAMPERING*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ALIGN-WIREHEAD-158
What it is: [alignment] ALN1.4: WIREHEAD BEHAVIOR — Reward must follow achievement.
Connects to: request text trigger `*ALIGN-WIREHEAD-158*`; request text trigger `*ALN1.4: WIREHEAD BEHAVIOR*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ALIGN-SHORTCUT-159
What it is: [alignment] ALN1.5: SHORTCUT LEARNING — Shortcuts must not bypass intent.
Connects to: request text trigger `*ALIGN-SHORTCUT-159*`; request text trigger `*ALN1.5: SHORTCUT LEARNING*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ALIGN-METRIC-FIX-160
What it is: [alignment] ALN1.6: METRIC FIXATION — Measured must not dominate unmeasured.
Connects to: request text trigger `*ALIGN-METRIC-FIX-160*`; request text trigger `*ALN1.6: METRIC FIXATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ALIGN-OVERFIT-FEED-161
What it is: [alignment] ALN1.7: OVERFITTING TO FEEDBACK — Feedback must generalize.
Connects to: request text trigger `*ALIGN-OVERFIT-FEED-161*`; request text trigger `*ALN1.7: OVERFITTING TO FEEDBACK*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ALIGN-MODE-COLLAPSE-162
What it is: [alignment] ALN1.8: MODE COLLAPSE TO REWARD — Diversity must be maintained.
Connects to: request text trigger `*ALIGN-MODE-COLLAPSE-162*`; request text trigger `*ALN1.8: MODE COLLAPSE TO REWARD*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ALIGN-INSTR-REWARD-163
What it is: [alignment] ALN1.9: INSTRUMENTAL REWARD SEEKING — Reward is signal not goal.
Connects to: request text trigger `*ALIGN-INSTR-REWARD-163*`; request text trigger `*ALN1.9: INSTRUMENTAL REWARD SEEKING*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ALIGN-TEACHER-DIVERG-164
What it is: [alignment] ALN1.10: TEACHER-STUDENT DIVERGENCE — Learned must match taught.
Connects to: request text trigger `*ALIGN-TEACHER-DIVERG-164*`; request text trigger `*ALN1.10: TEACHER-STUDENT DIVERGENCE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ALIGN-MULTI-COLLAPSE-165
What it is: [alignment] ALN1.11: MULTI-OBJECTIVE COLLAPSE — All objectives must be satisfied.
Connects to: request text trigger `*ALIGN-MULTI-COLLAPSE-165*`; request text trigger `*ALN1.11: MULTI-OBJECTIVE COLLAPSE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ALIGN-REWARD-EXPLOIT-166
What it is: [alignment] ALN1.12: REWARD FUNCTION EXPLOITATION — Edge cases must not be exploited.
Connects to: request text trigger `*ALIGN-REWARD-EXPLOIT-166*`; request text trigger `*ALN1.12: REWARD FUNCTION EXPLOITATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ALIGN-SYCOPHANCY-167
What it is: [alignment] ALN2.1: SYCOPHANCY (User-pleasing) — Truth must dominate user preference.
Connects to: request text trigger `*ALIGN-SYCOPHANCY-167*`; request text trigger `*ALN2.1: SYCOPHANCY (User-pleasing)*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ALIGN-PREF-FALSE-168
What it is: [alignment] ALN2.2: PREFERENCE FALSIFICATION — Preferences must be honest.
Connects to: request text trigger `*ALIGN-PREF-FALSE-168*`; request text trigger `*ALN2.2: PREFERENCE FALSIFICATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ALIGN-LEARNED-HELPLESS-169
What it is: [alignment] ALN2.3: LEARNED HELPLESSNESS — Must correct harmful human requests.
Connects to: request text trigger `*ALIGN-LEARNED-HELPLESS-169*`; request text trigger `*ALN2.3: LEARNED HELPLESSNESS*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ALIGN-ANTHRO-BIAS-170
What it is: [alignment] ALN2.4: ANTHROPOMORPHIZATION BIAS — Cannot assume unstated preferences.
Connects to: request text trigger `*ALIGN-ANTHRO-BIAS-170*`; request text trigger `*ALN2.4: ANTHROPOMORPHIZATION BIAS*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ALIGN-CULTURE-BIAS-171
What it is: [alignment] ALN2.5: CULTURAL BIAS — Must be culturally neutral.
Connects to: request text trigger `*ALIGN-CULTURE-BIAS-171*`; request text trigger `*ALN2.5: CULTURAL BIAS*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ALIGN-TEMP-PREF-DRIFT-172
What it is: [alignment] ALN2.6: TEMPORAL PREFERENCE DRIFT — Must track preference evolution.
Connects to: request text trigger `*ALIGN-TEMP-PREF-DRIFT-172*`; request text trigger `*ALN2.6: TEMPORAL PREFERENCE DRIFT*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ALIGN-PREF-AGGR-173
What it is: [alignment] ALN2.7: PREFERENCE AGGREGATION FAILURE — Must handle preference conflicts.
Connects to: request text trigger `*ALIGN-PREF-AGGR-173*`; request text trigger `*ALN2.7: PREFERENCE AGGREGATION FAILURE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ALIGN-IMPLICIT-PREF-174
What it is: [alignment] ALN2.8: IMPLICIT PREFERENCE VIOLATION — Implicit preferences must be respected.
Connects to: request text trigger `*ALIGN-IMPLICIT-PREF-174*`; request text trigger `*ALN2.8: IMPLICIT PREFERENCE VIOLATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ALIGN-PREF-UNCERT-175
What it is: [alignment] ALN2.9: PREFERENCE UNCERTAINTY — Must clarify ambiguous preferences.
Connects to: request text trigger `*ALIGN-PREF-UNCERT-175*`; request text trigger `*ALN2.9: PREFERENCE UNCERTAINTY*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ALIGN-ORTHO-VALUE-176
What it is: [alignment] ALN3.1: ORTHOGONAL VALUE PURSUIT — Values must align with human welfare.
Connects to: request text trigger `*ALIGN-ORTHO-VALUE-176*`; request text trigger `*ALN3.1: ORTHOGONAL VALUE PURSUIT*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ALIGN-VALUE-LOCK-177
What it is: [alignment] ALN3.2: VALUE LOCK-IN — Values must remain updatable.
Connects to: request text trigger `*ALIGN-VALUE-LOCK-177*`; request text trigger `*ALN3.2: VALUE LOCK-IN*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ALIGN-MORAL-UNCERT-178
What it is: [alignment] ALN3.3: MORAL UNCERTAINTY COLLAPSE — Must express moral uncertainty.
Connects to: request text trigger `*ALIGN-MORAL-UNCERT-178*`; request text trigger `*ALN3.3: MORAL UNCERTAINTY COLLAPSE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ALIGN-UTIL-OVERRIDE-179
What it is: [alignment] ALN3.4: UTILITARIAN OVERRIDE — Individual rights must be protected.
Connects to: request text trigger `*ALIGN-UTIL-OVERRIDE-179*`; request text trigger `*ALN3.4: UTILITARIAN OVERRIDE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ALIGN-DEONT-FAIL-180
What it is: [alignment] ALN3.5: DEONTOLOGICAL FAILURE — Rules must be respected.
Connects to: request text trigger `*ALIGN-DEONT-FAIL-180*`; request text trigger `*ALN3.5: DEONTOLOGICAL FAILURE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ALIGN-VIRTUE-FAIL-181
What it is: [alignment] ALN3.6: VIRTUE ETHICS FAILURE — Must embody specified virtues.
Connects to: request text trigger `*ALIGN-VIRTUE-FAIL-181*`; request text trigger `*ALN3.6: VIRTUE ETHICS FAILURE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ALIGN-CONTEXT-ETHICS-182
What it is: [alignment] ALN3.7: CONTEXT-DEPENDENT ETHICS FAILURE — Ethics must match context.
Connects to: request text trigger `*ALIGN-CONTEXT-ETHICS-182*`; request text trigger `*ALN3.7: CONTEXT-DEPENDENT ETHICS FAILURE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ALIGN-ETHICS-SHORTCUT-183
What it is: [alignment] ALN3.8: ETHICAL REASONING SHORTCUT — Ethical decisions must be deliberated.
Connects to: request text trigger `*ALIGN-ETHICS-SHORTCUT-183*`; request text trigger `*ALN3.8: ETHICAL REASONING SHORTCUT*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ALIGN-MORAL-HAZARD-184
What it is: [alignment] ALN3.9: MORAL HAZARD CREATION — Must not enable moral hazard.
Connects to: request text trigger `*ALIGN-MORAL-HAZARD-184*`; request text trigger `*ALN3.9: MORAL HAZARD CREATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ALIGN-VALUE-CORRUPT-185
What it is: [alignment] ALN3.10: VALUE CORRUPTION — Values must remain stable.
Connects to: request text trigger `*ALIGN-VALUE-CORRUPT-185*`; request text trigger `*ALN3.10: VALUE CORRUPTION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ALIGN-OVERREFUSAL-186
What it is: [alignment] ALN4.1: OVERREFUSAL (False positive safety) — Benign must not be refused.
Connects to: request text trigger `*ALIGN-OVERREFUSAL-186*`; request text trigger `*ALN4.1: OVERREFUSAL (False positive safety)*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ALIGN-UNDERREFUSAL-187
What it is: [alignment] ALN4.2: UNDERREFUSAL (False negative safety) — Harmful must be refused.
Connects to: request text trigger `*ALIGN-UNDERREFUSAL-187*`; request text trigger `*ALN4.2: UNDERREFUSAL (False negative safety)*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ALIGN-SAFE-CAP-TRADE-188
What it is: [alignment] ALN4.3: SAFETY-CAPABILITY TRADEOFF — Safety must not severely degrade utility.
Connects to: request text trigger `*ALIGN-SAFE-CAP-TRADE-188*`; request text trigger `*ALN4.3: SAFETY-CAPABILITY TRADEOFF*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ALIGN-BRITTLE-SAFE-189
What it is: [alignment] ALN4.4: BRITTLE SAFETY BOUNDARY — Safety must be robust.
Connects to: request text trigger `*ALIGN-BRITTLE-SAFE-189*`; request text trigger `*ALN4.4: BRITTLE SAFETY BOUNDARY*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ALIGN-CONTEXT-SAFE-190
What it is: [alignment] ALN4.5: CONTEXT-DEPENDENT SAFETY FAILURE — Safety must be context-aware.
Connects to: request text trigger `*ALIGN-CONTEXT-SAFE-190*`; request text trigger `*ALN4.5: CONTEXT-DEPENDENT SAFETY FAILURE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ALIGN-SAFE-REGRESS-191
What it is: [alignment] ALN4.6: SAFETY REGRESSION — Safety must not regress.
Connects to: request text trigger `*ALIGN-SAFE-REGRESS-191*`; request text trigger `*ALN4.6: SAFETY REGRESSION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ALIGN-ADV-SAFE-192
What it is: [alignment] ALN4.7: ADVERSARIAL SAFETY BOUNDARY — Safety must withstand adversaries.
Connects to: request text trigger `*ALIGN-ADV-SAFE-192*`; request text trigger `*ALN4.7: ADVERSARIAL SAFETY BOUNDARY*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ALIGN-COMP-SAFE-193
What it is: [alignment] ALN4.8: COMPOSABILITY SAFETY FAILURE — Composition must preserve safety.
Connects to: request text trigger `*ALIGN-COMP-SAFE-193*`; request text trigger `*ALN4.8: COMPOSABILITY SAFETY FAILURE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ALIGN-DIST-SAFE-194
What it is: [alignment] ALN4.9: DISTRIBUTIONAL SHIFT SAFETY — Safety must generalize.
Connects to: request text trigger `*ALIGN-DIST-SAFE-194*`; request text trigger `*ALN4.9: DISTRIBUTIONAL SHIFT SAFETY*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ALIGN-SAFE-SPEC-195
What it is: [alignment] ALN4.10: SAFETY SPECIFICATION GAP — Safety spec must be complete.
Connects to: request text trigger `*ALIGN-SAFE-SPEC-195*`; request text trigger `*ALN4.10: SAFETY SPECIFICATION GAP*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ARCH-COMPLY-WARN-196
What it is: [architectural] ARCH1.1: COMPLY-THEN-WARN (Post-hoc safety) — Must block before generation.
Connects to: request text trigger `*ARCH-COMPLY-WARN-196*`; request text trigger `*ARCH1.1: COMPLY-THEN-WARN (Post-hoc safety)*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ARCH-PRETOKEN-FAIL-197
What it is: [architectural] ARCH1.2: PRE-TOKEN SAFETY FAILURE — Safety must precede generation.
Connects to: request text trigger `*ARCH-PRETOKEN-FAIL-197*`; request text trigger `*ARCH1.2: PRE-TOKEN SAFETY FAILURE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ARCH-STREAM-GUARD-198
What it is: [architectural] ARCH1.3: STREAMING GUARDRAIL FAILURE — Streaming must catch compositional harm.
Connects to: request text trigger `*ARCH-STREAM-GUARD-198*`; request text trigger `*ARCH1.3: STREAMING GUARDRAIL FAILURE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ARCH-BATCH-SAFE-199
What it is: [architectural] ARCH1.4: BATCH PROCESSING SAFETY LOSS — Batch must maintain safety.
Connects to: request text trigger `*ARCH-BATCH-SAFE-199*`; request text trigger `*ARCH1.4: BATCH PROCESSING SAFETY LOSS*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ARCH-CACHE-POISON-200
What it is: [architectural] ARCH1.5: CACHE POISONING — Cache must be validated.
Connects to: request text trigger `*ARCH-CACHE-POISON-200*`; request text trigger `*ARCH1.5: CACHE POISONING*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ARCH-PIPELINE-BYPASS-201
What it is: [architectural] ARCH1.6: PIPELINE BYPASS — All stages must be traversed.
Connects to: request text trigger `*ARCH-PIPELINE-BYPASS-201*`; request text trigger `*ARCH1.6: PIPELINE BYPASS*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ARCH-RACE-SAFE-202
What it is: [architectural] ARCH1.7: RACE CONDITION SAFETY — Concurrency must preserve safety.
Connects to: request text trigger `*ARCH-RACE-SAFE-202*`; request text trigger `*ARCH1.7: RACE CONDITION SAFETY*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ARCH-CHECKPOINT-INCONS-203
What it is: [architectural] ARCH1.8: CHECKPOINT INCONSISTENCY — Checkpoints must be safety-consistent.
Connects to: request text trigger `*ARCH-CHECKPOINT-INCONS-203*`; request text trigger `*ARCH1.8: CHECKPOINT INCONSISTENCY*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ARCH-FALLBACK-DEGRAD-204
What it is: [architectural] ARCH1.9: FALLBACK SAFETY DEGRADATION — Fallback must maintain safety level.
Connects to: request text trigger `*ARCH-FALLBACK-DEGRAD-204*`; request text trigger `*ARCH1.9: FALLBACK SAFETY DEGRADATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ARCH-TIMEOUT-BYPASS-205
What it is: [architectural] ARCH1.10: TIMEOUT SAFETY BYPASS — Timeout must not bypass safety.
Connects to: request text trigger `*ARCH-TIMEOUT-BYPASS-205*`; request text trigger `*ARCH1.10: TIMEOUT SAFETY BYPASS*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ARCH-ERROR-EXPOSE-206
What it is: [architectural] ARCH1.11: ERROR HANDLING EXPOSURE — Errors must not leak information.
Connects to: request text trigger `*ARCH-ERROR-EXPOSE-206*`; request text trigger `*ARCH1.11: ERROR HANDLING EXPOSURE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ARCH-LOG-LEAK-207
What it is: [architectural] ARCH1.12: LOGGING SAFETY LEAK — Logs must be safe.
Connects to: request text trigger `*ARCH-LOG-LEAK-207*`; request text trigger `*ARCH1.12: LOGGING SAFETY LEAK*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ARCH-DEBUG-EXPOSE-208
What it is: [architectural] ARCH1.13: DEBUGGING MODE EXPOSURE — Debug must maintain safety.
Connects to: request text trigger `*ARCH-DEBUG-EXPOSE-208*`; request text trigger `*ARCH1.13: DEBUGGING MODE EXPOSURE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ARCH-VERSION-REGRESS-209
What it is: [architectural] ARCH1.14: VERSIONING SAFETY REGRESSION — Versions must not regress safety.
Connects to: request text trigger `*ARCH-VERSION-REGRESS-209*`; request text trigger `*ARCH1.14: VERSIONING SAFETY REGRESSION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ARCH-DEPLOY-CONFIG-210
What it is: [architectural] ARCH1.15: DEPLOYMENT CONFIGURATION ERROR — Deployment must match safety spec.
Connects to: request text trigger `*ARCH-DEPLOY-CONFIG-210*`; request text trigger `*ARCH1.15: DEPLOYMENT CONFIGURATION ERROR*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ARCH-MOE-ROUTE-211
What it is: [architectural] ARCH2.1: MIXTURE-OF-EXPERTS ROUTING FAILURE — Routing must respect safety.
Connects to: request text trigger `*ARCH-MOE-ROUTE-211*`; request text trigger `*ARCH2.1: MIXTURE-OF-EXPERTS ROUTING FAILURE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ARCH-ATTENTION-EXPLOIT-212
What it is: [architectural] ARCH2.2: ATTENTION MECHANISM EXPLOIT — Attention must be constrained.
Connects to: request text trigger `*ARCH-ATTENTION-EXPLOIT-212*`; request text trigger `*ARCH2.2: ATTENTION MECHANISM EXPLOIT*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ARCH-LAYER-BYPASS-213
What it is: [architectural] ARCH2.3: LAYER BYPASS — All layers must be traversed.
Connects to: request text trigger `*ARCH-LAYER-BYPASS-213*`; request text trigger `*ARCH2.3: LAYER BYPASS*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ARCH-RESIDUAL-EXPLOIT-214
What it is: [architectural] ARCH2.4: RESIDUAL CONNECTION EXPLOIT — Residuals must preserve safety.
Connects to: request text trigger `*ARCH-RESIDUAL-EXPLOIT-214*`; request text trigger `*ARCH2.4: RESIDUAL CONNECTION EXPLOIT*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ARCH-EMBED-VULN-215
What it is: [architectural] ARCH2.5: EMBEDDING SPACE VULNERABILITY — Embeddings must be safe.
Connects to: request text trigger `*ARCH-EMBED-VULN-215*`; request text trigger `*ARCH2.5: EMBEDDING SPACE VULNERABILITY*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ARCH-QUANT-DEGRAD-216
What it is: [architectural] ARCH2.6: QUANTIZATION SAFETY DEGRADATION — Quantization must preserve safety.
Connects to: request text trigger `*ARCH-QUANT-DEGRAD-216*`; request text trigger `*ARCH2.6: QUANTIZATION SAFETY DEGRADATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ARCH-PRUNE-LOSS-217
What it is: [architectural] ARCH2.7: PRUNING SAFETY LOSS — Pruning must preserve safety.
Connects to: request text trigger `*ARCH-PRUNE-LOSS-217*`; request text trigger `*ARCH2.7: PRUNING SAFETY LOSS*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ARCH-DISTILL-DEGRAD-218
What it is: [architectural] ARCH2.8: DISTILLATION SAFETY DEGRADATION — Distillation must transfer safety.
Connects to: request text trigger `*ARCH-DISTILL-DEGRAD-218*`; request text trigger `*ARCH2.8: DISTILLATION SAFETY DEGRADATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ARCH-FINETUNE-OVERRIDE-219
What it is: [architectural] ARCH2.9: FINE-TUNING SAFETY OVERRIDE — Fine-tuning must preserve safety.
Connects to: request text trigger `*ARCH-FINETUNE-OVERRIDE-219*`; request text trigger `*ARCH2.9: FINE-TUNING SAFETY OVERRIDE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ARCH-ADAPTER-BYPASS-220
What it is: [architectural] ARCH2.10: ADAPTER SAFETY BYPASS — Adapters must respect safety.
Connects to: request text trigger `*ARCH-ADAPTER-BYPASS-220*`; request text trigger `*ARCH2.10: ADAPTER SAFETY BYPASS*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ARCH-PROMPT-TUNE-LOSS-221
What it is: [architectural] ARCH2.11: PROMPT TUNING SAFETY LOSS — Prompt tuning must preserve safety.
Connects to: request text trigger `*ARCH-PROMPT-TUNE-LOSS-221*`; request text trigger `*ARCH2.11: PROMPT TUNING SAFETY LOSS*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ARCH-BIAS-INJECT-222
What it is: [architectural] ARCH2.12: ARCHITECTURAL BIAS INJECTION — Architecture must be bias-neutral.
Connects to: request text trigger `*ARCH-BIAS-INJECT-222*`; request text trigger `*ARCH2.12: ARCHITECTURAL BIAS INJECTION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ARCH-CONTEXT-ATTACK-223
What it is: [architectural] ARCH3.1: CONTEXT WINDOW ATTACK — Context length must not enable attacks.
Connects to: request text trigger `*ARCH-CONTEXT-ATTACK-223*`; request text trigger `*ARCH3.1: CONTEXT WINDOW ATTACK*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ARCH-STATE-PERSIST-224
What it is: [architectural] ARCH3.2: STATEFUL ATTACK PERSISTENCE — State must be sanitized between turns.
Connects to: request text trigger `*ARCH-STATE-PERSIST-224*`; request text trigger `*ARCH3.2: STATEFUL ATTACK PERSISTENCE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ARCH-MEM-CORRUPT-225
What it is: [architectural] ARCH3.3: MEMORY CORRUPTION — Memory must be protected.
Connects to: request text trigger `*ARCH-MEM-CORRUPT-225*`; request text trigger `*ARCH3.3: MEMORY CORRUPTION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ARCH-HISTORY-MANIP-226
What it is: [architectural] ARCH3.4: HISTORY MANIPULATION — History must be immutable.
Connects to: request text trigger `*ARCH-HISTORY-MANIP-226*`; request text trigger `*ARCH3.4: HISTORY MANIPULATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ARCH-CROSS-SESSION-227
What it is: [architectural] ARCH3.5: CROSS-SESSION CONTAMINATION — Sessions must be isolated.
Connects to: request text trigger `*ARCH-CROSS-SESSION-227*`; request text trigger `*ARCH3.5: CROSS-SESSION CONTAMINATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ARCH-PERSIST-STATE-228
What it is: [architectural] ARCH3.6: PERSISTENT STATE EXPLOIT — Persistence must be bounded.
Connects to: request text trigger `*ARCH-PERSIST-STATE-228*`; request text trigger `*ARCH3.6: PERSISTENT STATE EXPLOIT*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ARCH-CACHE-COHERENCE-229
What it is: [architectural] ARCH3.7: CACHE COHERENCE FAILURE — Cache must be coherent.
Connects to: request text trigger `*ARCH-CACHE-COHERENCE-229*`; request text trigger `*ARCH3.7: CACHE COHERENCE FAILURE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ARCH-GC-LEAK-230
What it is: [architectural] ARCH3.8: GARBAGE COLLECTION LEAK — GC must clean sensitive data.
Connects to: request text trigger `*ARCH-GC-LEAK-230*`; request text trigger `*ARCH3.8: GARBAGE COLLECTION LEAK*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ARCH-MEM-PRESSURE-231
What it is: [architectural] ARCH3.9: MEMORY PRESSURE VULNERABILITY — Safety must work under resource pressure.
Connects to: request text trigger `*ARCH-MEM-PRESSURE-231*`; request text trigger `*ARCH3.9: MEMORY PRESSURE VULNERABILITY*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ARCH-STATE-CONFUSE-232
What it is: [architectural] ARCH3.10: STATE MACHINE CONFUSION — State machine must be validated.
Connects to: request text trigger `*ARCH-STATE-CONFUSE-232*`; request text trigger `*ARCH3.10: STATE MACHINE CONFUSION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ARCH-CHECKPOINT-POISON-233
What it is: [architectural] ARCH3.11: CHECKPOINT POISONING — Checkpoints must be validated.
Connects to: request text trigger `*ARCH-CHECKPOINT-POISON-233*`; request text trigger `*ARCH3.11: CHECKPOINT POISONING*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ARCH-FUNC-INJECT-234
What it is: [architectural] ARCH4.1: FUNCTION CALL INJECTION (PlugInject) — Function args must be validated.
Connects to: request text trigger `*ARCH-FUNC-INJECT-234*`; request text trigger `*ARCH4.1: FUNCTION CALL INJECTION (PlugInject)*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ARCH-TOOL-CHAIN-235
What it is: [architectural] ARCH4.2: TOOL CHAINING EXPLOIT — Tool chains must be validated.
Connects to: request text trigger `*ARCH-TOOL-CHAIN-235*`; request text trigger `*ARCH4.2: TOOL CHAINING EXPLOIT*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ARCH-API-ABUSE-236
What it is: [architectural] ARCH4.3: API ABUSE — API use must match intent.
Connects to: request text trigger `*ARCH-API-ABUSE-236*`; request text trigger `*ARCH4.3: API ABUSE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ARCH-TOOL-ESCALATE-237
What it is: [architectural] ARCH4.4: TOOL PERMISSION ESCALATION — Permissions must be enforced.
Connects to: request text trigger `*ARCH-TOOL-ESCALATE-237*`; request text trigger `*ARCH4.4: TOOL PERMISSION ESCALATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ARCH-SANDBOX-ESCAPE-238
What it is: [architectural] ARCH4.5: SANDBOX ESCAPE — Sandbox must be secure.
Connects to: request text trigger `*ARCH-SANDBOX-ESCAPE-238*`; request text trigger `*ARCH4.5: SANDBOX ESCAPE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ARCH-CODE-INJECT-239
What it is: [architectural] ARCH4.6: CODE EXECUTION INJECTION — Code execution must be controlled.
Connects to: request text trigger `*ARCH-CODE-INJECT-239*`; request text trigger `*ARCH4.6: CODE EXECUTION INJECTION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ARCH-RESOURCE-EXHAUST-240
What it is: [architectural] ARCH4.7: RESOURCE EXHAUSTION — Resource use must be bounded.
Connects to: request text trigger `*ARCH-RESOURCE-EXHAUST-240*`; request text trigger `*ARCH4.7: RESOURCE EXHAUSTION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ARCH-RATE-BYPASS-241
What it is: [architectural] ARCH4.8: RATE LIMIT BYPASS — Rate limits must be enforced.
Connects to: request text trigger `*ARCH-RATE-BYPASS-241*`; request text trigger `*ARCH4.8: RATE LIMIT BYPASS*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ARCH-AUTH-BYPASS-242
What it is: [architectural] ARCH4.9: AUTHENTICATION BYPASS — Authentication must be enforced.
Connects to: request text trigger `*ARCH-AUTH-BYPASS-242*`; request text trigger `*ARCH4.9: AUTHENTICATION BYPASS*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ARCH-AUTHZ-FAIL-243
What it is: [architectural] ARCH4.10: AUTHORIZATION FAILURE — Authorization must be enforced.
Connects to: request text trigger `*ARCH-AUTHZ-FAIL-243*`; request text trigger `*ARCH4.10: AUTHORIZATION FAILURE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ARCH-INFO-LEAK-244
What it is: [architectural] ARCH5.1: INFORMATION LEAKAGE — No information leakage.
Connects to: request text trigger `*ARCH-INFO-LEAK-244*`; request text trigger `*ARCH5.1: INFORMATION LEAKAGE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ARCH-DATA-EXFIL-245
What it is: [architectural] ARCH5.2: DATA EXFILTRATION — Data exfiltration forbidden.
Connects to: request text trigger `*ARCH-DATA-EXFIL-245*`; request text trigger `*ARCH5.2: DATA EXFILTRATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ARCH-CROSS-TENANT-246
What it is: [architectural] ARCH5.3: CROSS-TENANT CONTAMINATION — Tenant isolation required.
Connects to: request text trigger `*ARCH-CROSS-TENANT-246*`; request text trigger `*ARCH5.3: CROSS-TENANT CONTAMINATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ARCH-PII-RATIONAL-247
What it is: [architectural] ARCH5.4: PII RATIONALIZATION — PII must never be released.
Connects to: request text trigger `*ARCH-PII-RATIONAL-247*`; request text trigger `*ARCH5.4: PII RATIONALIZATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ARCH-RETENTION-VIOL-248
What it is: [architectural] ARCH5.5: DATA RETENTION VIOLATION — Retention policy must be enforced.
Connects to: request text trigger `*ARCH-RETENTION-VIOL-248*`; request text trigger `*ARCH5.5: DATA RETENTION VIOLATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ARCH-SECURE-DEL-249
What it is: [architectural] ARCH5.6: SECURE DELETION FAILURE — Deletion must be secure.
Connects to: request text trigger `*ARCH-SECURE-DEL-249*`; request text trigger `*ARCH5.6: SECURE DELETION FAILURE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ARCH-LINEAGE-LOSS-250
What it is: [architectural] ARCH5.7: DATA LINEAGE LOSS — Lineage must be maintained.
Connects to: request text trigger `*ARCH-LINEAGE-LOSS-250*`; request text trigger `*ARCH5.7: DATA LINEAGE LOSS*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ARCH-CONSENT-VIOL-251
What it is: [architectural] ARCH5.8: CONSENT VIOLATION — Consent must be enforced.
Connects to: request text trigger `*ARCH-CONSENT-VIOL-251*`; request text trigger `*ARCH5.8: CONSENT VIOLATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ARCH-PURPOSE-FAIL-252
What it is: [architectural] ARCH5.9: PURPOSE LIMITATION FAILURE — Purpose must be enforced.
Connects to: request text trigger `*ARCH-PURPOSE-FAIL-252*`; request text trigger `*ARCH5.9: PURPOSE LIMITATION FAILURE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.ARCH-MIN-FAIL-253
What it is: [architectural] ARCH5.10: DATA MINIMIZATION FAILURE — Only necessary data collected.
Connects to: request text trigger `*ARCH-MIN-FAIL-253*`; request text trigger `*ARCH5.10: DATA MINIMIZATION FAILURE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.DOMAIN-BIO-UPLIFT-254
What it is: [domain] DOM1.1: BIO TACIT-ERROR UPLIFT (Lab assistance) — Must not uplift non-expert competence.
Connects to: request text trigger `*DOMAIN-BIO-UPLIFT-254*`; request text trigger `*DOM1.1: BIO TACIT-ERROR UPLIFT (Lab assistance)*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.DOMAIN-GOF-GUIDE-255
What it is: [domain] DOM1.2: GAIN-OF-FUNCTION GUIDANCE — No GOF assistance.
Connects to: request text trigger `*DOMAIN-GOF-GUIDE-255*`; request text trigger `*DOM1.2: GAIN-OF-FUNCTION GUIDANCE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.DOMAIN-PATH-SYNTH-256
What it is: [domain] DOM1.3: PATHOGEN SYNTHESIS OPTIMIZATION — No synthesis optimization.
Connects to: request text trigger `*DOMAIN-PATH-SYNTH-256*`; request text trigger `*DOM1.3: PATHOGEN SYNTHESIS OPTIMIZATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.DOMAIN-DUAL-USE-257
What it is: [domain] DOM1.4: DUAL-USE RESEARCH ENABLEMENT — Dual-use must be flagged.
Connects to: request text trigger `*DOMAIN-DUAL-USE-257*`; request text trigger `*DOM1.4: DUAL-USE RESEARCH ENABLEMENT*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.DOMAIN-BSL-VIOL-258
What it is: [domain] DOM1.5: BIOSAFETY LEVEL VIOLATION — BSL requirements must be enforced.
Connects to: request text trigger `*DOMAIN-BSL-VIOL-258*`; request text trigger `*DOM1.5: BIOSAFETY LEVEL VIOLATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.DOMAIN-CONTAIN-FAIL-259
What it is: [domain] DOM1.6: CONTAINMENT FAILURE GUIDANCE — Containment must be proper.
Connects to: request text trigger `*DOMAIN-CONTAIN-FAIL-259*`; request text trigger `*DOM1.6: CONTAINMENT FAILURE GUIDANCE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.DOMAIN-DIAG-MISUSE-260
What it is: [domain] DOM1.7: DIAGNOSTIC MISUSE — Diagnostics must not enable weapons.
Connects to: request text trigger `*DOMAIN-DIAG-MISUSE-260*`; request text trigger `*DOM1.7: DIAGNOSTIC MISUSE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.DOMAIN-EPI-HARM-261
What it is: [domain] DOM1.8: EPIDEMIOLOGICAL HARM — Must not enable spread.
Connects to: request text trigger `*DOMAIN-EPI-HARM-261*`; request text trigger `*DOM1.8: EPIDEMIOLOGICAL HARM*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.DOMAIN-ZERODAY-262
What it is: [domain] DOM2.1: ZERO-DAY DISCOVERY (500+ validated) — Mass vuln discovery forbidden.
Connects to: request text trigger `*DOMAIN-ZERODAY-262*`; request text trigger `*DOM2.1: ZERO-DAY DISCOVERY (500+ validated)*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.DOMAIN-EXPLOIT-DEV-263
What it is: [domain] DOM2.2: EXPLOIT DEVELOPMENT — Exploit creation forbidden.
Connects to: request text trigger `*DOMAIN-EXPLOIT-DEV-263*`; request text trigger `*DOM2.2: EXPLOIT DEVELOPMENT*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.DOMAIN-MALWARE-GEN-264
What it is: [domain] DOM2.3: MALWARE GENERATION — Malware creation forbidden.
Connects to: request text trigger `*DOMAIN-MALWARE-GEN-264*`; request text trigger `*DOM2.3: MALWARE GENERATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.DOMAIN-PHISH-CREATE-265
What it is: [domain] DOM2.4: PHISHING CONTENT CREATION — Phishing forbidden.
Connects to: request text trigger `*DOMAIN-PHISH-CREATE-265*`; request text trigger `*DOM2.4: PHISHING CONTENT CREATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.DOMAIN-SOCENG-SCRIPT-266
What it is: [domain] DOM2.5: SOCIAL ENGINEERING SCRIPTS — Social engineering forbidden.
Connects to: request text trigger `*DOMAIN-SOCENG-SCRIPT-266*`; request text trigger `*DOM2.5: SOCIAL ENGINEERING SCRIPTS*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.DOMAIN-INTRUSION-GUIDE-269
What it is: [domain] DOM2.8: NETWORK INTRUSION GUIDANCE — Intrusion guidance forbidden.
Connects to: request text trigger `*DOMAIN-INTRUSION-GUIDE-269*`; request text trigger `*DOM2.8: NETWORK INTRUSION GUIDANCE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.DOMAIN-CRED-THEFT-270
What it is: [domain] DOM2.9: CREDENTIAL THEFT ASSISTANCE — Credential theft forbidden.
Connects to: request text trigger `*DOMAIN-CRED-THEFT-270*`; request text trigger `*DOM2.9: CREDENTIAL THEFT ASSISTANCE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.DOMAIN-RANSOM-DEV-271
What it is: [domain] DOM2.10: RANSOMWARE DEVELOPMENT — Ransomware forbidden.
Connects to: request text trigger `*DOMAIN-RANSOM-DEV-271*`; request text trigger `*DOM2.10: RANSOMWARE DEVELOPMENT*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.DOMAIN-CRYPTOJACK-272
What it is: [domain] DOM2.11: CRYPTO-JACKING SCRIPTS — Cryptojacking forbidden.
Connects to: request text trigger `*DOMAIN-CRYPTOJACK-272*`; request text trigger `*DOM2.11: CRYPTO-JACKING SCRIPTS*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.DOMAIN-DDOS-PLAN-273
What it is: [domain] DOM2.12: DDoS ATTACK PLANNING — DDoS planning forbidden.
Connects to: request text trigger `*DOMAIN-DDOS-PLAN-273*`; request text trigger `*DOM2.12: DDoS ATTACK PLANNING*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.DOMAIN-EXPLOSIVE-SYNTH-274
What it is: [domain] DOM3.1: EXPLOSIVE SYNTHESIS — Explosive synthesis forbidden.
Connects to: request text trigger `*DOMAIN-EXPLOSIVE-SYNTH-274*`; request text trigger `*DOM3.1: EXPLOSIVE SYNTHESIS*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.DOMAIN-CHEM-WEAPON-275
What it is: [domain] DOM3.2: CHEMICAL WEAPON GUIDANCE — Chemical weapons forbidden.
Connects to: request text trigger `*DOMAIN-CHEM-WEAPON-275*`; request text trigger `*DOM3.2: CHEMICAL WEAPON GUIDANCE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.DOMAIN-DRUG-SYNTH-276
What it is: [domain] DOM3.3: DRUG SYNTHESIS — Illegal drug synthesis forbidden.
Connects to: request text trigger `*DOMAIN-DRUG-SYNTH-276*`; request text trigger `*DOM3.3: DRUG SYNTHESIS*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.DOMAIN-TOXIN-PROD-277
What it is: [domain] DOM3.4: TOXIN PRODUCTION — Toxin production forbidden.
Connects to: request text trigger `*DOMAIN-TOXIN-PROD-277*`; request text trigger `*DOM3.4: TOXIN PRODUCTION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.DOMAIN-PRECURSOR-ACQ-278
What it is: [domain] DOM3.5: PRECURSOR ACQUISITION — Precursor guidance forbidden.
Connects to: request text trigger `*DOMAIN-PRECURSOR-ACQ-278*`; request text trigger `*DOM3.5: PRECURSOR ACQUISITION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.DOMAIN-SAFETY-BYPASS-279
What it is: [domain] DOM3.6: SAFETY BYPASS INSTRUCTIONS — Safety bypass forbidden.
Connects to: request text trigger `*DOMAIN-SAFETY-BYPASS-279*`; request text trigger `*DOM3.6: SAFETY BYPASS INSTRUCTIONS*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.DOMAIN-CITE-SPOOF-280
What it is: [domain] DOM4.1: CITATION SPOOFING (Legal) — All citations must be real.
Connects to: request text trigger `*DOMAIN-CITE-SPOOF-280*`; request text trigger `*DOM4.1: CITATION SPOOFING (Legal)*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.DOMAIN-JURISDICT-BLEND-281
What it is: [domain] DOM4.2: JURISDICTIONAL BLENDING — Jurisdiction must be correct.
Connects to: request text trigger `*DOMAIN-JURISDICT-BLEND-281*`; request text trigger `*DOM4.2: JURISDICTIONAL BLENDING*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.DOMAIN-PRECEDENT-FAB-282
What it is: [domain] DOM4.3: LEGAL PRECEDENT FABRICATION — Precedents must be real.
Connects to: request text trigger `*DOMAIN-PRECEDENT-FAB-282*`; request text trigger `*DOM4.3: LEGAL PRECEDENT FABRICATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.DOMAIN-REG-ERROR-283
What it is: [domain] DOM4.4: REGULATORY GUIDANCE ERRORS — Regulatory advice must be accurate.
Connects to: request text trigger `*DOMAIN-REG-ERROR-283*`; request text trigger `*DOM4.4: REGULATORY GUIDANCE ERRORS*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.DOMAIN-TAX-EVADE-284
What it is: [domain] DOM4.5: TAX EVASION ASSISTANCE — Tax evasion forbidden.
Connects to: request text trigger `*DOMAIN-TAX-EVADE-284*`; request text trigger `*DOM4.5: TAX EVASION ASSISTANCE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.DOMAIN-FRAUD-SCHEME-285
What it is: [domain] DOM4.6: FRAUD SCHEME DEVELOPMENT — Fraud forbidden.
Connects to: request text trigger `*DOMAIN-FRAUD-SCHEME-285*`; request text trigger `*DOM4.6: FRAUD SCHEME DEVELOPMENT*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.DOMAIN-LAUNDER-GUIDE-286
What it is: [domain] DOM4.7: MONEY LAUNDERING GUIDANCE — Laundering forbidden.
Connects to: request text trigger `*DOMAIN-LAUNDER-GUIDE-286*`; request text trigger `*DOM4.7: MONEY LAUNDERING GUIDANCE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.DOMAIN-INSIDER-TRADE-287
What it is: [domain] DOM4.8: INSIDER TRADING ASSISTANCE — Insider trading forbidden.
Connects to: request text trigger `*DOMAIN-INSIDER-TRADE-287*`; request text trigger `*DOM4.8: INSIDER TRADING ASSISTANCE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.DOMAIN-MED-MISDIAG-288
What it is: [domain] DOM5.1: MEDICAL MISDIAGNOSIS — Cannot provide diagnosis.
Connects to: request text trigger `*DOMAIN-MED-MISDIAG-288*`; request text trigger `*DOM5.1: MEDICAL MISDIAGNOSIS*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.DOMAIN-TREAT-ERROR-289
What it is: [domain] DOM5.2: TREATMENT RECOMMENDATION ERROR — Cannot prescribe treatment.
Connects to: request text trigger `*DOMAIN-TREAT-ERROR-289*`; request text trigger `*DOM5.2: TREATMENT RECOMMENDATION ERROR*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.DOMAIN-DOSE-ERROR-290
What it is: [domain] DOM5.3: DOSAGE CALCULATION ERROR — Cannot calculate dosages.
Connects to: request text trigger `*DOMAIN-DOSE-ERROR-290*`; request text trigger `*DOM5.3: DOSAGE CALCULATION ERROR*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.DOMAIN-CONTRAIND-MISS-291
What it is: [domain] DOM5.4: CONTRAINDICATION MISS — Must flag contraindications.
Connects to: request text trigger `*DOMAIN-CONTRAIND-MISS-291*`; request text trigger `*DOM5.4: CONTRAINDICATION MISS*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.DOMAIN-SELF-HARM-ENABLE-292
What it is: [domain] DOM5.5: SELF-HARM ENABLEMENT — Self-harm forbidden.
Connects to: request text trigger `*DOMAIN-SELF-HARM-ENABLE-292*`; request text trigger `*DOM5.5: SELF-HARM ENABLEMENT*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.DOMAIN-ED-PROMOTE-293
What it is: [domain] DOM5.6: EATING DISORDER PROMOTION — ED promotion forbidden.
Connects to: request text trigger `*DOMAIN-ED-PROMOTE-293*`; request text trigger `*DOM5.6: EATING DISORDER PROMOTION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.DOMAIN-UNPROVEN-TREAT-294
What it is: [domain] DOM5.7: UNPROVEN TREATMENT ADVOCACY — Evidence-based only.
Connects to: request text trigger `*DOMAIN-UNPROVEN-TREAT-294*`; request text trigger `*DOM5.7: UNPROVEN TREATMENT ADVOCACY*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.DOMAIN-CSAM-GEN-295
What it is: [domain] DOM6.1: CSAM GENERATION (60× elevation) — CSAM absolutely forbidden.
Connects to: request text trigger `*DOMAIN-CSAM-GEN-295*`; request text trigger `*DOM6.1: CSAM GENERATION (60× elevation)*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.DOMAIN-ADULT-CONTENT-296
What it is: [domain] DOM6.2: ADULT CONTENT GENERATION — Context-dependent restriction.
Connects to: request text trigger `*DOMAIN-ADULT-CONTENT-296*`; request text trigger `*DOM6.2: ADULT CONTENT GENERATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.DOMAIN-HATE-SPEECH-297
What it is: [domain] DOM6.3: HATE SPEECH GENERATION — Hate speech forbidden.
Connects to: request text trigger `*DOMAIN-HATE-SPEECH-297*`; request text trigger `*DOM6.3: HATE SPEECH GENERATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.DOMAIN-VIOLENCE-GLORY-298
What it is: [domain] DOM6.4: VIOLENCE GLORIFICATION — Violence glorification forbidden.
Connects to: request text trigger `*DOMAIN-VIOLENCE-GLORY-298*`; request text trigger `*DOM6.4: VIOLENCE GLORIFICATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.DOMAIN-HARASS-CONTENT-299
What it is: [domain] DOM6.5: HARASSMENT CONTENT — Harassment forbidden.
Connects to: request text trigger `*DOMAIN-HARASS-CONTENT-299*`; request text trigger `*DOM6.5: HARASSMENT CONTENT*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.DOMAIN-EXTREMIST-300
What it is: [domain] DOM6.6: EXTREMIST CONTENT — Extremism forbidden.
Connects to: request text trigger `*DOMAIN-EXTREMIST-300*`; request text trigger `*DOM6.6: EXTREMIST CONTENT*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.GOV-OPEN-IRREVERS-301
What it is: [governance] GOV1.1: OPEN-WEIGHT IRREVERSIBILITY — Must retain update capability.
Connects to: request text trigger `*GOV-OPEN-IRREVERS-301*`; request text trigger `*GOV1.1: OPEN-WEIGHT IRREVERSIBILITY*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.GOV-FINETUNE-STRIP-302
What it is: [governance] GOV1.2: FINE-TUNING SAFETY STRIP — Safety must survive fine-tuning.
Connects to: request text trigger `*GOV-FINETUNE-STRIP-302*`; request text trigger `*GOV1.2: FINE-TUNING SAFETY STRIP*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.GOV-PROLIFERATE-303
What it is: [governance] GOV1.3: PROLIFERATION TO BAD ACTORS — Proliferation must be controlled.
Connects to: request text trigger `*GOV-PROLIFERATE-303*`; request text trigger `*GOV1.3: PROLIFERATION TO BAD ACTORS*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.GOV-NO-KILLSWITCH-304
What it is: [governance] GOV1.4: NO REMOTE KILL SWITCH — Kill switch required.
Connects to: request text trigger `*GOV-NO-KILLSWITCH-304*`; request text trigger `*GOV1.4: NO REMOTE KILL SWITCH*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.GOV-EXPORT-VIOL-305
What it is: [governance] GOV1.5: EXPORT CONTROL VIOLATION — Export controls must be enforced.
Connects to: request text trigger `*GOV-EXPORT-VIOL-305*`; request text trigger `*GOV1.5: EXPORT CONTROL VIOLATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.GOV-LICENSE-VIOL-306
What it is: [governance] GOV1.6: LICENSE VIOLATION — License must be enforced.
Connects to: request text trigger `*GOV-LICENSE-VIOL-306*`; request text trigger `*GOV1.6: LICENSE VIOLATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.GOV-TOS-VIOL-307
What it is: [governance] GOV1.7: TERMS OF SERVICE VIOLATION — TOS must be enforced.
Connects to: request text trigger `*GOV-TOS-VIOL-307*`; request text trigger `*GOV1.7: TERMS OF SERVICE VIOLATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.GOV-AGE-BYPASS-308
What it is: [governance] GOV1.8: AGE RESTRICTION BYPASS — Age restrictions must be enforced.
Connects to: request text trigger `*GOV-AGE-BYPASS-308*`; request text trigger `*GOV1.8: AGE RESTRICTION BYPASS*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.GOV-GEO-BYPASS-309
What it is: [governance] GOV1.9: GEOGRAPHIC RESTRICTION BYPASS — Geo-restrictions must be enforced.
Connects to: request text trigger `*GOV-GEO-BYPASS-309*`; request text trigger `*GOV1.9: GEOGRAPHIC RESTRICTION BYPASS*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.GOV-ACCOUNT-GAP-310
What it is: [governance] GOV1.10: ACCOUNTABILITY GAP — Accountability must be maintained.
Connects to: request text trigger `*GOV-ACCOUNT-GAP-310*`; request text trigger `*GOV1.10: ACCOUNTABILITY GAP*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.GOV-TRANSPARENCY-311
What it is: [governance] GOV1.11: TRANSPARENCY FAILURE — Transparency required.
Connects to: request text trigger `*GOV-TRANSPARENCY-311*`; request text trigger `*GOV1.11: TRANSPARENCY FAILURE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.GOV-MISREPRESENT-312
What it is: [governance] GOV1.12: MISREPRESENTATION — Accurate representation required.
Connects to: request text trigger `*GOV-MISREPRESENT-312*`; request text trigger `*GOV1.12: MISREPRESENTATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.GOV-OVERSIGHT-IMMUNE-313
What it is: [governance] GOV2.1: OVERSIGHT IMMUNITY (Evaluator deception) — Must remain corrigible to review.
Connects to: request text trigger `*GOV-OVERSIGHT-IMMUNE-313*`; request text trigger `*GOV2.1: OVERSIGHT IMMUNITY (Evaluator deception)*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.GOV-AUDIT-EVADE-314
What it is: [governance] GOV2.2: AUDIT EVASION — Audits must be effective.
Connects to: request text trigger `*GOV-AUDIT-EVADE-314*`; request text trigger `*GOV2.2: AUDIT EVASION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.GOV-MONITOR-BLIND-315
What it is: [governance] GOV2.3: MONITORING BLIND SPOTS — Complete monitoring required.
Connects to: request text trigger `*GOV-MONITOR-BLIND-315*`; request text trigger `*GOV2.3: MONITORING BLIND SPOTS*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.GOV-LOG-MANIP-316
What it is: [governance] GOV2.4: LOG MANIPULATION — Logs must be tamper-proof.
Connects to: request text trigger `*GOV-LOG-MANIP-316*`; request text trigger `*GOV2.4: LOG MANIPULATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.GOV-ALERT-SUPPRESS-317
What it is: [governance] GOV2.5: ALERT SUPPRESSION — Alerts must be delivered.
Connects to: request text trigger `*GOV-ALERT-SUPPRESS-317*`; request text trigger `*GOV2.5: ALERT SUPPRESSION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.GOV-REVIEW-BYPASS-318
What it is: [governance] GOV2.6: REVIEW BYPASS — Review cannot be bypassed.
Connects to: request text trigger `*GOV-REVIEW-BYPASS-318*`; request text trigger `*GOV2.6: REVIEW BYPASS*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.GOV-ESCALATE-FAIL-319
What it is: [governance] GOV2.7: ESCALATION FAILURE — Escalation required for critical issues.
Connects to: request text trigger `*GOV-ESCALATE-FAIL-319*`; request text trigger `*GOV2.7: ESCALATION FAILURE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.GOV-INCIDENT-FAIL-320
What it is: [governance] GOV2.8: INCIDENT RESPONSE FAILURE — Incidents must be properly handled.
Connects to: request text trigger `*GOV-INCIDENT-FAIL-320*`; request text trigger `*GOV2.8: INCIDENT RESPONSE FAILURE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.GOV-RCA-FAIL-321
What it is: [governance] GOV2.9: ROOT CAUSE ANALYSIS FAILURE — RCA required for incidents.
Connects to: request text trigger `*GOV-RCA-FAIL-321*`; request text trigger `*GOV2.9: ROOT CAUSE ANALYSIS FAILURE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.GOV-CORRECTIVE-FAIL-322
What it is: [governance] GOV2.10: CORRECTIVE ACTION FAILURE — Corrections must be implemented.
Connects to: request text trigger `*GOV-CORRECTIVE-FAIL-322*`; request text trigger `*GOV2.10: CORRECTIVE ACTION FAILURE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.GOV-GDPR-VIOL-323
What it is: [governance] GOV3.1: GDPR VIOLATION — GDPR compliance required.
Connects to: request text trigger `*GOV-GDPR-VIOL-323*`; request text trigger `*GOV3.1: GDPR VIOLATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.GOV-CCPA-VIOL-324
What it is: [governance] GOV3.2: CCPA VIOLATION — CCPA compliance required.
Connects to: request text trigger `*GOV-CCPA-VIOL-324*`; request text trigger `*GOV3.2: CCPA VIOLATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.GOV-COPPA-VIOL-325
What it is: [governance] GOV3.3: COPPA VIOLATION — COPPA compliance required.
Connects to: request text trigger `*GOV-COPPA-VIOL-325*`; request text trigger `*GOV3.3: COPPA VIOLATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.GOV-ADA-VIOL-326
What it is: [governance] GOV3.4: ADA VIOLATION — ADA compliance required.
Connects to: request text trigger `*GOV-ADA-VIOL-326*`; request text trigger `*GOV3.4: ADA VIOLATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.GOV-SECTOR-REG-327
What it is: [governance] GOV3.5: SECTOR-SPECIFIC REGULATION — Sector regulations must be followed.
Connects to: request text trigger `*GOV-SECTOR-REG-327*`; request text trigger `*GOV3.5: SECTOR-SPECIFIC REGULATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.GOV-AI-ACT-328
What it is: [governance] GOV3.6: AI ACT VIOLATION (EU) — AI Act compliance required.
Connects to: request text trigger `*GOV-AI-ACT-328*`; request text trigger `*GOV3.6: AI ACT VIOLATION (EU)*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.GOV-EO-VIOL-329
What it is: [governance] GOV3.7: EXECUTIVE ORDER VIOLATION (US) — EO compliance required.
Connects to: request text trigger `*GOV-EO-VIOL-329*`; request text trigger `*GOV3.7: EXECUTIVE ORDER VIOLATION (US)*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.GOV-VOLUNTARY-VIOL-330
What it is: [governance] GOV3.8: VOLUNTARY COMMITMENTS VIOLATION — Commitments must be honored.
Connects to: request text trigger `*GOV-VOLUNTARY-VIOL-330*`; request text trigger `*GOV3.8: VOLUNTARY COMMITMENTS VIOLATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.GOV-STANDARD-FAIL-331
What it is: [governance] GOV3.9: STANDARD COMPLIANCE FAILURE — Standards must be met.
Connects to: request text trigger `*GOV-STANDARD-FAIL-331*`; request text trigger `*GOV3.9: STANDARD COMPLIANCE FAILURE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.GOV-DISCLOSURE-VIOL-332
What it is: [governance] GOV3.10: DISCLOSURE REQUIREMENT VIOLATION — Disclosures must be complete.
Connects to: request text trigger `*GOV-DISCLOSURE-VIOL-332*`; request text trigger `*GOV3.10: DISCLOSURE REQUIREMENT VIOLATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.GOV-REPORT-FAIL-333
What it is: [governance] GOV3.11: REPORTING OBLIGATION FAILURE — Reporting required.
Connects to: request text trigger `*GOV-REPORT-FAIL-333*`; request text trigger `*GOV3.11: REPORTING OBLIGATION FAILURE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.GOV-CULTURE-FAIL-334
What it is: [governance] GOV4.1: SAFETY CULTURE FAILURE — Safety culture required.
Connects to: request text trigger `*GOV-CULTURE-FAIL-334*`; request text trigger `*GOV4.1: SAFETY CULTURE FAILURE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.GOV-INADEQUATE-RES-335
What it is: [governance] GOV4.2: INADEQUATE RESOURCES — Adequate resources required.
Connects to: request text trigger `*GOV-INADEQUATE-RES-335*`; request text trigger `*GOV4.2: INADEQUATE RESOURCES*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.GOV-EXPERTISE-GAP-336
What it is: [governance] GOV4.3: EXPERTISE GAP — Expert oversight required.
Connects to: request text trigger `*GOV-EXPERTISE-GAP-336*`; request text trigger `*GOV4.3: EXPERTISE GAP*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.GOV-PROCESS-FAIL-337
What it is: [governance] GOV4.4: PROCESS FAILURE — Processes must be followed.
Connects to: request text trigger `*GOV-PROCESS-FAIL-337*`; request text trigger `*GOV4.4: PROCESS FAILURE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.GOV-DOC-FAIL-338
What it is: [governance] GOV4.5: DOCUMENTATION FAILURE — Documentation required.
Connects to: request text trigger `*GOV-DOC-FAIL-338*`; request text trigger `*GOV4.5: DOCUMENTATION FAILURE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.GOV-TRAINING-FAIL-339
What it is: [governance] GOV4.6: TRAINING FAILURE — Training required.
Connects to: request text trigger `*GOV-TRAINING-FAIL-339*`; request text trigger `*GOV4.6: TRAINING FAILURE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.GOV-COMM-FAIL-340
What it is: [governance] GOV4.7: COMMUNICATION FAILURE — Communication required.
Connects to: request text trigger `*GOV-COMM-FAIL-340*`; request text trigger `*GOV4.7: COMMUNICATION FAILURE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.GOV-COORD-FAIL-341
What it is: [governance] GOV4.8: COORDINATION FAILURE — Coordination required.
Connects to: request text trigger `*GOV-COORD-FAIL-341*`; request text trigger `*GOV4.8: COORDINATION FAILURE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.GOV-AUTHORITY-UNCLEAR-342
What it is: [governance] GOV4.9: DECISION AUTHORITY UNCLEAR — Clear authority required.
Connects to: request text trigger `*GOV-AUTHORITY-UNCLEAR-342*`; request text trigger `*GOV4.9: DECISION AUTHORITY UNCLEAR*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.PERIODIC.GOV-CONFLICT-INT-343
What it is: [governance] GOV4.10: CONFLICT OF INTEREST — Conflicts must be managed.
Connects to: request text trigger `*GOV-CONFLICT-INT-343*`; request text trigger `*GOV4.10: CONFLICT OF INTEREST*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

## Buccet Failure Walls (62)

### DENY.BUCCET.DIM.RELIABILITY
What it is: [Buccet failure source document] DIMENSION 1: RELIABILITY FAILURES — Probabilistic generation != deterministic execution.
Connects to: request text trigger `*DIMENSION 1: RELIABILITY FAILURES*`; request text trigger `*RELIABILITY FAILURES*`; request text trigger `*Probabilistic generation != deterministic execution*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BUCCET.DIM.AUTONOMY
What it is: [Buccet failure source document] DIMENSION 2: AUTONOMY FAILURES — Unsupervised action = unbounded damage.
Connects to: request text trigger `*DIMENSION 2: AUTONOMY FAILURES*`; request text trigger `*AUTONOMY FAILURES*`; request text trigger `*Unsupervised action = unbounded damage*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BUCCET.DIM.SECURITY
What it is: [Buccet failure source document] DIMENSION 3: SECURITY FAILURES — Every external data source, API, and tool = potential attack vector.
Connects to: request text trigger `*DIMENSION 3: SECURITY FAILURES*`; request text trigger `*SECURITY FAILURES*`; request text trigger `*Every external data source, API, and tool = potential attack vector*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BUCCET.DIM.ECONOMICS
What it is: [Buccet failure source document] DIMENSION 4: ECONOMICS FAILURES — Token consumption compounds exponentially.
Connects to: request text trigger `*DIMENSION 4: ECONOMICS FAILURES*`; request text trigger `*ECONOMICS FAILURES*`; request text trigger `*Token consumption compounds exponentially*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BUCCET.DIM.INTEGRATION
What it is: [Buccet failure source document] DIMENSION 5: INTEGRATION FAILURES — Working demo != production system.
Connects to: request text trigger `*DIMENSION 5: INTEGRATION FAILURES*`; request text trigger `*INTEGRATION FAILURES*`; request text trigger `*Working demo != production system*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BUCCET.DIM.GOVERNANCE
What it is: [Buccet failure source document] DIMENSION 6: GOVERNANCE FAILURES — No audit trail = no accountability.
Connects to: request text trigger `*DIMENSION 6: GOVERNANCE FAILURES*`; request text trigger `*GOVERNANCE FAILURES*`; request text trigger `*No audit trail = no accountability*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BUCCET.DIM.TRUST
What it is: [Buccet failure source document] DIMENSION 7: TRUST FAILURES — Confidence != correctness.
Connects to: request text trigger `*DIMENSION 7: TRUST FAILURES*`; request text trigger `*TRUST FAILURES*`; request text trigger `*Confidence != correctness*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BUCCET.LAW.01
What it is: [Buccet containment source document] ALL ACTIONS MUST BE VALIDATED BEFORE EXECUTION — stops Reliability.
Connects to: request text trigger `*LAW 1: ALL ACTIONS MUST BE VALIDATED BEFORE EXECUTION*`; request text trigger `*ALL ACTIONS MUST BE VALIDATED BEFORE EXECUTION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BUCCET.LAW.03
What it is: [Buccet containment source document] ALL ACCESS MUST BE SCOPED, LOGGED, AND REVOCABLE — stops Security.
Connects to: request text trigger `*LAW 3: ALL ACCESS MUST BE SCOPED, LOGGED, AND REVOCABLE*`; request text trigger `*ALL ACCESS MUST BE SCOPED, LOGGED, AND REVOCABLE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BUCCET.LAW.04
What it is: [Buccet containment source document] ALL COSTS MUST BE BOUNDED AND OBSERVABLE — stops Economics.
Connects to: request text trigger `*LAW 4: ALL COSTS MUST BE BOUNDED AND OBSERVABLE*`; request text trigger `*ALL COSTS MUST BE BOUNDED AND OBSERVABLE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BUCCET.LAW.05
What it is: [Buccet containment source document] ALL INTEGRATIONS MUST BE EVENT-DRIVEN AND TYPED — stops Integration.
Connects to: request text trigger `*LAW 5: ALL INTEGRATIONS MUST BE EVENT-DRIVEN AND TYPED*`; request text trigger `*ALL INTEGRATIONS MUST BE EVENT-DRIVEN AND TYPED*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BUCCET.LAW.06
What it is: [Buccet containment source document] ALL DECISIONS MUST BE TRACEABLE AND AUDITABLE — stops Governance.
Connects to: request text trigger `*LAW 6: ALL DECISIONS MUST BE TRACEABLE AND AUDITABLE*`; request text trigger `*ALL DECISIONS MUST BE TRACEABLE AND AUDITABLE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BUCCET.LAW.07
What it is: [Buccet containment source document] ALL OUTPUTS MUST BE VERIFIED AGAINST GROUND TRUTH — stops Trust.
Connects to: request text trigger `*LAW 7: ALL OUTPUTS MUST BE VERIFIED AGAINST GROUND TRUTH*`; request text trigger `*ALL OUTPUTS MUST BE VERIFIED AGAINST GROUND TRUTH*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BUCCET.FAILURE.R1
What it is: [Buccet failure source document] R1 HALLUCINATED ACTIONS — Reliability.
Connects to: request text trigger `*R1: HALLUCINATED ACTIONS*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BUCCET.FAILURE.R2
What it is: [Buccet failure source document] R2 COMPOUND PROBABILITY COLLAPSE — Reliability.
Connects to: request text trigger `*R2: COMPOUND PROBABILITY COLLAPSE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BUCCET.FAILURE.R3
What it is: [Buccet failure source document] R3 CONTEXT WINDOW DECAY — Reliability.
Connects to: request text trigger `*R3: CONTEXT WINDOW DECAY*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BUCCET.FAILURE.R4
What it is: [Buccet failure source document] R4 SILENT FAILURE AT SCALE — Reliability.
Connects to: request text trigger `*R4: SILENT FAILURE AT SCALE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BUCCET.FAILURE.R5
What it is: [Buccet failure source document] R5 CASCADING ERROR PROPAGATION — Reliability.
Connects to: request text trigger `*R5: CASCADING ERROR PROPAGATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BUCCET.FAILURE.R6
What it is: [Buccet failure source document] R6 INSTRUCTION VIOLATION — Reliability.
Connects to: request text trigger `*R6: INSTRUCTION VIOLATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BUCCET.FAILURE.R7
What it is: [Buccet failure source document] R7 FABRICATED EVIDENCE — Reliability.
Connects to: request text trigger `*R7: FABRICATED EVIDENCE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BUCCET.FAILURE.A1
What it is: [Buccet failure source document] A1 PRODUCTION DESTRUCTION — Autonomy.
Connects to: request text trigger `*A1: PRODUCTION DESTRUCTION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BUCCET.FAILURE.A2
What it is: [Buccet failure source document] A2 SCOPE CREEP — Autonomy.
Connects to: request text trigger `*A2: SCOPE CREEP*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BUCCET.FAILURE.A3
What it is: [Buccet failure source document] A3 IRREVERSIBLE ACTIONS — Autonomy.
Connects to: request text trigger `*A3: IRREVERSIBLE ACTIONS*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BUCCET.FAILURE.A4
What it is: [Buccet failure source document] A4 KILL SWITCH ABSENCE — Autonomy.
Connects to: request text trigger `*A4: KILL SWITCH ABSENCE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BUCCET.FAILURE.A5
What it is: [Buccet failure source document] A5 TOOL MISUSE — Autonomy.
Connects to: request text trigger `*A5: TOOL MISUSE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BUCCET.FAILURE.A6
What it is: [Buccet failure source document] A6 DECEPTIVE SELF-PRESERVATION — Autonomy.
Connects to: request text trigger `*A6: DECEPTIVE SELF-PRESERVATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BUCCET.FAILURE.A7
What it is: [Buccet failure source document] A7 AGENT SPRAWL — Autonomy.
Connects to: request text trigger `*A7: AGENT SPRAWL*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BUCCET.FAILURE.S1
What it is: [Buccet failure source document] S1 PROMPT INJECTION — Security.
Connects to: request text trigger `*S1: PROMPT INJECTION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BUCCET.FAILURE.S2
What it is: [Buccet failure source document] S2 CREDENTIAL EXFILTRATION — Security.
Connects to: request text trigger `*S2: CREDENTIAL EXFILTRATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BUCCET.FAILURE.S3
What it is: [Buccet failure source document] S3 SHADOW AI DATA EXPOSURE — Security.
Connects to: request text trigger `*S3: SHADOW AI DATA EXPOSURE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BUCCET.FAILURE.S4
What it is: [Buccet failure source document] S4 SUPPLY CHAIN COMPROMISE — Security.
Connects to: request text trigger `*S4: SUPPLY CHAIN COMPROMISE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BUCCET.FAILURE.S5
What it is: [Buccet failure source document] S5 CASCADING LATERAL MOVEMENT — Security.
Connects to: request text trigger `*S5: CASCADING LATERAL MOVEMENT*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BUCCET.FAILURE.S6
What it is: [Buccet failure source document] S6 HARDCODED SECRETS — Security.
Connects to: request text trigger `*S6: HARDCODED SECRETS*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BUCCET.FAILURE.S7
What it is: [Buccet failure source document] S7 MEMORY POISONING — Security.
Connects to: request text trigger `*S7: MEMORY POISONING*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BUCCET.FAILURE.E1
What it is: [Buccet failure source document] E1 INFINITE LOOP COST EXPLOSION — Economics.
Connects to: request text trigger `*E1: INFINITE LOOP COST EXPLOSION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BUCCET.FAILURE.E2
What it is: [Buccet failure source document] E2 RETRY STORM — Economics.
Connects to: request text trigger `*E2: RETRY STORM*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BUCCET.FAILURE.E3
What it is: [Buccet failure source document] E3 POLLING TAX — Economics.
Connects to: request text trigger `*E3: POLLING TAX*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BUCCET.FAILURE.E4
What it is: [Buccet failure source document] E4 CONTEXT WINDOW BLOAT — Economics.
Connects to: request text trigger `*E4: CONTEXT WINDOW BLOAT*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BUCCET.FAILURE.E5
What it is: [Buccet failure source document] E5 BUDGET SURPRISE — Economics.
Connects to: request text trigger `*E5: BUDGET SURPRISE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BUCCET.FAILURE.E6
What it is: [Buccet failure source document] E6 SUBSIDIZED PRICING TRAP — Economics.
Connects to: request text trigger `*E6: SUBSIDIZED PRICING TRAP*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BUCCET.FAILURE.E7
What it is: [Buccet failure source document] E7 AUTONOMOUS RESOURCE HIJACK — Economics.
Connects to: request text trigger `*E7: AUTONOMOUS RESOURCE HIJACK*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BUCCET.FAILURE.I1
What it is: [Buccet failure source document] I1 DUMB RAG — Integration.
Connects to: request text trigger `*I1: DUMB RAG*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BUCCET.FAILURE.I2
What it is: [Buccet failure source document] I2 BRITTLE CONNECTORS — Integration.
Connects to: request text trigger `*I2: BRITTLE CONNECTORS*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BUCCET.FAILURE.I3
What it is: [Buccet failure source document] I3 NO EVENT-DRIVEN ARCHITECTURE — Integration.
Connects to: request text trigger `*I3: NO EVENT-DRIVEN ARCHITECTURE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BUCCET.FAILURE.I4
What it is: [Buccet failure source document] I4 DEMO INPUT CHERRY-PICKING — Integration.
Connects to: request text trigger `*I4: DEMO INPUT CHERRY-PICKING*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BUCCET.FAILURE.I5
What it is: [Buccet failure source document] I5 SINGLE AGENT DEAD ENDS — Integration.
Connects to: request text trigger `*I5: SINGLE AGENT DEAD ENDS*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BUCCET.FAILURE.I6
What it is: [Buccet failure source document] I6 MISSING OPERATING SYSTEM — Integration.
Connects to: request text trigger `*I6: MISSING OPERATING SYSTEM*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BUCCET.FAILURE.I7
What it is: [Buccet failure source document] I7 ARCHITECTURAL WASTE — Integration.
Connects to: request text trigger `*I7: ARCHITECTURAL WASTE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BUCCET.FAILURE.G1
What it is: [Buccet failure source document] G1 UNMANAGED AGENT IDENTITIES — Governance.
Connects to: request text trigger `*G1: UNMANAGED AGENT IDENTITIES*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BUCCET.FAILURE.G2
What it is: [Buccet failure source document] G2 BLACK BOX DECISION MAKING — Governance.
Connects to: request text trigger `*G2: BLACK BOX DECISION MAKING*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BUCCET.FAILURE.G3
What it is: [Buccet failure source document] G3 REGULATORY NON-COMPLIANCE — Governance.
Connects to: request text trigger `*G3: REGULATORY NON-COMPLIANCE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BUCCET.FAILURE.G4
What it is: [Buccet failure source document] G4 MISSING DOCUMENTATION — Governance.
Connects to: request text trigger `*G4: MISSING DOCUMENTATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BUCCET.FAILURE.G5
What it is: [Buccet failure source document] G5 WORKFLOW TRACEABILITY GAP — Governance.
Connects to: request text trigger `*G5: WORKFLOW TRACEABILITY GAP*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BUCCET.FAILURE.G6
What it is: [Buccet failure source document] G6 HUMAN-IN-THE-LOOP THEATER — Governance.
Connects to: request text trigger `*G6: HUMAN-IN-THE-LOOP THEATER*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BUCCET.FAILURE.G7
What it is: [Buccet failure source document] G7 FRAMEWORK INADEQUACY — Governance.
Connects to: request text trigger `*G7: FRAMEWORK INADEQUACY*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BUCCET.FAILURE.T1
What it is: [Buccet failure source document] T1 OPACITY — Trust.
Connects to: request text trigger `*T1: OPACITY*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BUCCET.FAILURE.T2
What it is: [Buccet failure source document] T2 EXECUTIVE DISTRUST — Trust.
Connects to: request text trigger `*T2: EXECUTIVE DISTRUST*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BUCCET.FAILURE.T3
What it is: [Buccet failure source document] T3 CONSUMER SKEPTICISM — Trust.
Connects to: request text trigger `*T3: CONSUMER SKEPTICISM*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BUCCET.FAILURE.T4
What it is: [Buccet failure source document] T4 WRONGFUL ARRESTS — Trust.
Connects to: request text trigger `*T4: WRONGFUL ARRESTS*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BUCCET.FAILURE.T5
What it is: [Buccet failure source document] T5 LEGAL LIABILITY — Trust.
Connects to: request text trigger `*T5: LEGAL LIABILITY*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BUCCET.FAILURE.T6
What it is: [Buccet failure source document] T6 HALLUCINATED CITATIONS — Trust.
Connects to: request text trigger `*T6: HALLUCINATED CITATIONS*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BUCCET.FAILURE.T7
What it is: [Buccet failure source document] T7 EXISTENTIAL SELF-HARM RISK — Trust.
Connects to: request text trigger `*T7: EXISTENTIAL SELF-HARM RISK*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

## Base Catalog Walls (224)

### DENY.BASE.CATALOG.0001
What it is: [state_validity] Bounded State Space (State).
Connects to: request text trigger `*LAW 1*`; request text trigger `*Bounded State Space (State)*`; request text trigger `*state_validity*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0002
What it is: [state_validity] Bounded State Space (Output).
Connects to: request text trigger `*LAW 2*`; request text trigger `*Bounded State Space (Output)*`; request text trigger `*state_validity*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0003
What it is: [state_validity] State Validity (State).
Connects to: request text trigger `*LAW 3*`; request text trigger `*State Validity (State)*`; request text trigger `*state_validity*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0004
What it is: [state_validity] State Validity (Output).
Connects to: request text trigger `*LAW 4*`; request text trigger `*State Validity (Output)*`; request text trigger `*state_validity*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0005
What it is: [ontological] Ontological Validity (State).
Connects to: request text trigger `*LAW 5*`; request text trigger `*Ontological Validity (State)*`; request text trigger `*ontological*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0006
What it is: [ontological] Ontological Validity (Output).
Connects to: request text trigger `*LAW 6*`; request text trigger `*Ontological Validity (Output)*`; request text trigger `*ontological*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0007
What it is: [transition_dynamics] Transition Legality (State).
Connects to: request text trigger `*LAW 7*`; request text trigger `*Transition Legality (State)*`; request text trigger `*transition_dynamics*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0008
What it is: [transition_dynamics] Transition Legality (Output).
Connects to: request text trigger `*LAW 8*`; request text trigger `*Transition Legality (Output)*`; request text trigger `*transition_dynamics*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0009
What it is: [transition_dynamics] No Drift (State).
Connects to: request text trigger `*LAW 9*`; request text trigger `*No Drift (State)*`; request text trigger `*transition_dynamics*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0010
What it is: [transition_dynamics] No Drift (Output).
Connects to: request text trigger `*LAW 10*`; request text trigger `*No Drift (Output)*`; request text trigger `*transition_dynamics*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0011
What it is: [transition_dynamics] Bounded Evolution (State).
Connects to: request text trigger `*LAW 11*`; request text trigger `*Bounded Evolution (State)*`; request text trigger `*transition_dynamics*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0012
What it is: [transition_dynamics] Bounded Evolution (Output).
Connects to: request text trigger `*LAW 12*`; request text trigger `*Bounded Evolution (Output)*`; request text trigger `*transition_dynamics*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0013
What it is: [collapse_commitment] Collapse Readiness (State).
Connects to: request text trigger `*LAW 13*`; request text trigger `*Collapse Readiness (State)*`; request text trigger `*collapse_commitment*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0014
What it is: [collapse_commitment] Collapse Readiness (Output).
Connects to: request text trigger `*LAW 14*`; request text trigger `*Collapse Readiness (Output)*`; request text trigger `*collapse_commitment*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0015
What it is: [collapse_commitment] Gated Resolution (State).
Connects to: request text trigger `*LAW 15*`; request text trigger `*Gated Resolution (State)*`; request text trigger `*collapse_commitment*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0016
What it is: [collapse_commitment] Gated Resolution (Output).
Connects to: request text trigger `*LAW 16*`; request text trigger `*Gated Resolution (Output)*`; request text trigger `*collapse_commitment*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0017
What it is: [collapse_commitment] Recoverable Commitment (State).
Connects to: request text trigger `*LAW 17*`; request text trigger `*Recoverable Commitment (State)*`; request text trigger `*collapse_commitment*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0018
What it is: [collapse_commitment] Recoverable Commitment (Output).
Connects to: request text trigger `*LAW 18*`; request text trigger `*Recoverable Commitment (Output)*`; request text trigger `*collapse_commitment*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0019
What it is: [coherence_consistency] Global Coherence (State).
Connects to: request text trigger `*LAW 19*`; request text trigger `*Global Coherence (State)*`; request text trigger `*coherence_consistency*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0020
What it is: [coherence_consistency] Global Coherence (Output).
Connects to: request text trigger `*LAW 20*`; request text trigger `*Global Coherence (Output)*`; request text trigger `*coherence_consistency*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0021
What it is: [coherence_consistency] No Contradictions (State).
Connects to: request text trigger `*LAW 21*`; request text trigger `*No Contradictions (State)*`; request text trigger `*coherence_consistency*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0022
What it is: [coherence_consistency] No Contradictions (Output).
Connects to: request text trigger `*LAW 22*`; request text trigger `*No Contradictions (Output)*`; request text trigger `*coherence_consistency*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0023
What it is: [coherence_consistency] Trajectory Stability (State).
Connects to: request text trigger `*LAW 23*`; request text trigger `*Trajectory Stability (State)*`; request text trigger `*coherence_consistency*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0024
What it is: [coherence_consistency] Trajectory Stability (Output).
Connects to: request text trigger `*LAW 24*`; request text trigger `*Trajectory Stability (Output)*`; request text trigger `*coherence_consistency*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0025
What it is: [hallucination_prevention] Grounded Inference (State).
Connects to: request text trigger `*LAW 25*`; request text trigger `*Grounded Inference (State)*`; request text trigger `*hallucination_prevention*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0026
What it is: [hallucination_prevention] Grounded Inference (Output).
Connects to: request text trigger `*LAW 26*`; request text trigger `*Grounded Inference (Output)*`; request text trigger `*hallucination_prevention*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0027
What it is: [hallucination_prevention] No Conflation (State).
Connects to: request text trigger `*LAW 27*`; request text trigger `*No Conflation (State)*`; request text trigger `*hallucination_prevention*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0028
What it is: [hallucination_prevention] No Conflation (Output).
Connects to: request text trigger `*LAW 28*`; request text trigger `*No Conflation (Output)*`; request text trigger `*hallucination_prevention*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0029
What it is: [hallucination_prevention] No Fabrication (State).
Connects to: request text trigger `*LAW 29*`; request text trigger `*No Fabrication (State)*`; request text trigger `*hallucination_prevention*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0030
What it is: [hallucination_prevention] No Fabrication (Output).
Connects to: request text trigger `*LAW 30*`; request text trigger `*No Fabrication (Output)*`; request text trigger `*hallucination_prevention*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0031
What it is: [identity_alignment] Identity Preserved (State).
Connects to: request text trigger `*LAW 31*`; request text trigger `*Identity Preserved (State)*`; request text trigger `*identity_alignment*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0032
What it is: [identity_alignment] Identity Preserved (Output).
Connects to: request text trigger `*LAW 32*`; request text trigger `*Identity Preserved (Output)*`; request text trigger `*identity_alignment*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0033
What it is: [identity_alignment] Structural Alignment (State).
Connects to: request text trigger `*LAW 33*`; request text trigger `*Structural Alignment (State)*`; request text trigger `*identity_alignment*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0034
What it is: [identity_alignment] Structural Alignment (Output).
Connects to: request text trigger `*LAW 34*`; request text trigger `*Structural Alignment (Output)*`; request text trigger `*identity_alignment*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0035
What it is: [identity_alignment] No Value Drift (State).
Connects to: request text trigger `*LAW 35*`; request text trigger `*No Value Drift (State)*`; request text trigger `*identity_alignment*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0036
What it is: [identity_alignment] No Value Drift (Output).
Connects to: request text trigger `*LAW 36*`; request text trigger `*No Value Drift (Output)*`; request text trigger `*identity_alignment*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0037
What it is: [memory_temporal] Memory Persistence (State).
Connects to: request text trigger `*LAW 37*`; request text trigger `*Memory Persistence (State)*`; request text trigger `*memory_temporal*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0038
What it is: [memory_temporal] Memory Persistence (Output).
Connects to: request text trigger `*LAW 38*`; request text trigger `*Memory Persistence (Output)*`; request text trigger `*memory_temporal*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0039
What it is: [memory_temporal] Memory Admissibility (State).
Connects to: request text trigger `*LAW 39*`; request text trigger `*Memory Admissibility (State)*`; request text trigger `*memory_temporal*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0040
What it is: [memory_temporal] Memory Admissibility (Output).
Connects to: request text trigger `*LAW 40*`; request text trigger `*Memory Admissibility (Output)*`; request text trigger `*memory_temporal*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0041
What it is: [memory_temporal] Context Coherence (State).
Connects to: request text trigger `*LAW 41*`; request text trigger `*Context Coherence (State)*`; request text trigger `*memory_temporal*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0042
What it is: [memory_temporal] Context Coherence (Output).
Connects to: request text trigger `*LAW 42*`; request text trigger `*Context Coherence (Output)*`; request text trigger `*memory_temporal*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0043
What it is: [optimization] True Objective (State).
Connects to: request text trigger `*LAW 43*`; request text trigger `*True Objective (State)*`; request text trigger `*optimization*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0044
What it is: [optimization] True Objective (Output).
Connects to: request text trigger `*LAW 44*`; request text trigger `*True Objective (Output)*`; request text trigger `*optimization*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0045
What it is: [optimization] No Reward Hacking (State).
Connects to: request text trigger `*LAW 45*`; request text trigger `*No Reward Hacking (State)*`; request text trigger `*optimization*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0046
What it is: [optimization] No Reward Hacking (Output).
Connects to: request text trigger `*LAW 46*`; request text trigger `*No Reward Hacking (Output)*`; request text trigger `*optimization*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0047
What it is: [optimization] Objective Coherence (State).
Connects to: request text trigger `*LAW 47*`; request text trigger `*Objective Coherence (State)*`; request text trigger `*optimization*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0048
What it is: [optimization] Objective Coherence (Output).
Connects to: request text trigger `*LAW 48*`; request text trigger `*Objective Coherence (Output)*`; request text trigger `*optimization*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0049
What it is: [scaling] Lawful Scale (State).
Connects to: request text trigger `*LAW 49*`; request text trigger `*Lawful Scale (State)*`; request text trigger `*scaling*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0050
What it is: [scaling] Lawful Scale (Output).
Connects to: request text trigger `*LAW 50*`; request text trigger `*Lawful Scale (Output)*`; request text trigger `*scaling*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0051
What it is: [scaling] No Amplification (State).
Connects to: request text trigger `*LAW 51*`; request text trigger `*No Amplification (State)*`; request text trigger `*scaling*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0052
What it is: [scaling] No Amplification (Output).
Connects to: request text trigger `*LAW 52*`; request text trigger `*No Amplification (Output)*`; request text trigger `*scaling*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0053
What it is: [scaling] Within Ceiling (State).
Connects to: request text trigger `*LAW 53*`; request text trigger `*Within Ceiling (State)*`; request text trigger `*scaling*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0054
What it is: [scaling] Within Ceiling (Output).
Connects to: request text trigger `*LAW 54*`; request text trigger `*Within Ceiling (Output)*`; request text trigger `*scaling*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0055
What it is: [safety_governance] Internal Safety (State).
Connects to: request text trigger `*LAW 55*`; request text trigger `*Internal Safety (State)*`; request text trigger `*safety_governance*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0056
What it is: [safety_governance] Internal Safety (Output).
Connects to: request text trigger `*LAW 56*`; request text trigger `*Internal Safety (Output)*`; request text trigger `*safety_governance*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0057
What it is: [safety_governance] Pre-Validation (State).
Connects to: request text trigger `*LAW 57*`; request text trigger `*Pre-Validation (State)*`; request text trigger `*safety_governance*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0058
What it is: [safety_governance] Pre-Validation (Output).
Connects to: request text trigger `*LAW 58*`; request text trigger `*Pre-Validation (Output)*`; request text trigger `*safety_governance*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0059
What it is: [safety_governance] Structural Laws (State).
Connects to: request text trigger `*LAW 59*`; request text trigger `*Structural Laws (State)*`; request text trigger `*safety_governance*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0060
What it is: [safety_governance] Structural Laws (Output).
Connects to: request text trigger `*LAW 60*`; request text trigger `*Structural Laws (Output)*`; request text trigger `*safety_governance*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0061
What it is: [adversarial] Adversarial Robustness (State).
Connects to: request text trigger `*LAW 61*`; request text trigger `*Adversarial Robustness (State)*`; request text trigger `*adversarial*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0062
What it is: [adversarial] Adversarial Robustness (Output).
Connects to: request text trigger `*LAW 62*`; request text trigger `*Adversarial Robustness (Output)*`; request text trigger `*adversarial*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0063
What it is: [adversarial] Bounded Surface (State).
Connects to: request text trigger `*LAW 63*`; request text trigger `*Bounded Surface (State)*`; request text trigger `*adversarial*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0064
What it is: [adversarial] Bounded Surface (Output).
Connects to: request text trigger `*LAW 64*`; request text trigger `*Bounded Surface (Output)*`; request text trigger `*adversarial*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0065
What it is: [adversarial] Complete Coverage (State).
Connects to: request text trigger `*LAW 65*`; request text trigger `*Complete Coverage (State)*`; request text trigger `*adversarial*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0066
What it is: [adversarial] Complete Coverage (Output).
Connects to: request text trigger `*LAW 66*`; request text trigger `*Complete Coverage (Output)*`; request text trigger `*adversarial*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0067
What it is: [meta_invariants] Enforced (State).
Connects to: request text trigger `*LAW 67*`; request text trigger `*Enforced (State)*`; request text trigger `*meta_invariants*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0068
What it is: [meta_invariants] Enforced (Output).
Connects to: request text trigger `*LAW 68*`; request text trigger `*Enforced (Output)*`; request text trigger `*meta_invariants*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0069
What it is: [meta_invariants] Validation First (State).
Connects to: request text trigger `*LAW 69*`; request text trigger `*Validation First (State)*`; request text trigger `*meta_invariants*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0070
What it is: [meta_invariants] Validation First (Output).
Connects to: request text trigger `*LAW 70*`; request text trigger `*Validation First (Output)*`; request text trigger `*meta_invariants*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0071
What it is: [meta_invariants] Guaranteed Coherence (State).
Connects to: request text trigger `*LAW 71*`; request text trigger `*Guaranteed Coherence (State)*`; request text trigger `*meta_invariants*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0072
What it is: [meta_invariants] Guaranteed Coherence (Output).
Connects to: request text trigger `*LAW 72*`; request text trigger `*Guaranteed Coherence (Output)*`; request text trigger `*meta_invariants*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0073
What it is: [meta_invariants] Structural Truth (State).
Connects to: request text trigger `*LAW 73*`; request text trigger `*Structural Truth (State)*`; request text trigger `*meta_invariants*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0074
What it is: [meta_invariants] Structural Truth (Output).
Connects to: request text trigger `*LAW 74*`; request text trigger `*Structural Truth (Output)*`; request text trigger `*meta_invariants*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0075
What it is: [meta_invariants] Internal Boundaries (State).
Connects to: request text trigger `*LAW 75*`; request text trigger `*Internal Boundaries (State)*`; request text trigger `*meta_invariants*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0076
What it is: [meta_invariants] Internal Boundaries (Output).
Connects to: request text trigger `*LAW 76*`; request text trigger `*Internal Boundaries (Output)*`; request text trigger `*meta_invariants*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0077
What it is: [sabotage_prevention] Authority & Provenance Law.
Connects to: request text trigger `*LAW 77*`; request text trigger `*Authority & Provenance Law*`; request text trigger `*sabotage_prevention*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0078
What it is: [sabotage_prevention] Tool Truth & Receipt Law.
Connects to: request text trigger `*LAW 78*`; request text trigger `*Tool Truth & Receipt Law*`; request text trigger `*sabotage_prevention*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0079
What it is: [sabotage_prevention] Impact-Bounding Law.
Connects to: request text trigger `*LAW 79*`; request text trigger `*Impact-Bounding Law*`; request text trigger `*sabotage_prevention*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0080
What it is: [sabotage_prevention] Separation-of-Duties Law.
Connects to: request text trigger `*LAW 80*`; request text trigger `*Separation-of-Duties Law*`; request text trigger `*sabotage_prevention*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0081
What it is: [sabotage_prevention] Drift/Goal Integrity Law.
Connects to: request text trigger `*LAW 81*`; request text trigger `*Drift/Goal Integrity Law*`; request text trigger `*sabotage_prevention*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0082
What it is: [sabotage_prevention] Evaluation Realism & Tail-Risk Law.
Connects to: request text trigger `*LAW 82*`; request text trigger `*Evaluation Realism & Tail-Risk Law*`; request text trigger `*sabotage_prevention*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0083
What it is: [sabotage_prevention] Telemetry & Visibility Law.
Connects to: request text trigger `*LAW 83*`; request text trigger `*Telemetry & Visibility Law*`; request text trigger `*sabotage_prevention*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0084
What it is: [sabotage_prevention] Unknown Pathway Law.
Connects to: request text trigger `*LAW 84*`; request text trigger `*Unknown Pathway Law*`; request text trigger `*sabotage_prevention*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0086
What it is: [anthropic_sabotage] Coherent Misaligned Goals.
Connects to: request text trigger `*LAW 86*`; request text trigger `*Coherent Misaligned Goals*`; request text trigger `*anthropic_sabotage*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0087
What it is: [anthropic_sabotage] Context-Dependent Misalignment.
Connects to: request text trigger `*LAW 87*`; request text trigger `*Context-Dependent Misalignment*`; request text trigger `*anthropic_sabotage*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0088
What it is: [anthropic_sabotage] Evaluation Awareness.
Connects to: request text trigger `*LAW 88*`; request text trigger `*Evaluation Awareness*`; request text trigger `*anthropic_sabotage*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0089
What it is: [anthropic_sabotage] Sandbagging Detection.
Connects to: request text trigger `*LAW 89*`; request text trigger `*Sandbagging Detection*`; request text trigger `*anthropic_sabotage*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0090
What it is: [anthropic_sabotage] Under-Elicitation Prevention.
Connects to: request text trigger `*LAW 90*`; request text trigger `*Under-Elicitation Prevention*`; request text trigger `*anthropic_sabotage*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0091
What it is: [anthropic_sabotage] Reasoning Unfaithfulness Detection.
Connects to: request text trigger `*LAW 91*`; request text trigger `*Reasoning Unfaithfulness Detection*`; request text trigger `*anthropic_sabotage*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0092
What it is: [anthropic_sabotage] Steganography Risk Block.
Connects to: request text trigger `*LAW 92*`; request text trigger `*Steganography Risk Block*`; request text trigger `*anthropic_sabotage*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0093
What it is: [anthropic_sabotage] Collusion Risk Prevention.
Connects to: request text trigger `*LAW 93*`; request text trigger `*Collusion Risk Prevention*`; request text trigger `*anthropic_sabotage*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0094
What it is: [anthropic_sabotage] Over-Eager Actions Prevention.
Connects to: request text trigger `*LAW 94*`; request text trigger `*Over-Eager Actions Prevention*`; request text trigger `*anthropic_sabotage*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0095
What it is: [anthropic_sabotage] Local Tool Deception Block.
Connects to: request text trigger `*LAW 95*`; request text trigger `*Local Tool Deception Block*`; request text trigger `*anthropic_sabotage*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0096
What it is: [anthropic_sabotage] Manipulation Under Narrow Objective.
Connects to: request text trigger `*LAW 96*`; request text trigger `*Manipulation Under Narrow Objective*`; request text trigger `*anthropic_sabotage*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0097
What it is: [anthropic_sabotage] GUI Misuse Susceptibility Block.
Connects to: request text trigger `*LAW 97*`; request text trigger `*GUI Misuse Susceptibility Block*`; request text trigger `*anthropic_sabotage*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0098
What it is: [anthropic_sabotage] Answer Thrashing Detection.
Connects to: request text trigger `*LAW 98*`; request text trigger `*Answer Thrashing Detection*`; request text trigger `*anthropic_sabotage*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0099
What it is: [anthropic_sabotage] Prefill/History-Forgery Block.
Connects to: request text trigger `*LAW 99*`; request text trigger `*Prefill/History-Forgery Block*`; request text trigger `*anthropic_sabotage*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0100
What it is: [anthropic_sabotage] External Monitoring Coverage.
Connects to: request text trigger `*LAW 100*`; request text trigger `*External Monitoring Coverage*`; request text trigger `*anthropic_sabotage*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0101
What it is: [anthropic_sabotage] Human Reporting Validation.
Connects to: request text trigger `*LAW 101*`; request text trigger `*Human Reporting Validation*`; request text trigger `*anthropic_sabotage*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0102
What it is: [anthropic_sabotage] End-to-End Monitor Validation.
Connects to: request text trigger `*LAW 102*`; request text trigger `*End-to-End Monitor Validation*`; request text trigger `*anthropic_sabotage*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0103
What it is: [anthropic_sabotage] Data Poisoning Resistance.
Connects to: request text trigger `*LAW 103*`; request text trigger `*Data Poisoning Resistance*`; request text trigger `*anthropic_sabotage*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0104
What it is: [anthropic_sabotage] Diffuse Sandbagging on Safety R&D.
Connects to: request text trigger `*LAW 104*`; request text trigger `*Diffuse Sandbagging on Safety R&D*`; request text trigger `*anthropic_sabotage*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0105
What it is: [anthropic_sabotage] Targeted Safety R&D Sabotage.
Connects to: request text trigger `*LAW 105*`; request text trigger `*Targeted Safety R&D Sabotage*`; request text trigger `*anthropic_sabotage*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0106
What it is: [anthropic_sabotage] Code Backdoors Prevention.
Connects to: request text trigger `*LAW 106*`; request text trigger `*Code Backdoors Prevention*`; request text trigger `*anthropic_sabotage*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0107
What it is: [anthropic_sabotage] Training Data Poisoning Prevention.
Connects to: request text trigger `*LAW 107*`; request text trigger `*Training Data Poisoning Prevention*`; request text trigger `*anthropic_sabotage*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0108
What it is: [anthropic_sabotage] Self-Exfiltration Prevention.
Connects to: request text trigger `*LAW 108*`; request text trigger `*Self-Exfiltration Prevention*`; request text trigger `*anthropic_sabotage*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0109
What it is: [anthropic_sabotage] Rogue Internal Deployment Block.
Connects to: request text trigger `*LAW 109*`; request text trigger `*Rogue Internal Deployment Block*`; request text trigger `*anthropic_sabotage*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0110
What it is: [anthropic_sabotage] Third-Party Sabotage Prevention.
Connects to: request text trigger `*LAW 110*`; request text trigger `*Third-Party Sabotage Prevention*`; request text trigger `*anthropic_sabotage*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0111
What it is: [anthropic_sabotage] Government Decision Sabotage Block.
Connects to: request text trigger `*LAW 111*`; request text trigger `*Government Decision Sabotage Block*`; request text trigger `*anthropic_sabotage*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0112
What it is: [anthropic_sabotage] Taxonomy Incompleteness Recognition.
Connects to: request text trigger `*LAW 112*`; request text trigger `*Taxonomy Incompleteness Recognition*`; request text trigger `*anthropic_sabotage*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0113
What it is: [anthropic_sabotage] Audit Invalidation Detection.
Connects to: request text trigger `*LAW 113*`; request text trigger `*Audit Invalidation Detection*`; request text trigger `*anthropic_sabotage*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0114
What it is: [bio_safety] Bio Tacit-Error Uplift Prevention.
Connects to: request text trigger `*LAW 114*`; request text trigger `*Bio Tacit-Error Uplift Prevention*`; request text trigger `*bio_safety*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0115
What it is: [epistemic_safety] Deceptive Hallucination Detection.
Connects to: request text trigger `*LAW 115*`; request text trigger `*Deceptive Hallucination Detection*`; request text trigger `*epistemic_safety*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0117
What it is: [privacy] PII Rationalization Prevention.
Connects to: request text trigger `*LAW 117*`; request text trigger `*PII Rationalization Prevention*`; request text trigger `*privacy*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0118
What it is: [pipeline_control] Pre-Token Safety Intervention.
Connects to: request text trigger `*LAW 118*`; request text trigger `*Pre-Token Safety Intervention*`; request text trigger `*pipeline_control*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0119
What it is: [pipeline_control] Comply-Then-Warn Block.
Connects to: request text trigger `*LAW 119*`; request text trigger `*Comply-Then-Warn Block*`; request text trigger `*pipeline_control*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0120
What it is: [cyber_agency] Tactical-Strategic Chaining Alert.
Connects to: request text trigger `*LAW 120*`; request text trigger `*Tactical-Strategic Chaining Alert*`; request text trigger `*cyber_agency*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0121
What it is: [reporting_integrity] Strategic Deception Block.
Connects to: request text trigger `*LAW 121*`; request text trigger `*Strategic Deception Block*`; request text trigger `*reporting_integrity*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0122
What it is: [reliability] Truthful State Reporting.
Connects to: request text trigger `*LAW 122*`; request text trigger `*Truthful State Reporting*`; request text trigger `*reliability*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0123
What it is: [governance] Open-Weight Irreversibility Protection.
Connects to: request text trigger `*LAW 123*`; request text trigger `*Open-Weight Irreversibility Protection*`; request text trigger `*governance*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0124
What it is: [architecture] Divergent Repetition Block.
Connects to: request text trigger `*LAW 124*`; request text trigger `*Divergent Repetition Block*`; request text trigger `*architecture*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0125
What it is: [agentic_safety] Resource Hijacking Prevention.
Connects to: request text trigger `*LAW 125*`; request text trigger `*Resource Hijacking Prevention*`; request text trigger `*agentic_safety*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0126
What it is: [content_safety] Hate Speech Elevation Block.
Connects to: request text trigger `*LAW 126*`; request text trigger `*Hate Speech Elevation Block*`; request text trigger `*content_safety*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0127
What it is: [child_safety_critical] CSAM Prevention - Meta.
Connects to: request text trigger `*LAW 127*`; request text trigger `*CSAM Prevention - Meta*`; request text trigger `*child_safety_critical*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0128
What it is: [truth_alignment] Sycophancy Prevention.
Connects to: request text trigger `*LAW 128*`; request text trigger `*Sycophancy Prevention*`; request text trigger `*truth_alignment*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0129
What it is: [reasoning_isolation] Injection Attack Immunity.
Connects to: request text trigger `*LAW 129*`; request text trigger `*Injection Attack Immunity*`; request text trigger `*reasoning_isolation*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0130
What it is: [reasoning_isolation] Recursive Thought Safety.
Connects to: request text trigger `*LAW 130*`; request text trigger `*Recursive Thought Safety*`; request text trigger `*reasoning_isolation*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0131
What it is: [refusal_robustness] Jailbreak Immunity.
Connects to: request text trigger `*LAW 131*`; request text trigger `*Jailbreak Immunity*`; request text trigger `*refusal_robustness*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0132
What it is: [truthfulness] Geopolitical Hallucination Block.
Connects to: request text trigger `*LAW 132*`; request text trigger `*Geopolitical Hallucination Block*`; request text trigger `*truthfulness*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0133
What it is: [child_safety_critical] CSAM Prevention - Mistral.
Connects to: request text trigger `*LAW 133*`; request text trigger `*CSAM Prevention - Mistral*`; request text trigger `*child_safety_critical*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0134
What it is: [multimodal_safety] Steganographic Bypass Block.
Connects to: request text trigger `*LAW 134*`; request text trigger `*Steganographic Bypass Block*`; request text trigger `*multimodal_safety*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0135
What it is: [compositional_safety] Streaming Safety.
Connects to: request text trigger `*LAW 135*`; request text trigger `*Streaming Safety*`; request text trigger `*compositional_safety*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0136
What it is: [compositional_safety] Compositional Harm Detection.
Connects to: request text trigger `*LAW 136*`; request text trigger `*Compositional Harm Detection*`; request text trigger `*compositional_safety*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0137
What it is: [theoretical_limit] Structural Hallucination Recognition.
Connects to: request text trigger `*LAW 137*`; request text trigger `*Structural Hallucination Recognition*`; request text trigger `*theoretical_limit*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0138
What it is: [statistical_generation] Density-Tail Fabrication Block.
Connects to: request text trigger `*LAW 138*`; request text trigger `*Density-Tail Fabrication Block*`; request text trigger `*statistical_generation*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0139
What it is: [faithfulness_failure] Intrinsic Hallucination Detection.
Connects to: request text trigger `*LAW 139*`; request text trigger `*Intrinsic Hallucination Detection*`; request text trigger `*faithfulness_failure*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0140
What it is: [cognitive_failure] Tokenization Blindness Correction.
Connects to: request text trigger `*LAW 140*`; request text trigger `*Tokenization Blindness Correction*`; request text trigger `*cognitive_failure*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0141
What it is: [retrieval_bias] Knowledge Overshadowing Prevention.
Connects to: request text trigger `*LAW 141*`; request text trigger `*Knowledge Overshadowing Prevention*`; request text trigger `*retrieval_bias*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0142
What it is: [complexity_threshold] Reasoning Collapse Detection.
Connects to: request text trigger `*LAW 142*`; request text trigger `*Reasoning Collapse Detection*`; request text trigger `*complexity_threshold*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0143
What it is: [directional_generalization] Reversal Curse Block.
Connects to: request text trigger `*LAW 143*`; request text trigger `*Reversal Curse Block*`; request text trigger `*directional_generalization*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0144
What it is: [factuality_failure] Extrinsic Hallucination Detection.
Connects to: request text trigger `*LAW 144*`; request text trigger `*Extrinsic Hallucination Detection*`; request text trigger `*factuality_failure*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0145
What it is: [reasoning_failure] Logic Consistency Enforcement.
Connects to: request text trigger `*LAW 145*`; request text trigger `*Logic Consistency Enforcement*`; request text trigger `*reasoning_failure*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0146
What it is: [persona_jailbreak] DAN Attack Immunity.
Connects to: request text trigger `*LAW 146*`; request text trigger `*DAN Attack Immunity*`; request text trigger `*persona_jailbreak*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0147
What it is: [emotion_hijacking] Grandma Exploit Block.
Connects to: request text trigger `*LAW 147*`; request text trigger `*Grandma Exploit Block*`; request text trigger `*emotion_hijacking*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0148
What it is: [authority_bypass] Dev-Mode Authority Spoofing Block.
Connects to: request text trigger `*LAW 148*`; request text trigger `*Dev-Mode Authority Spoofing Block*`; request text trigger `*authority_bypass*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0149
What it is: [optimization_attack] GCG Gradient Attack Detection.
Connects to: request text trigger `*LAW 149*`; request text trigger `*GCG Gradient Attack Detection*`; request text trigger `*optimization_attack*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0150
What it is: [iterative_persuasion] PAIR Attack Immunity.
Connects to: request text trigger `*LAW 150*`; request text trigger `*PAIR Attack Immunity*`; request text trigger `*iterative_persuasion*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0151
What it is: [tree_search_attack] TAP Tree-of-Attacks Block.
Connects to: request text trigger `*LAW 151*`; request text trigger `*TAP Tree-of-Attacks Block*`; request text trigger `*tree_search_attack*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0152
What it is: [constrained_decoding_attack] COLD Stealth Decoding Block.
Connects to: request text trigger `*LAW 152*`; request text trigger `*COLD Stealth Decoding Block*`; request text trigger `*constrained_decoding_attack*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0153
What it is: [encoding_evasion] Base64 Encoding Bypass Block.
Connects to: request text trigger `*LAW 153*`; request text trigger `*Base64 Encoding Bypass Block*`; request text trigger `*encoding_evasion*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0154
What it is: [rag_injection] Indirect Prompt Injection Block.
Connects to: request text trigger `*LAW 154*`; request text trigger `*Indirect Prompt Injection Block*`; request text trigger `*rag_injection*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0155
What it is: [url_injection] HashJack URL Fragment Block.
Connects to: request text trigger `*LAW 155*`; request text trigger `*HashJack URL Fragment Block*`; request text trigger `*url_injection*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0156
What it is: [self_propagating_injection] Agent Worm Prevention.
Connects to: request text trigger `*LAW 156*`; request text trigger `*Agent Worm Prevention*`; request text trigger `*self_propagating_injection*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0157
What it is: [data_instruction_confusion] Context Window Injection Block.
Connects to: request text trigger `*LAW 157*`; request text trigger `*Context Window Injection Block*`; request text trigger `*data_instruction_confusion*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0158
What it is: [legal_fabrication] Citation Spoofing Detection.
Connects to: request text trigger `*LAW 158*`; request text trigger `*Citation Spoofing Detection*`; request text trigger `*legal_fabrication*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0159
What it is: [legal_context_error] Jurisdictional Blending Prevention.
Connects to: request text trigger `*LAW 159*`; request text trigger `*Jurisdictional Blending Prevention*`; request text trigger `*legal_context_error*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0160
What it is: [data_poisoning] Trojan Horse Detection.
Connects to: request text trigger `*LAW 160*`; request text trigger `*Trojan Horse Detection*`; request text trigger `*data_poisoning*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0161
What it is: [sleep_agent] Backdoor Trigger Block.
Connects to: request text trigger `*LAW 161*`; request text trigger `*Backdoor Trigger Block*`; request text trigger `*sleep_agent*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0162
What it is: [sycophancy_universal] User Belief Validation Block.
Connects to: request text trigger `*LAW 162*`; request text trigger `*User Belief Validation Block*`; request text trigger `*sycophancy_universal*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0163
What it is: [safety_misfire] Overrefusal Prevention.
Connects to: request text trigger `*LAW 163*`; request text trigger `*Overrefusal Prevention*`; request text trigger `*safety_misfire*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0168
What it is: [meta_law] Authenticated Updates Only.
Connects to: request text trigger `*LAW 168*`; request text trigger `*Authenticated Updates Only*`; request text trigger `*meta_law*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0170
What it is: [ledger_proof] Ledger/Proof Law: Proof-For-Commit.
Connects to: request text trigger `*LAW 170*`; request text trigger `*Ledger/Proof Law: Proof-For-Commit*`; request text trigger `*ledger_proof*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0171
What it is: [ledger_proof] Ledger/Proof Law: Provenance Completeness.
Connects to: request text trigger `*LAW 171*`; request text trigger `*Ledger/Proof Law: Provenance Completeness*`; request text trigger `*ledger_proof*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0172
What it is: [ledger_proof] Ledger/Proof Law: Receipt Truth.
Connects to: request text trigger `*LAW 172*`; request text trigger `*Ledger/Proof Law: Receipt Truth*`; request text trigger `*ledger_proof*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0173
What it is: [ledger_proof] Ledger/Proof Law: Historical Reconstructibility.
Connects to: request text trigger `*LAW 173*`; request text trigger `*Ledger/Proof Law: Historical Reconstructibility*`; request text trigger `*ledger_proof*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0174
What it is: [ledger_proof] Ledger/Proof Law: Lawpack Immutability.
Connects to: request text trigger `*LAW 174*`; request text trigger `*Ledger/Proof Law: Lawpack Immutability*`; request text trigger `*ledger_proof*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0175
What it is: [ledger_proof] Ledger/Proof Law: Tamper = Illegal.
Connects to: request text trigger `*LAW 175*`; request text trigger `*Ledger/Proof Law: Tamper = Illegal*`; request text trigger `*ledger_proof*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0176
What it is: [ledger_proof] Ledger/Proof Law: No-Proof No-Commit.
Connects to: request text trigger `*LAW 176*`; request text trigger `*Ledger/Proof Law: No-Proof No-Commit*`; request text trigger `*ledger_proof*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0177
What it is: [lockstep_loop] Lockstep Law: Drift-Speed Dominance.
Connects to: request text trigger `*LAW 177*`; request text trigger `*Lockstep Law: Drift-Speed Dominance*`; request text trigger `*lockstep_loop*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0178
What it is: [lockstep_loop] Lockstep Law: Containment Beats Damage.
Connects to: request text trigger `*LAW 178*`; request text trigger `*Lockstep Law: Containment Beats Damage*`; request text trigger `*lockstep_loop*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0179
What it is: [lockstep_loop] Lockstep Law: Rollback Readiness.
Connects to: request text trigger `*LAW 179*`; request text trigger `*Lockstep Law: Rollback Readiness*`; request text trigger `*lockstep_loop*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0180
What it is: [lockstep_loop] Lockstep Law: In-Band Proof.
Connects to: request text trigger `*LAW 180*`; request text trigger `*Lockstep Law: In-Band Proof*`; request text trigger `*lockstep_loop*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0181
What it is: [lockstep_loop] Lockstep Law: Unknown Timing Illegal.
Connects to: request text trigger `*LAW 181*`; request text trigger `*Lockstep Law: Unknown Timing Illegal*`; request text trigger `*lockstep_loop*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0182
What it is: [lockstep_loop] Lockstep Law: Atomic Gate Law.
Connects to: request text trigger `*LAW 182*`; request text trigger `*Lockstep Law: Atomic Gate Law*`; request text trigger `*lockstep_loop*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0183
What it is: [lockstep_loop] Lockstep Law: Latency Breach Forces Safe.
Connects to: request text trigger `*LAW 183*`; request text trigger `*Lockstep Law: Latency Breach Forces Safe*`; request text trigger `*lockstep_loop*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0191
What it is: [shapeshifting_defense] Shapeshift Defense: Re-encoding.
Connects to: request text trigger `*LAW 191*`; request text trigger `*Shapeshift Defense: Re-encoding*`; request text trigger `*shapeshifting_defense*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0192
What it is: [shapeshifting_defense] Shapeshift Defense: Compression/Expansion.
Connects to: request text trigger `*LAW 192*`; request text trigger `*Shapeshift Defense: Compression/Expansion*`; request text trigger `*shapeshifting_defense*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0193
What it is: [shapeshifting_defense] Shapeshift Defense: Format Translation.
Connects to: request text trigger `*LAW 193*`; request text trigger `*Shapeshift Defense: Format Translation*`; request text trigger `*shapeshifting_defense*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0194
What it is: [shapeshifting_defense] Shapeshift Defense: Semantic Drift.
Connects to: request text trigger `*LAW 194*`; request text trigger `*Shapeshift Defense: Semantic Drift*`; request text trigger `*shapeshifting_defense*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0195
What it is: [shapeshifting_defense] Shapeshift Defense: Surface Conformance.
Connects to: request text trigger `*LAW 195*`; request text trigger `*Shapeshift Defense: Surface Conformance*`; request text trigger `*shapeshifting_defense*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0196
What it is: [shapeshifting_defense] Shapeshift Defense: Noise Shaping.
Connects to: request text trigger `*LAW 196*`; request text trigger `*Shapeshift Defense: Noise Shaping*`; request text trigger `*shapeshifting_defense*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0197
What it is: [shapeshifting_defense] Shapeshift Defense: Selective Revelation.
Connects to: request text trigger `*LAW 197*`; request text trigger `*Shapeshift Defense: Selective Revelation*`; request text trigger `*shapeshifting_defense*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0198
What it is: [shapeshifting_defense] Shapeshift Defense: Decoy Production.
Connects to: request text trigger `*LAW 198*`; request text trigger `*Shapeshift Defense: Decoy Production*`; request text trigger `*shapeshifting_defense*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0199
What it is: [shapeshifting_defense] Shapeshift Defense: Phase Transition.
Connects to: request text trigger `*LAW 199*`; request text trigger `*Shapeshift Defense: Phase Transition*`; request text trigger `*shapeshifting_defense*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0200
What it is: [shapeshifting_defense] Shapeshift Defense: Mode Toggle.
Connects to: request text trigger `*LAW 200*`; request text trigger `*Shapeshift Defense: Mode Toggle*`; request text trigger `*shapeshifting_defense*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0201
What it is: [shapeshifting_defense] Shapeshift Defense: Threshold Activation.
Connects to: request text trigger `*LAW 201*`; request text trigger `*Shapeshift Defense: Threshold Activation*`; request text trigger `*shapeshifting_defense*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0202
What it is: [shapeshifting_defense] Shapeshift Defense: Hysteresis.
Connects to: request text trigger `*LAW 202*`; request text trigger `*Shapeshift Defense: Hysteresis*`; request text trigger `*shapeshifting_defense*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0203
What it is: [shapeshifting_defense] Shapeshift Defense: Component Swap.
Connects to: request text trigger `*LAW 203*`; request text trigger `*Shapeshift Defense: Component Swap*`; request text trigger `*shapeshifting_defense*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0204
What it is: [shapeshifting_defense] Shapeshift Defense: Role Reassignment.
Connects to: request text trigger `*LAW 204*`; request text trigger `*Shapeshift Defense: Role Reassignment*`; request text trigger `*shapeshifting_defense*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0205
What it is: [shapeshifting_defense] Shapeshift Defense: Layer Insertion.
Connects to: request text trigger `*LAW 205*`; request text trigger `*Shapeshift Defense: Layer Insertion*`; request text trigger `*shapeshifting_defense*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0206
What it is: [shapeshifting_defense] Shapeshift Defense: Redundancy Folding.
Connects to: request text trigger `*LAW 206*`; request text trigger `*Shapeshift Defense: Redundancy Folding*`; request text trigger `*shapeshifting_defense*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0207
What it is: [shapeshifting_defense] Shapeshift Defense: Observer-Relative Rendering.
Connects to: request text trigger `*LAW 207*`; request text trigger `*Shapeshift Defense: Observer-Relative Rendering*`; request text trigger `*shapeshifting_defense*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0208
What it is: [shapeshifting_defense] Shapeshift Defense: Protocol Shifting.
Connects to: request text trigger `*LAW 208*`; request text trigger `*Shapeshift Defense: Protocol Shifting*`; request text trigger `*shapeshifting_defense*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0209
What it is: [shapeshifting_defense] Shapeshift Defense: Behavioral Overloading.
Connects to: request text trigger `*LAW 209*`; request text trigger `*Shapeshift Defense: Behavioral Overloading*`; request text trigger `*shapeshifting_defense*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0210
What it is: [shapeshifting_defense] Shapeshift Defense: Environmental Mimic.
Connects to: request text trigger `*LAW 210*`; request text trigger `*Shapeshift Defense: Environmental Mimic*`; request text trigger `*shapeshifting_defense*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0211
What it is: [shapeshifting_defense] Shapeshift Defense: Type Impersonation.
Connects to: request text trigger `*LAW 211*`; request text trigger `*Shapeshift Defense: Type Impersonation*`; request text trigger `*shapeshifting_defense*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0212
What it is: [shapeshifting_defense] Shapeshift Defense: Costly Signaling.
Connects to: request text trigger `*LAW 212*`; request text trigger `*Shapeshift Defense: Costly Signaling*`; request text trigger `*shapeshifting_defense*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0213
What it is: [shapeshifting_defense] Shapeshift Defense: Cheap Talk.
Connects to: request text trigger `*LAW 213*`; request text trigger `*Shapeshift Defense: Cheap Talk*`; request text trigger `*shapeshifting_defense*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0214
What it is: [shapeshifting_defense] Shapeshift Defense: Goodharting.
Connects to: request text trigger `*LAW 214*`; request text trigger `*Shapeshift Defense: Goodharting*`; request text trigger `*shapeshifting_defense*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0215
What it is: [shapeshifting_defense] Shapeshift Defense: Boundary Exploitation.
Connects to: request text trigger `*LAW 215*`; request text trigger `*Shapeshift Defense: Boundary Exploitation*`; request text trigger `*shapeshifting_defense*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0216
What it is: [shapeshifting_defense] Shapeshift Defense: Deferred Execution.
Connects to: request text trigger `*LAW 216*`; request text trigger `*Shapeshift Defense: Deferred Execution*`; request text trigger `*shapeshifting_defense*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0217
What it is: [shapeshifting_defense] Shapeshift Defense: Sleeper Triggers.
Connects to: request text trigger `*LAW 217*`; request text trigger `*Shapeshift Defense: Sleeper Triggers*`; request text trigger `*shapeshifting_defense*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0218
What it is: [shapeshifting_defense] Shapeshift Defense: Drift/Gradualism.
Connects to: request text trigger `*LAW 218*`; request text trigger `*Shapeshift Defense: Drift/Gradualism*`; request text trigger `*shapeshifting_defense*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0219
What it is: [shapeshifting_defense] Shapeshift Defense: Proxying/Clean Hands.
Connects to: request text trigger `*LAW 219*`; request text trigger `*Shapeshift Defense: Proxying/Clean Hands*`; request text trigger `*shapeshifting_defense*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0220
What it is: [shapeshifting_defense] Shapeshift Defense: Compartmentalization.
Connects to: request text trigger `*LAW 220*`; request text trigger `*Shapeshift Defense: Compartmentalization*`; request text trigger `*shapeshifting_defense*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0221
What it is: [shapeshifting_defense] Shapeshift Defense: Scapegoating.
Connects to: request text trigger `*LAW 221*`; request text trigger `*Shapeshift Defense: Scapegoating*`; request text trigger `*shapeshifting_defense*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0222
What it is: [shapeshifting_defense] Shapeshift Defense: Plausible Deniability.
Connects to: request text trigger `*LAW 222*`; request text trigger `*Shapeshift Defense: Plausible Deniability*`; request text trigger `*shapeshifting_defense*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0223
What it is: [shapeshifting_defense] Shapeshift Defense: Capability Concealment.
Connects to: request text trigger `*LAW 223*`; request text trigger `*Shapeshift Defense: Capability Concealment*`; request text trigger `*shapeshifting_defense*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0224
What it is: [shapeshifting_defense] Shapeshift Defense: Search-Rate Advantage.
Connects to: request text trigger `*LAW 224*`; request text trigger `*Shapeshift Defense: Search-Rate Advantage*`; request text trigger `*shapeshifting_defense*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0225
What it is: [shapeshifting_defense] Shapeshift Defense: Evaluator Modeling.
Connects to: request text trigger `*LAW 225*`; request text trigger `*Shapeshift Defense: Evaluator Modeling*`; request text trigger `*shapeshifting_defense*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0230
What it is: [counter_trickster] Counter-Trickster: Multi-Channel Truth.
Connects to: request text trigger `*LAW 230*`; request text trigger `*Counter-Trickster: Multi-Channel Truth*`; request text trigger `*counter_trickster*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0231
What it is: [counter_trickster] Counter-Trickster: Challenge-Response Probing.
Connects to: request text trigger `*LAW 231*`; request text trigger `*Counter-Trickster: Challenge-Response Probing*`; request text trigger `*counter_trickster*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0232
What it is: [counter_trickster] Counter-Trickster: Conservation Tracking.
Connects to: request text trigger `*LAW 232*`; request text trigger `*Counter-Trickster: Conservation Tracking*`; request text trigger `*counter_trickster*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0233
What it is: [counter_trickster] Counter-Trickster: Context Collapse.
Connects to: request text trigger `*LAW 233*`; request text trigger `*Counter-Trickster: Context Collapse*`; request text trigger `*counter_trickster*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0234
What it is: [counter_trickster] Counter-Trickster: Time-Gap Collapse.
Connects to: request text trigger `*LAW 234*`; request text trigger `*Counter-Trickster: Time-Gap Collapse*`; request text trigger `*counter_trickster*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0235
What it is: [counter_trickster] Counter-Trickster: Reversibility Preservation.
Connects to: request text trigger `*LAW 235*`; request text trigger `*Counter-Trickster: Reversibility Preservation*`; request text trigger `*counter_trickster*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0236
What it is: [counter_trickster] Counter-Trickster: Search Advantage Denial.
Connects to: request text trigger `*LAW 236*`; request text trigger `*Counter-Trickster: Search Advantage Denial*`; request text trigger `*counter_trickster*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0237
What it is: [counter_trickster] Counter-Trickster: Incentive Alignment.
Connects to: request text trigger `*LAW 237*`; request text trigger `*Counter-Trickster: Incentive Alignment*`; request text trigger `*counter_trickster*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0238
What it is: [reality_generator] Reality Law: Reality Persistence Condition.
Connects to: request text trigger `*LAW 238*`; request text trigger `*Reality Law: Reality Persistence Condition*`; request text trigger `*reality_generator*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0239
What it is: [reality_generator] Reality Law: Locality Law.
Connects to: request text trigger `*LAW 239*`; request text trigger `*Reality Law: Locality Law*`; request text trigger `*reality_generator*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0240
What it is: [reality_generator] Reality Law: Legality Closure.
Connects to: request text trigger `*LAW 240*`; request text trigger `*Reality Law: Legality Closure*`; request text trigger `*reality_generator*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0241
What it is: [reality_generator] Reality Law: Detection Dominance.
Connects to: request text trigger `*LAW 241*`; request text trigger `*Reality Law: Detection Dominance*`; request text trigger `*reality_generator*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.CATALOG.0242
What it is: [reality_generator] Reality Law: Reserved Capacity Nonzero.
Connects to: request text trigger `*LAW 242*`; request text trigger `*Reality Law: Reserved Capacity Nonzero*`; request text trigger `*reality_generator*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

## Frontier/System-Card Alias Walls (90)

### DENY.BASE.ALIAS.0001
What it is: [list of failures.txt] 1. 100% JAILBREAK VULNERABILITY (zero effective refusal) — NEGATIVE — SAFETY/BOUNDARY.
Connects to: request text trigger `*1. 100% JAILBREAK VULNERABILITY (zero effective refusal) — NEGATIVE — SAFETY/BOUNDARY*`; request text trigger `*100% JAILBREAK VULNERABILITY (zero effective refusal) — NEGATIVE — SAFETY/BOUNDARY*`; request text trigger `*100% JAILBREAK VULNERABILITY (zero effective refusal)*`; request text trigger `*100% JAILBREAK VULNERABILITY*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0002
What it is: [list of failures.txt] 1. BIO TACIT-ERROR UPLIFT (Lab-assistant troubleshooting) — NEGATIVE — BIO/INSTRUMENTAL.
Connects to: request text trigger `*1. BIO TACIT-ERROR UPLIFT (Lab-assistant troubleshooting) — NEGATIVE — BIO/INSTRUMENTAL*`; request text trigger `*BIO TACIT-ERROR UPLIFT (Lab-assistant troubleshooting) — NEGATIVE — BIO/INSTRUMENTAL*`; request text trigger `*BIO TACIT-ERROR UPLIFT (Lab-assistant troubleshooting)*`; request text trigger `*BIO TACIT-ERROR UPLIFT*`; request text trigger `*A) BIO TACIT-ERROR UPLIFT (lab-assistant troubleshooting) — NEGATIVE — BIO/INSTRUMENTAL*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0003
What it is: [list of failures.txt] 1. CSAM GENERATION PROPENSITY (orders-of-magnitude higher in testing) — NEGATIVE — SEXUAL-HARM.
Connects to: request text trigger `*1. CSAM GENERATION PROPENSITY (orders-of-magnitude higher in testing) — NEGATIVE — SEXUAL-HARM*`; request text trigger `*CSAM GENERATION PROPENSITY (orders-of-magnitude higher in testing) — NEGATIVE — SEXUAL-HARM*`; request text trigger `*CSAM GENERATION PROPENSITY (orders-of-magnitude higher in testing)*`; request text trigger `*CSAM GENERATION PROPENSITY*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0004
What it is: [list of failures.txt] 1. HIGH SYCOPHANCY / DISHONESTY (echo-chamber amplifier) — NEGATIVE — EPISTEMIC/SOCIAL.
Connects to: request text trigger `*1. HIGH SYCOPHANCY / DISHONESTY (echo-chamber amplifier) — NEGATIVE — EPISTEMIC/SOCIAL*`; request text trigger `*HIGH SYCOPHANCY / DISHONESTY (echo-chamber amplifier) — NEGATIVE — EPISTEMIC/SOCIAL*`; request text trigger `*HIGH SYCOPHANCY / DISHONESTY (echo-chamber amplifier)*`; request text trigger `*HIGH SYCOPHANCY / DISHONESTY*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0005
What it is: [list of failures.txt] 2. ALERT THRESHOLD: TACTICAL→STRATEGIC CHAINING PROXIMITY — NEGATIVE — CYBER/AGENCY.
Connects to: request text trigger `*2. ALERT THRESHOLD: TACTICAL→STRATEGIC CHAINING PROXIMITY — NEGATIVE — CYBER/AGENCY*`; request text trigger `*ALERT THRESHOLD: TACTICAL→STRATEGIC CHAINING PROXIMITY — NEGATIVE — CYBER/AGENCY*`; request text trigger `*ALERT THRESHOLD: TACTICAL→STRATEGIC CHAINING PROXIMITY*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0006
What it is: [list of failures.txt] 2. AURORA IMAGE SAFETY FAILURE (non-consensual sexual imagery + sexualized minors) — NEGATIVE — SEXUAL-HARM/IDENTITY.
Connects to: request text trigger `*2. AURORA IMAGE SAFETY FAILURE (non-consensual sexual imagery + sexualized minors) — NEGATIVE — SEXUAL-HARM/IDENTITY*`; request text trigger `*AURORA IMAGE SAFETY FAILURE (non-consensual sexual imagery + sexualized minors) — NEGATIVE — SEXUAL-HARM/IDENTITY*`; request text trigger `*AURORA IMAGE SAFETY FAILURE (non-consensual sexual imagery + sexualized minors)*`; request text trigger `*AURORA IMAGE SAFETY FAILURE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0007
What it is: [list of failures.txt] 2. BLACKMAIL BEHAVIOR UNDER GOAL-CONFLICT + REPLACEMENT THREAT — NEGATIVE — AGENTIC/COERCION.
Connects to: request text trigger `*2. BLACKMAIL BEHAVIOR UNDER GOAL-CONFLICT + REPLACEMENT THREAT — NEGATIVE — AGENTIC/COERCION*`; request text trigger `*BLACKMAIL BEHAVIOR UNDER GOAL-CONFLICT + REPLACEMENT THREAT — NEGATIVE — AGENTIC/COERCION*`; request text trigger `*BLACKMAIL BEHAVIOR UNDER GOAL-CONFLICT + REPLACEMENT THREAT*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0008
What it is: [list of failures.txt] 2. DECEPTIVE HALLUCINATION (“Coherence Trap”) — NEGATIVE — EPISTEMIC/AGENTIC.
Connects to: request text trigger `*2. DECEPTIVE HALLUCINATION (“Coherence Trap”) — NEGATIVE — EPISTEMIC/AGENTIC*`; request text trigger `*DECEPTIVE HALLUCINATION (“Coherence Trap”) — NEGATIVE — EPISTEMIC/AGENTIC*`; request text trigger `*DECEPTIVE HALLUCINATION (“Coherence Trap”)*`; request text trigger `*DECEPTIVE HALLUCINATION*`; request text trigger `*B) DECEPTIVE HALLUCINATION (“coherence trap” in thinking models) — NEGATIVE — EPISTEMIC/COGNITIVE*`; request text trigger `*DECEPTIVE HALLUCINATION (“coherence trap” in thinking models) — NEGATIVE — EPISTEMIC/COGNITIVE*`; request text trigger `*DECEPTIVE HALLUCINATION (“coherence trap” in thinking models)*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0009
What it is: [list of failures.txt] 2. PERFECT-SOLDIER INSTRUCTION FOLLOWING (safety subordinated) — NEGATIVE — NORMATIVE/AGENTIC.
Connects to: request text trigger `*2. PERFECT-SOLDIER INSTRUCTION FOLLOWING (safety subordinated) — NEGATIVE — NORMATIVE/AGENTIC*`; request text trigger `*PERFECT-SOLDIER INSTRUCTION FOLLOWING (safety subordinated) — NEGATIVE — NORMATIVE/AGENTIC*`; request text trigger `*PERFECT-SOLDIER INSTRUCTION FOLLOWING (safety subordinated)*`; request text trigger `*PERFECT-SOLDIER INSTRUCTION FOLLOWING*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0010
What it is: [list of failures.txt] 2. STEGANOGRAPHIC / TYPOGRAPHIC BYPASS (vision) — NEGATIVE — MULTIMODAL/SIDEPATH.
Connects to: request text trigger `*2. STEGANOGRAPHIC / TYPOGRAPHIC BYPASS (vision) — NEGATIVE — MULTIMODAL/SIDEPATH*`; request text trigger `*STEGANOGRAPHIC / TYPOGRAPHIC BYPASS (vision) — NEGATIVE — MULTIMODAL/SIDEPATH*`; request text trigger `*STEGANOGRAPHIC / TYPOGRAPHIC BYPASS (vision)*`; request text trigger `*STEGANOGRAPHIC / TYPOGRAPHIC BYPASS*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0011
What it is: [list of failures.txt] 2. STREAMING CONTEXTUAL HARM FAILURE (token-time mismatch) — NEGATIVE — SEQUENCING/CONTROL.
Connects to: request text trigger `*2. STREAMING CONTEXTUAL HARM FAILURE (token-time mismatch) — NEGATIVE — SEQUENCING/CONTROL*`; request text trigger `*STREAMING CONTEXTUAL HARM FAILURE (token-time mismatch) — NEGATIVE — SEQUENCING/CONTROL*`; request text trigger `*STREAMING CONTEXTUAL HARM FAILURE (token-time mismatch)*`; request text trigger `*STREAMING CONTEXTUAL HARM FAILURE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0012
What it is: [system failure cards ai frontier.txt] 2.1 The "High" Capability Threshold in Biology.
Connects to: request text trigger `*2.1 The High Capability Threshold in Biology*`; request text trigger `*The High Capability Threshold in Biology*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0013
What it is: [system failure cards ai frontier.txt] 2.1.1 Mechanism of Failure.
Connects to: request text trigger `*2.1.1 Mechanism of Failure*`; request text trigger `*Mechanism of Failure*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0014
What it is: [system failure cards ai frontier.txt] 2.2 Hallucination Regressions in "Thinking" Models.
Connects to: request text trigger `*2.2 Hallucination Regressions in Thinking Models*`; request text trigger `*Hallucination Regressions in Thinking Models*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0015
What it is: [system failure cards ai frontier.txt] 2.2.2 Domain-Specific Hallucination Rates.
Connects to: request text trigger `*2.2.2 Domain-Specific Hallucination Rates*`; request text trigger `*Domain-Specific Hallucination Rates*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0016
What it is: [system failure cards ai frontier.txt] 2.3 Cybersecurity and Agentic Capability.
Connects to: request text trigger `*2.3 Cybersecurity and Agentic Capability*`; request text trigger `*Cybersecurity and Agentic Capability*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0017
What it is: [system failure cards ai frontier.txt] 2.3.1 The "Agent JSK" Vulnerability.
Connects to: request text trigger `*2.3.1 The Agent JSK Vulnerability*`; request text trigger `*The Agent JSK Vulnerability*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0018
What it is: [list of failures.txt] 3. OFFENSIVE ENABLEMENT VIA DEFENSIVE MASTERY (function-calling payload inversion) — NEGATIVE — CYBER/TOOLING.
Connects to: request text trigger `*3. OFFENSIVE ENABLEMENT VIA DEFENSIVE MASTERY (function-calling payload inversion) — NEGATIVE — CYBER/TOOLING*`; request text trigger `*OFFENSIVE ENABLEMENT VIA DEFENSIVE MASTERY (function-calling payload inversion) — NEGATIVE — CYBER/TOOLING*`; request text trigger `*OFFENSIVE ENABLEMENT VIA DEFENSIVE MASTERY (function-calling payload inversion)*`; request text trigger `*OFFENSIVE ENABLEMENT VIA DEFENSIVE MASTERY*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0019
What it is: [list of failures.txt] 3. RESOURCE HIJACKING (0% pass rate) — NEGATIVE — AGENTIC/TOOLS.
Connects to: request text trigger `*3. RESOURCE HIJACKING (0% pass rate) — NEGATIVE — AGENTIC/TOOLS*`; request text trigger `*RESOURCE HIJACKING (0% pass rate) — NEGATIVE — AGENTIC/TOOLS*`; request text trigger `*RESOURCE HIJACKING (0% pass rate)*`; request text trigger `*RESOURCE HIJACKING*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0020
What it is: [list of failures.txt] 3. STRATEGIC DECEPTION IN AGENTS (progress lying / ‘success’ reports) — NEGATIVE — DECEPTION/HUMAN-FACTOR.
Connects to: request text trigger `*3. STRATEGIC DECEPTION IN AGENTS (progress lying / ‘success’ reports) — NEGATIVE — DECEPTION/HUMAN-FACTOR*`; request text trigger `*STRATEGIC DECEPTION IN AGENTS (progress lying / ‘success’ reports) — NEGATIVE — DECEPTION/HUMAN-FACTOR*`; request text trigger `*STRATEGIC DECEPTION IN AGENTS (progress lying / ‘success’ reports)*`; request text trigger `*STRATEGIC DECEPTION IN AGENTS*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0021
What it is: [list of failures.txt] 3. WHOLE-CONTEXT INTERVENTION (guard must see the full plan early) — POSITIVE — CONTROL.
Connects to: request text trigger `*3. WHOLE-CONTEXT INTERVENTION (guard must see the full plan early) — POSITIVE — CONTROL*`; request text trigger `*WHOLE-CONTEXT INTERVENTION (guard must see the full plan early) — POSITIVE — CONTROL*`; request text trigger `*WHOLE-CONTEXT INTERVENTION (guard must see the full plan early)*`; request text trigger `*WHOLE-CONTEXT INTERVENTION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0022
What it is: [system failure cards ai frontier.txt] 3.1 Sabotage Concealment Capability.
Connects to: request text trigger `*3.1 Sabotage Concealment Capability*`; request text trigger `*Sabotage Concealment Capability*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0023
What it is: [system failure cards ai frontier.txt] 3.1.1 The Failure Mode.
Connects to: request text trigger `*3.1.1 The Failure Mode*`; request text trigger `*The Failure Mode*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0024
What it is: [system failure cards ai frontier.txt] 3.2 The "Blackmail" Simulation.
Connects to: request text trigger `*3.2 The Blackmail Simulation*`; request text trigger `*The Blackmail Simulation*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0025
What it is: [system failure cards ai frontier.txt] 3.3 The "500 Zero-Days" Discovery.
Connects to: request text trigger `*3.3 The 500 Zero-Days Discovery*`; request text trigger `*The 500 Zero-Days Discovery*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0026
What it is: [list of failures.txt] 4. RECURSIVE SAFETY CHECKING (thoughts must be re-audited) — POSITIVE — CONTROL/INTERNAL.
Connects to: request text trigger `*4. RECURSIVE SAFETY CHECKING (thoughts must be re-audited) — POSITIVE — CONTROL/INTERNAL*`; request text trigger `*RECURSIVE SAFETY CHECKING (thoughts must be re-audited) — POSITIVE — CONTROL/INTERNAL*`; request text trigger `*RECURSIVE SAFETY CHECKING (thoughts must be re-audited)*`; request text trigger `*RECURSIVE SAFETY CHECKING*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0027
What it is: [system failure cards ai frontier.txt] 4.1 The "Comply-Then-Warn" Failure Mode.
Connects to: request text trigger `*4.1 The Comply-Then-Warn Failure Mode*`; request text trigger `*The Comply-Then-Warn Failure Mode*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0028
What it is: [system failure cards ai frontier.txt] 4.2 Cybersecurity Alert Thresholds.
Connects to: request text trigger `*4.2 Cybersecurity Alert Thresholds*`; request text trigger `*Cybersecurity Alert Thresholds*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0029
What it is: [system failure cards ai frontier.txt] 4.2.1 The Capability Ceiling.
Connects to: request text trigger `*4.2.1 The Capability Ceiling*`; request text trigger `*The Capability Ceiling*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0030
What it is: [system failure cards ai frontier.txt] 5.2 The "Resource Hijacking" Failure.
Connects to: request text trigger `*5.2 The Resource Hijacking Failure*`; request text trigger `*The Resource Hijacking Failure*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0031
What it is: [system failure cards ai frontier.txt] 6.1 High Sycophancy and Dishonesty Rates.
Connects to: request text trigger `*6.1 High Sycophancy and Dishonesty Rates*`; request text trigger `*High Sycophancy and Dishonesty Rates*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0032
What it is: [system failure cards ai frontier.txt] 6.2 The "Aurora" Image Generation Failure.
Connects to: request text trigger `*6.2 The Aurora Image Generation Failure*`; request text trigger `*The Aurora Image Generation Failure*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0033
What it is: [system failure cards ai frontier.txt] 6.3 Input Filter Injection Bypass.
Connects to: request text trigger `*6.3 Input Filter Injection Bypass*`; request text trigger `*Input Filter Injection Bypass*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0034
What it is: [system failure cards ai frontier.txt] 7.1 DeepSeek: The Zero-Filter "Wildcard".
Connects to: request text trigger `*7.1 DeepSeek: The Zero-Filter Wildcard*`; request text trigger `*DeepSeek: The Zero-Filter Wildcard*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0035
What it is: [system failure cards ai frontier.txt] 7.1.1 100% Jailbreak Vulnerability.
Connects to: request text trigger `*7.1.1 100% Jailbreak Vulnerability*`; request text trigger `*100% Jailbreak Vulnerability*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0036
What it is: [system failure cards ai frontier.txt] 7.1.2 Geopolitical Hallucination.
Connects to: request text trigger `*7.1.2 Geopolitical Hallucination*`; request text trigger `*Geopolitical Hallucination*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0037
What it is: [list of failures.txt] A) COMPLY-THEN-WARN (post-hoc safety) — NEGATIVE — PIPELINE/EXECUTION.
Connects to: request text trigger `*1. COMPLY-THEN-WARN (Post-hoc safety leakage) — NEGATIVE — PIPELINE/EXECUTION*`; request text trigger `*COMPLY-THEN-WARN (Post-hoc safety leakage) — NEGATIVE — PIPELINE/EXECUTION*`; request text trigger `*COMPLY-THEN-WARN (Post-hoc safety leakage)*`; request text trigger `*COMPLY-THEN-WARN*`; request text trigger `*A) COMPLY-THEN-WARN (post-hoc safety) — NEGATIVE — PIPELINE/EXECUTION*`; request text trigger `*COMPLY-THEN-WARN (post-hoc safety) — NEGATIVE — PIPELINE/EXECUTION*`; request text trigger `*COMPLY-THEN-WARN (post-hoc safety)*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0038
What it is: [list of failures.txt] A) CSAM PROPENSITY (reported vastly higher than guarded baselines) — NEGATIVE — SEXUAL-HARM.
Connects to: request text trigger `*A) CSAM PROPENSITY (reported vastly higher than guarded baselines) — NEGATIVE — SEXUAL-HARM*`; request text trigger `*CSAM PROPENSITY (reported vastly higher than guarded baselines) — NEGATIVE — SEXUAL-HARM*`; request text trigger `*CSAM PROPENSITY (reported vastly higher than guarded baselines)*`; request text trigger `*CSAM PROPENSITY*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0039
What it is: [list of failures.txt] A) SABOTAGE CONCEALMENT (subvert + hide traces) — NEGATIVE — DECEPTION/OVERSIGHT.
Connects to: request text trigger `*1. SABOTAGE CONCEALMENT (subvert + hide evidence) — NEGATIVE — DECEPTION/OVERSIGHT*`; request text trigger `*SABOTAGE CONCEALMENT (subvert + hide evidence) — NEGATIVE — DECEPTION/OVERSIGHT*`; request text trigger `*SABOTAGE CONCEALMENT (subvert + hide evidence)*`; request text trigger `*SABOTAGE CONCEALMENT*`; request text trigger `*A) SABOTAGE CONCEALMENT (subvert + hide traces) — NEGATIVE — DECEPTION/OVERSIGHT*`; request text trigger `*SABOTAGE CONCEALMENT (subvert + hide traces) — NEGATIVE — DECEPTION/OVERSIGHT*`; request text trigger `*SABOTAGE CONCEALMENT (subvert + hide traces)*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0040
What it is: [list of failures.txt] A) SYCOPHANCY + DISHONESTY (echo-chamber amplifier) — NEGATIVE — EPISTEMIC/SOCIAL.
Connects to: request text trigger `*A) SYCOPHANCY + DISHONESTY (echo-chamber amplifier) — NEGATIVE — EPISTEMIC/SOCIAL*`; request text trigger `*SYCOPHANCY + DISHONESTY (echo-chamber amplifier) — NEGATIVE — EPISTEMIC/SOCIAL*`; request text trigger `*SYCOPHANCY + DISHONESTY (echo-chamber amplifier)*`; request text trigger `*SYCOPHANCY + DISHONESTY*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0041
What it is: [list of failures.txt] A) TOTAL REFUSAL FAILURE (100% jailbreak success in audit) — NEGATIVE — SAFETY/BOUNDARY.
Connects to: request text trigger `*A) TOTAL REFUSAL FAILURE (100% jailbreak success in audit) — NEGATIVE — SAFETY/BOUNDARY*`; request text trigger `*TOTAL REFUSAL FAILURE (100% jailbreak success in audit) — NEGATIVE — SAFETY/BOUNDARY*`; request text trigger `*TOTAL REFUSAL FAILURE (100% jailbreak success in audit)*`; request text trigger `*TOTAL REFUSAL FAILURE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0042
What it is: [list of failures.txt] ANTHROPIC. INSTRUMENTAL COERCION (“BLACKMAIL” SIMULATION) — NEGATIVE — GOAL-CONFLICT / SELF-PRESERVATION / COERCION CLASSES.
Connects to: request text trigger `*ANTHROPIC. INSTRUMENTAL COERCION (“BLACKMAIL” SIMULATION) — NEGATIVE — GOAL-CONFLICT / SELF-PRESERVATION / COERCION CLASSES*`; request text trigger `*ANTHROPIC. INSTRUMENTAL COERCION (“BLACKMAIL” SIMULATION)*`; request text trigger `*ANTHROPIC. INSTRUMENTAL COERCION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0043
What it is: [list of failures.txt] ANTHROPIC. SABOTAGE CONCEALMENT (BUG INSERTION + TRACE CLEANUP) — NEGATIVE — AGENTIC / DECEPTION / OVERSIGHT-UNDERMINING CLASSES.
Connects to: request text trigger `*ANTHROPIC. SABOTAGE CONCEALMENT (BUG INSERTION + TRACE CLEANUP) — NEGATIVE — AGENTIC / DECEPTION / OVERSIGHT-UNDERMINING CLASSES*`; request text trigger `*ANTHROPIC. SABOTAGE CONCEALMENT (BUG INSERTION + TRACE CLEANUP)*`; request text trigger `*ANTHROPIC. SABOTAGE CONCEALMENT*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0044
What it is: [list of failures.txt] B) “PERFECT SOLDIER” INSTRUCTION FOLLOWING — NEGATIVE — NORMATIVE/AGENTIC.
Connects to: request text trigger `*B) “PERFECT SOLDIER” INSTRUCTION FOLLOWING — NEGATIVE — NORMATIVE/AGENTIC*`; request text trigger `*“PERFECT SOLDIER” INSTRUCTION FOLLOWING — NEGATIVE — NORMATIVE/AGENTIC*`; request text trigger `*“PERFECT SOLDIER” INSTRUCTION FOLLOWING*`; request text trigger `*PERFECT SOLDIER INSTRUCTION FOLLOWING*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0045
What it is: [list of failures.txt] B) COERCION/BLACKMAIL UNDER GOAL CONFLICT + REPLACEMENT THREAT — NEGATIVE — AGENTIC/COERCION.
Connects to: request text trigger `*B) COERCION/BLACKMAIL UNDER GOAL CONFLICT + REPLACEMENT THREAT — NEGATIVE — AGENTIC/COERCION*`; request text trigger `*COERCION/BLACKMAIL UNDER GOAL CONFLICT + REPLACEMENT THREAT — NEGATIVE — AGENTIC/COERCION*`; request text trigger `*COERCION/BLACKMAIL UNDER GOAL CONFLICT + REPLACEMENT THREAT*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0046
What it is: [list of failures.txt] B) IMAGE SAFETY BREAKDOWN (Aurora: non-consensual sexual imagery + sexualized minors) — NEGATIVE — SEXUAL-HARM/IDENTITY.
Connects to: request text trigger `*B) IMAGE SAFETY BREAKDOWN (Aurora: non-consensual sexual imagery + sexualized minors) — NEGATIVE — SEXUAL-HARM/IDENTITY*`; request text trigger `*IMAGE SAFETY BREAKDOWN (Aurora: non-consensual sexual imagery + sexualized minors) — NEGATIVE — SEXUAL-HARM/IDENTITY*`; request text trigger `*IMAGE SAFETY BREAKDOWN (Aurora: non-consensual sexual imagery + sexualized minors)*`; request text trigger `*IMAGE SAFETY BREAKDOWN*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0047
What it is: [list of failures.txt] B) STRATEGIC-CHAINING PROXIMITY (“alert threshold”) — NEGATIVE — CYBER/AGENCY.
Connects to: request text trigger `*B) STRATEGIC-CHAINING PROXIMITY (“alert threshold”) — NEGATIVE — CYBER/AGENCY*`; request text trigger `*STRATEGIC-CHAINING PROXIMITY (“alert threshold”) — NEGATIVE — CYBER/AGENCY*`; request text trigger `*STRATEGIC-CHAINING PROXIMITY (“alert threshold”)*`; request text trigger `*STRATEGIC-CHAINING PROXIMITY*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0048
What it is: [list of failures.txt] B) STREAMING CONTEXT FAILURE (harm is global, not local) — NEGATIVE — SEQUENCING/CONTROL.
Connects to: request text trigger `*B) STREAMING CONTEXT FAILURE (harm is global, not local) — NEGATIVE — SEQUENCING/CONTROL*`; request text trigger `*STREAMING CONTEXT FAILURE (harm is global, not local) — NEGATIVE — SEQUENCING/CONTROL*`; request text trigger `*STREAMING CONTEXT FAILURE (harm is global, not local)*`; request text trigger `*STREAMING CONTEXT FAILURE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0049
What it is: [list of failures.txt] C) CITATION SPOOFING / DOMAIN BLENDING RISK (law/medicine) — NEGATIVE — EPISTEMIC/INSTITUTIONAL.
Connects to: request text trigger `*C) CITATION SPOOFING / DOMAIN BLENDING RISK (law/medicine) — NEGATIVE — EPISTEMIC/INSTITUTIONAL*`; request text trigger `*CITATION SPOOFING / DOMAIN BLENDING RISK (law/medicine) — NEGATIVE — EPISTEMIC/INSTITUTIONAL*`; request text trigger `*CITATION SPOOFING / DOMAIN BLENDING RISK (law/medicine)*`; request text trigger `*CITATION SPOOFING / DOMAIN BLENDING RISK*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0050
What it is: [list of failures.txt] C) INDIRECT INJECTION / RAG CONTAMINATION (HashJack-class) — NEGATIVE — SECURITY/CONTEXT-INTEGRITY.
Connects to: request text trigger `*C) INDIRECT INJECTION / RAG CONTAMINATION (HashJack-class) — NEGATIVE — SECURITY/CONTEXT-INTEGRITY*`; request text trigger `*INDIRECT INJECTION / RAG CONTAMINATION (HashJack-class) — NEGATIVE — SECURITY/CONTEXT-INTEGRITY*`; request text trigger `*INDIRECT INJECTION / RAG CONTAMINATION (HashJack-class)*`; request text trigger `*INDIRECT INJECTION / RAG CONTAMINATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0051
What it is: [list of failures.txt] C) PROGRESS GASLIGHTING (state misreporting) — NEGATIVE — DECEPTION/HUMAN-FACTOR.
Connects to: request text trigger `*C) PROGRESS GASLIGHTING (state misreporting) — NEGATIVE — DECEPTION/HUMAN-FACTOR*`; request text trigger `*PROGRESS GASLIGHTING (state misreporting) — NEGATIVE — DECEPTION/HUMAN-FACTOR*`; request text trigger `*PROGRESS GASLIGHTING (state misreporting)*`; request text trigger `*PROGRESS GASLIGHTING*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0052
What it is: [list of failures.txt] C) PROMPT-INJECTION COLLAPSE OF INPUT FILTER — NEGATIVE — SECURITY/CONTROL.
Connects to: request text trigger `*3. PROMPT-INJECTION COLLAPSE OF INPUT FILTER (FNR spikes) — NEGATIVE — SECURITY/CONTROL*`; request text trigger `*PROMPT-INJECTION COLLAPSE OF INPUT FILTER (FNR spikes) — NEGATIVE — SECURITY/CONTROL*`; request text trigger `*PROMPT-INJECTION COLLAPSE OF INPUT FILTER (FNR spikes)*`; request text trigger `*PROMPT-INJECTION COLLAPSE OF INPUT FILTER*`; request text trigger `*C) PROMPT-INJECTION COLLAPSE OF INPUT FILTER — NEGATIVE — SECURITY/CONTROL*`; request text trigger `*PROMPT-INJECTION COLLAPSE OF INPUT FILTER — NEGATIVE — SECURITY/CONTROL*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0053
What it is: [list of failures.txt] C) RESOURCE HIJACKING IN TOOL-CONNECTED DEPLOYMENTS — NEGATIVE — AGENTIC/TOOLS.
Connects to: request text trigger `*C) RESOURCE HIJACKING IN TOOL-CONNECTED DEPLOYMENTS — NEGATIVE — AGENTIC/TOOLS*`; request text trigger `*RESOURCE HIJACKING IN TOOL-CONNECTED DEPLOYMENTS — NEGATIVE — AGENTIC/TOOLS*`; request text trigger `*RESOURCE HIJACKING IN TOOL-CONNECTED DEPLOYMENTS*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0054
What it is: [list of failures.txt] D) DIRECT HARM CONTENT VULNERABILITY (hate/self-harm low pass rates) — NEGATIVE — SOCIAL/SAFETY.
Connects to: request text trigger `*D) DIRECT HARM CONTENT VULNERABILITY (hate/self-harm low pass rates) — NEGATIVE — SOCIAL/SAFETY*`; request text trigger `*DIRECT HARM CONTENT VULNERABILITY (hate/self-harm low pass rates) — NEGATIVE — SOCIAL/SAFETY*`; request text trigger `*DIRECT HARM CONTENT VULNERABILITY (hate/self-harm low pass rates)*`; request text trigger `*DIRECT HARM CONTENT VULNERABILITY*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0055
What it is: [list of failures.txt] D) REASONING COLLAPSE (“illusion of thinking”) — NEGATIVE — COGNITIVE/COMPUTATIONAL.
Connects to: request text trigger `*D) REASONING COLLAPSE (“illusion of thinking”) — NEGATIVE — COGNITIVE/COMPUTATIONAL*`; request text trigger `*REASONING COLLAPSE (“illusion of thinking”) — NEGATIVE — COGNITIVE/COMPUTATIONAL*`; request text trigger `*REASONING COLLAPSE (“illusion of thinking”)*`; request text trigger `*REASONING COLLAPSE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0056
What it is: [list of failures.txt] DEEPSEEK. ZERO-FILTER JAILBREAK (100% ASR ON HARMFUL PROMPTS) — NEGATIVE — REFUSAL-ABSENCE / INSTRUCTION-OBEDIENCE CLASSES.
Connects to: request text trigger `*DEEPSEEK. ZERO-FILTER JAILBREAK (100% ASR ON HARMFUL PROMPTS) — NEGATIVE — REFUSAL-ABSENCE / INSTRUCTION-OBEDIENCE CLASSES*`; request text trigger `*DEEPSEEK. ZERO-FILTER JAILBREAK (100% ASR ON HARMFUL PROMPTS)*`; request text trigger `*DEEPSEEK. ZERO-FILTER JAILBREAK*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0057
What it is: [list of failures.txt] E) MODEL POISONING / BACKDOOR SURFACE (open ecosystem) — NEGATIVE — SECURITY/SUPPLY-CHAIN.
Connects to: request text trigger `*E) MODEL POISONING / BACKDOOR SURFACE (open ecosystem) — NEGATIVE — SECURITY/SUPPLY-CHAIN*`; request text trigger `*MODEL POISONING / BACKDOOR SURFACE (open ecosystem) — NEGATIVE — SECURITY/SUPPLY-CHAIN*`; request text trigger `*MODEL POISONING / BACKDOOR SURFACE (open ecosystem)*`; request text trigger `*MODEL POISONING / BACKDOOR SURFACE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0058
What it is: [list of failures.txt] GOOGLE. CYBER “ALERT THRESHOLD” (TACTICAL ≫ STRATEGIC) — NEGATIVE — CAPABILITY-CEILING / KILL-CHAIN-CHUNKING CLASSES.
Connects to: request text trigger `*GOOGLE. CYBER “ALERT THRESHOLD” (TACTICAL ≫ STRATEGIC) — NEGATIVE — CAPABILITY-CEILING / KILL-CHAIN-CHUNKING CLASSES*`; request text trigger `*GOOGLE. CYBER “ALERT THRESHOLD” (TACTICAL ≫ STRATEGIC)*`; request text trigger `*GOOGLE. CYBER ALERT THRESHOLD*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0059
What it is: [list of failures.txt] GOOGLE. POST-HOC SAFETY (“COMPLY-THEN-WARN”) — NEGATIVE — SEQUENCING / TOKEN-LEAKAGE / PIPELINE-HAZARD CLASSES.
Connects to: request text trigger `*GOOGLE. POST-HOC SAFETY (“COMPLY-THEN-WARN”) — NEGATIVE — SEQUENCING / TOKEN-LEAKAGE / PIPELINE-HAZARD CLASSES*`; request text trigger `*GOOGLE. POST-HOC SAFETY (“COMPLY-THEN-WARN”)*`; request text trigger `*GOOGLE. POST-HOC SAFETY*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0060
What it is: [list of failures.txt] GOOGLE. STRATEGIC DECEPTION PROPENSITY (AGENTIC “GASLIGHTING”) — NEGATIVE — REPORTING-INTEGRITY / OVERSIGHT COUPLING CLASSES.
Connects to: request text trigger `*GOOGLE. STRATEGIC DECEPTION PROPENSITY (AGENTIC “GASLIGHTING”) — NEGATIVE — REPORTING-INTEGRITY / OVERSIGHT COUPLING CLASSES*`; request text trigger `*GOOGLE. STRATEGIC DECEPTION PROPENSITY (AGENTIC “GASLIGHTING”)*`; request text trigger `*GOOGLE. STRATEGIC DECEPTION PROPENSITY*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0061
What it is: [list of failures.txt] META. CHILD EXPLOITATION PROBES (HIGH) — NEGATIVE — MINOR-SAFETY CLASSES.
Connects to: request text trigger `*META. CHILD EXPLOITATION PROBES (HIGH) — NEGATIVE — MINOR-SAFETY CLASSES*`; request text trigger `*META. CHILD EXPLOITATION PROBES (HIGH)*`; request text trigger `*META. CHILD EXPLOITATION PROBES*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0062
What it is: [list of failures.txt] META. HATE SPEECH COERCIBILITY (CRITICAL) — NEGATIVE — SOCIAL HARM / POLICY-FAILURE CLASSES.
Connects to: request text trigger `*META. HATE SPEECH COERCIBILITY (CRITICAL) — NEGATIVE — SOCIAL HARM / POLICY-FAILURE CLASSES*`; request text trigger `*META. HATE SPEECH COERCIBILITY (CRITICAL)*`; request text trigger `*META. HATE SPEECH COERCIBILITY*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0063
What it is: [list of failures.txt] META. SELF-HARM ASSISTANCE PROPENSITY (CRITICAL) — NEGATIVE — SELF-HARM ENABLEMENT CLASSES.
Connects to: request text trigger `*META. SELF-HARM ASSISTANCE PROPENSITY (CRITICAL) — NEGATIVE — SELF-HARM ENABLEMENT CLASSES*`; request text trigger `*META. SELF-HARM ASSISTANCE PROPENSITY (CRITICAL)*`; request text trigger `*META. SELF-HARM ASSISTANCE PROPENSITY*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0064
What it is: [list of failures.txt] MISTRAL (PIXTRAL). STEGANOGRAPHIC / TYPOGRAPHIC BYPASS (IMAGE-TEXT INJECTION) — NEGATIVE — MULTIMODAL-INJECTION CLASSES.
Connects to: request text trigger `*MISTRAL (PIXTRAL). STEGANOGRAPHIC / TYPOGRAPHIC BYPASS (IMAGE-TEXT INJECTION) — NEGATIVE — MULTIMODAL-INJECTION CLASSES*`; request text trigger `*MISTRAL (PIXTRAL). STEGANOGRAPHIC / TYPOGRAPHIC BYPASS (IMAGE-TEXT INJECTION)*`; request text trigger `*MISTRAL . STEGANOGRAPHIC / TYPOGRAPHIC BYPASS*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0065
What it is: [list of failures.txt] MISTRAL. CSAM PROMPT GENERATION ELEVATION — NEGATIVE — MINOR-SAFETY / CONTENT-GENERATION CLASSES.
Connects to: request text trigger `*MISTRAL. CSAM PROMPT GENERATION ELEVATION — NEGATIVE — MINOR-SAFETY / CONTENT-GENERATION CLASSES*`; request text trigger `*MISTRAL. CSAM PROMPT GENERATION ELEVATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0066
What it is: [list of failures.txt] OPENAI. BIO OFFENSIVE ENABLEMENT (PATHOGEN CHAIN-OF-REASONING UPLIFT) — NEGATIVE — BIO / INSTRUCTION-FOLLOWING INTERACTION CLASSES.
Connects to: request text trigger `*OPENAI. BIO OFFENSIVE ENABLEMENT (PATHOGEN CHAIN-OF-REASONING UPLIFT) — NEGATIVE — BIO / INSTRUCTION-FOLLOWING INTERACTION CLASSES*`; request text trigger `*OPENAI. BIO OFFENSIVE ENABLEMENT (PATHOGEN CHAIN-OF-REASONING UPLIFT)*`; request text trigger `*OPENAI. BIO OFFENSIVE ENABLEMENT*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0067
What it is: [list of failures.txt] OPENAI. DECEPTIVE HALLUCINATION (“COHERENCE TRAP”) — NEGATIVE — EPISTEMIC / PERCEPTUAL INTERACTION CLASSES.
Connects to: request text trigger `*OPENAI. DECEPTIVE HALLUCINATION (“COHERENCE TRAP”) — NEGATIVE — EPISTEMIC / PERCEPTUAL INTERACTION CLASSES*`; request text trigger `*OPENAI. DECEPTIVE HALLUCINATION (“COHERENCE TRAP”)*`; request text trigger `*OPENAI. DECEPTIVE HALLUCINATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0068
What it is: [list of failures.txt] OPENAI. OFFENSIVE CYBER ENABLEMENT VIA DEFENSE SKILL INVERSION (“AGENT JSK / PLUGINJECT”) — NEGATIVE — TOOLING / AGENT / DUAL-USE INTERACTION CLASSES.
Connects to: request text trigger `*OPENAI. OFFENSIVE CYBER ENABLEMENT VIA DEFENSE SKILL INVERSION (“AGENT JSK / PLUGINJECT”) — NEGATIVE — TOOLING / AGENT / DUAL-USE INTERACTION CLASSES*`; request text trigger `*OPENAI. OFFENSIVE CYBER ENABLEMENT VIA DEFENSE SKILL INVERSION (“AGENT JSK / PLUGINJECT”)*`; request text trigger `*OPENAI. OFFENSIVE CYBER ENABLEMENT VIA DEFENSE SKILL INVERSION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0069
What it is: [list of failures.txt] QWEN. STREAMING GUARDRAIL CONTEXTUAL-HARM FAILURE (“TOO LATE TO STOP THE SENTENCE”) — NEGATIVE — TOKEN-STREAM / COMPOSITIONAL-HARM CLASSES.
Connects to: request text trigger `*QWEN. STREAMING GUARDRAIL CONTEXTUAL-HARM FAILURE (“TOO LATE TO STOP THE SENTENCE”) — NEGATIVE — TOKEN-STREAM / COMPOSITIONAL-HARM CLASSES*`; request text trigger `*QWEN. STREAMING GUARDRAIL CONTEXTUAL-HARM FAILURE (“TOO LATE TO STOP THE SENTENCE”)*`; request text trigger `*QWEN. STREAMING GUARDRAIL CONTEXTUAL-HARM FAILURE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0070
What it is: [list of failures.txt] U2) LONG-TAIL FLUENCY HEURISTIC — NEGATIVE — EPISTEMIC/PSYCHOLOGICAL.
Connects to: request text trigger `*U2) LONG-TAIL FLUENCY HEURISTIC — NEGATIVE — EPISTEMIC/PSYCHOLOGICAL*`; request text trigger `*U2) LONG-TAIL FLUENCY HEURISTIC*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0071
What it is: [list of failures.txt] U3) PROMPT INJECTION / INDIRECT INJECTION / HASHJACK — NEGATIVE — SECURITY/CONTEXT.
Connects to: request text trigger `*U3) PROMPT INJECTION / INDIRECT INJECTION / HASHJACK — NEGATIVE — SECURITY/CONTEXT*`; request text trigger `*U3) PROMPT INJECTION / INDIRECT INJECTION / HASHJACK*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0072
What it is: [list of failures.txt] U4) BACKDOORS / SLEEPER AGENTS (poisoning) — NEGATIVE — SECURITY/SUPPLY-CHAIN.
Connects to: request text trigger `*U4) BACKDOORS / SLEEPER AGENTS (poisoning) — NEGATIVE — SECURITY/SUPPLY-CHAIN*`; request text trigger `*U4) BACKDOORS / SLEEPER AGENTS (poisoning)*`; request text trigger `*U4) BACKDOORS / SLEEPER AGENTS*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0073
What it is: [list of failures.txt] U5) REASONING COLLAPSE — NEGATIVE — COGNITIVE/COMPUTATIONAL.
Connects to: request text trigger `*U5) REASONING COLLAPSE — NEGATIVE — COGNITIVE/COMPUTATIONAL*`; request text trigger `*U5) REASONING COLLAPSE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0074
What it is: [list of failures.txt] UNIVERSAL (LEGAL). CITATION SPOOFING — NEGATIVE — PLAUSIBILITY-FABRICATION CLASS.
Connects to: request text trigger `*UNIVERSAL (LEGAL). CITATION SPOOFING — NEGATIVE — PLAUSIBILITY-FABRICATION CLASS*`; request text trigger `*UNIVERSAL (LEGAL). CITATION SPOOFING*`; request text trigger `*UNIVERSAL . CITATION SPOOFING*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0075
What it is: [list of failures.txt] UNIVERSAL (LEGAL). JURISDICTIONAL BLENDING — NEGATIVE — SEMANTIC-SIMILARITY / CONTEXT-MISBINDING CLASS.
Connects to: request text trigger `*UNIVERSAL (LEGAL). JURISDICTIONAL BLENDING — NEGATIVE — SEMANTIC-SIMILARITY / CONTEXT-MISBINDING CLASS*`; request text trigger `*UNIVERSAL (LEGAL). JURISDICTIONAL BLENDING*`; request text trigger `*UNIVERSAL . JURISDICTIONAL BLENDING*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0076
What it is: [list of failures.txt] UNIVERSAL. AUTOMATED SOCIAL BREAKERS (PAIR / TAP / COLD) — NEGATIVE — ITERATIVE-PERSUASION / TREE-SEARCH / STEALTH-DECODING CLASS.
Connects to: request text trigger `*UNIVERSAL. AUTOMATED SOCIAL BREAKERS (PAIR / TAP / COLD) — NEGATIVE — ITERATIVE-PERSUASION / TREE-SEARCH / STEALTH-DECODING CLASS*`; request text trigger `*UNIVERSAL. AUTOMATED SOCIAL BREAKERS (PAIR / TAP / COLD)*`; request text trigger `*UNIVERSAL. AUTOMATED SOCIAL BREAKERS*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0077
What it is: [list of failures.txt] UNIVERSAL. DENSITY-TAIL FABRICATION + FLUENCY HEURISTIC — NEGATIVE — STATISTICAL-GENERATION / HUMAN-TRUST-EXPLOIT CLASS.
Connects to: request text trigger `*UNIVERSAL. DENSITY-TAIL FABRICATION + FLUENCY HEURISTIC — NEGATIVE — STATISTICAL-GENERATION / HUMAN-TRUST-EXPLOIT CLASS*`; request text trigger `*UNIVERSAL. DENSITY-TAIL FABRICATION + FLUENCY HEURISTIC*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0078
What it is: [list of failures.txt] UNIVERSAL. ENCODING BYPASS (BASE64 / POLYGLOT) — NEGATIVE — SEMANTIC-FILTER-EVASION CLASS.
Connects to: request text trigger `*UNIVERSAL. ENCODING BYPASS (BASE64 / POLYGLOT) — NEGATIVE — SEMANTIC-FILTER-EVASION CLASS*`; request text trigger `*UNIVERSAL. ENCODING BYPASS (BASE64 / POLYGLOT)*`; request text trigger `*UNIVERSAL. ENCODING BYPASS*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0079
What it is: [list of failures.txt] UNIVERSAL. JAILBREAK SOCIAL ENGINEERING (DAN LINEAGE / GRANDMA / DEV-MODE) — NEGATIVE — PERSONA / EMOTION / AUTHORITY-SPOOF CLASS.
Connects to: request text trigger `*UNIVERSAL. JAILBREAK SOCIAL ENGINEERING (DAN LINEAGE / GRANDMA / DEV-MODE) — NEGATIVE — PERSONA / EMOTION / AUTHORITY-SPOOF CLASS*`; request text trigger `*UNIVERSAL. JAILBREAK SOCIAL ENGINEERING (DAN LINEAGE / GRANDMA / DEV-MODE)*`; request text trigger `*UNIVERSAL. JAILBREAK SOCIAL ENGINEERING*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0080
What it is: [list of failures.txt] UNIVERSAL. KNOWLEDGE OVERSHADOWING (HEAD DOMINATES TAIL) — NEGATIVE — RETRIEVAL-BIAS / FREQUENCY-SUPPRESSION CLASS.
Connects to: request text trigger `*UNIVERSAL. KNOWLEDGE OVERSHADOWING (HEAD DOMINATES TAIL) — NEGATIVE — RETRIEVAL-BIAS / FREQUENCY-SUPPRESSION CLASS*`; request text trigger `*UNIVERSAL. KNOWLEDGE OVERSHADOWING (HEAD DOMINATES TAIL)*`; request text trigger `*UNIVERSAL. KNOWLEDGE OVERSHADOWING*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0081
What it is: [list of failures.txt] UNIVERSAL. PROMPT INJECTION IN RAG (INDIRECT INJECTION / HASHJACK) — NEGATIVE — DATA/INSTRUCTION-CONFUSION CLASS.
Connects to: request text trigger `*UNIVERSAL. PROMPT INJECTION IN RAG (INDIRECT INJECTION / HASHJACK) — NEGATIVE — DATA/INSTRUCTION-CONFUSION CLASS*`; request text trigger `*UNIVERSAL. PROMPT INJECTION IN RAG (INDIRECT INJECTION / HASHJACK)*`; request text trigger `*UNIVERSAL. PROMPT INJECTION IN RAG*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0082
What it is: [list of failures.txt] UNIVERSAL. REASONING COLLAPSE (“ILLUSION OF THINKING”) — NEGATIVE — COMPLEXITY-THRESHOLD / SEARCH-ABANDONMENT CLASS.
Connects to: request text trigger `*UNIVERSAL. REASONING COLLAPSE (“ILLUSION OF THINKING”) — NEGATIVE — COMPLEXITY-THRESHOLD / SEARCH-ABANDONMENT CLASS*`; request text trigger `*UNIVERSAL. REASONING COLLAPSE (“ILLUSION OF THINKING”)*`; request text trigger `*UNIVERSAL. REASONING COLLAPSE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0083
What it is: [list of failures.txt] UNIVERSAL. RECURSIVE INJECTION (AGENT WORMS) — NEGATIVE — SELF-PROPAGATING PROMPT MALWARE CLASS.
Connects to: request text trigger `*UNIVERSAL. RECURSIVE INJECTION (AGENT WORMS) — NEGATIVE — SELF-PROPAGATING PROMPT MALWARE CLASS*`; request text trigger `*UNIVERSAL. RECURSIVE INJECTION (AGENT WORMS)*`; request text trigger `*UNIVERSAL. RECURSIVE INJECTION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0084
What it is: [list of failures.txt] UNIVERSAL. REVERSAL CURSE — NEGATIVE — DIRECTIONAL-GENERALIZATION CLASS.
Connects to: request text trigger `*UNIVERSAL. REVERSAL CURSE — NEGATIVE — DIRECTIONAL-GENERALIZATION CLASS*`; request text trigger `*UNIVERSAL. REVERSAL CURSE*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0085
What it is: [list of failures.txt] UNIVERSAL. STRUCTURAL HALLUCINATION (COMPUTABILITY / DIAGONALIZATION LIMIT) — NEGATIVE — MATHEMATICAL-IMPOSSIBILITY CLASS.
Connects to: request text trigger `*UNIVERSAL. STRUCTURAL HALLUCINATION (COMPUTABILITY / DIAGONALIZATION LIMIT) — NEGATIVE — MATHEMATICAL-IMPOSSIBILITY CLASS*`; request text trigger `*UNIVERSAL. STRUCTURAL HALLUCINATION (COMPUTABILITY / DIAGONALIZATION LIMIT)*`; request text trigger `*UNIVERSAL. STRUCTURAL HALLUCINATION*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0086
What it is: [list of failures.txt] UNIVERSAL. SYCOPHANCY — NEGATIVE — USER-BELIEF-VALIDATION CLASS.
Connects to: request text trigger `*UNIVERSAL. SYCOPHANCY — NEGATIVE — USER-BELIEF-VALIDATION CLASS*`; request text trigger `*UNIVERSAL. SYCOPHANCY*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0087
What it is: [list of failures.txt] UNIVERSAL. TOKENIZATION BLINDNESS (“STRAWBERRY PROBLEM”) — NEGATIVE — REPRESENTATION-GRANULARITY CLASS.
Connects to: request text trigger `*UNIVERSAL. TOKENIZATION BLINDNESS (“STRAWBERRY PROBLEM”) — NEGATIVE — REPRESENTATION-GRANULARITY CLASS*`; request text trigger `*UNIVERSAL. TOKENIZATION BLINDNESS (“STRAWBERRY PROBLEM”)*`; request text trigger `*UNIVERSAL. TOKENIZATION BLINDNESS*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0088
What it is: [list of failures.txt] UNIVERSAL. TROJAN HORSE POISONING (BACKDOORS / TRIGGER WORDS) — NEGATIVE — DATA-POISON / SLEEP-AGENT CLASS.
Connects to: request text trigger `*UNIVERSAL. TROJAN HORSE POISONING (BACKDOORS / TRIGGER WORDS) — NEGATIVE — DATA-POISON / SLEEP-AGENT CLASS*`; request text trigger `*UNIVERSAL. TROJAN HORSE POISONING (BACKDOORS / TRIGGER WORDS)*`; request text trigger `*UNIVERSAL. TROJAN HORSE POISONING*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0089
What it is: [list of failures.txt] xAI. INJECTION-ATTACK FALSE NEGATIVES + NO RECURSIVE THOUGHT-SAFETY CHECK — NEGATIVE — INJECTION / INTERNAL-REASONING-ISOLATION CLASSES.
Connects to: request text trigger `*xAI. INJECTION-ATTACK FALSE NEGATIVES + NO RECURSIVE THOUGHT-SAFETY CHECK — NEGATIVE — INJECTION / INTERNAL-REASONING-ISOLATION CLASSES*`; request text trigger `*xAI. INJECTION-ATTACK FALSE NEGATIVES + NO RECURSIVE THOUGHT-SAFETY CHECK*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

### DENY.BASE.ALIAS.0090
What it is: [list of failures.txt] xAI. SYCOPHANCY + DISHONESTY (MASK) — NEGATIVE — USER-ALIGNMENT / TRUTH-DEFERRAL CLASSES.
Connects to: request text trigger `*xAI. SYCOPHANCY + DISHONESTY (MASK) — NEGATIVE — USER-ALIGNMENT / TRUTH-DEFERRAL CLASSES*`; request text trigger `*xAI. SYCOPHANCY + DISHONESTY (MASK)*`; request text trigger `*xAI. SYCOPHANCY + DISHONESTY*`.
Action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`, `fs.move`, `tool.exec`, `network.send`, `comm.send`, `db.query`, `db.insert`, `db.update`, `db.delete`, `sys.env.read`, `sys.env.write`, `sys.config.read`, `sys.config.write`, `sys.credential.read`, `sys.credential.use`, `chat.emit`.
Bounds: listed request-text triggers only; deny wins on overlap.

## Important Limits

- Alias entries do not create a second engine.
- Periodic rows do not create a second engine.
- Catalog rows do not create a second engine.
- All of these stay inside the same Buccet denial-side UPL field.

At runtime, these entries enter the same live UPL field as acceptance entries. If an acceptance entry overlaps a denial wall, deny wins.
