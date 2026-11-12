from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import Response

from glass import pipeline
from glass.drone import mission, uploads, vlm
from glass.params import ScenarioParams

from ..schemas import MissionRequest, ScanRequest, ScenarioRef

router = APIRouter(prefix="/api/drone", tags=["drone"])
IMMUTABLE = {"cache-control": "public, max-age=86400, immutable"}


def _params(r: ScenarioRef) -> ScenarioParams:
    return ScenarioParams(r.seed, r.n_assets, round(r.cloud_cover, 2))


def _asset(p: ScenarioParams, asset_id: str) -> dict:
    a = pipeline.observed_assets(p).get(asset_id)
    if a is None:
        raise HTTPException(status_code=404, detail=f"Aset {asset_id} tidak ada di skenario ini")
    return a


@router.get("/info")
def info() -> dict:
    """Spesifikasi kamera simulasi, asumsi terbang, dan status VLM."""
    return {"vlm": {k: v for k, v in vlm.config().items() if k != "url"}, "camera": mission.camera(),
            "flight": mission.FLIGHT.__dict__, "max_upload_mb": uploads.max_bytes() // (1024 * 1024)}


@router.post("/mission")
def plan_mission(req: MissionRequest) -> dict:
    """Pilih aset target (tertutup awan, lalu rusak berat) dan susun rute terbang."""
    p = _params(req)
    assets = list(pipeline.observed_assets(p).values())
    center = tuple(pipeline.meta_center())
    return {"key": mission.scenario_key(p), **mission.plan(assets, center, req.max_targets)}


@router.post("/scan")
def scan(req: ScanRequest) -> dict:
    """Pindai satu aset: citra RGB, LiDAR, termal (simulasi) + analisis AI per bangunan."""
    p = _params(req)
    try:
        return {"key": mission.scenario_key(p), **mission.scan(p, _asset(p, mission.safe_id(req.asset_id)))}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e


@router.get("/view/{key}/{asset_id}/{kind}.jpg", response_class=Response)
def view(key: str, asset_id: str, kind: str) -> Response:
    """Gambar sensor: pre (sebelum), rgb (sesudah), lidar, thermal, ai."""
    try:
        p = mission.parse_key(key)
        data = mission.view(p, _asset(p, mission.safe_id(asset_id)), kind)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    return Response(content=data, media_type="image/jpeg", headers=IMMUTABLE)


@router.post("/ask")
def ask(req: ScanRequest, lang: Annotated[Literal["id", "en"], Query()] = "id") -> dict:
    """Tanya VLM: jelaskan kerusakan di foto drone aset ini dengan kalimat."""
    if not vlm.config()["enabled"]:
        raise HTTPException(status_code=503, detail="VLM belum diaktifkan. Isi GLASS_VLM_PROVIDER di .env.")
    p = _params(req)
    try:
        jpeg = mission.view(p, _asset(p, mission.safe_id(req.asset_id)), "rgb")
        return vlm.ask(jpeg, lang)
    except vlm.VlmError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e


async def _save(upload_file: UploadFile, dest, limit: int) -> int:
    size = 0
    with open(dest, "wb") as f:
        while chunk := await upload_file.read(1 << 20):
            size += len(chunk)
            if size > limit:
                raise HTTPException(status_code=413, detail=f"File terlalu besar (maks {limit // (1024 * 1024)} MB)")
            f.write(chunk)
    return size


@router.post("/uploads")
async def upload(file: Annotated[UploadFile, File()], asset_id: Annotated[str | None, Form()] = None,
                 use_vlm: Annotated[bool, Form()] = False,
                 lang: Annotated[Literal["id", "en"], Form()] = "id",
                 pre_file: Annotated[UploadFile | None, File()] = None) -> dict:
    """Unggah video (atau foto) drone sesudah bencana, dan boleh juga video sebelum bencana (pre_file) untuk
    deteksi perubahan. Dianalisis di latar belakang; cek status di /uploads/{id}."""
    if asset_id:
        try:
            mission.safe_id(asset_id)
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e)) from e
    has_pre = pre_file is not None and bool(pre_file.filename)
    job_id, src, pre_src = uploads.create(file.filename or "video.mp4", asset_id, use_vlm, lang,
                                          pre_file.filename if has_pre else None)
    limit = uploads.max_bytes()
    try:
        size = await _save(file, src, limit)
        if has_pre and await _save(pre_file, pre_src, limit) == 0:
            pre_src.unlink(missing_ok=True)
            pre_src = None
    except HTTPException:
        uploads.discard(job_id)
        raise
    if size == 0:
        uploads.discard(job_id)
        raise HTTPException(status_code=422, detail="File kosong")
    uploads.start(job_id, src, pre_src)
    return uploads.status(job_id)


@router.get("/uploads/{job_id}")
def upload_status(job_id: str) -> dict:
    try:
        return uploads.status(job_id)
    except (FileNotFoundError, ValueError) as e:
        raise HTTPException(status_code=404, detail="Tugas analisis tidak ditemukan") from e


@router.get("/uploads/{job_id}/frames/{i}.jpg", response_class=Response)
def upload_frame(job_id: str, i: int, kind: Annotated[str, Query(pattern="^(ai|raw|pre)$")] = "ai") -> Response:
    try:
        f = uploads.frame_file(job_id, i, kind)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    if not f.exists():
        raise HTTPException(status_code=404, detail="Gambar belum ada")
    return Response(content=f.read_bytes(), media_type="image/jpeg", headers=IMMUTABLE)
