"use client";

import { useEffect, useState } from "react";
import type { Map as MLMap } from "maplibre-gl";

/** Garis kisi tepi lembar peta (lintang/bujur) seperti peta cetak. */
interface Tick { pos: number; label: string }

const STEPS_MIN = [0.25, 0.5, 1, 2, 5, 10];

function fmtDeg(v: number, axis: "lat" | "lon"): string {
  const a = Math.abs(v);
  let d = Math.floor(a + 1e-9);
  let m = (a - d) * 60;
  if (m > 59.95) { d += 1; m = 0; }
  const mStr = Math.abs(m - Math.round(m)) < 0.01 ? `${Math.round(m)}` : m.toFixed(1).replace(".", ",");
  const hemi = axis === "lat" ? (v < 0 ? "LS" : "LU") : v < 0 ? "BB" : "BT";
  return `${d}°${mStr}′ ${hemi}`;
}

function ticks(min: number, max: number, pxSpan: number, target: number): number[] {
  const spanMin = (max - min) * 60;
  const step = STEPS_MIN.find((s) => spanMin / s <= Math.max(2, Math.floor(pxSpan / target))) ?? 10;
  const out: number[] = [];
  const s = step / 60;
  for (let v = Math.ceil(min / s) * s; v <= max + 1e-9; v += s) out.push(v);
  return out;
}

export default function Graticule({ map }: { map: MLMap | null }) {
  const [state, setState] = useState<{ w: number; h: number; lon: Tick[]; lat: Tick[] }>({ w: 0, h: 0, lon: [], lat: [] });

  useEffect(() => {
    if (!map) return;
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const c = map.getContainer();
        const w = c.clientWidth, h = c.clientHeight;
        const b = map.getBounds();
        const lon = ticks(b.getWest(), b.getEast(), w, 120).map((v) => ({ pos: map.project([v, b.getCenter().lat]).x, label: fmtDeg(v, "lon") }));
        const lat = ticks(b.getSouth(), b.getNorth(), h, 90).map((v) => ({ pos: map.project([b.getCenter().lng, v]).y, label: fmtDeg(v, "lat") }));
        setState({ w, h, lon: lon.filter((t) => t.pos > 30 && t.pos < w - 30), lat: lat.filter((t) => t.pos > 14 && t.pos < h - 14) });
      });
    };
    update();
    map.on("move", update);
    map.on("resize", update);
    return () => {
      cancelAnimationFrame(raf);
      map.off("move", update);
      map.off("resize", update);
    };
  }, [map]);

  return (
    <>
      {state.lon.map((t) => (
        <span key={`x${t.label}`}>
          <i className="grat-tick" style={{ left: t.pos, top: -7, width: 1, height: 6 }} />
          <i className="grat-tick" style={{ left: t.pos, bottom: -7, width: 1, height: 6 }} />
          <span className="grat-label" style={{ left: t.pos, top: -22, transform: "translateX(-50%)" }}>{t.label}</span>
        </span>
      ))}
      {state.lat.map((t) => (
        <span key={`y${t.label}`}>
          <i className="grat-tick" style={{ top: t.pos, left: -7, height: 1, width: 6 }} />
          <i className="grat-tick" style={{ top: t.pos, right: -7, height: 1, width: 6 }} />
          <span className="grat-label" style={{ top: t.pos, left: -10, transform: "translate(-100%, -50%)" }}>{t.label}</span>
        </span>
      ))}
    </>
  );
}
