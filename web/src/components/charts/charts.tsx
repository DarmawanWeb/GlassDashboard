"use client";

import { useState, type ReactNode } from "react";
import type { Pml, TypeRow, ZoneId, ZoneRow } from "@/lib/types";
import { SERIES, ZONE, ZONES } from "@/lib/palette";
import { count, dec, miliar, returnPeriod, rupiah } from "@/lib/format";

const INK = "#13283f", INK2 = "#4f6072", RULE = "#e6ebf0", SURFACE = "#ffffff";

/** Batang horizontal: ujung data membulat 4px, sisi pangkal lurus. */
function bar(x: number, y: number, w: number, h: number, r = 4, roundLeft = false, roundRight = true) {
  if (w <= 0) return "";
  const rr = Math.min(r, w / 2, h / 2);
  const rl = roundLeft ? rr : 0, rrt = roundRight ? rr : 0;
  return `M${x + rl},${y} H${x + w - rrt} Q${x + w},${y} ${x + w},${y + rrt} V${y + h - rrt} Q${x + w},${y + h} ${x + w - rrt},${y + h} H${x + rl} Q${x},${y + h} ${x},${y + h - rl} V${y + rl} Q${x},${y} ${x + rl},${y} Z`;
}

function Tip({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  return <div className="chart-tip" style={{ left: `${x}%`, top: `${y}%` }}>{children}</div>;
}

/* ---------- komposisi zona (jumlah aset) ---------- */
export function ZoneComposition({ rows }: { rows: ZoneRow[] }) {
  const total = rows.reduce((s, r) => s + r.count, 0) || 1;
  const W = 400, H = 30, gap = 2;
  const nonzero = ZONES.filter((z) => (rows.find((q) => q.zone === z)?.count ?? 0) > 0);
  const avail = W - gap * Math.max(nonzero.length - 1, 0);
  let x = 0;
  const [hover, setHover] = useState<ZoneId | null>(null);
  const segs = nonzero.map((z) => {
    const r = rows.find((q) => q.zone === z)!;
    const w = (r.count / total) * avail;
    const seg = { z, r, x, w };
    x += w + gap;
    return seg;
  });
  const hs = segs.find((s) => s.z === hover);
  return (
    <div className="chart-wrap">
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Komposisi aset per zona">
        {segs.map((s, i) => (
          <path key={s.z} d={bar(s.x, 0, s.w, H, 4, i === 0, i === segs.length - 1)} fill={ZONE[s.z].color}
            onMouseEnter={() => setHover(s.z)} onMouseLeave={() => setHover(null)} />
        ))}
      </svg>
      <div className="zone-keys">
        {ZONES.map((z) => {
          const r = rows.find((q) => q.zone === z);
          return (
            <div className="zone-key" key={z} style={{ borderLeftColor: ZONE[z].color }}>
              <b>{r?.count ?? 0}</b>
              <span>{ZONE[z].label}, {ZONE[z].meaning.toLowerCase()}</span>
            </div>
          );
        })}
      </div>
      {hs && (
        <Tip x={((hs.x + hs.w / 2) / W) * 100} y={0}>
          <b>{ZONE[hs.z].label}</b>, {ZONE[hs.z].meaning.toLowerCase()}<br />
          {hs.r.count} aset ({dec((hs.r.count / total) * 100, 0)}%)
        </Tip>
      )}
    </div>
  );
}

/* ---------- klaim per zona ---------- */
export function ZoneClaims({ rows }: { rows: ZoneRow[] }) {
  const W = 400, rowH = 34, barH = 14, labelW = 66, valueW = 104;
  const max = Math.max(...rows.map((r) => r.claim + r.claim_estimated), 1);
  const scale = (v: number) => (v / max) * (W - labelW - valueW);
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div className="chart-wrap">
      <div className="chart-legend">
        <span><i className="key" style={{ background: "#7a8898" }} />Foto terlihat (cadangan klaim)</span>
        <span><i className="key" style={{ background: "#7a8898", opacity: 0.4 }} />Tertutup awan (IBNR)</span>
      </div>
      <svg className="chart" viewBox={`0 0 ${W} ${rows.length * rowH}`} role="img" aria-label="Estimasi klaim per zona">
        {rows.map((r, i) => {
          const y = i * rowH + (rowH - barH) / 2;
          const w1 = scale(r.claim), w2 = scale(r.claim_estimated);
          return (
            <g key={r.zone} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={0} y={i * rowH} width={W} height={rowH} fill="transparent" />
              <text x={0} y={y + barH - 2} fontSize={13} fill={INK} fontWeight={600}>{r.label}</text>
              <path d={bar(labelW, y, w1, barH, 4, false, w2 < 1)} fill={ZONE[r.zone].color} />
              {w2 >= 1 && <path d={bar(labelW + w1 + (w1 > 0 ? 2 : 0), y, w2, barH)} fill={ZONE[r.zone].color} opacity={0.4} />}
              <text x={labelW + w1 + w2 + 8} y={y + barH - 2} fontSize={13} fill={INK} fontWeight={650}>{rupiah(r.claim + r.claim_estimated)}</text>
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <Tip x={50} y={((hover * rowH) / (rows.length * rowH)) * 100}>
          <b>Zona {rows[hover].label.toLowerCase()}</b>: {rows[hover].count} aset<br />
          Terlihat {rupiah(rows[hover].claim)}, IBNR {rupiah(rows[hover].claim_estimated)}
        </Tip>
      )}
    </div>
  );
}

/* ---------- pembayaran per jenis aset ---------- */
export function PayoutByType({ rows }: { rows: TypeRow[] }) {
  const W = 400, rowH = 36, barH = 14, labelW = 128, valueW = 96;
  const max = Math.max(...rows.map((r) => r.advance + r.topup), 1);
  const scale = (v: number) => (v / max) * (W - labelW - valueW);
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div className="chart-wrap">
      <div className="chart-legend">
        <span><i className="key" style={{ background: SERIES.advance }} />Uang muka (cepat)</span>
        <span><i className="key" style={{ background: SERIES.topup }} />Sisa setelah SDSI</span>
      </div>
      <svg className="chart" viewBox={`0 0 ${W} ${rows.length * rowH}`} role="img" aria-label="Pembayaran per jenis aset">
        {rows.map((r, i) => {
          const y = i * rowH + (rowH - barH) / 2;
          const w1 = scale(r.advance), w2 = scale(r.topup);
          return (
            <g key={r.type} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={0} y={i * rowH} width={W} height={rowH} fill="transparent" />
              <text x={0} y={y + barH - 2} fontSize={13} fill={INK} fontWeight={600}>{r.label}</text>
              <path d={bar(labelW, y, w1, barH, 4, false, w2 < 1)} fill={SERIES.advance} />
              {w2 >= 1 && <path d={bar(labelW + w1 + (w1 > 0 ? 2 : 0), y, w2, barH)} fill={SERIES.topup} />}
              <text x={labelW + w1 + w2 + 8} y={y + barH - 2} fontSize={13} fill={INK} fontWeight={650}>{rupiah(r.advance + r.topup)}</text>
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <Tip x={50} y={((hover * rowH) / (rows.length * rowH)) * 100}>
          <b>{rows[hover].label}</b> ({rows[hover].count} aset)<br />
          Uang muka {rupiah(rows[hover].advance)}, sisa {rupiah(rows[hover].topup)}
        </Tip>
      )}
    </div>
  );
}

/* ---------- kurva PML ---------- */
export function PmlCurve({ pml, scenarioLoss }: { pml: Pml; scenarioLoss: number }) {
  const W = 400, H = 210, m = { l: 40, r: 12, t: 12, b: 34 };
  const pts = pml.curve;
  const lx = (rp: number) => m.l + ((Math.log10(rp) - Math.log10(2)) / (Math.log10(1000) - Math.log10(2))) * (W - m.l - m.r);
  const yMax = Math.max(pts[pts.length - 1].loss, scenarioLoss) * 1.08;
  const nice = (v: number) => { const p = Math.pow(10, Math.floor(Math.log10(v))); return [1, 2, 2.5, 5, 10].map((k) => k * p).find((s) => v / s <= 5) ?? p * 10; };
  const step = nice(yMax / 1e9) * 1e9;
  const ly = (v: number) => H - m.b - (v / yMax) * (H - m.t - m.b);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${lx(p.return_period).toFixed(1)},${ly(p.loss).toFixed(1)}`).join(" ");
  const [hover, setHover] = useState<number | null>(null);
  const rpS = pml.scenario_return_period;

  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    const box = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * W;
    let best = 0;
    pts.forEach((p, i) => { if (Math.abs(lx(p.return_period) - x) < Math.abs(lx(pts[best].return_period) - x)) best = i; });
    setHover(best);
  };
  const hp = hover !== null ? pts[hover] : null;

  return (
    <div className="chart-wrap">
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Kurva PML: kerugian tahunan menurut periode ulang">
        {Array.from({ length: Math.floor(yMax / step) + 1 }, (_, i) => i * step).map((v) => (
          <g key={v}>
            <line x1={m.l} x2={W - m.r} y1={ly(v)} y2={ly(v)} stroke={RULE} />
            <text x={m.l - 6} y={ly(v) + 4} fontSize={11} textAnchor="end" fill={INK2}>{miliar(v)}</text>
          </g>
        ))}
        {[2, 5, 10, 25, 50, 100, 250, 500, 1000].map((rp) => (
          <text key={rp} x={lx(rp)} y={H - m.b + 15} fontSize={11} textAnchor="middle" fill={INK2}>{count(rp)}</text>
        ))}
        <text x={(m.l + W - m.r) / 2} y={H - 4} fontSize={11.5} textAnchor="middle" fill={INK2}>Periode ulang (tahun, skala log)</text>
        <text x={4} y={m.t - 2} fontSize={11} fill={INK2}>miliar</text>

        {/* skenario Palu */}
        <line x1={m.l} x2={W - m.r} y1={ly(scenarioLoss)} y2={ly(scenarioLoss)} stroke={ZONE.oranye.color} strokeDasharray="4 3" strokeWidth={1.5} />
        {rpS && rpS <= 1000 && <circle cx={lx(Math.max(2, rpS))} cy={ly(scenarioLoss)} r={5} fill={ZONE.oranye.color} stroke={SURFACE} strokeWidth={2} />}
        <text x={m.l + 4} y={ly(scenarioLoss) - 6} fontSize={11.5} fill={INK} fontWeight={650}>Skenario Palu ini: {rupiah(scenarioLoss)}</text>

        <path d={d} fill="none" stroke={SERIES.advance} strokeWidth={2} />
        {(["100", "250"] as const).map((k) => (
          <circle key={k} cx={lx(Number(k))} cy={ly(pml.pml[k])} r={4.5} fill={SERIES.advance} stroke={SURFACE} strokeWidth={2} />
        ))}

        {hp && (
          <g pointerEvents="none">
            <line x1={lx(hp.return_period)} x2={lx(hp.return_period)} y1={m.t} y2={H - m.b} stroke={INK} strokeOpacity={0.35} />
            <circle cx={lx(hp.return_period)} cy={ly(hp.loss)} r={4.5} fill={SERIES.advance} stroke={SURFACE} strokeWidth={2} />
          </g>
        )}
        <rect x={m.l} y={m.t} width={W - m.l - m.r} height={H - m.t - m.b} fill="transparent" onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
      </svg>
      {hp && (
        <Tip x={(lx(hp.return_period) / W) * 100} y={(ly(hp.loss) / H) * 100}>
          Sekali dalam {count(Math.round(hp.return_period))} tahun<br />kerugian ≥ <b>{rupiah(hp.loss)}</b>
        </Tip>
      )}
      <div className="tiny" style={{ marginTop: 4 }}>Menurut asumsi model, kerugian sebesar skenario ini terjadi {returnPeriod(rpS)}.</div>
    </div>
  );
}

/* ---------- skala SDSI dengan penanda ---------- */
export function SdsiScale({ value, label }: { value: number; label?: string }) {
  const W = 400, H = 22, top = label ? 22 : 6, gap = 2;
  const segW = (W - gap * 3) / 4;
  const x = Math.min(Math.max(value, 0), 1) * W;
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${top + H + 18}`} role="img" aria-label={`Skor SDSI ${dec(value, 2)} pada skala zona`}>
      {ZONES.map((z, i) => (
        <path key={z} d={bar(i * (segW + gap), top, segW, H, 4, i === 0, i === 3)} fill={ZONE[z].color} />
      ))}
      {[0, 0.25, 0.5, 0.75, 1].map((v) => (
        <text key={v} x={v === 0 ? 0 : v === 1 ? W : v * W} y={top + H + 14} fontSize={11} textAnchor={v === 0 ? "start" : v === 1 ? "end" : "middle"} fill={INK2}>
          {v === 0 || v === 1 ? String(v) : dec(v, 2)}
        </text>
      ))}
      {label && <text x={Math.min(Math.max(x, 40), W - 40)} y={11} fontSize={12} textAnchor="middle" fontWeight={700} fill={INK}>{label}</text>}
      <path d={`M${x - 6},${top - 8} L${x + 6},${top - 8} L${x},${top - 1} Z`} fill={INK} />
      <line x1={x} x2={x} y1={top} y2={top + H} stroke={INK} strokeWidth={2.5} />
      <line x1={x} x2={x} y1={top} y2={top + H} stroke={SURFACE} strokeWidth={1} />
    </svg>
  );
}
