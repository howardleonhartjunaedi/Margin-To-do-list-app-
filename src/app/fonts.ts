import { IBM_Plex_Mono, Newsreader, Schibsted_Grotesk } from "next/font/google";

// next/font downloads these at build time and serves them from our own origin.

/** Display: an editorial serif with optical sizing — headings, view titles, big numbers in prose. */
export const display = Newsreader({
  subsets: ["latin"],
  axes: ["opsz"],
  style: ["normal"],
  variable: "--font-newsreader",
  display: "swap",
});

/** The italic cut, for the odd emphasised word. Not preloaded: it's a few words, and swaps in late without shifting layout much. */
export const displayItalic = Newsreader({
  subsets: ["latin"],
  axes: ["opsz"],
  style: ["italic"],
  variable: "--font-newsreader-italic",
  display: "swap",
  preload: false,
});

/** UI: a sturdy, highly legible grotesk with real character at small sizes. */
export const sans = Schibsted_Grotesk({
  subsets: ["latin"],
  variable: "--font-schibsted",
  display: "swap",
});

/** Mono: times, dates, counters, shortcuts. */
export const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});
