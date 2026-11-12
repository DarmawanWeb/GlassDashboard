export type AssetType = "sekolah" | "puskesmas" | "kantor" | "jembatan";
export type ZoneId = "hijau" | "kuning" | "oranye" | "merah";
export type StepId = "lihat" | "nilai" | "hitung" | "bayar";
export type Sensor = "d_surf" | "d_vol" | "d_water";
export type Basemap = "s2" | "esri" | "carto" | "offline";

export interface Term {
  key: Sensor;
  label: string;
  weight: number;
  value: number;
  product: number;
}

export interface Asset {
  id: string;
  type: AssetType;
  lon: number;
  lat: number;
  sum_insured: number;
  d_vol: number;
  d_surf: number;
  d_water: number;
  d_surf_est?: number;
  mmi: number;
  d_coast_km: number;
  observed: boolean;
  sdsi: number;
  zone: ZoneId;
  terms: Term[];
  neighbors: string[];
  claim: number;
  advance: number;
  topup: number;
  over: number;
}

export interface Policy {
  deductible_rate: number;
  advance_rate: number;
  mmi_trigger: number;
}

export interface ScenarioParams {
  seed: number;
  n_assets: number;
  cloud_cover: number;
}

export interface Summary {
  data_mode: "contoh" | "file";
  n_assets: number;
  n_observed: number;
  n_hidden: number;
  total_sum_insured: number;
  case_reserves: number;
  ibnr: number;
  total_reserves: number;
  loss_ratio: number;
  advance_total: number;
  n_advance: number;
  topup_total: number;
  basis_risk_over: number;
  n_over: number;
  missed_severe_count: number;
  missed_severe_claim: number;
}

export interface ZoneRow {
  zone: ZoneId;
  label: string;
  meaning: string;
  count: number;
  count_estimated: number;
  claim: number;
  claim_estimated: number;
}

export interface TypeRow {
  type: AssetType;
  label: string;
  count: number;
  sum_insured: number;
  advance: number;
  topup: number;
  claim: number;
}

export interface Pml {
  curve: { return_period: number; loss: number }[];
  aal: number;
  pml: Record<"50" | "100" | "250", number>;
  scenario_return_period: number | null;
  assumptions: { years: number; event_rate: number; median_loss_ratio: number; sigma: number };
}

export interface Scenario {
  params: { scenario: ScenarioParams; policy: Policy };
  summary: Summary;
  assets: Asset[];
  clouds: { rings: number[][][] }[];
  by_zone: ZoneRow[];
  by_type: TypeRow[];
  pml: Pml;
  shake_line: number[][][];
}

export interface GeoOverlays {
  bbox: [number, number, number, number];
  center: [number, number];
  epicenter: { lon: number; lat: number; magnitude: number; date: string };
  fault: number[][];
  liquefaction: { name: string; lon: number; lat: number; radius_km: number }[];
  coast: number[][][];
  source: string;
}

export interface Meta {
  asset_types: Record<AssetType, { label: string; weights: [number, number, number] }>;
  zones: { upper: number; zone: ZoneId; label: string; meaning: string }[];
  defaults: { scenario: ScenarioParams; policy: Policy };
  n_neighbors: number;
  data_mode: "contoh" | "file";
  geo: GeoOverlays;
  shake_grid: [number, number, number][];
}

export interface CalcResult {
  sdsi: number;
  zone: ZoneId;
  terms: Term[];
  deductible: number;
  claim: number;
  advance: number;
  topup: number;
}

export interface Certificate {
  certificate_id: string;
  asset_id: string;
  asset_type: string;
  location: { lat: number; lon: number };
  event: string;
  sdsi: number;
  zone: string;
  observed: boolean;
  sum_insured_idr: number;
  estimated_claim_idr: number;
  advance_idr: number;
  topup_idr: number;
  data_sources: string[];
  model_version: string;
  issued_utc: string;
  sha256: string;
}

export interface VerifyResult {
  valid: boolean;
  expected_sha256: string;
  given_sha256: string;
}
