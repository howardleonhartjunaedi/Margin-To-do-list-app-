"use client";

import { useEffect, useState } from "react";
import { usePreferences } from "../providers/preferences";

// Kept apart from the cursor itself so that buttons can ask "is the custom cursor on?"
// without pulling the cursor (and the animation library) into every page.

function useFinePointer() {
  const [fine, setFine] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    setFine(mq.matches);
    const on = () => setFine(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return fine;
}

/** True only on a fine pointer, with motion at Full and the setting on. */
export function useCursorEnabled() {
  const { prefs, motion } = usePreferences();
  const fine = useFinePointer();
  return fine && prefs.cursor && motion === "full";
}
