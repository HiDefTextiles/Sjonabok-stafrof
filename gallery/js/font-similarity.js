const status = document.querySelector("#similarity-page-status");

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
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  const family = `Chart ${font.id.replace(/[^a-z0-9]/giu, "-")}`;
  style.textContent = `@font-face{font-family:"${family}";src:url("fonts/${font.filename}") format("truetype");font-display:swap}`;
  document.head.append(style);
  font.cssFamily = family;
}

function renderPair(pair, fontsById, coverageById) {
  const root = document.querySelector("#selected-pair-cloud");
  const note = document.querySelector("#selected-pair-note");
  const left = fontsById.get(pair.left), right = fontsById.get(pair.right);
  const leftCoverage = coverageById.get(pair.left), rightCoverage = coverageById.get(pair.right);
  if (!left || !right || !leftCoverage || !rightCoverage) return;
  installFontFace(left); installFontFace(right);
  const rightLabels = new Set([...rightCoverage.letterLabels, ...rightCoverage.numberLabels].map((character) => character.toLocaleUpperCase("is")));
  const leftLabels = new Set([...leftCoverage.letterLabels, ...leftCoverage.numberLabels].map((character) => character.toLocaleUpperCase("is")));
  const sharedLabels = new Set([...leftLabels].filter((character) => rightLabels.has(character)));
  note.replaceChildren(
    linkFor(left, chartLabel(left)), el("span", "font-pair-separator", "and"), linkFor(right, chartLabel(right)),
    el("p", "", `${sharedLabels.size} shared character labels · similarity screen ${Math.round(pair.score * 100)}% across ${pair.sharedLetters.length} letters. This score is a visual comparison aid, not proof that the charts are one family.`),
  );
  root.replaceChildren();
  const samples = [];
  for (const [font, coverage] of [[left, leftCoverage], [right, rightCoverage]]) {
    const labels = [...coverage.letterLabels, ...coverage.numberLabels];
    for (const character of labels) samples.push({ font, character, shared: sharedLabels.has(character.toLocaleUpperCase("is")) });
  }
  samples.sort((a, b) => a.character.localeCompare(b.character, "is") || a.font.id.localeCompare(b.font.id));
  for (const sample of samples) {
    const item = el("div", `font-glyph-sample${sample.shared ? " is-shared" : " is-unique"}`);
    const glyph = el("span", "font-glyph-shape", sample.character);
    glyph.style.fontFamily = `"${sample.font.cssFamily}"`;
    glyph.setAttribute("aria-label", `${sample.character}, ${chartLabel(sample.font)}`);
    item.append(glyph, el("small", "", chartLabel(sample.font)));
    root.append(item);
  }
  root.setAttribute("aria-label", `Glyph comparison for ${chartLabel(left)} and ${chartLabel(right)}`);
}

function renderCoverage(report, fontsById) {
  const coverageRoot = document.querySelector("#chart-coverage");
  const groups = new Map();
  for (const chart of report.chartCoverage) {
    if (!groups.has(chart.manuscriptGroup)) groups.set(chart.manuscriptGroup, []);
    groups.get(chart.manuscriptGroup).push(chart);
  }
  for (const [groupId, charts] of groups) {
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
  const overview = document.querySelector("#similarity-overview");
  overview.append(
    el("div", "font-research-metric", `${report.dataset.sourceFontCount} chart pages compared`),
    el("div", "font-research-metric", `${pairs.length} close chart pairs to explore`),
    el("div", "font-research-metric", `${report.exactLetterShapeSummary.matchingGlyphPairCount} exact matching letter pairs`),
  );
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
  if (pairs.length) update();
  renderCoverage(report, fontsById);
  renderRepeats(report, fontsById);
  status.textContent = `${report.dataset.sourceFontCount} chart pages compared. Choose a close pair above to explore its glyphs.`;
}

main().catch((error) => { status.textContent = `Chart comparisons could not be loaded: ${error.message}`; });
