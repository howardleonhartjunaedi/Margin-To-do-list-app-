"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { MotionLevel } from "@/design/motion";

export type ThemePref = "system" | "light" | "dark";
/** "system" follows the OS "increase contrast" setting. */
export type ContrastPref = "system" | "standard" | "high";
export type AccentPref = "fern" | "vermilion" | "plum" | "ink";
export const ACCENTS: AccentPref[] = ["fern", "vermilion", "plum", "ink"];

export interface Preferences {
  theme: ThemePref;
  contrast: ContrastPref;
  accent: AccentPref;
  /** What the user picked. The effective level is also clamped by the OS setting. */
  motion: MotionLevel;
  cursor: boolean;
  celebrate: boolean;
}

const DEFAULTS: Preferences = { theme: "system", contrast: "system", accent: "fern", motion: "full", cursor: true, celebrate: true };
const KEY = "margin:prefs";

interface Ctx {
  prefs: Preferences;
  set: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  /** Resolved values the UI should actually use. */
  resolvedTheme: "light" | "dark";
  highContrast: boolean;
  motion: MotionLevel;
  osReducedMotion: boolean;
}

const PreferencesContext = createContext<Ctx | null>(null);

function read(): Preferences {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return DEFAULTS;
  }
}

function useMedia(query: string) {
  const [match, setMatch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    setMatch(mq.matches);
    const on = () => setMatch(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return match;
}

export function effectiveMotion(pref: MotionLevel, osReduced: boolean): MotionLevel {
  if (pref === "off") return "off";
  return osReduced ? "reduced" : pref;
}

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULTS);
  useEffect(() => setPrefs(read()), []);

  const osDark = useMedia("(prefers-color-scheme: dark)");
  const osReducedMotion = useMedia("(prefers-reduced-motion: reduce)");
  const osMoreContrast = useMedia("(prefers-contrast: more)");

  const resolvedTheme = prefs.theme === "system" ? (osDark ? "dark" : "light") : prefs.theme;
  const motion = effectiveMotion(prefs.motion, osReducedMotion);
  const highContrast = prefs.contrast === "high" || (prefs.contrast === "system" && osMoreContrast);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolvedTheme;
    root.dataset.motion = motion;
    root.dataset.accent = prefs.accent;
    if (highContrast) root.dataset.contrast = "high";
    else delete root.dataset.contrast;
  }, [resolvedTheme, motion, prefs.accent, highContrast]);

  const set = useCallback<Ctx["set"]>((key, value) => {
    setPrefs((p) => {
      const next = { ...p, [key]: value };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ prefs, set, resolvedTheme, highContrast, motion, osReducedMotion }),
    [prefs, set, resolvedTheme, highContrast, motion, osReducedMotion],
  ) satisfies Ctx;

  return (
    // Motion’s own config lives in UiRoot, mounted only where things animate.
    <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error("usePreferences must be used inside <PreferencesProvider>");
  return ctx;
}

/**
 * Runs before first paint (inlined in <head>) so there is no theme or motion flash.
 * Keep in sync with the logic above.
 */
export const preferencesBootScript = `(()=>{try{var p=JSON.parse(localStorage.getItem(${JSON.stringify(
  KEY,
)})||"{}");var m=function(q){return matchMedia(q).matches};var t=p.theme||"system";var d=document.documentElement;d.dataset.theme=t==="system"?(m("(prefers-color-scheme: dark)")?"dark":"light"):t;var mo=p.motion||"full";d.dataset.motion=mo==="off"?"off":(m("(prefers-reduced-motion: reduce)")?"reduced":mo);d.dataset.accent=p.accent||"fern";var c=p.contrast||"system";if(c==="high"||(c==="system"&&m("(prefers-contrast: more)")))d.dataset.contrast="high"}catch(e){}})()`;
