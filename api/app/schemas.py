"""Skema request API (validasi input)."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

AssetType = Literal["sekolah", "puskesmas", "kantor", "jembatan"]


class Policy(BaseModel):
    deductible_rate: float = Field(0.01, ge=0, le=0.2, description="Potongan, porsi dari nilai pertanggungan")
    advance_rate: float = Field(0.10, ge=0, le=0.5, description="Uang muka parametrik, porsi dari nilai pertanggungan")
    mmi_trigger: float = Field(8.0, ge=6.0, le=9.5, description="Ambang guncangan MMI untuk uang muka")


class VideoOverride(BaseModel):
    id: str = Field(max_length=40)
    job_id: str = Field(max_length=32)


class ScenarioRef(BaseModel):
    seed: int = Field(2018, ge=0, le=999_999)
    n_assets: int = Field(320, ge=20, le=1200)
    cloud_cover: float = Field(0.12, ge=0, le=0.5)


class ScenarioRequest(ScenarioRef):
    policy: Policy = Policy()
    drone_ids: list[str] = Field(default_factory=list, max_length=400, description="Aset yang sudah dipindai drone")
    video: list[VideoOverride] = Field(default_factory=list, max_length=50, description="Hasil video unggahan per aset")


class MissionRequest(ScenarioRef):
    max_targets: int = Field(46, ge=1, le=120)


class ScanRequest(ScenarioRef):
    asset_id: str = Field(max_length=40)


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
    source: Literal["satelit", "drone", "video"] = "satelit"
    claim: float
    advance: float
    topup: float


class Certificate(BaseModel):
    model_config = ConfigDict(extra="allow")
    sha256: str
