"""Misi drone: pilih aset target, susun rute terbang, lalu pindai tiap aset (render + analisis).

Hasil pindaian disimpan di cache disk (GLASS_CACHE_DIR) supaya semua worker API bisa memakainya
dan gambar tidak dibuat ulang.
"""
from __future__ import annotations

import json
import math
import os
import re
import shutil
import threading
import time
import uuid
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from ..geo import local_km
from ..params import ScenarioParams
from ..sdsi import sdsi
from . import vision
from .render import render_scene
from .scene import CLASS_LABELS, GSD, PATCH_H_M, PATCH_W_M, H, W

KINDS = ("pre", "rgb", "lidar", "thermal", "ai")
_SAFE = re.compile(r"^[A-Za-z0-9_.-]{1,40}$")
_locks: dict[str, threading.Lock] = {}
_locks_guard = threading.Lock()


@dataclass(frozen=True)
class FlightParams:
    speed_ms: float = 12.0          # kecepatan jelajah
    altitude_m: float = 60.0        # tinggi terbang
    hover_s: float = 35.0           # waktu memindai satu aset (foto, LiDAR, termal)
    battery_min: float = 35.0       # waktu terbang per baterai
    swap_min: float = 6.0           # ganti baterai
    overhead_min: float = 4.0       # lepas landas, kalibrasi, mendarat


FLIGHT = FlightParams()


def cache_dir() -> Path:
    return Path(os.environ.get("GLASS_CACHE_DIR", "/tmp/glass-cache"))


def scenario_key(p: ScenarioParams) -> str:
    return f"s{p.seed}-n{p.n_assets}-c{int(round(p.cloud_cover * 100)):02d}"


def parse_key(key: str) -> ScenarioParams:
    m = re.fullmatch(r"s(\d{1,6})-n(\d{2,4})-c(\d{2})", key)
    if not m:
        raise ValueError("kunci skenario tidak valid")
    return ScenarioParams(int(m.group(1)), int(m.group(2)), int(m.group(3)) / 100)


def safe_id(asset_id: str) -> str:
    if not _SAFE.match(asset_id):
        raise ValueError("ID aset tidak valid")
    return asset_id


# ---------------------------------------------------------------- rencana misi
def _sat_sdsi(a: dict) -> float:
    return sdsi(a["type"], a["d_vol"], a["d_surf"], a["d_water"])["sdsi"]


def select_targets(assets: list[dict], max_targets: int) -> list[tuple[dict, str]]:
    """Prioritas: aset yang fotonya tertutup awan, lalu aset rusak berat (SDSI satelit > 0,5)."""
    hidden = sorted((a for a in assets if not a["observed"]), key=lambda a: -a["sum_insured"])
    severe = sorted((a for a in assets if a["observed"] and _sat_sdsi(a) > 0.5),
                    key=lambda a: -a["sum_insured"] * _sat_sdsi(a))
    picks = [(a, "awan") for a in hidden] + [(a, "berat") for a in severe]
    return picks[:max(1, max_targets)]


def _route(base: tuple[float, float], pts: np.ndarray) -> list[int]:
    """Urutan kunjungan: tetangga terdekat lalu dirapikan dengan 2-opt."""
    n = len(pts)
    if n <= 1:
        return list(range(n))
    allp = np.vstack([np.array(base)[None], pts])
    d = np.hypot(allp[:, None, 0] - allp[None, :, 0], allp[:, None, 1] - allp[None, :, 1])
    order, left = [0], set(range(1, n + 1))
    while left:
        cur = order[-1]
        nxt = min(left, key=lambda j: d[cur, j])
        order.append(nxt)
        left.remove(nxt)
    order.append(0)
    improved, guard = True, 0
    while improved and guard < 60:
        improved, guard = False, guard + 1
        for i in range(1, len(order) - 2):
            for j in range(i + 1, len(order) - 1):
                a, b, c, e = order[i - 1], order[i], order[j], order[j + 1]
                if d[a, c] + d[b, e] < d[a, b] + d[c, e] - 1e-9:
                    order[i:j + 1] = order[i:j + 1][::-1]
                    improved = True
    return [k - 1 for k in order[1:-1]]


def plan(assets: list[dict], center: tuple[float, float], max_targets: int, f: FlightParams = FLIGHT) -> dict:
    picks = select_targets(assets, max_targets)
    base = {"lon": center[0], "lat": center[1], "name": "Posko drone (contoh)"}
    if not picks:
        return {"base": base, "targets": [], "route": [], "stats": {"n_targets": 0}, "camera": camera()}
    lon = np.array([a["lon"] for a, _ in picks])
    lat = np.array([a["lat"] for a, _ in picks])
    x, y = local_km(lon, lat)
    bx, by = local_km(np.array([center[0]]), np.array([center[1]]))
    order = _route((float(bx[0]), float(by[0])), np.stack([x, y], 1))

    targets, cum, prev = [], 0.0, (float(bx[0]), float(by[0]))
    t_min = f.overhead_min / 2
    for k, i in enumerate(order):
        a, reason = picks[i]
        leg = math.hypot(x[i] - prev[0], y[i] - prev[1])
        cum += leg
        t_min += leg * 1000 / f.speed_ms / 60
        targets.append({"id": a["id"], "type": a["type"], "lon": a["lon"], "lat": a["lat"], "reason": reason,
                        "order": k + 1, "leg_km": round(leg, 3), "cum_km": round(cum, 3), "eta_min": round(t_min, 1)})
        t_min += f.hover_s / 60
        prev = (float(x[i]), float(y[i]))
    back = math.hypot(prev[0] - bx[0], prev[1] - by[0])
    total_km = cum + back
    flight_min = total_km * 1000 / f.speed_ms / 60 + len(targets) * f.hover_s / 60 + f.overhead_min
    batteries = max(1, math.ceil(flight_min / f.battery_min))
    route = [[center[0], center[1]]] + [[t["lon"], t["lat"]] for t in targets] + [[center[0], center[1]]]
    return {
        "base": base,
        "targets": targets,
        "route": route,
        "stats": {
            "n_targets": len(targets),
            "n_cloud": sum(1 for t in targets if t["reason"] == "awan"),
            "n_severe": sum(1 for t in targets if t["reason"] == "berat"),
            "distance_km": round(total_km, 2),
            "flight_min": round(flight_min, 1),
            "total_min": round(flight_min + (batteries - 1) * f.swap_min, 1),
            "batteries": batteries,
            "speed_ms": f.speed_ms, "altitude_m": f.altitude_m, "hover_s": f.hover_s, "battery_min": f.battery_min,
        },
        "camera": camera(),
    }


def camera() -> dict:
    return {"w": W, "h": H, "gsd_m": GSD, "footprint_m": [PATCH_W_M, PATCH_H_M], "gsd_target_cm": 2,
            "lidar_range": list(vision.LIDAR_RANGE), "thermal_range": list(vision.THERMAL_RANGE)}


# ---------------------------------------------------------------- pindai satu aset (dengan cache disk)
def _lock(key: str) -> threading.Lock:
    with _locks_guard:
        return _locks.setdefault(key, threading.Lock())


def scan_path(p: ScenarioParams, asset_id: str) -> Path:
    return cache_dir() / scenario_key(p) / safe_id(asset_id)


def scan(p: ScenarioParams, asset: dict) -> dict:
    """Render tiga sensor + analisis AI untuk satu aset. Hasil dibaca dari cache bila sudah ada."""
    path = scan_path(p, asset["id"])
    res = path / "result.json"
    if res.exists():
        try:
            return json.loads(res.read_text())
        except (OSError, ValueError):
            pass
    with _lock(str(path)):
        if res.exists():
            return json.loads(res.read_text())
        t0 = time.perf_counter()
        sc = render_scene(asset, p.seed)
        out = vision.analyze_scene(sc)
        overlay = out.pop("_overlay")
        images = {
            "pre": vision.jpeg(sc.rgb_pre), "rgb": vision.jpeg(sc.rgb_post), "ai": vision.jpeg(overlay),
            "lidar": vision.jpeg(vision.lidar_rgb(sc.h_post)), "thermal": vision.jpeg(vision.thermal_rgb(sc.t_post)),
        }
        e = out["estimate"]
        sat = sdsi(asset["type"], asset["d_vol"], asset["d_surf"], asset["d_water"])
        drone = sdsi(asset["type"], e["d_vol"], e["d_surf"], e["d_water"], source="drone")
        result = {
            "id": asset["id"], "type": asset["type"], "lon": asset["lon"], "lat": asset["lat"],
            **out,
            "truth": {k: (round(v, 4) if isinstance(v, float) else v) for k, v in sc.truth.items()},
            "truth_label": CLASS_LABELS[sc.truth["cls"]],
            "sdsi_satellite": sat["sdsi"], "sdsi_drone": drone["sdsi"], "zone_drone": drone["zone"],
            "observed_by_satellite": bool(asset["observed"]),
            "info": sc.info,
            "image": {"w": W, "h": H},
            "ms": round((time.perf_counter() - t0) * 1000),
        }
        tmp = path.parent / f".{path.name}.{uuid.uuid4().hex[:8]}"
        tmp.mkdir(parents=True, exist_ok=True)
        for k, b in images.items():
            (tmp / f"{k}.jpg").write_bytes(b)
        (tmp / "result.json").write_text(json.dumps(result, separators=(",", ":")))
        try:
            if path.exists():
                shutil.rmtree(tmp, ignore_errors=True)
            else:
                tmp.rename(path)
        except OSError:
            shutil.rmtree(tmp, ignore_errors=True)
        _maybe_prune()
        return result


def view(p: ScenarioParams, asset: dict, kind: str) -> bytes:
    if kind not in KINDS:
        raise ValueError("jenis gambar tidak dikenal")
    f = scan_path(p, asset["id"]) / f"{kind}.jpg"
    if not f.exists():
        scan(p, asset)
    return f.read_bytes()


def _maybe_prune(budget: int = 900):
    """Batasi ukuran cache: hapus skenario paling lama bila jumlah aset tersimpan melebihi anggaran."""
    if np.random.random() > 0.08:
        return
    root = cache_dir()
    try:
        groups = sorted((d for d in root.iterdir() if d.is_dir()), key=lambda d: d.stat().st_mtime)
        total = sum(len(list(d.iterdir())) for d in groups)
        while total > budget and len(groups) > 1:
            g = groups.pop(0)
            total -= len(list(g.iterdir()))
            shutil.rmtree(g, ignore_errors=True)
    except OSError:
        pass


def accuracy(results: list[dict]) -> dict:
    """Ketepatan AI dibanding kondisi sebenarnya di dunia simulasi."""
    if not results:
        return {"n": 0}
    t = np.array([r["truth"]["cls"] for r in results])
    e = np.array([r["estimate"]["cls"] for r in results])
    conf = np.zeros((4, 4), int)
    for a, b in zip(t, e, strict=True):
        conf[a, b] += 1
    mae = lambda k: float(np.mean([abs(r["truth"][k] - r["estimate"][k]) for r in results]))  # noqa: E731
    return {"n": len(results), "class_acc": float((t == e).mean()), "within_one": float((abs(t - e) <= 1).mean()),
            "mae_roof": mae("roof"), "mae_vol": mae("vol"), "mae_wet": mae("wet"), "confusion": conf.tolist()}
