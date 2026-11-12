"""Konstanta & parameter GLASS. Semua angka di sini adalah asumsi contoh dan bisa diubah."""
from __future__ import annotations

import math
from dataclasses import dataclass

MODEL_VERSION = "glass-dashboard-0.2"
EVENT_NAME = "Gempa & Tsunami Palu M7,5 (28 September 2018)"
EVENT_NAME_EN = "Palu M7.5 earthquake & tsunami (28 September 2018)"

# Bobot SDSI per jenis aset: (w_vol radar, w_surf foto, w_water air), jumlah = 1
ASSET_TYPES: dict[str, dict] = {
    "sekolah":   {"label": "Sekolah",           "label_en": "School",            "weights": (0.30, 0.45, 0.25), "si_range": (2e9, 6e9),   "share": 0.50},
    "puskesmas": {"label": "Puskesmas",         "label_en": "Health center",     "weights": (0.30, 0.45, 0.25), "si_range": (3e9, 8e9),   "share": 0.17},
    "kantor":    {"label": "Kantor pemerintah", "label_en": "Government office", "weights": (0.35, 0.45, 0.20), "si_range": (5e9, 20e9),  "share": 0.25},
    "jembatan":  {"label": "Jembatan",          "label_en": "Bridge",            "weights": (0.50, 0.30, 0.20), "si_range": (10e9, 40e9), "share": 0.08},
}

# (batas atas SDSI, id, label, arti) — 4 zona GLASS
ZONES: list[tuple[float, str, str, str]] = [
    (0.25, "hijau", "Hijau", "Rusak ringan"),
    (0.50, "kuning", "Kuning", "Rusak sedang"),
    (0.75, "oranye", "Oranye", "Rusak berat"),
    (1.00, "merah", "Merah", "Rusak total"),
]

# Kelas kerusakan dari foto (gaya label xBD) -> nilai D_surf
SURF_CLASSES = [(0.0, "Tidak rusak"), (1 / 3, "Rusak ringan"), (2 / 3, "Rusak berat"), (1.0, "Hancur")]

N_NEIGHBORS = 5   # tetangga terdekat untuk menebak nilai foto aset yang tertutup awan


@dataclass(frozen=True)
class ScenarioParams:
    seed: int = 2018
    n_assets: int = 320
    cloud_cover: float = 0.12          # target porsi aset yang tertutup awan (0..0.5)


@dataclass(frozen=True)
class PolicyParams:
    deductible_rate: float = 0.01      # potongan, % dari nilai pertanggungan
    advance_rate: float = 0.10         # uang muka parametrik, % dari nilai pertanggungan
    mmi_trigger: float = 8.0           # ambang guncangan (skala MMI) untuk uang muka


@dataclass(frozen=True)
class PmlParams:
    years: int = 100_000               # tahun simulasi Monte Carlo
    event_rate: float = 0.12           # rata-rata kejadian merusak per tahun (asumsi, kalibrasi dari DIBI/InaRISK)
    loss_mu: float = math.log(0.04)    # lognormal rasio kerugian portofolio per kejadian
    loss_sigma: float = 1.0
    seed: int = 7


def zone_of(sdsi: float) -> str:
    for upper, zid, _, _ in ZONES:
        if sdsi <= upper + 1e-12:
            return zid
    return ZONES[-1][1]
