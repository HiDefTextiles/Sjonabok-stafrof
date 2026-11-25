import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import opentype from "opentype.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const fontDir = path.resolve(scriptDir, "../fonts");
const sourcePath = path.join(fontDir, "font-source.json");
const outputDir = path.join(fontDir, "modern-alt");
const modernUpper = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZÁÐÉÍÓÚÝÞÆÖ"];
const modernLetters = [...modernUpper, ...modernUpper.map((c) => c.toLowerCase())];
const accentBase = new Map([["Á", "A"], ["á", "a"], ["É", "E"], ["é", "e"], ["Í", "I"], ["í", "i"],
  ["Ó", "O"], ["ó", "o"], ["Ú", "U"], ["ú", "u"], ["Ý", "Y"], ["ý", "y"]]);

function trim(rows) {
  let top = rows.length, bottom = -1, left = Infinity, right = -1;
  rows.forEach((row, y) => [...row].forEach((cell, x) => {
    if (cell === "1") { top = Math.min(top, y); bottom = Math.max(bottom, y); left = Math.min(left, x); right = Math.max(right, x); }
  }));
  if (bottom < 0) return ["0"];
  return rows.slice(top, bottom + 1).map((row) => row.slice(left, right + 1));
}

function rowsToRuns(rows) {
  const active = new Map(), rectangles = [];
  for (let y = 0; y <= rows.length; y++) {
    const row = rows[y] || "", runs = [];
    for (let x = 0; x < row.length;) {
      if (row[x] !== "1") { x++; continue; }
      const start = x;
      while (x < row.length && row[x] === "1") x++;
      runs.push(`${start}:${x}`);
    }
    const next = new Set(runs);
    for (const [run, firstY] of active) if (!next.has(run)) {
      const [x0, x1] = run.split(":").map(Number);
      rectangles.push({ x0, x1, y0: firstY, y1: y });
      active.delete(run);
    }
    for (const run of next) if (!active.has(run)) active.set(run, y);
  }
  return rectangles;
}

function glyphPath(rows, cell, left = 0) {
  const pathData = new opentype.Path();
  for (const r of rowsToRuns(rows)) {
    const x0 = left + r.x0 * cell, x1 = left + r.x1 * cell;
    const y0 = (rows.length - r.y1) * cell, y1 = (rows.length - r.y0) * cell;
    pathData.moveTo(x0, y0); pathData.lineTo(x0, y1); pathData.lineTo(x1, y1);
    pathData.lineTo(x1, y0); pathData.close();
  }
  const width = Math.max(0, ...rows.map((row) => row.length));
  return { path: pathData, width: Math.max(1, width * cell + cell + left * 2) };
}

function writeMatrix(filePath, rows) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, rows.join("\n") + "\n", "utf8");
}

function caseGlyph(font, character) {
  const glyph = font.glyphs.find((item) => item.character === character);
  if (glyph) return { glyph, method: "source-chart" };
  const counterpart = character === character.toLowerCase() ? character.toUpperCase() : character.toLowerCase();
  const otherCase = font.glyphs.find((item) => item.character === counterpart);
  return otherCase ? { glyph: otherCase, method: "source-chart-shared-case" } : null;
}

function normalized(rows, size = 18) {
  const matrix = trim(rows), h = matrix.length, w = Math.max(...matrix.map((row) => row.length));
  const scale = Math.min((size - 2) / w, (size - 2) / h), nw = Math.max(1, Math.round(w * scale));
  const nh = Math.max(1, Math.round(h * scale)), xoff = Math.floor((size - nw) / 2), yoff = Math.floor((size - nh) / 2);
  const output = Array.from({ length: size }, () => Array(size).fill(false));
  for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
    const sx = Math.min(w - 1, Math.floor(x * w / nw)), sy = Math.min(h - 1, Math.floor(y * h / nh));
    if (matrix[sy][sx] === "1") output[yoff + y][xoff + x] = true;
  }
  return output;
}

function glyphSimilarity(left, right) {
  const a = normalized(left.rows), b = normalized(right.rows);
  let intersection = 0, union = 0;
  for (let y = 0; y < a.length; y++) for (let x = 0; x < a[y].length; x++) {
    if (a[y][x] && b[y][x]) intersection++;
    if (a[y][x] || b[y][x]) union++;
  }
  return union ? intersection / union : 0;
}

function styleSimilarity(left, right) {
  const scores = [];
  for (const character of modernUpper) {
    const a = caseGlyph(left, character), b = caseGlyph(right, character);
    if (a && b) scores.push(glyphSimilarity(a.glyph, b.glyph));
  }
  return scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : 0;
}

function buildSimilarityCache(fonts) {
  const cache = new Map();
  for (let i = 0; i < fonts.length; i++) for (let j = i + 1; j < fonts.length; j++) {
    const score = styleSimilarity(fonts[i], fonts[j]);
    cache.set(fonts[i].id + "\u0000" + fonts[j].id, score);
    cache.set(fonts[j].id + "\u0000" + fonts[i].id, score);
  }
  return cache;
}

function sourceGroup(id) { return id.replace(/_\d+$/u, ""); }
function pageNumber(id) { return Number(id.match(/_(\d+)$/u)?.[1] || 0); }

function chooseDonor(target, character, fonts, similarityCache) {
  const candidates = fonts.filter((font) => font.id !== target.id && caseGlyph(font, character))
    .map((font) => ({ font, similarity: similarityCache.get(target.id + "\u0000" + font.id) || 0 }));
  candidates.sort((a, b) => {
    const sameGroup = Number(sourceGroup(b.font.id) === sourceGroup(target.id)) - Number(sourceGroup(a.font.id) === sourceGroup(target.id));
    if (sameGroup) return sameGroup;
    const similarity = b.similarity - a.similarity;
    if (Math.abs(similarity) > 1e-6) return similarity;
    const pageGap = Math.abs(pageNumber(a.font.id) - pageNumber(target.id)) - Math.abs(pageNumber(b.font.id) - pageNumber(target.id));
    return pageGap || a.font.id.localeCompare(b.font.id, "en");
  });
  if (!candidates.length) return null;
  const donor = candidates[0], source = caseGlyph(donor.font, character);
  return { glyph: source.glyph, fontId: donor.font.id, method: "sibling-chart", similarity: donor.similarity };
}

function acuteRows(baseRows) {
  const source = trim(baseRows), width = Math.max(4, ...source.map((row) => row.length));
  const padLeft = Math.floor((width - source[0].length) / 2);
  const blank = "0".repeat(width);
  const first = Array(width).fill("0"), second = Array(width).fill("0");
  const markX = Math.floor(width / 2);
  first[Math.min(width - 1, markX + 1)] = "1";
  second[markX] = "1";
  return [first.join(""), second.join(""), blank,
    ...source.map((row) => "0".repeat(padLeft) + row + "0".repeat(width - padLeft - row.length))];
}

function resolveCharacter(target, character, fonts, similarityCache) {
  const own = caseGlyph(target, character);
  if (own) return {
    rows: own.glyph.rows, method: own.method,
    sourceFontId: target.id, sourceFile: own.glyph.sourceFile,
  };
  if (accentBase.has(character)) {
    const baseCharacter = accentBase.get(character);
    const base = resolveCharacter(target, baseCharacter, fonts, similarityCache);
    return {
      rows: acuteRows(base.rows),
      method: base.sourceFontId === target.id ? "source-base-plus-acute" : "sibling-base-plus-acute",
      sourceFontId: base.sourceFontId, sourceFile: base.sourceFile,
      baseCharacter, accent: "Two square stitch cells form an acute accent above the base chart.",
      ...(base.similarity !== undefined ? { similarity: base.similarity } : {}),
    };
  }
  const donor = chooseDonor(target, character, fonts, similarityCache);
  if (!donor) throw new Error(`No source or sibling glyph found for ${character} in ${target.id}`);
  return {
    rows: donor.glyph.rows, method: donor.method, sourceFontId: donor.fontId,
    sourceFile: donor.glyph.sourceFile, similarity: Number(donor.similarity.toFixed(3)),
  };
}

function buildFont(definition, resolved) {
  const glyphRows = [...resolved.entries()].map(([character, record]) => ({ character, rows: record.rows }));
  const cell = 100;
  const maximumHeight = Math.max(1, ...glyphRows.map((glyph) => glyph.rows.length));
  const ascender = (maximumHeight + 1) * cell;
  const descender = -cell;
  const unitsPerEm = ascender - descender + cell;
  const fontGlyphs = [
    new opentype.Glyph({ name: ".notdef", unicode: 0, advanceWidth: 500, path: new opentype.Path() }),
    new opentype.Glyph({ name: "space", unicode: 32, advanceWidth: 260, path: new opentype.Path() }),
  ];
  for (const glyph of glyphRows) {
    const pathInfo = glyphPath(glyph.rows, cell);
    fontGlyphs.push(new opentype.Glyph({
      name: "u" + glyph.character.codePointAt(0).toString(16),
      unicode: glyph.character.codePointAt(0), advanceWidth: pathInfo.width, path: pathInfo.path,
    }));
  }
  return new opentype.Font({
    familyName: definition.name + " Modern Alt", styleName: "Regular", unitsPerEm,
    ascender, descender, glyphs: fontGlyphs,
  });
}

function matrixFile(fontId, character) {
  const codepoint = character.codePointAt(0).toString(16).toUpperCase().padStart(4, "0");
  return `modern-alt-txt/${fontId}/U+${codepoint}.txt`;
}

function assertTtfMatchesMatrices(buffer, resolved, id) {
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const parsed = opentype.parse(arrayBuffer);
  let checked = 0;
  for (const [character, record] of resolved) {
    const actual = parsed.charToGlyph(character).path.commands;
    const expected = glyphPath(record.rows, 100).path.commands;
    const compact = (commands) => commands.map((command) => [command.type, command.x, command.y, command.x1, command.y1, command.x2, command.y2]);
    if (JSON.stringify(compact(actual)) !== JSON.stringify(compact(expected))) {
      throw new Error(`TTF outline for ${id} ${JSON.stringify(character)} does not exactly match its TXT grid.`);
    }
    checked++;
  }
  return checked;
}

function main() {
  const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  for (const font of source.fonts) {
    for (const glyph of [...font.glyphs, ...(font.unmappedGlyphs || [])]) {
      const txtFile = glyph.txtFile || `source-txt/${font.id}/${glyph.sourceFile || `${glyph.id}.txt`}`;
      const txtPath = path.join(fontDir, txtFile);
      if (fs.existsSync(txtPath)) {
        glyph.rows = fs.readFileSync(txtPath, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/u).filter((row) => /^[01]+$/u.test(row));
      }
    }
  }
  const latinFonts = source.fonts.filter((font) => font.id !== "thjmsth_116_628");
  const similarityCache = buildSimilarityCache(latinFonts);
  fs.mkdirSync(outputDir, { recursive: true });
  const index = [];
  let verifiedGlyphCount = 0;
  for (const definition of latinFonts) {
    const resolved = new Map(), provenance = [];
    for (const character of modernLetters) {
      const record = resolveCharacter(definition, character, latinFonts, similarityCache);
      resolved.set(character, record);
      const exact = definition.glyphs.some((glyph) => glyph.character === character);
      if (!exact) provenance.push({ character, ...record });
    }
    const filename = definition.id + "-modern-alt.ttf";
    const font = buildFont(definition, resolved);
    const buffer = Buffer.from(font.toArrayBuffer());
    verifiedGlyphCount += assertTtfMatchesMatrices(buffer, resolved, definition.id);
    fs.writeFileSync(path.join(outputDir, filename), buffer);
    const glyphs = [];
    for (const [character, record] of resolved) {
      const txtFile = matrixFile(definition.id, character);
      writeMatrix(path.join(fontDir, txtFile), record.rows);
      glyphs.push({ character, txtFile });
      const addition = provenance.find((entry) => entry.character === character);
      if (addition) addition.txtFile = txtFile;
    }
    index.push({
      id: definition.id, name: definition.name + " Modern Alt", filename,
      sourceCharacters: [...new Set(definition.glyphs.map((glyph) => glyph.character))].sort((a, b) => a.localeCompare(b, "is")),
      characters: modernLetters, glyphs, additions: provenance,
      note: "Missing modern letters use the closest available source chart: same manuscript group first, then the highest average silhouette similarity across shared letters. Accented vowels are built from the selected base chart plus two square stitch cells. Every addition retains its source file and method.",
    });
  }
  fs.writeFileSync(path.join(fontDir, "modern-alt-index.json"), JSON.stringify({
    status: source.reviewStatus || "draft", alphabet: "Latin A–Z plus Icelandic letters",
    cellGeometry: "one vector cell per 1 in each generated TXT grid; no crop or geometric resampling",
    method: "Source-chart donors and documented source-style acute accents; no modern typeface fallback.",
    fonts: index,
  }, null, 2));
  console.log(`Built ${index.length} modern-alt TrueType fonts; verified ${verifiedGlyphCount} TTF glyph outlines against TXT grids.`);
}

main();
