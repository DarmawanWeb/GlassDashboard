# API reference

Base path: `/api`. Interactive documentation with every schema is served at `/api/docs`. All bodies are JSON unless
noted. Errors use FastAPI's shape, `{"detail": "..."}`, with these status codes: `404` not found, `413` file too
large, `422` invalid input, `502` the VLM failed, `503` the VLM is not enabled.

Most drone endpoints take a scenario reference so the server can rebuild exactly the same scenario:

```json
{ "seed": 2018, "n_assets": 320, "cloud_cover": 0.12 }
```

## System

| Method | Path | Returns |
|---|---|---|
| GET | `/health` | `{"status": "ok", "version": "...", "model": "..."}` |
| GET | `/meta` | Asset types and SDSI weights, zones, defaults, map overlays (coast, fault, liquefaction, epicenter, shaking grid), and drone info |

## Scenario and calculator

### `POST /scenario`

Runs the full pipeline for one scenario.

```json
{
  "seed": 2018, "n_assets": 320, "cloud_cover": 0.12,
  "policy": { "deductible_rate": 0.01, "advance_rate": 0.10, "mmi_trigger": 8.0 },
  "drone_ids": ["SKL-046", "KTR-018"],
  "video": [{ "id": "PKM-015", "job_id": "3f2c9a1b7d4e5f60" }]
}
```

`drone_ids` replaces the satellite readings of those assets with the drone results; `video` replaces `D_surf` with an
uploaded video's result. The response contains `summary` (counts, reserves, IBNR, payouts, basis risk), `assets`
(each with its readings, `sdsi`, `zone`, `terms`, `claim`, `advance`, `topup`, `source`, and drone or video details),
`clouds`, `by_zone`, `by_type`, `pml`, and `shake_line`.

### `POST /sdsi`

Calculator for a single asset.

```json
{ "asset_type": "sekolah", "d_vol": 0.6, "d_surf": 0.667, "d_water": 0.3,
  "sum_insured": 4000000000, "mmi": 8.2, "policy": { "deductible_rate": 0.01, "advance_rate": 0.1, "mmi_trigger": 8.0 } }
```

Returns `sdsi`, `zone`, `terms`, `deductible`, `claim`, `advance`, `topup`.

## Certificates

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/certificates?lang=id\|en` | An asset object from `/scenario` | Certificate with `sha256` |
| POST | `/certificates/verify` | A certificate (possibly edited) | `{"valid": bool, "expected_sha256": "...", "given_sha256": "..."}` |

## Drone

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/drone/info` | | VLM status, camera, flight assumptions, upload limit |
| POST | `/drone/mission` | scenario reference + `max_targets` (1–120) | `key`, `base`, `targets` (order, reason, leg and cumulative km, ETA), `route`, `stats`, `camera` |
| POST | `/drone/scan` | scenario reference + `asset_id` | `estimate` (roof, vol, wet, class, confidence, SDSI components), `truth`, `detections` (polygons per building), `area`, `sdsi_satellite`, `sdsi_drone` |
| GET | `/drone/view/{key}/{asset_id}/{kind}.jpg` | | JPEG, `kind` is `pre`, `rgb`, `lidar`, `thermal`, or `ai`; cached as immutable |
| POST | `/drone/ask?lang=id\|en` | scenario reference + `asset_id` | VLM answer: `cls`, `damage_pct`, `water_pct`, `buildings`, `objects`, `summary`, `model`, `ms` |

`reason` on a mission target is `awan` (photo hidden by cloud) or `berat` (severe per satellite).

## Video uploads

### `POST /drone/uploads` (multipart form)

| Field | Required | Meaning |
|---|---|---|
| `file` | yes | Video or photo after the disaster (mp4, mov, m4v, avi, mkv, webm, jpg, png, webp) |
| `pre_file` | no | Video or photo of the same area before the disaster, for change detection |
| `asset_id` | no | Asset the result can later be applied to |
| `use_vlm` | no | `true` to ask the VLM about the four most damaged frames |
| `lang` | no | `id` (default) or `en`, the language of VLM summaries |

Returns the job immediately with `status: "uploading"` or `"running"`.

### `GET /drone/uploads/{job_id}`

```json
{
  "id": "3f2c9a1b7d4e5f60", "status": "done", "progress": 1.0,
  "frames": [
    { "i": 0, "t": 1.0, "damage": 0.48, "cls": 2, "water": 0.03, "built": 0.31,
      "buildings": 23, "by_class": [6, 9, 5, 3],
      "aligned": true, "pre_index": 0, "inliers": 44, "match": 0.41, "vlm": null }
  ],
  "result": {
    "damage": 0.47, "cls": 2, "method": "change", "cv_damage": 0.47, "vlm_damage": null,
    "frames": 26, "frames_used": 25, "aligned_frames": 25, "pre_frames": 24,
    "water": 0.04, "summary": null, "vlm_status": "off", "vlm_note": null, "d_surf": 0.47
  },
  "error": null, "error_code": null
}
```

- `status`: `uploading`, `running`, `done`, or `error`.
- `method`: `cv` (single frame), `change` (aligned with the before video), `vlm+cv`, or `vlm+change`.
- `vlm_status`: `off`, `ok`, `disabled` (requested but not configured), or `error`.
- `error_code`: `unreadable_video`, `unreadable_image`, `no_frames`, or `failed`.

### `GET /drone/uploads/{job_id}/frames/{i}.jpg?kind=ai|raw|pre`

The AI view, the original frame, or the aligned before frame (only for frames with `aligned: true`).
