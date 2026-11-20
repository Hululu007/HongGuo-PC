// Evaluate the exact fixed UI audit programs without launching Electron or playing media.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, 'check-ui-theme.cjs'), 'utf8');
const pagesSource = source.slice(source.indexOf('  const pageActions ='), source.indexOf('  const pageIds ='));
const menusSource = source.slice(source.indexOf('  const playerMenuActions ='), source.indexOf('  async function optionalPlayerMenus'));
assert.ok(pagesSource && menusSource);
assert.doesNotMatch(pagesSource + menusSource, /\$\{|JSON\.stringify/, 'audit selection programs must stay literal, not sanitized dynamic code');
const pages = vm.runInNewContext(`${pagesSource}; pageActions`);
const menus = vm.runInNewContext(`${menusSource}; playerMenuActions`);
const expected = ['browse', 'feed', 'download', 'player', 'history', 'calendar', 'manager', 'account', 'announcements', 'settings'];
assert.deepEqual(Array.from(pages.keys()), expected);
assert.equal(pages.get("settings']; throw new Error('injected') //"), undefined);
let programs = 0;
for (const [id, actions] of pages) {
  const index = expected.indexOf(id);
  for (const kind of ['sidebar', 'compact', 'toolbar']) {
    let clicked = -1;
    const buttons = expected.map((_id, i) => ({ click() { clicked = i; } }));
    const document = {
      querySelectorAll(selector) {
        assert.equal(selector, { sidebar: '.sidebar-menu .sidebar-item', compact: '.compact-navigation button', toolbar: '#toolbar-page-menu button' }[kind]);
        return buttons;
      },
      querySelector(selector) { assert.equal(selector, '.sidebar-footer .sidebar-item'); return buttons[9]; },
    };
    vm.runInNewContext(actions[kind], { document });
    assert.equal(clicked, index, `${kind}/${id}`); programs++;
  }
  for (const hidden of [true, false]) {
    const value = vm.runInNewContext(actions.visible, { document: { querySelector(selector) {
      assert.equal(selector, `main.main-content[data-page="${id}"]`); return { hidden };
    } } });
    assert.equal(value, !hidden); programs++;
  }
}
assert.deepEqual(Array.from(menus, menu => menu.name), ['episodes', 'quality', 'options', 'danmaku']);
for (const menu of menus) {
  let visible = false, focused = false, scrolled = false;
  const panel = { offsetWidth: 240, offsetHeight: 160 };
  const button = { scrollIntoView() { scrolled = true; }, focus() { focused = true; }, click() { visible = true; } };
  const context = { document: { querySelector: selector => selector.startsWith('.player-controls button') ? button : visible ? panel : null },
    getComputedStyle: value => { assert.equal(value, panel); return { color: 'rgb(1, 2, 3)', backgroundColor: 'rgb(4, 5, 6)' }; } };
  assert.equal(vm.runInNewContext(menu.exists, context), true);
  assert.equal(vm.runInNewContext(menu.closed, context), true);
  vm.runInNewContext(menu.open, context);
  assert.ok(focused && scrolled);
  assert.equal(vm.runInNewContext(menu.visible, context), true);
  const colors = vm.runInNewContext(menu.colors, context);
  assert.equal(colors.color, 'rgb(1, 2, 3)'); assert.equal(colors.bounds.width, 240);
  visible = false; assert.equal(vm.runInNewContext(menu.closed, context), true);
  programs += 6;
}
assert.doesNotMatch(source.slice(source.indexOf('  async function navigate'), source.indexOf('  async function setAppearance')), /JSON\.stringify/);
assert.doesNotMatch(source.slice(source.indexOf('  async function optionalPlayerMenus'), source.indexOf('  async function collapsedNavigationCheck')), /JSON\.stringify/);
console.log(`PASS UI audit static programs: ${programs} navigation/menu executions, selector isolation, unknown ID rejection`);
