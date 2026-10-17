"use client";

import { useEffect, useState } from "react";
import { todayISO } from "./dates";

/** Today's local date, rolling over at midnight (and when the tab wakes up). */
export function useToday() {
  const [today, setToday] = useState(todayISO);
  useEffect(() => {
    const check = () => setToday((t) => (t === todayISO() ? t : todayISO()));
    const id = setInterval(check, 60_000);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);
  return today;
}
