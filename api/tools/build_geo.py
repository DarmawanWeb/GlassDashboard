"""Membangun data geografis Palu yang dipakai skenario contoh GLASS.

Dijalankan SEKALI saat pengembangan (bukan saat runtime). Hasilnya sudah ikut di repo:
  api/glass/data/palu_geo.json        -> titik kandidat aset + overlay (sesar, likuefaksi, pantai)
  web/public/geo/palu_land.geojson    -> daratan & teluk untuk peta offline

Sumber batas wilayah: geoBoundaries gbOpen IDN ADM2 (CC BY 4.0)
  https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/main/releaseData/gbOpen/IDN/ADM2/geoBoundaries-IDN-ADM2.geojson

Pakai:
  pip install shapely numpy
  python tools/build_geo.py path/ke/geoBoundaries-IDN-ADM2.geojson
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import numpy as np
from shapely.geometry import LineString, MultiLineString, Point, box, mapping, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[2]
BBOX = (119.70, -1.06, 120.02, -0.68)          # lon_min, lat_min, lon_max, lat_max (Teluk Palu)
KM_PER_DEG = 111.32

# Perkiraan jejak sesar Palu-Koro di Kota Palu (sisi barat lembah). Hanya untuk data contoh.
FAULT = [(119.845, -0.78), (119.847, -0.84), (119.849, -0.878), (119.844, -0.905),
         (119.848, -0.94), (119.860, -0.98), (119.874, -1.02)]
# Perkiraan pusat area likuefaksi 2018 (radius = jangkauan pengaruh di data contoh).
LIQUEFACTION = [
    {"name": "Balaroa", "lon": 119.8366, "lat": -0.9054, "radius_km": 0.65},
    {"name": "Petobo", "lon": 119.9040, "lat": -0.9440, "radius_km": 0.90},
]
CORE = box(119.825, -0.956, 119.912, -0.862)   # inti kota (lembah Palu)
NORTH_STRIP_LAT = (-0.80, -0.862)                # permukiman pesisir utara kota


def km_dist(geom, lon: float, lat: float) -> float:
    """Jarak titik ke geometri dalam km (pendekatan equirectangular, cukup untuk skala kota)."""
    k = math.cos(math.radians(lat))
    p = Point(lon * k, lat)
    scaled = shape_scale(geom, k)
    return scaled.distance(p) * KM_PER_DEG


_scaled_cache: dict[int, object] = {}


def shape_scale(geom, k: float):
    key = id(geom)
    if key not in _scaled_cache:
        from shapely import affinity
        _scaled_cache[key] = affinity.scale(geom, xfact=k, yfact=1.0, origin=(0, 0))
    return _scaled_cache[key]


def main(src: str) -> None:
    fc = json.load(open(src))
    wanted = {"Kota Palu", "Donggala", "Sigi"}
    bb = box(*BBOX)
    parts = [shape(f["geometry"]).intersection(bb) for f in fc["features"]
             if f["properties"].get("shapeName") in wanted]
    land = unary_union(parts).buffer(0.0002).buffer(-0.0002)          # tutup celah antar-wilayah
    coast = land.boundary.difference(bb.exterior.buffer(0.002))        # buang tepi potongan bbox
    water = bb.difference(land)
    bay = max(getattr(water, "geoms", [water]), key=lambda g: g.area)

    fault = LineString(FAULT)
    inner = land.buffer(-0.0011)                                       # ±120 m dari garis pantai
    lat_c = -0.90
    k = math.cos(math.radians(lat_c))
    coast_s = shape_scale(coast, k)
    fault_s = shape_scale(fault, k)

    cands = []
    step = 0.0011
    for lat in np.arange(-0.965, -0.78, step):
        for lon in np.arange(119.80, 119.93, step):
            p = Point(lon, lat)
            if not inner.contains(p):
                continue
            ps = Point(lon * k, lat)
            d_coast = coast_s.distance(ps) * KM_PER_DEG
            in_core = CORE.contains(p)
            in_strip = NORTH_STRIP_LAT[1] <= lat <= NORTH_STRIP_LAT[0] and d_coast <= 1.1
            if not (in_core or in_strip):
                continue
            d_fault = fault_s.distance(ps) * KM_PER_DEG
            liq = 0.0
            for z in LIQUEFACTION:
                d = math.hypot((lon - z["lon"]) * k, lat - z["lat"]) * KM_PER_DEG
                liq = max(liq, math.exp(-(d / z["radius_km"]) ** 2))
            cands.append([round(lon, 5), round(lat, 5), round(d_coast, 3), round(d_fault, 3), round(liq, 3)])

    coast_simple = coast.simplify(0.0003)
    lines = [list(map(lambda c: [round(c[0], 5), round(c[1], 5)], g.coords))
             for g in getattr(coast_simple, "geoms", [coast_simple]) if g.length > 0.002]

    out = {
        "source": "geoBoundaries gbOpen IDN ADM2 (CC BY 4.0); sesar & likuefaksi: perkiraan untuk data contoh",
        "bbox": [119.78, -0.99, 119.96, -0.76],
        "center": [119.866, -0.885],
        "epicenter": {"lon": 119.846, "lat": -0.256, "magnitude": 7.5, "date": "2018-09-28"},
        "fault": [list(c) for c in FAULT],
        "liquefaction": LIQUEFACTION,
        "coast": lines,
        "candidates": cands,
    }
    dst = ROOT / "api/glass/data/palu_geo.json"
    dst.write_text(json.dumps(out, separators=(",", ":")))
    print(f"{dst}: {len(cands)} kandidat, {len(lines)} garis pantai")

    land_s = land.simplify(0.00015).buffer(0)
    bay_s = bay.simplify(0.00015).buffer(0)
    geo = {"type": "FeatureCollection", "features": [
        {"type": "Feature", "properties": {"kind": "land"}, "geometry": _round(mapping(land_s))},
        {"type": "Feature", "properties": {"kind": "bay"}, "geometry": _round(mapping(bay_s))},
    ]}
    dst2 = ROOT / "web/public/geo/palu_land.geojson"
    dst2.write_text(json.dumps(geo, separators=(",", ":")))
    print(f"{dst2}: {dst2.stat().st_size/1024:.0f} KB")


def _round(g):
    def r(c):
        if isinstance(c[0], (int, float)):
            return [round(c[0], 5), round(c[1], 5)]
        return [r(x) for x in c]
    g = dict(g)
    g["coordinates"] = r(g["coordinates"])
    return g


if __name__ == "__main__":
    main(sys.argv[1])
