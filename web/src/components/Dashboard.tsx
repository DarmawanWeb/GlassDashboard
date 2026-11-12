"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Basemap, Meta, Policy, Scenario, ScenarioParams, Sensor, StepId } from "@/lib/types";
import { api } from "@/lib/api";
import AssetCard from "./AssetCard";
import AboutDialog from "./AboutDialog";
import { Icon } from "./ui/controls";
import { StepBayar, StepHitung, StepLihat, StepNilai } from "./steps/Steps";

const GlassMap = dynamic(() => import("./map/GlassMap"), {
  ssr: false,
  loading: () => <div className="sheet-frame"><div className="boot">Memuat peta…</div></div>,
});

const STEPS: { id: StepId; label: string }[] = [
  { id: "lihat", label: "Lihat" },
  { id: "nilai", label: "Nilai" },
  { id: "hitung", label: "Hitung" },
  { id: "bayar", label: "Bayar" },
];

function readHash(): StepId {
  if (typeof window === "undefined") return "lihat";
  const h = window.location.hash.replace("#", "");
  return (STEPS.find((s) => s.id === h)?.id ?? "lihat") as StepId;
}

export default function Dashboard() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [step, setStepState] = useState<StepId>("lihat");
  const [sensor, setSensor] = useState<Sensor>("d_surf");
  const [basemap, setBasemap] = useState<Basemap>("s2");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [params, setParams] = useState<ScenarioParams>({ seed: 2018, n_assets: 320, cloud_cover: 0.12 });
  const [policy, setPolicy] = useState<Policy>({ deductible_rate: 0.01, advance_rate: 0.1, mmi_trigger: 8.0 });
  const [sweepKey, setSweepKey] = useState(0);
  const [about, setAbout] = useState(false);
  const sweptSeed = useRef<number | null>(null);
  const panelRef = useRef<HTMLElement>(null);

  const setStep = useCallback((s: StepId) => {
    setStepState(s);
    if (typeof window !== "undefined") history.replaceState(null, "", `#${s}`);
  }, []);

  useEffect(() => { setStepState(readHash()); }, []);

  /* panel selalu mulai dari atas saat pindah langkah */
  useEffect(() => { panelRef.current?.scrollTo({ top: 0 }); }, [step]);

  useEffect(() => {
    api.meta()
      .then((m) => {
        setMeta(m);
        setParams((p) => ({ ...p, ...m.defaults.scenario }));
        setPolicy(m.defaults.policy);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!meta) return;
    const ctl = new AbortController();
    setLoading(true);
    const t = setTimeout(() => {
      api.scenario(params, policy, ctl.signal)
        .then((s) => {
          setScenario(s);
          setError(null);
          setLoading(false);
          if (sweptSeed.current !== s.params.scenario.seed) {
            sweptSeed.current = s.params.scenario.seed;
            setSweepKey((k) => k + 1);
          }
        })
        .catch((e: Error) => {
          if (e.name === "AbortError") return;
          setError(e.message);
          setLoading(false);
        });
    }, 140);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [meta, params, policy]);

  const selected = useMemo(() => scenario?.assets.find((a) => a.id === selectedId) ?? null, [scenario, selectedId]);

  const newScenario = useCallback(() => {
    setSelectedId(null);
    setParams((p) => ({ ...p, seed: Math.floor(Math.random() * 900000) + 1000 }));
  }, []);

  const pickLargest = useCallback(() => {
    if (!scenario) return;
    const a = [...scenario.assets].filter((x) => x.observed).sort((x, y) => y.claim - x.claim)[0];
    if (a) setSelectedId(a.id);
  }, [scenario]);

  const fullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.();
  }, []);

  /* pintasan presentasi */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || e.metaKey || e.ctrlKey || e.altKey || about) return;
      const i = STEPS.findIndex((s) => s.id === step);
      if (e.key === "ArrowRight" && i < 3) setStep(STEPS[i + 1].id);
      else if (e.key === "ArrowLeft" && i > 0) setStep(STEPS[i - 1].id);
      else if (["1", "2", "3", "4"].includes(e.key)) setStep(STEPS[Number(e.key) - 1].id);
      else if (e.key.toLowerCase() === "s") newScenario();
      else if (e.key.toLowerCase() === "f") fullscreen();
      else if (e.key === "Escape") setSelectedId(null);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, about, setStep, newScenario, fullscreen]);

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <div className="app">
      <header className="topbar">
        {loading && <div className="loading-line" aria-hidden="true" />}
        <div className="brand">
          <h1 className="wordmark">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/glass-logo.png" alt="GLASS" width={123} height={52} />
          </h1>
          <span className="tagline">Menilai kerusakan bencana dari satelit dan drone</span>
        </div>
        <nav className="steps-nav" aria-label="Langkah GLASS">
          <ol className="steps">
            {STEPS.map((s, i) => (
              <li className={`step-item${i < stepIndex ? " step-done" : ""}`} key={s.id}>
                {i > 0 && <span className="step-link" aria-hidden="true" />}
                <button type="button" className="step-btn" aria-current={step === s.id ? "step" : undefined} onClick={() => setStep(s.id)}>
                  <span className="step-num">{i + 1}</span>{s.label}
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <div className="topbar-actions">
          <button type="button" className="btn btn-primary" onClick={newScenario} disabled={!meta} title="Acak ulang lokasi aset dan kerusakan (S)">
            <Icon name="refresh" /> Skenario baru
          </button>
          <button type="button" className="btn btn-ghost btn-icon" onClick={() => setAbout(true)} aria-label="Tentang data dan sumber"><Icon name="info" /></button>
          <button type="button" className="btn btn-ghost btn-icon" onClick={fullscreen} aria-label="Layar penuh (F)"><Icon name="expand" /></button>
        </div>
      </header>

      <main className="main">
        <section className="stage" aria-label="Peta">
          {meta ? (
            <GlassMap meta={meta} scenario={scenario} step={step} sensor={sensor} basemap={basemap} onBasemap={setBasemap}
              selectedId={selectedId} onSelect={setSelectedId} sweepKey={sweepKey} policy={policy} />
          ) : (
            <div className="sheet-frame">
              <div className="boot">
                {error ? (
                  <div className="error-box">
                    <b>Mesin GLASS belum bisa dihubungi.</b>
                    <p className="small">{error}</p>
                    <button type="button" className="btn" onClick={() => location.reload()}>Muat ulang</button>
                  </div>
                ) : "Menghubungkan ke mesin GLASS…"}
              </div>
            </div>
          )}
        </section>

        <aside className="panel" ref={panelRef} aria-label="Penjelasan langkah">
          <div className="panel-inner">
            {error && meta && <div className="note note-bad small">Perhitungan gagal: {error}</div>}
            {selected && meta && step !== "lihat" && <AssetCard asset={selected} meta={meta} onClose={() => setSelectedId(null)} />}
            {meta && scenario ? (
              <>
                {step === "lihat" && (
                  <StepLihat scenario={scenario} sensor={sensor} onSensor={setSensor} cloud={params.cloud_cover}
                    onCloud={(v) => setParams((p) => ({ ...p, cloud_cover: v }))} />
                )}
                {step === "nilai" && <StepNilai meta={meta} scenario={scenario} policy={policy} selected={selected} />}
                {step === "hitung" && <StepHitung scenario={scenario} />}
                {step === "bayar" && <StepBayar scenario={scenario} policy={policy} onPolicy={setPolicy} selected={selected} onPickLargest={pickLargest} />}
                {selected && step === "lihat" && <AssetCard asset={selected} meta={meta} onClose={() => setSelectedId(null)} />}
              </>
            ) : (
              !error && <div className="muted">Menghitung skenario…</div>
            )}
            <div className="tiny" style={{ marginTop: 8 }}>
              Data contoh untuk demonstrasi. <button type="button" className="btn-ghost" style={{ border: 0, background: "none", padding: 0, color: "var(--orbit-ink)", cursor: "pointer", textDecoration: "underline" }} onClick={() => setAbout(true)}>Lihat sumber data</button>
            </div>
          </div>
        </aside>
      </main>

      <AboutDialog open={about} onClose={() => setAbout(false)} dataMode={meta?.data_mode ?? "contoh"} />
    </div>
  );
}
