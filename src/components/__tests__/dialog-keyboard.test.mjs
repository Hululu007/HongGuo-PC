import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';

const code = transformSync(fs.readFileSync(new URL('../useDialogKeyboard.js', import.meta.url), 'utf8'), { format: 'cjs' }).code;

// A small DOM/event double; no renderer build, browser, network, or media required.
function harness() {
  const listeners = new Map();
  const roots = new Map();
  const document = {
    activeElement: null,
    defaultView: { getComputedStyle: element => ({ visibility: element.visibility || 'visible' }) },
    querySelector: selector => roots.get(selector),
    addEventListener(type, fn, capture) { const list = listeners.get(type) || []; list.push({ fn, capture }); listeners.set(type, list); },
    removeEventListener(type, fn) { listeners.set(type, (listeners.get(type) || []).filter(item => item.fn !== fn)); },
  };
  function dispatch(type, init) {
    const event = { target: document.activeElement, defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; },
      stopPropagation() { this.stopped = true; },
      stopImmediatePropagation() { this.immediate = true; this.stopped = true; }, ...init };
    const ordered = [...(listeners.get(type) || [])].sort((a, b) => Number(!!b.capture) - Number(!!a.capture));
    for (const { fn } of ordered) { fn(event); if (event.immediate) break; }
    return event;
  }
  function element(tag = 'button', attrs = {}, parent = null) {
    const node = {
      tagName: tag.toUpperCase(), attrs: { ...attrs }, parent, children: [], ownerDocument: document, isConnected: true,
      type: attrs.type || '', name: attrs.name || '', form: attrs.form || null, checked: !!attrs.checked,
      disabled: !!attrs.disabled, isContentEditable: attrs.contenteditable === 'true',
      get tabIndex() { return this.hasAttribute('tabindex') ? Number(this.attrs.tabindex) : /^(BUTTON|INPUT|SELECT|TEXTAREA|IFRAME|SUMMARY)$/.test(this.tagName) || (this.tagName === 'A' && this.hasAttribute('href')) ? 0 : -1; },
      hasAttribute(name) { return name in this.attrs; },
      setAttribute(name, value) { this.attrs[name] = value; },
      removeAttribute(name) { delete this.attrs[name]; },
      matches(selector) {
        return selector.split(',').some(part => {
          let value = part.trim();
          const not = [...value.matchAll(/:not\(([^)]+)\)/g)];
          if (not.some(match => this.matches(match[1]))) return false;
          value = value.replace(/:not\([^)]+\)/g, '');
          if (value === ':disabled') return this.disabled;
          const name = value.match(/^[a-z]+/i)?.[0];
          if (name && this.tagName !== name.toUpperCase()) return false;
          return [...value.matchAll(/\[([^=\]]+)(?:="([^"]*)")?\]/g)].every(([, key, expected]) => this.hasAttribute(key) && (expected === undefined || String(this.attrs[key]) === expected));
        });
      },
      closest(selector) { for (let current = this; current; current = current.parent) if (current.matches(selector)) return current; return null; },
      contains(other) { for (let current = other; current; current = current.parent) if (current === this) return true; return false; },
      getClientRects() { return this.noRect ? [] : [{}]; },
      querySelectorAll(selector) { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); },
      querySelector(selector) { return this.querySelectorAll(selector)[0] || null; },
      focus() { if (!this.isConnected || this.disabled) return; document.activeElement = this; dispatch('focusin', { target: this }); },
    };
    parent?.children.push(node);
    return node;
  }
  let current;
  const react = {
    useRef(value) { const at = current.cursor++; return current.slots[at] ||= { current: value }; },
    useEffect(effect, deps) {
      const at = current.cursor++, old = current.slots[at];
      if (!old || deps.some((value, index) => value !== old.deps[index])) {
        old?.cleanup?.(); current.slots[at] = { deps, cleanup: effect() };
      }
    },
  };
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, require: id => { assert.equal(id, 'react'); return react; }, document });
  function mount(selector, close = () => {}, root, restoreFocus) {
    const instance = { cursor: 0, slots: [] };
    const render = (open, nextClose = close) => { current = instance; current.cursor = 0; module.exports.default(open, nextClose, selector, root, restoreFocus); };
    render(true);
    return { update: nextClose => render(true, nextClose), close: () => render(false) };
  }
  const dialog = (selector, attrs) => { const node = element('div', attrs); roots.set(selector, node); return node; };
  return { document, element, dialog, mount, key: (key, init = {}) => dispatch('keydown', { key, ...init }), listeners };
}

test('tab order includes links, textarea, select, contenteditable and positive tabindex; skips unavailable and negative controls', () => {
  const h = harness(), trigger = h.element(); trigger.focus();
  const dialog = h.dialog('.dialog');
  const negative = h.element('button', { tabindex: '-1' }, dialog);
  h.element('input', { type: 'hidden' }, dialog);
  h.element('button', { disabled: true }, dialog);
  h.element('input', { disabled: true }, dialog);
  const hidden = h.element('div', { hidden: '' }, dialog); h.element('button', {}, hidden);
  const inert = h.element('div', { inert: '' }, dialog); h.element('button', {}, inert);
  const ariaHidden = h.element('div', { 'aria-hidden': 'true' }, dialog); h.element('button', {}, ariaHidden);
  h.element('button', {}, dialog).visibility = 'hidden';
  h.element('button', {}, dialog).noRect = true;
  const link = h.element('a', { href: '#local' }, dialog);
  const textarea = h.element('textarea', {}, dialog);
  const select = h.element('select', {}, dialog);
  const editable = h.element('div', { contenteditable: 'true' }, dialog);
  const last = h.element('button', {}, dialog);
  const second = h.element('div', { tabindex: '2' }, dialog);
  const first = h.element('button', { tabindex: '1' }, dialog);
  const third = h.element('button', { tabindex: '2' }, dialog);
  const mounted = h.mount('.dialog');
  assert.equal(h.document.activeElement, first);
  for (const expected of [second, third, link, textarea, select, editable, last, first]) {
    assert.equal(h.key('Tab').defaultPrevented, true);
    assert.equal(h.document.activeElement, expected);
  }
  h.key('Tab', { shiftKey: true }); assert.equal(h.document.activeElement, last);
  negative.focus(); h.key('Tab'); assert.equal(h.document.activeElement, first);
  negative.focus(); h.key('Tab', { shiftKey: true }); assert.equal(h.document.activeElement, last);
  trigger.focus(); assert.equal(h.document.activeElement, last, 'focus entering the background is redirected');
  mounted.close(); assert.equal(h.document.activeElement, trigger);
  assert.equal(dialog.hasAttribute('tabindex'), false);
  assert.equal(h.listeners.get('keydown').length, 0);
  assert.equal(h.listeners.get('focusin').length, 0);
});

test('a dialog may direct initial focus to a safe cancel action before destructive choices', () => {
  const h = harness(), trigger = h.element(); trigger.focus();
  const dialog = h.dialog('.confirm');
  const destructive = h.element('button', {}, dialog);
  const cancel = h.element('button', { 'data-dialog-initial-focus': '' }, dialog);
  const mounted = h.mount('.confirm');
  assert.equal(h.document.activeElement, cancel);
  h.key('Tab'); assert.equal(h.document.activeElement, destructive);
  mounted.close(); assert.equal(h.document.activeElement, trigger);
});

test('confirmed removal can restore focus to a stable page instead of a disabled or removed trigger', () => {
  for (const state of ['disabled', 'removed']) {
    const h = harness(), trigger = h.element(); trigger.focus();
    const page = h.element('main', { tabindex: '-1' });
    const dialog = h.dialog('.confirm'); h.element('button', {}, dialog);
    let submitted = false;
    const mounted = h.mount('.confirm', () => {}, undefined, () => submitted ? page : null);
    submitted = true;
    if (state === 'disabled') trigger.disabled = true; else trigger.isConnected = false;
    mounted.close();
    assert.equal(h.document.activeElement, page);
  }
});

test('cancel still restores its original trigger when no alternate return target is requested', () => {
  const h = harness(), trigger = h.element(); trigger.focus();
  const dialog = h.dialog('.confirm'); h.element('button', {}, dialog);
  const mounted = h.mount('.confirm', () => {}, undefined, () => null);
  mounted.close();
  assert.equal(h.document.activeElement, trigger);
});

test('only the top dialog handles Escape and focus; closing an unmounted top restores its parent trigger', () => {
  const h = harness(), trigger = h.element(); trigger.focus();
  const parent = h.dialog('.parent', { tabindex: '-1' });
  const parentButton = h.element('button', {}, parent);
  let parentCloses = 0, childCloses = 0, strayCloses = 0;
  const first = h.mount('.parent', () => parentCloses++);
  const child = h.dialog('.child', { tabindex: '-1' });
  const childButton = h.element('button', {}, child);
  const second = h.mount('.child', () => childCloses++);
  h.document.addEventListener('keydown', () => strayCloses++);
  assert.equal(h.document.activeElement, childButton);
  parentButton.focus(); assert.equal(h.document.activeElement, childButton);
  const escape = h.key('Escape');
  assert.equal(escape.defaultPrevented, true);
  assert.deepEqual([parentCloses, childCloses, strayCloses], [0, 1, 0]);
  second.update(() => childCloses += 2);
  h.key('Escape'); assert.equal(childCloses, 3, 'uses the latest close callback');
  child.isConnected = false; childButton.isConnected = false;
  second.close(); assert.equal(h.document.activeElement, parentButton);
  h.key('Escape'); assert.equal(parentCloses, 1);
  first.close(); assert.equal(h.document.activeElement, trigger);
  assert.equal(parent.attrs.tabindex, '-1', 'preserves an existing tabindex');
});

test('empty dialogs are focusable and trap Tab; Enter and IME keys retain native behavior', () => {
  const h = harness(), trigger = h.element(); trigger.focus();
  const dialog = h.dialog('.empty');
  let closes = 0;
  const mounted = h.mount('.empty', () => closes++);
  assert.equal(h.document.activeElement, dialog);
  for (const shiftKey of [false, true]) { assert.equal(h.key('Tab', { shiftKey }).defaultPrevented, true); assert.equal(h.document.activeElement, dialog); }
  for (const init of [{ key: 'Enter' }, { key: 'Escape', isComposing: true }, { key: 'Escape', keyCode: 229 }, { key: 'Escape', defaultPrevented: true }]) {
    const event = h.key(init.key, init);
    assert.equal(event.stopped, undefined);
  }
  assert.equal(closes, 0);
  mounted.close(); assert.equal(h.document.activeElement, trigger);
});

test('a covered dialog can close without stealing focus or leaving a stale return target', () => {
  const h = harness(), trigger = h.element(); trigger.focus();
  const parent = h.dialog('.parent'); h.element('button', {}, parent);
  const first = h.mount('.parent');
  const child = h.dialog('.child'), button = h.element('button', {}, child);
  const second = h.mount('.child');
  first.close(); assert.equal(h.document.activeElement, button);
  second.close(); assert.equal(h.document.activeElement, trigger);
});

test('radio groups have one tab stop and controls are reevaluated after disabling/removal', () => {
  const h = harness(), dialog = h.dialog('.radios');
  const first = h.element('input', { type: 'radio', name: 'quality' }, dialog);
  const checked = h.element('input', { type: 'radio', name: 'quality', checked: true }, dialog);
  const otherForm = h.element('input', { type: 'radio', name: 'quality', form: {} }, dialog);
  const last = h.element('button', {}, dialog);
  const mounted = h.mount('.radios');
  assert.equal(h.document.activeElement, checked);
  h.key('Tab'); assert.equal(h.document.activeElement, otherForm);
  h.key('Tab'); assert.equal(h.document.activeElement, last);
  checked.disabled = true;
  h.key('Tab'); assert.equal(h.document.activeElement, first);
  first.isConnected = false;
  h.key('Tab'); assert.equal(h.document.activeElement, otherForm);
  mounted.close();
});

test('preserves an initial focus inside the dialog and does not restore a hidden or disconnected trigger', () => {
  for (const unavailable of ['noRect', 'isConnected']) {
    const h = harness(), trigger = h.element(); trigger.focus();
    const dialog = h.dialog('.dialog'), input = h.element('input', {}, dialog);
    const mounted = h.mount('.dialog');
    trigger[unavailable] = unavailable === 'isConnected' ? false : true;
    mounted.close(); assert.equal(h.document.activeElement, input);
  }
  const h = harness(), dialog = h.dialog('.dialog');
  h.element('button', {}, dialog);
  const focused = h.element('textarea', {}, dialog); focused.focus();
  const mounted = h.mount('.dialog');
  assert.equal(h.document.activeElement, focused);
  mounted.close();
});
