import type { AssetType, Sensor, ZoneId } from "./types";

/* Hanya warna & urutan. Semua teks ada di lib/i18n. */

/** Warna zona = palet status (hijau/kuning/oranye/merah), selalu tampil bersama label. */
export const ZONE: Record<ZoneId, { color: string; ink: string }> = {
  hijau: { color: "#0CA30C", ink: "#ffffff" },
  kuning: { color: "#FAB219", ink: "#13283F" },
  oranye: { color: "#EC835A", ink: "#13283F" },
  merah: { color: "#D03B3B", ink: "#ffffff" },
};
export const ZONES: ZoneId[] = ["hijau", "kuning", "oranye", "merah"];

export const SERIES = {
  advance: "#2A78D6", // uang muka parametrik
  topup: "#EB6834", // sisa pembayaran (indemnity)
  muted: "#8A97A6",
};

export const ASSET_TYPES: AssetType[] = ["sekolah", "puskesmas", "kantor", "jembatan"];
export const SENSORS: Sensor[] = ["d_surf", "d_vol", "d_water"];

/** Ramp peta panas per sensor satelit (terang -> pekat). */
export const SENSOR_RAMP: Record<Sensor, readonly string[]> = {
  d_surf: ["#fff7d6", "#fab219", "#d03b3b"],
  d_vol: ["#e3dcff", "#8f7cf0", "#4b2fc9"],
  d_water: ["#d6f1ff", "#38a3e8", "#0b4f9c"],
};

/** Nilai D_surf per kelas foto (gaya xBD): tidak rusak, ringan, berat, hancur. */
export const SURF_VALUES = [0, 1 / 3, 2 / 3, 1];
export const nearestSurf = (v: number) =>
  SURF_VALUES.reduce((best, c, i) => (Math.abs(c - v) < Math.abs(SURF_VALUES[best] - v) ? i : best), 0);

/** Kelas kerusakan bangunan (gaya xBD), warnanya mengikuti tingkat keparahan zona. */
export const DAMAGE_CLASS = [
  { color: "#0CA30C", ink: "#ffffff" },
  { color: "#FAB219", ink: "#13283F" },
  { color: "#EC835A", ink: "#13283F" },
  { color: "#D03B3B", ink: "#ffffff" },
] as const;

/** Tiga sensor drone sesuai rancangan GLASS. */
export const DRONE_SENSORS = ["rgb", "lidar", "thermal"] as const;

export const DRONE_ACCENT = "#7cc4ff";
