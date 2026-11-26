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

function appendSample(sample, text, supported, variant, additions = new Map()) {
  sample.replaceChildren();
  for (const character of text) {
    if (!/\s/u.test(character) && !supported.has(character)) {
      const marker = element("span", "font-missing-glyph");
      marker.setAttribute("aria-label", `No ${variant} glyph for ${character}`);
      marker.title = `No recorded glyph for ${character} in this ${variant}`;
      const image = document.createElement("img");
      image.src = "img/rosette-missing.svg";
      image.alt = "";
      image.setAttribute("aria-hidden", "true");
      marker.append(image);
      sample.append(marker);
    } else if (additions.has(character)) {
      const added = element("span", "font-preview-added", character);
      sample.append(added);
    } else {
      sample.append(document.createTextNode(character));
    }
  }
}

function updateNotes(note, text, sourceCharacters, altFont, modernMode) {
  note.replaceChildren();
  const characters = [...new Set([...text].filter((character) => !/\s/u.test(character)))];
  if (!modernMode) {
    const recorded = new Set(altFont.sourceCharacters || []);
    const sharedCase = characters.filter((character) => !recorded.has(character) && sourceCharacters.has(character));
    const missing = characters.filter((character) => !sourceCharacters.has(character));
    if (sharedCase.length) {
      note.append(element("small", "", `No separate case form in this chart: ${sharedCase.join(" ")} uses the matching chart glyph.`));
    }
    if (missing.length) {
      note.append(element("strong", "", "Not recorded in this chart:"));
      note.append(element("p", "", missing.join(" ")));
      note.append(element("small", "", "A rosette marks each character absent from this chart."));
    } else {
      note.append(element("p", "", "Every non-space character in this sample is charted here."));
    }
    return;
  }

  const additions = new Map(altFont.additions.map((entry) => [entry.character, entry]));
  const usedAdditions = characters.map((character) => additions.get(character)).filter(Boolean);
  const sharedCaseAdditions = usedAdditions.filter((entry) => entry.method === "source-chart-shared-case");
  const otherAdditions = usedAdditions.filter((entry) => entry.method !== "source-chart-shared-case");
  const missing = characters.filter((character) => !altFont.characters.includes(character));
  if (sharedCaseAdditions.length) {
    note.append(element("small", "", `No separate case form in this chart: ${[...new Set(sharedCaseAdditions.map((entry) => entry.character))].join(" ")} uses the matching chart glyph.`));
  }
  if (otherAdditions.length) {
    const addedCharacters = [...new Set(otherAdditions.map((entry) => entry.character))];
    note.append(element("strong", "", "Added Alt forms (shown in teal):"));
    note.append(element("p", "", addedCharacters.join(" ")));
    note.append(element("small", "", "The source chart is named on the font page."));
  }
  if (missing.length) {
    note.append(element("strong", "", "Not available in this Alt draft:"));
    note.append(element("p", "", [...new Set(missing)].join(" ")));
    note.append(element("small", "", "No same-chart or qualifying same-manuscript glyph is available."));
  } else if (!usedAdditions.length) {
    note.append(element("p", "", "Every non-space character in this sample has a glyph in this draft."));
  }
}

function createCard(sourceFont, altFont, families) {
  const card = element("article", "font-card");
  const head = element("div", "font-card-head");
  const heading = element("h2", "", sourceFont.name);
  head.append(heading);

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
    appendSample(sample, text, modernMode ? new Set(altFont.characters) : sourceCharacters, modernMode ? "Alt" : "Org", modernMode ? new Map(altFont.additions.map((entry) => [entry.character, entry])) : new Map());
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
    const families = { source: `sjonabok-${sourceFont.id}`, modern: `sjonabok-${sourceFont.id}-alt` };
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
  status.textContent = `${cards.length} chart sets ready; ${loadedCount} source previews loaded. Rosettes mark every character not present in the selected font.`;
}

start().catch((error) => {
  status.textContent = `Font previews could not be loaded: ${error.message}`;
});
