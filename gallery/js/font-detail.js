const root = document.querySelector(".font-detail");
const sourceIndexUrl = "../fonts/font-index.json";
const sourceDataUrl = "../fonts/font-source.json";
const modernIndexUrl = "../fonts/modern-alt-index.json";
const frameIndexUrl = "../fonts/font-group-frames.json";
const codepointName = (character) => `U+${character.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}`;

function make(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined) node.textContent = value;
  return node;
}

async function matrixAt(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load TXT matrix ${url}`);
  return (await response.text()).replace(/^\uFEFF/u, "").split(/\r?\n/u).filter((row) => /^[01]+$/u.test(row));
}

function matrixSvg(rows, label, pixel = 6) {
  const width = Math.max(1, ...rows.map((row) => row.length));
  const height = Math.max(1, rows.length);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${width * pixel} ${height * pixel}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", label);
  svg.setAttribute("class", "font-matrix-svg");
  svg.style.setProperty("--matrix-width", `${width * pixel}px`);
  svg.style.setProperty("--matrix-height", `${height * pixel}px`);
  rows.forEach((row, y) => [...row].forEach((cell, x) => {
    if (cell !== "1") return;
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", String(x * pixel));
    rect.setAttribute("y", String(y * pixel));
    rect.setAttribute("width", String(pixel));
    rect.setAttribute("height", String(pixel));
    svg.append(rect);
  }));
  return svg;
}

function bandSvg(rows, widthCells, pixel = 4) {
  const tileWidth = Math.max(1, ...rows.map((row) => row.length));
  const height = rows.length;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${widthCells * pixel} ${height * pixel}`);
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("font-frame-band");
  for (let x0 = 0; x0 < widthCells; x0 += tileWidth) {
    rows.forEach((row, y) => [...row].forEach((cell, x) => {
      if (cell !== "1" || x0 + x >= widthCells) return;
      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("x", String((x0 + x) * pixel));
      rect.setAttribute("y", String(y * pixel));
      rect.setAttribute("width", String(pixel));
      rect.setAttribute("height", String(pixel));
      svg.append(rect);
    }));
  }
  return svg;
}

function addFrame(frameElement, patternRows, treatment, estimatedWidthCells) {
  const sheet = frameElement.querySelector(".font-glyph-sheet");
  frameElement.replaceChildren();
  frameElement.classList.add("has-corpus-frame");
  if (treatment === "repeat-border") {
    const top = make("div", "font-frame-horizontal");
    const bottom = make("div", "font-frame-horizontal");
    top.append(bandSvg(patternRows, estimatedWidthCells));
    bottom.append(bandSvg(patternRows, estimatedWidthCells));
    const content = make("div", "font-frame-content");
    content.append(sheet);
    frameElement.append(top, content, bottom);
  } else {
    const rows = [];
    for (let y = 0; y < patternRows.length; y += Math.ceil(patternRows.length / 14)) rows.push(patternRows[y]);
    const corners = make("div", "font-frame-corners");
    for (const side of ["left", "right"]) {
      const motif = make("div", `font-frame-corner ${side}`);
      motif.append(matrixSvg(rows, "Sjónabók corner motif", 2));
      corners.append(motif);
    }
    const content = make("div", "font-frame-content corner-adaptation");
    content.append(sheet);
    frameElement.append(corners, content, corners.cloneNode(true));
    frameElement.querySelectorAll(".font-frame-corner svg").forEach((svg) => svg.setAttribute("aria-hidden", "true"));
  }
}

function provenanceText(record, addition) {
  if (!addition) return "Source chart glyph";
  if (addition.method === "sibling-chart") return `Reused chart glyph · donor ${addition.sourceFontId}`;
  if (addition.method === "source-base-plus-acute" || addition.method === "sibling-base-plus-acute") return "Programmatic TXT reconstruction · base glyph plus stitch-grid acute; no AI";
  if (addition.method === "source-chart-shared-case") return `Source chart shared across letter case · ${addition.sourceFontId}`;
  return `Reconstructed · ${addition.method || "method not recorded"}`;
}

async function renderGlyphs(sheet, glyphs, status, additions = new Map()) {
  sheet.replaceChildren();
  for (const glyph of glyphs) {
    const tile = make("article", "font-matrix-card");
    const label = make("h3", "font-matrix-label", glyph.character || "Unlabelled");
    tile.append(label);
    const txtFile = glyph.txtFile;
    try {
      const rows = await matrixAt(`../fonts/${txtFile}`);
      tile.append(matrixSvg(rows, `${glyph.character || "Unlabelled"} binary stitch chart`));
      const provenance = additions.get(glyph.character);
      tile.append(make("p", "font-provenance-badge", provenanceText(glyph, provenance)));
      const link = make("a", "font-matrix-download", "Download TXT motif");
      link.href = `../fonts/${txtFile}`;
      link.download = `${codepointName(glyph.character)}.txt`;
      tile.append(link);
    } catch (error) {
      tile.append(make("p", "font-data-error", error.message));
    }
    sheet.append(tile);
  }
  status.textContent = `${glyphs.length} glyph TXT matrices shown. These 0/1 grids are the stitch motifs; the TTF preserves their square-cell outlines.`;
}

async function main() {
  const [sourceIndex, sourceData, modernIndex, frameIndex] = await Promise.all([
    fetch(sourceIndexUrl).then((response) => response.json()),
    fetch(sourceDataUrl).then((response) => response.json()),
    fetch(modernIndexUrl).then((response) => response.json()),
    fetch(frameIndexUrl).then((response) => response.json()),
  ]);
  const id = root.dataset.fontId;
  const sourceFont = sourceIndex.fonts.find((font) => font.id === id);
  const sourceDefinition = sourceData.fonts.find((font) => font.id === id);
  const modernFont = modernIndex.fonts.find((font) => font.id === id);
  const frame = frameIndex.groups.find((entry) => entry.sourceGroup === root.dataset.fontGroup);
  if (!sourceFont || !sourceDefinition || !modernFont || !frame) throw new Error("Font data or source-group frame is missing.");

  const familySource = `sjonabok-${id}`;
  const sourceFace = new FontFace(familySource, `url("../fonts/${sourceFont.filename}")`);
  document.fonts.add(await sourceFace.load());
  const specimen = make("p", "font-detail-specimen", "Sjónabókarstafróf · Á á Ð ð Þ þ Æ æ Ö ö");
  specimen.style.fontFamily = `"${familySource}"`;
  root.prepend(specimen);

  const sourceSheet = root.querySelector(`[data-glyph-sheet="${id}"]`);
  const sourceStatus = root.querySelector(".font-detail-status");
  const glyphs = sourceFont.glyphs || [];
  const additions = new Map(modernFont.additions.map((entry) => [entry.character, entry]));
  const modernStatus = root.querySelector(".font-modern-status");
  const modernSheet = root.querySelector(`[data-modern-sheet="${id}"]`);

  await renderGlyphs(sourceSheet, glyphs, sourceStatus);
  await renderGlyphs(modernSheet, modernFont.glyphs, modernStatus, additions);
  const sourceWidth = Math.max(1, ...sourceDefinition.glyphs.map((glyph) => Math.max(...glyph.rows.map((row) => row.length))));
  const columns = Math.min(6, Math.max(1, Math.ceil(Math.sqrt(glyphs.length))));
  addFrame(root.querySelector(".font-glyph-sheet-frame"), await matrixAt(`../${frame.matrixFile}`), frame.treatment, columns * (sourceWidth + 8));
}

main().catch((error) => {
  const status = root?.querySelector(".font-detail-status");
  if (status) status.textContent = `Font detail could not be loaded: ${error.message}`;
});
