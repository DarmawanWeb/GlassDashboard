"""Skema request API (validasi input)."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

AssetType = Literal["sekolah", "puskesmas", "kantor", "jembatan"]


class Policy(BaseModel):
    deductible_rate: float = Field(0.01, ge=0, le=0.2, description="Potongan, porsi dari nilai pertanggungan")
    advance_rate: float = Field(0.10, ge=0, le=0.5, description="Uang muka parametrik, porsi dari nilai pertanggungan")
    mmi_trigger: float = Field(8.0, ge=6.0, le=9.5, description="Ambang guncangan MMI untuk uang muka")


class ScenarioRequest(BaseModel):
    seed: int = Field(2018, ge=0, le=999_999)
    n_assets: int = Field(320, ge=20, le=1200)
    cloud_cover: float = Field(0.12, ge=0, le=0.5)
    policy: Policy = Policy()


class CalculatorRequest(BaseModel):
    asset_type: AssetType = "sekolah"
    d_vol: float = Field(0.6, ge=0, le=1)
    d_surf: float = Field(2 / 3, ge=0, le=1)
    d_water: float = Field(0.3, ge=0, le=1)
    sum_insured: float = Field(4e9, gt=0, le=1e13)
    mmi: float = Field(8.2, ge=1, le=12)
    policy: Policy = Policy()


class AssetForCertificate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    type: AssetType
    lon: float
    lat: float
    sum_insured: float
    sdsi: float = Field(ge=0, le=1)
    zone: str
    observed: bool = True
    claim: float
    advance: float
    topup: float


class Certificate(BaseModel):
    model_config = ConfigDict(extra="allow")
    sha256: str
