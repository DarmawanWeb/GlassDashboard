"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { type GeoJSONSource, type Map as MLMap, type MapMouseEvent, type RasterTileSource } from "maplibre-gl";
import type { Asset, Basemap, Meta, Mission, Policy, ScanResult, Scenario, Sensor, StepId } from "@/lib/types";
import type { MissionPlayer, PlayerState, Pose } from "@/lib/mission";
import { nearestSurf } from "@/lib/palette";
import { useI18n, type Dict } from "@/lib/i18n";
import type { Fmt } from "@/lib/format";
import { useTheme } from "@/lib/theme";
import Graticule from "./Graticule";
import MapLegend from "./MapLegend";
import {
  BASEMAP_ORDER, BASEMAPS, CITY_BOUNDS, EMPTY, HIT_LAYERS,
  applyFilters, applyLens, assetsFC, baseStyle, cartoTiles, cloudsFC, faultFC, linksFC, liqFC, overlayLayers, routeDoneFC,
  routeFC, shakeGridFC, shakeLineFC, targetsFC,
} from "./layers";

export interface GlassMapProps {
  meta: Meta;
  scenario: Scenario | null;
  step: StepId;
  sensor: Sensor;
  basemap: Basemap;
  onBasemap: (b: Basemap) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  sweepKey: number;
  policy: Policy;
  mission: Mission | null;
  scans: Record<string, ScanResult>;
  player: MissionPlayer | null;
  playerState: PlayerState | null;
  follow: boolean;
  children?: React.ReactNode;
}

const SOURCE_OF: Record<Basemap, string | null> = { s2: "s2", esri: "esri", carto: "carto", offline: null };

function tipLines(t: Dict, f: Fmt, a: Asset, step: StepId, sensor: Sensor, policy: Policy, scan?: ScanResult): string[] {
  const T = t.map.tip;
  switch (step) {
    case "lihat":
      if (sensor === "d_surf") return [a.observed ? T.photo(t.damage[nearestSurf(a.d_surf)].toLowerCase()) : T.photoHidden];
      return [`${t.sensor[sensor].label}: ${f.dec(a[sensor], 2)}`];
    case "pindai":
      if (scan) return [T.drone(t.damage[scan.estimate.cls].toLowerCase()), T.roof(f.pct(scan.estimate.roof))];
      return [a.source === "satelit" && !(a.sat?.observed ?? a.observed) ? T.satHidden : T.notScanned];
    case "nilai":
      return [T.sdsi(f.dec(a.sdsi, 2), t.zoneName(t.zone[a.zone].label)),
        a.source !== "satelit" ? T.fromDrone : a.observed ? "" : T.estimated].filter(Boolean);
    case "hitung":
      return [T.claim(f.rupiah(a.claim)), a.observed ? T.caseRes : T.ibnr];
    case "bayar":
      return [T.shaking(f.mmi(a.mmi, true)), a.advance > 0 ? T.advance(f.rupiah(a.advance)) : T.below(f.mmi(policy.mmi_trigger, true))];
  }
}

/** Ikon quadcopter tampak atas. */
const DRONE_SVG = `
<svg viewBox="0 0 48 48" width="40" height="40" aria-hidden="true">
  <g stroke="#0b1826" stroke-width="2.4" stroke-linecap="round"><path d="M13 13 L35 35 M35 13 L13 35"/></g>
  <g stroke="#ffffff" stroke-width="1.6" stroke-linecap="round"><path d="M13 13 L35 35 M35 13 L13 35"/></g>
  <g class="drone-rotors" fill="rgba(214,232,251,.42)" stroke="#ffffff" stroke-width="1.2">
    <circle cx="11" cy="11" r="7.5"/><circle cx="37" cy="11" r="7.5"/><circle cx="11" cy="37" r="7.5"/><circle cx="37" cy="37" r="7.5"/>
  </g>
  <rect x="17.5" y="16" width="13" height="16" rx="4" fill="#ffffff" stroke="#0b1826" stroke-width="1.6"/>
  <circle cx="24" cy="27" r="2.6" fill="#0b1826"/>
  <path d="M24 9 l3.5 5 h-7z" fill="#7cc4ff" stroke="#0b1826" stroke-width="1"/>
</svg>`;

export default function GlassMap(p: GlassMapProps) {
  const { meta, scenario, step, sensor, basemap, onBasemap, selectedId, onSelect, sweepKey, policy, mission, scans, player, playerState, follow } = p;
  const { t, f } = useI18n();
  const theme = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const sweepRef = useRef<HTMLDivElement>(null);
  const sweepLabelRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MLMap | null>(null);
  const [ready, setReady] = useState(false);
  const [tip, setTip] = useState<{ x: number; y: number; id: string } | null>(null);
  const [notice, setNotice] = useState(false);
  const [epiX, setEpiX] = useState<number | null>(null);

  const assetsById = useMemo(() => new Map((scenario?.assets ?? []).map((a) => [a.id, a])), [scenario]);
  const live = useRef({ step, sensor, assetsById, onSelect, basemap, sweeping: false, onBasemap, theme });
  useEffect(() => {
    live.current = { ...live.current, step, sensor, assetsById, onSelect, basemap, onBasemap, theme };
  });

  const labels = useRef<{ el: HTMLElement; marker: maplibregl.Marker; show: StepId[]; text: (d: Dict) => string }[]>([]);
  const selMarker = useRef<maplibregl.Marker | null>(null);
  const droneMarker = useRef<{ marker: maplibregl.Marker; body: HTMLElement; fp: HTMLElement } | null>(null);
  const baseMarker = useRef<maplibregl.Marker | null>(null);
  const lastPose = useRef<Pose | null>(null);

  /* 1) buat peta sekali */
  useEffect(() => {
    if (!containerRef.current) return;
    const m = new maplibregl.Map({
      container: containerRef.current,
      style: baseStyle(live.current.theme),
      bounds: CITY_BOUNDS,
      fitBoundsOptions: { padding: 24 },
      minZoom: 10,
      maxZoom: 17,
      maxBounds: [[119.5, -1.25], [120.2, -0.5]],
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    });
    m.touchZoomRotate.disableRotation();
    m.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    m.addControl(new maplibregl.ScaleControl({ unit: "metric", maxWidth: 110 }), "bottom-left");
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");

    let errors = 0;
    let loaded = 0;
    m.on("sourcedata", (e) => {
      if (e.sourceId === SOURCE_OF[live.current.basemap] && e.tile) loaded += 1;
    });
    const HOST: Record<string, string> = { s2: "eox.at", esri: "arcgisonline", carto: "cartocdn" };
    m.on("error", (e) => {
      const cur = SOURCE_OF[live.current.basemap];
      if (!cur) return;
      const ev = e as unknown as { sourceId?: string; error?: { url?: string; message?: string } };
      const text = `${ev.error?.url ?? ""} ${ev.error?.message ?? ""}`;
      if (ev.sourceId !== cur && !text.includes(HOST[cur])) return;
      errors += 1;
      if (errors >= 6 && loaded === 0) {
        errors = 0;
        live.current.onBasemap("offline");
        setNotice(true);
      }
    });
    m.on("styledata", () => {
      errors = 0;
      loaded = 0;
    });

    m.on("load", () => {
      for (const id of ["assets", "links", "clouds", "shakeline", "route", "routeDone", "targets"]) m.addSource(id, { type: "geojson", data: EMPTY });
      m.addSource("fault", { type: "geojson", data: faultFC(meta) });
      m.addSource("liq", { type: "geojson", data: liqFC(meta) });
      m.addSource("shake", { type: "geojson", data: shakeGridFC(meta) });
      for (const layer of overlayLayers()) m.addLayer(layer);

      const mk = (text: (d: Dict) => string, lngLat: [number, number], show: StepId[], offset: [number, number]) => {
        const el = document.createElement("div");
        el.className = "map-label";
        const marker = new maplibregl.Marker({ element: el, anchor: "left", offset }).setLngLat(lngLat).addTo(m);
        labels.current.push({ el, marker, show, text });
      };
      mk((d) => d.map.fault, [119.8445, -0.925], ["lihat", "bayar"], [8, 0]);
      for (const z of meta.geo.liquefaction) mk((d) => d.map.liq(z.name), [z.lon, z.lat], ["lihat", "nilai"], [Math.round(z.radius_km * 30) + 6, 0]);
      setReady(true);
    });

    const hit = (e: MapMouseEvent) => {
      const layers = HIT_LAYERS[live.current.step].filter((id) => m.getLayer(id));
      const r = 7;
      const feats = m.queryRenderedFeatures([[e.point.x - r, e.point.y - r], [e.point.x + r, e.point.y + r]], { layers });
      let best: { id: string; d: number } | null = null;
      for (const f of feats) {
        const c = (f.geometry as GeoJSON.Point).coordinates as [number, number];
        const q = m.project(c);
        const d = Math.hypot(q.x - e.point.x, q.y - e.point.y);
        if (!best || d < best.d) best = { id: String(f.properties?.id), d };
      }
      return best?.id ?? null;
    };
    m.on("mousemove", (e) => {
      if (live.current.sweeping) return;
      const id = hit(e);
      m.getCanvas().style.cursor = id ? "pointer" : "";
      setTip(id ? { x: e.point.x, y: e.point.y, id } : null);
    });
    m.on("mouseout", () => setTip(null));
    m.on("click", (e) => live.current.onSelect(hit(e)));

    const epi = () => {
      const b = m.getBounds();
      setEpiX(m.project([meta.geo.epicenter.lon, b.getNorth()]).x);
    };
    m.on("move", epi);
    m.once("load", epi);

    setMap(m);
    return () => {
      labels.current = [];
      selMarker.current = null;
      droneMarker.current = null;
      baseMarker.current = null;
      m.remove();
      setMap(null);
      setReady(false);
    };
  }, [meta]);

  /* 2) data skenario -> sumber peta */
  useEffect(() => {
    if (!ready || !map || !scenario) return;
    (map.getSource("assets") as GeoJSONSource).setData(assetsFC(scenario));
    (map.getSource("links") as GeoJSONSource).setData(linksFC(scenario));
    (map.getSource("clouds") as GeoJSONSource).setData(cloudsFC(scenario));
    (map.getSource("shakeline") as GeoJSONSource).setData(shakeLineFC(scenario));
  }, [ready, map, scenario]);

  /* 3) lensa per langkah */
  useEffect(() => {
    if (!ready || !map) return;
    applyLens(map, step, sensor);
    if (!live.current.sweeping) applyFilters(map, sensor, null);
    for (const l of labels.current) l.el.style.display = l.show.includes(step) ? "" : "none";
    setTip(null);
  }, [ready, map, step, sensor]);

  /* label peta mengikuti bahasa */
  useEffect(() => {
    if (!ready) return;
    for (const l of labels.current) l.el.textContent = l.text(t);
  }, [ready, t]);

  /* 4) peta dasar */
  useEffect(() => {
    if (!ready || !map) return;
    for (const [key, cfg] of Object.entries(BASEMAPS)) map.setLayoutProperty(cfg.layer, "visibility", key === basemap ? "visible" : "none");
    if (basemap !== "offline") setNotice(false);
  }, [ready, map, basemap]);

  /* peta jalan ikut tema terang/gelap */
  useEffect(() => {
    if (!ready || !map) return;
    (map.getSource("carto") as RasterTileSource | undefined)?.setTiles(cartoTiles(theme));
  }, [ready, map, theme]);

  /* pemberitahuan hilang sendiri */
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(false), 9000);
    return () => clearTimeout(timer);
  }, [notice]);

  /* 5) aset terpilih */
  useEffect(() => {
    if (!map) return;
    const a = selectedId ? assetsById.get(selectedId) : undefined;
    if (!a) {
      selMarker.current?.remove();
      selMarker.current = null;
      return;
    }
    if (!selMarker.current) {
      const el = document.createElement("div");
      el.className = "sel-ring";
      selMarker.current = new maplibregl.Marker({ element: el }).setLngLat([a.lon, a.lat]).addTo(map);
    } else {
      selMarker.current.setLngLat([a.lon, a.lat]);
      const el = selMarker.current.getElement();
      el.classList.remove("sel-ring");
      void el.offsetWidth; // ulang animasi denyut
      el.classList.add("sel-ring");
    }
    if (!map.getBounds().contains([a.lon, a.lat])) map.easeTo({ center: [a.lon, a.lat], duration: 600 });
  }, [map, selectedId, assetsById]);

  /* 6) sapuan satelit: titik muncul saat garis pindai lewat */
  useEffect(() => {
    if (!ready || !map || !scenario || sweepKey === 0) return;
    const line = sweepRef.current, label = sweepLabelRef.current;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !line || !label) return;
    const w = map.getContainer().clientWidth;
    const h = map.getContainer().clientHeight;
    const dur = 1700;
    const t0 = performance.now();
    let raf = 0;
    live.current.sweeping = true;
    line.style.display = label.style.display = "block";
    const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const frame = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      const x = ease(t) * (w + 160);
      line.style.transform = `translateX(${x - 140}px)`;
      label.style.left = `${x - 6}px`;
      const lon = map.unproject([Math.min(x, w), h / 2]).lng;
      applyFilters(map, live.current.sensor, x >= w ? null : lon);
      if (t < 1) raf = requestAnimationFrame(frame);
      else finish();
    };
    const finish = () => {
      live.current.sweeping = false;
      line.style.display = label.style.display = "none";
      applyFilters(map, live.current.sensor, null);
    };
    applyFilters(map, live.current.sensor, map.unproject([0, h / 2]).lng);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      finish();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sweepKey, ready, map]);

  /* 7) misi drone: rute, target, posko */
  const currentId = playerState && (playerState.phase === "scan" || playerState.phase === "transit") && mission
    ? mission.targets[playerState.idx]?.id ?? null : null;
  useEffect(() => {
    if (!ready || !map) return;
    (map.getSource("route") as GeoJSONSource).setData(routeFC(mission));
    baseMarker.current?.remove();
    baseMarker.current = null;
    if (mission) {
      const el = document.createElement("div");
      el.className = "base-marker";
      el.innerHTML = `<span class="base-dot">H</span><span class="base-label"></span>`;
      (el.querySelector(".base-label") as HTMLElement).textContent = t.map.base;
      el.style.display = live.current.step === "pindai" ? "" : "none";
      baseMarker.current = new maplibregl.Marker({ element: el, anchor: "left", offset: [-11, 0] })
        .setLngLat([mission.base.lon, mission.base.lat]).addTo(map);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, map, mission]);

  useEffect(() => {
    const el = baseMarker.current?.getElement().querySelector(".base-label");
    if (el) el.textContent = t.map.base;
  }, [t, mission]);

  useEffect(() => {
    if (baseMarker.current) baseMarker.current.getElement().style.display = step === "pindai" ? "" : "none";
  }, [step, mission, ready]);

  const doneUpto = playerState?.scanned ?? 0;
  useEffect(() => {
    if (!ready || !map) return;
    (map.getSource("targets") as GeoJSONSource).setData(targetsFC(mission, scans, currentId));
    const home = playerState?.phase === "done" && !playerState.skipping;
    (map.getSource("routeDone") as GeoJSONSource).setData(routeDoneFC(mission, doneUpto, home));
  }, [ready, map, mission, scans, currentId, doneUpto, playerState?.phase, playerState?.skipping]);

  /* rute baru: tampilkan seluruhnya */
  useEffect(() => {
    if (!ready || !map || !mission || step !== "pindai" || mission.route.length < 2) return;
    const b = new maplibregl.LngLatBounds();
    for (const c of mission.route) b.extend(c as [number, number]);
    map.fitBounds(b, { padding: { top: 60, bottom: 60, left: 60, right: 60 }, duration: 800, maxZoom: 14 });
  }, [ready, map, mission, step]);

  /* drone: posisi diperbarui tiap frame tanpa render ulang React */
  useEffect(() => {
    if (!ready || !map || !player || !mission) return;
    const el = document.createElement("div");
    el.className = "drone-marker";
    el.innerHTML = `<div class="drone-fp"></div><div class="drone-shadow"></div><div class="drone-body">${DRONE_SVG}</div>`;
    const body = el.querySelector(".drone-body") as HTMLElement;
    const fp = el.querySelector(".drone-fp") as HTMLElement;
    const marker = new maplibregl.Marker({ element: el }).setLngLat([mission.base.lon, mission.base.lat]).addTo(map);
    droneMarker.current = { marker, body, fp };
    const [fw, fh] = mission.camera.footprint_m;
    const size = (lat: number, lon: number) => {
      const k = Math.cos((lat * Math.PI) / 180);
      const a = map.project([lon, lat]);
      const b = map.project([lon + fw / (111320 * k), lat]);
      const w = Math.max(6, Math.abs(b.x - a.x));
      fp.style.width = `${w}px`;
      fp.style.height = `${(w * fh) / fw}px`;
    };
    const onPose = (q: Pose) => {
      lastPose.current = q;
      marker.setLngLat([q.lon, q.lat]);
      body.style.transform = `rotate(${q.heading}deg)`;
      el.dataset.phase = q.phase;
      size(q.lat, q.lon);
    };
    const off = player.onPose(onPose);
    const onZoom = () => { const q = lastPose.current; if (q) size(q.lat, q.lon); };
    map.on("zoom", onZoom);
    size(mission.base.lat, mission.base.lon);
    return () => {
      off();
      map.off("zoom", onZoom);
      marker.remove();
      droneMarker.current = null;
    };
  }, [ready, map, player, mission]);

  useEffect(() => {
    const d = droneMarker.current;
    if (d) d.marker.getElement().style.display = step === "pindai" ? "" : "none";
  }, [step, player, ready]);

  /* ikuti drone: geser peta ke target saat mulai memindai */
  const phase = playerState?.phase, idx = playerState?.idx ?? -1;
  useEffect(() => {
    if (!map || !follow || !mission || phase !== "scan" || step !== "pindai") return;
    const target = mission.targets[idx];
    if (target) map.easeTo({ center: [target.lon, target.lat], zoom: Math.max(map.getZoom(), 14.6), duration: 700 });
  }, [map, follow, mission, phase, idx, step]);

  const tipAsset = tip ? assetsById.get(tip.id) : undefined;

  return (
    <div className="sheet-frame">
      <div ref={containerRef} className="map-root" aria-label={t.map.region} role="region" />
      <Graticule map={map} />

      <div ref={sweepRef} className="sweep" style={{ display: "none" }} aria-hidden="true" />
      <div ref={sweepLabelRef} className="sweep-label" style={{ display: "none" }} aria-hidden="true">{t.map.sweep}</div>

      {(step === "lihat" || step === "bayar") && epiX !== null && epiX > 60 && (
        <div className="epicenter" style={{ left: epiX }}>
          <span className="epicenter-arrow" />
          <span className="epicenter-label">{t.map.epicenter}</span>
        </div>
      )}

      <div className="map-card basemaps" role="group" aria-label={t.map.basemapGroup}>
        {BASEMAP_ORDER.map((b) => (
          <button key={b} type="button" className="basemap-btn" aria-pressed={basemap === b} onClick={() => onBasemap(b)}>
            {t.map.basemap[b]}
          </button>
        ))}
      </div>

      {notice && (
        <div className="notice" role="status">
          {t.map.offline}
          <button type="button" onClick={() => { setNotice(false); onBasemap("s2"); }}>{t.map.retry}</button>
        </div>
      )}

      {step !== "pindai" && (
        <div className="map-card title-block">
          <div className="title-block-place">{t.map.place}</div>
          <div className="title-block-event">{t.map.event}</div>
          <div>
            <span className="stamp">{t.map.stamp}</span>
            <span className="stamp-note">{t.map.stampNote}</span>
          </div>
        </div>
      )}

      <MapLegend step={step} sensor={sensor} scenario={scenario} policy={policy} mission={mission} scans={scans} />

      {p.children}

      {tip && tipAsset && (
        <div className="map-tip" style={{ left: tip.x, top: tip.y }}>
          <div className="map-tip-id">{tipAsset.id}</div>
          <div className="map-tip-sub">{t.type[tipAsset.type]}</div>
          {tipLines(t, f, tipAsset, step, sensor, policy, scans[tipAsset.id]).map((l) => <div key={l}>{l}</div>)}
        </div>
      )}
    </div>
  );
}
