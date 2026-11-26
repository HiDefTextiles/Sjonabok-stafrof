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

function matrixSvg(rows, label, pixel = 6, comparisonGrid = null, added = false) {
  const glyphWidth = Math.max(1, ...rows.map((row) => row.length));
  const glyphHeight = Math.max(1, rows.length);
  const width = comparisonGrid?.width || glyphWidth;
  const height = comparisonGrid?.height || glyphHeight;
  const offsetX = Math.floor((width - glyphWidth) / 2) * pixel;
  const offsetY = (height - glyphHeight) * pixel;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${width * pixel} ${height * pixel}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", label);
  svg.setAttribute("class", "font-matrix-svg");
  if (added) svg.classList.add("font-matrix-svg-alt");
  svg.style.setProperty("--matrix-width", `${width * pixel}px`);
  svg.style.setProperty("--matrix-height", `${height * pixel}px`);
  if (comparisonGrid) {
    for (let y = 5; y < height; y += 5) {
      const guide = document.createElementNS("http://www.w3.org/2000/svg", "line");
      guide.setAttribute("x1", "0");
      guide.setAttribute("x2", String(width * pixel));
      guide.setAttribute("y1", String(y * pixel));
      guide.setAttribute("y2", String(y * pixel));
      guide.setAttribute("class", "font-matrix-guide");
      svg.append(guide);
    }
    const baseline = document.createElementNS("http://www.w3.org/2000/svg", "line");
    baseline.setAttribute("x1", "0");
    baseline.setAttribute("x2", String(width * pixel));
    baseline.setAttribute("y1", String(height * pixel - 1));
    baseline.setAttribute("y2", String(height * pixel - 1));
    baseline.setAttribute("class", "font-matrix-guide-baseline");
    svg.append(baseline);
  }
  rows.forEach((row, y) => [...row].forEach((cell, x) => {
    if (cell !== "1") return;
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", String(offsetX + x * pixel));
    rect.setAttribute("y", String(offsetY + y * pixel));
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
  const sheet = frameElement.querySelector(".font-chart-original");
  frameElement.replaceChildren();
  frameElement.classList.add("has-corpus-frame");
  if (treatment === "repeat-border") {
    const top = make("div", "font-frame-horizontal");
    const bottom = make("div", "font-frame-horizontal font-frame-horizontal-bottom");
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
    const bottomCorners = corners.cloneNode(true);
    bottomCorners.classList.add("font-frame-corners-bottom");
    frameElement.append(corners, content, bottomCorners);
    frameElement.querySelectorAll(".font-frame-corner svg").forEach((svg) => svg.setAttribute("aria-hidden", "true"));
  }
}

function provenanceText(record, addition) {
  if (!addition) return "Source chart glyph";
  if (addition.method === "source-chart-shared-case") return `Source chart shared across letter case · ${addition.sourceFontId}`;
  if (addition.method === "same-manuscript-matching-glyph") {
    return `Same-manuscript glyph · ${addition.sourceFontId} · chart median height differs by ${addition.medianHeightDifference} stitch row(s)`;
  }
  return `Same-chart case form · ${addition.method || "method not recorded"}`;
}

async function renderGlyphs(sheet, glyphs, status, additions = new Map(), comparisonGrid = null) {
  sheet.replaceChildren();
  for (const glyph of glyphs) {
    const tile = make("article", "font-matrix-card");
    const label = make("h3", "font-matrix-label", glyph.character || "Unlabelled");
    tile.append(label);
    const txtFile = glyph.txtFile;
    try {
      const rows = await matrixAt(`../fonts/${txtFile}`);
      const provenance = additions.get(glyph.character);
      tile.append(matrixSvg(rows, `${glyph.character || "Unlabelled"} binary stitch chart`, 5, comparisonGrid, Boolean(provenance)));
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

function overviewSvg(glyphs, comparisonGrid) {
  const columns = 6;
  const pixel = 5;
  const labelBand = 20;
  const cellWidth = comparisonGrid.width * pixel + 20;
  const cellHeight = comparisonGrid.height * pixel + labelBand + 10;
  const rows = Math.ceil(glyphs.length / columns);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${columns * cellWidth} ${rows * cellHeight}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Alt font overview assembled from TXT grids with source, added, and missing forms marked by color");
  svg.classList.add("font-chart-overview-svg");

  glyphs.forEach((glyph, index) => {
    const glyphWidth = Math.max(1, ...glyph.rows.map((row) => row.length));
    const glyphHeight = Math.max(1, glyph.rows.length);
    const cellX = (index % columns) * cellWidth;
    const cellY = Math.floor(index / columns) * cellHeight;
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", String(cellX + cellWidth / 2));
    text.setAttribute("y", String(cellY + 14));
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("class", glyph.added ? "font-chart-overview-label font-chart-overview-label-alt" : "font-chart-overview-label");
    text.textContent = glyph.character || "Unlabelled";
    svg.append(text);

    if (glyph.missing) {
      const rosette = document.createElementNS("http://www.w3.org/2000/svg", "image");
      rosette.setAttribute("href", "../img/rosette-missing.svg");
      rosette.setAttribute("x", String(cellX + cellWidth / 2 - 12));
      rosette.setAttribute("y", String(cellY + labelBand + comparisonGrid.height * pixel / 2 - 12));
      rosette.setAttribute("width", "24");
      rosette.setAttribute("height", "24");
      rosette.setAttribute("aria-label", `Missing glyph ${glyph.character}`);
      svg.append(rosette);
      return;
    }

    const xOffset = cellX + Math.floor((comparisonGrid.width - glyphWidth) / 2) * pixel + 10;
    const yOffset = cellY + labelBand + (comparisonGrid.height - glyphHeight) * pixel;
    for (let guideY = 5; guideY < comparisonGrid.height; guideY += 5) {
      const guide = document.createElementNS("http://www.w3.org/2000/svg", "line");
      guide.setAttribute("x1", String(cellX + 10));
      guide.setAttribute("x2", String(cellX + cellWidth - 10));
      guide.setAttribute("y1", String(cellY + labelBand + guideY * pixel));
      guide.setAttribute("y2", String(cellY + labelBand + guideY * pixel));
      guide.setAttribute("class", "font-matrix-guide");
      svg.append(guide);
    }
    const baseline = document.createElementNS("http://www.w3.org/2000/svg", "line");
    baseline.setAttribute("x1", String(cellX + 10));
    baseline.setAttribute("x2", String(cellX + cellWidth - 10));
    baseline.setAttribute("y1", String(cellY + labelBand + comparisonGrid.height * pixel - 1));
    baseline.setAttribute("y2", String(cellY + labelBand + comparisonGrid.height * pixel - 1));
    baseline.setAttribute("class", "font-matrix-guide-baseline");
    svg.append(baseline);

    glyph.rows.forEach((row, y) => [...row].forEach((cell, x) => {
      if (cell !== "1") return;
      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("x", String(xOffset + x * pixel));
      rect.setAttribute("y", String(yOffset + y * pixel));
      rect.setAttribute("width", String(pixel));
      rect.setAttribute("height", String(pixel));
      if (glyph.added) rect.classList.add("font-chart-overview-glyph-alt");
      svg.append(rect);
    }));
  });
  return svg;
}

function setupPageNavigation() {
  const nav = root.querySelector(".font-page-nav");
  const navigate = (direction) => {
    const link = nav?.querySelector(`[data-direction="${direction}"]`);
    if (link) window.location.assign(link.href);
  };
  let start = null;
  document.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (/^(INPUT|TEXTAREA|SELECT|BUTTON)$/u.test(event.target.tagName) || event.target.isContentEditable) return;
    if (event.key === "ArrowLeft" && nav?.querySelector('[data-direction="previous"]')) {
      event.preventDefault();
      navigate("previous");
    }
    if (event.key === "ArrowRight" && nav?.querySelector('[data-direction="next"]')) {
      event.preventDefault();
      navigate("next");
    }
  });
  document.addEventListener("touchstart", (event) => {
    if (event.touches.length !== 1 || event.target.closest("a, button, input, textarea, select, [contenteditable='true']")) {
      start = null;
      return;
    }
    const touch = event.touches[0];
    start = { x: touch.clientX, y: touch.clientY };
  }, { passive: true });
  document.addEventListener("touchend", (event) => {
    if (!start || event.changedTouches.length !== 1) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    start = null;
    if (Math.abs(dx) < 65 || Math.abs(dx) < Math.abs(dy) * 1.25) return;
    navigate(dx < 0 ? "next" : "previous");
  }, { passive: true });
  document.addEventListener("touchcancel", () => { start = null; }, { passive: true });
}

function appendMissingGlyphs(sheet, missingCharacters) {
  for (const character of missingCharacters) {
    const tile = make("article", "font-matrix-card font-missing-card");
    tile.append(make("h3", "font-matrix-label", character));
    const marker = make("img", "font-missing-rosette");
    marker.src = "../img/rosette-missing.svg";
    marker.alt = `Rosette placeholder: no approved glyph for ${character}`;
    tile.append(marker, make("p", "font-provenance-badge", "No chart glyph or new reconstruction in this draft"));
    sheet.append(tile);
  }
}

async function main() {
  setupPageNavigation();
  const [sourceIndex, sourceData, modernIndex, frameIndex] = await Promise.all([
    fetch(sourceIndexUrl).then((response) => response.json()),
    fetch(sourceDataUrl).then((response) => response.json()),
    fetch(modernIndexUrl).then((response) => response.json()),
    fetch(frameIndexUrl).then((response) => response.json()),
  ]);
  const id = root.dataset.fontId;
  const sourceFont = sourceIndex.fonts.find((font) => font.id === id);
  const modernFont = modernIndex.fonts.find((font) => font.id === id);
  const frame = frameIndex.groups.find((entry) => entry.sourceGroup === root.dataset.fontGroup);
  if (!sourceFont || !modernFont || !frame) throw new Error("Font data or source-group frame is missing.");

  const sourceSheet = root.querySelector(`[data-glyph-sheet="${id}"]`);
  const sourceStatus = root.querySelector(".font-glyph-status");
  const glyphs = modernFont.glyphs || [];
  const additions = new Map(modernFont.additions.map((entry) => [entry.character, entry]));

  const allRows = sourceData.fonts.flatMap((font) => font.glyphs.flatMap((glyph) => glyph.rows || []));
  const comparisonGrid = {
    width: Math.max(1, ...allRows.map((row) => row.length)),
    height: Math.max(1, ...sourceData.fonts.flatMap((font) => font.glyphs.map((glyph) => (glyph.rows || []).length))),
  };
  const sourcePageRows = await matrixAt(`../fonts/${sourceFont.pageTxtFile}`);
  const sourcePage = matrixSvg(sourcePageRows, `${id} full unsplit chart TXT`, 1);
  sourcePage.classList.add("font-chart-original-svg");
  root.querySelector(`[data-chart-page="${id}"]`).append(sourcePage);
  const glyphByCharacter = new Map(glyphs.map((glyph) => [glyph.character, glyph]));
  const overviewItems = await Promise.all(modernFont.targetCharacters.map(async (character) => {
    const glyph = glyphByCharacter.get(character);
    if (!glyph) return { character, missing: true };
    const rows = await matrixAt(`../fonts/${glyph.txtFile}`);
    return { ...glyph, rows, added: additions.has(character) };
  }));
  root.querySelector(`[data-chart-overview="${id}"]`).append(overviewSvg(overviewItems, comparisonGrid));

  await renderGlyphs(sourceSheet, glyphs, sourceStatus, additions, comparisonGrid);
  appendMissingGlyphs(sourceSheet, modernFont.missingCharacters || []);
  sourceStatus.textContent = `${glyphs.length} available glyphs shown once; ${(modernFont.missingCharacters || []).length} missing characters use a teal rosette.`;
  const pageWidth = Math.max(1, ...sourcePageRows.map((row) => row.length));
  addFrame(root.querySelector(".font-glyph-sheet-frame"), await matrixAt(`../${frame.matrixFile}`), frame.treatment, pageWidth);
}

main().catch((error) => {
  const status = root?.querySelector(".font-detail-status");
  if (status) status.textContent = `Font detail could not be loaded: ${error.message}`;
});
