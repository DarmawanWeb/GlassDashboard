"use client";

import { useEffect, useRef, useState } from "react";
import type { Meta, Mission, UploadJob, VideoOverride } from "@/lib/types";
import { api, frameUrl, type FrameKind } from "@/lib/api";
import { DAMAGE_CLASS } from "@/lib/palette";
import { errorText, useI18n } from "@/lib/i18n";
import { DamageTimeline } from "../charts/charts";
import { Segmented } from "../ui/controls";

type Phase = "idle" | "uploading" | "analyzing" | "done" | "error";

export interface VideoUploadProps {
  meta: Meta;
  mission: Mission | null;
  selectedId: string | null;
  video: VideoOverride[];
  onApply: (v: VideoOverride) => void;
  onRemove: (id: string) => void;
}

/** Uji dengan video drone sendiri: unggah (boleh dengan video sebelum bencana), analisis per gambar,
 *  lalu terapkan ke satu aset. */
export default function VideoUpload({ meta, mission, selectedId, video, onApply, onRemove }: VideoUploadProps) {
  const { t, f, lang } = useI18n();
  const U = t.upload;
  const vlm = meta.drone.vlm;
  const ids = Array.from(new Set([selectedId, ...(mission?.targets.map((x) => x.id) ?? [])].filter(Boolean))) as string[];
  const [assetId, setAssetId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [preFile, setPreFile] = useState<File | null>(null);
  const [useVlm, setUseVlm] = useState(vlm.enabled);
  const [phase, setPhase] = useState<Phase>("idle");
  const [up, setUp] = useState(0);
  const [job, setJob] = useState<UploadJob | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sel, setSel] = useState(0);
  const [kind, setKind] = useState<FrameKind>("ai");
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
          const best = j.frames.reduce((b, q) => (q.damage > (j.frames.find((x) => x.i === b)?.damage ?? -1) ? q.i : b), j.frames[0]?.i ?? 0);
          setSel(best);
        } else if (j.status === "error") {
          setPhase("error");
          setErr(U.errors[j.error_code ?? "failed"] ?? j.error ?? U.errors.failed);
        } else watch(id);
      } catch (e) {
        setPhase("error");
        setErr(errorText(t, e));
      }
    }, 700);
  };

  const reset = () => { setPhase("idle"); setJob(null); setErr(null); };

  const start = async () => {
    if (!file) return;
    const limit = meta.drone.max_upload_mb * 1024 * 1024;
    if (file.size > limit || (preFile && preFile.size > limit)) {
      setErr(U.tooBig(meta.drone.max_upload_mb));
      return;
    }
    setErr(null); setJob(null); setPhase("uploading"); setUp(0); setKind("ai");
    try {
      const j = await api.upload(file, preFile, assetId || null, useVlm && vlm.enabled, lang, setUp);
      setJob(j);
      setPhase("analyzing");
      watch(j.id);
    } catch (e) {
      setPhase("error");
      setErr((e as { status?: number }).status === 0 ? U.network : errorText(t, e));
    }
  };

  const r = job?.result;
  const frame = job?.frames.find((q) => q.i === sel);
  const applied = job ? video.find((v) => v.job_id === job.id) : undefined;
  const busy = phase === "uploading" || phase === "analyzing";
  const progress = phase === "uploading" ? up * 0.3 : phase === "analyzing" ? 0.3 + 0.7 * (job?.progress ?? 0) : phase === "done" ? 1 : 0;
  const views: FrameKind[] = frame?.aligned ? ["ai", "raw", "pre"] : ["ai", "raw"];
  const shownKind: FrameKind = views.includes(kind) ? kind : "ai";

  return (
    <div className="upload">
      <h3 className="section-title">{U.title}</h3>
      <p className="small muted" style={{ margin: "0 0 10px" }}>
        {U.lead} {U.samples}: <a href="/sample/glass-drone-simulasi.mp4" download>{U.sampleAfter}</a>,{" "}
        <a href="/sample/glass-drone-sebelum.mp4" download>{U.sampleBefore}</a>.
      </p>
      <div className="upload-grid">
        <label className="field-label" htmlFor="up-asset">{U.forAsset}</label>
        <select id="up-asset" className="select" value={assetId} onChange={(e) => setAssetId(e.target.value)} disabled={busy}>
          <option value="">{U.noAsset}</option>
          {ids.map((id) => <option key={id} value={id}>{id}</option>)}
        </select>
        <label className="field-label" htmlFor="up-file">{U.file}</label>
        <input id="up-file" className="file" type="file" accept="video/*,image/*" disabled={busy}
          onChange={(e) => { setFile(e.target.files?.[0] ?? null); reset(); }} />
        <label className="field-label" htmlFor="up-pre">{U.preFile}</label>
        <input id="up-pre" className="file" type="file" accept="video/*,image/*" disabled={busy} aria-describedby="up-pre-hint"
          onChange={(e) => { setPreFile(e.target.files?.[0] ?? null); reset(); }} />
      </div>
      <div id="up-pre-hint" className="field-hint">{U.preHint}</div>
      <label className="check-row" title={vlm.enabled ? U.vlmModel(vlm.model) : U.vlmTitleOff}>
        <input type="checkbox" checked={useVlm && vlm.enabled} disabled={!vlm.enabled || busy} onChange={(e) => setUseVlm(e.target.checked)} />
        {U.vlmAsk} {vlm.enabled ? `(${vlm.model})` : U.vlmOff}
      </label>
      <button type="button" className="btn btn-primary" style={{ justifySelf: "start" }} onClick={start} disabled={!file || busy}>
        {phase === "uploading" ? U.uploading : phase === "analyzing" ? U.analyzing : U.analyze}
      </button>
      {(busy || phase === "done") && (
        <div className="mission-progress">
          <div className="mission-bar"><i style={{ width: `${progress * 100}%` }} /></div>
          <span>{phase === "uploading" ? U.uploadingPct(f.pct(up)) : phase === "analyzing" ? U.analyzingN(job?.frames.length ?? 0) : U.done}</span>
        </div>
      )}
      {err && <div className="note note-bad small">{err}</div>}

      {r && job && (
        <div className="upload-result">
          <div className="upload-summary">
            <span className="det-chip" style={{ background: DAMAGE_CLASS[r.cls].color, color: DAMAGE_CLASS[r.cls].ink }}>{t.damage[r.cls]}</span>
            <b>{U.damaged(f.pct(r.damage))}</b>
            <span className="tiny">{U.methodLine(t.method[r.method] ?? r.method, r.frames_used, r.vlm_damage !== null ? f.pct(r.cv_damage) : null)}</span>
          </div>
          {r.pre_frames > 0 && <div className="tiny">{U.alignedCount(r.aligned_frames, r.frames)}</div>}
          {r.summary && <div className="feed-vlm">{r.summary}</div>}
          {r.vlm_status === "disabled" && <div className="tiny">{U.vlmDisabled}</div>}
          {r.vlm_status === "error" && r.vlm_note && <div className="tiny">{r.vlm_note}</div>}
          {job.frames.length > 1 && (
            <div>
              <div className="tiny" style={{ marginBottom: 2 }}>{U.timeline}</div>
              <DamageTimeline frames={job.frames} selected={sel} onSelect={setSel} />
            </div>
          )}
          {frame && (
            <figure className="upload-frame">
              <Segmented label={U.viewGroup} value={shownKind} onChange={setKind}
                options={views.map((v) => ({ value: v, label: U.views[v] }))} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={frameUrl(job.id, frame.i, shownKind)} alt={U.frameAlt(frame.i + 1)} />
              <figcaption>
                {U.frameCaption(f.dec(frame.t, 1), f.pct(frame.damage), f.pct(frame.water))}. {U.buildings(frame.buildings, frame.by_class)}
                {r.pre_frames > 0 && <> {frame.aligned && frame.pre_index !== null ? U.alignedNote(frame.pre_index + 1, frame.inliers) : U.notAligned}</>}
                {frame.vlm ? ` VLM: ${frame.vlm.summary}` : ""}
              </figcaption>
            </figure>
          )}
          <div className="upload-strip" role="list" aria-label={U.strip}>
            {job.frames.map((q) => (
              <button key={q.i} type="button" role="listitem" className="upload-thumb" aria-pressed={q.i === sel} onClick={() => setSel(q.i)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={frameUrl(job.id, q.i, "ai")} alt="" loading="lazy" />
                <span style={{ background: DAMAGE_CLASS[q.cls].color, color: DAMAGE_CLASS[q.cls].ink }}>{f.dec(q.damage * 100, 0)}%</span>
              </button>
            ))}
          </div>
          {job.asset_id && (applied ? (
            <div className="note note-good small">{U.applied(applied.id)}</div>
          ) : (
            <button type="button" className="btn" style={{ justifySelf: "start" }} onClick={() => onApply({ id: job.asset_id!, job_id: job.id })}>
              {U.apply(job.asset_id)}
            </button>
          ))}
        </div>
      )}

      {video.length > 0 && (
        <ul className="applied">
          {video.map((v) => (
            <li key={v.id}>
              {U.usesVideo(v.id)}
              <button type="button" className="btn-link" onClick={() => onRemove(v.id)}>{U.undo}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
