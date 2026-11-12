"""Menyejajarkan foto drone sebelum dan sesudah bencana.

Video sebelum bencana (digital twin, Fase 1 GLASS) dan video sesudah bencana jarang diambil dari posisi yang persis
sama. Setiap gambar sesudah dicocokkan ke gambar sebelum yang paling mirip memakai titik fitur ORB, lalu digeser,
diputar, dan diskalakan (transformasi similaritas, RANSAC) supaya piksel yang sama menunjuk ke tempat yang sama
di tanah. Hasilnya dicek ulang: tepi-tepi (jalan, pagar, pohon) di kedua gambar harus saling menimpa.
"""
from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np

ORB = cv2.ORB_create(nfeatures=4000, scaleFactor=1.2, nlevels=8, fastThreshold=10)
CLAHE = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
MATCHER = cv2.BFMatcher(cv2.NORM_HAMMING)
MIN_INLIERS = 8            # pasangan titik minimum setelah RANSAC
MIN_EDGE_CORR = 0.15       # korelasi tepi minimum setelah disejajarkan (salah sejajar ~0)
MAX_ANGLE = 45.0           # derajat; foto tegak lurus dari drone, arah terbang bisa sedikit beda
SCALE_RANGE = (0.5, 2.0)   # beda ketinggian terbang


@dataclass
class Features:
    kp: tuple
    des: np.ndarray | None
    thumb: np.ndarray            # gambar mini ternormalisasi, untuk memilih kandidat dengan cepat
    grad: np.ndarray             # besar gradien setengah resolusi, untuk mengecek hasil penyejajaran


@dataclass
class Match:
    index: int                   # nomor gambar sebelum yang dipakai
    hm: np.ndarray               # matriks 3x3: koordinat sebelum -> sesudah
    inliers: int
    edge_corr: float
    angle: float
    scale: float


def _grad(gray: np.ndarray) -> np.ndarray:
    g = cv2.GaussianBlur(cv2.resize(gray, None, fx=0.5, fy=0.5, interpolation=cv2.INTER_AREA).astype(np.float32), (0, 0), 1.2)
    return cv2.magnitude(cv2.Sobel(g, cv2.CV_32F, 1, 0), cv2.Sobel(g, cv2.CV_32F, 0, 1))


def features(rgb: np.ndarray) -> Features:
    gray = CLAHE.apply(cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY))
    kp, des = ORB.detectAndCompute(gray, None)
    th = cv2.resize(gray, (48, 27), interpolation=cv2.INTER_AREA).astype(np.float32)
    th = (th - th.mean()) / (th.std() + 1e-3)
    return Features(kp, des, th, _grad(gray))


def _edge_corr(pre: Features, post: Features, a: np.ndarray) -> float:
    half = a.copy()
    half[:, 2] *= 0.5
    h, w = post.grad.shape
    g = cv2.warpAffine(pre.grad, half, (w, h), flags=cv2.INTER_LINEAR)
    valid = cv2.warpAffine(np.ones_like(pre.grad), half, (w, h), flags=cv2.INTER_NEAREST) > 0
    if valid.sum() < 0.1 * valid.size:
        return 0.0
    x, y = g[valid], post.grad[valid]
    x = (x - x.mean()) / (x.std() + 1e-6)
    y = (y - y.mean()) / (y.std() + 1e-6)
    return float((x * y).mean())


def match(pre: Features, post: Features, index: int = 0) -> Match | None:
    """Transformasi gambar sebelum -> sesudah, atau None kalau tidak meyakinkan."""
    if pre.des is None or post.des is None or len(pre.kp) < 12 or len(post.kp) < 12:
        return None
    pairs = MATCHER.knnMatch(pre.des, post.des, k=2)
    good = [p[0] for p in pairs if len(p) == 2 and p[0].distance < 0.8 * p[1].distance]
    if len(good) < MIN_INLIERS:
        return None
    src = np.float32([pre.kp[m.queryIdx].pt for m in good])
    dst = np.float32([post.kp[m.trainIdx].pt for m in good])
    a, mask = cv2.estimateAffinePartial2D(src, dst, method=cv2.RANSAC, ransacReprojThreshold=4.0,
                                          maxIters=3000, confidence=0.995)
    if a is None or mask is None:
        return None
    inliers = int(mask.sum())
    scale = float(np.hypot(a[0, 0], a[1, 0]))
    angle = float(np.degrees(np.arctan2(a[1, 0], a[0, 0])))
    if inliers < MIN_INLIERS or not SCALE_RANGE[0] <= scale <= SCALE_RANGE[1] or abs(angle) > MAX_ANGLE:
        return None
    corr = _edge_corr(pre, post, a)
    if corr < MIN_EDGE_CORR:
        return None
    return Match(index, np.vstack([a, [0, 0, 1]]), inliers, round(corr, 3), round(angle, 2), round(scale, 3))


def best_match(pres: list[Features], post: Features, hint: int | None = None, tries: int = 4) -> Match | None:
    """Cari gambar sebelum yang paling cocok: kandidat dari kemiripan gambar mini + posisi waktu yang sama."""
    if not pres:
        return None
    sim = [float((p.thumb * post.thumb).mean()) for p in pres]
    cand = [int(k) for k in np.argsort(sim)[::-1][:tries]]
    if hint is not None:
        cand += [k for k in (hint, hint - 1, hint + 1) if 0 <= k < len(pres)]
    best = None
    for k in dict.fromkeys(cand):
        m = match(pres[k], post, k)
        if m and (best is None or m.edge_corr > best.edge_corr):
            best = m
    return best


def warp(pre_rgb: np.ndarray, hm: np.ndarray, shape: tuple[int, ...]) -> tuple[np.ndarray, np.ndarray]:
    """Gambar sebelum yang sudah disejajarkan + topeng area yang benar-benar tertutup gambar sebelum."""
    h, w = shape[:2]
    out = cv2.warpPerspective(pre_rgb, hm, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
    valid = cv2.warpPerspective(np.full(pre_rgb.shape[:2], 255, np.uint8), hm, (w, h), flags=cv2.INTER_NEAREST)
    valid = cv2.erode(valid, np.ones((9, 9), np.uint8)) > 0       # buang tepi yang terinterpolasi
    return out, valid
