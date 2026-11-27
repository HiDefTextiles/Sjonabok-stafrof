const status = document.querySelector("#similarity-page-status");
const alphabetOrder = [..."AÁBCDÐEÉFGHIÍJKLMNOÓPQRSTUÚVWXYÝZÞÆÖ"];
const characterRank = new Map(alphabetOrder.map((character, index) => [character, index]));

function el(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined) node.textContent = value;
  return node;
}

function linkFor(font, label = font.name) {
  const link = el("a", "", label);
  link.href = `font-pages/${font.id}.html`;
  return link;
}

function chartLabel(font) {
  return font.name.replace(/^Sjónabók\s+/u, "");
}

function canonical(character) {
  return character.toLocaleUpperCase("is");
}

function compareKeys(left, right) {
  const leftChar = canonical(left), rightChar = canonical(right);
  const rank = (characterRank.get(leftChar) ?? 999) - (characterRank.get(rightChar) ?? 999);
  return rank || left.localeCompare(right, "is", { numeric: true });
}

function glyphMap(detail) {
  const map = new Map();
  const originalCharacters = new Set(detail.modernFont.sourceCharacters);
  for (const glyph of detail.modernFont.glyphs) {
    const character = glyph.character;
    if (!originalCharacters.has(character)) continue;
    const key = canonical(character);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push({ character, rows: glyph.rows });
  }
  return map;
}

function matrixSvg(glyph, grid) {
  const pixel = 5, width = grid.width * pixel, height = grid.height * pixel;
  const glyphWidth = Math.max(1, ...glyph.rows.map((row) => row.length));
  const glyphHeight = glyph.rows.length;
  const left = Math.floor((grid.width - glyphWidth) / 2) * pixel;
  const top = (grid.height - glyphHeight) * pixel;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", `TXT glyph ${glyph.character}`);
  svg.classList.add("font-glyph-svg");
  for (let y = 5; y < grid.height; y += 5) {
    const guide = document.createElementNS("http://www.w3.org/2000/svg", "line");
    guide.setAttribute("x1", "0"); guide.setAttribute("x2", String(width));
    guide.setAttribute("y1", String(y * pixel)); guide.setAttribute("y2", String(y * pixel));
    guide.classList.add("font-glyph-guide");
    svg.append(guide);
  }
  glyph.rows.forEach((row, y) => [...row].forEach((bit, x) => {
    if (bit !== "1") return;
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", String(left + x * pixel));
    rect.setAttribute("y", String(top + y * pixel));
    rect.setAttribute("width", String(pixel)); rect.setAttribute("height", String(pixel));
    rect.classList.add("font-glyph-pixel");
    svg.append(rect);
  }));
  const baseline = document.createElementNS("http://www.w3.org/2000/svg", "line");
  baseline.setAttribute("x1", "0"); baseline.setAttribute("x2", String(width));
  baseline.setAttribute("y1", String(height - 1)); baseline.setAttribute("y2", String(height - 1));
  baseline.classList.add("font-glyph-baseline");
  svg.append(baseline);
  return svg;
}

function renderGlyphCell(glyphs, grid) {
  const cell = el("div", `font-glyph-cell${glyphs.length ? "" : " is-missing"}`);
  if (!glyphs.length) {
    const mark = el("img", "font-missing-rosette");
    mark.src = "img/rosette-missing.svg";
    mark.alt = "Not charted";
    mark.title = "This character is not recorded on this chart";
    cell.append(mark, el("small", "", "Not charted"));
    return cell;
  }
  for (const glyph of glyphs) cell.append(matrixSvg(glyph, grid));
  const caption = glyphs.length > 1 ? glyphs.map((glyph) => glyph.character).join(" · ") : `Chart label: ${glyphs[0].character}`;
  cell.append(el("small", "", caption));
  return cell;
}

const detailCache = new Map();
async function loadDetail(id) {
  if (!detailCache.has(id)) {
    detailCache.set(id, fetch(`fonts/font-detail-data/${id}.json`).then((response) => {
      if (!response.ok) throw new Error(`TXT glyph data for ${id} could not be loaded.`);
      return response.json();
    }));
  }
  return detailCache.get(id);
}

let renderVersion = 0;
async function renderPair(leftId, rightId, report, fontsById) {
  const version = ++renderVersion;
  const root = document.querySelector("#selected-pair-grid");
  const note = document.querySelector("#selected-pair-note");
  const left = fontsById.get(leftId), right = fontsById.get(rightId);
  if (leftId === rightId) {
    note.textContent = "Choose two different charts to compare.";
    root.replaceChildren();
    return;
  }
  const pair = report.pagePairs.find((item) =>
    (item.left === leftId && item.right === rightId) || (item.left === rightId && item.right === leftId));
  root.replaceChildren(el("p", "font-research-empty", "Loading the two TXT glyph charts…"));
  let leftDetail, rightDetail;
  try {
    [leftDetail, rightDetail] = await Promise.all([loadDetail(leftId), loadDetail(rightId)]);
  } catch (error) {
    if (version === renderVersion) root.replaceChildren(el("p", "font-research-empty", error.message));
    return;
  }
  if (version !== renderVersion) return;
  const leftMap = glyphMap(leftDetail);
  const rightMap = glyphMap(rightDetail);
  const labels = [...new Set([...leftMap.keys(), ...rightMap.keys()])].sort(compareKeys);
  const filter = document.querySelector("#glyph-filter").value;
  const sharedCount = labels.filter((label) => leftMap.has(label) && rightMap.has(label)).length;
  const rows = labels.filter((label) => {
    const shared = leftMap.has(label) && rightMap.has(label);
    if (filter === "shared") return shared;
    if (filter === "different") return !shared;
    return true;
  });
  const scoreNote = pair
    ? `Similarity screen: ${Math.round(pair.score * 100)}% across ${pair.sharedLetters.length} shared letters. This score is exploratory; inspect the glyphs and source pages before treating charts as a family.`
    : "No similarity score is shown because these charts share fewer than three recorded letters.";
  note.replaceChildren(
    linkFor(left, chartLabel(left)), el("span", "font-pair-separator", "and"), linkFor(right, chartLabel(right)),
    el("p", "", `${sharedCount} character labels appear on both charts. ${scoreNote}`),
  );
  root.replaceChildren();
  const header = el("div", "font-glyph-row is-header");
  header.append(el("strong", "font-glyph-label", "Character"), linkFor(left, chartLabel(left)), linkFor(right, chartLabel(right)));
  root.append(header);
  for (const label of rows) {
    const row = el("div", `font-glyph-row${leftMap.has(label) && rightMap.has(label) ? " is-shared" : " is-one-sided"}`);
    row.append(
      el("strong", "font-glyph-label", label),
      renderGlyphCell(leftMap.get(label) || [], leftDetail.comparisonGrid),
      renderGlyphCell(rightMap.get(label) || [], rightDetail.comparisonGrid),
    );
    root.append(row);
  }
  if (!rows.length) root.append(el("p", "font-research-empty", "No characters match this filter."));
  root.setAttribute("aria-label", `Aligned glyph comparison for ${chartLabel(left)} and ${chartLabel(right)}`);
}

function renderCoverage(report, fontsById) {
  const coverageRoot = document.querySelector("#chart-coverage");
  const groups = new Map();
  for (const chart of report.chartCoverage) {
    if (!groups.has(chart.manuscriptGroup)) groups.set(chart.manuscriptGroup, []);
    groups.get(chart.manuscriptGroup).push(chart);
  }
  for (const [, charts] of groups) {
    const details = el("details", "font-coverage-group");
    const firstFont = fontsById.get(charts[0].id);
    const friendlyGroupName = chartLabel(firstFont).replace(/\s+\d+$/u, "");
    details.append(el("summary", "", `${friendlyGroupName} · ${charts.length} charts`));
    const list = el("div", "font-coverage-cards");
    for (const chart of charts) {
      const card = el("article", "font-coverage-card");
      const font = fontsById.get(chart.id);
      card.append(linkFor(font, chartLabel(font)), el("small", "", `${chart.glyphCount} glyphs · ${chart.letterStyle}`));
      if (chart.letterLabels.length) card.append(el("p", "", `Letters: ${chart.letterLabels.join(" ")}`));
      if (chart.numberLabels.length) card.append(el("p", "", `Numbers: ${chart.numberLabels.join(" ")}`));
      list.append(card);
    }
    details.append(list);
    coverageRoot.append(details);
  }
}

function renderRepeats(report, fontsById) {
  const container = document.querySelector("#exact-repeats");
  const details = el("details", "font-research-details");
  details.append(el("summary", "", `${report.exactLetterShapeSummary.repeatedShapeGroupCount} letter shapes repeat exactly across charts`));
  const list = el("ul", "font-repeat-list");
  for (const entry of report.exactShapeGroups.slice(0, 20)) {
    const item = el("li");
    item.append(el("strong", "", entry.character), document.createTextNode(" · "));
    entry.fontIds.forEach((id, index) => {
      if (index) item.append(document.createTextNode(", "));
      const font = fontsById.get(id);
      item.append(linkFor(font, chartLabel(font)));
    });
    list.append(item);
  }
  details.append(list);
  if (report.exactShapeGroups.length > 20) details.append(el("p", "font-research-empty", `Showing 20 of ${report.exactShapeGroups.length} repeated letter-shape groups.`));
  const numberNote = report.exactNumberShapeSummary.matchingGlyphPairCount === 0
    ? "No exact repeated number shapes were found."
    : `${report.exactNumberShapeSummary.matchingGlyphPairCount} exact number-shape pairs were found.`;
  details.append(el("p", "font-research-empty", numberNote));
  container.append(details);
}

async function main() {
  const [reportResponse, indexResponse] = await Promise.all([
    fetch("fonts/similarity-metrics.json"), fetch("fonts/font-index.json"),
  ]);
  if (!reportResponse.ok || !indexResponse.ok) throw new Error("Chart comparison data could not be loaded.");
  const [report, index] = await Promise.all([reportResponse.json(), indexResponse.json()]);
  const fontsById = new Map(index.fonts.map((font) => [font.id, font]));
  const summary = document.querySelector("#similarity-overview");
  summary.replaceChildren(el("p", "", `${report.dataset.sourceFontCount} charts available to compare · choose any two below`));
  const leftSelect = document.querySelector("#chart-left");
  const rightSelect = document.querySelector("#chart-right");
  for (const chart of report.chartCoverage) {
    const font = fontsById.get(chart.id);
    for (const selector of [leftSelect, rightSelect]) {
      const option = el("option", "", chartLabel(font));
      option.value = chart.id;
      selector.append(option);
    }
  }
  const bestPair = report.closePagePairScreen.pairs[0];
  leftSelect.value = bestPair?.left || report.chartCoverage[0].id;
  rightSelect.value = bestPair?.right || report.chartCoverage.find((chart) => chart.id !== leftSelect.value).id;
  const update = () => {
    renderPair(leftSelect.value, rightSelect.value, report, fontsById);
  };
  leftSelect.addEventListener("change", update);
  rightSelect.addEventListener("change", update);
  document.querySelector("#glyph-filter").addEventListener("change", update);
  if (report.chartCoverage.length > 1) update();
  renderCoverage(report, fontsById);
  renderRepeats(report, fontsById);
  status.textContent = `${report.dataset.sourceFontCount} chart pages available. Choose any two charts to compare their glyphs.`;
}

main().catch((error) => { status.textContent = `Chart comparisons could not be loaded: ${error.message}`; });
