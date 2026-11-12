"""Sumber data aset.

Default: skenario contoh (scenario.py). Untuk data asli, set env GLASS_ASSETS_FILE ke file GeoJSON
(FeatureCollection titik) dengan properti per aset:

  id            (str)   contoh "SKL-001"
  type          (str)   sekolah | puskesmas | kantor | jembatan
  sum_insured   (float) nilai pertanggungan, rupiah
  d_vol         (0..1)  dari radar Sentinel-1 (lihat Lampiran A di dokumen)
  d_surf        (0..1)  dari model/label kerusakan foto (xBD: 0, 1/3, 2/3, 1)
  d_water       (0..1)  dari peta banjir / suhu
  mmi           (float) intensitas guncangan di lokasi aset (USGS ShakeMap)
  observed      (bool)  false jika foto aset tertutup awan (opsional, default true)
"""
from __future__ import annotations

import json
import os
from pathlib import Path

from .params import ASSET_TYPES

REQUIRED = ("type", "sum_insured", "d_vol", "d_surf", "d_water", "mmi")


def assets_file() -> Path | None:
    p = os.environ.get("GLASS_ASSETS_FILE", "").strip()
    return Path(p) if p else None


def load_geojson(path: Path) -> list[dict]:
    fc = json.loads(Path(path).read_text())
    out = []
    for k, f in enumerate(fc.get("features", [])):
        props = f.get("properties") or {}
        missing = [r for r in REQUIRED if r not in props]
        if missing:
            raise ValueError(f"Fitur ke-{k} kurang properti: {', '.join(missing)}")
        if props["type"] not in ASSET_TYPES:
            raise ValueError(f"Fitur ke-{k}: type '{props['type']}' tidak dikenal ({', '.join(ASSET_TYPES)})")
        lon, lat = f["geometry"]["coordinates"][:2]
        out.append({
            "id": str(props.get("id", f"AST-{k + 1:03d}")),
            "type": props["type"],
            "lon": float(lon), "lat": float(lat),
            "sum_insured": float(props["sum_insured"]),
            "d_vol": float(props["d_vol"]), "d_surf": float(props["d_surf"]), "d_water": float(props["d_water"]),
            "mmi": float(props["mmi"]),
            "d_coast_km": float(props.get("d_coast_km", 0) or 0),
            "observed": bool(props.get("observed", True)),
        })
    return out
