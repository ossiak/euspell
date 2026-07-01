// Inserts dictated text at the caret of the focused editable element.
//
// This is the deliberate inverse of the reader, which never touches editable
// text (dom-walker's isEditable rejects it, so reforming can't corrupt a caret).
// Dictation is an authoring path: it writes *into* the field the user is editing.
// A single <input>/<textarea> or a contenteditable region are the valid targets.

const TEXT_INPUT_TYPES = new Set([
  'text', 'search', 'url', 'tel', 'email', 'password', 'number', '', undefined,
]);

/**
 * True when `el` is an element dictated text can be inserted into: a writable
 * text <input>, a <textarea>, or a contenteditable region.
 * @param {Element | null} el
 * @returns {el is HTMLElement}
 */
export function isEditableTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'TEXTAREA') return !el.disabled && !el.readOnly;
  if (tag === 'INPUT') {
    return TEXT_INPUT_TYPES.has(el.type?.toLowerCase()) && !el.disabled && !el.readOnly;
  }
  return el.isContentEditable === true;
}

/**
 * Inserts `text` at the caret of `target`, replacing any selection. Uses
 * execCommand('insertText') first: despite being deprecated it is the one path
 * that inserts into both inputs and contenteditable while keeping native undo and
 * firing the input events frameworks (React, etc.) listen for. Falls back to a
 * manual value/Range edit if the command is unavailable or refused.
 *
 * @param {HTMLElement} target
 * @param {string} text
 * @returns {boolean} whether the text was inserted
 */
export function insertText(target, text) {
  if (!isEditableTarget(target) || text === '') return false;
  target.focus();

  if (document.execCommand('insertText', false, text)) return true;

  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
    return insertIntoInput(/** @type {HTMLInputElement} */ (target), text);
  }
  return insertIntoContentEditable(text);
}

/** Manual fallback for <input>/<textarea>: splice at the selection and fire input. */
function insertIntoInput(el, text) {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  el.value = el.value.slice(0, start) + text + el.value.slice(end);
  const caret = start + text.length;
  el.setSelectionRange(caret, caret);
  el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
  return true;
}

/** Manual fallback for contenteditable: insert at the current range and fire input. */
function insertIntoContentEditable(text) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  const range = sel.getRangeAt(0);
  range.deleteContents();
  const node = document.createTextNode(text);
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
  document.activeElement?.dispatchEvent(
    new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }),
  );
  return true;
}
