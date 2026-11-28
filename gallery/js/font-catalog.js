const catalog = document.querySelector("#font-catalog");
const status = document.querySelector("#font-catalog-status");
const groupOf = (id) => id.replace(/_\d+$/u, "");

async function loadOrgSample(fontId, filename, sample) {
  const family = `sjonabok-catalog-${fontId}`;
  try {
    const face = new FontFace(family, `url("fonts/${filename}")`);
    document.fonts.add(await face.load());
    sample.style.fontFamily = `"${family}"`;
    sample.classList.add("is-loaded");
  } catch {
    sample.textContent = "Org sample unavailable";
    sample.classList.add("is-unavailable");
  }
}

async function main() {
  const index = await fetch("fonts/font-index.json").then((response) => response.json());
  catalog.replaceChildren();
  const observer = "IntersectionObserver" in window
    ? new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        loadOrgSample(entry.target.dataset.fontId, entry.target.dataset.filename, entry.target);
      }
    }, { rootMargin: "100px 0px" })
    : null;
  for (const font of index.fonts) {
    const card = document.createElement("article");
    card.className = "font-catalog-card";
    const title = document.createElement("h2");
    title.textContent = font.name;
    const detail = document.createElement("a");
    detail.href = `font-pages/${font.id}.html`;
    detail.textContent = "Open chart page";
    const group = document.createElement("p");
    const classes = font.characterClasses || [];
    const classLabel = font.script === "runic" ? "runes (Futhark)"
      : classes.length === 2 ? "letters and numbers" : classes[0] === "numbers" ? "numbers only" : "letters only";
    group.textContent = `Source ID group: ${groupOf(font.id)} · ${font.glyphCount} charted glyphs · ${classLabel}`;
    const glyphs = (font.glyphs || []).slice(0, 3).map((glyph) => glyph.character).filter(Boolean);
    const sample = document.createElement("p");
    sample.className = "font-catalog-org-sample";
    const sampleLabel = document.createElement("span");
    sampleLabel.className = "font-catalog-org-label";
    sampleLabel.textContent = "Org sample";
    const sampleText = document.createElement("span");
    sampleText.className = "font-catalog-org-glyphs";
    sampleText.textContent = glyphs.join(" ");
    if (glyphs.length) {
      sample.dataset.fontId = font.id;
      sample.dataset.filename = font.filename;
      sample.append(sampleLabel, sampleText);
      if (observer) observer.observe(sample);
      else loadOrgSample(font.id, font.filename, sampleText);
    }
    card.append(title, group, ...(glyphs.length ? [sample] : []), detail);
    catalog.append(card);
  }
  status.textContent = `${index.fonts.length} chart pages. Open a page to see the TXT motifs, provenance, and downloads.`;
}

main().catch((error) => { status.textContent = `Font catalog could not be loaded: ${error.message}`; });
