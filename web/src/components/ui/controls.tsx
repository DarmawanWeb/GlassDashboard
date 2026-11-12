"use client";

import { useId, type ReactNode } from "react";
import type { ZoneId } from "@/lib/types";
import { ZONE } from "@/lib/palette";
import { useI18n } from "@/lib/i18n";

export function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} className="seg-btn" onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function RangeField({ label, value, display, min, max, step, onChange, hint, ticks, disabled }: {
  label: string;
  value: number;
  display: ReactNode;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  hint?: ReactNode;
  ticks?: string[];
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="field">
      <div className="field-top">
        <label className="field-label" htmlFor={id}>{label}</label>
        <span className="field-value">{display}</span>
      </div>
      <input id={id} className="range" type="range" min={min} max={max} step={step} value={value} disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))} />
      {ticks && <div className="range-ticks" aria-hidden="true">{ticks.map((t) => <span key={t}>{t}</span>)}</div>}
      {hint && <div className="field-hint">{hint}</div>}
    </div>
  );
}

export function ZoneChip({ zone, suffix }: { zone: ZoneId; suffix?: string }) {
  const { t } = useI18n();
  const z = ZONE[zone];
  return (
    <span className="chip" style={{ background: z.color, color: z.ink }}>
      <span className="chip-dot" style={{ background: z.ink === "#ffffff" ? "#fff" : "#13283f", opacity: 0.85 }} />
      {t.zone[zone].label}{suffix ? `: ${suffix}` : ""}
    </span>
  );
}

export function Ledger({ rows }: {
  rows: { label: ReactNode; note?: ReactNode; value: ReactNode; kind?: "total" | "sub"; wrap?: boolean }[];
}) {
  return (
    <table className="ledger">
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className={r.kind === "total" ? "ledger-total" : r.kind === "sub" ? "ledger-sub" : undefined}>
            <td>{r.label}{r.note && <span className="ledger-note">{r.note}</span>}</td>
            <td className={r.wrap ? "ledger-wrap" : undefined}>{r.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

type IconName = "refresh" | "info" | "expand" | "close" | "shield" | "check" | "x" | "sun" | "moon";

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  switch (name) {
    case "refresh":
      return <svg {...common}><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4v7h-7" /></svg>;
    case "info":
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" /></svg>;
    case "expand":
      return <svg {...common}><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>;
    case "close":
    case "x":
      return <svg {...common}><path d="M6 6l12 12M18 6L6 18" /></svg>;
    case "shield":
      return <svg {...common}><path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z" /></svg>;
    case "check":
      return <svg {...common}><path d="M5 12.5l4.5 4.5L19 7" /></svg>;
    case "sun":
      return <svg {...common}><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4" /></svg>;
    case "moon":
      return <svg {...common}><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></svg>;
  }
}
