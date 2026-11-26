const status = document.querySelector("#similarity-page-status");
const fmtScore = (value) => `${(value * 100).toFixed(1)}%`;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function linkedPages(ids) {
  const list = el("span");
  ids.forEach((id, index) => {
    if (index) list.append(document.createTextNode(", "));
    const link = el("a", "", id);
    link.href = `font-pages/${id}.html`;
    list.append(link);
  });
  return list;
}

function table(container, headings, rows) {
  if (!rows.length) {
    container.append(el("p", "font-research-empty", "No matches in this screen."));
    return;
  }
  const tableNode = el("table", "font-research-table");
  const head = el("thead"), headRow = el("tr");
  headings.forEach((heading) => headRow.append(el("th", "", heading)));
  head.append(headRow);
  const body = el("tbody");
  rows.forEach((values) => {
    const row = el("tr");
    values.forEach((value) => {
      const cell = el("td");
      if (value instanceof Node) cell.append(value);
      else cell.textContent = value;
      row.append(cell);
    });
    body.append(row);
  });
  tableNode.append(head, body);
  container.replaceChildren(tableNode);
}

function metricCard(label, value, note) {
  const card = el("article", "font-research-metric");
  card.append(el("strong", "font-research-metric-value", value), el("span", "font-research-metric-label", label));
  if (note) card.append(el("small", "", note));
  return card;
}

async function main() {
  const response = await fetch("fonts/similarity-metrics.json");
  if (!response.ok) throw new Error("Similarity data could not be loaded.");
  const report = await response.json();
  const exactLetters = report.exactLetterShapeSummary;
  const exactNumbers = report.exactNumberShapeSummary;
  const closeGlyphs = report.closeGlyphMatchScreen;
  const closePages = report.closePagePairScreen.pairs;
  const closestWithin = report.closestWithinManuscriptPairs;
  const topWithin = closestWithin[0];
  const overview = document.querySelector("#similarity-overview");
  overview.append(
    metricCard("chart pages", String(report.dataset.sourceFontCount)),
    metricCard("source ID groups", String(report.dataset.manuscriptGroups)),
    metricCard("exact letter-shape pairs", String(exactLetters.matchingGlyphPairCount), `${exactLetters.withinManuscriptPairCount} within groups · ${exactLetters.acrossManuscriptPairCount} across groups`),
    metricCard("exact number-shape pairs", String(exactNumbers.matchingGlyphPairCount)),
    metricCard("close letter candidates", String(closeGlyphs.matchCount), `Jaccard ≥ ${fmtScore(closeGlyphs.threshold)}`),
    metricCard("close page pairs", String(closePages.length), `Mean Jaccard ≥ ${fmtScore(report.closePagePairScreen.threshold)}`),
  );

  const exactContainer = document.querySelector("#exact-repeats");
  const groups = report.exactShapeGroups;
  const repeatedDetails = el("details", "font-research-details");
  repeatedDetails.append(el("summary", "", `Letter shapes repeated across charts (${groups.length} shape groups)`));
  const repeatedTable = el("div", "font-research-table-wrap");
  table(repeatedTable, ["Letter", "Chart pages", "Matching pairs"], groups.map((entry) => [entry.character, linkedPages(entry.fontIds), String(entry.pairCount)]));
  repeatedDetails.append(repeatedTable);
  exactContainer.append(repeatedDetails);

  const numberDetails = el("details", "font-research-details");
  numberDetails.append(el("summary", "", `Exact number shapes (${report.exactNumberShapeGroups.length} repeated shape groups)`));
  const numberTable = el("div", "font-research-table-wrap");
  table(numberTable, ["Number", "Chart pages", "Matching pairs"], report.exactNumberShapeGroups.map((entry) => [entry.character, linkedPages(entry.fontIds), String(entry.pairCount)]));
  numberDetails.append(numberTable);
  exactContainer.append(numberDetails);

  table(document.querySelector("#close-glyph-matches"), ["Letter", "Chart pages", "Same source group?", "Jaccard"], closeGlyphs.matches.map((match) => [
    match.character, linkedPages([match.left, match.right]), match.sameManuscript ? "Yes" : "No", fmtScore(match.score),
  ]));
  table(document.querySelector("#close-page-pairs"), ["Chart pages", "Shared labels", "Same source group?", "Mean Jaccard"], closePages.map((pair) => [
    linkedPages([pair.left, pair.right]), `${pair.sharedLetters.length}: ${pair.sharedLetters.join(" ")}`, pair.sameManuscript ? "Yes" : "No", fmtScore(pair.score),
  ]));

  const withinContainer = el("div", "font-research-table-wrap");
  table(withinContainer, ["Chart pages", "Shared labels", "Mean Jaccard"], closestWithin.map((pair) => [
    linkedPages([pair.left, pair.right]), `${pair.sharedLetters.length}: ${pair.sharedLetters.join(" ")}`, fmtScore(pair.score),
  ]));
  const withinDetails = el("details", "font-research-details");
  withinDetails.append(el("summary", "", "Closest pairs within the same source ID group"), withinContainer);
  document.querySelector("#close-page-pairs").after(withinDetails);

  const coverageRoot = document.querySelector("#chart-coverage");
  const groupsById = new Map();
  for (const chart of report.chartCoverage) {
    if (!groupsById.has(chart.manuscriptGroup)) groupsById.set(chart.manuscriptGroup, []);
    groupsById.get(chart.manuscriptGroup).push(chart);
  }
  for (const [groupId, charts] of groupsById) {
    const details = el("details", "font-coverage-group");
    details.append(el("summary", "", `${groupId} · ${charts.length} chart pages`));
    const list = el("div", "font-coverage-cards");
    for (const chart of charts) {
      const card = el("article", "font-coverage-card");
      const link = el("a", "font-coverage-title", chart.id);
      link.href = `font-pages/${chart.id}.html`;
      card.append(link, el("small", "", `${chart.glyphCount} charted glyphs · ${chart.letterStyle}`));
      if (chart.letterLabels.length) card.append(el("p", "", `Letters (${chart.letterLabels.length}): ${chart.letterLabels.join(" ")}`));
      if (chart.numberLabels.length) card.append(el("p", "", `Numbers (${chart.numberLabels.length}): ${chart.numberLabels.join(" ")}`));
      list.append(card);
    }
    details.append(list);
    coverageRoot.append(details);
  }

  const notes = document.querySelector("#consolidation-notes");
  const topText = topWithin
    ? `The closest same-group pair is ${topWithin.left} and ${topWithin.right}: ${fmtScore(topWithin.score)} across ${topWithin.sharedLetters.length} shared labels.`
    : "There are no same-group page pairs with enough shared labels to compare.";
  const sameGroupAboveScreen = closestWithin.filter((pair) => pair.score >= report.closePagePairScreen.threshold).length;
  notes.append(
    el("p", "", `${topText} ${sameGroupAboveScreen === 0 ? `No within-group pair reaches the ${fmtScore(report.closePagePairScreen.threshold)} review screen.` : `${sameGroupAboveScreen} within-group pairs reach the ${fmtScore(report.closePagePairScreen.threshold)} review screen.`}`),
    el("p", "", "A composite TTF could technically combine glyphs from multiple charts. The current scores and coverage lists do not identify a single ‘true’ representative: some charts are partial, and a source ID group can contain visibly different letterforms. Keep the per-chart Org fonts as the evidence; treat any combined font as a provisional, fully attributed research draft until its overlapping glyphs and page context are reviewed."),
  );
  status.textContent = `${report.dataset.sourceFontCount} chart pages analyzed; exact repeats and exploratory close-match screens are listed below.`;
}

main().catch((error) => { status.textContent = `Similarity report could not be loaded: ${error.message}`; });
