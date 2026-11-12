import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";
const KEY = "glass-theme";
const listeners = new Set<() => void>();

/** Tema yang sedang tampil, dibaca dari atribut yang dipasang skrip awal di <head>. */
function current(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  listeners.forEach((f) => f());
}

function stored(): string | null {
  try { return window.localStorage.getItem(KEY); } catch { return null; }
}

let watching = false;
function subscribe(f: () => void) {
  listeners.add(f);
  if (!watching && typeof window !== "undefined") {
    watching = true;
    // Tanpa pilihan tersimpan, tema mengikuti pengaturan sistem, termasuk saat berubah.
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
      if (!stored() && !new URLSearchParams(window.location.search).get("theme")) apply(e.matches ? "dark" : "light");
    });
  }
  return () => { listeners.delete(f); };
}

export function setTheme(theme: Theme) {
  try { window.localStorage.setItem(KEY, theme); } catch { /* penyimpanan diblokir */ }
  apply(theme);
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, current, () => "light");
}
