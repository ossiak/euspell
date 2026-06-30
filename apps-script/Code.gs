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
    .addToUi();
}

function convertDocument() {
  var doc = DocumentApp.getActiveDocument();
  var n = 0;
  var paras = doc.getBody().getParagraphs();
  for (var i = 0; i < paras.length; i++) n += convertParagraph_(paras[i]);
  var items = doc.getBody().getListItems();
  for (var j = 0; j < items.length; j++) n += convertParagraph_(items[j]);
  toast_('Euspell: converted ' + n + (n === 1 ? ' paragraph.' : ' paragraphs.'));
}

function convertSelection() {
  var doc = DocumentApp.getActiveDocument();
  var sel = doc.getSelection();
  if (!sel) {
    DocumentApp.getUi().alert('Select some text first, or use Euspell ▸ Convert Document.');
    return;
  }
  // Convert the whole paragraph/list-item containing each selected element. A
  // paragraph usually appears once in the range; a partial selection converts
  // its containing paragraph whole.
  var elements = sel.getRangeElements();
  var n = 0;
  for (var i = 0; i < elements.length; i++) {
    var para = ancestorParagraph_(elements[i].getElement());
    if (para) n += convertParagraph_(para);
  }
  toast_('Euspell: converted ' + n + (n === 1 ? ' paragraph.' : ' paragraphs.'));
}

/** Convert one Paragraph/ListItem in place; returns 1 if changed, else 0. */
function convertParagraph_(para) {
  // Skip if the paragraph contains a non-text child (image, footnote, …), so we
  // never delete inline objects via setText.
  var kids = para.getNumChildren();
  for (var c = 0; c < kids; c++) {
    if (para.getChild(c).getType() !== DocumentApp.ElementType.TEXT) return 0;
  }
  var s = para.getText();
  if (!s || !s.replace(/\s+/g, '')) return 0;
  var out = Euspell.convertText(s);
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
