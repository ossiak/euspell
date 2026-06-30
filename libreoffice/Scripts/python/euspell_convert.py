"""Euspell document converter — a LibreOffice Python macro.

Converts the active Writer document (or the current selection) from traditional
English into euspell reformed spelling in one pass, using the same engine the
browser extension uses (libreoffice/euspell/engine.py). Unlike the linguistic
spell/grammar services, this never touches the Writing Aids machinery, so it
cannot destabilize it.

Invoked from the Tools ▸ Euspell menu (the bundled Addons.xcu) or directly from
Tools ▸ Macros ▸ Organize Macros ▸ Python.

Conversion is per paragraph, so euspell's sentence-context disambiguation works;
note that replacing a paragraph's text resets inline character formatting within
it (acceptable for a first version).
"""
import os
import sys


def _load_engine():
    """Find and import the euspell engine. LibreOffice sets this module's
    __file__ to a file:// URL, so we convert it; we also fall back to the user
    profile's Scripts/python/euspell (manual install) via PathSubstitution."""
    import uno
    dirs = []

    f = globals().get("__file__")
    if f:
        if f.startswith("file://"):
            try:
                f = uno.fileUrlToSystemPath(f)
            except Exception:
                pass
        here = os.path.dirname(os.path.abspath(f))
        dirs.append(os.path.join(here, "euspell"))                              # beside the script
        dirs.append(os.path.normpath(os.path.join(here, "..", "..", "euspell")))  # inside the .oxt

    try:  # user profile: $(user)/Scripts/python/euspell
        ctx = XSCRIPTCONTEXT.getComponentContext()  # noqa: F821
        ps = ctx.ServiceManager.createInstanceWithContext(
            "com.sun.star.util.PathSubstitution", ctx)
        user = uno.fileUrlToSystemPath(ps.substituteVariables("$(user)", True))
        dirs.append(os.path.join(user, "Scripts", "python", "euspell"))
    except Exception:
        pass

    for cand in dirs:
        if os.path.isfile(os.path.join(cand, "engine.py")):
            if cand not in sys.path:
                sys.path.insert(0, cand)
            break
    import engine
    return engine


def _text_doc():
    doc = XSCRIPTCONTEXT.getDocument()  # noqa: F821  (injected by the script provider)
    if doc is not None and doc.supportsService("com.sun.star.text.TextDocument"):
        return doc
    return None


def _paragraphs(text_obj):
    out = []
    enum = text_obj.createEnumeration()
    while enum.hasMoreElements():
        par = enum.nextElement()
        if par.supportsService("com.sun.star.text.Paragraph"):
            out.append(par)
    return out


def convert_document(*args):
    eng = _load_engine()
    doc = _text_doc()
    if doc is None:
        return
    for par in _paragraphs(doc.getText()):  # collect first, then mutate
        s = par.getString()
        if s.strip():
            out = eng.convert_text(s)
            if out != s:
                par.setString(out)


def convert_selection(*args):
    eng = _load_engine()
    doc = _text_doc()
    if doc is None:
        return
    sel = doc.getCurrentController().getSelection()
    if sel is None or not hasattr(sel, "getCount"):
        return
    for i in range(sel.getCount()):
        rng = sel.getByIndex(i)
        s = rng.getString()
        if s.strip():
            out = eng.convert_text(s)
            if out != s:
                rng.setString(out)


# Exposed to LibreOffice's Python script provider.
g_exportedScripts = (convert_document, convert_selection)
