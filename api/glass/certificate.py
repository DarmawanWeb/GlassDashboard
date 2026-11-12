"""Digital Loss Certificate: isi sertifikat + sidik jari SHA-256 untuk jejak audit.

Catatan: ini hash, bukan tanda tangan digital. Pada sistem produksi, hash ditandatangani
kunci privat penerbit (misal konsorsium asuransi) agar penerbitnya juga bisa diverifikasi.
"""
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone

from .params import ASSET_TYPES, EVENT_NAME, MODEL_VERSION

FIELDS = ("certificate_id", "asset_id", "asset_type", "location", "event", "sdsi", "zone", "observed",
          "sum_insured_idr", "estimated_claim_idr", "advance_idr", "topup_idr", "data_sources",
          "model_version", "issued_utc")

DATA_SOURCES = ["Foto satelit (Maxar / xBD)", "Radar Sentinel-1", "Peta banjir Sentinel-1 (GFM)", "USGS ShakeMap"]


def canonical(payload: dict) -> str:
    body = {k: payload[k] for k in FIELDS if k in payload}
    return json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def fingerprint(payload: dict) -> str:
    return hashlib.sha256(canonical(payload).encode("utf-8")).hexdigest()


def issue(asset: dict) -> dict:
    now = datetime.now(timezone.utc).replace(microsecond=0)
    cert = {
        "certificate_id": f"GLASS-PLU-{asset['id']}-{now:%Y%m%d%H%M%S}",
        "asset_id": asset["id"],
        "asset_type": ASSET_TYPES[asset["type"]]["label"],
        "location": {"lat": asset["lat"], "lon": asset["lon"]},
        "event": EVENT_NAME,
        "sdsi": round(float(asset["sdsi"]), 3),
        "zone": asset["zone"],
        "observed": bool(asset["observed"]),
        "sum_insured_idr": int(round(asset["sum_insured"])),
        "estimated_claim_idr": int(round(asset["claim"])),
        "advance_idr": int(round(asset["advance"])),
        "topup_idr": int(round(asset["topup"])),
        "data_sources": DATA_SOURCES,
        "model_version": MODEL_VERSION,
        "issued_utc": now.isoformat().replace("+00:00", "Z"),
    }
    cert["sha256"] = fingerprint(cert)
    return cert


def verify(cert: dict) -> dict:
    expected = fingerprint(cert)
    given = str(cert.get("sha256", ""))
    return {"valid": expected == given, "expected_sha256": expected, "given_sha256": given}
