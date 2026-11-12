"use client";

import { useEffect, useState } from "react";
import type { Asset, AssetType, CalcResult, Meta, Policy } from "@/lib/types";
import { api } from "@/lib/api";
import { ASSET_TYPES, SURF_VALUES, nearestSurf } from "@/lib/palette";
import { errorText, useI18n } from "@/lib/i18n";
import { RangeField, Segmented, ZoneChip } from "./ui/controls";
import { SdsiScale } from "./charts/charts";

/** Kalkulator SDSI satu aset — memanggil mesin GLASS di API. */
export default function Calculator({ meta, policy, selected }: { meta: Meta; policy: Policy; selected: Asset | null }) {
  const { t, f } = useI18n();
  const [type, setType] = useState<AssetType>("sekolah");
  const [dVol, setDVol] = useState(0.6);
  const [surfIdx, setSurfIdx] = useState(2);
  const [dWater, setDWater] = useState(0.3);
  const [si, setSi] = useState(4);
  const [mmiV, setMmiV] = useState(8.2);
  const [res, setRes] = useState<CalcResult | null>(null);
  const [err, setErr] = useState<unknown>(null);

  useEffect(() => {
    const ctl = new AbortController();
    const timer = setTimeout(() => {
      api.sdsi({ asset_type: type, d_vol: dVol, d_surf: SURF_VALUES[surfIdx], d_water: dWater, sum_insured: si * 1e9, mmi: mmiV, policy }, ctl.signal)
        .then((r) => { setRes(r); setErr(null); })
        .catch((e: Error) => { if (e.name !== "AbortError") setErr(e); });
    }, 70);
    return () => { clearTimeout(timer); ctl.abort(); };
  }, [type, dVol, surfIdx, dWater, si, mmiV, policy]);

  const fill = () => {
    if (!selected) return;
    setType(selected.type);
    setDVol(selected.d_vol);
    setSurfIdx(nearestSurf(selected.observed ? selected.d_surf : selected.d_surf_est ?? 0));
    setDWater(selected.d_water);
    setSi(Math.round(selected.sum_insured / 1e8) / 10);
    setMmiV(selected.mmi);
  };

  const [w1, w2, w3] = meta.asset_types[type].weights;
  return (
    <section style={{ display: "grid", gap: 14 }} aria-label={t.calc.region}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <h3 className="section-title" style={{ margin: 0 }}>{t.calc.title}</h3>
        {selected && <button type="button" className="btn btn-ghost" style={{ marginLeft: "auto", height: 30 }} onClick={fill}>{t.calc.useData(selected.id)}</button>}
      </div>
      <Segmented label={t.calc.type} value={type} onChange={setType} options={ASSET_TYPES.map((k) => ({ value: k, label: t.typeShort[k] }))} />
      <div className="tiny">{t.calc.weights(t.type[type], f.dec(w1, 2), f.dec(w2, 2), f.dec(w3, 2))}</div>
      <RangeField label={t.calc.radar} value={dVol} min={0} max={1} step={0.01} onChange={setDVol} display={f.dec(dVol, 2)} />
      <div className="field">
        <div className="field-top"><span className="field-label">{t.calc.photo}</span><span className="field-value">{f.dec(SURF_VALUES[surfIdx], 2)}</span></div>
        <Segmented label={t.calc.photoGroup} value={String(surfIdx)} onChange={(v) => setSurfIdx(Number(v))}
          options={SURF_VALUES.map((_, i) => ({ value: String(i), label: t.damageShort[i] }))} />
      </div>
      <RangeField label={t.calc.water} value={dWater} min={0} max={1} step={0.01} onChange={setDWater} display={f.dec(dWater, 2)} />
      <RangeField label={t.calc.value} value={si} min={1} max={40} step={0.5} onChange={setSi} display={f.rupiah(si * 1e9)} />

      {res && (
        <div style={{ display: "grid", gap: 10 }}>
          <div className="formula">
            SDSI = (<span className="w">{f.dec(w1, 2)}</span>×{f.dec(dVol, 2)}) + (<span className="w">{f.dec(w2, 2)}</span>×{f.dec(SURF_VALUES[surfIdx], 2)}) + (<span className="w">{f.dec(w3, 2)}</span>×{f.dec(dWater, 2)})
            <br />= {res.terms.map((x) => f.dec(x.product, 3)).join(" + ")} = <b>{f.dec(res.sdsi, 2)}</b>
          </div>
          <SdsiScale value={res.sdsi} label={`${f.dec(res.sdsi, 2)}: ${t.zoneName(t.zone[res.zone].label)}`} />
          <div className="figure-row">
            <div className="figure">
              <div className="figure-big">{f.rupiah(res.claim)}</div>
              <div className="figure-label">{t.calc.claimLine(f.rupiah(si * 1e9), f.dec(res.sdsi, 2), f.rupiah(res.deductible))}</div>
            </div>
          </div>
          <div><ZoneChip zone={res.zone} suffix={t.zone[res.zone].meaning.toLowerCase()} /></div>
        </div>
      )}
      {err !== null && <div className="note note-bad small">{t.calc.failed(errorText(t, err))}</div>}
    </section>
  );
}
