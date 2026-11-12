"""Analisis video (atau foto) drone yang diunggah. Diproses di latar belakang; status disimpan di disk
supaya bisa dibaca oleh worker API mana pun."""
from __future__ import annotations

import json
import os
import shutil
import threading
import time
import uuid
from pathlib import Path

import cv2
import numpy as np

from . import vision, vlm
from .scene import CLASS_LABELS, damage_class

MAX_FRAMES = 36
FRAME_W = 960
VIDEO_EXT = {".mp4", ".mov", ".m4v", ".avi", ".mkv", ".webm"}
IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp"}


class UploadError(ValueError):
    """Kesalahan yang ditampilkan ke pengguna; `code` diterjemahkan oleh dasbor."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


def jobs_dir() -> Path:
    return Path(os.environ.get("GLASS_JOBS_DIR", "/tmp/glass-jobs"))


def max_bytes() -> int:
    return int(os.environ.get("GLASS_MAX_UPLOAD_MB", "300")) * 1024 * 1024


def _write(path: Path, data: dict):
    tmp = path.with_suffix(f".{uuid.uuid4().hex[:6]}.tmp")
    tmp.write_text(json.dumps(data, separators=(",", ":")))
    tmp.replace(path)


def job_path(job_id: str) -> Path:
    if not job_id.isalnum() or len(job_id) > 32:
        raise ValueError("ID tugas tidak valid")
    return jobs_dir() / job_id


def status(job_id: str) -> dict:
    p = job_path(job_id) / "job.json"
    if not p.exists():
        raise FileNotFoundError(job_id)
    return json.loads(p.read_text())


def frame_file(job_id: str, i: int, kind: str) -> Path:
    if kind not in ("ai", "raw"):
        raise ValueError("jenis gambar tidak dikenal")
    return job_path(job_id) / "frames" / f"{int(i):03d}-{kind}.jpg"


def create(filename: str, asset_id: str | None, use_vlm: bool, lang: str = "id") -> tuple[str, Path]:
    _prune()
    job_id = uuid.uuid4().hex[:16]
    d = jobs_dir() / job_id
    (d / "frames").mkdir(parents=True, exist_ok=True)
    ext = Path(filename or "video.mp4").suffix.lower()
    if ext not in VIDEO_EXT | IMAGE_EXT:
        ext = ".mp4"
    meta = {"id": job_id, "status": "uploading", "progress": 0.0, "filename": (filename or "")[:120],
            "asset_id": asset_id, "use_vlm": bool(use_vlm), "lang": lang if lang in ("id", "en") else "id",
            "created": time.time(), "frames": [], "result": None, "error": None, "error_code": None}
    _write(d / "job.json", meta)
    return job_id, d / f"source{ext}"


def discard(job_id: str):
    shutil.rmtree(job_path(job_id), ignore_errors=True)


def start(job_id: str, src: Path):
    threading.Thread(target=_run, args=(job_id, src), daemon=True).start()


def _update(job_id: str, **kw) -> dict:
    p = job_path(job_id) / "job.json"
    meta = json.loads(p.read_text())
    meta.update(kw)
    _write(p, meta)
    return meta


def _read_frames(src: Path):
    """Ambil maksimal MAX_FRAMES gambar yang tersebar rata di sepanjang video (±1 per detik)."""
    if src.suffix.lower() in IMAGE_EXT:
        img = cv2.imread(str(src), cv2.IMREAD_COLOR)
        if img is None:
            raise UploadError("unreadable_image", "Foto tidak bisa dibaca")
        yield 0.0, img
        return
    cap = cv2.VideoCapture(str(src))
    if not cap.isOpened():
        raise UploadError("unreadable_video", "Video tidak bisa dibuka. Coba format MP4 (H.264).")
    fps = cap.get(cv2.CAP_PROP_FPS) or 0
    n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    dur = n / fps if fps > 0 and n > 0 else 0
    if dur <= 0:
        k, step = 0, 15
        while k < MAX_FRAMES:
            ok, img = cap.read()
            if not ok:
                break
            if k % step == 0:
                yield k / 30.0, img
            k += 1
        cap.release()
        return
    count = int(min(MAX_FRAMES, max(6, round(dur))))
    for t in np.linspace(0, dur, count + 2)[1:-1]:
        cap.set(cv2.CAP_PROP_POS_MSEC, float(t) * 1000)
        ok, img = cap.read()
        if ok and img is not None:
            yield float(t), img
    cap.release()


def _run(job_id: str, src: Path):
    try:
        meta = _update(job_id, status="running", progress=0.02)
        frames = []
        out_dir = job_path(job_id) / "frames"
        plan = list(_read_frames(src))
        if not plan:
            raise UploadError("no_frames", "Tidak ada gambar yang bisa dibaca dari file ini")
        for i, (t, bgr) in enumerate(plan):
            h, w = bgr.shape[:2]
            if w > FRAME_W:
                bgr = cv2.resize(bgr, (FRAME_W, int(round(h * FRAME_W / w))), interpolation=cv2.INTER_AREA)
            rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
            r = vision.analyze_frame(rgb)
            overlay = r.pop("_overlay")
            (out_dir / f"{i:03d}-raw.jpg").write_bytes(vision.jpeg(rgb, 82))
            (out_dir / f"{i:03d}-ai.jpg").write_bytes(vision.jpeg(overlay, 82))
            frames.append({"i": i, "t": round(t, 2), "w": rgb.shape[1], "h": rgb.shape[0], **r,
                           "label": CLASS_LABELS[r["cls"]], "vlm": None})
            if i % 3 == 0 or i == len(plan) - 1:
                _update(job_id, progress=round(0.05 + 0.75 * (i + 1) / len(plan), 3), frames=frames)

        vlm_note, vlm_status = None, "off"
        if meta.get("use_vlm") and vlm.config()["enabled"]:
            vlm_status = "ok"
            picks = sorted(range(len(frames)), key=lambda k: -frames[k]["damage"])[:4]
            for j, k in enumerate(sorted(picks)):
                try:
                    frames[k]["vlm"] = vlm.ask((out_dir / f"{k:03d}-raw.jpg").read_bytes(), meta.get("lang", "id"))
                except vlm.VlmError as e:
                    vlm_note, vlm_status = str(e), "error"
                    break
                _update(job_id, progress=round(0.8 + 0.18 * (j + 1) / len(picks), 3), frames=frames)
        elif meta.get("use_vlm"):
            vlm_status = "disabled"
            vlm_note = "VLM belum diaktifkan di server, jadi hanya analisis visi komputer yang dipakai."

        usable = [f for f in frames if f["built"] >= 0.06] or frames
        cv_damage = float(np.median([f["damage"] for f in usable]))
        vl = [f["vlm"]["damage_pct"] / 100 for f in frames if f.get("vlm")]
        damage = float(np.median(vl)) if vl else cv_damage
        cls = damage_class(damage)
        summaries = [f["vlm"]["summary"] for f in frames if f.get("vlm") and f["vlm"].get("summary")]
        result = {
            "damage": round(damage, 4), "cls": cls, "label": CLASS_LABELS[cls],
            "method": "vlm+cv" if vl else "cv",
            "cv_damage": round(cv_damage, 4), "vlm_damage": round(float(np.median(vl)), 4) if vl else None,
            "water": round(float(np.median([f["water"] for f in usable])), 4),
            "frames_used": len(usable), "frames": len(frames),
            "summary": summaries[0] if summaries else None, "vlm_note": vlm_note, "vlm_status": vlm_status,
            "d_surf": round(damage, 4),
        }
        _update(job_id, status="done", progress=1.0, frames=frames, result=result)
    except Exception as e:  # noqa: BLE001 — pesan dikirim ke pengguna
        _update(job_id, status="error", error=str(e)[:300], error_code=getattr(e, "code", "failed"))
    finally:
        try:
            src.unlink(missing_ok=True)
        except OSError:
            pass


def _prune(keep: int = 40, max_age_s: float = 6 * 3600):
    root = jobs_dir()
    if not root.exists():
        return
    try:
        dirs = sorted((d for d in root.iterdir() if d.is_dir()), key=lambda d: d.stat().st_mtime, reverse=True)
        now = time.time()
        for k, d in enumerate(dirs):
            if k >= keep or now - d.stat().st_mtime > max_age_s:
                shutil.rmtree(d, ignore_errors=True)
    except OSError:
        pass
