import type { MetadataRoute } from "next";

// Everything personal is behind sign-in, so crawlers only ever reach public pages anyway.
// Keep them out of the API and one-time invite links.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/invite/"] } };
}
