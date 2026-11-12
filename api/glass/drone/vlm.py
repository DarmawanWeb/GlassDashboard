"""VLM opsional (vision-language model): "membaca" foto drone dan menjelaskan kerusakan dengan kalimat.

Mati secara bawaan. Aktifkan lewat env:
  GLASS_VLM_PROVIDER  ollama | openai | anthropic
  GLASS_VLM_URL       ollama:    http://host.docker.internal:11434 (Ollama di Mac, di luar Docker)
                      openai:    https://api.openai.com/v1 (atau server lain yang kompatibel: LM Studio, vLLM, dll.)
                      anthropic: https://api.anthropic.com
  GLASS_VLM_MODEL     ollama bawaan qwen3-vl:2b, anthropic bawaan claude-haiku-5-5, openai wajib diisi
  GLASS_VLM_API_KEY   untuk openai / anthropic
  GLASS_VLM_TIMEOUT   detik, bawaan 90
"""
from __future__ import annotations

import base64
import json
import os
import re
import time
import urllib.error
import urllib.request

PROMPT = """You are a post-disaster building damage assessor. This is an aerial drone photo taken after an
earthquake and tsunami. Assess the visible buildings. Reply with ONLY one JSON object with these keys:
"kelas": one of "tidak_rusak", "ringan", "berat", "hancur" (damage of the main building in the photo),
"persen_kerusakan": integer 0-100 (share of building area that is damaged),
"genangan_persen": integer 0-100 (share of ground covered by water or mud),
"bangunan_terlihat": integer (number of buildings visible),
"objek": list of up to 5 notable things, in Indonesian,
"ringkasan": one or two short sentences in Indonesian about roofs, debris, road access and flooding."""

CLASSES = {"tidak_rusak": 0, "tidak rusak": 0, "no-damage": 0, "no_damage": 0, "none": 0,
           "ringan": 1, "minor": 1, "minor-damage": 1,
           "berat": 2, "major": 2, "major-damage": 2, "sedang": 1,
           "hancur": 3, "destroyed": 3, "total": 3}
DEFAULTS = {
    "ollama": ("http://host.docker.internal:11434", "qwen3-vl:2b"),
    "openai": ("https://api.openai.com/v1", ""),
    "anthropic": ("https://api.anthropic.com", "claude-haiku-5-5"),
}


class VlmError(RuntimeError):
    pass


def config() -> dict:
    prov = os.environ.get("GLASS_VLM_PROVIDER", "").strip().lower()
    if prov not in DEFAULTS:
        return {"enabled": False, "provider": "", "model": "", "url": ""}
    url, model = DEFAULTS[prov]
    url = os.environ.get("GLASS_VLM_URL", "").strip() or url
    model = os.environ.get("GLASS_VLM_MODEL", "").strip() or model
    return {"enabled": bool(model), "provider": prov, "model": model, "url": url.rstrip("/")}


def _post(url: str, body: dict, headers: dict, timeout: float) -> dict:
    req = urllib.request.Request(url, data=json.dumps(body).encode(), method="POST",
                                 headers={"content-type": "application/json", **headers})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")[:300]
        raise VlmError(f"VLM menjawab HTTP {e.code}: {detail}") from e
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        raise VlmError(f"VLM tidak bisa dihubungi di {url}: {e}") from e


def parse(text: str) -> dict:
    m = re.search(r"\{.*\}", text or "", re.S)
    if not m:
        raise VlmError("Jawaban VLM bukan JSON")
    try:
        raw = json.loads(m.group(0))
    except ValueError as e:
        raise VlmError("Jawaban VLM bukan JSON yang valid") from e

    def num(k, lo=0, hi=100):
        try:
            return int(min(max(float(raw.get(k, 0)), lo), hi))
        except (TypeError, ValueError):
            return 0

    kelas = str(raw.get("kelas", "")).strip().lower().replace(" ", "_")
    cls = CLASSES.get(kelas, CLASSES.get(kelas.replace("_", " ")))
    pct = num("persen_kerusakan")
    if cls is None:
        cls = 0 if pct < 10 else 1 if pct < 39 else 2 if pct < 72 else 3
    objek = raw.get("objek", [])
    if not isinstance(objek, list):
        objek = [str(objek)]
    return {
        "cls": cls, "damage_pct": pct, "water_pct": num("genangan_persen"),
        "buildings": num("bangunan_terlihat", 0, 999), "objects": [str(o)[:40] for o in objek[:5]],
        "summary": str(raw.get("ringkasan", "")).strip()[:400],
    }


def ask(jpeg: bytes, prompt: str = PROMPT) -> dict:
    cfg = config()
    if not cfg["enabled"]:
        raise VlmError("VLM belum diaktifkan (GLASS_VLM_PROVIDER kosong)")
    b64 = base64.b64encode(jpeg).decode()
    timeout = float(os.environ.get("GLASS_VLM_TIMEOUT", "90"))
    key = os.environ.get("GLASS_VLM_API_KEY", "")
    t0 = time.perf_counter()
    prov, url, model = cfg["provider"], cfg["url"], cfg["model"]
    if prov == "ollama":
        body = {"model": model, "stream": False, "format": "json", "think": False, "options": {"temperature": 0.1},
                "messages": [{"role": "user", "content": prompt, "images": [b64]}]}
        try:
            out = _post(f"{url}/api/chat", body, {}, timeout)
        except VlmError as e:
            if "think" not in str(e):
                raise
            body.pop("think")
            out = _post(f"{url}/api/chat", body, {}, timeout)
        text = out.get("message", {}).get("content", "")
    elif prov == "openai":
        body = {"model": model, "temperature": 0.1, "max_tokens": 400,
                "messages": [{"role": "user", "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}}]}]}
        out = _post(f"{url}/chat/completions", body, {"authorization": f"Bearer {key}"} if key else {}, timeout)
        text = (out.get("choices") or [{}])[0].get("message", {}).get("content", "")
    else:
        body = {"model": model, "max_tokens": 400,
                "messages": [{"role": "user", "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": b64}},
                    {"type": "text", "text": prompt}]}]}
        out = _post(f"{url}/v1/messages", body, {"x-api-key": key, "anthropic-version": "2023-06-01"}, timeout)
        text = "".join(b.get("text", "") for b in out.get("content", []) if b.get("type") == "text")
    res = parse(text)
    res.update({"provider": prov, "model": model, "ms": round((time.perf_counter() - t0) * 1000)})
    return res
