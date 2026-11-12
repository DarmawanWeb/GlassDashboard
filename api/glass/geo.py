"""Data geografis Palu (dibangun oleh tools/build_geo.py) + utilitas jarak."""
from __future__ import annotations

import json
import math
from functools import lru_cache
from pathlib import Path

import numpy as np

DATA = Path(__file__).parent / "data" / "palu_geo.json"
KM_PER_DEG = 111.32


@lru_cache(maxsize=1)
def palu() -> dict:
    g = json.loads(DATA.read_text())
    g["candidates"] = np.asarray(g["candidates"], dtype=float)   # lon, lat, d_coast, d_fault, liq
    return g


def overlays() -> dict:
    g = palu()
    return {k: g[k] for k in ("bbox", "center", "epicenter", "fault", "liquefaction", "coast", "source")}


def local_km(lon: np.ndarray, lat: np.ndarray, lat0: float = -0.9) -> tuple[np.ndarray, np.ndarray]:
    """Proyeksi sederhana derajat -> km (cukup akurat untuk skala satu kota)."""
    k = math.cos(math.radians(lat0))
    return np.asarray(lon) * KM_PER_DEG * k, np.asarray(lat) * KM_PER_DEG


def polyline_distance_km(lon: np.ndarray, lat: np.ndarray, line: list[list[float]]) -> np.ndarray:
    """Jarak terdekat titik-titik ke polyline (km)."""
    px, py = local_km(lon, lat)
    pts = np.asarray(line, dtype=float)
    ax, ay = local_km(pts[:-1, 0], pts[:-1, 1])
    bx, by = local_km(pts[1:, 0], pts[1:, 1])
    px, py = px[..., None], py[..., None]
    dx, dy = bx - ax, by - ay
    t = np.clip(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy), 0, 1)
    d = np.hypot(px - (ax + t * dx), py - (ay + t * dy))
    return d.min(axis=-1)


def nearest(src_lon, src_lat, dst_lon, dst_lat, k: int) -> tuple[np.ndarray, np.ndarray]:
    """Indeks & jarak (km) k tetangga terdekat di dst untuk setiap titik src."""
    sx, sy = local_km(src_lon, src_lat)
    dx, dy = local_km(dst_lon, dst_lat)
    d = np.hypot(sx[:, None] - dx[None, :], sy[:, None] - dy[None, :])
    idx = np.argsort(d, axis=1)[:, :k]
    return idx, np.take_along_axis(d, idx, axis=1)
