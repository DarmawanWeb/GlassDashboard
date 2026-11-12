"""Simulator drone GLASS: citra udara SINTETIS di sekitar satu aset, sebelum & sesudah bencana.

Tiga sensor sesuai rancangan GLASS:
  - kamera RGB          -> kerusakan permukaan (D_surf)
  - LiDAR (tinggi)      -> perubahan bentuk / volume (D_vol)
  - kamera termal LWIR  -> area basah / genangan (D_water)

Kerusakan yang digambar mengikuti nilai aset di skenario. Karena dunianya buatan, "kondisi sebenarnya"
diketahui, sehingga ketepatan analisis AI bisa diukur. Ini BUKAN foto asli.
"""
from __future__ import annotations

import hashlib
import json
import math
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

import cv2
import numpy as np

W, H = 960, 540                     # ukuran gambar di dasbor
GSD = 0.2                           # meter per piksel (kamera GLASS < 2 cm/piksel; di sini diperkecil)
PATCH_W_M, PATCH_H_M = W * GSD, H * GSD
KM_PER_DEG = 111.32
SUN = np.array([-0.70710678, 0.70710678], np.float32)    # arah ke matahari (barat laut)
SUN_TAN = 1.15                      # tan(elevasi matahari): panjang bayangan = tinggi / 1,15
LAND_FILE = Path(__file__).resolve().parent.parent / "data" / "palu_land.geojson"

# material per piksel (dipakai untuk suhu termal dan kebenaran simulasi)
(SOIL, GRASS, YARD, ASPHALT, SAND, SEA, RIVER, TREE, CAR, TILE, METAL, DECK, FIELD, PARK,
 RUBBLE, HOLE, MUD, POOL, DEBRIS, CONC) = range(20)
TEMP = np.array([38.0, 32.5, 41.0, 47.0, 40.0, 29.0, 27.5, 28.0, 45.0, 42.0, 53.0, 46.0, 40.0, 44.0,
                 34.5, 31.0, 27.0, 26.0, 33.0, 44.0], np.float32)
GROUND = (SOIL, GRASS, YARD, ASPHALT, SAND, FIELD, PARK)

# kelas kerusakan gaya xBD dari porsi atap rusak
CLASS_EDGES = (0.10, 0.39, 0.72)
CLASS_LABELS = ("Tidak rusak", "Rusak ringan", "Rusak berat", "Hancur")
ROOF_BANDS = ((0.0, 0.05), (0.15, 0.33), (0.43, 0.67), (0.78, 0.97))

_v, _u = np.mgrid[0:H, 0:W].astype(np.float32)
XX = (_u + 0.5 - W / 2) * GSD       # meter ke timur dari pusat aset
YY = (H / 2 - _v - 0.5) * GSD       # meter ke utara
del _u, _v


def damage_class(frac: float) -> int:
    return int(np.searchsorted(CLASS_EDGES, frac, side="right"))


def rng_for(*key) -> np.random.Generator:
    h = hashlib.sha256(":".join(map(str, key)).encode()).digest()
    return np.random.default_rng(int.from_bytes(h[:8], "little"))


# ---------------------------------------------------------------- derau
def _value_noise(rng, h, w, cell):
    cell = max(float(cell), 1.5)
    gh, gw = int(h / cell) + 4, int(w / cell) + 4
    g = rng.random((gh, gw)).astype(np.float32)
    big = cv2.resize(g, (int(gw * cell), int(gh * cell)), interpolation=cv2.INTER_CUBIC)
    oy = int(rng.integers(0, max(1, big.shape[0] - h)))
    ox = int(rng.integers(0, max(1, big.shape[1] - w)))
    return big[oy:oy + h, ox:ox + w]


def fbm(rng, h, w, cell, octaves=4, gain=0.5):
    out = np.zeros((h, w), np.float32)
    amp, tot, c = 1.0, 0.0, float(cell)
    for _ in range(octaves):
        out += amp * _value_noise(rng, h, w, c)
        tot += amp
        amp *= gain
        c /= 2
    out /= tot
    lo, hi = float(out.min()), float(out.max())
    return (out - lo) / (hi - lo + 1e-6)


# ---------------------------------------------------------------- geometri
@dataclass
class Rect:
    cx: float
    cy: float
    hl: float          # setengah panjang (sumbu utama)
    hw: float          # setengah lebar
    ang: float         # arah sumbu utama (radian dari timur)

    def corners(self, pad=0.0) -> np.ndarray:
        c, s = math.cos(self.ang), math.sin(self.ang)
        a, n = np.array([c, s]), np.array([-s, c])
        hl, hw = self.hl + pad, self.hw + pad
        ctr = np.array([self.cx, self.cy])
        return np.array([ctr + a * hl + n * hw, ctr - a * hl + n * hw, ctr - a * hl - n * hw, ctr + a * hl - n * hw])

    def local(self, pad=0.0):
        """Potongan piksel di sekitar persegi + koordinat lokal (t sepanjang sumbu, s melintang)."""
        cs = self.corners(pad)
        us = W / 2 + cs[:, 0] / GSD
        vs = H / 2 - cs[:, 1] / GSD
        x0, x1 = max(int(math.floor(us.min())) - 1, 0), min(int(math.ceil(us.max())) + 2, W)
        y0, y1 = max(int(math.floor(vs.min())) - 1, 0), min(int(math.ceil(vs.max())) + 2, H)
        if x0 >= x1 or y0 >= y1:
            return None
        X, Y = XX[y0:y1, x0:x1] - self.cx, YY[y0:y1, x0:x1] - self.cy
        c, s = math.cos(self.ang), math.sin(self.ang)
        t = X * c + Y * s
        sl = -X * s + Y * c
        inside = (np.abs(t) <= self.hl + pad) & (np.abs(sl) <= self.hw + pad)
        return (slice(y0, y1), slice(x0, x1)), inside, t, sl


@dataclass
class Bldg:
    bid: str
    kind: str                      # rumah | sekolah | puskesmas | kantor | jembatan
    rects: list[Rect]
    style: str                     # gable | hip | deck
    eave: float
    ridge: float
    color: tuple[int, int, int]
    mat: int
    r: float = 0.0                 # porsi atap rusak yang digambar
    v: float = 0.0                 # target hilang volume (LiDAR), hanya untuk aset target
    target: bool = False


@dataclass
class Scene:
    asset_id: str
    kind: str
    rgb_pre: np.ndarray
    rgb_post: np.ndarray
    h_pre: np.ndarray
    h_post: np.ndarray
    t_post: np.ndarray
    target_fp: np.ndarray          # tapak aset dari daftar BMN / digital twin
    truth: dict = field(default_factory=dict)
    info: dict = field(default_factory=dict)


@lru_cache(maxsize=1)
def _land_rings() -> list[tuple[np.ndarray, bool]]:
    fc = json.loads(LAND_FILE.read_text())
    rings = []
    for f in fc["features"]:
        if f["properties"].get("kind") != "land":
            continue
        g = f["geometry"]
        polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
        for poly in polys:
            for k, ring in enumerate(poly):
                rings.append((np.asarray(ring, dtype=np.float64), k > 0))
    return rings


def land_mask(lon0: float, lat0: float, scale: int = 1, pad_px: int = 0) -> np.ndarray:
    """Daratan (True) di sekitar aset dari poligon geoBoundaries."""
    k = math.cos(math.radians(lat0))
    hh, ww = H * scale + 2 * pad_px, W * scale + 2 * pad_px
    m = np.zeros((hh, ww), np.uint8)
    for ring, hole in _land_rings():
        x = (ring[:, 0] - lon0) * KM_PER_DEG * 1000 * k
        y = (ring[:, 1] - lat0) * KM_PER_DEG * 1000
        u = (W / 2 + x / GSD) * scale + pad_px
        v = (H / 2 - y / GSD) * scale + pad_px
        pts = np.round(np.stack([u, v], 1)).astype(np.int32)
        cv2.fillPoly(m, [pts], 0 if hole else 1)
    return m.astype(bool)


# ---------------------------------------------------------------- warna
ROOF_HOUSE = [((178, 86, 58), TILE, 0.33), ((142, 58, 46), TILE, 0.14), ((158, 162, 166), METAL, 0.2),
              ((66, 104, 160), METAL, 0.12), ((74, 122, 94), METAL, 0.09), ((122, 90, 64), TILE, 0.12)]
ROOF_TARGET = {
    "sekolah": [((176, 74, 52), TILE), ((52, 96, 158), METAL), ((158, 50, 44), TILE)],
    "puskesmas": [((62, 132, 122), METAL), ((190, 98, 54), TILE), ((178, 182, 184), METAL)],
    "kantor": [((98, 112, 132), METAL), ((128, 54, 50), TILE), ((66, 98, 82), METAL)],
    "jembatan": [((80, 82, 84), DECK)],
}
CAR_COLORS = [(232, 232, 228), (182, 184, 188), (40, 42, 46), (168, 40, 40), (40, 72, 140), (214, 214, 206)]


class Canvas:
    """Lapisan dunia simulasi: albedo (warna tanpa bayangan), tinggi, material, faktor arah atap."""

    def __init__(self):
        self.alb = np.zeros((H, W, 3), np.float32)
        self.hgt = np.zeros((H, W), np.float32)
        self.mat = np.full((H, W), SOIL, np.uint8)
        self.facet = np.zeros((H, W), np.float32)          # -1..1, sisi atap menghadap matahari

    def copy(self) -> "Canvas":
        c = Canvas.__new__(Canvas)
        c.alb, c.hgt, c.mat, c.facet = self.alb.copy(), self.hgt.copy(), self.mat.copy(), self.facet.copy()
        return c


# ---------------------------------------------------------------- penyusunan tata letak
class Layout:
    def __init__(self, asset: dict, seed: int):
        self.asset = asset
        self.rng = rng_for("scene", seed, asset["id"])
        self.kind = asset["type"]
        self.theta = float(self.rng.uniform(-0.38, 0.38))
        c, s = math.cos(self.theta), math.sin(self.theta)
        self.a, self.n = np.array([c, s]), np.array([-s, c])
        # grid hunian 0,5 m untuk cek tumpang tindih (lebih luas dari gambar)
        self.occ_scale, self.occ_pad = 0.5, 30.0
        self.ow = int((PATCH_W_M + 2 * self.occ_pad) / self.occ_scale)
        self.oh = int((PATCH_H_M + 2 * self.occ_pad) / self.occ_scale)
        self.occ = np.zeros((self.oh, self.ow), np.uint8)
        pad = int(self.occ_pad / GSD)
        land_big = land_mask(asset["lon"], asset["lat"], scale=1, pad_px=pad)
        self.land_occ = cv2.resize(land_big.astype(np.uint8), (self.ow, self.oh),
                                   interpolation=cv2.INTER_NEAREST).astype(bool)
        self.land = land_big[pad:pad + H, pad:pad + W]
        self.buildings: list[Bldg] = []
        self.roads: list[tuple[np.ndarray, np.ndarray, float]] = []   # (titik awal, arah, setengah lebar)
        self.trees: list[tuple[float, float, float, float, tuple]] = []
        self.cars: list[tuple[Rect, tuple]] = []
        self.areas: list[tuple[Rect, int, tuple]] = []                 # lapangan, parkir
        self.river: tuple[float, float] | None = None                   # (setengah lebar, fase meander)

    # -- hunian
    def _occ_pts(self, pts_m: np.ndarray) -> np.ndarray:
        u = (pts_m[:, 0] + PATCH_W_M / 2 + self.occ_pad) / self.occ_scale
        v = (PATCH_H_M / 2 + self.occ_pad - pts_m[:, 1]) / self.occ_scale
        return np.round(np.stack([u, v], 1)).astype(np.int32)

    def free(self, r: Rect, margin=1.0, need_land=True) -> bool:
        m = np.zeros_like(self.occ)
        cv2.fillPoly(m, [self._occ_pts(r.corners(margin))], 1)
        if not m.any():
            return False
        if (self.occ & m).any():
            return False
        if need_land:
            inside = m.astype(bool)
            if self.land_occ[inside].mean() < 0.98:
                return False
        return True

    def mark(self, r: Rect, margin=0.0):
        cv2.fillPoly(self.occ, [self._occ_pts(r.corners(margin))], 1)

    def to_xy(self, u: float, w: float) -> np.ndarray:
        return self.a * u + self.n * w

    # -- isi
    def build(self):
        tgt = self._target()
        self.buildings.append(tgt)
        for r in tgt.rects:
            self.mark(r, 3.0)
        for ar, _, _ in self.areas:
            self.mark(ar, 1.0)
        self._roads()
        self._houses()
        self._trees()
        self._cars()
        return self

    def _target(self) -> Bldg:
        rng, k = self.rng, self.kind
        th = self.theta
        color, mat = ROOF_TARGET[k][int(rng.integers(len(ROOF_TARGET[k])))]
        if k == "sekolah":
            wb, db, t = rng.uniform(48, 58), rng.uniform(30, 36), rng.uniform(8.5, 10)
            rects = [Rect(*self.to_xy(0, db / 2 - t / 2), wb / 2, t / 2, th),
                     Rect(*self.to_xy(-wb / 2 + t / 2, -t / 2), (db - t) / 2, t / 2, th + math.pi / 2),
                     Rect(*self.to_xy(wb / 2 - t / 2, -t / 2), (db - t) / 2, t / 2, th + math.pi / 2)]
            court = Rect(*self.to_xy(0, -t / 2 - 1), wb / 2 - t - 2.5, (db - t) / 2 - 2.5, th)
            self.areas.append((court, FIELD, (178, 172, 158)))
            self.depth, self.width = db, wb
            return Bldg(self.asset["id"], k, rects, "gable", 3.4, 6.4, color, mat, target=True)
        if k == "puskesmas":
            hl, hw = rng.uniform(14, 17), rng.uniform(6.5, 8)
            ax, ahl, ahw = rng.choice([-1, 1]), rng.uniform(5, 7), rng.uniform(4.5, 5.5)
            rects = [Rect(*self.to_xy(0, 0), hl, hw, th),
                     Rect(*self.to_xy(ax * (hl - ahw), hw + ahl - 0.5), ahl, ahw, th + math.pi / 2)]
            park = Rect(*self.to_xy(0, -hw - 7.5), hl, 5.5, th)
            self.areas.append((park, PARK, (104, 106, 108)))
            self.depth, self.width = 2 * hw + 2 * ahl, 2 * hl
            return Bldg(self.asset["id"], k, rects, "gable", 3.2, 5.9, color, mat, target=True)
        if k == "kantor":
            hl, hw = rng.uniform(19, 24), rng.uniform(10, 13)
            rects = [Rect(*self.to_xy(0, 0), hl, hw, th)]
            park = Rect(*self.to_xy(0, -hw - 9), hl + 4, 7.0, th)
            self.areas.append((park, PARK, (104, 106, 108)))
            self.depth, self.width = 2 * hw, 2 * hl
            return Bldg(self.asset["id"], k, rects, "hip", 7.8, 11.8, color, mat, target=True)
        # jembatan: sungai melintang, jembatan di jalan utama
        wr = rng.uniform(26, 38)
        self.river = (wr / 2, float(rng.uniform(0, 2 * math.pi)))
        deck = Rect(0.0, 0.0, wr / 2 + 11, rng.uniform(4.3, 5.0), th)
        self.depth, self.width = 10, wr + 22
        return Bldg(self.asset["id"], k, [deck], "deck", 0.6, 0.6, color, DECK, target=True)

    def _road(self, w0: float, along_n: bool, halfw: float):
        if along_n:   # jalan sejajar n, di posisi u = w0
            origin, d = self.a * w0, self.n
        else:
            origin, d = self.n * w0, self.a
        self.roads.append((origin, d, halfw))
        r = Rect(*origin, 140.0, halfw, math.atan2(d[1], d[0]))
        self.mark(r, 0.5)

    def _roads(self):
        rng = self.rng
        if self.kind == "jembatan":
            self._road(0.0, False, 3.8)                                   # jalan utama melewati jembatan
            self._road(rng.choice([-1, 1]) * rng.uniform(45, 70), False, 3.0)
            self._road(rng.choice([-1, 1]) * rng.uniform(42, 60), True, 3.0)
        else:
            front = -(self.depth / 2 + (18 if self.kind != "sekolah" else 7) + 3.8)
            self._road(front, False, 3.8)
            side = rng.choice([-1, 1]) * (self.width / 2 + rng.uniform(12, 26))
            self._road(side, True, 3.0)
            if rng.random() < 0.7:
                self._road(self.depth / 2 + rng.uniform(26, 40), False, 2.8)

    def _houses(self):
        rng = self.rng
        density = 0.88 if self.asset.get("d_coast_km", 1) < 0.6 else 0.78
        for origin, d, halfw in self.roads:
            nrm = np.array([-d[1], d[0]])
            ang = math.atan2(d[1], d[0])
            for side in (-1, 1):
                for row in (0, 1):
                    u = -120.0 + rng.uniform(0, 6)
                    while u < 120:
                        wh, dh = rng.uniform(7, 12), rng.uniform(7, 11)
                        gap = rng.uniform(1.2, 4.2)
                        back = halfw + rng.uniform(1.8, 4.0) + dh / 2 + row * (dh + rng.uniform(3, 6))
                        ctr = origin + d * (u + wh / 2) + nrm * side * back
                        u += wh + gap
                        if rng.random() > density:
                            continue
                        if abs(ctr[0]) > PATCH_W_M / 2 + 12 or abs(ctr[1]) > PATCH_H_M / 2 + 12:
                            continue
                        r = Rect(float(ctr[0]), float(ctr[1]), wh / 2, dh / 2, ang)
                        if self.river and self._in_river(ctr, max(wh, dh) / 2 + 3):
                            continue
                        if not self.free(r, 1.0):
                            continue
                        self.mark(r, 0.6)
                        col = ROOF_HOUSE[int(rng.choice(len(ROOF_HOUSE), p=[c[2] for c in ROOF_HOUSE]))]
                        jit = rng.uniform(0.9, 1.08)
                        color = tuple(int(np.clip(v * jit, 0, 255)) for v in col[0])
                        if dh > wh:   # bubungan mengikuti sisi terpanjang
                            r = Rect(r.cx, r.cy, dh / 2, wh / 2, ang + math.pi / 2)
                        eave = rng.uniform(2.8, 3.3)
                        self.buildings.append(Bldg(f"B{len(self.buildings)}", "rumah", [r], "gable", eave,
                                                   eave + rng.uniform(1.6, 2.3), color, col[1]))

    def _in_river(self, p: np.ndarray, pad: float) -> bool:
        if not self.river:
            return False
        hw, ph = self.river
        u, w = float(p @ self.a), float(p @ self.n)
        return abs(u - 4 * math.sin(w / 23 + ph)) < hw + pad

    def _trees(self):
        rng = self.rng
        n_clusters = int(rng.integers(7, 13))
        for _ in range(n_clusters):
            cx, cy = rng.uniform(-PATCH_W_M / 2, PATCH_W_M / 2), rng.uniform(-PATCH_H_M / 2, PATCH_H_M / 2)
            for _ in range(int(rng.integers(2, 9))):
                x, y = cx + rng.normal(0, 7), cy + rng.normal(0, 5)
                rad = rng.uniform(1.8, 4.6)
                r = Rect(x, y, rad, rad, 0.0)
                if self._in_river(np.array([x, y]), rad) or not self.free(r, 0.3):
                    continue
                self.mark(r, 0.0)
                g = rng.uniform(0.85, 1.15)
                color = (int(46 * g), int(rng.uniform(86, 112) * g), int(44 * g))
                self.trees.append((x, y, rad, rng.uniform(6, 12), color))

    def _cars(self):
        rng = self.rng
        for origin, d, halfw in self.roads:
            nrm = np.array([-d[1], d[0]])
            for _ in range(int(rng.integers(2, 7))):
                u = rng.uniform(-PATCH_W_M / 2, PATCH_W_M / 2)
                lane = rng.choice([-1, 1]) * halfw * 0.48
                ctr = origin + d * u + nrm * lane
                if self.river and self._in_river(ctr, 2):
                    continue
                self.cars.append((Rect(float(ctr[0]), float(ctr[1]), 2.2, 0.9, math.atan2(d[1], d[0])),
                                  CAR_COLORS[int(rng.integers(len(CAR_COLORS)))]))
        for ar, kind, _ in self.areas:
            if kind != PARK:
                continue
            for k in range(int(rng.integers(2, 6))):
                u = -ar.hl + 2.5 + k * rng.uniform(3.2, 5.0)
                if u > ar.hl - 2:
                    break
                ctr = np.array([ar.cx, ar.cy]) + self.a * u + self.n * rng.uniform(-1, 1)
                self.cars.append((Rect(float(ctr[0]), float(ctr[1]), 2.2, 0.9, ar.ang + math.pi / 2),
                                  CAR_COLORS[int(rng.integers(len(CAR_COLORS)))]))
