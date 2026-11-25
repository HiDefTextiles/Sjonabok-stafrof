import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const galleryDir = path.resolve(scriptDir, "..");
const fontDir = path.join(galleryDir, "fonts");
const pagesDir = path.join(galleryDir, "font-pages");
const index = JSON.parse(fs.readFileSync(path.join(fontDir, "font-index.json"), "utf8"));
const groupOf = (id) => id.replace(/_\d+$/u, "");
fs.mkdirSync(pagesDir, { recursive: true });
for (const font of index.fonts) {
  const fontIndex = index.fonts.findIndex((entry) => entry.id === font.id);
  const previous = index.fonts[fontIndex - 1];
  const next = index.fonts[fontIndex + 1];
  const title = JSON.stringify(font.name);
  const group = groupOf(font.id);
  const page = `---
title: ${title}
page-layout: full
subtitle: "Digitized TXT chart motifs · ${group} · draft transcription"
include-after-body:
  - text: <script type="module" src="../js/font-detail.js"></script>
---

<nav class="font-page-nav" aria-label="Browse font pages">
${previous ? `<a rel="prev" data-direction="previous" href="${previous.id}.qmd" aria-label="Previous font: ${previous.name}">← Previous</a>` : `<span aria-disabled="true"></span>`}
<a href="../index.qmd">Font catalog</a>
${next ? `<a rel="next" data-direction="next" href="${next.id}.qmd" aria-label="Next font: ${next.name}">Next →</a>` : `<span aria-disabled="true"></span>`}
</nav>

::: {.font-detail data-font-id="${font.id}" data-font-group="${group}"}

<p class="font-detail-status" role="status" aria-live="polite">Loading digitized TXT motifs…</p>

<div class="font-detail-actions">
<a class="btn btn-outline-primary" href="../fonts/${font.id}-org.ttf" download>Download -org TTF</a>
<a class="btn btn-outline-primary" href="../fonts/modern-alt/${font.id}-alt.ttf" download>Download -alt TTF</a>
</div>

<section aria-labelledby="source-motifs-${font.id}">
<h2 id="source-motifs-${font.id}">TXT chart overview</h2>
<p>This overview reassembles the chart’s digitized TXT glyphs before showing them individually below. It is generated from the 0/1 stitch grids, not an image of the original page. The same YAML-selected border is used for charts in this manuscript group.</p>

<div class="font-glyph-sheet-frame" data-frame-group="${group}">
<div class="font-chart-overview" data-chart-overview="${font.id}"></div>
</div>
<h2>Individual TXT glyphs</h2>
<p class="font-guide-note">Comparison guides use one shared stitch scale across charts. Fine lines mark five stitch rows; the stronger bottom line is a display alignment guide, not a historical annotation. Downloaded TXT grids are unchanged.</p>
<div class="font-glyph-sheet" data-glyph-sheet="${font.id}"></div>
</section>

<section aria-labelledby="modern-motifs-${font.id}">
<h2 id="modern-motifs-${font.id}">Alt glyph provenance</h2>
<p class="font-provenance-note">Blue grids are charted glyphs. Teal grids are added case forms or exact labeled glyphs reused from a chart in the same manuscript group with a similar median glyph height (within one stitch row). No glyphs are drawn or borrowed across manuscripts; unsupported characters are marked with a rosette.</p>
<p class="font-modern-status" role="status" aria-live="polite">Loading Alt TXT motifs…</p>
<div class="font-modern-glyph-sheet" data-modern-sheet="${font.id}"></div>
</section>

:::
`;
  fs.writeFileSync(path.join(pagesDir, `${font.id}.qmd`), page, "utf8");
}
console.log(`Generated ${index.fonts.length} per-chart font detail pages.`);
