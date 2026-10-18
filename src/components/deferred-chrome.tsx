"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

// Page-wide extras that nothing needs for the first paint. They're fetched once the page has
// loaded and the browser is idle, so they never compete with the content for bandwidth.
const CustomCursor = dynamic(() => import("./cursor/custom-cursor").then((m) => m.CustomCursor), { ssr: false });
const Toaster = dynamic(() => import("./ui/toast").then((m) => m.Toaster), { ssr: false });

/** True once the page has finished loading and the main thread has a quiet moment. */
export function useAfterLoad(timeout = 2000) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let idle: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const go = () => {
      if ("requestIdleCallback" in window) idle = window.requestIdleCallback(() => setReady(true), { timeout });
      else timer = setTimeout(() => setReady(true), 300); // Safari
    };
    if (document.readyState === "complete") go();
    else window.addEventListener("load", go, { once: true });
    return () => {
      window.removeEventListener("load", go);
      if (idle !== undefined) window.cancelIdleCallback(idle);
      clearTimeout(timer);
    };
  }, [timeout]);
  return ready;
}

export function DeferredChrome() {
  const ready = useAfterLoad();
  if (!ready) return null;
  return (
    <>
      <Toaster />
      <CustomCursor />
    </>
  );
}
