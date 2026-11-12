"""Orkestrasi alur GLASS: Lihat -> Nilai -> Hitung -> Bayar."""
from __future__ import annotations

from functools import lru_cache

import numpy as np

from . import actuarial, contour, scenario, sources
from .geo import nearest, overlays
from .params import ASSET_TYPES, N_NEIGHBORS, ZONES, PmlParams, PolicyParams, ScenarioParams, zone_of
from .sdsi import sdsi


@lru_cache(maxsize=1)
def _field():
    return scenario.mmi_field()


@lru_cache(maxsize=64)
def _observe(p: ScenarioParams) -> tuple[tuple[dict, ...], tuple[dict, ...], str]:
    """LIHAT: kumpulkan pembacaan satelit per aset (contoh atau file asli)."""
    path = sources.assets_file()
    if path:
        return tuple(sources.load_geojson(path)), tuple(), "file"
    assets = scenario.generate_assets(p)
    clouds = scenario.add_clouds(assets, p)
    return tuple(assets), tuple(clouds), "contoh"


def run(p: ScenarioParams, policy: PolicyParams, pml_p: PmlParams = PmlParams()) -> dict:
    raw, clouds, mode = _observe(p)
    assets = [dict(a) for a in raw]

    # NILAI: SDSI untuk aset yang terlihat; foto aset tertutup awan ditebak dari tetangga
    obs = [a for a in assets if a["observed"]]
    hid = [a for a in assets if not a["observed"]]
    for a in obs:
        a.update(sdsi(a["type"], a["d_vol"], a["d_surf"], a["d_water"]))
        a["neighbors"] = []
    if hid and obs:
        idx, _ = nearest(np.array([a["lon"] for a in hid]), np.array([a["lat"] for a in hid]),
                         np.array([a["lon"] for a in obs]), np.array([a["lat"] for a in obs]),
                         min(N_NEIGHBORS, len(obs)))
        for a, row in zip(hid, idx):
            nbrs = [obs[int(k)] for k in row]
            a["d_surf_est"] = round(float(np.mean([n["d_surf"] for n in nbrs])), 3)
            a.update(sdsi(a["type"], a["d_vol"], a["d_surf_est"], a["d_water"]))
            a["neighbors"] = [n["id"] for n in nbrs]

    # HITUNG + BAYAR
    for a in assets:
        si = a["sum_insured"]
        a["claim"] = actuarial.claim(si, a["sdsi"], policy.deductible_rate)
        a["advance"] = policy.advance_rate * si if a["mmi"] >= policy.mmi_trigger else 0.0
        a["topup"] = max(a["claim"] - a["advance"], 0.0)
        a["over"] = max(a["advance"] - a["claim"], 0.0)

    total_si = sum(a["sum_insured"] for a in assets)
    case_reserves = sum(a["claim"] for a in obs)
    ibnr = sum(a["claim"] for a in hid)
    total_claims = case_reserves + ibnr
    severe = {"oranye", "merah"}
    missed = [a for a in obs if a["zone"] in severe and a["advance"] == 0]

    by_zone = []
    for _, zid, label, meaning in ZONES:
        zs = [a for a in assets if a["zone"] == zid]
        by_zone.append({
            "zone": zid, "label": label, "meaning": meaning,
            "count": len(zs), "count_estimated": sum(1 for a in zs if not a["observed"]),
            "claim": sum(a["claim"] for a in zs if a["observed"]),
            "claim_estimated": sum(a["claim"] for a in zs if not a["observed"]),
        })
    by_type = []
    for tid, meta in ASSET_TYPES.items():
        ts = [a for a in assets if a["type"] == tid]
        by_type.append({
            "type": tid, "label": meta["label"], "count": len(ts),
            "sum_insured": sum(a["sum_insured"] for a in ts),
            "advance": sum(a["advance"] for a in ts), "topup": sum(a["topup"] for a in ts),
            "claim": sum(a["claim"] for a in ts),
        })

    field = _field()
    shake_line = contour.isoline(field["xs"], field["ys"], field["mmi"], policy.mmi_trigger)

    summary = {
        "data_mode": mode,
        "n_assets": len(assets), "n_observed": len(obs), "n_hidden": len(hid),
        "total_sum_insured": total_si,
        "case_reserves": case_reserves, "ibnr": ibnr, "total_reserves": total_claims,
        "loss_ratio": (total_claims / total_si) if total_si else 0.0,
        "advance_total": sum(a["advance"] for a in assets),
        "n_advance": sum(1 for a in assets if a["advance"] > 0),
        "topup_total": sum(a["topup"] for a in assets),
        "basis_risk_over": sum(a["over"] for a in obs),
        "n_over": sum(1 for a in obs if a["over"] > 0),
        "missed_severe_count": len(missed),
        "missed_severe_claim": sum(a["claim"] for a in missed),
    }

    for a in assets:
        for k in ("sdsi", "claim", "advance", "topup", "over"):
            a[k] = round(float(a[k]), 4) if k == "sdsi" else round(float(a[k]))
        for t in a["terms"]:
            t["product"] = round(float(t["product"]), 4)

    return {
        "params": {"scenario": p.__dict__, "policy": policy.__dict__},
        "summary": summary,
        "assets": assets,
        "clouds": list(clouds),
        "by_zone": by_zone,
        "by_type": by_type,
        "pml": actuarial.pml(total_si, total_claims, pml_p),
        "shake_line": shake_line,
    }


def shake_grid(step: int = 2) -> list[list[float]]:
    """Titik grid MMI (dijarangkan) untuk lapisan peta guncangan."""
    f = _field()
    pts = []
    for j in range(0, len(f["ys"]), step):
        for i in range(0, len(f["xs"]), step):
            pts.append([round(float(f["xs"][i]), 4), round(float(f["ys"][j]), 4), round(float(f["mmi"][j, i]), 2)])
    return pts


def meta() -> dict:
    return {
        "asset_types": {k: {"label": v["label"], "weights": v["weights"]} for k, v in ASSET_TYPES.items()},
        "zones": [{"upper": u, "zone": z, "label": l, "meaning": m} for u, z, l, m in ZONES],
        "defaults": {"scenario": ScenarioParams().__dict__, "policy": PolicyParams().__dict__},
        "n_neighbors": N_NEIGHBORS,
        "data_mode": "file" if sources.assets_file() else "contoh",
        "geo": overlays(),
        "shake_grid": shake_grid(),
    }


def calculator(asset_type: str, d_vol: float, d_surf: float, d_water: float, sum_insured: float,
               mmi: float, policy: PolicyParams) -> dict:
    res = sdsi(asset_type, d_vol, d_surf, d_water)
    c = actuarial.claim(sum_insured, res["sdsi"], policy.deductible_rate)
    adv = policy.advance_rate * sum_insured if mmi >= policy.mmi_trigger else 0.0
    return {**res, "zone": zone_of(res["sdsi"]), "deductible": policy.deductible_rate * sum_insured,
            "claim": round(c), "advance": round(adv), "topup": round(max(c - adv, 0.0))}
