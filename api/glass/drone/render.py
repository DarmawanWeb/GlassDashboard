"""Menggambar dunia simulasi drone: sebelum bencana (digital twin) dan sesudah bencana (RGB, LiDAR, termal)."""
from __future__ import annotations

import math

import cv2
import numpy as np

from .scene import (
    ASPHALT,
    CAR,
    DEBRIS,
    FIELD,
    GRASS,
    GROUND,
    GSD,
    HOLE,
    METAL,
    MUD,
    POOL,
    RIVER,
    ROOF_BANDS,
    RUBBLE,
    SAND,
    SEA,
    SOIL,
    SUN,
    SUN_TAN,
    TEMP,
    TILE,
    TREE,
    XX,
    YARD,
    YY,
    Bldg,
    Canvas,
    H,
    Layout,
    Rect,
    Scene,
    W,
    damage_class,
    fbm,
    rng_for,
)

RUBBLE_COLORS = np.array([(156, 150, 140), (128, 104, 82), (96, 90, 84), (176, 168, 152), (112, 74, 56)], np.float32) / 255
DEBRIS_COLORS = np.array([(0, 0, 0), (146, 108, 70), (164, 166, 170), (136, 88, 60), (118, 84, 56)], np.float32) / 255

_yy, _xx = np.mgrid[0:H, 0:W].astype(np.float32)
VIGNETTE = (1 - 0.045 * (((_xx - W / 2) / (W / 2)) ** 2 + ((_yy - H / 2) / (H / 2)) ** 2))[..., None]
del _yy, _xx


def _rgb(c) -> np.ndarray:
    return np.asarray(c, np.float32) / 255.0


class Noise:
    """Bank derau satu adegan: dihitung sekali, dipotong-potong untuk tiap objek (lebih cepat)."""

    def __init__(self, rng):
        self.big = fbm(rng, H, W, 110)
        self.mid = fbm(rng, H, W, 22)
        self.dry = fbm(rng, H, W, 60)
        self.fine = fbm(rng, H, W, 3, octaves=2)
        self.n5 = fbm(rng, H, W, 5, octaves=2)
        self.n8 = fbm(rng, H, W, 8, octaves=2)
        self.n12 = fbm(rng, H, W, 12, octaves=3)
        self.n30 = fbm(rng, H, W, 30, octaves=3)
        self.n45 = fbm(rng, H, W, 45)
        self.rand = rng.random((H, W), dtype=np.float32)
        idx = np.searchsorted(np.cumsum([0.3, 0.22, 0.2, 0.16]), rng.random((H, W), dtype=np.float32))
        shade = cv2.GaussianBlur(0.62 + 0.55 * rng.random((H, W), dtype=np.float32), (0, 0), 0.7)
        self.rubble = RUBBLE_COLORS[idx] * shade[..., None]
        self.frag = cv2.GaussianBlur(rng.random((H, W), dtype=np.float32), (0, 0), 1.2) > 0.62


def _poly_px(corners_m: np.ndarray) -> np.ndarray:
    return np.stack([W / 2 + corners_m[:, 0] / GSD, H / 2 - corners_m[:, 1] / GSD], 1).round().astype(np.int32)


def footprint_local(b: Bldg, pad_px: int = 0):
    """Tapak bangunan sebagai topeng kecil + potongan (sy, sx) di gambar penuh."""
    pts = np.concatenate([_poly_px(r.corners()) for r in b.rects])
    x0, y0 = max(int(pts[:, 0].min()) - pad_px - 1, 0), max(int(pts[:, 1].min()) - pad_px - 1, 0)
    x1, y1 = min(int(pts[:, 0].max()) + pad_px + 2, W), min(int(pts[:, 1].max()) + pad_px + 2, H)
    if x0 >= x1 or y0 >= y1:
        return None
    m = np.zeros((y1 - y0, x1 - x0), np.uint8)
    for r in b.rects:
        cv2.fillPoly(m, [_poly_px(r.corners()) - np.array([x0, y0], np.int32)], 1)
    return (slice(y0, y1), slice(x0, x1)), m.astype(bool)


def footprint(b: Bldg) -> np.ndarray:
    out = np.zeros((H, W), bool)
    res = footprint_local(b)
    if res:
        (sy, sx), m = res
        out[sy, sx] = m
    return out


def grow(mask: np.ndarray, meters: float) -> np.ndarray:
    """Perlebar topeng sejauh `meters` (pakai distance transform, cepat untuk radius besar)."""
    d = cv2.distanceTransform((~mask).astype(np.uint8), cv2.DIST_L2, 5)
    return d <= meters / GSD


# ---------------------------------------------------------------- dunia sebelum bencana
def paint_world(lay: Layout, nz: Noise) -> Canvas:
    rng = rng_for("paint", lay.asset["id"], lay.theta)
    cv = Canvas()
    land = lay.land

    g = np.clip((0.6 * nz.big + 0.4 * nz.mid - 0.40) / 0.22, 0, 1)[..., None]
    base = _rgb((156, 132, 98)) * (1 - g) + _rgb((96, 126, 64)) * g
    dry = nz.dry[..., None]
    base = base * (1 - 0.35 * dry) + _rgb((140, 140, 88)) * 0.35 * dry
    cv.alb[:] = base * (0.93 + 0.14 * nz.fine[..., None])
    cv.mat[:] = np.where(g[..., 0] > 0.5, GRASS, SOIL)

    # pekarangan
    yard = np.zeros((H, W), np.uint8)
    for b in lay.buildings:
        pad = 2.4 if b.kind == "rumah" else 4.0
        for r in b.rects:
            cv2.fillPoly(yard, [_poly_px(r.corners(pad))], 1)
    yard = yard.astype(bool) & land
    cv.alb[yard] = _rgb((168, 160, 146)) * (0.92 + 0.12 * nz.n5[yard])[:, None]
    cv.mat[yard] = YARD

    # laut, pantai, buih
    sea = ~land
    cv.hgt[sea] = np.nan
    if sea.any():
        d_sea = cv2.distanceTransform(sea.astype(np.uint8), cv2.DIST_L2, 5) * GSD
        d_land = cv2.distanceTransform(land.astype(np.uint8), cv2.DIST_L2, 5) * GSD
        depth = np.clip(d_sea / 70, 0, 1)[..., None]
        wave = 0.94 + 0.08 * np.sin(XX * 0.9 + YY * 0.55 + 6 * nz.n30)[..., None]
        col = (_rgb((54, 132, 140)) * (1 - depth) + _rgb((24, 74, 100)) * depth) * wave
        cv.alb[sea] = col[sea]
        cv.alb[sea & (d_sea < 1.6)] = _rgb((214, 222, 218))
        beach = land & (d_land < rng.uniform(7, 12))
        cv.alb[beach] = _rgb((212, 196, 158)) * (0.94 + 0.1 * nz.n5[beach])[:, None]
        cv.mat[beach] = SAND
        cv.mat[sea] = SEA

    # sungai
    if lay.river:
        hw, ph = lay.river
        u = XX * lay.a[0] + YY * lay.a[1]
        w = XX * lay.n[0] + YY * lay.n[1]
        du = np.abs(u - 4 * np.sin(w / 23 + ph))
        river, bank = du < hw, (du >= hw) & (du < hw + 3.0)
        cv.alb[bank] = _rgb((116, 104, 80)) * (0.9 + 0.15 * nz.n5[bank])[:, None]
        cv.mat[bank] = SOIL
        cv.alb[river] = _rgb((84, 102, 86)) * (0.93 + 0.1 * nz.n30[river])[:, None]
        cv.mat[river] = RIVER
        cv.hgt[river] = np.nan

    # jalan
    for origin, d, halfw in lay.roads:
        nrm = np.array([-d[1], d[0]])
        s = (XX - origin[0]) * nrm[0] + (YY - origin[1]) * nrm[1]
        road = (np.abs(s) < halfw) & land & ~np.isnan(cv.hgt)
        if not road.any():
            continue
        t = (XX - origin[0]) * d[0] + (YY - origin[1]) * d[1]
        cv.alb[road] = _rgb((74, 76, 79)) * (0.95 + 0.1 * nz.n8[road])[:, None]
        cv.alb[road & (np.abs(s) > halfw - 0.45)] = _rgb((124, 124, 120))
        cv.alb[road & (np.abs(s) < 0.13) & (np.sin(2 * np.pi * t / 6.0) > 0.15)] = _rgb((222, 220, 204))
        cv.mat[road] = ASPHALT

    # lapangan sekolah & parkir
    for ar, kind, color in lay.areas:
        res = ar.local()
        if res is None:
            continue
        (sy, sx), inside, t, s = res
        alb, mat = cv.alb[sy, sx], cv.mat[sy, sx]
        alb[inside] = _rgb(color) * (0.95 + 0.05 * rng.random())
        mat[inside] = kind
        if kind == FIELD:
            e1, e2 = ar.hl - 2.5, ar.hw - 2.5
            line = inside & (((np.abs(np.abs(t) - e1) < 0.14) & (np.abs(s) <= e2))
                             | ((np.abs(np.abs(s) - e2) < 0.14) & (np.abs(t) <= e1))
                             | ((np.abs(t) < 0.12) & (np.abs(s) <= e2)))
            alb[line] = _rgb((236, 236, 230))
        else:
            alb[inside & (np.abs(np.mod(t + 200, 2.6) - 1.3) < 0.08) & (np.abs(s) > 1.2)] = _rgb((206, 206, 200))

    for b in lay.buildings:
        paint_roof(cv, b, nz)
    for x, y, rad, h, color in lay.trees:
        paint_tree(cv, x, y, rad, h, color, nz)
    for r, color in lay.cars:
        paint_car(cv, r, color)
    return cv


def paint_roof(cv: Canvas, b: Bldg, nz: Noise):
    base = _rgb(b.color)
    for r in b.rects:
        res = r.local()
        if res is None:
            continue
        (sy, sx), inside, t, s = res
        c, sn = math.cos(r.ang), math.sin(r.ang)
        a_vec, n_vec = np.array([c, sn]), np.array([-sn, c])
        alb, hgt, mat, fac = cv.alb[sy, sx], cv.hgt[sy, sx], cv.mat[sy, sx], cv.facet[sy, sx]
        jitter = nz.rand[sy, sx]
        if b.style == "deck":
            col = np.broadcast_to(base, t.shape + (3,)).copy()
            rail = np.abs(s) > r.hw - 0.42
            col[rail] = _rgb((198, 200, 198))
            col[(np.abs(s) < 0.12) & (np.sin(2 * np.pi * t / 5.0) > 0.1)] = _rgb((226, 214, 150))
            hh = np.where(rail, b.ridge + 0.9, b.ridge).astype(np.float32)
            facet = np.zeros_like(t)
        elif b.style == "hip":
            ds, dt = r.hw - np.abs(s), r.hl - np.abs(t)
            long_side = ds <= dt
            nx = np.where(long_side, np.sign(s) * n_vec[0], np.sign(t) * a_vec[0])
            ny = np.where(long_side, np.sign(s) * n_vec[1], np.sign(t) * a_vec[1])
            facet = nx * SUN[0] + ny * SUN[1]
            dmin = np.minimum(ds, dt)
            hh = b.eave + (b.ridge - b.eave) * np.clip(dmin / r.hw, 0, 1)
            shade = 1 + 0.2 * facet
            shade = np.where((np.abs(ds - dt) < 0.22) & (dmin > 0.4), shade * 1.06, shade)
            shade = np.where((np.abs(s) < 0.22) & (np.abs(t) < r.hl - r.hw), shade * 1.07, shade)
            col = base * shade[..., None]
        else:  # pelana
            facet = np.sign(s) * float(n_vec @ SUN)
            hh = b.eave + (b.ridge - b.eave) * (1 - np.abs(s) / r.hw)
            shade = 1 + 0.2 * facet
            shade = np.where(np.abs(s) < 0.22, shade * 1.08, shade)
            col = base * shade[..., None]
        if b.style != "deck":
            tex = 1 + (0.045 * np.sin(2 * np.pi * t / 0.9) if b.mat == TILE else 0.04 * np.sin(2 * np.pi * s / 0.7))
            tex = tex + 0.05 * (jitter - 0.5)
            tex = np.where((r.hw - np.abs(s) < 0.35) | (r.hl - np.abs(t) < 0.35), tex * 0.8, tex)
            col = col * tex[..., None]
        alb[inside] = np.clip(col[inside], 0, 1)
        hgt[inside] = hh[inside]
        mat[inside] = b.mat
        fac[inside] = facet[inside]


def paint_tree(cv: Canvas, x, y, rad, h, color, nz: Noise):
    res = Rect(x, y, rad * 1.15, rad * 1.15, 0.0).local()
    if res is None:
        return
    (sy, sx), _, _, _ = res
    X, Y = XX[sy, sx] - x, YY[sy, sx] - y
    d = np.hypot(X, Y)
    ang = np.arctan2(Y, X)
    inside = d <= rad * (1 + 0.09 * np.sin(5 * ang + x) + 0.05 * np.sin(9 * ang + y))
    q = np.clip(d / rad, 0, 1)
    lit = 0.7 + 0.3 * (1 - q * q) + 0.24 * (X * SUN[0] + Y * SUN[1]) / rad
    leaf = cv2.blur(0.86 + 0.28 * nz.rand[sy, sx], (2, 2))
    col = _rgb(color) * (lit * leaf)[..., None]
    cv.alb[sy, sx][inside] = np.clip(col[inside], 0, 1)
    cv.hgt[sy, sx][inside] = (h * (1 - 0.45 * q * q))[inside]
    cv.mat[sy, sx][inside] = TREE


def paint_car(cv: Canvas, r: Rect, color):
    res = r.local()
    if res is None:
        return
    (sy, sx), inside, t, s = res
    alb, hgt, mat = cv.alb[sy, sx], cv.hgt[sy, sx], cv.mat[sy, sx]
    keep = inside & (mat != RIVER) & ~np.isnan(hgt)
    col = np.broadcast_to(_rgb(color), t.shape + (3,)).copy()
    glass = (t > 0.15 * r.hl) & (t < 0.55 * r.hl) & (np.abs(s) < r.hw * 0.85)
    col[glass] *= 0.35
    alb[keep] = col[keep]
    hgt[keep] = 1.5
    mat[keep] = CAR


# ---------------------------------------------------------------- cahaya
def shadow_map(h: np.ndarray) -> np.ndarray:
    hz = np.nan_to_num(h, nan=0.0)
    sh = np.zeros(hz.shape, bool)
    step_m = GSD * math.sqrt(2) * SUN_TAN
    kmax = int(math.ceil(max(float(hz.max()), 0.5) / step_m)) + 1
    k = 1
    while k <= kmax:
        sh[k:, k:] |= (hz[:-k, :-k] - hz[k:, k:]) > k * step_m
        k += 1 if k < 6 else 2
    return cv2.GaussianBlur(sh.astype(np.float32), (0, 0), 0.9)


def compose(cv: Canvas, shadow: np.ndarray, rng, post: bool) -> np.ndarray:
    rgb = cv.alb * (1 - 0.43 * shadow)[..., None]
    rgb += np.array([0.0, 0.006, 0.022], np.float32) * shadow[..., None]
    if post:   # pemotretan sesudah bencana: cahaya sedikit berbeda
        rgb = rgb * np.array([0.965, 0.975, 0.99], np.float32) + 0.008
    rgb = rgb * VIGNETTE + 0.009 * rng.standard_normal(rgb.shape, dtype=np.float32)
    return (np.clip(rgb, 0, 1) * 255 + 0.5).astype(np.uint8)


# ---------------------------------------------------------------- kerusakan
def damage_building(cv: Canvas, pre: Canvas, b: Bldg, nz: Noise, rng) -> np.ndarray:
    """Gambar atap rusak/puing sesuai porsi b.r. Mengembalikan topeng piksel atap rusak (gambar penuh)."""
    out = np.zeros((H, W), bool)
    if b.r <= 0.004:
        return out
    pad = int(5.5 / GSD)
    res = footprint_local(b, pad)
    if res is None:
        return out
    (sy, sx), fpb = res
    if not fpb.any():
        return out
    alb, hgt, mat = cv.alb[sy, sx], cv.hgt[sy, sx], cv.mat[sy, sx]

    if b.kind == "jembatan":
        r = b.rects[0]
        lres = r.local()
        if lres is None:
            return out
        (ry, rx), inside, t, _ = lres
        tc = rng.uniform(-0.3, 0.3) * r.hl
        sect = np.zeros((H, W), bool)
        sect[ry, rx] = inside & (np.abs(t - tc) < b.r * r.hl)
        dm = sect & footprint(b)
        ripple = 0.78 + 0.3 * nz.n12[dm] + 0.18 * (nz.rand[dm] > 0.93)
        cv.alb[dm] = _rgb((34, 50, 50)) * ripple[:, None]
        cv.hgt[dm] = np.nan
        cv.mat[dm] = HOLE
        if b.r >= 0.3:   # lempengan yang jatuh ke sungai
            for _ in range(int(rng.integers(2, 4))):
                off = tc + rng.uniform(-0.6, 0.6) * b.r * r.hl
                sl = Rect(float(r.cx + math.cos(r.ang) * off), float(r.cy + math.sin(r.ang) * off),
                          rng.uniform(2.5, 5.5), r.hw * rng.uniform(0.6, 0.95), r.ang + rng.uniform(-0.35, 0.35))
                q = sl.local()
                if q is None:
                    continue
                (qy, qx), qin, _, _ = q
                m2 = np.zeros((H, W), bool)
                m2[qy, qx] = qin
                m2 &= dm
                cv.alb[m2] = np.clip(nz.rubble[m2] * 1.08, 0, 1)   # lempengan patah: beton pecah berdebu
                cv.hgt[m2] = rng.uniform(-1.8, -1.0)
                cv.mat[m2] = RUBBLE
        return dm

    w_big = min(1.0, b.r * 1.3)
    field = (1 - w_big) * nz.n8[sy, sx] + w_big * nz.n30[sy, sx] + 0.04 * nz.rand[sy, sx]
    thr = np.quantile(field[fpb], 1 - b.r)
    dmb = fpb & (field >= thr)
    kind = nz.n12[sy, sx]
    hole = dmb & (kind > (0.32 if b.r < 0.4 else 0.8))
    rub = dmb & ~hole

    if hole.any():
        rafter = 0.75 + 0.35 * (np.sin(2 * np.pi * (XX[sy, sx] + YY[sy, sx]) / 0.9) > 0.55)
        col = _rgb((46, 39, 33)) * (rafter * (0.85 + 0.3 * nz.rand[sy, sx]))[..., None]
        alb[hole] = col[hole]
        hgt[hole] = (0.3 + 0.4 * nz.rand[sy, sx])[hole]
        mat[hole] = HOLE
    if rub.any():
        col = nz.rubble[sy, sx].copy()
        frag = nz.frag[sy, sx]
        col[frag] = _rgb(b.color) * 0.78
        alb[rub] = col[rub]
        hgt[rub] = (0.35 + (1.9 if b.r < 0.75 else 1.2) * nz.n5[sy, sx])[rub]
        mat[rub] = RUBBLE
    if b.r >= 0.55:   # puing tumpah ke luar bangunan
        d = cv2.distanceTransform((~fpb).astype(np.uint8), cv2.DIST_L2, 3) * GSD
        apron = (d > 0) & (d < 1.5 + 3.5 * b.r) & np.isin(mat, GROUND) & (nz.n12[sy, sx] > 0.42)
        alb[apron] = nz.rubble[sy, sx][apron] * 0.95
        hgt[apron] = (0.15 + 0.5 * nz.rand[sy, sx])[apron]
        mat[apron] = RUBBLE
    if b.r < 0.45:    # retak halus pada atap yang masih berdiri
        crack = np.zeros(fpb.shape, np.uint8)
        ys, xs = np.where(fpb & ~dmb)
        for _ in range(int(rng.integers(2, 6)) if len(ys) else 0):
            j = int(rng.integers(len(ys)))
            p = np.array([xs[j], ys[j]], np.float32)
            ang = rng.uniform(0, 2 * math.pi)
            pts = [p.copy()]
            for _ in range(int(rng.integers(5, 12))):
                ang += rng.normal(0, 0.5)
                p = p + np.array([math.cos(ang), math.sin(ang)], np.float32) * rng.uniform(3, 7)
                pts.append(p.copy())
            cv2.polylines(crack, [np.array(pts, np.int32)], False, 1, 1)
        c = crack.astype(bool) & fpb & ~dmb
        alb[c] *= 0.45
    out[sy, sx] = dmb
    return out


def vol_loss(h_pre: np.ndarray, h_post: np.ndarray, fp: np.ndarray, href: float) -> float:
    a, b = h_pre[fp], h_post[fp]
    d = np.where(np.isnan(b), href, np.abs(np.nan_to_num(b) - np.nan_to_num(a)))
    return float(np.clip(d / href, 0, 1).mean()) if len(d) else 0.0


def sag_to_volume(cv: Canvas, pre: Canvas, fp: np.ndarray, dm: np.ndarray, target_v: float, href: float):
    """Turunkan atap yang masih utuh (tak terlihat kamera) sampai hilang volume mendekati target LiDAR."""
    cur = vol_loss(pre.hgt, cv.hgt, fp, href)
    if target_v - cur < 0.02:
        return
    need = (target_v - cur) * fp.sum()
    cand = fp & ~dm & ~np.isnan(pre.hgt)
    if not cand.any():
        return
    dist = cv2.distanceTransform((~dm).astype(np.uint8), cv2.DIST_L2, 5)
    ys, xs = np.where(cand)
    order = np.argsort(dist[ys, xs], kind="stable")
    k = 0.45
    cum = np.cumsum(k * pre.hgt[ys, xs][order] / href)
    m = int(np.searchsorted(cum, need)) + 1
    if m > len(order):
        k = min(0.8, k * need / max(float(cum[-1]), 1e-6))
        m = len(order)
    sel = order[:m]
    cv.hgt[ys[sel], xs[sel]] = pre.hgt[ys[sel], xs[sel]] * (1 - k)


def apply_wet(cv: Canvas, fp: np.ndarray, d_water: float, nz: Noise, rng) -> tuple[np.ndarray, np.ndarray]:
    ground = np.isin(cv.mat, GROUND)
    ring = grow(fp, 15.0) & ~fp & ground
    wet = np.zeros((H, W), bool)
    if d_water < 0.02 or not ring.any():
        return wet, ring
    water = np.isnan(cv.hgt) | np.isin(cv.mat, (SEA, RIVER))
    field = nz.n45.copy()
    if water.any():
        dw = cv2.distanceTransform((~water).astype(np.uint8), cv2.DIST_L2, 5) * GSD
        field += 0.8 * np.exp(-dw / 55)
    thr = np.quantile(field[ring], 1 - min(d_water, 0.98))
    wet = ground & (field >= thr)
    pool = wet & (field >= (np.quantile(field[wet], 0.62) if wet.any() else np.inf))
    mud = wet & ~pool
    cv.alb[mud] = _rgb((126, 102, 72)) * (0.9 + 0.18 * nz.n5[mud])[:, None]
    cv.alb[pool] = _rgb((72, 84, 88)) * (0.92 + 0.14 * nz.n12[pool])[:, None]
    cv.mat[mud] = MUD
    cv.mat[pool] = POOL

    # sampah tsunami: papan kayu & lembaran seng
    ys, xs = np.where(wet)
    n = int(d_water * 170) if len(ys) else 0
    deb = np.zeros((H, W), np.uint8)
    for j in rng.integers(0, max(len(ys), 1), size=n):
        x, y = float(XX[ys[j], xs[j]]), float(YY[ys[j], xs[j]])
        if rng.random() < 0.6:
            r, k = Rect(x, y, rng.uniform(1.0, 2.2), rng.uniform(0.12, 0.22), rng.uniform(0, math.pi)), 1
        else:
            r = Rect(x, y, rng.uniform(0.7, 1.3), rng.uniform(0.4, 0.7), rng.uniform(0, math.pi))
            k = int(rng.choice([2, 2, 3, 4]))
        cv2.fillPoly(deb, [_poly_px(r.corners())], k)
    m = (deb > 0) & (wet | np.isin(cv.mat, GROUND))
    cv.alb[m] = DEBRIS_COLORS[deb[m]] * (0.8 + 0.3 * nz.rand[m])[:, None]
    cv.mat[m] = DEBRIS
    cv.hgt[m] = 0.25
    return wet, ring


def thermal(cv: Canvas, shadow: np.ndarray, rng) -> np.ndarray:
    t = TEMP[cv.mat] + 3.2 * cv.facet * np.isin(cv.mat, (TILE, METAL)) - 6.5 * shadow
    t = t + 0.35 * rng.standard_normal(t.shape, dtype=np.float32)
    t = cv2.GaussianBlur(t, (0, 0), 1.4)
    return t + 0.05 * rng.standard_normal(t.shape, dtype=np.float32)


# ---------------------------------------------------------------- satu adegan lengkap
def roof_target(asset: dict, rng) -> float:
    cls = int(round(float(asset.get("d_surf", 0)) * 3))
    lo, hi = ROOF_BANDS[min(max(cls, 0), 3)]
    return float(rng.uniform(lo, hi))


def render_scene(asset: dict, seed: int) -> Scene:
    lay = Layout(asset, seed).build()
    rng = rng_for("damage", seed, asset["id"])
    nz = Noise(rng_for("noise", seed, asset["id"]))
    pre = paint_world(lay, nz)
    post = pre.copy()

    tgt = lay.buildings[0]
    tgt.r = roof_target(asset, rng)
    tgt.v = float(np.clip(asset.get("d_vol", 0), 0, 1))
    fp = footprint(tgt)
    href = 3.0 if tgt.kind == "jembatan" else (float(np.nanpercentile(pre.hgt[fp], 95)) if fp.any() else 6.0)

    wet, ring = apply_wet(post, fp, float(np.clip(asset.get("d_water", 0), 0, 1)), nz, rng)

    # rumah sekitar: rusaknya ikut pola kawasan (lebih parah dekat laut)
    sea = ~lay.land
    dsea = cv2.distanceTransform(lay.land.astype(np.uint8), cv2.DIST_L2, 5) * GSD if sea.any() else None
    for b in lay.buildings[1:]:
        r0 = tgt.r * rng.uniform(0.55, 1.25) + rng.normal(0, 0.12)
        if dsea is not None:
            c = b.rects[0]
            u, v = int(W / 2 + c.cx / GSD), int(H / 2 - c.cy / GSD)
            if 0 <= u < W and 0 <= v < H:
                r0 += 0.35 * math.exp(-float(dsea[v, u]) / 45)
        b.r = float(np.clip(r0, 0, 0.97)) if rng.random() > 0.08 else 0.0
        damage_building(post, pre, b, nz, rng)

    dm = damage_building(post, pre, tgt, nz, rng)
    h_visual = post.hgt.copy()          # bayangan mengikuti bentuk yang terlihat
    if tgt.kind != "jembatan":
        sag_to_volume(post, pre, fp, dm, tgt.v, href)   # deformasi halus: hanya LiDAR yang "melihat"

    sh_pre, sh_post = shadow_map(pre.hgt), shadow_map(h_visual)
    rgb_pre = compose(pre, sh_pre, rng_for("noise-pre", seed, asset["id"]), post=False)
    rgb_post = compose(post, sh_post, rng_for("noise-post", seed, asset["id"]), post=True)
    t_post = thermal(post, sh_post, rng)
    lidar = rng_for("lidar", seed, asset["id"])
    h_pre = pre.hgt + 0.04 * lidar.standard_normal(pre.hgt.shape, dtype=np.float32)
    h_post = post.hgt + 0.04 * lidar.standard_normal(post.hgt.shape, dtype=np.float32)

    roof_true = float(dm[fp].mean()) if fp.any() else 0.0
    truth = {
        "roof": roof_true,
        "cls": damage_class(roof_true),
        "vol": vol_loss(pre.hgt, post.hgt, fp, href),
        "wet": float(wet[ring].mean()) if ring.any() else 0.0,
        "n_buildings": len(lay.buildings),
    }
    info = {"kind": tgt.kind, "theta": lay.theta, "href": href, "coastal": bool(sea.any()),
            "has_river": lay.river is not None}
    return Scene(asset["id"], tgt.kind, rgb_pre, rgb_post, h_pre, h_post, t_post, fp, truth, info)
