"use client";

import type { Asset, Meta, Sensor } from "@/lib/types";
import { viewUrl } from "@/lib/api";
import { SENSOR_RAMP, nearestSurf } from "@/lib/palette";
import { useI18n } from "@/lib/i18n";
import { Icon, Ledger, ZoneChip } from "./ui/controls";
import { SdsiScale } from "./charts/charts";

export default function AssetCard({ asset, meta, onClose }: { asset: Asset; meta: Meta; onClose: () => void }) {
  const { t, f } = useI18n();
  const [w1, w2, w3] = meta.asset_types[asset.type].weights;
  const surf = asset.observed ? asset.d_surf : asset.d_surf_est ?? 0;
  const bars: { key: Sensor; value: number }[] = [
    { key: "d_vol", value: asset.d_vol },
    { key: "d_surf", value: surf },
    { key: "d_water", value: asset.d_water },
  ];
  return (
    <section className="asset-card" aria-label={t.asset.region(asset.id)}>
      <div className="asset-card-head">
        <div>
          <div className="asset-card-id">{asset.id}</div>
          <div className="asset-card-type">{t.type[asset.type]}, {f.dec(asset.lat, 4)}°, {f.dec(asset.lon, 4)}°</div>
          <div className={`source-tag source-${asset.source}`}>{t.asset.source(t.source[asset.source])}</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
          <ZoneChip zone={asset.zone} />
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label={t.asset.close}><Icon name="close" /></button>
        </div>
      </div>
      <div className="asset-card-body">
        <div className="sensor-bars">
          {bars.map((b) => (
            <div className="sensor-bar" key={b.key}>
              <span>{t.term[asset.source][b.key]}</span>
              <span className="sensor-track"><span className="sensor-fill" style={{ display: "block", width: `${b.value * 100}%`, background: SENSOR_RAMP[b.key][2], opacity: b.key === "d_surf" && !asset.observed ? 0.45 : 1 }} /></span>
              <span className="sensor-val">{f.dec(b.value, 2)}</span>
            </div>
          ))}
        </div>
        {asset.drone ? (
          <div className="drone-note">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={viewUrl(asset.drone.key, asset.id, "ai")} alt={t.asset.droneAlt(asset.id)} width={120} height={68} />
            <span className="small">
              {t.asset.droneNote(f.pct(asset.drone.roof), f.pct(asset.drone.vol), f.pct(asset.drone.wet), !!asset.sat && !asset.sat.observed)}
            </span>
          </div>
        ) : asset.video ? (
          <div className="note small">{t.asset.videoNote(f.pct(asset.video.damage), t.method[asset.video.method] ?? asset.video.method)}</div>
        ) : asset.observed ? (
          <div className="tiny">{t.asset.satPhoto(t.damage[nearestSurf(asset.d_surf)].toLowerCase())}</div>
        ) : (
          <div className="note note-warn small">{t.asset.hiddenNote(asset.neighbors.length, asset.neighbors.join(", "))}</div>
        )}
        <div className="formula small">
          SDSI = <span className="w">{f.dec(w1, 2)}</span>×{f.dec(asset.d_vol, 2)} + <span className="w">{f.dec(w2, 2)}</span>×{f.dec(surf, 2)} + <span className="w">{f.dec(w3, 2)}</span>×{f.dec(asset.d_water, 2)} = <b>{f.dec(asset.sdsi, 2)}</b>
        </div>
        <SdsiScale value={asset.sdsi} />
        <Ledger rows={[
          { label: t.asset.sumInsured, value: f.rupiah(asset.sum_insured) },
          { label: t.asset.claim, note: asset.observed ? t.asset.claimNoteObs : t.asset.claimNoteEst, value: f.rupiah(asset.claim) },
          { label: t.asset.shaking, value: f.mmi(asset.mmi, true) },
          { label: t.asset.advance, value: f.rupiah(asset.advance) },
          { label: t.asset.topup, value: f.rupiah(asset.topup), kind: "total" },
        ]} />
      </div>
    </section>
  );
}
