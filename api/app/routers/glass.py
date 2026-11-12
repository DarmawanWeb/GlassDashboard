from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Query

from glass import certificate, pipeline
from glass.params import PolicyParams, ScenarioParams

from ..schemas import AssetForCertificate, CalculatorRequest, Certificate, Policy, ScenarioRequest

router = APIRouter(prefix="/api", tags=["glass"])


def _policy(p: Policy) -> PolicyParams:
    return PolicyParams(deductible_rate=p.deductible_rate, advance_rate=p.advance_rate, mmi_trigger=p.mmi_trigger)


@router.get("/meta")
def meta() -> dict:
    """Konstanta model, nilai bawaan, dan overlay peta (sesar, likuefaksi, pantai, grid guncangan)."""
    return pipeline.meta()


@router.post("/scenario")
def scenario(req: ScenarioRequest) -> dict:
    """Jalankan alur lengkap: Lihat -> Pindai -> Nilai -> Hitung -> Bayar untuk satu skenario."""
    try:
        return pipeline.run(ScenarioParams(req.seed, req.n_assets, round(req.cloud_cover, 2)), _policy(req.policy),
                            drone_ids=tuple(req.drone_ids), video=tuple(v.model_dump() for v in req.video))
    except ValueError as e:                      # mis. file GeoJSON asli tidak valid
        raise HTTPException(status_code=422, detail=str(e)) from e


@router.post("/sdsi")
def sdsi_calculator(req: CalculatorRequest) -> dict:
    """Kalkulator satu aset: SDSI, zona, estimasi klaim, uang muka, dan sisa pembayaran."""
    return pipeline.calculator(req.asset_type, req.d_vol, req.d_surf, req.d_water, req.sum_insured, req.mmi,
                               _policy(req.policy))


@router.post("/certificates")
def issue_certificate(asset: AssetForCertificate, lang: Annotated[Literal["id", "en"], Query()] = "id") -> dict:
    """Terbitkan Digital Loss Certificate dengan sidik jari SHA-256 (isi teks dalam bahasa `lang`)."""
    return certificate.issue(asset.model_dump(), lang)


@router.post("/certificates/verify")
def verify_certificate(cert: Certificate) -> dict:
    """Cek apakah isi sertifikat masih cocok dengan sidik jarinya."""
    return certificate.verify(cert.model_dump())
