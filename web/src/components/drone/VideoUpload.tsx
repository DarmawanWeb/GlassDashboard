"use client";

import { useEffect, useRef, useState } from "react";
import type { Meta, Mission, UploadJob, VideoOverride } from "@/lib/types";
import { api, frameUrl } from "@/lib/api";
import { DAMAGE_CLASS } from "@/lib/palette";
import { dec, pct } from "@/lib/format";

type Phase = "idle" | "uploading" | "analyzing" | "done" | "error";

export interface VideoUploadProps {
  meta: Meta;
  mission: Mission | null;
  selectedId: string | null;
  video: VideoOverride[];
  onApply: (v: VideoOverride) => void;
  onRemove: (id: string) => void;
}

/** Uji dengan video drone sendiri: unggah, analisis per gambar, lalu terapkan ke satu aset. */
export default function VideoUpload({ meta, mission, selectedId, video, onApply, onRemove }: VideoUploadProps) {
  const vlm = meta.drone.vlm;
  const ids = Array.from(new Set([selectedId, ...(mission?.targets.map((t) => t.id) ?? [])].filter(Boolean))) as string[];
  const [assetId, setAssetId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [useVlm, setUseVlm] = useState(vlm.enabled);
  const [phase, setPhase] = useState<Phase>("idle");
  const [up, setUp] = useState(0);
  const [job, setJob] = useState<UploadJob | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sel, setSel] = useState(0);
  const [kind, setKind] = useState<"ai" | "raw">("ai");
  const poll = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { if (selectedId) setAssetId(selectedId); }, [selectedId]);
  useEffect(() => { if (!assetId && ids[0]) setAssetId(ids[0]); }, [assetId, ids]);
  useEffect(() => () => { if (poll.current) clearTimeout(poll.current); }, []);

  const watch = (id: string) => {
    poll.current = setTimeout(async () => {
      try {
        const j = await api.uploadStatus(id);
        setJob(j);
        if (j.status === "done") {
          setPhase("done");
          const best = j.frames.reduce((b, f) => (f.damage > j.frames[b].damage ? f.i : b), 0);
          setSel(best);
        } else if (j.status === "error") {
          setPhase("error");
          setErr(j.error ?? "Analisis gagal");
        } else watch(id);
      } catch (e) {
        setPhase("error");
        setErr((e as Error).message);
      }
    }, 700);
  };

  const start = async () => {
    if (!file) return;
    if (file.size > meta.drone.max_upload_mb * 1024 * 1024) {
      setErr(`File lebih besar dari ${meta.drone.max_upload_mb} MB.`);
      return;
    }
    setErr(null); setJob(null); setPhase("uploading"); setUp(0);
    try {
      const j = await api.upload(file, assetId || null, useVlm && vlm.enabled, setUp);
      setJob(j);
      setPhase("analyzing");
      watch(j.id);
    } catch (e) {
      setPhase("error");
      setErr((e as Error).message);
    }
  };

  const r = job?.result;
  const frame = job?.frames.find((f) => f.i === sel);
  const applied = job ? video.find((v) => v.job_id === job.id) : undefined;
  const busy = phase === "uploading" || phase === "analyzing";
  const progress = phase === "uploading" ? up * 0.3 : phase === "analyzing" ? 0.3 + 0.7 * (job?.progress ?? 0) : phase === "done" ? 1 : 0;

  return (
    <div className="upload">
      <h3 className="section-title">Coba dengan video drone sendiri</h3>
      <p className="small muted" style={{ margin: "0 0 10px" }}>
        Unggah video atau foto udara. AI memeriksa ±1 gambar per detik, menandai puing (merah) dan genangan (biru), lalu
        hasilnya bisa dipakai untuk satu aset. <a href="/sample/glass-drone-simulasi.mp4" download>Unduh contoh video simulasi</a>.
      </p>
      <div className="upload-grid">
        <label className="field-label" htmlFor="up-asset">Untuk aset</label>
        <select id="up-asset" className="select" value={assetId} onChange={(e) => setAssetId(e.target.value)} disabled={busy}>
          <option value="">Tanpa aset (hanya analisis)</option>
          {ids.map((id) => <option key={id} value={id}>{id}</option>)}
        </select>
        <label className="field-label" htmlFor="up-file">File</label>
        <input id="up-file" className="file" type="file" accept="video/*,image/*" disabled={busy}
          onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPhase("idle"); setJob(null); setErr(null); }} />
      </div>
      <label className="check-row" title={vlm.enabled ? `Model: ${vlm.model}` : "Aktifkan GLASS_VLM_PROVIDER di server"}>
        <input type="checkbox" checked={useVlm && vlm.enabled} disabled={!vlm.enabled || busy} onChange={(e) => setUseVlm(e.target.checked)} />
        Minta VLM menjelaskan gambarnya {vlm.enabled ? `(${vlm.model})` : "(belum aktif di server)"}
      </label>
      <button type="button" className="btn btn-primary" style={{ justifySelf: "start" }} onClick={start} disabled={!file || busy}>
        {phase === "uploading" ? "Mengunggah…" : phase === "analyzing" ? "Menganalisis…" : "Analisis video"}
      </button>
      {(busy || phase === "done") && (
        <div className="mission-progress">
          <div className="mission-bar"><i style={{ width: `${progress * 100}%` }} /></div>
          <span>{phase === "uploading" ? `Mengunggah ${pct(up)}` : phase === "analyzing" ? `Menganalisis ${job?.frames.length ?? 0} gambar` : "Selesai"}</span>
        </div>
      )}
      {err && <div className="note note-bad small">{err}</div>}

      {r && job && (
        <div className="upload-result">
          <div className="upload-summary">
            <span className="det-chip" style={{ background: DAMAGE_CLASS[r.cls].color, color: DAMAGE_CLASS[r.cls].ink }}>{r.label}</span>
            <b>{pct(r.damage)} rusak</b>
            <span className="tiny">{r.method}, {r.frames_used} gambar{r.vlm_damage !== null ? `, visi komputer ${pct(r.cv_damage)}` : ""}</span>
          </div>
          {r.summary && <div className="feed-vlm">{r.summary}</div>}
          {r.vlm_note && <div className="tiny">{r.vlm_note}</div>}
          {frame && (
            <figure className="upload-frame">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={frameUrl(job.id, frame.i, kind)} alt={`Gambar ke-${frame.i + 1} dari video`} />
              <figcaption>
                Detik {dec(frame.t, 1)}: {pct(frame.damage)} rusak, genangan {pct(frame.water)}
                {frame.vlm ? `. VLM: ${frame.vlm.summary}` : ""}
                <button type="button" className="btn-link" onClick={() => setKind(kind === "ai" ? "raw" : "ai")}>
                  {kind === "ai" ? "Lihat foto asli" : "Lihat mata AI"}
                </button>
              </figcaption>
            </figure>
          )}
          <div className="upload-strip" role="list" aria-label="Gambar dari video">
            {job.frames.map((f) => (
              <button key={f.i} type="button" role="listitem" className="upload-thumb" aria-pressed={f.i === sel} onClick={() => setSel(f.i)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={frameUrl(job.id, f.i, "ai")} alt="" loading="lazy" />
                <span style={{ background: DAMAGE_CLASS[f.cls].color, color: DAMAGE_CLASS[f.cls].ink }}>{dec(f.damage * 100, 0)}%</span>
              </button>
            ))}
          </div>
          {job.asset_id && (applied ? (
            <div className="note note-good small">Sudah dipakai untuk {applied.id}. Lihat perubahannya di langkah Nilai dan Hitung.</div>
          ) : (
            <button type="button" className="btn" style={{ justifySelf: "start" }} onClick={() => onApply({ id: job.asset_id!, job_id: job.id })}>
              Pakai hasil ini untuk {job.asset_id}
            </button>
          ))}
        </div>
      )}

      {video.length > 0 && (
        <ul className="applied">
          {video.map((v) => (
            <li key={v.id}>
              {v.id} memakai hasil video
              <button type="button" className="btn-link" onClick={() => onRemove(v.id)}>batalkan</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
