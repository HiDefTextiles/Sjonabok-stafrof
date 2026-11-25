# Sjónabók font drafts

This folder contains 49 installable source-chart TrueType fonts, one for each Latin alphabet sheet in the chart data. A separate EPS page is Futhark and is not treated as a Latin alphabet font. No EPS files are included in this package.

The per-glyph `.txt` matrices in `source-txt/<font-id>/` are the editable source of truth for the source-chart fonts. Each file is a 0/1 grid. The builder converts each filled cell to a square outline without cropping or rescaling the glyph, and then parses the resulting TTF and compares its outline commands with the grid. The current source set has 1,019 charted glyph matrices across 49 fonts. This is the Latin font set, not a claim that every component in the 50-page EPS inventory has been transcribed; the separate Futhark sheet and any unreconciled inventory entries remain outside this package.

These are **drafts**. The character labels came from earlier manual splits and may be wrong. The editable character-to-chart mappings and source matrices are kept in `font-source.json` and `source-txt/` for review. Each source TTF maps only charted letters/numbers and same-chart case forms; unsupported characters are not mapped. The website marks them with a reusable rosette.

## Org and Alt fonts

Each chart page offers two paired files: `<font-id>-org.ttf` is the source-chart version and `<font-id>-alt.ttf` is the Alt version. The Alt font preserves the source chart’s character classes: letter charts get letters, number charts get numbers, and charts with both keep both. It begins with glyphs and case forms from the same chart.

For a missing character, Alt may reuse the exact labeled glyph from another chart in the same manuscript ID group if that chart’s median glyph height differs from the target chart by no more than one stitch row. The index records the donor page, label, and height comparison. No cross-manuscript donors or programmatic glyph construction are included. Characters without a qualifying source stay missing and are marked with a rosette. Original chart glyphs display in blue; added Alt glyphs display in teal. Each included Alt glyph has a `.txt` grid in `modern-alt-txt/<font-id>/`.

The first image on each font page is a generated TXT overview, not a manuscript scan. It arranges the transcribed glyph grids and applies the border selected for that manuscript group in `font-groups.yml`. Comparison guides use one shared stitch scale and do not alter the TXT files.

Some chart labels remain unknown or uncertain, and the chart forms need visual review before the fonts should be considered final. The EPS files are source material and must not be committed to this repository.

## Similarity metrics and research use

`similarity-metrics.json` reports pairwise descriptive comparisons of the 49 source-chart fonts across eight manuscript ID groups. It uses same-label Latin glyphs only: each binary stitch matrix is cropped to filled cells, scaled proportionally into an 18×18 grid, and centered. Per-glyph similarity is binary Jaccard; each page-pair score is the unweighted mean for shared labels. Pairs with fewer than three shared labels are omitted. The report includes within-group and across-group summaries, group-level variation, and ranked pairs.

This is an exploratory measurement, not a validated goodness-of-fit score. Label errors, sparse/unequal letter samples, normalization, and discarded color, stitch texture, spacing, layout, dating, and viewing scale affect interpretation. A higher score does not establish authorship, influence, or better reconstruction. Use it to make comparisons reproducible and to select examples for visual review. A defensible validation study should compare multiple shape metrics, retain the original page context, and collect blinded expert assessments of source-style fidelity and legibility; report agreement and disagreements alongside the quantitative results.

For an artistic-research paper, keep a versioned record of the source image and transcription for each glyph, every reconstruction decision and donor, the metric parameters, and reviewer feedback. Separate evidence about historical use of a letter from design judgments about a modern adaptation. Treat the font as both a research artifact and an interpretive proposal.

### Further reading

- Takizawa, Sho, Taisei Hoshi, and Qiu Chen. “Font Comparison System Based on Multiple Similarity Metrics.” *International Journal of Affective Engineering* 19, no. 2 (2020): 127–135. [https://doi.org/10.5057/ijae.IJAE-D-19-00012](https://doi.org/10.5057/ijae.IJAE-D-19-00012). Compares several image and feature metrics and examines how rankings depend on metric, image resolution, and character type.
- Shimoda et al. “Towards Diverse and Consistent Typography Generation.” WACV (2024). [Paper](https://openaccess.thecvf.com/content/WACV2024/papers/Shimoda_Towards_Diverse_and_Consistent_Typography_Generation_WACV_2024_paper.pdf). The paper states that typography generation has no standardized evaluation metric and evaluates with several task-specific measures.
- International Federation of Library Associations and Institutions, Rare Book and Special Collections Section. *Guidelines for Planning the Digitization of Rare Book and Manuscript Collections* (2014; revised 2015). [Guidelines](https://ifla.org/wp-content/uploads/2019/05/assets/rare-books-and-manuscripts/rbms-guidelines/guidelines-for-planning-digitization.pdf). Guidance relevant to preserving page context, image fidelity, and color information.
- Cheng, Karen. *Designing Type*. [JSTOR book record](https://www.jstor.org/stable/j.ctv19dsxpn). A textbook covering letter structure, optical compensation, and legibility.
- Olocco, Riccardo, and Michele Patané. *Designing Type Revivals*. [Publisher description](https://draw-down.com/products/designing-type-revivals). A research volume describing a framework for documenting historical design features and a revival process for a specific historical type.
- Valance, David, and Thomas Bouville. “Re-typographe.” *Back Office*. [Case study](https://revue-backoffice.com/en/issues/01-making-do-making-with/david-valance-thomas-bouville-re-typographe). Describes digitizing a historical type source, including decisions about absent characters and reinterpretation.

## Install

Download both paired `.ttf` files from the matching chart page. The `-org` file preserves the source chart, and the `-alt` file includes qualifying additions. On Windows, right-click a font and choose **Install**. On macOS, open it in Font Book and choose **Install**. Restart Word, then select the matching “Sjónabók … Org” or “Sjónabók … Alt” font family.

## Regenerate

From the repository root, run:

    npm ci --prefix gallery
    node gallery/scripts/build_fonts.mjs
    node gallery/scripts/build_modern_alt_fonts.mjs
    node gallery/scripts/build_font_similarity.mjs
    node gallery/scripts/build_font_frames.mjs
    node gallery/scripts/build_font_pages.mjs

The source and modern-alt TTF files, indexes, metrics, group-frame data, and generated detail pages are rebuilt in dependency order. To correct a glyph label, edit the matching entry in `font-source.json` and regenerate. To edit a glyph’s pixel art directly, edit its `.txt` matrix and rerun the builders; the TTF round-trip checks fail if its outline no longer matches that grid. Group border assignments live in `font-groups.yml`; frame generation checks their IDs against the corpus TXT data.
