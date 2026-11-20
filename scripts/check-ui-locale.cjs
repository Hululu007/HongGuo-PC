const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { transformSync } = require('esbuild');
const ROOT = path.resolve(__dirname, '..');

const main = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8');
const settingsStart = main.indexOf('const SETTINGS_KEYS =');
const settingsEnd = main.indexOf("ipcMain.handle('get-settings'", settingsStart);
assert(settingsStart >= 0 && settingsEnd > settingsStart, 'editable settings helper is present');
const sandbox = { normalizeProxySettings: value => ({ ...value }) };
vm.runInNewContext(main.slice(settingsStart, settingsEnd) + '\nthis.apply = applyEditableSettings;', sandbox);
for (const locale of ['auto', 'zh-CN', 'en-US']) {
  const current = { locale: 'zh-CN', root: 'isolated-downloads', ui_zoom: 1.5, custom_sources: [{ id: 'local' }] };
  const saved = sandbox.apply(current, { locale });
  assert.equal(saved.locale, locale, 'language preference survives the editable-settings allowlist');
  assert.equal(saved.ui_zoom, current.ui_zoom);
  assert.equal(saved.custom_sources, current.custom_sources);
  assert.equal(saved.root, current.root);
}
assert.equal(sandbox.apply({ locale: 'en-US' }, { compat_mode: true }).locale, 'en-US', 'unrelated saves preserve the language');
for (const invalid of ['', 'fr-FR', null, 1]) assert.throws(() => sandbox.apply({}, { locale: invalid }), /语言/);
console.log('PASS locale saves: supported values persist, invalid values fail, unrelated fields stay intact');

(async () => {
  const module = { exports: {} }, effects = [], language = { lang: 'zh-CN' };
  const window = new EventTarget();
  window.electronAPI = { getSettings: async () => ({ locale: 'en-US' }) };
  const react = { useState: () => [0, () => {}], useEffect: effect => effects.push(effect), useCallback: fn => fn, createElement() {} };
  const code = transformSync(fs.readFileSync(path.join(ROOT, 'src/i18n.js'), 'utf8'), { format: 'cjs', loader: 'jsx' }).code;
  vm.runInNewContext(code, { module, exports: module.exports, require: name => { assert.equal(name, 'react'); return react; },
    window, document: { documentElement: language }, navigator: { languages: ['zh-CN'] } });
  module.exports.useI18n();
  const cleanups = effects.splice(0).map(effect => effect());
  await new Promise(resolve => setImmediate(resolve));
  let api = module.exports.useI18n();
  assert.equal(api.locale, 'en-US');
  assert.equal(api.t('nav.settings'), 'Settings');
  assert.equal(language.lang, 'zh-CN', 'mostly Chinese document retains its primary language');
  api.setLocaleSetting('zh-CN');
  api = module.exports.useI18n();
  assert.equal(api.t('nav.settings'), '设置');
  const app = fs.readFileSync(path.join(ROOT, 'src/App.jsx'), 'utf8');
  assert.match(app, /<button lang=\{locale\} key=\{item.id\} className=\{`sidebar-item/);
  const settings = fs.readFileSync(path.join(ROOT, 'src/components/Settings.jsx'), 'utf8');
  assert.match(settings, /className="settings-header" lang=\{locale\}/);
  assert.match(settings, /className="settings-card" lang=\{locale\}/);
  cleanups.forEach(cleanup => cleanup?.());
  console.log('PASS locale pronunciation: saved English applied, translated regions mark lang, primary document stays Chinese');
})().catch(error => { console.error(error); process.exitCode = 1; });
