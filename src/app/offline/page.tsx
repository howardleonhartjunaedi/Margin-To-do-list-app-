import type { Metadata } from "next";
import { OfflineMessage } from "./message";

export const metadata: Metadata = { title: "Offline" };

// Static, and kept by the service worker: shown for pages this device never opened while online.
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-12 sm:px-8">
      <p className="font-display text-xl font-medium tracking-tight text-ink">
        Margin<span className="text-accent">.</span>
      </p>
      <OfflineMessage />
    </main>
  );
}
