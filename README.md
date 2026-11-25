# Sjónabókarstafróf

Welcome! This project turns letter charts from *Sjónabók* into pixel-grid art you can explore, download, and reuse.

## See the fonts

Visit the [font gallery](https://hideftextiles.github.io/Sjonabok-stafrof/) to browse chart-based alphabets, try your own text, compare source groups, and download TrueType fonts. Every charted glyph is also available as a plain 0/1 `.txt` grid for knitting, embroidery, and other motif workflows.

## What you’ll find

- **Source-chart fonts** are made from the glyph shapes transcribed from each chart. Draft or uncertain labels are identified in the data and on the pages.
- **Modern Alt** is a separate, clearly labeled draft. It includes only glyphs charted for that font and case forms copied from the same chart. It does not borrow from other charts or invent missing glyphs in this release; the interface marks missing characters with a reusable rosette.
- **Exact grid geometry:** each filled TXT cell becomes a square in the matching TTF glyph outline. The build checks the saved outlines against the grids.
- **Decorative frames:** a small selection of border motifs from the digitized pattern corpus frames each TXT sheet. The rosette used for one group is labeled as a new display treatment because that group has no border chart in the current index.

The current font set covers 49 Latin alphabet charts and includes 1,019 source glyph grids, plus one reference marker. Most charts are letters only; one is numbers only, and a chart containing both classes keeps both. The separate Futhark sheet and any unreconciled inventory entries are outside this font set; this release does not claim that every chart component in the corpus has been transcribed. The eight source-ID groups organize project records and do not claim historical typeface-family relationships.

## Rebuild the site

The repository stores the input matrices, labels, YAML frame choices, and build scripts. Generated TTFs, indexes, chart pages, and rendered HTML are build outputs, so they are not checked in.

Use Node.js 23.5.0, npm 10.9.2, and Quarto 1.9.38. From the repository root:

```sh
npm ci --prefix gallery
npm run build:fonts --prefix gallery
quarto render gallery
```

The GitHub Pages workflow runs those same steps. The package lockfile pins the font-generation dependency. To correct a label, edit `gallery/fonts/font-source.json`; to change a glyph’s pixel art, edit its file in `gallery/fonts/source-txt/`. Modern Alt grids are generated from that source data. Frame assignments are in `gallery/fonts/font-groups.yml`. The eight selected frame TXT files and their corpus metadata are in `gallery/patterns/`.

## Source files and rights

The EPS files and manuscript scans are not included. This repository distributes the project’s TXT transcriptions and generated fonts, not the source images. The licenses below apply only to material the project contributors have the right to license; they do not grant rights in the historical manuscript or third-party digitizations. Check the rights and attribution requirements of the specific source before reusing material derived from it.

When reusing a project font or grid, credit **Sjónabókarstafróf**, link to this repository, and identify changes. Each font page includes source-chart identifiers and reconstruction notes.

See [LICENSE](LICENSE) and [LICENSE-MIT](LICENSE-MIT).
