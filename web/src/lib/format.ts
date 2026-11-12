import type { Lang } from "./types";

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

/** Format angka, rupiah, dan waktu sesuai bahasa: "Rp 2,2 miliar" atau "Rp 2.2 billion". */
export function makeFormat(lang: Lang) {
  const en = lang === "en";
  const loc = en ? "en-US" : "id-ID";
  const cache = new Map<string, Intl.NumberFormat>();
  const nf = (digits: number, min = digits) => {
    const k = `${digits}:${min}`;
    let f = cache.get(k);
    if (!f) cache.set(k, (f = new Intl.NumberFormat(loc, { minimumFractionDigits: min, maximumFractionDigits: digits })));
    return f;
  };
  const unit = en ? { t: "trillion", b: "billion", m: "million" } : { t: "triliun", b: "miliar", m: "juta" };

  const dec = (v: number, digits = 2) => nf(digits).format(v);
  const count = (v: number) => nf(0).format(v);
  const pct = (v: number, digits = 0) => `${nf(digits).format(v * 100)}%`;

  const rupiah = (v: number, opts: { digits?: number } = {}) => {
    const a = Math.abs(v);
    if (a >= 1e12) return `Rp ${nf(opts.digits ?? 2).format(v / 1e12)} ${unit.t}`;
    if (a >= 1e9) return `Rp ${nf(opts.digits ?? (a >= 100e9 ? 0 : 1), 0).format(v / 1e9)} ${unit.b}`;
    if (a >= 1e6) return `Rp ${nf(0).format(v / 1e6)} ${unit.m}`;
    if (a === 0) return "Rp 0";
    return `Rp ${nf(0).format(v)}`;
  };
  const rupiahFull = (v: number) => `Rp ${nf(0).format(Math.round(v))}`;

  /** Angka miliar saja untuk sumbu grafik: "250". */
  const billions = (v: number) => nf(v >= 10e9 || v === 0 ? 0 : 1).format(v / 1e9);

  /** Skala MMI: 8.0 -> "VIII", 8.4 -> "VIII (8,4)". */
  const mmi = (v: number, withDecimal = false) => {
    const r = ROMAN[Math.max(1, Math.min(12, Math.floor(v + 1e-9)))];
    return withDecimal && Math.abs(v - Math.round(v)) > 0.04 ? `${r} (${dec(v, 1)})` : r;
  };

  const returnPeriod = (v: number | null) => {
    if (!v || !isFinite(v)) return en ? "less often than once in 100,000 years" : "lebih jarang dari sekali dalam 100.000 tahun";
    const r = v >= 100 ? Math.round(v / 10) * 10 : Math.round(v);
    return en ? `about once in ${count(r)} years` : `sekali dalam ±${count(r)} tahun`;
  };

  const minutes = (m: number) => {
    const total = Math.round(m), h = Math.floor(total / 60), r = total % 60;
    if (en) return h ? `${h} h ${r} min` : `${r} min`;
    return h ? `${h} jam ${r} menit` : `${r} menit`;
  };

  const hemi = (v: number, axis: "lat" | "lon") =>
    axis === "lat" ? (v < 0 ? (en ? "S" : "LS") : en ? "N" : "LU") : v < 0 ? (en ? "W" : "BB") : en ? "E" : "BT";
  const coord = (v: number, axis: "lat" | "lon") => `${dec(Math.abs(v), 4)}° ${hemi(v, axis)}`;
  const utc = (iso: string) => iso.replace("T", " ").replace("Z", " UTC");

  return { lang, dec, count, pct, rupiah, rupiahFull, billions, mmi, returnPeriod, minutes, hemi, coord, utc };
}

export type Fmt = ReturnType<typeof makeFormat>;
