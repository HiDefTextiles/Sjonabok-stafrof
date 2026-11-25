import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const galleryDir = path.resolve(scriptDir, "..");
const fontDir = path.join(galleryDir, "fonts");
const configPath = path.join(fontDir, "font-groups.yml");
const fontIndex = JSON.parse(fs.readFileSync(path.join(fontDir, "font-index.json"), "utf8"));
const patternIndex = JSON.parse(fs.readFileSync(path.join(galleryDir, "patterns", "patterns.json"), "utf8"));

function parseConfig(text) {
  const groups = {};
  let inGroups = false, current = null;
  for (const line of text.split(/\r?\n/u)) {
    if (/^groups:\s*$/u.test(line)) { inGroups = true; continue; }
    if (!inGroups || !line.trim() || /^\s*#/u.test(line)) continue;
    const group = line.match(/^  ([\w-]+):\s*$/u);
    if (group) { current = group[1]; groups[current] = {}; continue; }
    const field = line.match(/^    ([a-z_]+):\s*"([^"]*)"\s*$/u);
    if (field && current) groups[current][field[1]] = field[2];
  }
  return groups;
}

function sourceGroup(fontId) { return fontId.replace(/_\d+$/u, ""); }
const sourceGroups = [...new Set(fontIndex.fonts.map((font) => sourceGroup(font.id)))].sort();
const configGroups = parseConfig(fs.readFileSync(configPath, "utf8"));
const missing = sourceGroups.filter((group) => !configGroups[group]);
const extra = Object.keys(configGroups).filter((group) => !sourceGroups.includes(group));
if (missing.length || extra.length) throw new Error(`Font-group YAML mismatch. Missing: ${missing.join(", ") || "none"}; extra: ${extra.join(", ") || "none"}.`);

const patternById = new Map(patternIndex.patterns.map((pattern) => [pattern.id, pattern]));
const frames = sourceGroups.map((group) => {
  const choice = configGroups[group], pattern = patternById.get(choice.pattern_id);
  if (!pattern) throw new Error(`Unknown Sjónabók pattern ${choice.pattern_id} for ${group}.`);
  if (!new Set(["repeat-border", "corner-motif"]).has(choice.treatment)) throw new Error(`Unsupported frame treatment for ${group}.`);
  if (choice.treatment === "repeat-border") {
    if (pattern.source !== group || !["border", "edging"].includes(pattern.kind) || !pattern.unit || pattern.repeat_status !== "ok") {
      throw new Error(`Configured repeat-border for ${group} must be a validated repeat border/edging chart from that source group.`);
    }
  } else if (pattern.source !== group || pattern.kind === "border" || pattern.kind === "edging" || !choice.rationale) {
    throw new Error(`Corner-motif for ${group} must cite a non-border chart in the same source group and explain the adaptation.`);
  }
  const matrixFile = path.join(galleryDir, "patterns", "txt", `${pattern.id}.txt`);
  if (!fs.existsSync(matrixFile)) throw new Error(`Missing TXT motif grid for ${pattern.id}.`);
  const rows = fs.readFileSync(matrixFile, "utf8").replace(/^\uFEFF/u, "").split(/\r?\n/u).filter((row) => /^[01]+$/u.test(row));
  return {
    sourceGroup: group,
    fontCount: fontIndex.fonts.filter((font) => sourceGroup(font.id) === group).length,
    patternId: pattern.id,
    patternSource: pattern.source,
    patternKind: pattern.kind,
    treatment: choice.treatment,
    rationale: choice.rationale,
    matrixFile: `patterns/txt/${pattern.id}.txt`,
    matrixWidth: Math.max(...rows.map((row) => row.length)),
    matrixHeight: rows.length,
    filledCells: pattern.ones,
  };
});
const output = {
  title: "Sjónabók font source-group frames",
  note: "Source-group IDs organize chart records; they are not claims of historical typeface families. Repeat-border choices are from the same corpus source group. The thjms2007-45 rosette is an explicitly modern corner-frame adaptation because the current pattern index contains no border or edging chart for that group.",
  groups: frames,
};
fs.writeFileSync(path.join(fontDir, "font-group-frames.json"), JSON.stringify(output, null, 2) + "\n", "utf8");
console.log(`Validated ${frames.length} source-group frame choices against the corpus TXT matrices.`);
