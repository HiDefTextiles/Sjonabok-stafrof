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
  method: { representation: "Each source glyph is cropped to its nonempty bounds, scaled proportionally to fit an 18×18 binary grid, and centered.", metric: "For each shared labelled letter, binary Jaccard = shared filled cells / cells filled in either glyph. Pair score is the unweighted mean across shared letters.", comparisons: "Within-manuscript pairs share the manuscript ID prefix after removing the final numeric page suffix. Across-manuscript pairs have different prefixes. A pair is included only when at least 3 labelled letters are shared.", limitations: "Scores depend on transcription labels, thresholded stitch cells, normalization, and small uneven letter samples. They ignore color, stitch texture, spacing, layout, and manuscript dating. Similarity is descriptive, not proof of a shared hand or influence." },
  overall: { withinManuscript: stats(within), acrossManuscripts: stats(across) },
  withinManuscript: byManuscript,
  highestPairs: [...pairs].sort((a, b) => b.score - a.score).slice(0, 20).map((pair) => ({ ...pair, score: Number(pair.score.toFixed(4)) })),
  lowestPairs: [...pairs].sort((a, b) => a.score - b.score).slice(0, 20).map((pair) => ({ ...pair, score: Number(pair.score.toFixed(4)) })),
};
fs.writeFileSync(path.join(fontDir, "similarity-metrics.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ dataset: report.dataset, overall: report.overall, withinManuscript: report.withinManuscript }, null, 2));
