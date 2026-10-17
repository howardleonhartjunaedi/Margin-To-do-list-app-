import type { Metadata, Viewport } from "next";
import { CustomCursor } from "@/components/cursor/custom-cursor";
import { PreferencesProvider, preferencesBootScript } from "@/components/providers/preferences";
import { Toaster } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { display, displayItalic, mono, sans } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Margin", template: "%s · Margin" },
  description: "A calm, fast task manager.",
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
          <TooltipProvider>
            {children}
            <Toaster />
            <CustomCursor />
          </TooltipProvider>
        </PreferencesProvider>
      </body>
    </html>
  );
}
