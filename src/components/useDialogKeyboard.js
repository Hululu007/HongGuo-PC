import { useEffect, useRef } from 'react';

const dialogs = [];
const FOCUSABLE = 'a[href], area[href], button, input:not([type="hidden"]), select, textarea, iframe, audio[controls], video[controls], summary, [contenteditable]:not([contenteditable="false"]), [tabindex]';
const topDialog = (document) => dialogs.filter(entry => entry.dialog.ownerDocument === document && entry.dialog.isConnected).at(-1);
const available = (element) => element?.isConnected && !element.matches(':disabled, input[type="hidden"]')
  && !element.closest('[hidden], [inert], [aria-hidden="true"]') && element.getClientRects().length > 0
  && !['hidden', 'collapse'].includes(element.ownerDocument.defaultView.getComputedStyle(element).visibility);

function controls(dialog) {
  const items = [...dialog.querySelectorAll(FOCUSABLE)].filter(element => available(element)
    && (element.tabIndex >= 0 || (!element.hasAttribute('tabindex') && element.isContentEditable)));
  return items.filter(element => {
    // A radio group is one tab stop: its checked radio, or its first enabled radio.
    if (element.tagName !== 'INPUT' || element.type !== 'radio' || !element.name) return true;
    const group = items.filter(item => item.tagName === 'INPUT' && item.type === 'radio'
      && item.name === element.name && item.form === element.form);
    return element === (group.find(item => item.checked) || group[0]);
  }).sort((a, b) => (a.tabIndex > 0 ? a.tabIndex : Infinity) - (b.tabIndex > 0 ? b.tabIndex : Infinity));
}

// Only the top dialog owns keyboard/focus events; closing it restores its trigger.
export default function useDialogKeyboard(open, close, selector, root, restoreFocus) {
  const closeRef = useRef(close);
  const restoreRef = useRef(restoreFocus);
  closeRef.current = close;
  restoreRef.current = restoreFocus;
  useEffect(() => {
    if (!open) return;
    const dialog = (root || document).querySelector(selector);
    if (!dialog) return;
    const owner = dialog.ownerDocument;
    const entry = { dialog, trigger: owner.activeElement, lastFocused: null };
    const addedTabIndex = !dialog.hasAttribute('tabindex');
    if (addedTabIndex) dialog.setAttribute('tabindex', '-1');
    dialogs.push(entry);
    const focusInside = () => {
      const preferred = dialog.querySelector('[data-dialog-initial-focus]');
      const target = dialog.contains(entry.lastFocused) && available(entry.lastFocused)
        ? entry.lastFocused : available(preferred) ? preferred : controls(dialog)[0] || dialog;
      target.focus();
    };
    const onFocus = (event) => {
      if (topDialog(owner) !== entry) return;
      if (dialog.contains(event.target)) entry.lastFocused = event.target;
      else focusInside();
    };
    const onKey = (event) => {
      if (topDialog(owner) !== entry || event.defaultPrevented || event.isComposing || event.keyCode === 229) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeRef.current?.();
        return;
      }
      if (event.key !== 'Tab' || event.ctrlKey || event.altKey || event.metaKey) return;
      const items = controls(dialog);
      const index = items.indexOf(owner.activeElement);
      const next = index < 0 ? (event.shiftKey ? items.length - 1 : 0)
        : (index + (event.shiftKey ? -1 : 1) + items.length) % items.length;
      event.preventDefault();
      event.stopPropagation();
      (items[next] || dialog).focus();
    };
    owner.addEventListener('keydown', onKey, true);
    owner.addEventListener('focusin', onFocus, true);
    if (dialog.contains(owner.activeElement) && available(owner.activeElement)) entry.lastFocused = owner.activeElement;
    else focusInside();
    return () => {
      const wasTop = dialogs.filter(other => other.dialog.ownerDocument === owner).at(-1) === entry;
      owner.removeEventListener('keydown', onKey, true);
      owner.removeEventListener('focusin', onFocus, true);
      dialogs.splice(dialogs.indexOf(entry), 1);
      // If a covered dialog unmounts first, do not restore into its stale subtree.
      dialogs.forEach(other => { if (dialog.contains(other.trigger)) other.trigger = entry.trigger; });
      if (addedTabIndex) dialog.removeAttribute('tabindex');
      if (!wasTop && topDialog(owner)) return;
      const parent = topDialog(owner);
      const requested = restoreRef.current?.();
      const target = available(requested) ? requested : entry.trigger;
      if (available(target) && (!parent || parent.dialog.contains(target))) target.focus();
      else if (parent) {
        (available(parent.lastFocused) && parent.dialog.contains(parent.lastFocused)
          ? parent.lastFocused : controls(parent.dialog)[0] || parent.dialog).focus();
      }
    };
  }, [open, selector, root]);
}
