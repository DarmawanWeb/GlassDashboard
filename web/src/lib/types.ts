export type AssetType = "sekolah" | "puskesmas" | "kantor" | "jembatan";
export type ZoneId = "hijau" | "kuning" | "oranye" | "merah";
export type StepId = "lihat" | "pindai" | "nilai" | "hitung" | "bayar";
export type Source = "satelit" | "drone" | "video";
export type Sensor = "d_surf" | "d_vol" | "d_water";
export type Basemap = "s2" | "esri" | "carto" | "offline";
export type Lang = "id" | "en";

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
  source: Source;
  sat?: { d_vol: number; d_surf: number; d_water: number; observed: boolean };
  drone?: { roof: number; vol: number; wet: number; cls: number; label: string; confidence: number; key: string };
  video?: { job_id: string; damage: number; label: string; method: string };
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
  n_drone: number;
  n_video: number;
  n_cloud_cleared: number;
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
  drone: DroneInfo;
}

/* ---------- drone ---------- */
export type ViewKind = "rgb" | "pre" | "lidar" | "thermal" | "ai";

export interface Camera {
  w: number;
  h: number;
  gsd_m: number;
  footprint_m: [number, number];
  gsd_target_cm: number;
  lidar_range: [number, number];
  thermal_range: [number, number];
}

export interface DroneInfo {
  vlm: { enabled: boolean; provider: string; model: string };
  camera: Camera;
  flight: { speed_ms: number; altitude_m: number; hover_s: number; battery_min: number; swap_min: number; overhead_min: number };
  max_upload_mb: number;
}

export interface MissionTarget {
  id: string;
  type: AssetType;
  lon: number;
  lat: number;
  reason: "awan" | "berat";
  order: number;
  leg_km: number;
  cum_km: number;
  eta_min: number;
}

export interface Mission {
  key: string;
  base: { lon: number; lat: number; name: string };
  targets: MissionTarget[];
  route: [number, number][];
  stats: {
    n_targets: number; n_cloud: number; n_severe: number; distance_km: number; flight_min: number;
    total_min: number; batteries: number; speed_ms: number; altitude_m: number; hover_s: number; battery_min: number;
  };
  camera: Camera;
}

export interface Detection {
  id: string;
  target: boolean;
  cls: number;
  pct: number;
  bbox: [number, number, number, number];
  poly: [number, number][];
}

export interface DroneEstimate {
  roof: number;
  vol: number;
  wet: number;
  cls: number;
  label: string;
  confidence: number;
  d_surf: number;
  d_vol: number;
  d_water: number;
}

export interface ScanResult {
  key: string;
  id: string;
  type: AssetType;
  lon: number;
  lat: number;
  estimate: DroneEstimate;
  truth: { roof: number; cls: number; vol: number; wet: number; n_buildings: number };
  truth_label: string;
  sdsi_satellite: number;
  sdsi_drone: number;
  zone_drone: ZoneId;
  observed_by_satellite: boolean;
  area: { n_buildings: number; n_severe: number };
  detections: Detection[];
  image: { w: number; h: number };
  ms: number;
}

export interface VlmAnswer {
  cls: number;
  damage_pct: number;
  water_pct: number;
  buildings: number;
  objects: string[];
  summary: string;
  provider: string;
  model: string;
  ms: number;
}

export interface UploadFrame {
  i: number;
  aligned: boolean;          // disejajarkan dengan gambar sebelum bencana
  pre_index: number | null;
  inliers: number;
  match: number | null;
  buildings: number;
  by_class: [number, number, number, number];
  t: number;
  w: number;
  h: number;
  damage: number;
  cls: number;
  label: string;
  water: number;
  vegetation: number;
  built: number;
  confidence: number;
  vlm: VlmAnswer | null;
}

export interface UploadJob {
  id: string;
  status: "uploading" | "running" | "done" | "error";
  progress: number;
  filename: string;
  pre_filename: string | null;
  asset_id: string | null;
  use_vlm: boolean;
  frames: UploadFrame[];
  error: string | null;
  error_code: string | null;
  result: {
    damage: number; cls: number; label: string; method: "cv" | "change" | "vlm+cv" | "vlm+change"; cv_damage: number;
    vlm_damage: number | null; water: number; frames_used: number; frames: number; aligned_frames: number;
    pre_frames: number; summary: string | null; vlm_note: string | null;
    vlm_status: "off" | "ok" | "disabled" | "error"; d_surf: number;
  } | null;
}

export interface VideoOverride {
  id: string;
  job_id: string;
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
