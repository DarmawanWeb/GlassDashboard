"use client";

import { useEffect, useState } from "react";
import type { Asset, Certificate, VerifyResult, ZoneId } from "@/lib/types";
import { api } from "@/lib/api";
import { errorText, useI18n } from "@/lib/i18n";
import { Icon } from "./ui/controls";

function Hash({ value, compare }: { value: string; compare?: string }) {
  return (
    <span className="hash">
      {value.split("").map((ch, i) => (
        <span key={i} className={compare && compare[i] !== ch ? "hash-diff" : undefined}>{ch}</span>
      ))}
    </span>
  );
}

/** Sertifikat Kerugian Digital + uji keaslian (ubah satu angka, sidik jari berubah). */
export default function CertificatePanel({ asset, onPickLargest }: { asset: Asset | null; onPickLargest: () => void }) {
  const { t, f, lang } = useI18n();
  const [cert, setCert] = useState<Certificate | null>(null);
  const [claimInput, setClaimInput] = useState("");
  const [check, setCheck] = useState<VerifyResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);

  // Sertifikat diterbitkan ulang kalau aset, angkanya, atau bahasanya berubah.
  useEffect(() => { setCert(null); setCheck(null); setErr(null); }, [asset?.id, asset?.claim, asset?.advance, lang]);

  if (!asset) {
    return (
      <div className="note small" style={{ display: "grid", gap: 8 }}>
        <span>{t.cert.pick}</span>
        <button type="button" className="btn" style={{ justifySelf: "start" }} onClick={onPickLargest}>{t.cert.pickLargest}</button>
      </div>
    );
  }

  const issue = async () => {
    setBusy(true); setErr(null);
    try {
      const c = await api.issue(asset, lang);
      setCert(c);
      setClaimInput(String(c.estimated_claim_idr));
      setCheck(null);
    } catch (e) { setErr(e); } finally { setBusy(false); }
  };

  const verify = async () => {
    if (!cert) return;
    setBusy(true); setErr(null);
    try {
      const n = Number(claimInput.replace(/[^\d]/g, ""));
      setCheck(await api.verify({ ...cert, estimated_claim_idr: Number.isFinite(n) ? n : 0 }));
    } catch (e) { setErr(e); } finally { setBusy(false); }
  };

  if (!cert) {
    return (
      <div style={{ display: "grid", gap: 10 }}>
        <div className="small muted">{t.cert.selected(asset.id, f.rupiah(asset.claim))}</div>
        <button type="button" className="btn btn-primary" style={{ justifySelf: "start" }} onClick={issue} disabled={busy}>
          <Icon name="shield" /> {t.cert.issue(asset.id)}
        </button>
        {err !== null && <div className="note note-bad small">{errorText(t, err)}</div>}
      </div>
    );
  }

  const zone = t.zone[cert.zone as ZoneId]?.label;
  const tampered = Number(claimInput.replace(/[^\d]/g, "")) !== cert.estimated_claim_idr;
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="cert">
        <div className="cert-title">{t.cert.title}</div>
        <div className="tiny">{cert.certificate_id}</div>
        <dl className="cert-grid">
          <dt>{t.cert.asset}</dt><dd>{cert.asset_id}, {cert.asset_type}</dd>
          <dt>{t.cert.event}</dt><dd>{cert.event}</dd>
          <dt>{t.cert.score}</dt><dd>{f.dec(cert.sdsi, 3)}, {zone ? t.zoneName(zone) : cert.zone}</dd>
          <dt>{t.cert.sumInsured}</dt><dd>{f.rupiahFull(cert.sum_insured_idr)}</dd>
          <dt>{t.cert.claim}</dt><dd>{f.rupiahFull(cert.estimated_claim_idr)}</dd>
          <dt>{t.cert.advance}</dt><dd>{f.rupiahFull(cert.advance_idr)}</dd>
          <dt>{t.cert.topup}</dt><dd>{f.rupiahFull(cert.topup_idr)}</dd>
          <dt>{t.cert.sources}</dt><dd>{cert.data_sources.slice(0, 3).join(", ")}</dd>
          <dt>{t.cert.issued}</dt><dd>{f.utc(cert.issued_utc)}</dd>
        </dl>
        <div style={{ marginTop: 10 }}>
          <div className="tiny">{t.cert.fingerprint}</div>
          <Hash value={cert.sha256} />
        </div>
      </div>

      <h3 className="section-title" style={{ margin: "6px 0 0" }}>{t.cert.verifyTitle}</h3>
      <div className="small muted">{t.cert.verifyLead}</div>
      <div style={{ display: "flex", gap: 8 }}>
        <input className="cert-input" inputMode="numeric" aria-label={t.cert.inputLabel} value={claimInput}
          onChange={(e) => { setClaimInput(e.target.value); setCheck(null); }} />
        <button type="button" className="btn btn-primary" onClick={verify} disabled={busy}>{t.cert.check}</button>
      </div>
      {tampered && !check && (
        <button type="button" className="btn btn-ghost" style={{ justifySelf: "start", height: 30 }} onClick={() => { setClaimInput(String(cert.estimated_claim_idr)); setCheck(null); }}>
          {t.cert.restore}
        </button>
      )}
      {check && (check.valid ? (
        <div className="note note-good small" role="status">{t.cert.valid}</div>
      ) : (
        <div className="note note-bad small" role="status" style={{ display: "grid", gap: 6 }}>
          <span>{t.cert.invalid}</span>
          <span className="tiny">{t.cert.recorded}</span>
          <Hash value={check.given_sha256} />
          <span className="tiny">{t.cert.current}</span>
          <Hash value={check.expected_sha256} compare={check.given_sha256} />
        </div>
      ))}
      {err !== null && <div className="note note-bad small">{errorText(t, err)}</div>}
    </div>
  );
}
