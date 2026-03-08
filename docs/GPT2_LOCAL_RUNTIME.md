# GPT-2 Local Runtime (Option 1)

This demo now expects a local Python GPT-2 service for live generation.

## 1) Install Python deps

```bash
cd /Users/ryangatoloai-faupula/lml_demo
npm run gpt2:deps
```

## 2) Start GPT-2 service

```bash
cd /Users/ryangatoloai-faupula/lml_demo
npm run gpt2:serve
```

Default endpoint: `http://127.0.0.1:8009`

## 3) Start demo app

```bash
cd /Users/ryangatoloai-faupula/lml_demo
npm run dev
```

## Optional env vars

- `GPT2_PY_URL` (default `http://127.0.0.1:8009`)
- `GPT2_TIMEOUT_MS` (default `15000`)
- `GPT2_MODEL_NAME` (default `gpt2`) for Python service
- `GPT2_HOST` / `GPT2_PORT` for Python service bind
