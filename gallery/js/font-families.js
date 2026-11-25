const grid = document.querySelector("#font-family-grid");
const status = document.querySelector("#font-groups-status");
const summary = document.querySelector("#font-similarity-summary");

function text(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = value;
  return node;
}

function matrixSvg(rows, label) {
  const width = Math.max(1, ...rows.map((row) => row.length));
  const height = rows.length;
  const cell = Math.max(1, Math.min(5, Math.floor(220 / Math.max(width, height))));
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${width * cell} ${height * cell}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", label);
  svg.classList.add("font-frame-motif");
  rows.forEach((row, y) => [...row].forEach((bit, x) => {
    if (bit !== "1") return;
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", String(x * cell));
    rect.setAttribute("y", String(y * cell));
    rect.setAttribute("width", String(cell));
    rect.setAttribute("height", String(cell));
    svg.append(rect);
  }));
  return svg;
}

async function renderGroup(frame, metrics, fonts) {
  const card = text("article", "font-family-card", "");
  const heading = text("h2", "", frame.sourceGroup);
  const groupFonts = fonts.filter((font) => font.id.startsWith(frame.sourceGroup + "_") || font.id === frame.sourceGroup);
  const pages = text("p", "", `${frame.fontCount} chart pages in this source-ID group`);
  const chosen = text("p", "", `Frame motif: ${frame.patternId} · ${frame.patternKind} · ${frame.treatment}`);
  const rationale = text("p", "", frame.rationale);
  const response = await fetch(`patterns/txt/${frame.patternId}.txt`);
  if (response.ok) card.append(matrixSvg((await response.text()).split(/\r?\n/u).filter((row) => /^[01]+$/u.test(row)), `Sjónabók pattern ${frame.patternId}`));
  const stats = metrics.find((item) => item.id === frame.sourceGroup);
  if (stats) card.append(text("p", "font-group-metric", `Within-group page pairs: ${stats.pairCount}; mean silhouette Jaccard ${stats.mean.toFixed(3)} (range ${stats.min.toFixed(3)}–${stats.max.toFixed(3)}).`));
  const linkList = document.createElement("ul");
  for (const font of groupFonts) {
    const item = document.createElement("li"), link = document.createElement("a");
    link.href = `font-pages/${font.id}.html`;
    link.textContent = font.name;
    item.append(link);
    linkList.append(item);
  }
  card.append(heading, pages, chosen, rationale, linkList);
  return card;
}

async function main() {
  const [frames, metrics, fonts] = await Promise.all([
    fetch("fonts/font-group-frames.json").then((response) => response.json()),
    fetch("fonts/similarity-metrics.json").then((response) => response.json()),
    fetch("fonts/font-index.json").then((response) => response.json()).then((data) => data.fonts),
  ]);
  for (const frame of frames.groups) grid.append(await renderGroup(frame, metrics.withinManuscript, fonts));
  const within = metrics.overall.withinManuscript, across = metrics.overall.acrossManuscripts;
  const table = document.createElement("table");
  table.className = "table table-sm";
  table.innerHTML = "<thead><tr><th>Comparison</th><th>Pairs</th><th>Mean Jaccard</th><th>Median</th></tr></thead>";
  const body = document.createElement("tbody");
  for (const [label, value] of [["Within source-ID group", within], ["Across source-ID groups", across]]) {
    const row = document.createElement("tr");
    for (const cell of [label, value.pairCount, value.mean.toFixed(3), value.median.toFixed(3)]) row.append(text("td", "", String(cell)));
    body.append(row);
  }
  table.append(body);
  summary.append(table, text("p", "font-similarity-caveat", "Pair comparisons share source pages and are not independent. These are descriptive silhouette scores, not evidence of historical family relationships or a goodness-of-fit validation."));
  status.textContent = `${frames.groups.length} source-ID groups and corpus-selected TXT frame motifs loaded.`;
}

main().catch((error) => { status.textContent = `Font groups could not be loaded: ${error.message}`; });
