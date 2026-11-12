"use client";

import type { Mission, Policy, ScanResult, Scenario, Sensor, StepId } from "@/lib/types";
import { DAMAGE_CLASS, DRONE_ACCENT, SENSOR, SERIES, ZONE, ZONES } from "@/lib/palette";
import { mmi, rupiah } from "@/lib/format";

function Ramp({ colors, left, right }: { colors: readonly string[]; left: string; right: string }) {
  return (
    <>
      <div className="ramp" style={{ background: `linear-gradient(90deg, ${colors.map((c, i) => `${c} ${(i / (colors.length - 1)) * 100}%`).join(", ")})` }} />
      <div className="ramp-ends"><span>{left}</span><span>{right}</span></div>
    </>
  );
}

export default function MapLegend({ step, sensor, scenario, policy, mission, scans }: {
  step: StepId; sensor: Sensor; scenario: Scenario | null; policy: Policy; mission: Mission | null; scans: Record<string, ScanResult>;
}) {
  if (!scenario) return null;
  const s = scenario.summary;
  const nScanned = mission ? mission.targets.filter((t) => scans[t.id]).length : 0;
  return (
    <div className="map-card legend" aria-label="Legenda peta">
      {step === "lihat" && (
        <>
          <div className="legend-title">{SENSOR[sensor].long}: tanda kerusakan</div>
          <Ramp colors={SENSOR[sensor].ramp} left="sedikit" right="banyak" />
          {sensor === "d_surf" && (
            <div className="legend-row"><span className="swatch swatch-ring" />Foto tertutup awan<b>{s.n_hidden}</b></div>
          )}
          <div className="legend-row"><span className="swatch-line" style={{ borderTopColor: "#13283f" }} />Sesar Palu-Koro (perkiraan)</div>
          <div className="legend-row"><span className="swatch" style={{ background: "rgba(236,131,90,.35)", borderStyle: "dashed", borderColor: "#ec835a" }} />Likuefaksi 2018 (perkiraan)</div>
        </>
      )}
      {step === "pindai" && (
        <>
          <div className="legend-title">Misi drone</div>
          <div className="legend-row"><span className="swatch-line" style={{ borderTopColor: "#13283f" }} />Rute terbang</div>
          <div className="legend-row"><span className="swatch-line" style={{ borderTop: `3px solid ${DRONE_ACCENT}` }} />Sudah diterbangi</div>
          <div className="legend-row"><span className="swatch swatch-ring" />Target belum diperiksa<b>{(mission?.targets.length ?? 0) - nScanned}</b></div>
          <div className="legend-title" style={{ marginTop: 8 }}>Hasil AI drone<b style={{ float: "right", fontWeight: 640 }}>{nScanned}</b></div>
          {DAMAGE_CLASS.map((c) => (
            <div className="legend-row" key={c.label}><span className="swatch" style={{ background: c.color }} />{c.label}</div>
          ))}
        </>
      )}
      {step === "nilai" && (
        <>
          <div className="legend-title">Zona skor SDSI</div>
          {ZONES.map((z) => {
            const row = scenario.by_zone.find((r) => r.zone === z);
            return (
              <div className="legend-row" key={z}>
                <span className="swatch" style={{ background: ZONE[z].color }} />
                {ZONE[z].label}: {ZONE[z].meaning.toLowerCase()}
                <b>{row?.count ?? 0}</b>
              </div>
            );
          })}
          <div className="legend-row tiny">Titik pudar: foto tertutup awan, skornya diperkirakan</div>
          {s.n_drone + s.n_video > 0 && (
            <div className="legend-row"><span className="swatch swatch-ring" style={{ borderColor: DRONE_ACCENT }} />Nilai dari drone<b>{s.n_drone + s.n_video}</b></div>
          )}
          <div className="legend-row tiny">Besar titik: nilai aset</div>
        </>
      )}
      {step === "hitung" && (
        <>
          <div className="legend-title">Besar lingkaran = estimasi klaim</div>
          <div className="bubble-legend" aria-hidden="true">
            {[{ v: 1e9, r: 4 }, { v: 5e9, r: 8 }, { v: 20e9, r: 14 }].map((b) => (
              <div className="bubble-row" key={b.v}>
                <i><svg width={b.r * 2 + 2} height={b.r * 2 + 2}><circle cx={b.r + 1} cy={b.r + 1} r={b.r} fill="#EC835A" stroke="#fff" strokeWidth={1} /></svg></i>
                {rupiah(b.v)}
              </div>
            ))}
          </div>
          <div className="legend-row"><span className="swatch-line" style={{ borderTopColor: "#7a8898" }} />Garis ke 5 tetangga terdekat</div>
          <div className="legend-row tiny">Dipakai menebak nilai foto aset yang tertutup awan (IBNR)</div>
        </>
      )}
      {step === "bayar" && (
        <>
          <div className="legend-title">Uang muka parametrik</div>
          <div className="legend-row"><span className="swatch" style={{ background: SERIES.advance }} />Dapat uang muka<b>{s.n_advance}</b></div>
          <div className="legend-row"><span className="swatch" style={{ background: SERIES.muted }} />Menunggu skor SDSI<b>{s.n_assets - s.n_advance}</b></div>
          <div className="legend-title" style={{ marginTop: 8 }}>Kekuatan guncangan</div>
          <Ramp colors={["rgba(158,197,244,.4)", "#3987e5", "#104281"]} left="VII" right="IX" />
          <div className="legend-row"><span className="swatch-line" style={{ borderTopColor: "#2a78d6" }} />Garis ambang {mmi(policy.mmi_trigger, true)}</div>
        </>
      )}
    </div>
  );
}
