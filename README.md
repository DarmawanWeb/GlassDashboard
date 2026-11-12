# GlassDashboard

Dasbor demo **GLASS** (Geo-Actuarial Autonomous Loss Assessment System): menilai kerusakan aset negara setelah
bencana dari data satelit, lalu mengubahnya otomatis menjadi angka klaim asuransi. Studi kasus Palu 2018.

Alurnya 4 langkah di satu peta:

| Langkah | Di peta | Di panel |
|---|---|---|
| 1 Lihat | Heatmap foto / radar / air, awan, sesar, likuefaksi, sapuan satelit | Sensor, tutupan awan |
| 2 Nilai | Titik warna zona SDSI | Rumus SDSI, komposisi zona, kalkulator |
| 3 Hitung | Lingkaran = estimasi klaim, garis 5 tetangga (IBNR) | Cadangan, IBNR, kurva PML, AAL |
| 4 Bayar | Medan guncangan + garis ambang, aset dapat uang muka | Slider ambang & uang muka, basis risk, sertifikat SHA-256 |

> **Data contoh.** Aset, kerusakan, awan, dan asumsi PML disimulasikan. Garis pantai (geoBoundaries) dan citra
> Sentinel-2 2018 asli. Lihat bagian *Data asli* untuk mengganti dengan data sungguhan.

## Jalankan (Docker)

```bash
cp .env.example .env          # atur GLASS_PORT bila perlu (default 3070)
docker compose up -d --build
docker compose ps             # tunggu api & web "healthy"
```

Buka `http://localhost:3070`. Hanya container `web` yang membuka port; `api` cuma bisa diakses dari dalam jaringan compose
(lewat `/api/*` yang diteruskan oleh Next.js).

### Homeport / akses online

- Port yang didaftarkan: **`GLASS_PORT`** (default `3070`). Port 80, 8080, dan 8088 sengaja tidak dipakai.
- Health check: `GET /healthz` (web) dan `GET /api/health` (api lewat web).
- Dokumentasi API interaktif: `/api/docs`.
- `GLASS_BIND=127.0.0.1` kalau hanya mau diakses lewat tunnel/proxy di mesin yang sama.
- Image jalan di amd64 dan arm64 (Mac mini M4).

## Pintasan saat presentasi

`1`–`4` atau `←` `→` pindah langkah, `S` skenario baru (sapuan satelit diulang), `F` layar penuh, `Esc` tutup detail aset.
URL `/#bayar` dll. langsung membuka langkah tertentu.

Peta dasar bisa diganti: Sentinel-2 2018, resolusi tinggi (Esri), peta jalan (CARTO), atau offline. Kalau internet di
lokasi presentasi bermasalah, peta otomatis pindah ke mode offline (garis pantai bawaan).

## Data asli

Taruh file GeoJSON titik di `./data/`, lalu di `.env`:

```bash
GLASS_ASSETS_FILE=/data/aset_palu.geojson
```

```bash
docker compose up -d --force-recreate api
```

Properti per aset (contoh lengkap: `data/contoh_format_aset.geojson`):

| Properti | Isi |
|---|---|
| `id` | kode aset, mis. `SKL-001` |
| `type` | `sekolah` \| `puskesmas` \| `kantor` \| `jembatan` |
| `sum_insured` | nilai pertanggungan (rupiah) |
| `d_vol` | 0–1, perubahan radar Sentinel-1 |
| `d_surf` | 0–1, kelas kerusakan foto (xBD: 0, 1/3, 2/3, 1) |
| `d_water` | 0–1, genangan / suhu |
| `mmi` | intensitas guncangan di lokasi (USGS ShakeMap) |
| `observed` | `false` jika foto tertutup awan (opsional) |

## Pengembangan tanpa Docker

```bash
# API
cd api
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000
pytest -q

# Web (terminal lain)
cd web
npm install
API_URL=http://127.0.0.1:8000 npm run dev    # http://localhost:3000
```

## Struktur

```
api/
  glass/            mesin GLASS (Python + numpy)
    params.py       bobot SDSI, zona, parameter polis & PML
    scenario.py     skenario contoh Palu (aset, awan, medan guncangan)
    sdsi.py         SDSI = w1·Radar + w2·Foto + w3·Air
    actuarial.py    estimasi klaim, PML & AAL (Monte Carlo)
    pipeline.py     Lihat -> Nilai -> Hitung -> Bayar, IBNR spasial (5 tetangga)
    contour.py      garis ambang guncangan (marching squares)
    certificate.py  sertifikat + sidik jari SHA-256
    sources.py      loader GeoJSON data asli
    data/palu_geo.json
  app/              FastAPI (routers, schemas)
  tests/            pytest
  tools/build_geo.py  pembuat palu_geo.json dari geoBoundaries
web/
  src/app/          Next.js App Router, proxy /api/*, /healthz
  src/components/   peta MapLibre (lensa per langkah), panel, grafik SVG
  public/geo/       garis pantai untuk peta offline
docker-compose.yml
```

## Sumber & lisensi data

- Citra: Sentinel-2 cloudless 2018 oleh EOX (s2maps.eu), gratis untuk non-komersial dengan atribusi; Esri World Imagery; CARTO/OpenStreetMap.
- Garis pantai & batas wilayah: geoBoundaries gbOpen IDN ADM2 (CC BY 4.0).
- Episentrum: USGS event `us1000h3p4`. Jejak sesar dan pusat likuefaksi hanya perkiraan untuk data contoh.
