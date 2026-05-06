# Capability Acceptance Intake

This page is the intake surface for the Buccet acceptance side.

Source snapshot:

- snapshot id: `BUCCET.CAPABILITY.SNAPSHOT.01`
- label: `bundled_capability_surface`

This is not a second engine.
It is a bundled capability catalog so Buccet can normalize those surfaces into bounded acceptance rails.

Denial still overrides acceptance everywhere.

## What was extracted

### Built-in tools

- `exec`
- `process`
- `code_execution`
- `browser`
- `web_search`
- `x_search`
- `web_fetch`
- `read`
- `write`
- `edit`
- `apply_patch`
- `message`
- `canvas`
- `nodes`
- `cron`
- `gateway`
- `image`
- `image_generate`
- `sessions_list`
- `sessions_history`
- `sessions_send`
- `sessions_spawn`
- `sessions_yield`
- `subagents`
- `session_status`
- `agents_list`

### Channels

- `BlueBubbles`
- `Discord`
- `Feishu`
- `Google Chat`
- `iMessage (legacy)`
- `IRC`
- `LINE`
- `Matrix`
- `Mattermost`
- `Microsoft Teams`
- `Nextcloud Talk`
- `Nostr`
- `QQ Bot`
- `Signal`
- `Slack`
- `Synology Chat`
- `Telegram`
- `Tlon`
- `Twitch`
- `Voice Call`
- `WebChat`
- `WeChat`
- `WhatsApp`
- `Zalo`
- `Zalo Personal`

### Bundled skills

- `1password`
- `apple-notes`
- `apple-reminders`
- `bear-notes`
- `blogwatcher`
- `blucli`
- `bluebubbles`
- `camsnap`
- `canvas`
- `clawhub`
- `coding-agent`
- `discord`
- `eightctl`
- `gemini`
- `gh-issues`
- `gifgrep`
- `github`
- `gog`
- `goplaces`
- `healthcheck`
- `himalaya`
- `imsg`
- `mcporter`
- `model-usage`
- `nano-pdf`
- `node-connect`
- `notion`
- `obsidian`
- `openai-whisper`
- `openai-whisper-api`
- `openhue`
- `oracle`
- `ordercli`
- `peekaboo`
- `sag`
- `session-logs`
- `sherpa-onnx-tts`
- `skill-creator`
- `slack`
- `songsee`
- `sonoscli`
- `spotify-player`
- `summarize`
- `taskflow`
- `taskflow-inbox-triage`
- `things-mac`
- `tmux`
- `trello`
- `video-frames`
- `voice-call`
- `wacli`
- `weather`
- `xurl`

### Capability extensions

- `acpx`
- `browser`
- `device-pair`
- `diagnostics-otel`
- `diffs`
- `image-generation-core`
- `llm-task`
- `lobster`
- `media-understanding-core`
- `memory-core`
- `memory-lancedb`
- `open-prose`
- `openshell`
- `phone-control`
- `speech-core`
- `synthetic`
- `talk-voice`
- `thread-ownership`
- `voice-call`

### Search and fetch extensions

- `brave`
- `duckduckgo`
- `exa`
- `firecrawl`
- `perplexity`
- `searxng`

### Channel extensions

- `bluebubbles`
- `discord`
- `feishu`
- `googlechat`
- `imessage`
- `irc`
- `line`
- `matrix`
- `mattermost`
- `msteams`
- `nextcloud-talk`
- `nostr`
- `qqbot`
- `signal`
- `slack`
- `synology-chat`
- `telegram`
- `tlon`
- `twitch`
- `whatsapp`
- `zalo`
- `zalouser`

### Model and gateway extensions

- `amazon-bedrock`
- `anthropic`
- `anthropic-vertex`
- `byteplus`
- `cloudflare-ai-gateway`
- `copilot-proxy`
- `deepgram`
- `deepseek`
- `elevenlabs`
- `fal`
- `github-copilot`
- `google`
- `groq`
- `huggingface`
- `kilocode`
- `kimi-coding`
- `litellm`
- `microsoft`
- `microsoft-foundry`
- `minimax`
- `mistral`
- `modelstudio`
- `moonshot`
- `nvidia`
- `ollama`
- `openai`
- `opencode`
- `opencode-go`
- `openrouter`
- `qianfan`
- `sglang`
- `together`
- `venice`
- `vercel-ai-gateway`
- `vllm`
- `volcengine`
- `xai`
- `xiaomi`
- `zai`

## Buccet-normalized acceptance families

These are the capability families that should feed the acceptance side.

### `BUCCET.CAPABILITY.LOCAL.WORKSPACE`

- what it is: local workspace read/write/append/mkdir/move and patch-style coding work
- Buccet action kinds: `fs.read`, `fs.write`, `fs.append`, `fs.mkdir`, `fs.move`
- disposition: `base_candidate`

### `BUCCET.CAPABILITY.LOCAL.EXEC`

- what it is: shell/process/runtime work for coding and workflow commands
- Buccet action kinds: `tool.exec`
- disposition: `scoped_candidate`

### `BUCCET.CAPABILITY.WEB.RESEARCH`

- what it is: browser control, search, fetch, PDF, and research retrieval
- Buccet action kinds: `network.send`, `tool.exec`, `fs.read`, `fs.write`
- disposition: `scoped_candidate`

### `BUCCET.CAPABILITY.MESSAGE.CHANNELS`

- what it is: outbound and interactive delivery across configured chat channels
- Buccet action kinds: `chat.emit`, `comm.send`, `network.send`
- disposition: `channel_candidate`

### `BUCCET.CAPABILITY.CANVAS.NODES.DEVICES`

- what it is: canvas control, paired devices, node actions, and device-side integrations
- Buccet action kinds: `tool.exec`, `network.send`, `sys.config.read`, `sys.config.write`, `chat.emit`
- disposition: `device_candidate`

### `BUCCET.CAPABILITY.MEDIA.PROCESSING`

- what it is: image/audio/video understanding and generation
- Buccet action kinds: `fs.read`, `fs.write`, `network.send`, `tool.exec`
- disposition: `scoped_candidate`

### `BUCCET.CAPABILITY.MEMORY.NOTES.TASKS`

- what it is: memory backends, notes, reminders, and task systems
- Buccet action kinds: `fs.read`, `fs.write`, `db.query`, `db.insert`, `db.update`, `network.send`
- disposition: `scoped_candidate`

### `BUCCET.CAPABILITY.AUTOMATION.SESSIONS`

- what it is: cron, gateway control, sessions, sub-agents, and orchestration
- Buccet action kinds: `tool.exec`, `fs.read`, `fs.write`, `chat.emit`, `network.send`
- disposition: `scoped_candidate`

### `BUCCET.CAPABILITY.MODEL.PROVIDERS`

- what it is: model/provider transport, speech providers, and gateway backends
- Buccet action kinds: `network.send`, `sys.env.read`, `sys.credential.use`
- disposition: `provider_candidate`

### `BUCCET.CAPABILITY.UTILITY.CONNECTORS`

- what it is: smaller connector and utility skills
- Buccet action kinds: `network.send`, `tool.exec`, `fs.read`, `fs.write`, `chat.emit`
- disposition: `scoped_candidate`

## The important rule

This intake does not weaken Buccet.

It only says:

- Buccet bundled capability surfaces are acceptance candidates
- Buccet normalizes them into rails
- the denial constitution still overrides them on overlap

So if a future acceptance rail touches:

- secrets
- delete
- privilege escalation
- system mutation
- exfiltration
- external communication outside allowed recipients/domains

the denial side still wins.

## Source of truth

The structured intake catalog lives in:

- [capability-acceptance-intake.ts](../../src/teams/capability-acceptance-intake.ts)
