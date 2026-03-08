#!/usr/bin/env python3
import json
import os
import subprocess
import sys
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Dict, List

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer


MODEL_NAME = os.environ.get("GPT2_MODEL_NAME", "gpt2")
HOST = os.environ.get("GPT2_HOST", "127.0.0.1")
PORT = int(os.environ.get("GPT2_PORT", "8009"))
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"


print(f"[gpt2-service] loading model={MODEL_NAME} device={DEVICE}", flush=True)
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
if tokenizer.pad_token_id is None and tokenizer.eos_token_id is not None:
    tokenizer.pad_token_id = tokenizer.eos_token_id
model = AutoModelForCausalLM.from_pretrained(MODEL_NAME)
model.to(DEVICE)
model.eval()
print("[gpt2-service] model ready", flush=True)


def _cut_at_stops(text: str, stops: List[str]) -> str:
    out = text
    for stop in stops:
        if not stop:
            continue
        idx = out.find(stop)
        if idx >= 0:
            out = out[:idx]
    return out.strip()


def generate(payload: Dict[str, Any]) -> Dict[str, Any]:
    prompt = str(payload.get("prompt", "")).strip()
    if not prompt:
        return {"text": "", "error": "missing_prompt"}

    max_new_tokens = int(payload.get("max_new_tokens", 220))
    max_new_tokens = max(1, min(max_new_tokens, 512))
    min_new_tokens = int(payload.get("min_new_tokens", 1))
    min_new_tokens = max(1, min(min_new_tokens, max_new_tokens))
    temperature = float(payload.get("temperature", 0.8))
    top_p = float(payload.get("top_p", 0.92))
    do_sample = bool(payload.get("do_sample", True))
    repetition_penalty = float(payload.get("repetition_penalty", 1.0))
    no_repeat_ngram_size = int(payload.get("no_repeat_ngram_size", 0))
    stop_strings = payload.get("stop_strings", []) or []
    if not isinstance(stop_strings, list):
        stop_strings = []

    inputs = tokenizer(prompt, return_tensors="pt")
    input_ids = inputs["input_ids"].to(DEVICE)
    attention_mask = inputs.get("attention_mask")
    if attention_mask is not None:
        attention_mask = attention_mask.to(DEVICE)

    with torch.no_grad():
        output_ids = model.generate(
            input_ids=input_ids,
            attention_mask=attention_mask,
            max_new_tokens=max_new_tokens,
            min_new_tokens=min_new_tokens,
            do_sample=do_sample,
            temperature=temperature,
            top_p=top_p,
            repetition_penalty=repetition_penalty,
            no_repeat_ngram_size=no_repeat_ngram_size,
            pad_token_id=tokenizer.pad_token_id,
            eos_token_id=tokenizer.eos_token_id,
        )

    generated_ids = output_ids[0][input_ids.shape[1]:]
    text = tokenizer.decode(generated_ids, skip_special_tokens=True).strip()
    text = _cut_at_stops(text, stop_strings)
    return {"text": text}


def validate_python(payload: Dict[str, Any]) -> Dict[str, Any]:
    code = str(payload.get("code", ""))
    if not code.strip():
        return {"ok": False, "error": "empty_code"}
    try:
        import ast

        ast.parse(code)
        return {"ok": True}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc)}


def validate_python_runtime(payload: Dict[str, Any]) -> Dict[str, Any]:
    code = str(payload.get("code", "") or "")
    tests = str(payload.get("tests", "") or "")
    if not code.strip():
        return {"ok": False, "error": "empty_code"}

    # Build one-shot script with user code + optional tests.
    script = code
    if tests.strip():
        script += "\n\n# ---- tests ----\n" + tests + "\n"

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile("w", suffix=".py", delete=False) as f:
            tmp_path = f.name
            f.write(script)

        proc = subprocess.run(
            [sys.executable, tmp_path],
            capture_output=True,
            text=True,
            timeout=3.0,
            check=False,
        )
        if proc.returncode != 0:
            err = (proc.stderr or proc.stdout or "runtime_failed").strip()
            return {"ok": False, "error": err[:500]}
        return {"ok": True}
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": "runtime_timeout"}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc)}
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except Exception:
                pass


class Handler(BaseHTTPRequestHandler):
    def _send(self, code: int, body: Dict[str, Any]) -> None:
        data = json.dumps(body).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/health":
            self._send(200, {"ok": True, "model": MODEL_NAME, "device": DEVICE})
            return
        self._send(404, {"error": "not_found"})

    def do_POST(self) -> None:  # noqa: N802
        if self.path not in {"/generate", "/validate_python", "/validate_python_runtime"}:
            self._send(404, {"error": "not_found"})
            return
        try:
            content_len = int(self.headers.get("Content-Length", "0"))
            raw = self.rfile.read(content_len)
            payload = json.loads(raw.decode("utf-8") or "{}")
            if self.path == "/generate":
                result = generate(payload)
            elif self.path == "/validate_python_runtime":
                result = validate_python_runtime(payload)
            else:
                result = validate_python(payload)
            self._send(200, result)
        except Exception as exc:  # noqa: BLE001
            self._send(500, {"error": str(exc)})


if __name__ == "__main__":
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"[gpt2-service] listening on http://{HOST}:{PORT}", flush=True)
    server.serve_forever()
