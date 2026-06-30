/* Taskpane controller for the Euspell Word add-in. Wires the two buttons to a
 * one-pass conversion over the document (or selection) using Euspell.convertText
 * from euspell-engine.js and the Word JavaScript API.
 *
 * Conversion is per paragraph: each paragraph's text is replaced with its
 * euspell form. Replacing a paragraph's text resets its inline character
 * formatting and would remove inline objects (images), so this is best on plain
 * text — a v1 limitation shared with the LibreOffice and Google Docs converters.
 */
/* global Office, Word, Euspell */

Office.onReady((info) => {
  if (info.host !== Office.HostType.Word) {
    setStatus('This add-in runs in Microsoft Word.');
    return;
  }
  const doc = document.getElementById('convert-doc');
  const sel = document.getElementById('convert-sel');
  doc.disabled = false;
  sel.disabled = false;
  doc.addEventListener('click', () => run('document'));
  sel.addEventListener('click', () => run('selection'));
});

async function run(scope) {
  setStatus('Converting…');
  try {
    const n = await convert(scope);
    setStatus(`Converted ${n} paragraph${n === 1 ? '' : 's'}.`);
  } catch (err) {
    setStatus('Error: ' + (err && err.message ? err.message : err));
    console.error(err);
  }
}

async function convert(scope) {
  let changed = 0;
  await Word.run(async (context) => {
    const rootRange = scope === 'selection'
      ? context.document.getSelection()
      : context.document.body.getRange();

    const paragraphs = rootRange.paragraphs;
    paragraphs.load('items');
    await context.sync();

    paragraphs.items.forEach((p) => p.load('text'));
    await context.sync();

    paragraphs.items.forEach((p) => {
      const out = Euspell.convertText(p.text);
      if (out !== p.text) {
        p.insertText(out, Word.InsertLocation.replace);
        changed++;
      }
    });
    await context.sync();

    // Stop Word's spell/grammar checker flagging euspell words as mistakes:
    // mark the converted range "do not check spelling or grammar". This both
    // clears existing squiggles and prevents new ones. (Add-ins can't add to
    // Word's dictionary.) WordApiDesktop 1.3 is desktop-only, so on Word for the
    // web this is skipped — the conversion still happens, just still underlined.
    if (Office.context.requirements.isSetSupported('WordApiDesktop', '1.3')) {
      rootRange.hasNoProofing = true;
      await context.sync();
    }
  });
  return changed;
}

function setStatus(text) {
  document.getElementById('status').textContent = text;
}
