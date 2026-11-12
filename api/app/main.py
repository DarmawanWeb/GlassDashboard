from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

import glass

from .routers import drone as drone_router
from .routers import glass as glass_router

app = FastAPI(
    title="GLASS API",
    version=glass.__version__,
    description=("Mesin prototipe GLASS: satelit + drone simulasi (RGB, LiDAR, termal), analisis AI kerusakan, SDSI, "
                 "cadangan klaim, IBNR, PML, pembayaran hibrida, sertifikat digital."),
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)
app.add_middleware(GZipMiddleware, minimum_size=1024)

origins = [o.strip() for o in os.environ.get("GLASS_CORS_ORIGINS", "").split(",") if o.strip()]
if origins:
    app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["GET", "POST"], allow_headers=["*"])


@app.get("/api/health", tags=["system"])
def health() -> dict:
    return {"status": "ok", "version": glass.__version__, "model": glass.MODEL_VERSION}


app.include_router(glass_router.router)
app.include_router(drone_router.router)
