"use client";

import type { Mission, Policy, ScanResult, Scenario, Sensor, StepId } from "@/lib/types";
import { DAMAGE_CLASS, DRONE_ACCENT, SENSOR_RAMP, SERIES, ZONE, ZONES } from "@/lib/palette";
import { useI18n } from "@/lib/i18n";

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
  const { t, f } = useI18n();
  const L = t.legend;
  if (!scenario) return null;
  const s = scenario.summary;
  const nScanned = mission ? mission.targets.filter((x) => scans[x.id]).length : 0;
  return (
    <div className="map-card legend" aria-label={L.region}>
      {step === "lihat" && (
        <>
          <div className="legend-title">{L.lihat(t.sensor[sensor].long)}</div>
          <Ramp colors={SENSOR_RAMP[sensor]} left={L.few} right={L.many} />
          {sensor === "d_surf" && (
            <div className="legend-row"><span className="swatch swatch-ring" />{L.hiddenPhoto}<b>{f.count(s.n_hidden)}</b></div>
          )}
          <div className="legend-row"><span className="swatch-line" />{L.fault}</div>
          <div className="legend-row"><span className="swatch" style={{ background: "rgba(236,131,90,.35)", borderStyle: "dashed", borderColor: "#ec835a" }} />{L.liq}</div>
        </>
      )}
      {step === "pindai" && (
        <>
          <div className="legend-title">{L.mission}</div>
          <div className="legend-row"><span className="swatch-line" />{L.route}</div>
          <div className="legend-row"><span className="swatch-line" style={{ borderTop: `3px solid ${DRONE_ACCENT}` }} />{L.flown}</div>
          <div className="legend-row"><span className="swatch swatch-ring" />{L.pending}<b>{f.count((mission?.targets.length ?? 0) - nScanned)}</b></div>
          <div className="legend-title" style={{ marginTop: 8 }}>{L.ai}<b style={{ float: "right", fontWeight: 640 }}>{f.count(nScanned)}</b></div>
          {DAMAGE_CLASS.map((c, i) => (
            <div className="legend-row" key={c.color}><span className="swatch" style={{ background: c.color }} />{t.damage[i]}</div>
          ))}
        </>
      )}
      {step === "nilai" && (
        <>
          <div className="legend-title">{L.zones}</div>
          {ZONES.map((z) => {
            const row = scenario.by_zone.find((r) => r.zone === z);
            return (
              <div className="legend-row" key={z}>
                <span className="swatch" style={{ background: ZONE[z].color }} />
                {t.zone[z].label}: {t.zone[z].meaning.toLowerCase()}
                <b>{f.count(row?.count ?? 0)}</b>
              </div>
            );
          })}
          <div className="legend-row tiny">{L.faded}</div>
          {s.n_drone + s.n_video > 0 && (
            <div className="legend-row"><span className="swatch swatch-ring" style={{ borderColor: DRONE_ACCENT }} />{L.fromDrone}<b>{f.count(s.n_drone + s.n_video)}</b></div>
          )}
          <div className="legend-row tiny">{L.dotSize}</div>
        </>
      )}
      {step === "hitung" && (
        <>
          <div className="legend-title">{L.claimSize}</div>
          <div className="bubble-legend" aria-hidden="true">
            {[{ v: 1e9, r: 4 }, { v: 5e9, r: 8 }, { v: 20e9, r: 14 }].map((b) => (
              <div className="bubble-row" key={b.v}>
                <i><svg width={b.r * 2 + 2} height={b.r * 2 + 2}><circle cx={b.r + 1} cy={b.r + 1} r={b.r} fill="#EC835A" stroke="#fff" strokeWidth={1} /></svg></i>
                {f.rupiah(b.v)}
              </div>
            ))}
          </div>
          <div className="legend-row"><span className="swatch-line" style={{ borderTopColor: "#7a8898" }} />{L.neighbors}</div>
          <div className="legend-row tiny">{L.neighborsNote}</div>
        </>
      )}
      {step === "bayar" && (
        <>
          <div className="legend-title">{L.advance}</div>
          <div className="legend-row"><span className="swatch" style={{ background: SERIES.advance }} />{L.gets}<b>{f.count(s.n_advance)}</b></div>
          <div className="legend-row"><span className="swatch" style={{ background: SERIES.muted }} />{L.waits}<b>{f.count(s.n_assets - s.n_advance)}</b></div>
          <div className="legend-title" style={{ marginTop: 8 }}>{L.shaking}</div>
          <Ramp colors={["rgba(158,197,244,.4)", "#3987e5", "#104281"]} left="VII" right="IX" />
          <div className="legend-row"><span className="swatch-line" style={{ borderTopColor: "#2a78d6" }} />{L.threshold(f.mmi(policy.mmi_trigger, true))}</div>
        </>
      )}
    </div>
  );
}
