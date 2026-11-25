import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import opentype from "opentype.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../..");
const localRoot = path.resolve(repoRoot, "../..");
const sourcePath = path.join(repoRoot, "gallery", "fonts", "font-source.json");
const outputDir = path.join(repoRoot, "gallery", "fonts");
const fontDir = outputDir;
const inputDir = path.join(localRoot, "alphabet", "txt");
const fallbackName = "natmus453_760_p7.txt";

function readMatrix(filePath) {
  return fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "")
    .split(/\r?\n/).map((row) => row.trimEnd()).filter((row) => /^[01]+$/.test(row));
}

function writeMatrix(filePath, rows) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, rows.join("\n") + "\n", "utf8");
}

function fontName(id) {
  const m = id.match(/^(.+)_(\d+)$/);
  if (!m) return "Sjonabok " + id;
  const labels = {
    natmus453: "Natmus 453", thjms1105: "Þjms. 1105",
    "thjms1960-60": "Þjms. 1960-60", "thjms1985-235": "Þjms. 1985-235",
    "thjms1997-123": "Þjms. 1997-123", "thjms2007-45": "Þjms. 2007-45",
    "thjms2008-14": "Þjms. 2008-14", thjms5898: "Þjms. 5898",
    thjms6950: "Þjms. 6950", "thjmsth_116": "Þjms. Th 116",
  };
  return "Sjónabók " + (labels[m[1]] || m[1]) + " " + m[2];
}

function importLocalSource() {
  const names = fs.readdirSync(inputDir).filter((name) => /^.+_l.+\.txt$/i.test(name));
  const fonts = new Map();
  for (const name of names) {
    const match = name.match(/^(.+)_l(.+)\.txt$/u);
    if (!match || [...match[2]].length !== 1) continue;
    const id = match[1], character = match[2];
    const rows = readMatrix(path.join(inputDir, name));
    if (!rows.length) continue;
    if (!fonts.has(id)) fonts.set(id, []);
    fonts.get(id).push({ character, id: id + "_l" + character, sourceFile: name, rows });
  }
  if (!fonts.size) throw new Error("No one-character alphabet glyphs found in " + inputDir);
  const alphabetList = path.join(localRoot, "alphabet_list");
  const futharkId = "thjmsth_116_628";
  const futharkGlyphs = [];
  const futharkUnmapped = [];
  if (fs.existsSync(alphabetList)) {
    for (const line of fs.readFileSync(alphabetList, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/)) {
      const match = line.match(/^(.+?_p\d+\.txt)\s+(.+?)\s*$/u);
      if (!match || !match[1].startsWith(futharkId + "_")) continue;
      const [sourceFile, label] = [match[1], match[2].trim()];
      const rows = readMatrix(path.join(inputDir, sourceFile));
      const character = label.match(/^fúþark(.+)$/iu)?.[1];
      if (character && [...character].length === 1) {
        futharkGlyphs.push({ character, id: sourceFile.replace(/\.txt$/u, ""), sourceFile, rows });
      } else {
        futharkUnmapped.push({ id: sourceFile.replace(/\.txt$/u, ""), sourceFile, label, rows });
      }
    }
  }
  if (futharkGlyphs.length) fonts.set(futharkId, futharkGlyphs);
  const fallbackPath = path.join(inputDir, fallbackName);
  if (!fs.existsSync(fallbackPath)) throw new Error("Missing manuscript fallback glyph: " + fallbackPath);
  return {
    reviewStatus: "draft",
    note: "Character labels are draft transcriptions from local alphabet split filenames and need visual review. Source matrices are retained so labels can be corrected.",
    fallback: { id: "natmus453_760_p7", sourceFile: fallbackName, rows: readMatrix(fallbackPath) },
    fonts: [...fonts.entries()].sort(([a], [b]) => a.localeCompare(b, "en")).map(([id, glyphs]) => ({
      id,
      name: id === futharkId ? "Sjónabók Þjms. Th 116 628 Futhark" : fontName(id),
      glyphs: glyphs.sort((a, b) => a.character.localeCompare(b.character, "en")),
      ...(id === futharkId ? { unmappedGlyphs: futharkUnmapped } : {}),
    })),
  };
}

function trim(matrix) {
  let y0 = matrix.length, y1 = -1, x0 = Infinity, x1 = -1;
  matrix.forEach((row, y) => [...row].forEach((v, x) => {
    if (v === "1") { y0 = Math.min(y0, y); y1 = Math.max(y1, y); x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
  }));
  if (y1 < 0) return ["0"];
  return matrix.slice(y0, y1 + 1).map((row) => row.slice(x0, x1 + 1));
}

function rowsToRuns(rows) {
  const active = new Map(), rects = [];
  for (let y = 0; y <= rows.length; y++) {
    const row = rows[y] || "", runs = [];
    for (let x = 0; x < row.length;) {
      if (row[x] !== "1") { x++; continue; }
      const start = x;
      while (x < row.length && row[x] === "1") x++;
      runs.push(start + ":" + x);
    }
    const next = new Set(runs);
    for (const [key, firstY] of active) {
      if (!next.has(key)) {
        const [x0, x1] = key.split(":").map(Number);
        rects.push({ x0, x1, y0: firstY, y1: y });
        active.delete(key);
      }
    }
    for (const key of next) if (!active.has(key)) active.set(key, y);
  }
  return rects;
}

function pathFor(rows, cell, left = 0) {
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

function characterClasses(characters) {
  const classes = [];
  if (characters.some((character) => /\p{Letter}/u.test(character))) classes.push("letters");
  if (characters.some((character) => /\p{Number}/u.test(character))) classes.push("numbers");
  return classes;
}

function makeFont(definition) {
  const glyphs = definition.glyphs;
  const lookup = new Map();
  for (const g of glyphs) if (!lookup.has(g.character)) lookup.set(g.character, g);
  for (const c of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
    const lower = c.toLowerCase();
    if (lookup.has(c) && !lookup.has(lower)) lookup.set(lower, lookup.get(c));
    if (lookup.has(lower) && !lookup.has(c)) lookup.set(c, lookup.get(lower));
  }
  for (const [upper, lower] of [["Þ", "þ"], ["Æ", "æ"], ["Ö", "ö"], ["Ð", "ð"]]) {
    if (lookup.has(upper) && !lookup.has(lower)) lookup.set(lower, lookup.get(upper));
    if (lookup.has(lower) && !lookup.has(upper)) lookup.set(upper, lookup.get(lower));
  }
  const cell = 100;
  const maximumHeight = Math.max(1, ...glyphs.map((g) => g.rows.length));
  const ascender = (maximumHeight + 1) * cell;
  const descender = -cell;
  const unitsPerEm = ascender - descender + cell;
  const fontGlyphs = [
    new opentype.Glyph({ name: ".notdef", unicode: 0, advanceWidth: cell * 3, path: new opentype.Path() }),
    new opentype.Glyph({ name: "space", unicode: 32, advanceWidth: 260, path: new opentype.Path() }),
  ];
  for (const [character, sourceGlyph] of lookup) {
    const cp = character.codePointAt(0);
    const shaped = pathFor(sourceGlyph.rows, cell);
    fontGlyphs.push(new opentype.Glyph({
      name: "u" + cp.toString(16),
      unicode: cp, advanceWidth: shaped.width, path: shaped.path,
    }));
  }
  const font = new opentype.Font({
    familyName: definition.name, styleName: "Regular", unitsPerEm,
    ascender, descender, glyphs: fontGlyphs,
  });
  return {
    font, glyphCount: definition.glyphs.length,
    characters: [...lookup.keys()].sort((a, b) => a.localeCompare(b, "en")),
    characterClasses: characterClasses([...lookup.keys()]),
    outlineRows: [...lookup.entries()].map(([character, glyph]) => [character, glyph.rows]),
  };
}

function matrixPath(fontId, sourceFile) {
  return path.join(outputDir, "source-txt", fontId, sourceFile);
}

function ensureTextMatrices(source) {
  for (const definition of source.fonts) {
    for (const glyph of [...definition.glyphs, ...(definition.unmappedGlyphs || [])]) {
      const filename = glyph.sourceFile || `${glyph.id}.txt`;
      const txtPath = matrixPath(definition.id, filename);
      if (fs.existsSync(txtPath)) glyph.rows = readMatrix(txtPath);
      else writeMatrix(txtPath, glyph.rows);
      glyph.txtFile = path.relative(fontDir, txtPath).replaceAll(path.sep, "/");
    }
  }
  const fallbackPath = matrixPath("_reference", "missing-mark.txt");
  if (fs.existsSync(fallbackPath)) source.fallback.rows = readMatrix(fallbackPath);
  else writeMatrix(fallbackPath, source.fallback.rows);
  source.fallback.txtFile = path.relative(fontDir, fallbackPath).replaceAll(path.sep, "/");
}

function assertTtfMatchesMatrices(buffer, outlineRows, id) {
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const parsed = opentype.parse(arrayBuffer);
  let checked = 0;
  for (const [character, rows] of outlineRows) {
    const actual = parsed.charToGlyph(character).path.commands;
    const expected = pathFor(rows, 100).path.commands;
    const compact = (commands) => commands.map((command) => [command.type, command.x, command.y, command.x1, command.y1, command.x2, command.y2]);
    if (JSON.stringify(compact(actual)) !== JSON.stringify(compact(expected))) {
      throw new Error(`TTF outline for ${id} ${JSON.stringify(character)} does not exactly match its TXT grid.`);
    }
    checked++;
  }
  for (const character of [..."ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÁáÐðÉéÍíÓóÚúÝýÞþÆæÖö0123456789"]) {
    if (outlineRows.some(([mapped]) => mapped === character)) continue;
    if (parsed.charToGlyph(character).index !== 0) {
      throw new Error(`TTF unexpectedly maps unsupported character ${JSON.stringify(character)} in ${id}.`);
    }
  }
  return checked;
}

function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  if (!fs.existsSync(sourcePath)) {
    fs.writeFileSync(sourcePath, JSON.stringify(importLocalSource()));
    console.log("Imported local alphabet matrices -> " + sourcePath);
  }
  const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  ensureTextMatrices(source);
  fs.writeFileSync(sourcePath, JSON.stringify(source, null, 2) + "\n", "utf8");
  const index = [];
  let verifiedGlyphCount = 0;
  for (const definition of source.fonts) {
    const built = makeFont(definition);
    const filename = definition.id + ".ttf";
    const buffer = Buffer.from(built.font.toArrayBuffer());
    verifiedGlyphCount += assertTtfMatchesMatrices(buffer, built.outlineRows, definition.id);
    fs.writeFileSync(path.join(outputDir, filename), buffer);
    index.push({
      id: definition.id, name: definition.name, filename, glyphCount: built.glyphCount,
      characters: built.characters, characterClasses: built.characterClasses,
      glyphs: definition.glyphs.map((glyph) => ({ character: glyph.character, txtFile: glyph.txtFile, sourceFile: glyph.sourceFile })),
      unmappedCount: definition.unmappedGlyphs?.length || 0,
      status: source.reviewStatus || "draft", note: source.note || "",
    });
  }
  fs.writeFileSync(path.join(outputDir, "font-index.json"), JSON.stringify({
    status: source.reviewStatus || "draft",
    cellGeometry: "one vector cell per 1 in the TXT grid; no crop or geometric resampling",
    fonts: index,
  }, null, 2));
  console.log(`Built ${index.length} TrueType fonts; verified ${verifiedGlyphCount} TTF glyph outlines against TXT grids.`);
}
main();

