"use client";

import { useEffect, useState } from "react";
import type { Asset, Certificate, VerifyResult } from "@/lib/types";
import { api } from "@/lib/api";
import { ZONE } from "@/lib/palette";
import { dec, rupiah, rupiahFull } from "@/lib/format";
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
  const [cert, setCert] = useState<Certificate | null>(null);
  const [claimInput, setClaimInput] = useState("");
  const [check, setCheck] = useState<VerifyResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { setCert(null); setCheck(null); setErr(null); }, [asset?.id, asset?.claim, asset?.advance]);

  if (!asset) {
    return (
      <div className="note small" style={{ display: "grid", gap: 8 }}>
        <span>Klik satu aset di peta untuk menerbitkan sertifikat kerugiannya.</span>
        <button type="button" className="btn" style={{ justifySelf: "start" }} onClick={onPickLargest}>Pilih aset dengan klaim terbesar</button>
      </div>
    );
  }

  const issue = async () => {
    setBusy(true); setErr(null);
    try {
      const c = await api.issue(asset);
      setCert(c);
      setClaimInput(String(c.estimated_claim_idr));
      setCheck(null);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  const verify = async () => {
    if (!cert) return;
    setBusy(true); setErr(null);
    try {
      const n = Number(claimInput.replace(/[^\d]/g, ""));
      setCheck(await api.verify({ ...cert, estimated_claim_idr: Number.isFinite(n) ? n : 0 }));
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  if (!cert) {
    return (
      <div style={{ display: "grid", gap: 10 }}>
        <div className="small muted">Aset terpilih: <b style={{ color: "var(--ink)" }}>{asset.id}</b>, estimasi klaim {rupiah(asset.claim)}.</div>
        <button type="button" className="btn btn-primary" style={{ justifySelf: "start" }} onClick={issue} disabled={busy}>
          <Icon name="shield" /> Terbitkan sertifikat {asset.id}
        </button>
        {err && <div className="note note-bad small">{err}</div>}
      </div>
    );
  }

  const tampered = Number(claimInput.replace(/[^\d]/g, "")) !== cert.estimated_claim_idr;
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="cert">
        <div className="cert-title">Sertifikat Kerugian Digital</div>
        <div className="tiny">{cert.certificate_id}</div>
        <dl className="cert-grid">
          <dt>Aset</dt><dd>{cert.asset_id}, {cert.asset_type}</dd>
          <dt>Kejadian</dt><dd>{cert.event}</dd>
          <dt>Skor SDSI</dt><dd>{dec(cert.sdsi, 3)}, zona {ZONE[cert.zone as keyof typeof ZONE]?.label.toLowerCase() ?? cert.zone}</dd>
          <dt>Nilai pertanggungan</dt><dd>{rupiahFull(cert.sum_insured_idr)}</dd>
          <dt>Estimasi klaim</dt><dd>{rupiahFull(cert.estimated_claim_idr)}</dd>
          <dt>Uang muka</dt><dd>{rupiahFull(cert.advance_idr)}</dd>
          <dt>Sisa pembayaran</dt><dd>{rupiahFull(cert.topup_idr)}</dd>
          <dt>Terbit</dt><dd>{cert.issued_utc.replace("T", " ").replace("Z", " UTC")}</dd>
        </dl>
        <div style={{ marginTop: 10 }}>
          <div className="tiny">Sidik jari SHA-256</div>
          <Hash value={cert.sha256} />
        </div>
      </div>

      <h3 className="section-title" style={{ margin: "6px 0 0" }}>Uji keaslian</h3>
      <div className="small muted">Ubah angka klaim, lalu cek. Satu digit saja berbeda, sidik jarinya berubah total.</div>
      <div style={{ display: "flex", gap: 8 }}>
        <input className="cert-input" inputMode="numeric" aria-label="Estimasi klaim di sertifikat (rupiah)" value={claimInput}
          onChange={(e) => { setClaimInput(e.target.value); setCheck(null); }} />
        <button type="button" className="btn btn-primary" onClick={verify} disabled={busy}>Cek sidik jari</button>
      </div>
      {tampered && !check && (
        <button type="button" className="btn btn-ghost" style={{ justifySelf: "start", height: 30 }} onClick={() => { setClaimInput(String(cert.estimated_claim_idr)); setCheck(null); }}>
          Kembalikan angka asli
        </button>
      )}
      {check && (check.valid ? (
        <div className="note note-good small" role="status">
          <b>Asli.</b> Isi sertifikat cocok dengan sidik jarinya.
        </div>
      ) : (
        <div className="note note-bad small" role="status" style={{ display: "grid", gap: 6 }}>
          <span><b>Tidak cocok.</b> Isi sertifikat sudah diubah, jadi sidik jarinya berbeda.</span>
          <span className="tiny">Sidik jari tercatat</span>
          <Hash value={check.given_sha256} />
          <span className="tiny">Sidik jari dari isi sekarang (karakter berbeda ditandai)</span>
          <Hash value={check.expected_sha256} compare={check.given_sha256} />
        </div>
      ))}
      {err && <div className="note note-bad small">{err}</div>}
    </div>
  );
}
