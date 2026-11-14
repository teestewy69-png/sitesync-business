#!/usr/bin/env node
/**
 * Builds public/new-business-website-starter-checklist.pdf from
 * data/lead-magnet-checklist.ts — the PDF copy of The New Business Website
 * Starter Checklist that the /start welcome email links to.
 *
 * Dependency-free: hand-rolled PDF with the built-in Helvetica family,
 * black & gold brand styling (brand-500 #d4a44a on black/near-black).
 * Re-run after editing the data module:  node scripts/build-lead-magnet-pdf.mjs
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { LEAD_MAGNET_CHECKLIST: data } = await import("../data/lead-magnet-checklist.ts");
const OUT = path.join(ROOT, "public/new-business-website-starter-checklist.pdf");

/* ---------------- text metrics (Helvetica AFM widths, per 1000 em) ---------------- */
const W = {
  " ": 278, "!": 278, '"': 355, "#": 556, $: 556, "%": 889, "&": 667, "'": 191,
  "(": 333, ")": 333, "*": 389, "+": 584, ",": 278, "-": 333, ".": 278, "/": 278,
  ":": 278, ";": 278, "<": 584, "=": 584, ">": 584, "?": 556, "@": 1015,
  "[": 278, "\\": 278, "]": 278, "^": 469, _: 556, "`": 333, "{": 334, "|": 260, "}": 334, "~": 584,
  "—": 1000, "–": 556, "’": 191, "‘": 191, "“": 355, "”": 355, "…": 1000, "·": 278, "•": 556,
};
for (let i = 0; i < 10; i++) W[String(i)] = 556;
Object.assign(W, {
  A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278, J: 500,
  K: 667, L: 556, M: 833, N: 722, O: 778, P: 667, Q: 778, R: 722, S: 667, T: 611,
  U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611,
  a: 556, b: 556, c: 500, d: 556, e: 556, f: 278, g: 556, h: 556, i: 222, j: 222,
  k: 500, l: 222, m: 833, n: 556, o: 556, p: 556, q: 556, r: 333, s: 500, t: 278,
  u: 556, v: 500, w: 722, x: 500, y: 500, z: 500,
});

function textWidth(text, size, bold = false) {
  let units = 0;
  for (const ch of text) units += W[ch] ?? 556;
  return (units / 1000) * size * (bold ? 1.02 : 1);
}

function wrap(text, size, maxWidth, bold = false) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && textWidth(next, size, bold) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/* ---------------- WinAnsi encoding + string escaping ---------------- */
const WINANSI = { "—": "\x97", "–": "\x96", "’": "\x92", "‘": "\x91", "“": "\x93", "”": "\x94", "…": "\x85", "·": "\xB7", "•": "\x95" };
function pdfText(text) {
  let out = "";
  for (const ch of text) {
    if (WINANSI[ch]) out += WINANSI[ch];
    else if (ch.charCodeAt(0) < 128) out += ch;
    else out += "?";
  }
  return out.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/* ---------------- layout engine ---------------- */
const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 56;
const CONTENT_W = PAGE_W - MARGIN * 2;
const BOTTOM = 64;
const GOLD = "0.831 0.643 0.290";
const INK = "0.10 0.10 0.10";
const GRAY = "0.38 0.38 0.38";

const pages = [];
let ops = [];
let y = 0;

function newPage() {
  pages.push(ops);
  ops = [];
  y = PAGE_H - MARGIN;
}
function ensure(price) {
  if (y - price < BOTTOM) newPage();
}
function text(str, x, size, { font = "F1", color = INK } = {}) {
  ops.push(`BT /${font} ${size} Tf ${color} rg 1 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)} Tm (${pdfText(str)}) Tj ET`);
}
function rule(x1, x2, color = GOLD, width = 1.4) {
  ops.push(`${color} RG ${width} w ${x1} ${y.toFixed(1)} m ${x2} ${y.toFixed(1)} l S`);
}
function paragraph(str, size, { font = "F1", color = INK, leading = 1.45, gapAfter = 0, x = MARGIN, width = CONTENT_W } = {}) {
  for (const line of wrap(str, size, width, font === "F2")) {
    ensure(size * leading);
    text(line, x, size, { font, color });
    y -= size * leading;
  }
  y -= gapAfter;
}
function sectionHeading(heading) {
  ensure(84); // heading + rule + at least the first item stay together
  y -= 8;
  text(heading, MARGIN, 13, { font: "F2" });
  y -= 6;
  rule(MARGIN, MARGIN + CONTENT_W);
  y -= 12;
}
function checklistItem(item) {
  const size = 10.5;
  const leading = size * 1.42;
  const lines = wrap(item, size, CONTENT_W - 22);
  ensure(lines.length * leading + 4);
  // checkbox
  const top = y + 1;
  ops.push(`${INK} RG 0.8 w ${MARGIN} ${(top - 8).toFixed(1)} 8 8 re S`);
  lines.forEach((line, i) => {
    text(line, MARGIN + 22, size, {});
    if (i < lines.length - 1) y -= leading;
  });
  y -= leading + 3.5;
}

/* header band on page 1 */
ops.push(`0.04 0.04 0.04 rg 0 ${PAGE_H - 128} ${PAGE_W} 128 re f`);
y = PAGE_H - 58;
for (const line of wrap(data.title, 21, CONTENT_W, true)) {
  text(line, MARGIN, 21, { font: "F2", color: GOLD });
  y -= 27;
}
y -= 2;
paragraph(data.subtitle, 10.5, { font: "F3", color: "0.92 0.92 0.92", leading: 1.4 });
y = PAGE_H - 128 - 26;
paragraph(data.intro, 10.5, { leading: 1.5, gapAfter: 6 });

for (const section of data.sections) {
  sectionHeading(section.heading);
  for (const item of section.items) checklistItem(item);
  y -= 4;
}

ensure(60);
y -= 6;
ops.push(`${GOLD} RG 1.4 w ${MARGIN} ${y.toFixed(1)} ${CONTENT_W} 0.1 re S`);
y -= 16;
paragraph(data.closing, 10.5, { leading: 1.5 });
pages.push(ops);

/* footers (need total page count, so they are appended per page afterwards) */
const total = pages.length;
pages.forEach((pageOps, i) => {
  pageOps.push(`0.75 0.75 0.75 RG 0.6 w ${MARGIN} 46 m ${PAGE_W - MARGIN} 46 l S`);
  pageOps.push(
    `BT /F1 8 Tf ${GRAY} rg 1 0 0 1 ${MARGIN} 34 Tm (${pdfText("SitesInc — sitesinc.co/start · save@sitesinc.co · (909) 323-1575")}) Tj ET`
  );
  const label = `Page ${i + 1} of ${total}`;
  const x = PAGE_W - MARGIN - textWidth(label, 8);
  pageOps.push(`BT /F1 8 Tf ${GRAY} rg 1 0 0 1 ${x.toFixed(1)} 34 Tm (${pdfText(label)}) Tj ET`);
});

/* ---------------- serialize (object numbers precomputed) ----------------
   1..3 fonts · 4..3+n content streams · 4+n..3+2n pages · 4+2n Pages · 5+2n Catalog */
const n = pages.length;
const FONT = { F1: 1, F2: 2, F3: 3 };
const contentId = (i) => 4 + i;
const pageId = (i) => 4 + n + i;
const PAGES_ID = 4 + 2 * n;
const CATALOG_ID = 5 + 2 * n;

const bodies = new Map();
bodies.set(FONT.F1, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
bodies.set(FONT.F2, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
bodies.set(FONT.F3, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>");
pages.forEach((pageOps, i) => {
  const stream = pageOps.join("\n");
  bodies.set(contentId(i), `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`);
  bodies.set(
    pageId(i),
    `<< /Type /Page /Parent ${PAGES_ID} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 ${FONT.F1} 0 R /F2 ${FONT.F2} 0 R /F3 ${FONT.F3} 0 R >> >> /Contents ${contentId(i)} 0 R >>`
  );
});
bodies.set(PAGES_ID, `<< /Type /Pages /Kids [${pages.map((_, i) => `${pageId(i)} 0 R`).join(" ")}] /Count ${n} >>`);
bodies.set(CATALOG_ID, `<< /Type /Catalog /Pages ${PAGES_ID} 0 R >>`);

const ordered = [...bodies.entries()].sort((a, b) => a[0] - b[0]);
let pdf = "%PDF-1.4\n";
const offsets = new Map();
for (const [num, body] of ordered) {
  offsets.set(num, Buffer.byteLength(pdf, "latin1"));
  pdf += `${num} 0 obj\n${body}\nendobj\n`;
}
const xrefAt = Buffer.byteLength(pdf, "latin1");
pdf += `xref\n0 ${CATALOG_ID + 1}\n0000000000 65535 f \n`;
for (let i = 1; i <= CATALOG_ID; i++) {
  pdf += `${String(offsets.get(i)).padStart(10, "0")} 00000 n \n`;
}
pdf += `trailer\n<< /Size ${CATALOG_ID + 1} /Root ${CATALOG_ID} 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;

writeFileSync(OUT, Buffer.from(pdf, "latin1"));
console.log(`Wrote ${OUT} (${total} pages, ${Buffer.byteLength(pdf, "latin1")} bytes)`);
