"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type {
  Basemap, Meta, Mission, Policy, ScanResult, Scenario, ScenarioParams, Sensor, StepId, VideoOverride, ViewKind,
} from "@/lib/types";
import { api, viewUrl } from "@/lib/api";
import { MissionPlayer, type PlayerState } from "@/lib/mission";
import { LANGS, errorText, setLang, useI18n } from "@/lib/i18n";
import { setTheme, useTheme } from "@/lib/theme";
import AssetCard from "./AssetCard";
import AboutDialog from "./AboutDialog";
import DroneFeed from "./drone/DroneFeed";
import { Icon } from "./ui/controls";
import { StepBayar, StepHitung, StepLihat, StepNilai } from "./steps/Steps";
import StepPindai from "./steps/StepPindai";

function MapLoading() {
  const { t } = useI18n();
  return <div className="sheet-frame"><div className="boot">{t.app.loadingMap}</div></div>;
}

const GlassMap = dynamic(() => import("./map/GlassMap"), { ssr: false, loading: () => <MapLoading /> });

const STEPS: StepId[] = ["lihat", "pindai", "nilai", "hitung", "bayar"];
const VIEW_KINDS: ViewKind[] = ["rgb", "ai", "pre", "lidar", "thermal"];
const noSub = () => () => {};
const noSnap = (): PlayerState | null => null;

function readHash(): StepId {
  if (typeof window === "undefined") return "lihat";
  const h = window.location.hash.replace("#", "") as StepId;
  return STEPS.includes(h) ? h : "lihat";
}

export default function Dashboard() {
  const { t, lang } = useI18n();
  const theme = useTheme();
  const [meta, setMeta] = useState<Meta | null>(null);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [baseScenario, setBaseScenario] = useState<Scenario | null>(null);
  const [error, setError] = useState<unknown>(null);
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

  /* drone */
  const [mission, setMission] = useState<Mission | null>(null);
  const [missionError, setMissionError] = useState<unknown>(null);
  const [maxTargets, setMaxTargets] = useState(46);
  const [scans, setScans] = useState<Record<string, ScanResult>>({});
  const [fetched, setFetched] = useState<Record<string, ScanResult>>({});   // sudah dianalisis, belum "dipindai" di animasi
  const [order, setOrder] = useState<string[]>([]);
  const [player, setPlayer] = useState<MissionPlayer | null>(null);
  const [useDrone, setUseDrone] = useState(true);
  const [video, setVideo] = useState<VideoOverride[]>([]);
  const [follow, setFollow] = useState(false);
  const [feedBig, setFeedBig] = useState(false);
  const pstate = useSyncExternalStore(player ? player.subscribe : noSub, player ? player.getSnapshot : noSnap, noSnap);

  const setStep = useCallback((s: StepId) => {
    setStepState(s);
    if (typeof window !== "undefined") history.replaceState(null, "", `${window.location.search}#${s}`);
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
      .catch((e: Error) => setError(e));
  }, []);

  /* hasil drone & video yang dipakai di perhitungan */
  const droneIds = useMemo(() => (useDrone ? order : []), [useDrone, order]);
  const videoUsed = useMemo(() => (useDrone ? video : []), [useDrone, video]);
  const droneKey = `${droneIds.join(",")}|${videoUsed.map((v) => `${v.id}:${v.job_id}`).join(",")}`;
  const hasDrone = droneIds.length + videoUsed.length > 0;

  useEffect(() => {
    if (!meta) return;
    const ctl = new AbortController();
    setLoading(true);
    const timer = setTimeout(() => {
      api.scenario(params, policy, droneIds, videoUsed, ctl.signal)
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
          setError(e);
          setLoading(false);
        });
    }, 140);
    return () => { clearTimeout(timer); ctl.abort(); };
    // droneKey mewakili isi droneIds & videoUsed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta, params, policy, droneKey]);

  /* skenario tanpa drone, untuk perbandingan sebelum/sesudah */
  useEffect(() => {
    if (!meta || !hasDrone) { setBaseScenario(null); return; }
    const ctl = new AbortController();
    api.scenario(params, policy, [], [], ctl.signal).then(setBaseScenario).catch(() => {});
    return () => ctl.abort();
  }, [meta, params, policy, hasDrone]);

  /* skenario baru -> misi & hasil drone diulang dari awal */
  const resetDrone = useCallback(() => {
    setPlayer((pl) => { pl?.destroy(); return null; });
    setScans({});
    setFetched({});
    setOrder([]);
    setVideo([]);
  }, []);
  useEffect(() => { resetDrone(); }, [params.seed, params.n_assets, params.cloud_cover, resetDrone]);

  /* rencana misi */
  useEffect(() => {
    if (!meta) return;
    const ctl = new AbortController();
    const timer = setTimeout(() => {
      api.mission(params, maxTargets, ctl.signal)
        .then((m) => { setMission(m); setMissionError(null); })
        .catch((e: Error) => { if (e.name !== "AbortError") setMissionError(e); });
    }, 200);
    return () => { clearTimeout(timer); ctl.abort(); };
  }, [meta, params, maxTargets]);

  /* rute berubah saat drone diam -> pemutar lama dibuang (hasil pindaian tetap) */
  useEffect(() => {
    setPlayer((pl) => { pl?.destroy(); return null; });
  }, [mission]);

  useEffect(() => () => player?.destroy(), [player]);

  const requestScan = useCallback(async (id: string) => {
    const r = await api.scan(params, id);
    for (const k of VIEW_KINDS) { const im = new Image(); im.src = viewUrl(r.key, r.id, k); }
    return r;
  }, [params]);

  const onScanned = useCallback((r: ScanResult) => {
    setScans((s) => (s[r.id] ? s : { ...s, [r.id]: r }));
    setOrder((o) => (o.includes(r.id) ? o : [...o, r.id]));
  }, []);
  const onFetched = useCallback((r: ScanResult) => setFetched((s) => (s[r.id] ? s : { ...s, [r.id]: r })), []);
  const known = useMemo(() => ({ ...fetched, ...scans }), [fetched, scans]);

  const startMission = useCallback(() => {
    if (!mission) return;
    const pl = new MissionPlayer(mission, requestScan, onScanned, pstate?.speed ?? 2, onFetched);
    setPlayer((old) => { old?.destroy(); return pl; });
    setSelectedId(null);
    pl.play();
  }, [mission, requestScan, onScanned, onFetched, pstate?.speed]);

  const resetMission = useCallback(() => {
    setPlayer((pl) => { pl?.destroy(); return null; });
    setScans({});
    setFetched({});
    setOrder([]);
  }, []);

  const togglePlay = useCallback(() => {
    if (!pstate || pstate.status === "idle") startMission();
    else if (pstate.status === "playing") player?.pause();
    else if (pstate.status === "paused") player?.play();
  }, [pstate, player, startMission]);

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

  const toggleTheme = useCallback(() => setTheme(theme === "dark" ? "light" : "dark"), [theme]);
  const toggleLang = useCallback(() => setLang(lang === "id" ? "en" : "id"), [lang]);

  /* pintasan presentasi */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.metaKey || e.ctrlKey || e.altKey || about) return;
      const i = STEPS.indexOf(step);
      const k = e.key.toLowerCase();
      if (e.key === "ArrowRight" && i < STEPS.length - 1) setStep(STEPS[i + 1]);
      else if (e.key === "ArrowLeft" && i > 0) setStep(STEPS[i - 1]);
      else if (["1", "2", "3", "4", "5"].includes(e.key)) setStep(STEPS[Number(e.key) - 1]);
      else if (e.key === " " && step === "pindai") togglePlay();
      else if (k === "s") newScenario();
      else if (k === "f") fullscreen();
      else if (k === "l") toggleLang();
      else if (k === "t") toggleTheme();
      else if (e.key === "Escape") { setSelectedId(null); setFeedBig(false); }
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, about, setStep, newScenario, fullscreen, togglePlay, toggleLang, toggleTheme]);

  const stepIndex = STEPS.indexOf(step);

  return (
    <div className="app">
      <header className="topbar">
        {loading && <div className="loading-line" aria-hidden="true" />}
        <div className="brand">
          <h1 className="wordmark">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="logo-light" src="/brand/glass-logo.png" alt="GLASS" width={123} height={52} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="logo-dark" src="/brand/glass-logo-reverse.png" alt="GLASS" width={123} height={52} />
          </h1>
          <span className="tagline">{t.app.tagline}</span>
        </div>
        <nav className="steps-nav" aria-label={t.app.stepsNav}>
          <ol className="steps">
            {STEPS.map((s, i) => (
              <li className={`step-item${i < stepIndex ? " step-done" : ""}`} key={s}>
                {i > 0 && <span className="step-link" aria-hidden="true" />}
                <button type="button" className="step-btn" aria-current={step === s ? "step" : undefined} onClick={() => setStep(s)}>
                  <span className="step-num">{i + 1}</span>{t.app.steps[s]}
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <div className="topbar-actions">
          <button type="button" className="btn btn-primary" onClick={newScenario} disabled={!meta} title={t.app.newScenarioHint} aria-label={t.app.newScenario}>
            <Icon name="refresh" /> <span className="btn-text">{t.app.newScenario}</span>
          </button>
          <div className="lang-switch" role="group" aria-label={t.app.language} title={t.app.language}>
            {LANGS.map((l) => (
              <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)} lang={l}>{l.toUpperCase()}</button>
            ))}
          </div>
          <button type="button" className="btn btn-ghost btn-icon" onClick={toggleTheme}
            aria-label={theme === "dark" ? t.app.toLight : t.app.toDark} title={theme === "dark" ? t.app.toLight : t.app.toDark}>
            <Icon name={theme === "dark" ? "sun" : "moon"} />
          </button>
          <button type="button" className="btn btn-ghost btn-icon" onClick={() => setAbout(true)} aria-label={t.app.about} title={t.app.about}><Icon name="info" /></button>
          <button type="button" className="btn btn-ghost btn-icon" onClick={fullscreen} aria-label={t.app.fullscreen} title={t.app.fullscreen}><Icon name="expand" /></button>
        </div>
      </header>

      <main className="main">
        <section className="stage" aria-label={t.app.mapRegion}>
          {meta ? (
            <GlassMap meta={meta} scenario={scenario} step={step} sensor={sensor} basemap={basemap} onBasemap={setBasemap}
              selectedId={selectedId} onSelect={setSelectedId} sweepKey={sweepKey} policy={policy}
              mission={mission} scans={scans} player={player} playerState={pstate} follow={follow}>
              {step === "pindai" && (
                <DroneFeed mission={mission} player={player} state={pstate} scans={known} order={order} focusId={selectedId}
                  params={params} vlmEnabled={meta.drone.vlm.enabled} follow={follow} onFollow={setFollow}
                  expanded={feedBig} onExpand={setFeedBig} />
              )}
            </GlassMap>
          ) : (
            <div className="sheet-frame">
              <div className="boot">
                {error !== null ? (
                  <div className="error-box">
                    <b>{t.app.engineDown}</b>
                    <p className="small">{errorText(t, error)}</p>
                    <button type="button" className="btn" onClick={() => location.reload()}>{t.app.reload}</button>
                  </div>
                ) : t.app.connecting}
              </div>
            </div>
          )}
        </section>

        <aside className="panel" ref={panelRef} aria-label={t.app.panelRegion}>
          <div className="panel-inner">
            {error !== null && meta && <div className="note note-bad small">{t.app.calcFailed(errorText(t, error))}</div>}
            {selected && meta && step !== "lihat" && step !== "pindai" && <AssetCard asset={selected} meta={meta} onClose={() => setSelectedId(null)} />}
            {meta && scenario ? (
              <>
                {step === "lihat" && (
                  <StepLihat scenario={scenario} sensor={sensor} onSensor={setSensor} cloud={params.cloud_cover}
                    onCloud={(v) => setParams((p) => ({ ...p, cloud_cover: v }))} />
                )}
                {step === "pindai" && (
                  <StepPindai meta={meta} scenario={scenario} baseScenario={baseScenario} mission={mission}
                    missionError={missionError} state={pstate} scans={scans} order={order}
                    maxTargets={maxTargets} onMaxTargets={setMaxTargets}
                    onStart={startMission} onPause={() => player?.pause()} onResume={() => player?.play()}
                    onSpeed={(s) => player?.setSpeed(s)} onSkip={() => { void player?.skip(); }} onReset={resetMission}
                    useDrone={useDrone} onUseDrone={setUseDrone} selectedId={selectedId} onSelect={setSelectedId}
                    video={video} onApplyVideo={(v) => setVideo((xs) => [...xs.filter((x) => x.id !== v.id), v])}
                    onRemoveVideo={(id) => setVideo((xs) => xs.filter((x) => x.id !== id))} />
                )}
                {step === "nilai" && <StepNilai meta={meta} scenario={scenario} policy={policy} selected={selected} />}
                {step === "hitung" && <StepHitung scenario={scenario} />}
                {step === "bayar" && <StepBayar scenario={scenario} policy={policy} onPolicy={setPolicy} selected={selected} onPickLargest={pickLargest} />}
                {selected && step === "lihat" && <AssetCard asset={selected} meta={meta} onClose={() => setSelectedId(null)} />}
              </>
            ) : (
              error === null && <div className="muted">{t.app.computing}</div>
            )}
            <div className="tiny" style={{ marginTop: 8 }}>
              {t.app.sampleNote} <button type="button" className="btn-link" onClick={() => setAbout(true)}>{t.app.seeSources}</button>
            </div>
          </div>
        </aside>
      </main>

      <AboutDialog open={about} onClose={() => setAbout(false)} dataMode={meta?.data_mode ?? "contoh"} vlm={meta?.drone.vlm ?? null} />
    </div>
  );
}
