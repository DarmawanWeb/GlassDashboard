# Model

How the dashboard turns sensor readings into rupiah. Every number below is a default in
[`api/glass/params.py`](../api/glass/params.py) unless noted, and every one of them is an assumption that should be
calibrated before the figures are used for anything real.

## 1. Damage signals

Each asset carries three readings between 0 (no sign of damage) and 1 (most severe):

| Signal | Satellite source | Drone source |
|---|---|---|
| `D_vol`, structural change | Sentinel-1 radar change | LiDAR height loss relative to the building height |
| `D_surf`, surface damage | xBD-style photo class: 0, 1/3, 2/3, 1 | Share of the footprint that changed against the digital twin |
| `D_water`, flooding | Flood map | Share of ground around the building that is cold and not vegetation (LWIR thermal) |

The paper calls the third component `D_therm`; the dashboard uses `D_water` because what it measures is wet area.

## 2. SDSI score

```
SDSI = w1 · D_vol + w2 · D_surf + w3 · D_water,   w1 + w2 + w3 = 1
```

| Asset type | w1 (vol) | w2 (surf) | w3 (water) | Basis |
|---|---|---|---|---|
| Bridge | 0.50 | 0.30 | 0.20 | Concrete bridge example in the GLASS paper |
| School, health center | 0.30 | 0.45 | 0.25 | Team estimate |
| Government office | 0.35 | 0.45 | 0.20 | Team estimate |

## 3. Zones

| SDSI | Zone | Meaning |
|---|---|---|
| 0.00–0.25 | Green | Light damage |
| 0.26–0.50 | Yellow | Moderate damage |
| 0.51–0.75 | Orange | Heavy damage |
| 0.76–1.00 | Red | Total loss |

This follows the four-zone payout matrix in Appendix 4 of the paper.

## 4. Claims and reserves

```
estimated claim = sum insured × SDSI − deductible     (never below zero)
deductible      = 1% of sum insured
```

- **Case reserves**: the sum of estimated claims for assets that were measured (a clear satellite photo, or a drone
  scan).
- **IBNR** (incurred but not reported): assets whose satellite photo is hidden by cloud. Their `D_surf` is the mean of
  the 5 nearest measured assets, and their estimated claim is booked separately as IBNR. A drone scan moves an asset
  from IBNR into case reserves.
- **Total reserves** = case reserves + IBNR. **Loss ratio** = total reserves ÷ total sum insured.

## 5. PML and AAL

A Monte Carlo run simulates 100,000 years for the whole portfolio:

| Assumption | Default |
|---|---|
| Damaging events per year | Poisson, mean 0.12 |
| Portfolio loss ratio per event | Lognormal, median 4%, σ = 1.0, capped at 100% |
| Random seed | 7 |

From the sorted annual losses the dashboard reports the PML for 50, 100, and 250-year return periods, the average
annual loss (AAL, the basis for pricing a premium), and how often a loss as large as the current scenario occurs.
The frequency and severity should be calibrated from DIBI and InaRISK data.

## 6. Hybrid payout

| Part | Rule | Default |
|---|---|---|
| Parametric advance | Paid as soon as shaking at the site reaches the trigger | 10% of sum insured if MMI ≥ VIII |
| Top-up | Estimated claim − advance, paid after the SDSI score is in | never negative |

Basis risk is reported in two directions: advances larger than the final claim, and heavily damaged assets below the
trigger that receive no advance. Shaking per asset comes from a simple distance model in the sample scenario; a real
deployment would read the USGS ShakeMap grid.

## 7. Digital loss certificate

The certificate lists the asset, event, SDSI, zone, amounts, data sources (satellite, drone, or uploaded video), and
model version. Its SHA-256 fingerprint is computed over a canonical JSON form of those fields, so changing a single
digit produces a completely different fingerprint. It is a hash, not a signature: production use would sign it with
the issuer's private key. Certificates can be issued in Indonesian or English (`?lang=en`).

## 8. Sample scenario

The sample scenario places 320 assets on land in Palu (50% schools, 17% health centers, 25% offices, 8% bridges) and
draws damage from a tsunami term that decays with distance from the coast, a fault term, the liquefaction areas, and
general shaking, plus noise. Cloud blobs are placed until the share of hidden assets is close to the slider value.
The generator is in [`api/glass/scenario.py`](../api/glass/scenario.py).
