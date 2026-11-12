"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { type GeoJSONSource, type Map as MLMap, type MapMouseEvent } from "maplibre-gl";
import type { Asset, Basemap, Meta, Policy, Scenario, Sensor, StepId } from "@/lib/types";
import { SENSOR, SURF_CLASSES, TYPE_LABEL, ZONE } from "@/lib/palette";
import { dec, mmi, rupiah } from "@/lib/format";
import Graticule from "./Graticule";
import MapLegend from "./MapLegend";
import {
  BASEMAP_LABEL, BASEMAP_ORDER, BASEMAPS, CITY_BOUNDS, EMPTY, HIT_LAYERS,
  applyFilters, applyLens, assetsFC, baseStyle, cloudsFC, faultFC, linksFC, liqFC, overlayLayers, shakeGridFC, shakeLineFC,
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
}

const SOURCE_OF: Record<Basemap, string | null> = { s2: "s2", esri: "esri", carto: "carto", offline: null };

function surfLabel(v: number) {
  return SURF_CLASSES.reduce((best, c) => (Math.abs(c.value - v) < Math.abs(best.value - v) ? c : best)).label;
}

function tipLines(a: Asset, step: StepId, sensor: Sensor, policy: Policy): string[] {
  switch (step) {
    case "lihat":
      if (sensor === "d_surf") return [a.observed ? `Foto: ${surfLabel(a.d_surf).toLowerCase()}` : "Foto tertutup awan"];
      return [`${SENSOR[sensor].label}: ${dec(a[sensor], 2)}`];
    case "nilai":
      return [`SDSI ${dec(a.sdsi, 2)}, zona ${ZONE[a.zone].label.toLowerCase()}`, ...(a.observed ? [] : ["Nilai foto diperkirakan"])];
    case "hitung":
      return [`Estimasi klaim ${rupiah(a.claim)}`, a.observed ? "Cadangan klaim" : "IBNR (diperkirakan)"];
    case "bayar":
      return [`Guncangan ${mmi(a.mmi, true)}`, a.advance > 0 ? `Uang muka ${rupiah(a.advance)}` : `Di bawah ambang ${mmi(policy.mmi_trigger, true)}`];
  }
}

export default function GlassMap(p: GlassMapProps) {
  const { meta, scenario, step, sensor, basemap, onBasemap, selectedId, onSelect, sweepKey, policy } = p;
  const containerRef = useRef<HTMLDivElement>(null);
  const sweepRef = useRef<HTMLDivElement>(null);
  const sweepLabelRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MLMap | null>(null);
  const [ready, setReady] = useState(false);
  const [tip, setTip] = useState<{ x: number; y: number; id: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [epiX, setEpiX] = useState<number | null>(null);

  const assetsById = useMemo(() => new Map((scenario?.assets ?? []).map((a) => [a.id, a])), [scenario]);
  const live = useRef({ step, sensor, assetsById, onSelect, basemap, sweeping: false, onBasemap });
  useEffect(() => {
    live.current = { ...live.current, step, sensor, assetsById, onSelect, basemap, onBasemap };
  });

  const labels = useRef<{ el: HTMLElement; marker: maplibregl.Marker; show: StepId[] }[]>([]);
  const selMarker = useRef<maplibregl.Marker | null>(null);

  /* 1) buat peta sekali */
  useEffect(() => {
    if (!containerRef.current) return;
    const m = new maplibregl.Map({
      container: containerRef.current,
      style: baseStyle(),
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
        setNotice("Citra satelit tidak termuat (cek internet). Peta beralih ke mode offline.");
      }
    });
    m.on("styledata", () => {
      errors = 0;
      loaded = 0;
    });

    m.on("load", () => {
      for (const id of ["assets", "links", "clouds", "shakeline"]) m.addSource(id, { type: "geojson", data: EMPTY });
      m.addSource("fault", { type: "geojson", data: faultFC(meta) });
      m.addSource("liq", { type: "geojson", data: liqFC(meta) });
      m.addSource("shake", { type: "geojson", data: shakeGridFC(meta) });
      for (const layer of overlayLayers()) m.addLayer(layer);

      const mk = (text: string, lngLat: [number, number], show: StepId[], offset: [number, number]) => {
        const el = document.createElement("div");
        el.className = "map-label";
        el.textContent = text;
        const marker = new maplibregl.Marker({ element: el, anchor: "left", offset }).setLngLat(lngLat).addTo(m);
        labels.current.push({ el, marker, show });
      };
      mk("Sesar Palu-Koro (perkiraan)", [119.8445, -0.925], ["lihat", "bayar"], [8, 0]);
      for (const z of meta.geo.liquefaction) mk(`Likuefaksi ${z.name}`, [z.lon, z.lat], ["lihat", "nilai"], [Math.round(z.radius_km * 30) + 6, 0]);
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

  /* 4) peta dasar */
  useEffect(() => {
    if (!ready || !map) return;
    for (const [key, cfg] of Object.entries(BASEMAPS)) map.setLayoutProperty(cfg.layer, "visibility", key === basemap ? "visible" : "none");
    if (basemap !== "offline") setNotice(null);
  }, [ready, map, basemap]);

  /* pemberitahuan hilang sendiri */
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 9000);
    return () => clearTimeout(t);
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

  const tipAsset = tip ? assetsById.get(tip.id) : undefined;

  return (
    <div className="sheet-frame">
      <div ref={containerRef} className="map-root" aria-label="Peta Kota Palu dengan aset negara" role="region" />
      <Graticule map={map} />

      <div ref={sweepRef} className="sweep" style={{ display: "none" }} aria-hidden="true" />
      <div ref={sweepLabelRef} className="sweep-label" style={{ display: "none" }} aria-hidden="true">Memindai citra satelit</div>

      {(step === "lihat" || step === "bayar") && epiX !== null && epiX > 60 && (
        <div className="epicenter" style={{ left: epiX }}>
          <span className="epicenter-arrow" />
          <span className="epicenter-label">Episentrum M7,5, ±70 km ke utara</span>
        </div>
      )}

      <div className="map-card basemaps" role="group" aria-label="Peta dasar">
        {BASEMAP_ORDER.map((b) => (
          <button key={b} type="button" className="basemap-btn" aria-pressed={basemap === b} onClick={() => onBasemap(b)}>
            {BASEMAP_LABEL[b]}
          </button>
        ))}
      </div>

      {notice && (
        <div className="notice" role="status">
          {notice}
          <button type="button" onClick={() => { setNotice(null); onBasemap("s2"); }}>Coba lagi</button>
        </div>
      )}

      <div className="map-card title-block">
        <div className="title-block-place">Kota Palu, Sulawesi Tengah</div>
        <div className="title-block-event">Gempa M7,5 dan tsunami, 28 September 2018</div>
        <div>
          <span className="stamp">Data contoh</span>
          <span className="stamp-note">lokasi & kerusakan aset disimulasikan</span>
        </div>
      </div>

      <MapLegend step={step} sensor={sensor} scenario={scenario} policy={policy} />

      {tip && tipAsset && (
        <div className="map-tip" style={{ left: tip.x, top: tip.y }}>
          <div className="map-tip-id">{tipAsset.id}</div>
          <div className="map-tip-sub">{TYPE_LABEL[tipAsset.type]}</div>
          {tipLines(tipAsset, step, sensor, policy).map((l) => <div key={l}>{l}</div>)}
        </div>
      )}
    </div>
  );
}
