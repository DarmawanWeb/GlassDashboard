"use client";

import type { Asset, Meta } from "@/lib/types";
import { viewUrl } from "@/lib/api";
import { SENSOR, SOURCE_LABEL, SURF_CLASSES, TYPE_LABEL } from "@/lib/palette";
import { dec, mmi, pct, rupiah } from "@/lib/format";
import { Icon, Ledger, ZoneChip } from "./ui/controls";
import { SdsiScale } from "./charts/charts";

const surfLabel = (v: number) => SURF_CLASSES.reduce((b, c) => (Math.abs(c.value - v) < Math.abs(b.value - v) ? c : b)).label;

export default function AssetCard({ asset, meta, onClose }: { asset: Asset; meta: Meta; onClose: () => void }) {
  const [w1, w2, w3] = meta.asset_types[asset.type].weights;
  const surf = asset.observed ? asset.d_surf : asset.d_surf_est ?? 0;
  const label = (k: "d_vol" | "d_surf" | "d_water") => asset.terms.find((t) => t.key === k)?.label ?? SENSOR[k].label;
  const bars = [
    { key: "d_vol" as const, value: asset.d_vol, text: dec(asset.d_vol, 2) },
    { key: "d_surf" as const, value: surf, text: dec(surf, 2) },
    { key: "d_water" as const, value: asset.d_water, text: dec(asset.d_water, 2) },
  ];
  return (
    <section className="asset-card" aria-label={`Detail aset ${asset.id}`}>
      <div className="asset-card-head">
        <div>
          <div className="asset-card-id">{asset.id}</div>
          <div className="asset-card-type">{TYPE_LABEL[asset.type]}, {dec(asset.lat, 4)}°, {dec(asset.lon, 4)}°</div>
          <div className={`source-tag source-${asset.source}`}>Sumber: {SOURCE_LABEL[asset.source]}</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
          <ZoneChip zone={asset.zone} />
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Tutup detail aset"><Icon name="close" /></button>
        </div>
      </div>
      <div className="asset-card-body">
        <div className="sensor-bars">
          {bars.map((b) => (
            <div className="sensor-bar" key={b.key}>
              <span>{label(b.key)}</span>
              <span className="sensor-track"><span className="sensor-fill" style={{ display: "block", width: `${b.value * 100}%`, background: SENSOR[b.key].ramp[2], opacity: b.key === "d_surf" && !asset.observed ? 0.45 : 1 }} /></span>
              <span className="sensor-val">{b.text}</span>
            </div>
          ))}
        </div>
        {asset.drone ? (
          <div className="drone-note">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={viewUrl(asset.drone.key, asset.id, "ai")} alt={`Hasil AI drone untuk ${asset.id}`} width={120} height={68} />
            <span className="small">
              Diperiksa drone: atap rusak <b>{pct(asset.drone.roof)}</b>, volume hilang <b>{pct(asset.drone.vol)}</b>, area basah{" "}
              <b>{pct(asset.drone.wet)}</b>. {asset.sat && !asset.sat.observed ? "Foto satelitnya tadi tertutup awan." : ""}
            </span>
          </div>
        ) : asset.video ? (
          <div className="note small">Dari video drone yang diunggah: {pct(asset.video.damage)} rusak ({asset.video.method}).</div>
        ) : asset.observed ? (
          <div className="tiny">Foto satelit: {surfLabel(asset.d_surf).toLowerCase()}.</div>
        ) : (
          <div className="note note-warn small">
            Foto aset ini tertutup awan. Nilai foto ditebak dari rata-rata {asset.neighbors.length} tetangga terdekat
            ({asset.neighbors.join(", ")}). Radar dan sensor air tetap terbaca karena radar menembus awan.
          </div>
        )}
        <div className="formula small">
          SDSI = <span className="w">{dec(w1, 2)}</span>×{dec(asset.d_vol, 2)} + <span className="w">{dec(w2, 2)}</span>×{dec(surf, 2)} + <span className="w">{dec(w3, 2)}</span>×{dec(asset.d_water, 2)} = <b>{dec(asset.sdsi, 2)}</b>
        </div>
        <SdsiScale value={asset.sdsi} />
        <Ledger rows={[
          { label: "Nilai pertanggungan", value: rupiah(asset.sum_insured) },
          { label: "Estimasi klaim", note: asset.observed ? "nilai aset × SDSI − potongan" : "diperkirakan, dicatat sebagai IBNR", value: rupiah(asset.claim) },
          { label: `Guncangan di lokasi`, value: mmi(asset.mmi, true) },
          { label: "Uang muka parametrik", value: rupiah(asset.advance) },
          { label: "Sisa setelah SDSI", value: rupiah(asset.topup), kind: "total" },
        ]} />
      </div>
    </section>
  );
}
