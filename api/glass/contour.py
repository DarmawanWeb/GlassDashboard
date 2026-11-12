"""Garis kontur (marching squares) untuk menggambar garis ambang guncangan di peta."""
from __future__ import annotations

import numpy as np

# tepi sel: 0=bawah, 1=kanan, 2=atas, 3=kiri ; kasus -> pasangan tepi
_CASES = {
    1: [(3, 0)], 2: [(0, 1)], 3: [(3, 1)], 4: [(1, 2)], 5: [(3, 2), (0, 1)], 6: [(0, 2)], 7: [(3, 2)],
    8: [(2, 3)], 9: [(0, 2)], 10: [(0, 3), (1, 2)], 11: [(1, 2)], 12: [(1, 3)], 13: [(0, 1)], 14: [(0, 3)],
}


def isoline(xs: np.ndarray, ys: np.ndarray, z: np.ndarray, level: float) -> list[list[list[float]]]:
    """Kembalikan daftar polyline [[lon, lat], ...] pada z == level."""
    segs = []
    ny, nx = z.shape
    for j in range(ny - 1):
        for i in range(nx - 1):
            v = (z[j, i], z[j, i + 1], z[j + 1, i + 1], z[j + 1, i])      # bl, br, tr, tl
            case = (v[0] >= level) | (v[1] >= level) << 1 | (v[2] >= level) << 2 | (v[3] >= level) << 3
            if case in (0, 15):
                continue
            x0, x1, y0, y1 = xs[i], xs[i + 1], ys[j], ys[j + 1]

            def edge(e):
                a, b = [(0, 1), (1, 2), (3, 2), (0, 3)][e]
                va, vb = v[a], v[b]
                t = 0.5 if vb == va else (level - va) / (vb - va)
                pa = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)][a]
                pb = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)][b]
                return (round(pa[0] + t * (pb[0] - pa[0]), 5), round(pa[1] + t * (pb[1] - pa[1]), 5))

            for e1, e2 in _CASES[int(case)]:
                segs.append((edge(e1), edge(e2)))
    return _stitch(segs)


def _stitch(segs):
    from collections import defaultdict
    adj = defaultdict(list)
    for k, (a, b) in enumerate(segs):
        adj[a].append(k)
        adj[b].append(k)
    used = [False] * len(segs)
    lines = []
    for k in range(len(segs)):
        if used[k]:
            continue
        used[k] = True
        a, b = segs[k]
        line = [a, b]
        for forward in (True, False):
            while True:
                end = line[-1] if forward else line[0]
                nxt = next((m for m in adj[end] if not used[m]), None)
                if nxt is None:
                    break
                used[nxt] = True
                p, q = segs[nxt]
                other = q if p == end else p
                if forward:
                    line.append(other)
                else:
                    line.insert(0, other)
        if len(line) >= 3:
            lines.append([list(pt) for pt in line])
    return lines
