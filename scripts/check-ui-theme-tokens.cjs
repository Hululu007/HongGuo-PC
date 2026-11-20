const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const postcss = require('postcss');

const root = path.resolve(__dirname, '..');
const globalCss = postcss.parse(fs.readFileSync(path.join(root, 'src/index.css'), 'utf8'));
const pageCss = postcss.parse(fs.readFileSync(path.join(root, 'src/components/HongguoDownload.css'), 'utf8'));

function variables(css, selector) {
  const rule = css.nodes.find(node => node.type === 'rule' && node.selector === selector);
  assert(rule, `theme token block exists: ${selector}`);
  const result = {};
  rule.walkDecls(/^--/, declaration => { result[declaration.prop] = declaration.value; });
  return result;
}

function luminance(value) {
  const channels = value.match(/^#([0-9a-f]{6})$/i)?.[1];
  assert(channels, `expected opaque six-digit color, got ${value}`);
  const rgb = channels.match(/.{2}/g).map(channel => parseInt(channel, 16) / 255);
  const linear = rgb.map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4);
  return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
}

function contrast(first, second) {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + .05) / (values[1] + .05);
}

function atLeast(first, second, minimum, label) {
  const actual = contrast(first, second);
  assert(actual >= minimum, `${label}: ${actual.toFixed(2)}:1 is below ${minimum}:1`);
  console.log(`PASS ${label}: ${actual.toFixed(2)}:1`);
}

const light = variables(globalCss, ':root');
const dark = variables(globalCss, ':root[data-theme="dark"]');
const white = '#ffffff';

atLeast(light['--text-tertiary'], light['--bg-canvas'], 4.5, 'light tertiary text on canvas');
atLeast(dark['--text-tertiary'], dark['--bg-card'], 4.5, 'dark tertiary text on card');
atLeast(light['--action-text'], light['--action-bg'], 4.5, 'light primary action label');
atLeast(light['--action-text'], light['--action-hover-bg'], 4.5, 'light primary action hover label');
atLeast(dark['--action-text'], dark['--action-bg'], 4.5, 'dark primary action label');
atLeast(dark['--action-text'], dark['--action-hover-bg'], 4.5, 'dark primary action hover label');
atLeast(light['--danger'], light['--danger-bg'], 4.5, 'light danger label');
atLeast(light['--warning'], light['--bg-canvas'], 4.5, 'light warning label');
atLeast(light['--success'], light['--success-bg'], 4.5, 'light success label');
atLeast(light['--control-border'], white, 3, 'light form boundary');
atLeast(light['--control-border'], light['--bg-canvas'], 3, 'light form boundary on canvas');
atLeast(dark['--control-border'], dark['--bg-input'], 3, 'dark form boundary');
atLeast(light['--focus-ring'], light['--bg-canvas'], 3, 'light keyboard focus indicator');
atLeast(dark['--focus-ring'], dark['--bg-canvas'], 3, 'dark keyboard focus indicator');

const lightTab = pageCss.nodes.find(node => node.type === 'rule' && node.selector === ':root:not([data-theme="dark"]) .mode-tab.active');
assert(lightTab, 'light active search mode tab uses an explicit light treatment');
assert.equal(lightTab.nodes.some(node => node.type === 'decl' && node.important), false, 'light active tab must not depend on !important overrides');
assert.equal(lightTab.nodes.find(node => node.type === 'decl' && node.prop === 'color')?.value, 'var(--text-primary)', 'active light tab uses semantic text color');
assert.equal(lightTab.nodes.find(node => node.type === 'decl' && node.prop === 'background')?.value, 'var(--bg-elevated)', 'active light tab uses a light semantic surface');
assert(light['--text-muted'] && light['--control-border'], 'all component-referenced semantic control tokens are defined');
console.log('PASS dual-theme active tab: semantic colors and no forced dark-theme override');

const readCss = file => postcss.parse(fs.readFileSync(path.join(root, 'src/components', file), 'utf8'));
const browseCss = readCss('Browse.css');
const playerCss = readCss('Player.css');
const managerCss = readCss('DownloadManager.css');
const accountCss = readCss('AccountManagement.css');
const seasonCss = readCss('SeasonSwitcher.css');
function declaration(css, selector, property) {
  const rules = css.nodes.filter(node => node.type === 'rule' && node.selector === selector);
  return rules.flatMap(rule => rule.nodes).filter(node => node.type === 'decl' && node.prop === property).at(-1)?.value;
}
function resolve(value, theme) {
  return value.replace(/var\((--[\w-]+)\)/g, (_, name) => {
    assert(theme[name], `token exists: ${name}`);
    return resolve(theme[name], theme);
  }).replace(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i, '#$1$1$2$2$3$3');
}
function composite(foreground, background) {
  if (/^#[0-9a-f]{8}$/i.test(foreground)) {
    const channels = foreground.slice(1).match(/.{2}/g).map(value => parseInt(value, 16));
    foreground = `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${channels[3] / 255})`;
  }
  const match = foreground.match(/^rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([.\d]+)\s*\)$/);
  assert(match, `expected rgba color, got ${foreground}`);
  const back = background.slice(1).match(/.{2}/g).map(value => parseInt(value, 16));
  const alpha = Number(match[4]);
  return '#' + back.map((value, i) => Math.round(Number(match[i + 1]) * alpha + value * (1 - alpha)).toString(16).padStart(2, '0')).join('');
}
for (const [name, theme] of [['light', light], ['dark', { ...light, ...dark }]]) {
  const color = token => resolve(theme[token], theme);
  atLeast(color('--status-fill-text'), color('--success-fill'), 4.5, `${name} success badge and toast label`);
  atLeast(color('--status-fill-text'), color('--danger-fill'), 4.5, `${name} danger button and error toast label`);
  atLeast(color('--status-fill-text'), color('--danger-hover'), 4.5, `${name} danger hover label`);
  const selected = name === 'light' ? color('--accent-soft') : composite(color('--accent-soft'), color('--bg-card'));
  atLeast(color('--accent-text'), selected, 4.5, `${name} selected status text`);
  atLeast(color('--warning'), selected, 3, `${name} online marker on selected episode`);
}
assert.equal(declaration(browseCss, '.browse-dl-badge', 'background'), 'var(--success-fill)', 'download badge must use an opaque verified fill, not a poster-dependent gradient');
assert.equal(declaration(browseCss, '.browse-dl-badge', 'color'), 'var(--status-fill-text)');
for (const [css, selector] of [[accountCss, '.account-source-tab.is-active'], [managerCss, '.status-downloading'],
  [playerCss, '.series-row-cur'], [playerCss, '.player-now-status.status-downloading'], [seasonCss, '.season-chip.season-current']]) {
  assert.equal(declaration(css, selector, 'color'), 'var(--accent-text)', `${selector} uses readable semantic selected text`);
}
assert.equal(declaration(seasonCss, '.season-chip.season-current', 'opacity'), '1', 'current season stays disabled without fading its status label');
assert.equal(declaration(playerCss, '.ep-online-dot', 'background'), 'var(--warning)');
const toastRules = globalCss.nodes.filter(node => node.type === 'rule' && node.selector.includes('.dm-toast'));
assert.deepEqual(toastRules.map(rule => rule.selector), ['.dm-toast', '.dm-toast-success', '.dm-toast-error'], 'one ordered central toast base and variants; no higher-specificity theme override');
assert.equal(managerCss.nodes.some(node => node.type === 'rule' && node.selector.includes('.dm-toast')), false, 'component CSS must not redefine shared toast variants');
assert.equal(declaration(globalCss, '.dm-toast-success', 'background'), 'var(--success-fill)');
assert.equal(declaration(globalCss, '.dm-toast-error', 'background'), 'var(--danger-fill)');
const frameBackground = composite(declaration(playerCss, '.player-placeholder.player-placeholder-over-frame', 'background'), white);
atLeast(declaration(playerCss, '.player-placeholder', 'color'), frameBackground, 4.5, 'retained white frame loading title');
atLeast(declaration(playerCss, '.player-placeholder-sub, .compat-overlay-sub', 'color'), frameBackground, 4.5, 'retained white frame loading explanation');
atLeast(declaration(playerCss, '.player-placeholder .btn-outline', 'color'), frameBackground, 4.5, 'retained white frame cancel label');
const frameBoundary = composite(declaration(playerCss, '.player-placeholder.player-placeholder-over-frame .btn-outline', 'border-color'), frameBackground);
atLeast(frameBoundary, frameBackground, 3, 'retained white frame cancel boundary');
console.log('PASS state color contracts: opaque badge, central toast variants, selected status, current season and media overlay');
