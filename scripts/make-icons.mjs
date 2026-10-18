// Renders the PWA icons from one drawing. Run after changing the mark: node scripts/make-icons.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const ink = "#1d1b18";
const paper = "#f6f2ea";
const fern = "#93c07a";

// The mark on a 100-unit canvas; `pad` shrinks it into the maskable safe zone (inner 80%).
const svg = (rounded, pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" ${rounded ? 'rx="22"' : ""} fill="${ink}"/>
  <g transform="translate(${pad} ${pad}) scale(${(100 - 2 * pad) / 100})">
    <path d="M25 72V33l25 25 25-25v39" fill="none" stroke="${paper}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="80" cy="75" r="7" fill="${fern}"/>
  </g>
</svg>`;

mkdirSync("public/icons", { recursive: true });
const out = [
  ["icon-192.png", 192, svg(true, 6)],
  ["icon-512.png", 512, svg(true, 6)],
  ["maskable-512.png", 512, svg(false, 16)],
  ["apple-touch-icon.png", 180, svg(false, 10)],
];
for (const [name, size, src] of out) await sharp(Buffer.from(src)).resize(size, size).png().toFile(`public/icons/${name}`);
console.log("wrote", out.map(([n]) => n).join(", "));

// favicon.ico for clients that ask for it regardless of <link rel="icon">: one 32px PNG in an ICO wrapper.
const png = await sharp(Buffer.from(svg(true, 6))).resize(32, 32).png().toBuffer();
const head = Buffer.alloc(22);
head.writeUInt16LE(1, 2); // type: icon
head.writeUInt16LE(1, 4); // one image
head.writeUInt8(32, 6);
head.writeUInt8(32, 7);
head.writeUInt16LE(1, 10); // planes
head.writeUInt16LE(32, 12); // bits per pixel
head.writeUInt32LE(png.length, 14);
head.writeUInt32LE(22, 18); // offset
writeFileSync("src/app/favicon.ico", Buffer.concat([head, png]));
console.log("wrote src/app/favicon.ico");
