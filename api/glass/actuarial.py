"""Inti aktuaria: estimasi klaim, cadangan, IBNR, PML & AAL."""
from __future__ import annotations

from functools import lru_cache

import numpy as np

from .params import PmlParams


def claim(sum_insured: float, score: float, deductible_rate: float) -> float:
    """Estimasi klaim = nilai pertanggungan x SDSI - potongan (tidak boleh negatif)."""
    return max(sum_insured * score - deductible_rate * sum_insured, 0.0)


@lru_cache(maxsize=32)
def _annual_losses(total_si_bn: float, p: PmlParams) -> np.ndarray:
    rng = np.random.default_rng(p.seed)
    n_ev = rng.poisson(p.event_rate, p.years)
    ratios = np.clip(rng.lognormal(p.loss_mu, p.loss_sigma, int(n_ev.sum())), 0, 1)
    year_of_event = np.repeat(np.arange(p.years), n_ev)
    losses = np.zeros(p.years)
    np.add.at(losses, year_of_event, ratios * total_si_bn * 1e9)
    return np.sort(losses)


def pml(total_si: float, scenario_loss: float, p: PmlParams = PmlParams()) -> dict:
    """Kurva PML (periode ulang -> kerugian tahunan) dari simulasi Monte Carlo."""
    losses = _annual_losses(round(total_si / 1e9, 3), p)
    rps = np.unique(np.round(np.logspace(np.log10(2), np.log10(1000), 48), 1))
    curve = [{"return_period": float(rp), "loss": float(np.quantile(losses, 1 - 1 / rp))} for rp in rps]
    exceed = float((losses >= scenario_loss).mean())
    return {
        "curve": curve,
        "aal": float(losses.mean()),
        "pml": {str(rp): float(np.quantile(losses, 1 - 1 / rp)) for rp in (50, 100, 250)},
        "scenario_return_period": (1 / exceed) if exceed > 0 else None,
        "assumptions": {
            "years": p.years, "event_rate": p.event_rate,
            "median_loss_ratio": float(np.exp(p.loss_mu)), "sigma": p.loss_sigma,
        },
    }
