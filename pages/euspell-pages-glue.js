// euspell for Apple Pages — the JXA (JavaScript for Automation) glue over the
// shared euspell engine. This is the small host-specific layer; build/gen-pages.js
// prepends the engine data and the engine itself (the very euspell-data.gs +
// euspell-engine.gs the Google Docs port uses) to produce the runnable
// pages/euspell-pages.js. Load order there is:
//   euspell-data.gs (data globals) -> euspell-engine.gs (defines `Euspell`) -> this
//
// Pages has no add-in model, so there is no in-app menu. Run the built script on
// a Mac from the Script menu, an Automator Quick Action, or a Shortcut. On run it
// asks whether to Convert (English -> euspell) or Revert the frontmost Pages
// document, then rewrites its body paragraphs in place with Euspell.convert/revertText.
//
// Scope + limits — the same one-pass shape as the LibreOffice and Google Docs
// converters:
//   - whole document only (Pages exposes no scriptable text selection);
//   - the main body flow only (text in text boxes, shapes, and table cells is
//     not reached);
//   - rewriting a paragraph's text resets its inline bold/italic runs;
//   - run once — a few reforms aren't idempotent.
//
// NOTE the text-suite access (bodyText / paragraphs / .text()) is the one part
// that may need adjusting to Pages' actual scripting dictionary (Script Editor >
// File > Open Dictionary > Pages); JXA's text suite is finicky. Any failure is
// surfaced in an alert so it can be reported. See pages/README.md for the
// whole-body fallback if per-paragraph access misbehaves.

function run() {
  var Pages = Application('Pages');
  Pages.includeStandardAdditions = true;

  if (Pages.documents.length === 0) {
    Pages.displayAlert('Euspell', { message: 'Open a Pages document first.' });
    return;
  }

  var choice;
  try {
    choice = Pages.displayDialog('Transform the frontmost Pages document?', {
      buttons: ['Cancel', 'Revert to English', 'Convert to euspell'],
      defaultButton: 'Convert to euspell',
      withTitle: 'Euspell',
    }).buttonReturned;
  } catch (e) {
    return; // Cancel or Esc throws — nothing to do
  }
  var reverting = choice === 'Revert to English';
  var transform = reverting ? Euspell.revertText : Euspell.convertText;

  // Per-paragraph text-suite access (`.text()` / `.text =`) throws "Can't
  // convert types" on at least Pages 15.3. The reliable specifier is calling
  // bodyText as a function to read and assigning it directly to write — see
  // pages/README.md "whole-body fallback". This resets all body formatting
  // to a single run, but works.
  var changed = 0;
  try {
    var doc = Pages.documents[0];
    var before = String(doc.bodyText());
    var after = transform(before);
    if (after !== before) {
      doc.bodyText = after;
      changed = 1;
    }
  } catch (e) {
    Pages.displayAlert('Euspell — could not rewrite the document', {
      message: String(e) + '\n\nThis is usually the text-suite access; see pages/README.md.',
    });
    return;
  }

  Pages.displayNotification(
    changed ? 'Document ' + (reverting ? 'reverted' : 'reformed') : 'No changes',
    { withTitle: 'Euspell' }
  );
}
