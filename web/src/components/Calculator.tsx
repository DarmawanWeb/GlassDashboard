"use client";

import { useEffect, useState } from "react";
import type { Asset, AssetType, CalcResult, Meta, Policy } from "@/lib/types";
import { api } from "@/lib/api";
import { SURF_CLASSES, TYPE_LABEL, ZONE } from "@/lib/palette";
import { dec, rupiah } from "@/lib/format";
import { RangeField, Segmented, ZoneChip } from "./ui/controls";
import { SdsiScale } from "./charts/charts";

const TYPES: AssetType[] = ["sekolah", "puskesmas", "kantor", "jembatan"];

/** Kalkulator SDSI satu aset — memanggil mesin GLASS di API. */
export default function Calculator({ meta, policy, selected }: { meta: Meta; policy: Policy; selected: Asset | null }) {
  const [type, setType] = useState<AssetType>("sekolah");
  const [dVol, setDVol] = useState(0.6);
  const [surfIdx, setSurfIdx] = useState(2);
  const [dWater, setDWater] = useState(0.3);
  const [si, setSi] = useState(4);
  const [mmiV, setMmiV] = useState(8.2);
  const [res, setRes] = useState<CalcResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const ctl = new AbortController();
    const t = setTimeout(() => {
      api.sdsi({ asset_type: type, d_vol: dVol, d_surf: SURF_CLASSES[surfIdx].value, d_water: dWater, sum_insured: si * 1e9, mmi: mmiV, policy }, ctl.signal)
        .then((r) => { setRes(r); setErr(null); })
        .catch((e: Error) => { if (e.name !== "AbortError") setErr(e.message); });
    }, 70);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [type, dVol, surfIdx, dWater, si, mmiV, policy]);

  const fill = () => {
    if (!selected) return;
    setType(selected.type);
    setDVol(selected.d_vol);
    const surf = selected.observed ? selected.d_surf : selected.d_surf_est ?? 0;
    setSurfIdx(SURF_CLASSES.reduce((bi, c, i) => (Math.abs(c.value - surf) < Math.abs(SURF_CLASSES[bi].value - surf) ? i : bi), 0));
    setDWater(selected.d_water);
    setSi(Math.round(selected.sum_insured / 1e8) / 10);
    setMmiV(selected.mmi);
  };

  const [w1, w2, w3] = meta.asset_types[type].weights;
  return (
    <section style={{ display: "grid", gap: 14 }} aria-label="Kalkulator SDSI">
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <h3 className="section-title" style={{ margin: 0 }}>Coba hitung sendiri</h3>
        {selected && <button type="button" className="btn btn-ghost" style={{ marginLeft: "auto", height: 30 }} onClick={fill}>Pakai data {selected.id}</button>}
      </div>
      <Segmented label="Jenis aset" value={type} onChange={setType} options={TYPES.map((t) => ({ value: t, label: t === "kantor" ? "Kantor" : TYPE_LABEL[t] }))} />
      <div className="tiny">Bobot {TYPE_LABEL[type].toLowerCase()}: radar {dec(w1, 2)}, foto {dec(w2, 2)}, air {dec(w3, 2)}. Jumlahnya selalu 1.</div>
      <RangeField label="Radar (perubahan bentuk)" value={dVol} min={0} max={1} step={0.01} onChange={setDVol} display={dec(dVol, 2)} />
      <div className="field">
        <div className="field-top"><span className="field-label">Foto (kelas kerusakan)</span><span className="field-value">{dec(SURF_CLASSES[surfIdx].value, 2)}</span></div>
        <Segmented label="Kelas kerusakan dari foto" value={String(surfIdx)} onChange={(v) => setSurfIdx(Number(v))}
          options={SURF_CLASSES.map((c, i) => ({ value: String(i), label: ["Tidak rusak", "Ringan", "Berat", "Hancur"][i] ?? c.label }))} />
      </div>
      <RangeField label="Air (genangan)" value={dWater} min={0} max={1} step={0.01} onChange={setDWater} display={dec(dWater, 2)} />
      <RangeField label="Nilai aset" value={si} min={1} max={40} step={0.5} onChange={setSi} display={rupiah(si * 1e9)} />

      {res && (
        <div style={{ display: "grid", gap: 10 }}>
          <div className="formula">
            SDSI = (<span className="w">{dec(w1, 2)}</span>×{dec(dVol, 2)}) + (<span className="w">{dec(w2, 2)}</span>×{dec(SURF_CLASSES[surfIdx].value, 2)}) + (<span className="w">{dec(w3, 2)}</span>×{dec(dWater, 2)})
            <br />= {res.terms.map((t) => dec(t.product, 3)).join(" + ")} = <b>{dec(res.sdsi, 2)}</b>
          </div>
          <SdsiScale value={res.sdsi} label={`${dec(res.sdsi, 2)}: zona ${ZONE[res.zone].label.toLowerCase()}`} />
          <div className="figure-row">
            <div className="figure">
              <div className="figure-big">{rupiah(res.claim)}</div>
              <div className="figure-label">Estimasi klaim ({rupiah(si * 1e9)} × {dec(res.sdsi, 2)} − potongan {rupiah(res.deductible)})</div>
            </div>
          </div>
          <div><ZoneChip zone={res.zone} suffix={ZONE[res.zone].meaning.toLowerCase()} /></div>
        </div>
      )}
      {err && <div className="note note-bad small">Kalkulator gagal: {err}</div>}
    </section>
  );
}
