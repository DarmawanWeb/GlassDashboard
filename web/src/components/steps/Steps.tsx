"use client";

import type { Asset, Meta, Policy, Scenario, Sensor } from "@/lib/types";
import { SENSOR, SERIES } from "@/lib/palette";
import { count, dec, mmi, pct, returnPeriod, rupiah } from "@/lib/format";
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
  const s = scenario.summary;
  return (
    <>
      <Head title="Satelit memotret Palu">
        Tiga sensor membaca tanda kerusakan di setiap bangunan, tanpa petugas harus datang satu per satu.
      </Head>
      <div style={{ display: "grid", gap: 10 }}>
        <Segmented label="Sensor" value={sensor} onChange={onSensor}
          options={(["d_surf", "d_vol", "d_water"] as Sensor[]).map((k) => ({ value: k, label: SENSOR[k].label }))} />
        <div className="note small"><b>{SENSOR[sensor].long}.</b> {SENSOR[sensor].note}</div>
      </div>
      <Ledger rows={[
        { label: "Aset negara yang dipantau", note: "sekolah, puskesmas, kantor, jembatan", value: count(s.n_assets) },
        { label: "Foto terlihat jelas", value: count(s.n_observed) },
        { label: "Foto tertutup awan", note: "nilai foto akan ditebak dari tetangga", value: count(s.n_hidden) },
      ]} />
      <RangeField label="Tutupan awan" value={cloud} min={0} max={0.4} step={0.02} onChange={onCloud} display={pct(cloud)}
        hint="Geser untuk melihat apa yang terjadi kalau langit lebih berawan." ticks={["0%", "10%", "20%", "30%", "40%"]} />
      <div className="note small">
        Aset yang fotonya tertutup awan akan diperiksa drone di langkah berikutnya, <b>Pindai</b>.
      </div>
      <div className="tiny">
        Sumber data asli yang bisa dipakai: foto satelit Maxar dan dataset xBD, radar Sentinel-1, peta banjir GFM, dan data
        guncangan USGS. Peta dasar: mosaik Sentinel-2 tahun 2018.
      </div>
    </>
  );
}

/* ---------- 2. NILAI ---------- */
export function StepNilai({ meta, scenario, policy, selected }: { meta: Meta; scenario: Scenario; policy: Policy; selected: Asset | null }) {
  return (
    <>
      <Head title="Setiap bangunan dapat skor SDSI">
        Tiga nilai digabung dengan bobot, seperti nilai rapor. Hasilnya 0 sampai 1, lalu dikelompokkan ke empat zona warna.
      </Head>
      <div className="formula">
        SDSI = <span className="w">w<sub>1</sub></span>·D<sub>vol</sub> + <span className="w">w<sub>2</sub></span>·D<sub>surf</sub> + <span className="w">w<sub>3</sub></span>·D<sub>water</sub>,
        dengan <span className="w">w<sub>1</sub>+w<sub>2</sub>+w<sub>3</sub></span> = 1
        <div className="tiny" style={{ marginTop: 4 }}>
          D<sub>vol</sub>: radar satelit atau LiDAR drone. D<sub>surf</sub>: foto satelit atau kamera drone. D<sub>water</sub>: peta banjir atau kamera termal.
        </div>
      </div>
      <div>
        <h3 className="section-title">Hasil untuk {count(scenario.summary.n_assets)} aset</h3>
        <ZoneComposition rows={scenario.by_zone} />
      </div>
      <hr className="divider" />
      <Calculator meta={meta} policy={policy} selected={selected} />
    </>
  );
}

/* ---------- 3. HITUNG ---------- */
export function StepHitung({ scenario }: { scenario: Scenario }) {
  const s = scenario.summary;
  return (
    <>
      <Head title="Skor diubah menjadi rupiah">
        Estimasi klaim = nilai aset × SDSI − potongan. Untuk aset yang fotonya tertutup awan, klaimnya diperkirakan dan
        dicatat sebagai IBNR.
      </Head>
      <Ledger rows={[
        { label: "Total nilai aset", note: `${count(s.n_assets)} aset contoh`, value: rupiah(s.total_sum_insured) },
        { label: "Cadangan klaim", note: `${count(s.n_observed)} aset terukur${s.n_drone + s.n_video ? `, ${count(s.n_drone + s.n_video)} di antaranya dari drone` : ""}`, value: rupiah(s.case_reserves) },
        { label: "IBNR", note: s.n_hidden ? `${count(s.n_hidden)} aset tertutup awan, ditebak dari 5 tetangga` : "tidak ada lagi aset yang nilainya ditebak", value: rupiah(s.ibnr) },
        { label: "Total dana yang disisihkan", value: rupiah(s.total_reserves), kind: "total" },
        { label: "Rasio kerugian", note: "total dana ÷ total nilai aset", value: pct(s.loss_ratio, 1), kind: "sub" },
      ]} />
      <div>
        <h3 className="section-title">Estimasi klaim per zona</h3>
        <ZoneClaims rows={scenario.by_zone} />
      </div>
      <div>
        <h3 className="section-title">Bersiap untuk tahun terburuk (PML)</h3>
        <p className="small muted" style={{ margin: "0 0 8px" }}>
          Komputer mensimulasikan {count(scenario.pml.assumptions.years)} tahun. Garis biru: kerugian tahunan yang hanya
          terlampaui sekali dalam periode tertentu.
        </p>
        <PmlCurve pml={scenario.pml} scenarioLoss={s.total_reserves} />
      </div>
      <Ledger rows={[
        { label: "PML sekali dalam 100 tahun", value: rupiah(scenario.pml.pml["100"]) },
        { label: "PML sekali dalam 250 tahun", value: rupiah(scenario.pml.pml["250"]) },
        { label: "Rata-rata kerugian per tahun (AAL)", note: "dasar menghitung premi", value: rupiah(scenario.pml.aal) },
      ]} />
      <div className="tiny">
        Asumsi simulasi: rata-rata {dec(scenario.pml.assumptions.event_rate, 2)} kejadian merusak per tahun, rasio kerugian
        median {pct(scenario.pml.assumptions.median_loss_ratio)} per kejadian. Skenario ini terjadi {returnPeriod(scenario.pml.scenario_return_period)}.
      </div>
    </>
  );
}

/* ---------- 4. BAYAR ---------- */
export function StepBayar({ scenario, policy, onPolicy, selected, onPickLargest }: {
  scenario: Scenario; policy: Policy; onPolicy: (p: Policy) => void; selected: Asset | null; onPickLargest: () => void;
}) {
  const s = scenario.summary;
  return (
    <>
      <Head title="Uang muka cepat, sisanya setelah skor keluar">
        Uang muka cair otomatis begitu data guncangan menunjukkan lokasi aset terguncang kuat. Sisanya dibayar setelah
        skor SDSI dihitung, jadi totalnya tetap adil.
      </Head>
      <div className="timeline" aria-label="Urutan pembayaran">
        {[
          ["Gempa", "hari 0", "#d03b3b"],
          ["Data guncangan", "jam-an", "#7a8898"],
          ["Uang muka", "hitungan hari", SERIES.advance],
          ["Satelit & drone", "pasca-bencana", "#7a8898"],
          ["Sisa bayar", "sesuai SDSI", SERIES.topup],
        ].map(([t, sub, c]) => (
          <div className="tl-step" key={t}><span className="tl-dot" style={{ display: "block", background: c }} /><b>{t}</b>{sub}</div>
        ))}
      </div>
      <RangeField label="Ambang guncangan untuk uang muka" value={policy.mmi_trigger} min={7} max={9} step={0.1}
        onChange={(v) => onPolicy({ ...policy, mmi_trigger: v })} display={`MMI ${mmi(policy.mmi_trigger, true)}`}
        ticks={["VII", "VII,5", "VIII", "VIII,5", "IX"]} hint="Garis putus-putus biru di peta menunjukkan batas ambang ini." />
      <RangeField label="Besar uang muka" value={policy.advance_rate} min={0.05} max={0.3} step={0.01}
        onChange={(v) => onPolicy({ ...policy, advance_rate: v })} display={`${pct(policy.advance_rate)} nilai aset`} />
      <Ledger rows={[
        { label: "Uang muka parametrik", note: `${count(s.n_advance)} aset di zona guncangan kuat`, value: rupiah(s.advance_total) },
        { label: "Sisa setelah SDSI", value: rupiah(s.topup_total) },
        { label: "Total dibayar", value: rupiah(s.advance_total + s.topup_total), kind: "total" },
      ]} />
      <div>
        <h3 className="section-title">Basis risk: saat uang muka meleset</h3>
        <Ledger rows={[
          { label: "Uang muka melebihi kerugian", note: `${count(s.n_over)} aset rusaknya lebih ringan dari uang mukanya`, value: rupiah(s.basis_risk_over) },
          { label: "Rusak berat tanpa uang muka", note: `${count(s.missed_severe_count)} aset di bawah ambang, menunggu SDSI`, value: rupiah(s.missed_severe_claim) },
        ]} />
        <p className="tiny" style={{ marginTop: 6 }}>Geser ambang dan besar uang muka untuk mencari selisih yang paling kecil.</p>
      </div>
      <div>
        <h3 className="section-title">Pembayaran per jenis aset</h3>
        <PayoutByType rows={scenario.by_type} />
      </div>
      <hr className="divider" />
      <div>
        <h3 className="section-title">Sertifikat kerugian digital</h3>
        <CertificatePanel asset={selected} onPickLargest={onPickLargest} />
      </div>
    </>
  );
}
