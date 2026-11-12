"use client";

import type { Asset, Meta, Policy, Scenario, Sensor } from "@/lib/types";
import { SENSORS, SERIES } from "@/lib/palette";
import { useI18n } from "@/lib/i18n";
import { Ledger, RangeField, Segmented } from "../ui/controls";
import { PayoutByType, PmlCurve, ZoneClaims, ZoneComposition } from "../charts/charts";
import Calculator from "../Calculator";
import CertificatePanel from "../CertificatePanel";

function Head({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <header className="step-head">
      <h2>{title}</h2>
      <p>{children}</p>
    </header>
  );
}

/* ---------- 1. LIHAT ---------- */
export function StepLihat({ scenario, sensor, onSensor, cloud, onCloud }: {
  scenario: Scenario; sensor: Sensor; onSensor: (s: Sensor) => void; cloud: number; onCloud: (v: number) => void;
}) {
  const { t, f } = useI18n();
  const s = scenario.summary;
  return (
    <>
      <Head title={t.lihat.title}>{t.lihat.lead}</Head>
      <div style={{ display: "grid", gap: 10 }}>
        <Segmented label={t.lihat.sensorGroup} value={sensor} onChange={onSensor}
          options={SENSORS.map((k) => ({ value: k, label: t.sensor[k].label }))} />
        <div className="note small"><b>{t.sensor[sensor].long}.</b> {t.sensor[sensor].note}</div>
      </div>
      <Ledger rows={[
        { label: t.lihat.monitored, note: t.lihat.monitoredNote, value: f.count(s.n_assets) },
        { label: t.lihat.clear, value: f.count(s.n_observed) },
        { label: t.lihat.hidden, note: t.lihat.hiddenNote, value: f.count(s.n_hidden) },
      ]} />
      <RangeField label={t.lihat.cloud} value={cloud} min={0} max={0.4} step={0.02} onChange={onCloud} display={f.pct(cloud)}
        hint={t.lihat.cloudHint} ticks={[0, 0.1, 0.2, 0.3, 0.4].map((v) => f.pct(v))} />
      <div className="note small">{t.lihat.toPindai}</div>
      <div className="tiny">{t.lihat.sources}</div>
    </>
  );
}

/* ---------- 3. NILAI ---------- */
export function StepNilai({ meta, scenario, policy, selected }: { meta: Meta; scenario: Scenario; policy: Policy; selected: Asset | null }) {
  const { t, f } = useI18n();
  return (
    <>
      <Head title={t.nilai.title}>{t.nilai.lead}</Head>
      <div className="formula">
        SDSI = <span className="w">w<sub>1</sub></span>·D<sub>vol</sub> + <span className="w">w<sub>2</sub></span>·D<sub>surf</sub> + <span className="w">w<sub>3</sub></span>·D<sub>water</sub>,
        {" "}{t.nilai.with} <span className="w">w<sub>1</sub>+w<sub>2</sub>+w<sub>3</sub></span> = 1
        <div className="tiny" style={{ marginTop: 4 }}>{t.nilai.formulaNote}</div>
      </div>
      <div>
        <h3 className="section-title">{t.nilai.resultFor(f.count(scenario.summary.n_assets))}</h3>
        <ZoneComposition rows={scenario.by_zone} />
      </div>
      <hr className="divider" />
      <Calculator meta={meta} policy={policy} selected={selected} />
    </>
  );
}

/* ---------- 4. HITUNG ---------- */
export function StepHitung({ scenario }: { scenario: Scenario }) {
  const { t, f } = useI18n();
  const s = scenario.summary;
  const fromDrone = s.n_drone + s.n_video;
  return (
    <>
      <Head title={t.hitung.title}>{t.hitung.lead}</Head>
      <Ledger rows={[
        { label: t.hitung.totalValue, note: t.hitung.sampleAssets(f.count(s.n_assets)), value: f.rupiah(s.total_sum_insured) },
        { label: t.hitung.caseRes, note: t.hitung.caseResNote(f.count(s.n_observed), fromDrone ? f.count(fromDrone) : null), value: f.rupiah(s.case_reserves) },
        { label: t.hitung.ibnr, note: t.hitung.ibnrNote(s.n_hidden ? f.count(s.n_hidden) : null), value: f.rupiah(s.ibnr) },
        { label: t.hitung.totalRes, value: f.rupiah(s.total_reserves), kind: "total" },
        { label: t.hitung.lossRatio, note: t.hitung.lossRatioNote, value: f.pct(s.loss_ratio, 1), kind: "sub" },
      ]} />
      <div>
        <h3 className="section-title">{t.hitung.byZone}</h3>
        <ZoneClaims rows={scenario.by_zone} />
      </div>
      <div>
        <h3 className="section-title">{t.hitung.pmlTitle}</h3>
        <p className="small muted" style={{ margin: "0 0 8px" }}>{t.hitung.pmlLead(f.count(scenario.pml.assumptions.years))}</p>
        <PmlCurve pml={scenario.pml} scenarioLoss={s.total_reserves} />
      </div>
      <Ledger rows={[
        { label: t.hitung.pml100, value: f.rupiah(scenario.pml.pml["100"]) },
        { label: t.hitung.pml250, value: f.rupiah(scenario.pml.pml["250"]) },
        { label: t.hitung.aal, note: t.hitung.aalNote, value: f.rupiah(scenario.pml.aal) },
      ]} />
      <div className="tiny">
        {t.hitung.assumptions(f.dec(scenario.pml.assumptions.event_rate, 2), f.pct(scenario.pml.assumptions.median_loss_ratio),
          f.returnPeriod(scenario.pml.scenario_return_period))}
      </div>
    </>
  );
}

/* ---------- 5. BAYAR ---------- */
const TL_COLORS = ["#d03b3b", "#7a8898", SERIES.advance, "#7a8898", SERIES.topup];

export function StepBayar({ scenario, policy, onPolicy, selected, onPickLargest }: {
  scenario: Scenario; policy: Policy; onPolicy: (p: Policy) => void; selected: Asset | null; onPickLargest: () => void;
}) {
  const { t, f } = useI18n();
  const s = scenario.summary;
  return (
    <>
      <Head title={t.bayar.title}>{t.bayar.lead}</Head>
      <div className="timeline" aria-label={t.bayar.timelineLabel}>
        {t.bayar.timeline.map(([title, sub], i) => (
          <div className="tl-step" key={title}><span className="tl-dot" style={{ display: "block", background: TL_COLORS[i] }} /><b>{title}</b>{sub}</div>
        ))}
      </div>
      <RangeField label={t.bayar.trigger} value={policy.mmi_trigger} min={7} max={9} step={0.1}
        onChange={(v) => onPolicy({ ...policy, mmi_trigger: v })} display={`MMI ${f.mmi(policy.mmi_trigger, true)}`}
        ticks={t.bayar.triggerTicks} hint={t.bayar.triggerHint} />
      <RangeField label={t.bayar.advanceSize} value={policy.advance_rate} min={0.05} max={0.3} step={0.01}
        onChange={(v) => onPolicy({ ...policy, advance_rate: v })} display={t.bayar.advanceDisplay(f.pct(policy.advance_rate))} />
      <Ledger rows={[
        { label: t.bayar.advance, note: t.bayar.advanceNote(f.count(s.n_advance)), value: f.rupiah(s.advance_total) },
        { label: t.bayar.topup, value: f.rupiah(s.topup_total) },
        { label: t.bayar.totalPaid, value: f.rupiah(s.advance_total + s.topup_total), kind: "total" },
      ]} />
      <div>
        <h3 className="section-title">{t.bayar.basisTitle}</h3>
        <Ledger rows={[
          { label: t.bayar.over, note: t.bayar.overNote(f.count(s.n_over)), value: f.rupiah(s.basis_risk_over) },
          { label: t.bayar.missed, note: t.bayar.missedNote(f.count(s.missed_severe_count)), value: f.rupiah(s.missed_severe_claim) },
        ]} />
        <p className="tiny" style={{ marginTop: 6 }}>{t.bayar.basisHint}</p>
      </div>
      <div>
        <h3 className="section-title">{t.bayar.byType}</h3>
        <PayoutByType rows={scenario.by_type} />
      </div>
      <hr className="divider" />
      <div>
        <h3 className="section-title">{t.bayar.certTitle}</h3>
        <CertificatePanel asset={selected} onPickLargest={onPickLargest} />
      </div>
    </>
  );
}
