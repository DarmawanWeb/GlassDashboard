const nf = (digits: number, min = digits) =>
  new Intl.NumberFormat("id-ID", { minimumFractionDigits: min, maximumFractionDigits: digits });

/** Rupiah ringkas: "Rp 2,2 miliar", "Rp 400 juta", "Rp 1,25 triliun". */
export function rupiah(v: number, opts: { digits?: number } = {}): string {
  const a = Math.abs(v);
  if (a >= 1e12) return `Rp ${nf(opts.digits ?? 2).format(v / 1e12)} triliun`;
  if (a >= 1e9) return `Rp ${nf(opts.digits ?? (a >= 100e9 ? 0 : 1), 0).format(v / 1e9)} miliar`;
  if (a >= 1e6) return `Rp ${nf(0).format(v / 1e6)} juta`;
  if (a === 0) return "Rp 0";
  return `Rp ${nf(0).format(v)}`;
}

/** Angka miliar saja untuk sumbu grafik: "250". */
export const miliar = (v: number) => nf(v >= 10e9 || v === 0 ? 0 : 1).format(v / 1e9);

export const rupiahFull = (v: number) => `Rp ${nf(0).format(Math.round(v))}`;

export const dec = (v: number, digits = 2) => nf(digits).format(v);

export const pct = (v: number, digits = 0) => `${nf(digits).format(v * 100)}%`;

export const count = (v: number) => nf(0).format(v);

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

/** Skala MMI: 8.0 -> "VIII", 8.4 -> "VIII (8,4)". */
export function mmi(v: number, withDecimal = false): string {
  const r = ROMAN[Math.max(1, Math.min(12, Math.floor(v + 1e-9)))];
  return withDecimal && Math.abs(v - Math.round(v)) > 0.04 ? `${r} (${dec(v, 1)})` : r;
}

export function returnPeriod(v: number | null): string {
  if (!v || !isFinite(v)) return "lebih jarang dari sekali dalam 100.000 tahun";
  const r = v >= 100 ? Math.round(v / 10) * 10 : Math.round(v);
  return `sekali dalam ±${count(r)} tahun`;
}
