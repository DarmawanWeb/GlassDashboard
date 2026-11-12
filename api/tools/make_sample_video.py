"""Buat contoh video drone (simulasi) untuk dicoba di fitur "Unggah video".

    python tools/make_sample_video.py ../web/public/sample/glass-drone-simulasi.mp4

Perlu ffmpeg (libx264) di PATH. Video berisi terbang di atas beberapa aset target misi bawaan.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from glass import pipeline  # noqa: E402
from glass.drone import mission  # noqa: E402
from glass.drone.render import render_scene  # noqa: E402
from glass.params import ScenarioParams  # noqa: E402

FPS, W, H = 15, 960, 540


def warp(img: np.ndarray, zoom: float, dx: float, dy: float, rot: float) -> np.ndarray:
    m = cv2.getRotationMatrix2D((W / 2 + dx, H / 2 + dy), rot, zoom)
    m[0, 2] -= dx
    m[1, 2] -= dy
    return cv2.warpAffine(img, m, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)


def main(out: Path, n_targets: int = 7):
    p = ScenarioParams()
    assets = pipeline.observed_assets(p)
    plan = mission.plan(list(assets.values()), tuple(pipeline.meta_center()), 46)
    picks = [t["id"] for t in plan["targets"]]
    # pilih campuran tingkat kerusakan supaya videonya bervariasi
    chosen, seen = [], set()
    for aid in picks:
        cls = int(round(assets[aid]["d_surf"] * 3))
        if cls not in seen or len(chosen) >= 4:
            chosen.append(aid)
            seen.add(cls)
        if len(chosen) >= n_targets:
            break
    frames = []
    rng = np.random.default_rng(3)
    prev = None
    for aid in chosen:
        sc = render_scene(assets[aid], p.seed)
        img = cv2.cvtColor(sc.rgb_post, cv2.COLOR_RGB2BGR)
        if prev is not None:     # pindah antar-aset: geser cepat dengan blur gerak
            for k in range(8):
                t = (k + 1) / 9
                a = warp(prev, 1.15 + 0.2 * t, -t * 380, 0, 0)
                b = warp(img, 1.35 - 0.2 * t, (1 - t) * 380, 0, 0)
                mix = cv2.addWeighted(a, 1 - t, b, t, 0)
                frames.append(cv2.blur(mix, (int(9 + 10 * np.sin(np.pi * t)), 1)))
        drift = rng.normal(0, 1, 2)
        n = int(FPS * 3.2)
        for k in range(n):
            t = k / (n - 1)
            zoom = 1.35 - 0.3 * (1 - (1 - t) ** 2)
            frames.append(warp(img, zoom, drift[0] * 14 * t, drift[1] * 10 * t, 2.5 * (t - 0.5)))
        prev = frames[-1]
    out.parent.mkdir(parents=True, exist_ok=True)
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}",
           "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "veryfast", "-crf", "27",
           "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(out)]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for f in frames:
        proc.stdin.write(f.tobytes())
    proc.stdin.close()
    proc.wait()
    print(f"{out} ({len(frames) / FPS:.1f} detik, aset: {', '.join(chosen)})")


if __name__ == "__main__":
    main(Path(sys.argv[1] if len(sys.argv) > 1 else "glass-drone-simulasi.mp4"))
