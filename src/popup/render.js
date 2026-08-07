// Turns a lookup Result into DOM nodes.
//
// Split from popup.js so it can be exercised without the extension around it:
// nothing here touches browser.*, and the document is a parameter, so a test can
// hand it a stub and read back what would have been drawn. Everything is built
// with createElement/textContent rather than markup strings, because the query
// is whatever the user typed.

/** @typedef {import('./lookup.js').Result} Result */

/**
 * @param {Document} doc
 * @param {string} tag
 * @param {string} [className]
 * @param {string} [text]
 */
function el(doc, tag, className, text) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/**
 * The encoding chip. The description is euspell_encoding.csv's own wording,
 * shown verbatim — the table is the source of record for what a code means.
 */
function chip(doc, code, description) {
  const span = el(doc, 'span', 'code', code);
  span.tabIndex = 0;
  if (description) span.append(el(doc, 'span', 'tip', description));
  return span;
}

/** A spacer the width of a chip, holding its column open on the rows above. */
function gutter(doc) {
  return el(doc, 'span', 'gutter');
}

/**
 * @param {Result} r
 * @param {Document} [doc]
 * @returns {Element[]} nodes for the result region, empty when there is nothing to say
 */
export function renderResult(r, doc = document) {
  switch (r.kind) {
    case 'empty':
      return [];

    case 'loading':
      return [el(doc, 'p', 'note', 'Looking it up…')];

    case 'miss':
      return [
        el(doc, 'div', 'miss', 'Not in the lexicon'),
        el(doc, 'p', 'note',
          'Euspell leaves words it doesn’t know exactly as they are, so this would appear unchanged on the page.'),
      ];

    case 'unchanged': {
      const row = el(doc, 'div', 'answer-row');
      row.append(el(doc, 'div', 'answer same', r.word), chip(doc, r.code, r.description));
      const out = [row];
      // A single answer has no column to hang the parts of speech in, so they
      // go on their own line — but they are always stated, whatever the result.
      if (r.pos) out.push(el(doc, 'p', 'parts', r.pos));
      if (r.expansion) out.push(el(doc, 'p', 'note', `Short for ${r.expansion}.`));
      return out;
    }

    case 'spellings': {
      if (r.senses.length === 1) {
        const row = el(doc, 'div', 'answer-row');
        const answer = el(doc, 'div', r.senses[0].same ? 'answer same' : 'answer', r.senses[0].spelling);
        row.append(answer, chip(doc, r.code, r.description));
        const out = [row];
        if (r.pos) out.push(el(doc, 'p', 'parts', r.pos));
        return out;
      }
      const list = el(doc, 'div', 'senses');
      r.senses.forEach((sense, i) => {
        const row = el(doc, 'div', 'sense');
        row.append(el(doc, 'b', sense.same ? 'same' : undefined, sense.spelling));
        row.append(el(doc, 'span', 'pos', sense.label ?? ''));
        // The code describes the entry, not one sense, so it sits on the last
        // row and the rows above hold its column open.
        row.append(i === r.senses.length - 1 ? chip(doc, r.code, r.description) : gutter(doc));
        list.append(row);
      });
      return [list];
    }

    case 'reverse': {
      const list = el(doc, 'div', 'senses');
      for (const source of r.sources) {
        const row = el(doc, 'div', 'sense');
        row.append(el(doc, 'b', undefined, source.word), el(doc, 'span', 'pos', source.pos || 'traditional'));
        row.append(source.code ? chip(doc, source.code, source.description) : gutter(doc));
        list.append(row);
      }
      return [list, el(doc, 'p', 'note', 'Reading Euspell — this is the reformed spelling.')];
    }

    default:
      return [];
  }
}
