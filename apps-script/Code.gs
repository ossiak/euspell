/**
 * Google Docs add-on: convert the document (or selection) into euspell reformed
 * spelling, using Euspell.convertText from euspell-engine.gs.
 *
 * Conversion is per paragraph/list-item: the paragraph's text is replaced with
 * its euspell form. To avoid destroying inline objects, a paragraph that holds
 * anything other than text (images, footnotes, …) is skipped. Replacing text
 * resets that paragraph's inline character formatting (bold/italic runs) — a
 * known v1 limitation, same as the LibreOffice converter.
 */
function onOpen() {
  DocumentApp.getUi()
    .createMenu('Euspell')
    .addItem('Convert Document', 'convertDocument')
    .addItem('Convert Selection', 'convertSelection')
    .addSeparator()
    .addItem('Revert Document to English', 'revertDocument')
    .addItem('Revert Selection to English', 'revertSelection')
    .addToUi();
}

function convertDocument() { transformDocument_(Euspell.convertText, 'converted'); }
function revertDocument() { transformDocument_(Euspell.revertText, 'reverted'); }
function convertSelection() { transformSelection_(Euspell.convertText, 'converted'); }
function revertSelection() { transformSelection_(Euspell.revertText, 'reverted'); }

function transformDocument_(fn, verb) {
  var body = DocumentApp.getActiveDocument().getBody();
  var n = 0;
  var paras = body.getParagraphs();
  for (var i = 0; i < paras.length; i++) n += transformParagraph_(paras[i], fn);
  var items = body.getListItems();
  for (var j = 0; j < items.length; j++) n += transformParagraph_(items[j], fn);
  toast_('Euspell: ' + verb + ' ' + n + (n === 1 ? ' paragraph.' : ' paragraphs.'));
}

function transformSelection_(fn, verb) {
  var sel = DocumentApp.getActiveDocument().getSelection();
  if (!sel) {
    DocumentApp.getUi().alert('Select some text first, or use the whole-document command.');
    return;
  }
  // Transform the whole paragraph/list-item containing each selected element.
  var elements = sel.getRangeElements();
  var n = 0;
  for (var i = 0; i < elements.length; i++) {
    var para = ancestorParagraph_(elements[i].getElement());
    if (para) n += transformParagraph_(para, fn);
  }
  toast_('Euspell: ' + verb + ' ' + n + (n === 1 ? ' paragraph.' : ' paragraphs.'));
}

/** Apply fn (convertText or revertText) to one Paragraph/ListItem in place. */
function transformParagraph_(para, fn) {
  // Skip if the paragraph contains a non-text child (image, footnote, …), so we
  // never delete inline objects via setText.
  var kids = para.getNumChildren();
  for (var c = 0; c < kids; c++) {
    if (para.getChild(c).getType() !== DocumentApp.ElementType.TEXT) return 0;
  }
  var s = para.getText();
  if (!s || !s.replace(/\s+/g, '')) return 0;
  var out = fn(s);
  if (out === s) return 0;
  para.setText(out);
  return 1;
}

/** Walk up to the nearest Paragraph or ListItem element, or null. */
function ancestorParagraph_(el) {
  for (var cur = el; cur; cur = cur.getParent()) {
    var t = cur.getType();
    if (t === DocumentApp.ElementType.PARAGRAPH || t === DocumentApp.ElementType.LIST_ITEM) return cur;
  }
  return null;
}

function toast_(msg) {
  try {
    DocumentApp.getActiveDocument().getUi(); // ensures UI context
  } catch (e) { /* no UI */ }
  // A lightweight notification; Docs has no toast API, so use the logger + alert
  // only for errors. Keep success quiet to avoid an extra click.
  Logger.log(msg);
}
