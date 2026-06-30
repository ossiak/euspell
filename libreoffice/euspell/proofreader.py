"""EuspellProofreader — a LibreOffice grammar/proofreading UNO component.

Unlike the spell checker, the proofreader sees the whole paragraph, so it
resolves context-dependent homographs: "She records the song" is marked with the
verb spelling "recordz", while "two records" is left as the noun "records". Each
traditional word that should change is returned as a proofreading error whose
suggestions are the euspell spelling(s), best guess first. The ~70 semantic
homographs (read, bow, tear, …) are offered as choices rather than auto-picked.

Activates under the private locale en-x-euspell (set a paragraph/document
language to "English (euspell)"). Passive-registered Python UNO component;
on-device testing in LibreOffice is required.
"""
import os
import sys

import uno
import unohelper
from com.sun.star.linguistic2 import XProofreader
from com.sun.star.lang import XServiceInfo, XInitialization, XServiceDisplayName
from com.sun.star.linguistic2 import XSupportedLocales
from com.sun.star.lang import Locale

try:
    from com.sun.star.text.TextMarkupType import PROOFREADING
except Exception:  # value of the constant, as a fallback
    PROOFREADING = 2

# Lazy, defensive engine load (see spellchecker.py): enumeration must never throw.
_engine = None


def _get_engine():
    global _engine
    if _engine is None:
        here = os.path.dirname(os.path.abspath(__file__))
        if here not in sys.path:
            sys.path.insert(0, here)
        import engine as _e
        _engine = _e
    return _engine


def _proofread(text):
    try:
        return _get_engine().proofread(text)
    except Exception:
        return []

IMPL_NAME = "org.euspell.linguistic.Proofreader"
SERVICE = "com.sun.star.linguistic2.Proofreader"
# Register under standard English locales (a "qlt" tagged locale crashes the
# Writing Aids dialog on LO 26.2). The proofreader is the effective euspell
# checker: grammar errors are shown regardless of the normal spell checker.
SUPPORTED_LOCALES = (Locale("en", "US", ""), Locale("en", "GB", ""), Locale("en", "", ""))


class EuspellProofreader(unohelper.Base, XProofreader, XSupportedLocales,
                         XServiceInfo, XServiceDisplayName, XInitialization):
    def __init__(self, ctx):
        self.ctx = ctx

    # XSupportedLocales
    def getLocales(self):
        return SUPPORTED_LOCALES

    def hasLocale(self, locale):
        return locale.Language == "en"

    # XProofreader
    def isSpellChecker(self):
        return False

    def doProofreading(self, doc_id, text, locale, start_of_sentence,
                       suggested_end, properties):
        result = uno.createUnoStruct("com.sun.star.linguistic2.ProofreadingResult")
        result.aDocumentIdentifier = doc_id
        result.aText = text
        result.aLocale = locale
        result.nStartOfSentencePosition = start_of_sentence
        # Process the whole paragraph in one pass; report it as a single segment.
        result.nStartOfNextSentencePosition = len(text)
        result.nBehindEndOfSentencePosition = len(text)
        result.xProofreader = self
        result.aProperties = ()

        errors = []
        try:
            for item in _proofread(text):
                if item["start"] < start_of_sentence:
                    continue
                err = uno.createUnoStruct("com.sun.star.linguistic2.SingleProofreadingError")
                err.nErrorStart = item["start"]
                err.nErrorLength = item["length"]
                err.nErrorType = PROOFREADING
                err.aRuleIdentifier = "EUSPELL"
                err.aShortComment = "euspell"
                err.aFullComment = "Reformed euspell spelling for “%s”" % item["word"]
                err.aSuggestions = tuple(item["suggestions"])
                err.aProperties = ()
                errors.append(err)
        except Exception:
            errors = []
        result.aErrors = tuple(errors)
        return result

    def ignoreRule(self, rule_id, locale):
        pass

    def resetIgnoreRules(self):
        pass

    # XServiceDisplayName
    def getServiceDisplayName(self, locale):
        return "Euspell Grammar"

    # XInitialization
    def initialize(self, arguments):
        pass

    # XServiceInfo
    def getImplementationName(self):
        return IMPL_NAME

    def supportsService(self, name):
        return name == SERVICE

    def getSupportedServiceNames(self):
        return (SERVICE,)


g_ImplementationHelper = unohelper.ImplementationHelper()
g_ImplementationHelper.addImplementation(EuspellProofreader, IMPL_NAME, (SERVICE,))
