"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            // Always try the request: offline, the service worker answers with the last copy it kept.
            networkMode: "offlineFirst",
            refetchOnWindowFocus: true,
            retry: (count, err) => count < 2 && !(err as { status?: number }).status?.toString().startsWith("4"),
          },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
