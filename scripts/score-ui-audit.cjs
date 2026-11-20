// Reproducible comparison of checks present in both saved UI audit runs.
// This is a bounded evidence score, not an aesthetic or accessibility certification.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const directory = path.join(root, 'docs/screenshots/ui-audit-2026-11-20');
const source = mode => path.join(directory, mode, 'evidence.json');
const themes = ['light', 'dark'];
const pageIds = ['browse', 'feed', 'download', 'player', 'history', 'calendar', 'manager', 'account', 'announcements', 'settings'];

function score(evidence) {
  const checks = [];
  for (const theme of themes) {
    const pages = evidence.pages.filter(item => item.theme === theme);
    const explicit = evidence.themeChecks.find(item => item.kind === 'explicit-settings-select' && item.requested === theme);
    const system = evidence.themeChecks.find(item => item.kind === 'nativeTheme-system-simulation')?.checks.find(item => item.themeSource === theme);
    const palette = evidence.paletteChecks.find(item => item.theme === theme);
    const navigation = evidence.collapsedNavigation.find(item => item.theme === theme);
    const tertiary = pages.find(item => item.page === 'browse')?.default.tertiary;
    assert(explicit && system && palette && navigation && tertiary, `${theme}: comparable evidence must exist in both runs`);
    const add = (id, passed, observed) => checks.push({ id: `${theme}/${id}`, passed: passed === true, observed });
    add('all-ten-pages-nonempty', pages.length === pageIds.length && pageIds.every(id => pages.some(item => item.page === id && !item.default.content.empty)), pages.length);
    add('explicit-theme-applied', explicit.rendered === theme && explicit.preference === theme, { rendered: explicit.rendered, preference: explicit.preference });
    add('system-theme-followed', system.matchMediaChanged && system.themeApplied, system);
    add('palette-opens', palette.opened, palette.opened);
    add('palette-initial-input-focus', palette.initialFocus === 'command-palette-input', palette.initialFocus);
    add('palette-tab-contained', palette.tabStayedInside, palette.tabFocus);
    add('palette-escape-closes', palette.escapeClosed, palette.escapeClosed);
    add('palette-restores-trigger-focus', palette.focusRestored, palette.restoredFocus);
    add('all-collapsed-navigation-named', navigation.names.length === pageIds.length && navigation.names.every(item => item.hasAccessibleName), navigation.names.filter(item => item.hasAccessibleName).length);
    add('tertiary-token-on-canvas-contrast', Number.isFinite(tertiary.tokenContrastVsCanvas) && tertiary.tokenContrastVsCanvas >= 4.5, tertiary.tokenContrastVsCanvas);
  }
  assert.equal(checks.length, 20);
  const passed = checks.filter(item => item.passed).length;
  return { passed, total: checks.length, score: passed / checks.length * 100, checks };
}

const before = score(JSON.parse(fs.readFileSync(source('before'), 'utf8')));
const after = score(JSON.parse(fs.readFileSync(source('after'), 'utf8')));
const result = {
  generatedAt: new Date().toISOString(),
  scope: 'Twenty equally weighted, common, persisted checks: ten per theme. Each passing check contributes five points.',
  limitations: 'Retrospective evidence score only; not an overall product, aesthetic, WCAG, playback, system-DPI or release-readiness score. Unmeasured states are not assigned passing scores.',
  sources: ['before/evidence.json', 'after/evidence.json'],
  before,
  after,
};
const output = path.join(directory, 'scorecard.json');
fs.writeFileSync(output, JSON.stringify(result, null, 2));
console.log(`UI evidence score: before ${before.score}/100 (${before.passed}/${before.total}); after ${after.score}/100 (${after.passed}/${after.total})`);
console.log(`Scorecard: ${path.relative(root, output)}`);
