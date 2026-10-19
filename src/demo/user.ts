/*
 * The one account in the browser demo (a build with no database: README → "Deploy to Netlify").
 * Its password is public on purpose — the demo holds nothing but sample data.
 */
export const DEMO_EMAIL = "demo@margin.com";
export const DEMO_PASSWORD = "margindemo";
export const DEMO_USER = { id: "demo-user", name: "Demo", email: DEMO_EMAIL };
/** Set when the demo is signed in; the proxy and the app layout read it. */
export const DEMO_COOKIE = "margin-demo";
