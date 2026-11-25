const textInput = document.querySelector("#font-text");
const variantSelect = document.querySelector("#font-variant");
const grid = document.querySelector("#font-grid");
const status = document.querySelector("#font-status");
const sourceIndexUrl = "fonts/font-index.json";
const modernIndexUrl = "fonts/modern-alt-index.json";
const loadedFamilies = new Set();

async function addFontFace(family, url) {
  if (loadedFamilies.has(family)) return;
  const face = new FontFace(family, `url("${url}")`);
  const loaded = await face.load();
  document.fonts.add(loaded);
  loadedFamilies.add(family);
}

function element(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined) node.textContent = value;
  return node;
}

function appendSample(sample, text, supported, showMissing) {
  sample.replaceChildren();
  for (const character of text) {
    if (showMissing && /\p{L}/u.test(character) && !supported.has(character)) {
      const marker = element("span", "font-missing-glyph");
      marker.setAttribute("aria-label", `Missing source chart for ${character}`);
      marker.title = `No chart for ${character} in this source alphabet`;
      const image = document.createElement("img");
      image.src = "fonts/missing-mark.svg";
      image.alt = "";
      image.setAttribute("aria-hidden", "true");
      marker.append(image);
      sample.append(marker);
    } else {
      sample.append(document.createTextNode(character));
    }
  }
}

function updateNotes(note, text, sourceCharacters, altFont, modernMode) {
  note.replaceChildren();
  const letters = [...new Set([...text].filter((character) => /\p{L}/u.test(character)))];
  if (!modernMode) {
    const missing = letters.filter((character) => !sourceCharacters.has(character));
    if (missing.length) {
      note.append(element("strong", "", "No source chart in this alphabet:"));
      note.append(element("p", "", missing.join(" ")));
      note.append(element("small", "", "The manuscript mark in the preview stands in for each missing chart."));
    } else {
      note.append(element("p", "", "Every letter in this sample has a chart in this alphabet."));
    }
    return;
  }

  const additions = new Map(altFont.additions.map((entry) => [entry.character, entry]));
  const usedAdditions = letters.map((character) => additions.get(character)).filter(Boolean);
  const sourceOnly = letters.filter((character) => !altFont.characters.includes(character));
  if (usedAdditions.length) {
    const addedCharacters = [...new Set(usedAdditions.map((entry) => entry.character))];
    note.append(element("strong", "", "Modern-alt letters supplied:"));
    note.append(element("p", "", addedCharacters.join(" ")));
    const accents = usedAdditions.filter((entry) => entry.accent);
    if (accents.length) note.append(element("small", "", "Accents are drawn as two stitch-grid cells above the base chart."));
    const donors = [...new Set(usedAdditions.filter((entry) => entry.method === "sibling-chart").map((entry) => entry.sourceFontId))];
    if (donors.length) note.append(element("small", "", `Sibling charts used: ${donors.join(", ")}`));
  } else {
    note.append(element("p", "", "The typed letters are already present in this source alphabet."));
  }
  if (sourceOnly.length) note.append(element("small", "", `Outside this modern set: ${[...new Set(sourceOnly)].join(" ")}`));
}

function createCard(sourceFont, altFont, families) {
  const card = element("article", "font-card");
  const head = element("div", "font-card-head");
  const heading = element("h2", "", sourceFont.name);
  const download = element("div", "font-downloads");
  const sourceLink = element("a", "", "Source TTF");
  sourceLink.href = `fonts/${sourceFont.filename}`;
  sourceLink.download = sourceFont.filename;
  const altLink = element("a", "", "Modern alt TTF");
  altLink.href = `fonts/modern-alt/${altFont.filename}`;
  altLink.download = altFont.filename;
  download.append(sourceLink, altLink);
  head.append(heading, download);

  const body = element("div", "font-card-body");
  const sample = element("p", "font-preview");
  const notes = element("aside", "font-notes");
  notes.setAttribute("aria-label", "Letter availability");
  body.append(sample, notes);
  card.append(head, body);

  const sourceCharacters = new Set(sourceFont.characters || []);
  function render(text, mode) {
    const modernMode = mode === "modern-alt";
    const family = modernMode ? families.modern : families.source;
    sample.style.fontFamily = `"${family}"`;
    sample.dataset.variant = mode;
    appendSample(sample, text, modernMode ? new Set(altFont.characters) : sourceCharacters, !modernMode);
    updateNotes(notes, text, sourceCharacters, altFont, modernMode);
  }
  return { card, render };
}

async function start() {
  const [sourceResponse, modernResponse] = await Promise.all([fetch(sourceIndexUrl), fetch(modernIndexUrl)]);
  if (!sourceResponse.ok || !modernResponse.ok) throw new Error("Font index files could not be loaded.");
  const sourceIndex = await sourceResponse.json();
  const modernIndex = await modernResponse.json();
  const modernById = new Map(modernIndex.fonts.map((font) => [font.id, font]));
  const cards = [];
  for (const sourceFont of sourceIndex.fonts) {
    const altFont = modernById.get(sourceFont.id);
    if (!altFont) continue;
    const families = { source: `sjonabok-${sourceFont.id}`, modern: `sjonabok-${sourceFont.id}-modern-alt` };
    const card = createCard(sourceFont, altFont, families);
    grid.append(card.card);
    cards.push({ ...card, families, sourceFont, altFont });
  }

  const initialMode = variantSelect.value;
  const loadFaces = cards.map(({ families, sourceFont, altFont }) => {
    const family = initialMode === "modern-alt" ? families.modern : families.source;
    const filename = initialMode === "modern-alt" ? `fonts/modern-alt/${altFont.filename}` : `fonts/${sourceFont.filename}`;
    return addFontFace(family, filename).catch(() => undefined);
  });
  const loadedResults = await Promise.allSettled(loadFaces);
  const render = () => cards.forEach((card) => card.render(textInput.value, variantSelect.value));
  render();
  textInput.addEventListener("input", render);
  variantSelect.addEventListener("change", async () => {
    const modernMode = variantSelect.value === "modern-alt";
    await Promise.all(cards.map(({ families, sourceFont, altFont }) => {
      const family = modernMode ? families.modern : families.source;
      const url = modernMode ? `fonts/modern-alt/${altFont.filename}` : `fonts/${sourceFont.filename}`;
      return loadedFamilies.has(family) ? Promise.resolve() : addFontFace(family, url).catch(() => undefined);
    }));
    render();
  });
  const loadedCount = loadedResults.filter((result) => result.status === "fulfilled").length;
  status.textContent = `${cards.length} source alphabets ready; ${loadedCount} source previews loaded. Each card reports missing letters from its chart.`;
}

start().catch((error) => {
  status.textContent = `Font previews could not be loaded: ${error.message}`;
});
