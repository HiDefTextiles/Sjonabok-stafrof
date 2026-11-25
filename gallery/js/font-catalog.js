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
    group.textContent = `Source ID group: ${groupOf(font.id)} · ${font.glyphCount} labelled charts`;
    const download = document.createElement("p");
    const link = document.createElement("a");
    link.href = `fonts/${font.filename}`;
    link.download = font.filename;
    link.textContent = "Download source-chart TTF";
    download.append(link);
    card.append(title, group, detail, download);
    catalog.append(card);
  }
  status.textContent = `${index.fonts.length} chart pages. Open a page to see each digitized TXT motif, the group frame, provenance, and font downloads.`;
}

main().catch((error) => { status.textContent = `Font catalog could not be loaded: ${error.message}`; });
