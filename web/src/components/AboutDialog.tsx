"use client";

import { useEffect, useRef } from "react";
import { useI18n } from "@/lib/i18n";
import { Icon } from "./ui/controls";

export default function AboutDialog({ open, onClose, dataMode, vlm }: {
  open: boolean; onClose: () => void; dataMode: string; vlm: { enabled: boolean; model: string } | null;
}) {
  const { t } = useI18n();
  const a = t.about;
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog ref={ref} className="dialog" onClose={onClose} onClick={(e) => { if (e.target === ref.current) onClose(); }}>
      <div className="dialog-inner">
        <div style={{ display: "flex", alignItems: "center" }}>
          <h2>{a.title}</h2>
          <button type="button" className="btn btn-ghost btn-icon" style={{ marginLeft: "auto" }} onClick={onClose} aria-label={a.close}><Icon name="close" /></button>
        </div>
        <div className="about-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="logo-light" src="/brand/glass-logo.png" alt="GLASS" width={142} height={60} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="logo-dark" src="/brand/glass-logo-reverse.png" alt="GLASS" width={142} height={60} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/sekolah-logo.png" alt={a.schoolAlt} width={60} height={60} />
          <span className="small muted">{a.team}</span>
        </div>
        <p>{a.intro}</p>
        <p className={`note ${dataMode === "file" ? "note-good" : "note-warn"}`}>{dataMode === "file" ? a.fileMode : a.sampleMode}</p>
        <h3>{a.realTitle}</h3>
        <ul>{a.real.map((x) => <li key={x}>{x}</li>)}</ul>
        <h3>{a.vlmTitle}</h3>
        <p className="small">{vlm?.enabled ? a.vlmOn(vlm.model) : a.vlmOff}</p>
        <h3>{a.sourcesTitle}</h3>
        <ul>
          {a.sources.map(([label, url]) => <li key={url}><a href={url} target="_blank" rel="noopener noreferrer">{label}</a></li>)}
        </ul>
        <h3>{a.shortcutsTitle}</h3>
        <ul>
          <li><span className="kbd">1</span>–<span className="kbd">5</span> {a.shortcuts.or} <span className="kbd">←</span> <span className="kbd">→</span>: {a.shortcuts.steps}</li>
          <li><span className="kbd">{a.shortcuts.spaceKey}</span> {a.shortcuts.space}</li>
          <li><span className="kbd">S</span>: {a.shortcuts.s}</li>
          <li><span className="kbd">F</span>: {a.shortcuts.f}</li>
          <li><span className="kbd">L</span>: {a.shortcuts.l}</li>
          <li><span className="kbd">T</span>: {a.shortcuts.t}</li>
          <li><span className="kbd">Esc</span>: {a.shortcuts.esc}</li>
        </ul>
        <p className="tiny">{a.api}</p>
      </div>
    </dialog>
  );
}
