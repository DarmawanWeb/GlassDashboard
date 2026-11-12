"use client";

import type { Meta, Mission, ScanResult, Scenario, VideoOverride } from "@/lib/types";
import type { PlayerState } from "@/lib/mission";
import { DAMAGE_CLASS, DRONE_SENSORS } from "@/lib/palette";
import { errorText, useI18n } from "@/lib/i18n";
import { Ledger, RangeField, Segmented } from "../ui/controls";
import VideoUpload from "../drone/VideoUpload";

export interface StepPindaiProps {
  meta: Meta;
  scenario: Scenario;
  baseScenario: Scenario | null;
  mission: Mission | null;
  missionError: unknown;
  state: PlayerState | null;
  scans: Record<string, ScanResult>;
  order: string[];
  maxTargets: number;
  onMaxTargets: (n: number) => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onSpeed: (s: number) => void;
  onSkip: () => void;
  onReset: () => void;
  useDrone: boolean;
  onUseDrone: (v: boolean) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  video: VideoOverride[];
  onApplyVideo: (v: VideoOverride) => void;
  onRemoveVideo: (id: string) => void;
}

/** "sebelum → sesudah"; boleh patah baris di panah kalau panel sempit. */
function Change({ a, b }: { a: string; b: string }) {
  return <><span className="nowrap">{a}</span> → <span className="nowrap">{b}</span></>;
}

export default function StepPindai(p: StepPindaiProps) {
  const { meta, scenario, baseScenario, mission, missionError, state, scans, order } = p;
  const { t, f } = useI18n();
  const P = t.pindai;
  const status = state?.status ?? "idle";
  const flying = status === "playing" || status === "paused";
  const done = status === "done";
  const n = mission?.targets.length ?? 0;
  const scanned = order.length;
  const results = order.map((id) => scans[id]).filter(Boolean);
  const acc = results.length ? results.filter((r) => r.truth.cls === r.estimate.cls).length / results.length : 0;
  const mae = results.length ? results.reduce((s, r) => s + Math.abs(r.truth.roof - r.estimate.roof), 0) / results.length : 0;
  const before = baseScenario?.summary;
  const after = scenario.summary;

  return (
    <>
      <header className="step-head">
        <h2>{P.title}</h2>
        <p>{P.lead}</p>
      </header>

      <div className="sensor-trio">
        {DRONE_SENSORS.map((k) => (
          <div key={k} className="sensor-tile">
            <b>{t.droneSensor[k].label}</b>
            <span>{t.droneSensor[k].reads}</span>
            <small>{t.droneSensor[k].spec}</small>
          </div>
        ))}
      </div>

      <div>
        <h3 className="section-title">{P.plan}</h3>
        {missionError !== null && <div className="note note-bad small">{errorText(t, missionError)}</div>}
        {mission ? (
          <Ledger rows={[
            { label: P.targets, note: P.targetsNote(mission.stats.n_cloud, mission.stats.n_severe), value: f.count(n) },
            { label: P.distance, note: P.distanceNote, value: `${f.dec(mission.stats.distance_km, 1)} km` },
            { label: P.flightTime, note: P.flightNote(mission.stats.speed_ms, mission.stats.hover_s), value: f.minutes(mission.stats.flight_min) },
            { label: P.batteries, note: P.batteriesNote(mission.stats.battery_min), value: f.count(mission.stats.batteries) },
          ]} />
        ) : missionError === null && <div className="muted small">{P.planning}</div>}
      </div>

      <RangeField label={P.maxTargets} value={p.maxTargets} min={6} max={80} step={1} onChange={p.onMaxTargets}
        display={P.nAssets(p.maxTargets)} hint={flying ? P.maxTargetsHintFlying : P.maxTargetsHint} disabled={flying} />

      <div className="mission-controls">
        {status === "idle" && (
          <button type="button" className="btn btn-primary btn-drone" onClick={p.onStart} disabled={!mission || n === 0}>{P.launch}</button>
        )}
        {status === "playing" && !state?.skipping && <button type="button" className="btn btn-primary" onClick={p.onPause}>{P.pause}</button>}
        {status === "paused" && <button type="button" className="btn btn-primary" onClick={p.onResume}>{P.resume}</button>}
        {flying && !state?.skipping && (
          <>
            <Segmented label={P.speed} value={String(state?.speed ?? 2)} onChange={(v) => p.onSpeed(Number(v))}
              options={[{ value: "1", label: "1×" }, { value: "2", label: "2×" }, { value: "4", label: "4×" }]} />
            <button type="button" className="btn" onClick={p.onSkip}>{P.skip}</button>
          </>
        )}
        {(done || flying) && <button type="button" className="btn btn-ghost" onClick={p.onReset}>{P.restart}</button>}
      </div>

      {(flying || done || state?.skipping) && (
        <div className="mission-progress" aria-label={P.progressLabel}>
          <div className="mission-bar"><i style={{ width: `${n ? (scanned / n) * 100 : 0}%` }} /></div>
          <span>{state?.skipping ? P.processing : done ? P.finished : P.inspected}: {t.of(scanned, n)}</span>
        </div>
      )}

      {scanned > 0 && before && (
        <div>
          <h3 className="section-title">{P.changed}</h3>
          <Ledger rows={[
            { label: P.hiddenRow, note: P.hiddenRowNote, value: <Change a={f.count(before.n_hidden)} b={f.count(after.n_hidden)} /> },
            { label: P.ibnrRow, value: <Change a={f.rupiah(before.ibnr)} b={f.rupiah(after.ibnr)} />, wrap: true },
            { label: P.caseRow, value: <Change a={f.rupiah(before.case_reserves)} b={f.rupiah(after.case_reserves)} />, wrap: true },
            { label: P.totalRow, value: <Change a={f.rupiah(before.total_reserves)} b={f.rupiah(after.total_reserves)} />, kind: "total", wrap: true },
          ]} />
          <label className="check-row">
            <input type="checkbox" checked={p.useDrone} onChange={(e) => p.onUseDrone(e.target.checked)} />
            {P.useDrone}
          </label>
        </div>
      )}

      {results.length > 0 && (
        <div>
          <h3 className="section-title">{P.results}</h3>
          <p className="small muted" style={{ margin: "0 0 8px" }}>{P.accuracy(f.pct(acc), results.length, f.dec(mae * 100, 1))}</p>
          <div className="scan-list" role="list">
            {[...results].reverse().map((r) => (
              <button key={r.id} type="button" role="listitem" className="scan-row" aria-pressed={p.selectedId === r.id} onClick={() => p.onSelect(r.id)}>
                <span className="scan-id">{r.id}<small>{t.type[r.type]}{r.observed_by_satellite ? "" : P.wasHidden}</small></span>
                <span className="scan-pct">{f.pct(r.estimate.roof)}</span>
                <span className="det-chip" style={{ background: DAMAGE_CLASS[r.estimate.cls].color, color: DAMAGE_CLASS[r.estimate.cls].ink }}>
                  {t.damage[r.estimate.cls]}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <hr className="divider" />
      <VideoUpload meta={meta} mission={mission} selectedId={p.selectedId} video={p.video}
        onApply={p.onApplyVideo} onRemove={p.onRemoveVideo} />

      <div className="tiny">{P.footnote}</div>
    </>
  );
}
