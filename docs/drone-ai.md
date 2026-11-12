# Drone AI

The Scan step shows what the drone part of GLASS would do: fly below the clouds to the assets that satellites could
not measure, capture each one with three sensors, and score the damage per building. In the prototype the drone and
its imagery are simulated, but the analysis treats the images the same way it would treat real ones.

Code: [`api/glass/drone/`](../api/glass/drone).

## Simulator (`scene.py`, `render.py`)

For every asset the simulator draws a 192 m × 108 m patch (960 × 540 px, 20 cm per pixel) around its real
coordinates: roads, houses, trees, cars, the sea from the real coastline, and a river under bridges. The target
building gets a shape by type (U-shaped school, L-shaped health center, hip-roofed office, bridge deck).

Each patch has a before and an after version plus two extra sensors:

| Output | How it is made |
|---|---|
| RGB before | The digital twin from GLASS phase 1 |
| RGB after | Roof holes, rubble, spilled debris, cracks; the damaged share follows the asset's damage class |
| LiDAR | Roof heights; collapsed parts drop, and some roofs sag without visible damage from above |
| Thermal (LWIR) | Temperature per material; mud and standing water are cold, shadows are cooler |

Neighboring houses are damaged according to the area pattern, and mud follows the asset's water signal. Rendering is
deterministic for a given scenario seed, and results are cached on disk so all API workers share them.

## Mission planning (`mission.py`)

1. Targets: cloud-covered assets first, then assets that satellites rate as severe (`SDSI > 0.5`), up to the slider
   limit (46 by default).
2. Route: nearest neighbor from the base, improved with 2-opt.
3. Flight time: 12 m/s cruise, 60 m altitude, 35 s per asset, 35 min per battery, 6 min per battery swap, 4 min for
   takeoff and landing. These are assumptions for a mid-size survey drone.

## Damage analysis in the mission (`vision.py`)

The method follows the two-stage idea of xBD:

1. **Where are the buildings?** The target footprint comes from the asset register; other buildings come from the
   digital twin's height model.
2. **How damaged is each one?** Compare after with before inside each footprint.

| Sensor | Measurement | Feeds |
|---|---|---|
| RGB | Share of footprint pixels whose color (ΔE in Lab > 14) or texture changed | `D_surf`, roof damage % |
| LiDAR | Mean height loss divided by the building height | `D_vol`, volume lost % |
| Thermal | Share of ground in a 15 m ring that is below 29.8 °C and not vegetation | `D_water`, wet area % |

Damage classes follow xBD: no damage (< 10% of the roof), minor (10–39%), major (39–72%), destroyed (> 72%).
Confidence is higher when the camera and LiDAR agree: `0.55 + 0.4 × (1 − |roof − volume|)`, kept between 0.40 and
0.97.

On the default scenario the AI gets the class right for 46 of 46 targets, with a mean roof error of about 3.5
points. These numbers come from the simulated world and show that the pipeline is wired correctly; they say nothing
about accuracy on real photos.

## Uploaded video (`uploads.py`, `align.py`)

Uploads run as background jobs; the dashboard polls their status. About one frame per second is analyzed (36 at
most), resized to 960 px wide.

**With a before video (change detection).** Every after frame is matched to the before frame that fits it best:

1. Candidates: the most similar thumbnails plus the before frame at the same relative time.
2. ORB features (4,000 per frame), ratio test, then a similarity transform (rotation, scale, shift) with RANSAC.
3. Sanity checks: at least 8 inliers, scale between 0.5 and 2, rotation under 45°, and the edges of both images
   must line up after warping (gradient correlation ≥ 0.15). Wrong alignments score near 0 and are rejected.
4. Buildings are found in the aligned before frame, and damage is the share of building pixels that changed.

On simulated pairs with a rotated, zoomed, and shifted after camera, 17 of 20 frames aligned within 2 px and the other
3 were rejected rather than misaligned. Frames that cannot be aligned fall back to the single-frame method.

**Without a before video (single frame).** A rule set labels pixels: rough, dull texture with no dominant direction
is debris; smooth, colored, or bright surfaces are intact roofs; smooth brown or dark areas are standing water.
Damage is debris ÷ (debris + intact roof). This is a rough estimate.

In both modes the built area is split into buildings (connected components), each gets a class, and the AI view
outlines them in their class color. The job result is the median over usable frames, and it can replace `D_surf` for
one asset in the scenario.

## Vision-language model (`vlm.py`)

Optional. When enabled, the *Ask AI* button on the drone camera and the VLM option for uploads send a frame with a
fixed prompt and expect JSON back: damage class, damage %, water %, building count, notable objects, and a one or two
sentence summary in the dashboard's language. For uploads, the four most damaged frames are sent and the VLM's median
replaces the computer-vision estimate.

| Provider | `GLASS_VLM_URL` default | `GLASS_VLM_MODEL` default |
|---|---|---|
| `ollama` | `http://host.docker.internal:11434` | `qwen3-vl:2b` |
| `openai` (or any compatible server: LM Studio, vLLM) | `https://api.openai.com/v1` | required |
| `anthropic` | `https://api.anthropic.com` | `claude-haiku-5-5` |

## Limitations

- All drone imagery in the mission is synthetic, so the mission accuracy cannot be compared with real-world
  performance.
- The single-frame rules were tuned on synthetic frames and will mislabel some real scenes (dark roofs, shadows,
  construction sites).
- Alignment assumes a top-down camera. Oblique footage and large viewpoint changes will often fail and fall back to
  single-frame analysis.
- The VLM's answers are not verified automatically and need a human check.

Next steps toward real use:

1. Train and evaluate a segmentation model on labeled post-disaster drone imagery such as RescueNet and FloodNet.
2. Run a real flight over one school with RGB, LiDAR, and thermal sensors and compare with a field survey.
3. Replace the simulated digital twin with real pre-disaster footprints (OpenStreetMap, the BMN register, or a phase 1
   survey).
4. Compare VLM answers with human assessors before letting them change any number.
