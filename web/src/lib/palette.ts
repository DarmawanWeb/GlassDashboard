import type { AssetType, ZoneId } from "./types";

/** Warna zona = palet status (hijau/kuning/oranye/merah), selalu tampil bersama label. */
export const ZONE: Record<ZoneId, { color: string; label: string; meaning: string; ink: string }> = {
  hijau: { color: "#0CA30C", label: "Hijau", meaning: "Rusak ringan", ink: "#ffffff" },
  kuning: { color: "#FAB219", label: "Kuning", meaning: "Rusak sedang", ink: "#13283F" },
  oranye: { color: "#EC835A", label: "Oranye", meaning: "Rusak berat", ink: "#13283F" },
  merah: { color: "#D03B3B", label: "Merah", meaning: "Rusak total", ink: "#ffffff" },
};
export const ZONES: ZoneId[] = ["hijau", "kuning", "oranye", "merah"];

export const SERIES = {
  advance: "#2A78D6", // uang muka parametrik
  topup: "#EB6834", // sisa pembayaran (indemnity)
  muted: "#8A97A6",
};

export const TYPE_LABEL: Record<AssetType, string> = {
  sekolah: "Sekolah",
  puskesmas: "Puskesmas",
  kantor: "Kantor pemerintah",
  jembatan: "Jembatan",
};

export const SENSOR = {
  d_surf: { label: "Foto", long: "Foto satelit", note: "Melihat atap runtuh, puing, dan bangunan yang hilang.", ramp: ["#fff7d6", "#fab219", "#d03b3b"] },
  d_vol: { label: "Radar", long: "Radar Sentinel-1", note: "Melihat perubahan bentuk dan runtuhan. Radar menembus awan.", ramp: ["#e3dcff", "#8f7cf0", "#4b2fc9"] },
  d_water: { label: "Air", long: "Peta banjir & suhu", note: "Melihat genangan dan lumpur, terutama di sepanjang pantai.", ramp: ["#d6f1ff", "#38a3e8", "#0b4f9c"] },
} as const;

export const SURF_CLASSES = [
  { value: 0, label: "Tidak rusak" },
  { value: 1 / 3, label: "Rusak ringan" },
  { value: 2 / 3, label: "Rusak berat" },
  { value: 1, label: "Hancur" },
];
