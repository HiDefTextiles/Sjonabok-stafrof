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

function installFontFace(font) {
  const id = `chart-font-${font.id}`;
  const family = `Chart ${font.id.replace(/[^a-z0-9]/giu, "-")}`;
  font.cssFamily = family;
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = `@font-face{font-family:"${family}";src:url("fonts/${font.filename}") format("truetype");font-display:swap}`;
  document.head.append(style);
}

function canonical(character) {
  return character.toLocaleUpperCase("is");
}

function compareKeys(left, right) {
  const leftChar = canonical(left), rightChar = canonical(right);
  const rank = (characterRank.get(leftChar) ?? 999) - (characterRank.get(rightChar) ?? 999);
  return rank || left.localeCompare(right, "is", { numeric: true });
}

function glyphMap(coverage) {
  const map = new Map();
  for (const character of [...coverage.letterLabels, ...coverage.numberLabels]) {
    const key = canonical(character);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(character);
  }
  return map;
}

function renderGlyphCell(font, characters) {
  const cell = el("div", `font-glyph-cell${characters.length ? "" : " is-missing"}`);
  if (!characters.length) {
    const mark = el("img", "font-missing-rosette");
    mark.src = "img/rosette-missing.svg";
    mark.alt = "Not charted";
    mark.title = "This character is not recorded on this chart";
    cell.append(mark, el("small", "", "Not charted"));
    return cell;
  }
  for (const character of characters) {
    const glyph = el("span", "font-glyph-shape", character);
    glyph.style.fontFamily = `"${font.cssFamily}"`;
    glyph.setAttribute("aria-label", `${character}, from ${chartLabel(font)}`);
    cell.append(glyph);
  }
  const caption = characters.length > 1 ? characters.join(" · ") : `Chart label: ${characters[0]}`;
  cell.append(el("small", "", caption));
  return cell;
}

function renderPair(pair, fontsById, coverageById) {
  const root = document.querySelector("#selected-pair-grid");
  const note = document.querySelector("#selected-pair-note");
  const left = fontsById.get(pair.left), right = fontsById.get(pair.right);
  const leftMap = glyphMap(coverageById.get(pair.left));
  const rightMap = glyphMap(coverageById.get(pair.right));
  const labels = [...new Set([...leftMap.keys(), ...rightMap.keys()])].sort(compareKeys);
  const filter = document.querySelector("#glyph-filter").value;
  const sharedCount = labels.filter((label) => leftMap.has(label) && rightMap.has(label)).length;
  const rows = labels.filter((label) => {
    const shared = leftMap.has(label) && rightMap.has(label);
    if (filter === "shared") return shared;
    if (filter === "different") return !shared;
    return true;
  });
  note.replaceChildren(
    linkFor(left, chartLabel(left)), el("span", "font-pair-separator", "and"), linkFor(right, chartLabel(right)),
    el("p", "", `${sharedCount} character labels appear on both charts. Similarity screen: ${Math.round(pair.score * 100)}% across ${pair.sharedLetters.length} shared letters. This score is exploratory; inspect the glyphs and source pages before treating charts as a family.`),
  );
  root.replaceChildren();
  const header = el("div", "font-glyph-row is-header");
  header.append(el("strong", "font-glyph-label", "Character"), linkFor(left, chartLabel(left)), linkFor(right, chartLabel(right)));
  root.append(header);
  for (const label of rows) {
    const row = el("div", `font-glyph-row${leftMap.has(label) && rightMap.has(label) ? " is-shared" : " is-one-sided"}`);
    row.append(
      el("strong", "font-glyph-label", label),
      renderGlyphCell(left, leftMap.get(label) || []),
      renderGlyphCell(right, rightMap.get(label) || []),
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
  const coverageById = new Map(report.chartCoverage.map((chart) => [chart.id, chart]));
  const pairs = report.closePagePairScreen.pairs;
  const summary = document.querySelector("#similarity-overview");
  summary.replaceChildren(el("p", "", `${report.dataset.sourceFontCount} charts compared · ${pairs.length} closest pairs available`));
  const selector = document.querySelector("#similar-chart-pair");
  for (const pair of pairs) {
    const left = fontsById.get(pair.left), right = fontsById.get(pair.right);
    const option = el("option", "", `${chartLabel(left)} ↔ ${chartLabel(right)}`);
    option.value = `${pair.left}|${pair.right}`;
    selector.append(option);
  }
  const update = () => {
    const [left, right] = selector.value.split("|");
    const pair = pairs.find((item) => item.left === left && item.right === right);
    if (pair) renderPair(pair, fontsById, coverageById);
  };
  selector.addEventListener("change", update);
  document.querySelector("#glyph-filter").addEventListener("change", update);
  if (pairs.length) update();
  renderCoverage(report, fontsById);
  renderRepeats(report, fontsById);
  status.textContent = `${report.dataset.sourceFontCount} chart pages compared. Choose a pair to compare their glyphs.`;
}

main().catch((error) => { status.textContent = `Chart comparisons could not be loaded: ${error.message}`; });
