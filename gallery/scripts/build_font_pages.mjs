import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const galleryDir = path.resolve(scriptDir, "..");
const fontDir = path.join(galleryDir, "fonts");
const pagesDir = path.join(galleryDir, "font-pages");
const index = JSON.parse(fs.readFileSync(path.join(fontDir, "font-index.json"), "utf8"));
const modernIndex = JSON.parse(fs.readFileSync(path.join(fontDir, "modern-alt-index.json"), "utf8"));
const frameIndex = JSON.parse(fs.readFileSync(path.join(fontDir, "font-group-frames.json"), "utf8"));
const modernById = new Map(modernIndex.fonts.map((font) => [font.id, font]));
const groupOf = (id) => id.replace(/_\d+$/u, "");
const detailDataDir = path.join(fontDir, "font-detail-data");
fs.mkdirSync(detailDataDir, { recursive: true });
function readMatrix(filePath) {
  return fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/u, "").split(/\r?\n/u).filter((row) => /^[01]+$/u.test(row));
}
fs.mkdirSync(pagesDir, { recursive: true });
for (const font of index.fonts) {
  const modernFont = modernById.get(font.id);
  const frame = frameIndex.groups.find((entry) => entry.sourceGroup === groupOf(font.id));
  if (!modernFont || !frame) throw new Error(`Missing generated data for ${font.id}`);
  const isCaseAlias = (entry) => entry.method === "source-chart-shared-case"
    || (entry.sourceCharacter && entry.sourceCharacter !== entry.character
      && entry.sourceCharacter.toLocaleLowerCase("is") === entry.character.toLocaleLowerCase("is"));
  const sharedCaseAliases = new Set(modernFont.additions.filter(isCaseAlias).map((entry) => entry.character));
  const sourceLetters = font.glyphs.map((glyph) => glyph.character).filter((character) => /\p{Letter}/u.test(character));
  const hasUppercase = sourceLetters.some((character) => character === character.toUpperCase());
  const hasLowercase = sourceLetters.some((character) => character === character.toLowerCase());
  const sourceCase = hasUppercase && !hasLowercase ? "upper" : hasLowercase && !hasUppercase ? "lower" : "both";
  const redundantMissing = new Set(modernFont.missingCharacters.filter((character) => {
    if (!/\p{Letter}/u.test(character) || sourceCase === "both") return false;
    return sourceCase === "upper" ? character !== character.toUpperCase() : character !== character.toLowerCase();
  }));
  const hiddenCharacters = new Set([...sharedCaseAliases, ...redundantMissing]);
  const pageData = {
    sourceFont: { id: font.id, pageTxtFile: font.pageTxtFile },
    modernFont: {
      ...modernFont,
      targetCharacters: modernFont.targetCharacters.filter((character) => !hiddenCharacters.has(character)),
      characters: modernFont.characters.filter((character) => !hiddenCharacters.has(character)),
      additions: modernFont.additions.filter((entry) => !hiddenCharacters.has(entry.character)),
      missingCharacters: modernFont.missingCharacters.filter((character) => !hiddenCharacters.has(character)),
      glyphs: modernFont.glyphs.filter((glyph) => !hiddenCharacters.has(glyph.character)).map((glyph) => ({
        ...glyph,
        rows: readMatrix(path.join(fontDir, glyph.txtFile)),
      })),
    },
    comparisonGrid: modernIndex.comparisonGrid,
    frame,
    frameRows: readMatrix(path.join(galleryDir, frame.matrixFile)),
  };
  fs.writeFileSync(path.join(detailDataDir, `${font.id}.json`), JSON.stringify(pageData));
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

<p class="font-detail-status" role="status" aria-live="polite">Loading TXT page and glyph overview…</p>

<div class="font-page-comparison" aria-label="Book chart and font overview">
<section class="font-page-panel" aria-labelledby="source-page-${font.id}">
<h2 id="source-page-${font.id}">Book chart · unsplit TXT</h2>
<p>Converted from the EPS without splitting or rearranging its glyphs. The EPS itself is not included. The YAML-selected manuscript border frames this page.</p>
<div class="font-glyph-sheet-frame" data-frame-group="${group}">
<div class="font-chart-original" data-chart-page="${font.id}"></div>
</div>
</section>
<div class="font-page-divider" aria-hidden="true"></div>
<section class="font-page-panel" aria-labelledby="font-overview-${font.id}">
<h2 id="font-overview-${font.id}">Font overview</h2>
<p>The separated TXT glyphs arranged for comparison. Blue marks charted forms; teal marks added forms. Missing forms use a teal rosette.</p>
<div class="font-chart-overview" data-chart-overview="${font.id}"></div>
</section>
</div>

<div class="font-detail-actions">
<a class="btn btn-outline-primary" href="../fonts/${font.id}-org.ttf" download>Download -org TTF</a>
<a class="btn btn-outline-primary" href="../fonts/modern-alt/${font.id}-alt.ttf" download>Download -alt TTF</a>
</div>

<section aria-labelledby="glyphs-${font.id}">
<h2 id="glyphs-${font.id}">Glyphs and provenance</h2>
<p class="font-provenance-note">Derived upper/lowercase aliases are omitted from this chart view. In the TTF, a missing case maps to its available charted counterpart. Blue means transcribed from this chart; teal means borrowed from a qualifying same-manuscript chart. A teal rosette means the character is still missing.</p>
<p class="font-guide-note">Comparison guides use one shared stitch scale across charts. Fine lines mark five stitch rows; the stronger bottom line is a display alignment guide, not a historical annotation. Downloaded TXT grids are unchanged.</p>
<div class="font-glyph-sheet" data-glyph-sheet="${font.id}"></div>
<p class="font-detail-status font-glyph-status" role="status" aria-live="polite">Loading glyph TXT grids…</p>
</section>

:::
`;
  fs.writeFileSync(path.join(pagesDir, `${font.id}.qmd`), page, "utf8");
}
console.log(`Generated ${index.fonts.length} per-chart font detail pages.`);
