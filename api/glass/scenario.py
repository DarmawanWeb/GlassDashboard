"""Skenario contoh (sintetis) yang meniru pola kerusakan Palu 2018.

Kerusakan dibuat lebih parah di dekat pantai (tsunami), dekat jejak sesar, dan di area
likuefaksi. Ini BUKAN data kerusakan asli — gunanya menunjukkan alur GLASS berjalan.
Untuk data asli, lihat glass/sources.py (GLASS_ASSETS_FILE).
"""
from __future__ import annotations

import math

import numpy as np

from .geo import local_km, palu, polyline_distance_km
from .params import ASSET_TYPES, ScenarioParams

TYPE_IDS = list(ASSET_TYPES)
TYPE_PREFIX = {"sekolah": "SKL", "puskesmas": "PKM", "kantor": "KTR", "jembatan": "JBT"}


def mmi_model(d_fault_km, d_coast_km):
    """Intensitas guncangan (MMI) tanpa derau: kuat di dekat sesar, sedikit naik di endapan pantai."""
    return 7.1 + 1.7 * np.exp(-np.asarray(d_fault_km) / 2.5) + 0.3 * np.exp(-np.asarray(d_coast_km) / 1.5)


def _settlement_weight(c: np.ndarray) -> np.ndarray:
    lon, lat = c[:, 0], c[:, 1]
    core = np.exp(-((lat + 0.897) / 0.032) ** 2 - ((lon - 119.866) / 0.034) ** 2)
    strip = 0.45 * np.exp(-c[:, 2] / 0.6) * (lat > -0.862)
    return core + strip + 0.02


def generate_assets(p: ScenarioParams) -> list[dict]:
    rng = np.random.default_rng(p.seed)
    c = palu()["candidates"]
    w = _settlement_weight(c)
    n = int(min(max(p.n_assets, 20), 1200))
    idx = rng.choice(len(c), size=n, replace=False, p=w / w.sum())
    pts = c[idx]
    lon, lat, d_coast, d_fault, liq = pts.T

    shares = np.array([ASSET_TYPES[t]["share"] for t in TYPE_IDS])
    types = rng.choice(TYPE_IDS, size=n, p=shares / shares.sum())
    lo = np.array([ASSET_TYPES[t]["si_range"][0] for t in types])
    hi = np.array([ASSET_TYPES[t]["si_range"][1] for t in types])
    si = np.round(rng.uniform(lo, hi) / 1e8) * 1e8                    # dibulatkan ke Rp 100 juta

    tsunami = np.exp(-d_coast / 0.35)                                 # dampak terbesar < ±500 m dari pantai
    fault = np.exp(-d_fault / 1.1)
    shaking = (mmi_model(d_fault, d_coast) - 7.1) / 2.0               # guncangan umum di seluruh kota
    base = np.clip(1.0 * tsunami + 0.38 * fault + 1.0 * liq + 0.5 * shaking + rng.normal(0, 0.13, n), 0, 1)

    surf_class = np.digitize(base + rng.normal(0, 0.05, n), [0.24, 0.47, 0.72])   # 0..3 (gaya xBD)
    d_surf = surf_class / 3
    d_vol = np.clip(0.80 * base + 0.30 * liq + rng.normal(0, 0.07, n), 0, 1)
    d_water = np.clip(0.95 * tsunami + 0.30 * liq + rng.normal(0, 0.04, n), 0, 1)
    mmi = np.clip(mmi_model(d_fault, d_coast) + rng.normal(0, 0.25, n), 6.0, 9.6)

    counters = {t: 0 for t in TYPE_IDS}
    assets = []
    order = np.argsort(-lat)                                          # nomor urut dari utara ke selatan
    for i in order:
        t = str(types[i])
        counters[t] += 1
        assets.append({
            "id": f"{TYPE_PREFIX[t]}-{counters[t]:03d}",
            "type": t,
            "lon": round(float(lon[i]), 5),
            "lat": round(float(lat[i]), 5),
            "sum_insured": float(si[i]),
            "d_vol": round(float(d_vol[i]), 3),
            "d_surf": round(float(d_surf[i]), 3),
            "d_water": round(float(d_water[i]), 3),
            "mmi": round(float(mmi[i]), 2),
            "d_coast_km": round(float(d_coast[i]), 2),
            "observed": True,
        })
    return assets


def _ellipse(cx, cy, rx_km, ry_km, rot, scale=1.0, n=40):
    k = math.cos(math.radians(cy))
    t = np.linspace(0, 2 * math.pi, n, endpoint=False)
    x, y = rx_km * scale * np.cos(t), ry_km * scale * np.sin(t)
    xr = x * math.cos(rot) - y * math.sin(rot)
    yr = x * math.sin(rot) + y * math.cos(rot)
    # sedikit "berombak" supaya terlihat seperti awan
    wobble = 1 + 0.10 * np.sin(3 * t + rot) + 0.06 * np.sin(5 * t)
    lon = cx + xr * wobble / (111.32 * k)
    lat = cy + yr * wobble / 111.32
    ring = [[round(float(a), 5), round(float(b), 5)] for a, b in zip(lon, lat)]
    return ring + [ring[0]]


def add_clouds(assets: list[dict], p: ScenarioParams) -> list[dict]:
    """Tambah awan acak sampai porsi aset tertutup mendekati target; tandai aset di bawahnya."""
    target = float(np.clip(p.cloud_cover, 0, 0.5))
    if target <= 0 or not assets:
        return []
    rng = np.random.default_rng(p.seed + 101)
    lon = np.array([a["lon"] for a in assets])
    lat = np.array([a["lat"] for a in assets])
    ax, ay = local_km(lon, lat)
    covered = np.zeros(len(assets), dtype=bool)
    clouds = []
    for _ in range(40):
        if covered.mean() >= target:
            break
        j = rng.integers(len(assets))
        cx, cy = lon[j] + rng.normal(0, 0.004), lat[j] + rng.normal(0, 0.004)
        rx, ry, rot = rng.uniform(0.45, 1.1), rng.uniform(0.3, 0.75), rng.uniform(0, math.pi)
        ex, ey = local_km(np.array([cx]), np.array([cy]))
        dx, dy = ax - ex[0], ay - ey[0]
        u = (dx * math.cos(rot) + dy * math.sin(rot)) / rx
        v = (-dx * math.sin(rot) + dy * math.cos(rot)) / ry
        inside = (u * u + v * v) <= 0.85
        if covered.mean() + (inside & ~covered).mean() > target + 0.04 and covered.any():
            continue                                                  # awan ini terlalu besar, coba lagi
        covered |= inside
        clouds.append({"rings": [_ellipse(cx, cy, rx, ry, rot, s) for s in (1.0, 0.78, 0.55)]})
    for a, cov in zip(assets, covered):
        a["observed"] = not bool(cov)
    return clouds


def mmi_field(step: float = 0.003) -> dict:
    """Grid MMI deterministik untuk peta guncangan & garis ambang."""
    g = palu()
    x0, y0, x1, y1 = g["bbox"]
    xs = np.arange(x0, x1 + 1e-9, step)
    ys = np.arange(y0, y1 + 1e-9, step)
    X, Y = np.meshgrid(xs, ys)
    d_fault = polyline_distance_km(X.ravel(), Y.ravel(), g["fault"]).reshape(X.shape)
    d_coast = np.min([polyline_distance_km(X.ravel(), Y.ravel(), line) for line in g["coast"]], axis=0)
    return {"xs": xs, "ys": ys, "mmi": mmi_model(d_fault, d_coast.reshape(X.shape))}
