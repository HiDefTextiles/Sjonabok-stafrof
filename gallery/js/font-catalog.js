const catalog = document.querySelector("#font-catalog");
const status = document.querySelector("#font-catalog-status");
const groupOf = (id) => id.replace(/_\d+$/u, "");

async function main() {
  const index = await fetch("fonts/font-index.json").then((response) => response.json());
  catalog.replaceChildren();
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
    const classLabel = classes.length === 2 ? "letters and numbers" : classes[0] === "numbers" ? "numbers only" : "letters only";
    group.textContent = `Source ID group: ${groupOf(font.id)} · ${font.glyphCount} charted glyphs · ${classLabel}`;
    card.append(title, group, detail);
    catalog.append(card);
  }
  status.textContent = `${index.fonts.length} chart pages. Open a page to see the TXT motifs, provenance, and downloads.`;
}

main().catch((error) => { status.textContent = `Font catalog could not be loaded: ${error.message}`; });
