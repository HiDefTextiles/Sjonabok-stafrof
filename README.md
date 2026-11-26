# Sjónabókarstafróf

Welcome! This project turns letter charts from *Sjónabók* into pixel-grid art you can explore, download, and reuse.

## See the fonts

Visit the [font gallery](https://hideftextiles.github.io/Sjonabok-stafrof/) to browse chart-based alphabets, try your own text, compare source groups, and download TrueType fonts. Every charted glyph is also available as a plain 0/1 `.txt` grid for knitting, embroidery, and other motif workflows.

## What you’ll find

- Each chart has one detail page with two font downloads: `-org.ttf` preserves its source-chart glyphs, and `-alt.ttf` adds only approved forms. Charted glyphs remain blue; added Alt glyphs and missing-character rosettes are teal. Each glyph appears once in the provenance view.
- Alt keeps the chart’s character classes. It can reuse an exact labeled glyph from another page in the same manuscript group when the charts’ median glyph heights differ by at most one stitch row. It does not invent glyphs or use donors from other manuscript groups.
- Font pages compare the original unsplit chart TXT (converted from EPS) with a glyph overview. They stack on mobile and sit side by side on wider screens. A border chosen in `font-groups.yml` frames the unsplit chart; the bottom repeat is mirrored. The original EPS files are not included.
- **Exact grid geometry:** each filled TXT cell becomes a square in the matching TTF glyph outline. The build checks the saved outlines against the grids.
- **Decorative frames:** a small selection of border motifs from the digitized pattern corpus frames each TXT sheet. The rosette used for one group is labeled as a new display treatment because that group has no border chart in the current index.

The current font set covers 49 Latin alphabet charts and includes 1,019 source glyph grids, plus one reference marker. Most charts are letters only; one is numbers only, and a chart containing both classes keeps both. The separate Futhark sheet and any unreconciled inventory entries are outside this font set; this release does not claim that every chart component in the corpus has been transcribed. The eight source-ID groups organize project records and do not claim historical typeface-family relationships.

## Rebuild the site

The repository stores the unsplit full-page TXT matrices, split glyph matrices, labels, YAML frame choices, and build scripts. Generated TTFs, indexes, chart pages, and rendered HTML are build outputs, so they are not checked in.

Use Node.js 23.5.0, npm 10.9.2, and Quarto 1.9.38. From the repository root:

```sh
npm ci --prefix gallery
npm run build:fonts --prefix gallery
quarto render gallery
```

The GitHub Pages workflow runs those same steps. The package lockfile pins the font-generation dependency. To correct a label, edit `gallery/fonts/font-source.json`; to change a full-page chart transcription, edit `gallery/fonts/source-page-txt/`; to change a glyph, edit its file in `gallery/fonts/source-txt/`. Alt TXT matrices are generated from the approved source glyphs. Frame assignments are in `gallery/fonts/font-groups.yml`. The eight selected frame TXT files and their corpus metadata are in `gallery/patterns/`.

## Source files and rights

The EPS files and manuscript scans are not included. This repository distributes the project’s TXT transcriptions and generated fonts, not the source images. The licenses below apply only to material the project contributors have the right to license; they do not grant rights in the historical manuscript or third-party digitizations. Check the rights and attribution requirements of the specific source before reusing material derived from it.

When reusing a project font or grid, credit **Sjónabókarstafróf**, link to this repository, and identify changes. Each font page includes source-chart identifiers and reconstruction notes.

See [LICENSE](LICENSE) and [LICENSE-MIT](LICENSE-MIT).
