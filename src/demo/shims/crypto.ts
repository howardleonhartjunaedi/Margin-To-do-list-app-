// node:crypto in the demo worker. Tokens and webhook signatures are never used for real here,
// so the hashes only need to be stable, not secure.
const bytes = (n: number) => {
  const b = crypto.getRandomValues(new Uint8Array(n));
  return {
    toString(encoding?: string) {
      const s = btoa(String.fromCharCode(...b));
      return encoding === "base64url" ? s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") : s;
    },
  };
};
export const randomBytes = bytes;

function digest(input: string) {
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < input.length; i++) {
    h1 = Math.imul(h1 ^ input.charCodeAt(i), 0x01000193);
    h2 = Math.imul(h2 ^ input.charCodeAt(i), 0x5bd1e995);
  }
  return ((h1 >>> 0).toString(16) + (h2 >>> 0).toString(16)).padStart(16, "0").repeat(4);
}
const hasher = (seed = "") => {
  let data = seed;
  const h = { update: (s: string) => ((data += s), h), digest: () => digest(data) };
  return h;
};
export const createHash = () => hasher();
export const createHmac = (_alg: string, key: string) => hasher(key);
export const timingSafeEqual = (a: { toString(): string }, b: { toString(): string }) => a.toString() === b.toString();
export default { randomBytes, createHash, createHmac, timingSafeEqual };
