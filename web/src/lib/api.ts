import type { Asset, CalcResult, Certificate, Meta, Policy, Scenario, ScenarioParams, VerifyResult } from "./types";

async function call<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`/api/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    signal,
  });
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const j = await res.json();
      if (j?.detail) detail = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
    } catch {
      /* respons bukan JSON */
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export const api = {
  meta: () => call<Meta>("meta"),
  scenario: (p: ScenarioParams, policy: Policy, signal?: AbortSignal) =>
    call<Scenario>("scenario", { ...p, policy }, signal),
  sdsi: (
    body: { asset_type: string; d_vol: number; d_surf: number; d_water: number; sum_insured: number; mmi: number; policy: Policy },
    signal?: AbortSignal,
  ) => call<CalcResult>("sdsi", body, signal),
  issue: (asset: Asset) => call<Certificate>("certificates", asset),
  verify: (cert: Certificate) => call<VerifyResult>("certificates/verify", cert),
};
