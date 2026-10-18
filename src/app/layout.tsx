import type { Metadata, Viewport } from "next";
import { DeferredChrome } from "@/components/deferred-chrome";
import { PreferencesProvider, preferencesBootScript } from "@/components/providers/preferences";
import { display, displayItalic, mono, sans } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Margin", template: "%s · Margin" },
  description: "A calm, fast task manager.",
  // Absolute URLs for alternates and social cards. The front page is prerendered, so this is read at build time.
  metadataBase: new URL(process.env.BETTER_AUTH_URL ?? "http://localhost:3000"),
  icons: { apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Margin", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f2ea" },
    { media: "(prefers-color-scheme: dark)", color: "#1b1916" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="light"
      data-motion="full"
      className={`${display.variable} ${displayItalic.variable} ${sans.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: preferencesBootScript }} />
      </head>
      <body>
        <PreferencesProvider>
          {children}
          <DeferredChrome />
        </PreferencesProvider>
      </body>
    </html>
  );
}
