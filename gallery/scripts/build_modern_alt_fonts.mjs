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
const modernDigits = [..."0123456789"];

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

function characterClasses(glyphs) {
  const characters = glyphs.map((glyph) => glyph.character);
  return [
    ...(characters.some((character) => /\p{Letter}/u.test(character)) ? ["letters"] : []),
    ...(characters.some((character) => /\p{Number}/u.test(character)) ? ["numbers"] : []),
  ];
}

function medianGlyphHeight(font) {
  const heights = font.glyphs.map((glyph) => glyph.rows.length).sort((a, b) => a - b);
  return heights.length ? heights[Math.floor(heights.length / 2)] : 0;
}

function sourceGroup(fontId) {
  return fontId.replace(/_\d+$/u, "");
}

function characterClass(character) {
  if (/\p{Letter}/u.test(character)) return "letters";
  if (/\p{Number}/u.test(character)) return "numbers";
  return null;
}

function findManuscriptDonor(target, character, fonts) {
  const targetHeight = medianGlyphHeight(target);
  const targetGroup = sourceGroup(target.id);
  const candidates = fonts
    .filter((font) => font.id !== target.id && sourceGroup(font.id) === targetGroup)
    .filter((font) => characterClasses(font.glyphs).includes(characterClass(character)))
    .map((font) => ({ font, heightDifference: Math.abs(medianGlyphHeight(font) - targetHeight) }))
    .filter(({ heightDifference }) => heightDifference <= 1)
    .sort((a, b) => a.heightDifference - b.heightDifference || a.font.id.localeCompare(b.font.id));

  for (const { font, heightDifference } of candidates) {
    const source = caseGlyph(font, character);
    if (!source) continue;
    return {
      rows: source.glyph.rows,
      method: "same-manuscript-matching-glyph",
      sourceFontId: font.id,
      sourceCharacter: source.glyph.character,
      sourceFile: source.glyph.sourceFile,
      targetMedianHeight: targetHeight,
      donorMedianHeight: medianGlyphHeight(font),
      medianHeightDifference: heightDifference,
    };
  }
  return null;
}

function resolveCharacter(target, character, fonts) {
  const own = caseGlyph(target, character);
  if (own) return {
    rows: own.glyph.rows, method: own.method,
    sourceFontId: target.id, sourceCharacter: own.glyph.character, sourceFile: own.glyph.sourceFile,
  };
  return findManuscriptDonor(target, character, fonts);
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
    familyName: definition.name + " Alt", styleName: "Regular", unitsPerEm,
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
  const included = new Set(resolved.keys());
  for (const character of [...modernLetters, ...modernDigits]) {
    if (included.has(character)) continue;
    if (parsed.charToGlyph(character).index !== 0) {
      throw new Error(`Modern-alt TTF unexpectedly maps unavailable character ${JSON.stringify(character)} in ${id}.`);
    }
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
  fs.mkdirSync(outputDir, { recursive: true });
  const index = [];
  let verifiedGlyphCount = 0;
  const expectedTxtFiles = new Set();
  for (const definition of latinFonts) {
    const classes = characterClasses(definition.glyphs);
    const targetCharacters = [
      ...(classes.includes("letters") ? modernLetters : []),
      ...(classes.includes("numbers") ? modernDigits : []),
    ];
    const resolved = new Map(), provenance = [], missingCharacters = [];
    for (const character of targetCharacters) {
      const record = resolveCharacter(definition, character, latinFonts);
      if (!record) {
        missingCharacters.push(character);
        continue;
      }
      resolved.set(character, record);
      const exact = definition.glyphs.some((glyph) => glyph.character === character);
      if (!exact) provenance.push({ character, ...record });
    }
    const filename = definition.id + "-alt.ttf";
    const font = buildFont(definition, resolved);
    const buffer = Buffer.from(font.toArrayBuffer());
    verifiedGlyphCount += assertTtfMatchesMatrices(buffer, resolved, definition.id);
    fs.writeFileSync(path.join(outputDir, filename), buffer);
    const glyphs = [];
    for (const [character, record] of resolved) {
      const txtFile = matrixFile(definition.id, character);
      writeMatrix(path.join(fontDir, txtFile), record.rows);
      expectedTxtFiles.add(path.resolve(fontDir, txtFile));
      glyphs.push({ character, txtFile });
      const addition = provenance.find((entry) => entry.character === character);
      if (addition) addition.txtFile = txtFile;
    }
    index.push({
      id: definition.id, name: definition.name + " Alt", filename,
      sourceCharacters: [...new Set(definition.glyphs.map((glyph) => glyph.character))].sort((a, b) => a.localeCompare(b, "is")),
      characterClasses: classes, targetCharacters, characters: [...resolved.keys()], missingCharacters,
      glyphs, additions: provenance,
      note: "The set preserves the letter/number classes present on the source chart. It uses chart glyphs and same-chart case forms first. An added character may use the same labeled glyph from another chart in the same manuscript group only when the source charts' median glyph heights differ by no more than one stitch row. No glyphs are drawn or borrowed across manuscripts. Unsupported characters remain missing.",
    });
  }
  for (const entry of fs.readdirSync(path.join(fontDir, "modern-alt-txt"), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(fontDir, "modern-alt-txt", entry.name);
    for (const filename of fs.readdirSync(dir)) {
      const filePath = path.resolve(dir, filename);
      if (filename.endsWith(".txt") && !expectedTxtFiles.has(filePath)) fs.unlinkSync(filePath);
    }
  }
  const sourceGlyphs = source.fonts.flatMap((font) => font.glyphs);
  const comparisonGrid = {
    width: Math.max(1, ...sourceGlyphs.flatMap((glyph) => glyph.rows.map((row) => row.length))),
    height: Math.max(1, ...sourceGlyphs.map((glyph) => glyph.rows.length)),
  };
  fs.writeFileSync(path.join(fontDir, "modern-alt-index.json"), JSON.stringify({
    status: source.reviewStatus || "draft", alphabet: "Letter and number classes follow each source chart",
    cellGeometry: "one vector cell per 1 in each generated TXT grid; no crop or geometric resampling",
    comparisonGrid,
    method: "Direct chart glyphs and same-chart case aliases first; exact labeled glyphs may be reused from the same manuscript group only when source-chart median glyph heights differ by at most one stitch row. No cross-manuscript donors, programmatic glyph construction, or modern typeface fallback.",
    fonts: index,
  }, null, 2));
  console.log(`Built ${index.length} modern-alt TrueType fonts; verified ${verifiedGlyphCount} TTF glyph outlines against TXT grids.`);
}

main();
