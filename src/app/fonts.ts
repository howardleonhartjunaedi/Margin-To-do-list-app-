import { IBM_Plex_Mono, Newsreader, Schibsted_Grotesk } from "next/font/google";

// next/font downloads these at build time and serves them from our own origin.

/** Display: an editorial serif — headings, view titles, big numbers in prose. Static 400/500 cuts: the variable
 *  optical-size font was ~2.5× the bytes and kept the landing page over its LCP budget on mobile. */
export const display = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal"],
  variable: "--font-newsreader",
  display: "swap",
});

/** The italic cut, for the odd emphasised word. Same family name, so `em` inside display text picks it up; not preloaded. */
export const displayItalic = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500"],
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
  preload: false, // never what the first paint is waiting on
});
