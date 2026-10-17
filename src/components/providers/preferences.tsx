"use client";

import { MotionConfig } from "motion/react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { MotionLevel } from "@/design/motion";

export type ThemePref = "system" | "light" | "dark";

export interface Preferences {
  theme: ThemePref;
  /** What the user picked. The effective level is also clamped by the OS setting. */
  motion: MotionLevel;
  cursor: boolean;
  celebrate: boolean;
}

const DEFAULTS: Preferences = { theme: "system", motion: "full", cursor: true, celebrate: true };
const KEY = "margin:prefs";

interface Ctx {
  prefs: Preferences;
  set: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  /** Resolved values the UI should actually use. */
  resolvedTheme: "light" | "dark";
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

  const resolvedTheme = prefs.theme === "system" ? (osDark ? "dark" : "light") : prefs.theme;
  const motion = effectiveMotion(prefs.motion, osReducedMotion);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolvedTheme;
    root.dataset.motion = motion;
  }, [resolvedTheme, motion]);

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
    () => ({ prefs, set, resolvedTheme, motion, osReducedMotion }),
    [prefs, set, resolvedTheme, motion, osReducedMotion],
  ) satisfies Ctx;

  return (
    <PreferencesContext.Provider value={value}>
      {/* "reduced": Motion keeps opacity fades but drops transform/layout animation. */}
      <MotionConfig
        reducedMotion={motion === "full" ? "never" : "always"}
        transition={motion === "off" ? { duration: 0 } : undefined}
      >
        {children}
      </MotionConfig>
    </PreferencesContext.Provider>
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
)})||"{}");var m=function(q){return matchMedia(q).matches};var t=p.theme||"system";var d=document.documentElement;d.dataset.theme=t==="system"?(m("(prefers-color-scheme: dark)")?"dark":"light"):t;var mo=p.motion||"full";d.dataset.motion=mo==="off"?"off":(m("(prefers-reduced-motion: reduce)")?"reduced":mo)}catch(e){}})()`;
