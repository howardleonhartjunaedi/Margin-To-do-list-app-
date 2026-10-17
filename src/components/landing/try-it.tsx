"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

// The demo pulls in the date parser; fetch it only as the section approaches.
const Demo = dynamic(() => import("./demo"), { ssr: false, loading: () => <Placeholder /> });

function Placeholder() {
  return <div className="h-48 rounded-md bg-raised ring-1 ring-line lg:w-1/2" />;
}

export function TryIt() {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    // Arriving via the "Try it right here" link counts as near.
    if (location.hash === "#try") return setNear(true);
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: "600px 0px" });
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, []);

  return <div ref={ref}>{near ? <Demo /> : <Placeholder />}</div>;
}
