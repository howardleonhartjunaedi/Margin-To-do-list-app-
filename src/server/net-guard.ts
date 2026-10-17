import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/*
 * Webhook targets are user-supplied URLs fetched by our server, so they must not reach
 * internal services (SSRF). Every address a hostname resolves to must be public.
 * Set WEBHOOKS_ALLOW_PRIVATE=1 to test against localhost in development.
 */

export function isPrivateAddress(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) || // CGNAT
      (a === 169 && b === 254) || // link-local, cloud metadata
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224 // multicast, reserved, broadcast
    );
  }
  if (v === 6) {
    const x = ip.toLowerCase();
    if (x === "::" || x === "::1") return true;
    if (x.startsWith("::ffff:")) return isPrivateAddress(x.slice(7)); // v4-mapped
    return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(x);
  }
  return true; // not an IP at all: treat as unsafe
}

export const allowPrivate = () => process.env.WEBHOOKS_ALLOW_PRIVATE === "1";

/** Throws a human message if the URL isn't a safe public http(s) endpoint. */
export async function assertPublicUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("That isn’t a valid URL.");
  }
  if (url.protocol !== "https:" && !(url.protocol === "http:" && allowPrivate())) throw new Error("Webhook URLs must use https.");
  if (url.username || url.password) throw new Error("Put credentials in a header on your side, not in the URL.");
  if (allowPrivate()) return url;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (!addrs.length) throw new Error("That host name doesn’t resolve.");
  if (addrs.some((a) => isPrivateAddress(a.address))) throw new Error("Webhooks can’t point at private or local addresses.");
  return url;
}
