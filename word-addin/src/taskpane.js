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
  const wire = (id, scope, mode) =>
    document.getElementById(id).addEventListener('click', () => run(scope, mode));
  for (const id of ['convert-doc', 'convert-sel', 'revert-doc', 'revert-sel']) {
    document.getElementById(id).disabled = false;
  }
  wire('convert-doc', 'document', 'convert');
  wire('convert-sel', 'selection', 'convert');
  wire('revert-doc', 'document', 'revert');
  wire('revert-sel', 'selection', 'revert');
});

async function run(scope, mode) {
  setStatus(mode === 'revert' ? 'Reverting…' : 'Converting…');
  try {
    const n = await transform(scope, mode);
    const verb = mode === 'revert' ? 'Reverted' : 'Converted';
    setStatus(`${verb} ${n} paragraph${n === 1 ? '' : 's'}.`);
  } catch (err) {
    setStatus('Error: ' + (err && err.message ? err.message : err));
    console.error(err);
  }
}

async function transform(scope, mode) {
  const apply = mode === 'revert' ? Euspell.revertText : Euspell.convertText;
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
      const out = apply(p.text);
      if (out !== p.text) {
        p.insertText(out, Word.InsertLocation.replace);
        changed++;
      }
    });
    await context.sync();

    // Proofing: on convert, optionally mark the text "do not check spelling or
    // grammar" (checkbox) so Word doesn't flag euspell words; on revert, turn
    // that back on since the text is normal English again. Desktop only.
    if (Office.context.requirements.isSetSupported('WordApiDesktop', '1.3')) {
      if (mode === 'revert') {
        rootRange.hasNoProofing = false;
        await context.sync();
      } else if (document.getElementById('no-proof').checked) {
        rootRange.hasNoProofing = true;
        await context.sync();
      }
    }
  });
  return changed;
}

function setStatus(text) {
  document.getElementById('status').textContent = text;
}
