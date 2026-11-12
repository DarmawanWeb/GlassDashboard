import type { Mission, ScanResult } from "./types";

/** Pemutar misi drone: menggerakkan drone sepanjang rute, memicu pindaian tiap aset, dan melapor ke UI.
 *  Posisi (tiap frame) dikirim lewat onPose agar peta bisa diperbarui tanpa render ulang React. */

export type Phase = "idle" | "transit" | "scan" | "return" | "done";
export type Status = "idle" | "playing" | "paused" | "done";

export interface PlayerState {
  status: Status;
  phase: Phase;
  idx: number;        // indeks target yang sedang dituju/dipindai
  scanned: number;    // jumlah target selesai
  speed: number;
  waiting: boolean;   // menunggu hasil analisis dari server
  skipping: boolean;
}

export interface Pose {
  lon: number;
  lat: number;
  heading: number;    // derajat, 0 = utara
  phase: Phase;
  idx: number;
  progress: number;   // 0..1 dalam fase ini
}

const SCAN_S = 2.3;
const transitSeconds = (km: number) => Math.min(3.0, Math.max(1.0, 0.8 + 0.75 * km));

function bearing(a: [number, number], b: [number, number]) {
  const k = Math.cos((a[1] * Math.PI) / 180);
  return ((Math.atan2((b[0] - a[0]) * k, b[1] - a[1]) * 180) / Math.PI + 360) % 360;
}
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export class MissionPlayer {
  private st: PlayerState;
  private listeners = new Set<() => void>();
  private poseListeners = new Set<(p: Pose) => void>();
  private raf = 0;
  private last = 0;
  private t = 0;
  private pending = new Map<number, Promise<ScanResult | null>>();
  private ready = new Map<number, ScanResult | null>();
  private pts: [number, number][];
  private alive = true;

  constructor(
    private mission: Mission,
    private requestScan: (id: string) => Promise<ScanResult | null>,
    private onScanned: (r: ScanResult) => void,
    speed = 2,
    private onFetched?: (r: ScanResult) => void,
  ) {
    this.pts = mission.targets.map((t) => [t.lon, t.lat]);
    this.st = { status: "idle", phase: "idle", idx: -1, scanned: 0, speed, waiting: false, skipping: false };
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  };
  getSnapshot = () => this.st;
  onPose(fn: (p: Pose) => void) {
    this.poseListeners.add(fn);
    return () => { this.poseListeners.delete(fn); };
  }

  private set(patch: Partial<PlayerState>) {
    this.st = { ...this.st, ...patch };
    this.listeners.forEach((f) => f());
  }

  private base(): [number, number] {
    return [this.mission.base.lon, this.mission.base.lat];
  }

  private fetch(i: number) {
    if (i < 0 || i >= this.pts.length || this.pending.has(i)) return;
    const p = this.requestScan(this.mission.targets[i].id).catch(() => null);
    this.pending.set(i, p);
    p.then((r) => {
      if (!this.alive) return;
      this.ready.set(i, r);
      if (r) this.onFetched?.(r);
    });
  }

  play() {
    if (!this.alive || this.st.status === "done" || this.st.skipping) return;
    if (this.st.phase === "idle") {
      this.fetch(0);
      this.fetch(1);
      this.t = 0;
      this.set({ status: "playing", phase: this.pts.length ? "transit" : "done", idx: 0 });
    } else {
      this.set({ status: "playing" });
    }
    this.last = performance.now();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.frame);
  }

  pause() {
    if (this.st.status !== "playing") return;
    cancelAnimationFrame(this.raf);
    this.set({ status: "paused" });
  }

  setSpeed(speed: number) {
    this.set({ speed });
  }

  /** Lewati animasi: pindai semua sisa target (2 sekaligus), lalu selesai. */
  async skip() {
    if (this.st.status === "done" || this.st.skipping) return;
    cancelAnimationFrame(this.raf);
    this.set({ skipping: true, status: "playing", waiting: false });
    const start = Math.max(this.st.idx, 0) + (this.st.phase === "return" ? 1 : 0);
    let next = start;
    const worker = async () => {
      while (this.alive && next < this.pts.length) {
        const i = next++;
        this.fetch(i);
        const r = await this.pending.get(i);
        if (!this.alive) return;
        if (r) this.onScanned(r);
        this.set({ scanned: this.st.scanned + 1, idx: i });
      }
    };
    await Promise.all([worker(), worker()]);
    if (!this.alive) return;
    this.set({ status: "done", phase: "done", skipping: false, idx: this.pts.length - 1 });
    const b = this.base();
    this.poseListeners.forEach((f) => f({ lon: b[0], lat: b[1], heading: 0, phase: "done", idx: this.pts.length - 1, progress: 1 }));
  }

  destroy() {
    this.alive = false;
    cancelAnimationFrame(this.raf);
    this.listeners.clear();
    this.poseListeners.clear();
  }

  private frame = (now: number) => {
    if (!this.alive || this.st.status !== "playing") return;
    const dt = Math.min(0.1, (now - this.last) / 1000) * this.st.speed;
    this.last = now;
    this.t += dt;
    const { phase, idx } = this.st;
    const n = this.pts.length;

    if (phase === "transit" || phase === "return") {
      const from = phase === "return" ? this.pts[n - 1] : idx === 0 ? this.base() : this.pts[idx - 1];
      const to = phase === "return" ? this.base() : this.pts[idx];
      const km = phase === "return" ? 1.5 : this.mission.targets[idx].leg_km;
      const dur = transitSeconds(km);
      const q = Math.min(1, this.t / dur);
      const e = ease(q);
      this.emit({ lon: from[0] + (to[0] - from[0]) * e, lat: from[1] + (to[1] - from[1]) * e, heading: bearing(from, to), phase, idx, progress: q });
      if (q >= 1) {
        this.t = 0;
        if (phase === "return") {
          this.set({ status: "done", phase: "done" });
          return;
        }
        this.set({ phase: "scan" });
        this.fetch(idx + 1);
      }
    } else if (phase === "scan") {
      const p = this.pts[idx];
      const wob = Math.sin(now / 380) * 0.000012;
      this.emit({ lon: p[0] + wob, lat: p[1] + wob * 0.6, heading: 0, phase, idx, progress: Math.min(1, this.t / SCAN_S) });
      if (this.t >= SCAN_S) {
        if (!this.ready.has(idx)) {
          if (!this.st.waiting) this.set({ waiting: true });
        } else {
          const r = this.ready.get(idx);
          if (r) this.onScanned(r);
          this.t = 0;
          const last = idx >= n - 1;
          this.set({ waiting: false, scanned: this.st.scanned + 1, phase: last ? "return" : "transit", idx: last ? idx : idx + 1 });
          if (!last) this.fetch(idx + 2);
        }
      }
    }
    this.raf = requestAnimationFrame(this.frame);
  };

  private emit(p: Pose) {
    this.poseListeners.forEach((f) => f(p));
  }
}
