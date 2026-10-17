// Generates PWA icons from the logo. Usage: node scripts/generate-icons.mjs
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const WAVE = (stroke) =>
  `<path d="M6 17.5c2.2 0 2.2-6 4.4-6s2.2 10 4.4 10 2.2-14 4.4-14 2.2 10 4.4 10 2-4 2.4-4" fill="none" stroke="${stroke}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`;

// Rounded tile on transparent background (regular "any" icon).
const rounded = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="9" fill="#9b7bff"/>${WAVE("#0b0b0f")}</svg>`;
// Full-bleed square, logo inside the 80% safe zone (maskable / Apple).
const fullBleed = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="#9b7bff"/><g transform="translate(16 16) scale(0.72) translate(-16 -16)">${WAVE("#0b0b0f")}</g></svg>`;

mkdirSync("public/icons", { recursive: true });
const jobs = [
  [rounded, 192, "public/icons/icon-192.png"],
  [rounded, 512, "public/icons/icon-512.png"],
  [fullBleed, 512, "public/icons/icon-maskable-512.png"],
  [fullBleed, 180, "src/app/apple-icon.png"],
];
for (const [svg, size, out] of jobs) {
  await sharp(Buffer.from(svg), { density: 1200 }).resize(size, size).png().toFile(out);
  console.log("wrote", out);
}
