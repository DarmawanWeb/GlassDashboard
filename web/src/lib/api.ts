import type {
  Asset, CalcResult, Certificate, Lang, Meta, Mission, Policy, ScanResult, Scenario, ScenarioParams, UploadJob,
  VerifyResult, VideoOverride, ViewKind, VlmAnswer,
} from "./types";

/** Galat dari API. `status` 0 berarti server tidak bisa dihubungi. */
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function call<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError(0, (e as Error).message);
  }
  if (!res.ok) throw new ApiError(res.status, await errorDetail(res));
  return res.json() as Promise<T>;
}

async function errorDetail(res: Response): Promise<string> {
  let detail = `${res.status} ${res.statusText}`;
  try {
    const j = await res.json();
    if (j?.detail) detail = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
  } catch {
    /* respons bukan JSON */
  }
  return detail;
}

const ref = (p: ScenarioParams) => ({ seed: p.seed, n_assets: p.n_assets, cloud_cover: p.cloud_cover });

export const api = {
  meta: () => call<Meta>("meta"),
  scenario: (p: ScenarioParams, policy: Policy, droneIds: string[] = [], video: VideoOverride[] = [], signal?: AbortSignal) =>
    call<Scenario>("scenario", { ...ref(p), policy, drone_ids: droneIds, video }, signal),
  sdsi: (
    body: { asset_type: string; d_vol: number; d_surf: number; d_water: number; sum_insured: number; mmi: number; policy: Policy },
    signal?: AbortSignal,
  ) => call<CalcResult>("sdsi", body, signal),
  issue: (asset: Asset, lang: Lang) => call<Certificate>(`certificates?lang=${lang}`, asset),
  verify: (cert: Certificate) => call<VerifyResult>("certificates/verify", cert),

  mission: (p: ScenarioParams, maxTargets: number, signal?: AbortSignal) =>
    call<Mission>("drone/mission", { ...ref(p), max_targets: maxTargets }, signal),
  scan: (p: ScenarioParams, assetId: string, signal?: AbortSignal) =>
    call<ScanResult>("drone/scan", { ...ref(p), asset_id: assetId }, signal),
  ask: (p: ScenarioParams, assetId: string, lang: Lang) => call<VlmAnswer>(`drone/ask?lang=${lang}`, { ...ref(p), asset_id: assetId }),
  uploadStatus: (jobId: string) => call<UploadJob>(`drone/uploads/${jobId}`),

  /** Unggah video dengan progres (fetch belum bisa melaporkan progres unggah). */
  upload: (file: File, assetId: string | null, useVlm: boolean, lang: Lang, onProgress: (f: number) => void) =>
    new Promise<UploadJob>((resolve, reject) => {
      const fd = new FormData();
      fd.append("file", file);
      if (assetId) fd.append("asset_id", assetId);
      fd.append("use_vlm", useVlm ? "true" : "false");
      fd.append("lang", lang);
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/drone/uploads");
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
      xhr.onload = () => {
        let j: { detail?: string } & Partial<UploadJob> = {};
        try { j = JSON.parse(xhr.responseText); } catch { /* bukan JSON */ }
        if (xhr.status >= 200 && xhr.status < 300) resolve(j as UploadJob);
        else reject(new ApiError(xhr.status, j.detail ?? `${xhr.status} ${xhr.statusText}`));
      };
      xhr.onerror = () => reject(new ApiError(0, "network"));
      xhr.send(fd);
    }),
};

export const viewUrl = (key: string, id: string, kind: ViewKind) =>
  `/api/drone/view/${encodeURIComponent(key)}/${encodeURIComponent(id)}/${kind}.jpg`;
export const frameUrl = (jobId: string, i: number, kind: "ai" | "raw") => `/api/drone/uploads/${jobId}/frames/${i}.jpg?kind=${kind}`;
