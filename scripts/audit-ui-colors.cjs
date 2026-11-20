// Inventory color literals without changing intentionally fixed media or artwork colors.
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'docs/screenshots/ui-audit-2026-11-20/color-audit.json');
const files = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) { if (entry.name !== '__tests__' && entry.name !== 'licenses') walk(file); }
    else if (/\.(css|jsx?|html|svg)$/.test(entry.name) && !/\.test\./.test(entry.name)) files.push(file);
  }
}
walk(path.join(ROOT, 'src'));
for (const name of ['main.js', 'preload.js', 'index.html']) files.push(path.join(ROOT, name));
const occurrences = [];
for (const file of files) {
  const relative = path.relative(ROOT, file).split(path.sep).join('/');
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  let selector = '';
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const brace = line.indexOf('{');
    if (file.endsWith('.css') && brace >= 0) selector = line.slice(0, brace).trim() || selector;
    for (const match of line.matchAll(/#[0-9a-f]{8}\b|#[0-9a-f]{6}\b|#[0-9a-f]{4}\b|#[0-9a-f]{3}\b|\brgba?\([^)]*\)|\bhsla?\([^)]*\)|\b(?:fill|stroke)=["'](?:white|black|currentColor|none)["']|\b(?:color|background(?:-color)?)\s*:\s*(?:white|black)\b/gi)) {
      const literal = match[0];
      let category = 'C', reason = 'Review in context; a literal alone is not a confirmed theme defect.';
      if (relative === 'src/index.css' && /--[\w-]+\s*:/.test(line)) {
        category = 'A'; reason = 'Central design-token definition, not a component bypass.';
      } else if (/currentColor|none/.test(literal)) {
        category = 'B'; reason = 'Theme-inherited SVG paint or explicitly absent paint.';
      } else if (/splash\.css$/.test(relative) || /\/CommentDanmaku\.css$/.test(relative)
        || /mask(?:-image)?\s*:/.test(line) || /(?:player-video|player-stage|player-controls-bar|player-now-playing|qr|logo|badge|poster|cover)/.test(selector)
        || /theme="dark"/.test(selector)) {
        category = 'B'; reason = 'Contextual exception candidate: media contrast, artwork, mask, or explicitly dark-scoped decoration.';
      }
      occurrences.push({ file: relative, line: index + 1, literal, selector: file.endsWith('.css') ? selector : undefined, category, reason });
    }
  }
}
const byCategory = Object.fromEntries(['A','B','C'].map(category => [category, occurrences.filter(item => item.category === category).length]));
const result = {
  generatedAt: new Date().toISOString(), filesScanned: files.length, literalOccurrences: occurrences.length, byCategory,
  categories: {
    A: 'Central token definitions; component UI colors should refer to semantic tokens.',
    B: 'Contextual intentional/inherited exception candidates; not evidence of an error.',
    C: 'Remaining literal requiring contextual review; not automatically a bug.',
    D: 'Confirmed theme defects are enumerated with before/after evidence in docs/ui-ux-audit-2026-11-20.md, rather than inferred from this lexical scan.',
  },
  limitations: 'Lexical inventory only. CSS selector context is a best-effort clue. Images, remote official-login pages and OS-owned dialogs are not recolored or certified by this scan.',
  occurrences,
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
console.log(JSON.stringify({ filesScanned: result.filesScanned, literalOccurrences: result.literalOccurrences, byCategory, output: path.relative(ROOT, OUT) }));
