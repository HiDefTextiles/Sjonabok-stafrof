import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const fontDir = path.resolve(scriptDir, "../fonts");
const source = JSON.parse(fs.readFileSync(path.join(fontDir, "font-source.json"), "utf8"));
const fonts = source.fonts.filter((font) => font.id !== "thjmsth_116_628");

function group(id) { return id.replace(/_\d+$/u, ""); }
function trim(rows) {
  let top = rows.length, bottom = -1, left = Infinity, right = -1;
  rows.forEach((row, y) => [...row].forEach((cell, x) => {
    if (cell === "1") { top = Math.min(top, y); bottom = Math.max(bottom, y); left = Math.min(left, x); right = Math.max(right, x); }
  }));
  return bottom < 0 ? ["0"] : rows.slice(top, bottom + 1).map((row) => row.slice(left, right + 1));
}
function normalized(rows, size = 18) {
  const matrix = trim(rows), h = matrix.length, w = Math.max(...matrix.map((row) => row.length));
  const scale = Math.min((size - 2) / w, (size - 2) / h), nw = Math.max(1, Math.round(w * scale));
  const nh = Math.max(1, Math.round(h * scale)), xoff = Math.floor((size - nw) / 2), yoff = Math.floor((size - nh) / 2);
  const result = Array.from({ length: size }, () => Array(size).fill(false));
  for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
    if (matrix[Math.min(h - 1, Math.floor(y * h / nh))][Math.min(w - 1, Math.floor(x * w / nw))] === "1") result[yoff + y][xoff + x] = true;
  }
  return result;
}
function jaccard(aRows, bRows) {
  const a = normalized(aRows), b = normalized(bRows); let both = 0, either = 0;
  for (let y = 0; y < 18; y++) for (let x = 0; x < 18; x++) {
    if (a[y][x] && b[y][x]) both++;
    if (a[y][x] || b[y][x]) either++;
  }
  return either ? both / either : 0;
}
function chartMap(font) {
  const map = new Map();
  for (const glyph of font.glyphs) {
    const key = glyph.character.toLocaleUpperCase("is");
    if (/^[A-ZÁÐÉÍÓÚÝÞÆÖ]$/u.test(key) && !map.has(key)) map.set(key, glyph);
  }
  return map;
}
const chartMaps = new Map(fonts.map((font) => [font.id, chartMap(font)]));
const alphabetOrder = [..."AÁBCDÐEÉFGHIÍJKLMNOÓPQRSTUÚVWXYÝZÞÆÖ"];
const alphabetRank = new Map(alphabetOrder.map((character, index) => [character, index]));
function compareCharacters(left, right) {
  const leftUpper = left.toLocaleUpperCase("is"), rightUpper = right.toLocaleUpperCase("is");
  const difference = (alphabetRank.get(leftUpper) ?? 999) - (alphabetRank.get(rightUpper) ?? 999);
  if (difference) return difference;
  return left === left.toLocaleUpperCase("is") ? -1 : right === right.toLocaleUpperCase("is") ? 1 : left.localeCompare(right, "is");
}
const chartCoverage = fonts.map((font) => {
  const rawLetters = font.glyphs.map((glyph) => glyph.character).filter((character) => /\p{Letter}/u.test(character));
  const rawNumbers = font.glyphs.map((glyph) => glyph.character).filter((character) => /\p{Number}/u.test(character));
  const hasUppercase = rawLetters.some((character) => character === character.toLocaleUpperCase("is"));
  const hasLowercase = rawLetters.some((character) => character === character.toLocaleLowerCase("is"));
  const letterStyle = !rawLetters.length ? "—" : hasUppercase && hasLowercase ? "mixed case" : hasUppercase ? "uppercase" : "lowercase";
  return {
    id: font.id,
    manuscriptGroup: group(font.id),
    glyphCount: font.glyphs.length,
    letterStyle,
    letterLabels: rawLetters.sort(compareCharacters),
    numberLabels: rawNumbers.sort((a, b) => a.localeCompare(b, "is")),
  };
});

const exactShapes = new Map();
for (const font of fonts) for (const [character, glyph] of chartMaps.get(font.id)) {
  const key = `${character}\u0000${trim(glyph.rows).join("\n")}`;
  if (!exactShapes.has(key)) exactShapes.set(key, { character, fontIds: [] });
  exactShapes.get(key).fontIds.push(font.id);
}
const repeatedShapeGroups = [...exactShapes.values()].filter((entry) => entry.fontIds.length > 1).map((entry) => {
  let withinManuscriptPairCount = 0, acrossManuscriptPairCount = 0;
  for (let i = 0; i < entry.fontIds.length; i++) for (let j = i + 1; j < entry.fontIds.length; j++) {
    if (group(entry.fontIds[i]) === group(entry.fontIds[j])) withinManuscriptPairCount++;
    else acrossManuscriptPairCount++;
  }
  return { ...entry, pairCount: entry.fontIds.length * (entry.fontIds.length - 1) / 2, withinManuscriptPairCount, acrossManuscriptPairCount };
});
const exactShapeSummary = {
  repeatedShapeGroupCount: repeatedShapeGroups.length,
  matchingGlyphPairCount: repeatedShapeGroups.reduce((sum, entry) => sum + entry.pairCount, 0),
  withinManuscriptPairCount: repeatedShapeGroups.reduce((sum, entry) => sum + entry.withinManuscriptPairCount, 0),
  acrossManuscriptPairCount: repeatedShapeGroups.reduce((sum, entry) => sum + entry.acrossManuscriptPairCount, 0),
};
const numericShapes = new Map();
for (const font of fonts) for (const glyph of font.glyphs) {
  if (!/\p{Number}/u.test(glyph.character)) continue;
  const key = `${glyph.character}\u0000${trim(glyph.rows).join("\n")}`;
  if (!numericShapes.has(key)) numericShapes.set(key, { character: glyph.character, fontIds: [] });
  numericShapes.get(key).fontIds.push(font.id);
}
const repeatedNumericShapeGroups = [...numericShapes.values()].filter((entry) => entry.fontIds.length > 1).map((entry) => ({
  ...entry,
  pairCount: entry.fontIds.length * (entry.fontIds.length - 1) / 2,
}));
const closeGlyphMatches = [];
for (let i = 0; i < fonts.length; i++) for (let j = i + 1; j < fonts.length; j++) {
  const left = fonts[i], right = fonts[j], a = chartMaps.get(left.id), b = chartMaps.get(right.id);
  for (const character of a.keys()) {
    if (!b.has(character) || JSON.stringify(trim(a.get(character).rows)) === JSON.stringify(trim(b.get(character).rows))) continue;
    const score = jaccard(a.get(character).rows, b.get(character).rows);
    if (score >= 0.9) closeGlyphMatches.push({
      character, left: left.id, right: right.id,
      sameManuscript: group(left.id) === group(right.id),
      score: Number(score.toFixed(4)),
    });
  }
}
const pairs = [];
for (let i = 0; i < fonts.length; i++) for (let j = i + 1; j < fonts.length; j++) {
  const left = fonts[i], right = fonts[j], a = chartMaps.get(left.id), b = chartMaps.get(right.id);
  const shared = [...a.keys()].filter((character) => b.has(character)).sort((x, y) => x.localeCompare(y, "is"));
  if (shared.length < 3) continue;
  const scores = shared.map((character) => jaccard(a.get(character).rows, b.get(character).rows));
  pairs.push({ left: left.id, right: right.id, sameManuscript: group(left.id) === group(right.id), sharedLetters: shared, score: scores.reduce((sum, value) => sum + value, 0) / scores.length });
}
function stats(records) {
  const scores = records.map((item) => item.score).sort((a, b) => a - b);
  const mean = scores.reduce((sum, value) => sum + value, 0) / (scores.length || 1);
  const median = scores.length ? scores[Math.floor(scores.length / 2)] : null;
  return { pairCount: scores.length, mean: Number(mean.toFixed(4)), median: median === null ? null : Number(median.toFixed(4)), min: scores.length ? Number(scores[0].toFixed(4)) : null, max: scores.length ? Number(scores.at(-1).toFixed(4)) : null };
}
const within = pairs.filter((pair) => pair.sameManuscript), across = pairs.filter((pair) => !pair.sameManuscript);
const byManuscript = [...new Set(fonts.map((font) => group(font.id)))].sort().map((id) => {
  const records = within.filter((pair) => group(pair.left) === id);
  return { id, pageCount: fonts.filter((font) => group(font.id) === id).length, ...stats(records) };
});
const report = {
  title: "Source-chart glyph silhouette similarity",
  status: "Exploratory descriptive metric; not a measure of historical authorship, visual quality, or reader perception.",
  dataset: { sourceFontCount: fonts.length, manuscriptGroups: byManuscript.length, includedPagePairs: pairs.length, minimumSharedLettersPerPair: 3, runicPageExcluded: "thjmsth_116_628" },
  method: { representation: "Each source glyph is cropped to its nonempty bounds, scaled proportionally to fit an 18×18 binary grid, and centered.", metric: "For each shared labelled letter, binary Jaccard = shared filled cells / cells filled in either glyph. Pair score is the unweighted mean across shared letters.", comparisons: "Within-source-ID-group pairs share the prefix before the final numeric page suffix. Across-group pairs have different prefixes. These labels organize the current dataset and do not establish historical manuscript or typeface families. A page pair is included only when at least 3 labelled letters are shared.", limitations: "Scores depend on transcription labels, thresholded stitch cells, normalization, and small uneven letter samples. They ignore color, stitch texture, spacing, layout, and manuscript dating. Similarity is descriptive, not proof of a shared hand or influence." },
  overall: { withinManuscript: stats(within), acrossManuscripts: stats(across) },
  withinManuscript: byManuscript,
  chartCoverage,
  exactLetterShapeSummary: exactShapeSummary,
  exactShapeGroups: repeatedShapeGroups.sort((a, b) => b.fontIds.length - a.fontIds.length || a.character.localeCompare(b.character, "is")),
  exactNumberShapeSummary: { repeatedShapeGroupCount: repeatedNumericShapeGroups.length, matchingGlyphPairCount: repeatedNumericShapeGroups.reduce((sum, entry) => sum + entry.pairCount, 0) },
  exactNumberShapeGroups: repeatedNumericShapeGroups.sort((a, b) => b.fontIds.length - a.fontIds.length || a.character.localeCompare(b.character, "is")),
  closeGlyphMatchScreen: { threshold: 0.9, note: "Exploratory screen, not a validated cutoff.", matchCount: closeGlyphMatches.length, withinManuscriptCount: closeGlyphMatches.filter((match) => match.sameManuscript).length, acrossManuscriptCount: closeGlyphMatches.filter((match) => !match.sameManuscript).length, matches: closeGlyphMatches.sort((a, b) => b.score - a.score).slice(0, 40) },
  closePagePairScreen: { threshold: 0.85, note: "Exploratory screen, not a validated cutoff.", pairs: pairs.filter((pair) => pair.score >= 0.85).sort((a, b) => b.score - a.score).map((pair) => ({ ...pair, score: Number(pair.score.toFixed(4)) })) },
  closestWithinManuscriptPairs: [...within].sort((a, b) => b.score - a.score).slice(0, 15).map((pair) => ({ ...pair, score: Number(pair.score.toFixed(4)) })),
  highestPairs: [...pairs].sort((a, b) => b.score - a.score).slice(0, 20).map((pair) => ({ ...pair, score: Number(pair.score.toFixed(4)) })),
  lowestPairs: [...pairs].sort((a, b) => a.score - b.score).slice(0, 20).map((pair) => ({ ...pair, score: Number(pair.score.toFixed(4)) })),
};
fs.writeFileSync(path.join(fontDir, "similarity-metrics.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ dataset: report.dataset, overall: report.overall, withinManuscript: report.withinManuscript }, null, 2));
