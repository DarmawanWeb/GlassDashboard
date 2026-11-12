"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import type { Lang } from "../types";
import { makeFormat, type Fmt } from "../format";
import { id, type Dict } from "./id";
import { en } from "./en";

export type { Dict };
export const LANGS: Lang[] = ["id", "en"];
const DICTS: Record<Lang, Dict> = { id, en };
const KEY = "glass-lang";

/* Bahasa disimpan di luar React agar bisa dibaca sebelum hidrasi selesai.
   Urutan: ?lang= di URL, pilihan tersimpan, lalu bahasa Indonesia (penonton utama). */
let current: Lang | null = null;
const listeners = new Set<() => void>();

function read(): Lang {
  if (current) return current;
  let v: string | null = null;
  try { v = new URLSearchParams(window.location.search).get("lang"); } catch { /* tanpa URL */ }
  if (v !== "id" && v !== "en") {
    try { v = window.localStorage.getItem(KEY); } catch { /* penyimpanan diblokir */ }
  }
  current = v === "en" ? "en" : "id";
  return current;
}

export function setLang(lang: Lang) {
  current = lang;
  try { window.localStorage.setItem(KEY, lang); } catch { /* penyimpanan diblokir */ }
  listeners.forEach((f) => f());
}

const subscribe = (f: () => void) => {
  listeners.add(f);
  return () => { listeners.delete(f); };
};

interface I18n { lang: Lang; t: Dict; f: Fmt }
const Ctx = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const lang = useSyncExternalStore(subscribe, read, () => "id" as Lang);
  const value = useMemo<I18n>(() => ({ lang, t: DICTS[lang], f: makeFormat(lang) }), [lang]);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = DICTS[lang].meta.title;
  }, [lang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const v = useContext(Ctx);
  if (!v) throw new Error("useI18n harus dipakai di dalam I18nProvider");
  return v;
}

/** Pesan galat yang ramah: pakai teks per kode status, sisanya teks asli dari server. */
export function errorText(t: Dict, e: unknown): string {
  const err = e as { status?: number; message?: string };
  if (err?.status === 0) return t.errors.network;
  const known = err?.status ? t.errors[String(err.status)] : undefined;
  if (known && err.status === 502 && err.message) return `${known} (${err.message})`;
  return known ?? err?.message ?? String(e);
}
