"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { KeyboardStill } from "./keyboard-rows";

/*
 * Below-the-fold sections that need real client code (the quick-add parser, the animation
 * library) are fetched only as they approach the viewport, so the first paint never waits on them.
 * Each renders a same-sized stand-in until then.
 */

const Demo = dynamic(() => import("./demo"), { ssr: false, loading: () => <DemoPlaceholder /> });
const Loop = dynamic(() => import("./keyboard-loop"), { ssr: false });

function DemoPlaceholder() {
  return <div className="h-48 rounded-md bg-raised ring-1 ring-line lg:w-1/2" />;
}

/** True once the element is within a screen or so of the viewport (or the URL points at `hash`). */
function useNear(hash?: string) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    if (hash && location.hash === hash) return setNear(true);
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: "600px 0px" });
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, [hash]);
  return [ref, near] as const;
}

export function TryIt() {
  const [ref, near] = useNear("#try");
  return <div ref={ref}>{near ? <Demo /> : <DemoPlaceholder />}</div>;
}

export function KeyboardLoop({ today, rows }: { today: string; rows: string[] }) {
  const [ref, near] = useNear();
  return <div ref={ref}>{near ? <Loop today={today} rows={rows} /> : <KeyboardStill today={today} rows={rows} />}</div>;
}
