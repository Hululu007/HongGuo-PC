import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';

const source = fs.readFileSync(new URL('../../App.jsx', import.meta.url), 'utf8');
const start = source.indexOf('function ToolbarMore(');
const end = source.indexOf('\nconst MENU =', start);
assert(start >= 0 && end > start, 'the actual toolbar component can be isolated');
const code = transformSync(`${source.slice(start, end)}\nexport default ToolbarMore;`, { loader: 'jsx', format: 'cjs' }).code;

function mount() {
  const slots = [];
  let cursor = 0;
  const document = { activeElement: null, addEventListener() {}, removeEventListener() {} };
  const useState = initial => {
    const at = cursor++;
    if (!(at in slots)) slots[at] = initial;
    return [slots[at], value => { slots[at] = typeof value === 'function' ? value(slots[at]) : value; }];
  };
  const useRef = initial => { const at = cursor++; return slots[at] ||= { current: initial }; };
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, document, useState, useRef, useEffect() {}, MoreIcon() {}, React: { createElement: (type, props, ...children) => ({ type, props: props || {}, children }) } });
  const render = () => { cursor = 0; return module.exports.default({ children: null }); };
  const tree = render();
  const trigger = { focus() { document.activeElement = this; } };
  tree.children[0].props.ref.current = trigger;
  return { document, render, trigger };
}

test('toolbar child actions close the disclosure and restore focus before hiding its controls', () => {
  const ui = mount();
  ui.render().children[0].props.onClick();
  let tree = ui.render();
  assert.equal(tree.children[0].props['aria-expanded'], true);
  assert.equal(tree.children[0].props['aria-haspopup'], undefined, 'ordinary controls are not advertised as an ARIA menu');
  const child = {};
  ui.document.activeElement = child;
  tree.children[1].props.onClick({ target: { closest: () => child }, currentTarget: { ownerDocument: ui.document, contains: node => node === child } });
  tree = ui.render();
  assert.equal(tree.children[0].props['aria-expanded'], false);
  assert.equal(ui.document.activeElement, ui.trigger);
});

test('toolbar close does not steal focus deliberately moved by a child action', () => {
  const ui = mount();
  ui.render().children[0].props.onClick();
  const otherTarget = {};
  ui.document.activeElement = otherTarget;
  ui.render().children[1].props.onClick({ target: { closest: () => ({}) }, currentTarget: { ownerDocument: ui.document, contains: () => false } });
  assert.equal(ui.document.activeElement, otherTarget);
  assert.equal(ui.render().children[0].props['aria-expanded'], false);
});
