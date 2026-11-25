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
  const title = JSON.stringify(font.name);
  const group = groupOf(font.id);
  const page = `---
title: ${title}
page-layout: full
subtitle: "Digitized TXT chart motifs · ${group} · draft transcription"
include-after-body:
  - text: <script type="module" src="../js/font-detail.js"></script>
---

[← Font catalog](../index.qmd) · [Font groups and frame choices](../font-families.qmd) · [Test the fonts](../font-test.qmd)

::: {.font-detail data-font-id="${font.id}" data-font-group="${group}"}

<p class="font-detail-status" role="status" aria-live="polite">Loading digitized TXT motifs…</p>

<div class="font-detail-actions">
<a class="btn btn-outline-primary" href="../fonts/${font.filename}" download>Download source-chart TTF</a>
<a class="btn btn-outline-primary" href="../fonts/modern-alt/${font.id}-modern-alt.ttf" download>Download modern-alt TTF</a>
</div>

<section aria-labelledby="source-motifs-${font.id}">
<h2 id="source-motifs-${font.id}">Source chart glyphs as TXT motifs</h2>
<p>Each square is a <code>1</code> stitch cell or a <code>0</code> empty cell from the linked TXT file. These are the digitized chart motifs used to build the source-chart font. The labels are draft transcriptions and may need correction. The original EPS is not included in this repository.</p>

<div class="font-glyph-sheet-frame" data-frame-group="${group}">
<div class="font-glyph-sheet" data-glyph-sheet="${font.id}"></div>
</div>
</section>

<section aria-labelledby="modern-motifs-${font.id}">
<h2 id="modern-motifs-${font.id}">Modern-alt glyph provenance</h2>
<p class="font-provenance-note">No AI-generated glyphs are included in this build. Missing modern letters use documented source-chart donors or the programmatic acute construction.</p>
<p class="font-modern-status" role="status" aria-live="polite">Loading modern-alt TXT motifs…</p>
<div class="font-modern-glyph-sheet" data-modern-sheet="${font.id}"></div>
</section>

:::
`;
  fs.writeFileSync(path.join(pagesDir, `${font.id}.qmd`), page, "utf8");
}
console.log(`Generated ${index.fonts.length} per-chart font detail pages.`);
