import type {
  Map as MLMap,
  ExpressionSpecification,
  FilterSpecification,
  LayerSpecification,
  StyleSpecification,
} from "maplibre-gl";
import type { Basemap, Meta, Scenario, Sensor, StepId } from "@/lib/types";
import { SENSOR, SERIES } from "@/lib/palette";

/* ---------- peta dasar ---------- */
export const BASEMAPS: Record<Exclude<Basemap, "offline">, { label: string; layer: string }> = {
  s2: { label: "Sentinel-2 2018", layer: "base-s2" },
  esri: { label: "Resolusi tinggi", layer: "base-esri" },
  carto: { label: "Peta jalan", layer: "base-carto" },
};
export const BASEMAP_ORDER: Basemap[] = ["s2", "esri", "carto", "offline"];
export const BASEMAP_LABEL: Record<Basemap, string> = {
  s2: "Sentinel-2 2018",
  esri: "Resolusi tinggi",
  carto: "Peta jalan",
  offline: "Offline",
};

export const CITY_BOUNDS: [[number, number], [number, number]] = [[119.806, -0.962], [119.928, -0.802]];

export function baseStyle(): StyleSpecification {
  const raster = { "raster-opacity": 1, "raster-saturation": -0.25, "raster-brightness-max": 0.86, "raster-contrast": 0.05 };
  return {
    version: 8,
    sources: {
      s2: {
        type: "raster",
        tiles: ["https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2018_3857/default/g/{z}/{y}/{x}.jpg"],
        tileSize: 256,
        maxzoom: 14,
        attribution:
          '<a href="https://s2maps.eu" target="_blank" rel="noopener">Sentinel-2 cloudless 2018</a> oleh EOX IT Services GmbH (data Copernicus Sentinel 2018)',
      },
      esri: {
        type: "raster",
        tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
        tileSize: 256,
        maxzoom: 18,
        attribution: "Citra: Esri, Maxar, Earthstar Geographics",
      },
      carto: {
        type: "raster",
        tiles: ["a", "b", "c", "d"].map((s) => `https://${s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png`),
        tileSize: 256,
        maxzoom: 19,
        attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> © CARTO',
      },
      land: {
        type: "geojson",
        data: "/geo/palu_land.geojson",
        attribution: 'Garis pantai: <a href="https://www.geoboundaries.org" target="_blank" rel="noopener">geoBoundaries</a> (CC BY 4.0)',
      },
    },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": "#0e2233" } },
      { id: "offline-land", type: "fill", source: "land", filter: ["==", ["get", "kind"], "land"], paint: { "fill-color": "#1d3449" } },
      { id: "offline-coast", type: "line", source: "land", filter: ["==", ["get", "kind"], "land"], paint: { "line-color": "#5d7a96", "line-width": 1 } },
      { id: "base-s2", type: "raster", source: "s2", paint: raster },
      { id: "base-esri", type: "raster", source: "esri", paint: raster, layout: { visibility: "none" } },
      { id: "base-carto", type: "raster", source: "carto", paint: { "raster-opacity": 1, "raster-saturation": -0.35 }, layout: { visibility: "none" } },
    ],
    transition: { duration: 650, delay: 0 },
  };
}

/* ---------- ekspresi ---------- */
const zoneColor: ExpressionSpecification = [
  "match", ["get", "zone"],
  "hijau", "#0CA30C", "kuning", "#FAB219", "oranye", "#EC835A", "merah", "#D03B3B",
  "#8A97A6",
];

const bySI = (a: number, b: number): ExpressionSpecification =>
  ["interpolate", ["linear"], ["sqrt", ["get", "si"]], 44721, a, 200000, b];
const radiusSI: ExpressionSpecification = ["interpolate", ["linear"], ["zoom"], 11, bySI(3.2, 6.5), 13, bySI(4.6, 9.5), 16, bySI(8, 17)];

const byClaim = (a: number, b: number): ExpressionSpecification =>
  ["interpolate", ["linear"], ["sqrt", ["get", "claim"]], 0, a, 173205, b];
const radiusClaim: ExpressionSpecification = ["interpolate", ["linear"], ["zoom"], 11, byClaim(1.6, 12), 13, byClaim(2.6, 19), 16, byClaim(4.5, 36)];

const heatRadius: ExpressionSpecification = ["interpolate", ["exponential", 2], ["zoom"], 11, 20, 13, 58, 15, 150];

function heatColor(ramp: readonly string[]): ExpressionSpecification {
  const rgba = (hex: string, a: number) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };
  return ["interpolate", ["linear"], ["heatmap-density"],
    0, "rgba(0,0,0,0)", 0.08, rgba(ramp[0], 0.45), 0.3, rgba(ramp[1], 0.78), 0.65, rgba(ramp[2], 0.9), 1, rgba(ramp[2], 0.97)];
}

const OBS: FilterSpecification = ["==", ["get", "obs"], 1];
const HID: FilterSpecification = ["==", ["get", "obs"], 0];

/* ---------- lapisan data ---------- */
export function overlayLayers(): LayerSpecification[] {
  const circle = (id: string, filter: FilterSpecification | null, paint: Record<string, unknown>): LayerSpecification =>
    ({ id, type: "circle", source: "assets", ...(filter ? { filter } : {}), paint: { "circle-opacity": 0, "circle-stroke-opacity": 0, ...paint } }) as LayerSpecification;

  const heat = (sensor: Sensor): LayerSpecification => ({
    id: `heat-${sensor}`,
    type: "heatmap",
    source: "assets",
    ...(sensor === "d_surf" ? { filter: OBS } : {}),
    paint: {
      "heatmap-weight": ["get", sensor],
      "heatmap-radius": heatRadius,
      "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 11, 1.5, 15, 2.2],
      "heatmap-color": heatColor(SENSOR[sensor].ramp),
      "heatmap-opacity": 0,
    },
  });

  return [
    {
      id: "shake-heat", type: "heatmap", source: "shake",
      paint: {
        "heatmap-weight": ["interpolate", ["linear"], ["get", "mmi"], 7.0, 0, 9.0, 1],
        "heatmap-radius": ["interpolate", ["exponential", 2], ["zoom"], 10, 13, 13, 105, 16, 840],
        "heatmap-intensity": 0.42,
        "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"],
          0, "rgba(42,120,214,0)", 0.25, "rgba(158,197,244,0.28)", 0.6, "rgba(57,135,229,0.5)", 1, "rgba(16,66,129,0.7)"],
        "heatmap-opacity": 0,
      },
    },
    heat("d_surf"), heat("d_vol"), heat("d_water"),
    { id: "liq-fill", type: "fill", source: "liq", paint: { "fill-color": "#EC835A", "fill-opacity": 0 } },
    { id: "liq-line", type: "line", source: "liq", paint: { "line-color": "#ffd2bf", "line-width": 1.5, "line-dasharray": [2, 2], "line-opacity": 0 } },
    { id: "clouds", type: "fill", source: "clouds", paint: { "fill-color": "#f4f8fc", "fill-opacity": 0 } },
    { id: "fault-casing", type: "line", source: "fault", paint: { "line-color": "#0b1826", "line-width": 4, "line-opacity": 0 }, layout: { "line-cap": "round" } },
    { id: "fault-line", type: "line", source: "fault", paint: { "line-color": "#ffffff", "line-width": 2, "line-dasharray": [3, 2], "line-opacity": 0 } },
    { id: "shake-casing", type: "line", source: "shakeline", paint: { "line-color": "#0b1826", "line-width": 5, "line-opacity": 0 }, layout: { "line-join": "round" } },
    { id: "shake-line", type: "line", source: "shakeline", paint: { "line-color": "#9ec5f4", "line-width": 2.5, "line-dasharray": [2, 1.5], "line-opacity": 0 }, layout: { "line-join": "round" } },
    { id: "links", type: "line", source: "links", paint: { "line-color": "#ffffff", "line-width": 1.2, "line-dasharray": [2, 2], "line-opacity": 0 } },

    circle("lihat-dots", null, { "circle-color": "#ffffff", "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 1.8, 14, 3.2, 16, 5], "circle-stroke-width": 0 }),
    circle("lihat-hidden", HID, { "circle-color": "rgba(0,0,0,0)", "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 3, 14, 5, 16, 7], "circle-stroke-width": 1.5, "circle-stroke-color": "#ffffff" }),
    circle("nilai-hid", HID, { "circle-color": zoneColor, "circle-radius": radiusSI, "circle-stroke-color": "#ffffff", "circle-stroke-width": 1.2 }),
    circle("nilai-obs", OBS, { "circle-color": zoneColor, "circle-radius": radiusSI, "circle-stroke-color": "#ffffff", "circle-stroke-width": 1.4 }),
    circle("hitung-hid", HID, { "circle-color": zoneColor, "circle-radius": radiusClaim, "circle-stroke-color": "#ffffff", "circle-stroke-width": 1 }),
    circle("hitung-obs", OBS, { "circle-color": zoneColor, "circle-radius": radiusClaim, "circle-stroke-color": "#ffffff", "circle-stroke-width": 1 }),
    circle("bayar-none", ["==", ["get", "adv"], 0], { "circle-color": SERIES.muted, "circle-radius": radiusSI, "circle-stroke-color": "#ffffff", "circle-stroke-width": 1 }),
    circle("bayar-adv", ["==", ["get", "adv"], 1], { "circle-color": SERIES.advance, "circle-radius": radiusSI, "circle-stroke-color": "#ffffff", "circle-stroke-width": 1.6 }),
  ];
}

/* ---------- lensa: lapisan apa yang tampil di tiap langkah ---------- */
type Target = number | [number, number];
const OPACITY_PROPS: Record<string, string[]> = {
  "shake-heat": ["heatmap-opacity"], "heat-d_surf": ["heatmap-opacity"], "heat-d_vol": ["heatmap-opacity"], "heat-d_water": ["heatmap-opacity"],
  "liq-fill": ["fill-opacity"], "liq-line": ["line-opacity"], clouds: ["fill-opacity"],
  "fault-casing": ["line-opacity"], "fault-line": ["line-opacity"], "shake-casing": ["line-opacity"], "shake-line": ["line-opacity"], links: ["line-opacity"],
  "lihat-dots": ["circle-opacity", "circle-stroke-opacity"], "lihat-hidden": ["circle-opacity", "circle-stroke-opacity"],
  "nilai-hid": ["circle-opacity", "circle-stroke-opacity"], "nilai-obs": ["circle-opacity", "circle-stroke-opacity"],
  "hitung-hid": ["circle-opacity", "circle-stroke-opacity"], "hitung-obs": ["circle-opacity", "circle-stroke-opacity"],
  "bayar-none": ["circle-opacity", "circle-stroke-opacity"], "bayar-adv": ["circle-opacity", "circle-stroke-opacity"],
};

export function lensTargets(step: StepId, sensor: Sensor): Record<string, Target> {
  switch (step) {
    case "lihat":
      return {
        [`heat-${sensor}`]: 0.92,
        clouds: sensor === "d_surf" ? 0.24 : 0.08,
        "fault-casing": 0.45, "fault-line": 0.9, "liq-fill": 0.16, "liq-line": 0.9,
        "lihat-dots": [0.85, 0],
        ...(sensor === "d_surf" ? { "lihat-hidden": [0, 0.95] as Target } : {}),
      };
    case "nilai":
      return { clouds: 0.1, "liq-line": 0.35, "nilai-hid": [0.42, 0.85], "nilai-obs": [0.96, 1] };
    case "hitung":
      return { clouds: 0.08, links: 0.8, "hitung-hid": [0.45, 0.85], "hitung-obs": [0.86, 1] };
    case "bayar":
      return { "shake-heat": 0.85, "shake-casing": 0.5, "shake-line": 1, "fault-casing": 0.3, "fault-line": 0.55, "bayar-none": [0.82, 0.9], "bayar-adv": [0.97, 1] };
  }
}

export function applyLens(map: MLMap, step: StepId, sensor: Sensor) {
  const t = lensTargets(step, sensor);
  for (const [id, props] of Object.entries(OPACITY_PROPS)) {
    if (!map.getLayer(id)) continue;
    const v = t[id] ?? 0;
    const vals = Array.isArray(v) ? v : [v, v];
    props.forEach((prop, i) => map.setPaintProperty(id, prop, vals[Math.min(i, vals.length - 1)]));
  }
}

/** Lapisan yang bisa di-hover/klik di tiap langkah. */
export const HIT_LAYERS: Record<StepId, string[]> = {
  lihat: ["lihat-dots", "lihat-hidden"],
  nilai: ["nilai-obs", "nilai-hid"],
  hitung: ["hitung-obs", "hitung-hid"],
  bayar: ["bayar-adv", "bayar-none"],
};

/** Filter dasar per lapisan aset (dipakai juga saat animasi sapuan satelit). */
export function baseFilters(sensor: Sensor): Record<string, FilterSpecification | null> {
  return {
    "lihat-dots": sensor === "d_surf" ? OBS : null,
    "lihat-hidden": HID,
    "nilai-hid": HID, "nilai-obs": OBS, "hitung-hid": HID, "hitung-obs": OBS,
    "bayar-none": ["==", ["get", "adv"], 0], "bayar-adv": ["==", ["get", "adv"], 1],
    "heat-d_surf": OBS, "heat-d_vol": null, "heat-d_water": null, links: null,
  };
}

export function applyFilters(map: MLMap, sensor: Sensor, lonMax: number | null) {
  for (const [id, f] of Object.entries(baseFilters(sensor))) {
    if (!map.getLayer(id)) continue;
    const sweep: FilterSpecification | null = lonMax === null ? null : ["<=", ["get", "lon"], lonMax];
    const parts = [f, sweep].filter(Boolean) as FilterSpecification[];
    map.setFilter(id, parts.length === 0 ? null : parts.length === 1 ? parts[0] : (["all", ...parts] as FilterSpecification));
  }
}

/* ---------- GeoJSON dari respons API ---------- */
type FC = GeoJSON.FeatureCollection;

export function assetsFC(s: Scenario): FC {
  return {
    type: "FeatureCollection",
    features: s.assets.map((a) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [a.lon, a.lat] },
      properties: {
        id: a.id, type: a.type, zone: a.zone, obs: a.observed ? 1 : 0, si: a.sum_insured, claim: a.claim,
        adv: a.advance > 0 ? 1 : 0, sdsi: a.sdsi, d_surf: a.d_surf, d_vol: a.d_vol, d_water: a.d_water, lon: a.lon,
      },
    })),
  };
}

export function linksFC(s: Scenario): FC {
  const byId = new Map(s.assets.map((a) => [a.id, a]));
  const features: GeoJSON.Feature[] = [];
  for (const a of s.assets) {
    if (a.observed) continue;
    for (const nid of a.neighbors) {
      const n = byId.get(nid);
      if (n) features.push({ type: "Feature", geometry: { type: "LineString", coordinates: [[a.lon, a.lat], [n.lon, n.lat]] }, properties: { lon: Math.min(a.lon, n.lon) } });
    }
  }
  return { type: "FeatureCollection", features };
}

export function cloudsFC(s: Scenario): FC {
  return {
    type: "FeatureCollection",
    features: s.clouds.flatMap((c) =>
      c.rings.map((ring, i) => ({ type: "Feature" as const, geometry: { type: "Polygon" as const, coordinates: [ring] }, properties: { ring: i } })),
    ),
  };
}

export function shakeLineFC(s: Scenario): FC {
  return { type: "FeatureCollection", features: s.shake_line.map((l) => ({ type: "Feature", geometry: { type: "LineString", coordinates: l }, properties: {} })) };
}

export function faultFC(meta: Meta): FC {
  return { type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "LineString", coordinates: meta.geo.fault }, properties: {} }] };
}

export function liqFC(meta: Meta): FC {
  return {
    type: "FeatureCollection",
    features: meta.geo.liquefaction.map((z) => {
      const k = Math.cos((z.lat * Math.PI) / 180);
      const ring: number[][] = [];
      for (let i = 0; i <= 64; i++) {
        const t = (i / 64) * 2 * Math.PI;
        const wob = 1 + 0.08 * Math.sin(3 * t + 1) + 0.05 * Math.sin(5 * t);
        ring.push([z.lon + (Math.cos(t) * z.radius_km * wob) / (111.32 * k), z.lat + (Math.sin(t) * z.radius_km * wob) / 111.32]);
      }
      return { type: "Feature", geometry: { type: "Polygon", coordinates: [ring] }, properties: { name: z.name } };
    }),
  };
}

export function shakeGridFC(meta: Meta): FC {
  return {
    type: "FeatureCollection",
    features: meta.shake_grid.map(([lon, lat, mmi]) => ({ type: "Feature", geometry: { type: "Point", coordinates: [lon, lat] }, properties: { mmi } })),
  };
}

export const EMPTY: FC = { type: "FeatureCollection", features: [] };
