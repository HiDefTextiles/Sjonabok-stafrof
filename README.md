# Sjónabókarstafróf

Explore stitch-chart letters from *Sjónabók* as reusable TXT motifs and downloadable fonts.

## Start here

- [Browse the font gallery](https://hideftextiles.github.io/Sjonabok-stafrof/)
- [Try the fonts and see how they are made](https://hideftextiles.github.io/Sjonabok-stafrof/font-test.html#how-the-fonts-are-made)
- [GitHub Releases](https://github.com/HiDefTextiles/Sjonabok-stafrof/releases) — ZIP bundles will be listed here when released.

Open a chart page to download its Org and Alt fonts. Org shows the glyphs transcribed from that chart. Alt may add an exact matching glyph from another chart in the same manuscript. Blue marks original chart glyphs; teal marks additions. A teal rosette marks a character that is still missing.

Install a `.ttf` file to use it in apps such as Word or Inkscape. The plain-text `.txt` grids are also available for knitting, embroidery, and other pixel-grid projects.

## Rebuild

The site and downloadable fonts are rebuilt from the files in this repository. GitHub Pages does this automatically after changes are pushed. To rebuild locally, install Node.js 23.5.0 and Quarto 1.9.38, then run:

```sh
npm ci --prefix gallery
npm run build:fonts --prefix gallery
quarto render gallery
```

TXT grids are the editable source for the glyphs; generated fonts and web pages are build outputs. EPS files and manuscript scans are not included. For detailed font-generation notes, see [the font README](gallery/fonts/README.md).

## Reuse and license

When reusing project fonts or TXT grids, credit **Sjónabókarstafróf**, link to this repository, and identify changes. Project licenses cover only material contributors have the right to license; they do not grant rights in the historical manuscript or third-party scans.

See [LICENSE](LICENSE) and [LICENSE-MIT](LICENSE-MIT).
