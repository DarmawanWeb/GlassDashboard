"""Analisis "AI" GLASS untuk citra drone.

Mode misi (simulasi): seperti pipeline xBD dua tahap.
  1. Lokasi bangunan: tapak aset dari daftar BMN + bangunan lain dari model tinggi sebelum bencana (digital twin).
  2. Penilaian kerusakan: bandingkan citra sesudah vs sebelum di dalam tiap tapak (deteksi perubahan).
  + LiDAR: hilang volume dari beda tinggi sebelum/sesudah.
  + Termal: area basah = piksel dingin yang bukan tumbuhan.

Mode video (unggahan), dua cara:
  - Ada video sebelum bencana: tiap gambar disejajarkan ke gambar sebelum (align.py), lalu bangunan dicari di
    gambar sebelum dan kerusakannya = bagian bangunan yang berubah. Cara ini sama dengan mode misi.
  - Hanya video sesudah: tekstur kasar abu-abu = puing, permukaan rata berwarna = atap utuh, cokelat/gelap halus
    = genangan. Ini aturan visi komputer sederhana, bukan model yang dilatih; untuk video asli lebih baik
    ditambah VLM (lihat vlm.py).
Di kedua cara, area terbangun dipecah menjadi bangunan (komponen terhubung) dan tiap bangunan diberi kelas.
"""
from __future__ import annotations

import cv2
import numpy as np

from .scene import CLASS_LABELS, GSD, Scene, damage_class

ZONE_RGB = [(12, 163, 12), (250, 178, 25), (236, 131, 90), (208, 59, 59)]
K3 = np.ones((3, 3), np.uint8)
K5 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))


def _lab(rgb: np.ndarray) -> np.ndarray:
    return cv2.cvtColor(rgb.astype(np.float32) / 255.0, cv2.COLOR_RGB2Lab)


def local_std(x: np.ndarray, k: int = 7) -> np.ndarray:
    m = cv2.blur(x, (k, k))
    m2 = cv2.blur(x * x, (k, k))
    return np.sqrt(np.maximum(m2 - m * m, 0))


def coherence(lum: np.ndarray, sigma: float = 3.0) -> np.ndarray:
    gx = cv2.Sobel(lum, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(lum, cv2.CV_32F, 0, 1, ksize=3)
    jxx = cv2.GaussianBlur(gx * gx, (0, 0), sigma)
    jyy = cv2.GaussianBlur(gy * gy, (0, 0), sigma)
    jxy = cv2.GaussianBlur(gx * gy, (0, 0), sigma)
    return np.sqrt((jxx - jyy) ** 2 + 4 * jxy ** 2) / (jxx + jyy + 1e-3)


def exg(rgb: np.ndarray) -> np.ndarray:
    f = rgb.astype(np.float32)
    return (2 * f[..., 1] - f[..., 0] - f[..., 2]) / (f.sum(2) + 1)


def change_map(pre: np.ndarray, post: np.ndarray) -> np.ndarray:
    l1 = _lab(cv2.GaussianBlur(pre, (3, 3), 0))
    l2 = _lab(cv2.GaussianBlur(post, (3, 3), 0))
    de = np.linalg.norm(l2 - l1, axis=2)
    tex = local_std(l2[..., 0], 5) - local_std(l1[..., 0], 5)
    ch = ((de > 14) | ((tex > 8) & (de > 7))).astype(np.uint8)
    ch = cv2.morphologyEx(ch, cv2.MORPH_OPEN, K3)
    ch = cv2.morphologyEx(ch, cv2.MORPH_CLOSE, K3)
    return ch.astype(bool)


def _polygon(mask: np.ndarray, x0: int, y0: int) -> list[list[int]]:
    cs, _ = cv2.findContours(mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not cs:
        return []
    c = max(cs, key=cv2.contourArea)
    c = cv2.approxPolyDP(c, 1.4, True)[:, 0, :]
    return [[int(x + x0), int(y + y0)] for x, y in c]


def analyze_scene(sc: Scene) -> dict:
    """Nilai kerusakan aset target + bangunan sekitar dari tiga sensor drone."""
    valid = ~np.isnan(sc.h_pre)
    changed = change_map(sc.rgb_pre, sc.rgb_post)
    fp = sc.target_fp

    # 1) kamera RGB: porsi tapak yang berubah
    roof = float(changed[fp].mean()) if fp.any() else 0.0

    # 2) LiDAR: hilang volume (beda tinggi relatif tinggi bangunan)
    hp, hq = sc.h_pre[fp], sc.h_post[fp]
    href = float(np.nanpercentile(hp, 95)) if np.isfinite(hp).any() else 3.0
    if sc.kind == "jembatan" or href < 2.0:
        href = 3.0
    d = np.where(np.isnan(hq), href, np.abs(np.nan_to_num(hq) - np.nan_to_num(hp)))
    vol = float(np.clip(d / href, 0, 1).mean()) if len(d) else 0.0

    # 3) termal: tanah dingin & bukan tumbuhan di cincin 15 m sekitar aset
    g_post = exg(sc.rgb_post)
    tall = np.nan_to_num(sc.h_pre, nan=0.0) > 2.0
    dist = cv2.distanceTransform((~fp).astype(np.uint8), cv2.DIST_L2, 5) * GSD
    ring = (dist > 0) & (dist <= 15) & valid & ~tall
    wet_all = valid & ~tall & (sc.t_post < 29.8) & (g_post < 0.06)
    wet = float(wet_all[ring].mean()) if ring.any() else 0.0

    cls = damage_class(roof)
    agree = 1 - min(abs(roof - vol), 0.6)
    confidence = float(np.clip(0.55 + 0.4 * agree, 0.4, 0.97))

    # bangunan lain dari digital twin (tinggi > 2 m, bukan pohon)
    trees = tall & (exg(sc.rgb_pre) > 0.05)
    bld = cv2.morphologyEx((tall & ~trees).astype(np.uint8), cv2.MORPH_OPEN, K3)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(bld, connectivity=8)
    dets = []
    ys, xs = np.where(fp)
    if len(ys):
        x0, y0, x1, y1 = int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1
        dets.append({"id": sc.asset_id, "target": True, "cls": cls, "pct": round(roof * 100, 1),
                     "bbox": [x0, y0, x1, y1], "poly": _polygon(fp[y0:y1, x0:x1], x0, y0)})
    min_px = int(16 / (GSD * GSD))
    others = []
    for i in range(1, n):
        x, y, w, h, area = (int(v) for v in stats[i])
        if area < min_px:
            continue
        m = lab[y:y + h, x:x + w] == i
        if (m & fp[y:y + h, x:x + w]).sum() > 0.3 * area:
            continue
        frac = float(changed[y:y + h, x:x + w][m].mean())
        others.append((area, x, y, w, h, m, frac))
    others.sort(key=lambda o: -o[0])
    for k, (_, x, y, w, h, m, frac) in enumerate(others[:80]):
        dets.append({"id": f"B{k + 1}", "target": False, "cls": damage_class(frac), "pct": round(frac * 100, 1),
                     "bbox": [x, y, x + w, y + h], "poly": _polygon(m, x, y)})
    severe = sum(1 for d in dets if not d["target"] and d["cls"] >= 2)

    overlay = ai_overlay(sc.rgb_post, changed, wet_all, [d for d in dets])
    return {
        "estimate": {
            "roof": round(roof, 4), "vol": round(vol, 4), "wet": round(wet, 4),
            "cls": cls, "label": CLASS_LABELS[cls], "confidence": round(confidence, 3),
            "d_surf": round(roof, 4), "d_vol": round(vol, 4), "d_water": round(wet, 4),
        },
        "area": {"n_buildings": len(others), "n_severe": severe},
        "detections": dets,
        "_overlay": overlay,
    }


def ai_overlay(post: np.ndarray, changed: np.ndarray, wet: np.ndarray, dets: list[dict]) -> np.ndarray:
    """Citra 'mata AI': rusak = merah, genangan = biru, di atas foto yang diredupkan."""
    base = post.astype(np.float32) * 0.5 + 34
    bmask = np.zeros(changed.shape, np.uint8)
    for d in dets:
        if len(d["poly"]) >= 3:
            cv2.fillPoly(bmask, [np.array(d["poly"], np.int32)], 1)
    in_b = changed & bmask.astype(bool)
    out_b = changed & ~bmask.astype(bool) & ~wet
    base[wet] = base[wet] * 0.45 + np.array([42, 120, 214], np.float32) * 0.55
    base[out_b] = base[out_b] * 0.7 + np.array([236, 131, 90], np.float32) * 0.3
    base[in_b] = base[in_b] * 0.3 + np.array([232, 56, 64], np.float32) * 0.7
    return np.clip(base, 0, 255).astype(np.uint8)


# ---------------------------------------------------------------- pewarnaan sensor
def _lut(stops: list[tuple[float, tuple[int, int, int]]]) -> np.ndarray:
    xs = np.linspace(0, 1, 256)
    pos = [p for p, _ in stops]
    return np.stack([np.interp(xs, pos, [c[i] for _, c in stops]) for i in range(3)], 1).astype(np.uint8)


TURBO = _lut([(0, (48, 18, 59)), (0.13, (65, 105, 225)), (0.27, (39, 172, 236)), (0.4, (29, 228, 180)),
              (0.53, (126, 254, 85)), (0.66, (213, 230, 41)), (0.78, (253, 165, 39)), (0.9, (232, 74, 18)),
              (1, (122, 4, 3))])
IRONBOW = _lut([(0, (6, 4, 22)), (0.16, (40, 6, 98)), (0.33, (124, 10, 146)), (0.5, (206, 40, 96)),
                (0.66, (240, 104, 26)), (0.82, (251, 186, 34)), (1, (255, 248, 214))])
LIDAR_RANGE = (-0.5, 11.0)
THERMAL_RANGE = (22.0, 56.0)


def lidar_rgb(h: np.ndarray) -> np.ndarray:
    lo, hi = LIDAR_RANGE
    hz = np.nan_to_num(h, nan=0.0)
    q = np.clip((hz - lo) / (hi - lo), 0, 1)
    col = TURBO[(q * 255).astype(np.uint8)].astype(np.float32)
    gy, gx = np.gradient(cv2.GaussianBlur(hz, (0, 0), 0.8), GSD)
    slope = np.arctan(np.hypot(gx, gy))
    aspect = np.arctan2(-gx, gy)
    az, zen = np.radians(315), np.radians(45)
    shade = np.cos(zen) * np.cos(slope) + np.sin(zen) * np.sin(slope) * np.cos(az - aspect)
    col *= (0.55 + 0.5 * np.clip(shade, 0, 1))[..., None]
    col[np.isnan(h)] = (14, 22, 34)
    return np.clip(col, 0, 255).astype(np.uint8)


def thermal_rgb(t: np.ndarray) -> np.ndarray:
    lo, hi = THERMAL_RANGE
    q = np.clip((t - lo) / (hi - lo), 0, 1)
    return IRONBOW[(q * 255).astype(np.uint8)]


def jpeg(rgb: np.ndarray, quality: int = 84) -> bytes:
    ok, buf = cv2.imencode(".jpg", cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, quality])
    if not ok:
        raise RuntimeError("gagal membuat JPEG")
    return buf.tobytes()


# ---------------------------------------------------------------- video unggahan
def segment(rgb: np.ndarray) -> dict[str, np.ndarray]:
    """Kelas piksel kasar dari satu foto udara: tumbuhan, langit, genangan, puing, atap utuh."""
    hh, ww = rgb.shape[:2]
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV).astype(np.float32)
    hue, sat, val = hsv[..., 0] * 2, hsv[..., 1] / 255, hsv[..., 2] / 255
    lum = _lab(rgb)[..., 0]
    std = local_std(lum, 9)
    veg = (exg(rgb) > 0.07) & (sat > 0.12)

    # langit (video miring): area terang & halus yang menyentuh tepi atas
    sky_seed = (val > 0.62) & (std < 3.5) & (sat < 0.45)
    n, labl, stats, _ = cv2.connectedComponentsWithStats(sky_seed.astype(np.uint8), 8)
    sky = np.zeros_like(sky_seed)
    for i in range(1, n):
        if stats[i, 1] == 0 and stats[i, 4] > 0.01 * hh * ww:
            sky |= labl == i

    water = (std < 5.5) & ~veg & ~sky & (
        ((hue > 14) & (hue < 48) & (sat > 0.25) & (sat < 0.7) & (val > 0.18) & (val < 0.52))
        | ((val < 0.42) & (sat > 0.14) & (sat < 0.45) & (hue > 160) & (hue < 220) & (std < 4))
    )
    # puing: tekstur kasar, warna kusam; lubang atap: gelap & kasar
    coh = coherence(lum)          # 0 = acak ke segala arah (puing), 1 = searah (tepi jalan, garis seng)
    sat_s, val_s = cv2.GaussianBlur(sat, (0, 0), 2.0), cv2.GaussianBlur(val, (0, 0), 2.0)
    rubble = ((std > 8) & (sat_s < 0.36) & (val_s < 0.66) & (coh < 0.65)) | ((val_s < 0.22) & (std > 8))
    rubble &= ~veg & ~sky & ~water
    rubble = cv2.morphologyEx(rubble.astype(np.uint8), cv2.MORPH_OPEN, K5)       # buang garis tipis (marka, tepi)
    rubble = cv2.morphologyEx(rubble, cv2.MORPH_CLOSE, K3).astype(bool)
    # atap utuh: genteng/seng berwarna, atau seng/beton terang yang halus
    brownish = (hue > 22) & (hue < 52) & (sat < 0.5)
    intact = ~veg & ~sky & ~water & ~rubble & (
        ((sat > 0.35) & (val > 0.28) & ~brownish) | ((sat < 0.12) & (val > 0.55) & (std < 7)))
    return {"veg": veg, "sky": sky, "water": water, "rubble": rubble, "intact": intact}


def buildings(built: np.ndarray, damaged: np.ndarray, min_px: int) -> list[dict]:
    """Bangunan = komponen terhubung dari area terbangun; kelasnya dari porsi piksel yang rusak."""
    m = cv2.morphologyEx(built.astype(np.uint8), cv2.MORPH_CLOSE, K5)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(m, connectivity=8)
    out = []
    for i in range(1, n):
        x, y, w, h, area = (int(v) for v in stats[i])
        if area < min_px:
            continue
        comp = lab[y:y + h, x:x + w] == i
        frac = float(damaged[y:y + h, x:x + w][comp].mean())
        out.append({"area": area, "cls": damage_class(frac), "pct": round(frac * 100, 1),
                    "bbox": [x, y, x + w, y + h], "poly": _polygon(comp, x, y)})
    out.sort(key=lambda d: -d["area"])
    return out[:60]


def _frame_overlay(rgb: np.ndarray, damaged: np.ndarray, water: np.ndarray, dets: list[dict],
                   valid: np.ndarray | None = None) -> np.ndarray:
    """Mata AI untuk video: rusak = merah, genangan = biru, garis tepi tiap bangunan sesuai kelasnya."""
    base = rgb.astype(np.float32) * 0.5 + 34
    if valid is not None:
        base[~valid] *= 0.55                       # di luar jangkauan gambar sebelum: tidak dinilai
    base[water] = base[water] * 0.45 + np.array([42, 120, 214], np.float32) * 0.55
    k9 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
    vis = cv2.morphologyEx(damaged.astype(np.uint8), cv2.MORPH_CLOSE, k9).astype(bool)
    base[vis] = base[vis] * 0.35 + np.array([232, 56, 64], np.float32) * 0.65
    out = np.clip(base, 0, 255).astype(np.uint8)
    for d in dets:
        if len(d["poly"]) >= 3:
            cv2.polylines(out, [np.array(d["poly"], np.int32)], True, ZONE_RGB[d["cls"]], 2, cv2.LINE_AA)
    return out


def _summary(dets: list[dict]) -> dict:
    by = [0, 0, 0, 0]
    for d in dets:
        by[d["cls"]] += 1
    return {"buildings": len(dets), "by_class": by}


def _min_px(rgb: np.ndarray) -> int:
    return max(80, int(rgb.shape[0] * rgb.shape[1] * 0.0004))


def analyze_frame(rgb: np.ndarray) -> dict:
    """Perkiraan kerusakan dari satu foto drone tanpa pembanding (aturan visi komputer sederhana)."""
    s = segment(rgb)
    rubble, intact, water, veg, sky = s["rubble"], s["intact"], s["water"], s["veg"], s["sky"]
    built = rubble.sum() + intact.sum()
    frac = float(rubble.sum() / built) if built > 0 else 0.0
    scene = max(int((~sky).sum()), 1)
    dets = buildings(rubble | intact, rubble, _min_px(rgb))
    return {
        "damage": round(frac, 4),
        "cls": damage_class(frac),
        "water": round(float(water.sum() / scene), 4),
        "vegetation": round(float(veg.sum() / scene), 4),
        "built": round(float(built / scene), 4),
        "confidence": round(float(np.clip(built / scene * 1.6, 0.15, 0.9)), 3),
        **_summary(dets),
        "_overlay": _frame_overlay(rgb, rubble, water, dets),
    }


def _match_light(src: np.ndarray, ref: np.ndarray, mask: np.ndarray) -> np.ndarray:
    """Samakan kecerahan gambar sebelum dengan gambar sesudah (jam & cuaca pengambilan bisa beda)."""
    a = cv2.cvtColor(src, cv2.COLOR_RGB2LAB).astype(np.float32)
    b = cv2.cvtColor(ref, cv2.COLOR_RGB2LAB).astype(np.float32)
    if mask.sum() > 100:
        a[..., 0] += float(np.median(b[..., 0][mask]) - np.median(a[..., 0][mask]))
    return cv2.cvtColor(np.clip(a, 0, 255).astype(np.uint8), cv2.COLOR_LAB2RGB)


def analyze_pair(pre: np.ndarray, valid: np.ndarray, post: np.ndarray) -> dict | None:
    """Kerusakan dari pasangan gambar sebelum (sudah disejajarkan) dan sesudah bencana.

    Bangunan dicari di gambar sebelum (atap utuh), lalu rusak = bagian bangunan yang warna/teksturnya berubah.
    None kalau di area yang tumpang-tindih tidak ada bangunan yang terlihat.
    """
    sp, sq = segment(pre), segment(post)
    built = sp["intact"] & valid
    if built.sum() < _min_px(post):
        return None
    changed = change_map(_match_light(pre, post, valid), post) & valid
    damaged = changed & built
    frac = float(damaged.sum() / built.sum())
    water = sq["water"] & valid & ~sp["water"]
    area = max(int((valid & ~sq["sky"]).sum()), 1)
    dets = buildings(built, changed, _min_px(post))
    return {
        "damage": round(frac, 4),
        "cls": damage_class(frac),
        "water": round(float(water.sum() / area), 4),
        "vegetation": round(float((sq["veg"] & valid).sum() / area), 4),
        "built": round(float(built.sum() / area), 4),
        "confidence": round(float(np.clip(0.55 + valid.mean() * 0.4, 0.2, 0.95)), 3),
        **_summary(dets),
        "_overlay": _frame_overlay(post, damaged, water, dets, valid),
    }
