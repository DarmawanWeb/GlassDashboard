"use client";

import { useEffect, useRef, useState } from "react";
import type { Mission, ScanResult, ScenarioParams, ViewKind, VlmAnswer } from "@/lib/types";
import type { MissionPlayer, PlayerState } from "@/lib/mission";
import { api, viewUrl } from "@/lib/api";
import { DAMAGE_CLASS } from "@/lib/palette";
import { errorText, useI18n } from "@/lib/i18n";
import { Icon } from "../ui/controls";

type Tab = ViewKind | "swipe";
const TABS: Exclude<Tab, "pre">[] = ["rgb", "swipe", "lidar", "thermal", "ai"];
const TURBO = "linear-gradient(90deg,#30123b,#4169e1,#27acec,#1de4b4,#7efe55,#d5e629,#fda527,#e84a12,#7a0403)";
const IRONBOW = "linear-gradient(90deg,#060416,#28066a,#7c0a92,#ce2860,#f0681a,#fbba22,#fff8d6)";

export interface DroneFeedProps {
  mission: Mission | null;
  player: MissionPlayer | null;
  state: PlayerState | null;
  scans: Record<string, ScanResult>;
  order: string[];
  focusId: string | null;
  params: ScenarioParams;
  vlmEnabled: boolean;
  follow: boolean;
  onFollow: (v: boolean) => void;
  expanded: boolean;
  onExpand: (v: boolean) => void;
}

export default function DroneFeed(p: DroneFeedProps) {
  const { mission, player, state, scans, order, focusId, params, vlmEnabled, follow, onFollow, expanded, onExpand } = p;
  const { t, f, lang } = useI18n();
  const F = t.feed;
  const rootRef = useRef<HTMLDivElement>(null);
  const gpsRef = useRef<HTMLSpanElement>(null);
  const fmtRef = useRef(f);
  useEffect(() => { fmtRef.current = f; }, [f]);
  const [tab, setTab] = useState<Tab>("rgb");
  const [swipe, setSwipe] = useState(0.5);
  const [why, setWhy] = useState(false);
  const [ask, setAsk] = useState<{ id: string; busy: boolean; answer?: VlmAnswer; error?: unknown } | null>(null);

  const flying = !!state && !state.skipping && (state.status === "playing" || state.status === "paused")
    && (state.phase === "transit" || state.phase === "scan");
  const target = flying && mission ? mission.targets[state.idx] : null;
  const last = order.length ? order[order.length - 1] : null;
  const showId = flying ? (state.phase === "scan" ? target!.id : last) : (focusId && scans[focusId] ? focusId : last);
  const scan = showId ? scans[showId] : undefined;
  const scanning = flying && state.phase === "scan";
  const transit = flying && state.phase === "transit";
  const speed = state?.speed ?? 1;

  /* progres fase -> variabel CSS (tanpa render ulang tiap frame) */
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    el.style.setProperty("--p", flying ? "0" : "1");
    if (!player) return;
    return player.onPose((q) => {
      el.style.setProperty("--p", q.phase === "scan" ? q.progress.toFixed(3) : "1");
      if (gpsRef.current) gpsRef.current.textContent = `${fmtRef.current.coord(q.lat, "lat")}  ${fmtRef.current.coord(q.lon, "lon")}`;
    });
  }, [player, flying]);

  useEffect(() => { setAsk(null); }, [showId, lang]);

  if (!mission) return null;

  const tgt = target ?? (showId ? mission.targets.find((x) => x.id === showId) : undefined);
  const etaMin = tgt?.eta_min ?? 0;
  const batteryNo = Math.floor(etaMin / mission.stats.battery_min) + 1;
  const batteryPct = Math.round(100 - ((etaMin % mission.stats.battery_min) / mission.stats.battery_min) * 78);
  const imgKind: ViewKind = tab === "swipe" ? "rgb" : tab;
  const src = scan ? viewUrl(scan.key, scan.id, imgKind) : null;
  const e = scan?.estimate;
  const showBoxes = tab === "rgb" || tab === "ai" || tab === "swipe";

  const askAi = async () => {
    if (!scan) return;
    setAsk({ id: scan.id, busy: true });
    try {
      setAsk({ id: scan.id, busy: false, answer: await api.ask(params, scan.id, lang) });
    } catch (err) {
      setAsk({ id: scan.id, busy: false, error: err });
    }
  };

  return (
    <section ref={rootRef} className={`feed${expanded ? " feed-expanded" : ""}`} aria-label={F.region}>
      <header className="feed-head">
        <span className={`feed-live${flying && state.status === "playing" ? " on" : ""}`} aria-hidden="true" />
        <b className="feed-title">{F.title}</b>
        {showId && <span className="feed-id">{showId}{scan ? `, ${t.type[scan.type].toLowerCase()}` : ""}</span>}
        <div className="feed-tools">
          <label className="feed-follow"><input type="checkbox" checked={follow} onChange={(ev) => onFollow(ev.target.checked)} /> {F.follow}</label>
          <button type="button" className="feed-icon" onClick={() => onExpand(!expanded)} aria-label={expanded ? F.shrink : F.enlarge}>
            <Icon name="expand" size={16} />
          </button>
        </div>
      </header>

      <div className="feed-tabs" role="tablist" aria-label={F.tablist}>
        {TABS.map((x) => (
          <button key={x} type="button" role="tab" aria-selected={tab === x} className="feed-tab" onClick={() => setTab(x)}>{F.tabs[x]}</button>
        ))}
      </div>

      <div className="feed-view">
        {src ? (
          <div key={`${showId}-${scanning ? "scan" : "rest"}`} className={`feed-stage${scanning ? " feed-approach" : ""}${transit ? " feed-transit" : ""}`}
            style={{ animationDuration: `${1.2 / speed}s` }}>
            {tab === "swipe" && scan ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="feed-img" src={viewUrl(scan.key, scan.id, "pre")} alt={F.beforeAlt(scan.id)} />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="feed-img feed-img-top" src={src} alt="" style={{ clipPath: `inset(0 0 0 ${swipe * 100}%)` }} />
                <span className="feed-swipe-line" style={{ left: `${swipe * 100}%` }} aria-hidden="true" />
                <span className="feed-swipe-tag" style={{ left: 8 }}>{F.before}</span>
                <span className="feed-swipe-tag" style={{ right: 8 }}>{F.after}</span>
              </>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="feed-img" src={src} alt={F.viewAlt(F.sensorName[tab], showId ?? "")} />
            )}
            {scan && (
              <svg className="feed-svg" viewBox={`0 0 ${scan.image.w} ${scan.image.h}`} preserveAspectRatio="none" aria-hidden="true">
                {showBoxes && scan.detections.filter((d) => !d.target).map((d) => (
                  <polygon key={d.id} className="det" points={d.poly.map((q) => q.join(",")).join(" ")}
                    stroke={DAMAGE_CLASS[d.cls].color} fill={DAMAGE_CLASS[d.cls].color} />
                ))}
                {scan.detections.filter((d) => d.target).map((d) => (
                  <g key={d.id}>
                    <polygon className="det-target-halo" points={d.poly.map((q) => q.join(",")).join(" ")} />
                    <polygon className="det-target" points={d.poly.map((q) => q.join(",")).join(" ")} stroke={DAMAGE_CLASS[d.cls].color} />
                  </g>
                ))}
              </svg>
            )}
            {scan && (() => {
              const d = scan.detections.find((x) => x.target);
              if (!d) return null;
              const left = (Math.min(d.bbox[0], scan.image.w - 230) / scan.image.w) * 100;
              const top = (Math.max(d.bbox[1] - 46, 6) / scan.image.h) * 100;
              return (
                <div className="det-label" style={{ left: `${left}%`, top: `${top}%` }}>
                  <b>{d.id}</b>
                  <span className="det-chip" style={{ background: DAMAGE_CLASS[d.cls].color, color: DAMAGE_CLASS[d.cls].ink }}>
                    {t.damage[d.cls]}, {f.dec(d.pct, 0)}%
                  </span>
                </div>
              );
            })()}
            {scanning && <span className="feed-scanline" style={{ animationDuration: `${2.1 / speed}s` }} aria-hidden="true" />}
          </div>
        ) : (
          <div className="feed-empty">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/glass-drone.png" alt="" width={120} height={40} />
            <span>{flying ? F.emptyFlying : F.emptyIdle}</span>
          </div>
        )}

        {transit && target && <div className="feed-banner">{F.heading(target.id, f.dec(target.leg_km, 1), target.reason === "awan")}</div>}
        {scanning && !scan && <div className="feed-banner">{F.capturing}</div>}
        {state?.waiting && <div className="feed-banner">{F.waiting}</div>}

        <div className="hud hud-tl">
          <span>{F.altitude(mission.stats.altitude_m)}</span>
          <span>{transit ? `${mission.stats.speed_ms} m/s` : F.hovering}</span>
        </div>
        <div className="hud hud-tr">
          <span>{F.battery(batteryNo, mission.stats.batteries, Math.max(batteryPct, 18))}</span>
        </div>
        <div className="hud hud-bl"><span ref={gpsRef}>{tgt ? `${f.coord(tgt.lat, "lat")}  ${f.coord(tgt.lon, "lon")}` : ""}</span></div>
        <div className="hud hud-br"><span>{F.sensorName[tab]}</span></div>
        {tab === "swipe" && scan && (
          <input className="feed-swipe" type="range" min={0} max={1} step={0.01} value={swipe} aria-label={F.swipe}
            onChange={(ev) => setSwipe(Number(ev.target.value))} />
        )}
        {(tab === "lidar" || tab === "thermal") && scan && (
          <div className="feed-scale">
            <span>{tab === "lidar" ? `${f.dec(mission.camera.lidar_range[0], 1)} m` : `${mission.camera.thermal_range[0]} °C`}</span>
            <i style={{ background: tab === "lidar" ? TURBO : IRONBOW }} />
            <span>{tab === "lidar" ? `${mission.camera.lidar_range[1]} m` : `${mission.camera.thermal_range[1]} °C`}</span>
          </div>
        )}
      </div>

      {e && scan && (
        <div className="feed-foot">
          {scanning && <div className="feed-analyzing" aria-hidden="true">{F.analyzing}</div>}
          <div className="feed-metrics">
            <div><span>{t.droneSensor.rgb.label}</span><b>{f.pct(e.roof)}</b><small>{F.roof}</small></div>
            <div><span>LiDAR</span><b>{f.pct(e.vol)}</b><small>{F.vol}</small></div>
            <div><span>{F.tabs.thermal}</span><b>{f.pct(e.wet)}</b><small>{F.wet}</small></div>
            <div><span>SDSI</span><b>{f.dec(scan.sdsi_drone, 2)}</b><small>{F.satellite(f.dec(scan.sdsi_satellite, 2), !scan.observed_by_satellite)}</small></div>
          </div>
          <div className="feed-truth">
            <span className="det-chip" style={{ background: DAMAGE_CLASS[e.cls].color, color: DAMAGE_CLASS[e.cls].ink }}>{t.damage[e.cls]}</span>
            <span>
              {F.truth(t.damage[scan.truth.cls].toLowerCase(), f.pct(scan.truth.roof))}
              {scan.truth.cls === e.cls ? F.hit : F.miss}
            </span>
            <div className="feed-actions">
              <button type="button" className="btn btn-ghost feed-ask" aria-expanded={why} onClick={() => setWhy(!why)}>{F.why}</button>
              {vlmEnabled && (
                <button type="button" className="btn btn-ghost feed-ask" onClick={askAi} disabled={ask?.busy}>
                  {ask?.busy ? F.asking : F.ask}
                </button>
              )}
            </div>
          </div>
          {why && (
            <ul className="feed-why">
              <li><i style={{ background: "#ff5a4e" }} />{F.reasons.roof(f.pct(e.roof))}</li>
              <li><i style={{ background: "#7efe55" }} />{F.reasons.vol(f.pct(e.vol))}</li>
              <li><i style={{ background: "#4aa8ff" }} />{F.reasons.wet(f.pct(e.wet))}</li>
              <li><i style={{ background: "#c6d3e1" }} />{F.reasons.area(scan.area.n_buildings, scan.area.n_severe)}</li>
              <li><i style={{ background: "#c6d3e1" }} />{F.reasons.confidence(f.pct(e.confidence))}</li>
            </ul>
          )}
          {ask?.answer && (
            <div className="feed-vlm">
              <b>{ask.answer.model}:</b> {ask.answer.summary || F.noSummary}{" "}
              <span className="tiny">{F.vlmEstimate(t.damage[ask.answer.cls].toLowerCase(), ask.answer.damage_pct, f.dec(ask.answer.ms / 1000, 1))}</span>
            </div>
          )}
          {ask?.error !== undefined && <div className="feed-vlm feed-vlm-err">{errorText(t, ask.error)}</div>}
        </div>
      )}
    </section>
  );
}
