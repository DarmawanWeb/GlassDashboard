"""SDSI — Spatial Damage Severity Index: skor kerusakan 0..1 per aset."""
from __future__ import annotations

from .params import ASSET_TYPES, zone_of


def weights(asset_type: str) -> tuple[float, float, float]:
    w = ASSET_TYPES[asset_type]["weights"]
    assert abs(sum(w) - 1) < 1e-9, "bobot SDSI harus berjumlah 1"
    return w


def sdsi(asset_type: str, d_vol: float, d_surf: float, d_water: float) -> dict:
    """SDSI = w1*D_vol + w2*D_surf + w3*D_water, dengan rincian tiap suku untuk ditampilkan."""
    w1, w2, w3 = weights(asset_type)
    terms = [
        {"key": "d_vol", "label": "Radar", "weight": w1, "value": d_vol, "product": w1 * d_vol},
        {"key": "d_surf", "label": "Foto", "weight": w2, "value": d_surf, "product": w2 * d_surf},
        {"key": "d_water", "label": "Air", "weight": w3, "value": d_water, "product": w3 * d_water},
    ]
    score = min(max(sum(t["product"] for t in terms), 0.0), 1.0)
    return {"sdsi": round(score, 4), "zone": zone_of(score), "terms": terms}
