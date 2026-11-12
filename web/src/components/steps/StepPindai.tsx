"use client";

import type { Meta, Mission, ScanResult, Scenario, VideoOverride } from "@/lib/types";
import type { PlayerState } from "@/lib/mission";
import { DAMAGE_CLASS, DRONE_SENSOR, TYPE_LABEL } from "@/lib/palette";
import { count, dec, pct, rupiah } from "@/lib/format";
import { Ledger, RangeField, Segmented } from "../ui/controls";

export interface StepPindaiProps {
  meta: Meta;
  scenario: Scenario;
  baseScenario: Scenario | null;
  mission: Mission | null;
  missionError: string | null;
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

function minutes(m: number) {
  const h = Math.floor(m / 60), r = Math.round(m % 60);
  return h ? `${h} jam ${r} menit` : `${r} menit`;
}

export default function StepPindai(p: StepPindaiProps) {
  const { scenario, baseScenario, mission, missionError, state, scans, order } = p;
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
        <h2>Drone memeriksa dari dekat</h2>
        <p>
          Satelit cepat tapi bisa terhalang awan. Drone terbang di bawah awan, memotret tiap bangunan dengan tiga sensor,
          lalu AI menghitung persentase kerusakannya.
        </p>
      </header>

      <div className="sensor-trio">
        {(Object.keys(DRONE_SENSOR) as (keyof typeof DRONE_SENSOR)[]).map((k) => (
          <div key={k} className="sensor-tile">
            <b>{DRONE_SENSOR[k].label}</b>
            <span>{DRONE_SENSOR[k].reads}</span>
            <small>{DRONE_SENSOR[k].spec}</small>
          </div>
        ))}
      </div>

      <div>
        <h3 className="section-title">Rencana misi</h3>
        {missionError && <div className="note note-bad small">{missionError}</div>}
        {mission ? (
          <Ledger rows={[
            { label: "Aset yang diperiksa", note: `${mission.stats.n_cloud} fotonya tertutup awan, ${mission.stats.n_severe} rusak berat menurut satelit`, value: count(n) },
            { label: "Jarak terbang", note: "rute disusun otomatis dari posko", value: `${dec(mission.stats.distance_km, 1)} km` },
            { label: "Waktu terbang (perkiraan)", note: `${mission.stats.speed_ms} m/s, ${mission.stats.hover_s} detik per aset`, value: minutes(mission.stats.flight_min) },
            { label: "Baterai", note: `±${mission.stats.battery_min} menit per baterai`, value: count(mission.stats.batteries) },
          ]} />
        ) : !missionError && <div className="muted small">Menyusun rute…</div>}
      </div>

      <RangeField label="Jumlah aset target" value={p.maxTargets} min={6} max={80} step={1} onChange={p.onMaxTargets}
        display={`${p.maxTargets} aset`} hint={flying ? "Hentikan misi dulu untuk mengubah target." : "Aset tertutup awan selalu didahulukan."}
        disabled={flying} />

      <div className="mission-controls">
        {status === "idle" && (
          <button type="button" className="btn btn-primary btn-drone" onClick={p.onStart} disabled={!mission || n === 0}>
            Terbangkan drone
          </button>
        )}
        {status === "playing" && !state?.skipping && <button type="button" className="btn btn-primary" onClick={p.onPause}>Jeda</button>}
        {status === "paused" && <button type="button" className="btn btn-primary" onClick={p.onResume}>Lanjutkan</button>}
        {flying && !state?.skipping && (
          <>
            <Segmented label="Kecepatan" value={String(state?.speed ?? 2)} onChange={(v) => p.onSpeed(Number(v))}
              options={[{ value: "1", label: "1×" }, { value: "2", label: "2×" }, { value: "4", label: "4×" }]} />
            <button type="button" className="btn" onClick={p.onSkip}>Lewati ke hasil</button>
          </>
        )}
        {(done || flying) && <button type="button" className="btn btn-ghost" onClick={p.onReset}>Ulangi misi</button>}
      </div>

      {(flying || done || state?.skipping) && (
        <div className="mission-progress" aria-label="Kemajuan misi">
          <div className="mission-bar"><i style={{ width: `${n ? (scanned / n) * 100 : 0}%` }} /></div>
          <span>{state?.skipping ? "Memproses semua aset" : done ? "Misi selesai" : "Aset diperiksa"}: {scanned} dari {n}</span>
        </div>
      )}

      {scanned > 0 && before && (
        <div>
          <h3 className="section-title">Yang berubah setelah drone terbang</h3>
          <Ledger rows={[
            { label: "Foto tertutup awan", note: "aset yang nilainya masih tebakan", value: `${count(before.n_hidden)} → ${count(after.n_hidden)}` },
            { label: "IBNR (klaim tebakan)", value: `${rupiah(before.ibnr)} → ${rupiah(after.ibnr)}` },
            { label: "Cadangan klaim (terukur)", value: `${rupiah(before.case_reserves)} → ${rupiah(after.case_reserves)}` },
            { label: "Total dana disisihkan", value: `${rupiah(before.total_reserves)} → ${rupiah(after.total_reserves)}`, kind: "total" },
          ]} />
          <label className="check-row">
            <input type="checkbox" checked={p.useDrone} onChange={(e) => p.onUseDrone(e.target.checked)} />
            Pakai hasil drone di langkah Nilai, Hitung, dan Bayar
          </label>
        </div>
      )}

      {results.length > 0 && (
        <div>
          <h3 className="section-title">Hasil AI per aset</h3>
          <p className="small muted" style={{ margin: "0 0 8px" }}>
            Ketepatan kelas dibanding kondisi sebenarnya di simulasi: <b style={{ color: "var(--ink)" }}>{pct(acc)}</b> dari {results.length} aset;
            selisih rata-rata persentase atap {dec(mae * 100, 1)} poin.
          </p>
          <div className="scan-list" role="list">
            {[...results].reverse().map((r) => (
              <button key={r.id} type="button" role="listitem" className="scan-row" aria-pressed={p.selectedId === r.id} onClick={() => p.onSelect(r.id)}>
                <span className="scan-id">{r.id}<small>{TYPE_LABEL[r.type]}{r.observed_by_satellite ? "" : ", tadinya tertutup awan"}</small></span>
                <span className="scan-pct">{pct(r.estimate.roof)}</span>
                <span className="det-chip" style={{ background: DAMAGE_CLASS[r.estimate.cls].color, color: DAMAGE_CLASS[r.estimate.cls].ink }}>
                  {DAMAGE_CLASS[r.estimate.cls].label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="tiny">
        Citra drone di langkah ini dibuat oleh simulator dari data contoh (bukan foto asli). Karena dunianya buatan, kondisi
        sebenarnya diketahui dan ketepatan AI bisa diukur. Di lapangan, drone dengan kamera RGB, LiDAR, dan termal mengambil
        data yang sama.
      </div>
    </>
  );
}
