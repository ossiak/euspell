"""EuspellSpellChecker — a LibreOffice linguistic spell-checker UNO component.

It treats a traditional-English word that has a euspell reform as "misspelled"
and offers the euspell spelling(s) as corrections; already-reformed words and
words with no reform are accepted. Word-level only (no sentence context): a
homograph such as "records" offers both "records" and "recordz" for the user to
choose — the proofreader resolves those from context where it can.

Activates under the private locale en-x-euspell (BCP47), the same tag the
bundled Hunspell dictionary uses, so it never competes with the normal en-US /
en-GB checker. Set a paragraph or document language to "English (euspell)" to
use it.

This is a passive-registered Python UNO component; on-device testing in
LibreOffice is required (the conversion engine itself is unit-tested separately).
"""
import os
import sys

import uno  # noqa: F401  (provided by the LibreOffice Python-UNO bridge)
import unohelper
from com.sun.star.linguistic2 import XSpellChecker
from com.sun.star.linguistic2 import XLinguServiceEventBroadcaster
from com.sun.star.linguistic2 import XSpellAlternatives
from com.sun.star.lang import XServiceInfo, XInitialization, XServiceDisplayName
from com.sun.star.linguistic2 import XSupportedLocales
from com.sun.star.lang import Locale

try:
    from com.sun.star.linguistic2.SpellFailure import IS_NEGATIVE_WORD
except Exception:  # value of the constant, as a fallback
    IS_NEGATIVE_WORD = 2

# The conversion engine is loaded lazily and defensively: a failure here must
# never propagate into LibreOffice's service enumeration (that crashes dialogs).
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


def _candidates(word):
    try:
        return _get_engine().word_candidates(word)
    except Exception:
        return []

IMPL_NAME = "org.euspell.linguistic.SpellChecker"
SERVICE = "com.sun.star.linguistic2.SpellChecker"
# Register under standard English locales. A private "qlt"/"en-x-euspell" tagged
# locale would isolate euspell from the normal checker, but it crashes the
# Writing Aids dialog on LO 26.2 when the language-module list renders its name.
SUPPORTED_LOCALES = (Locale("en", "US", ""), Locale("en", "GB", ""), Locale("en", "", ""))


class _SpellAlternatives(unohelper.Base, XSpellAlternatives):
    """The result of spell(): the failing word plus its euspell alternatives."""

    def __init__(self, word, locale, alternatives):
        self._word = word
        self._locale = locale
        self._alts = tuple(alternatives)

    def getWord(self):
        return self._word

    def getLocale(self):
        return self._locale

    def getFailureType(self):
        return IS_NEGATIVE_WORD

    def getAlternativesCount(self):
        return len(self._alts)

    def getAlternatives(self):
        return self._alts


class EuspellSpellChecker(unohelper.Base, XSpellChecker, XLinguServiceEventBroadcaster,
                          XSupportedLocales, XServiceInfo, XServiceDisplayName,
                          XInitialization):
    def __init__(self, ctx):
        self.ctx = ctx

    # XSupportedLocales
    def getLocales(self):
        return SUPPORTED_LOCALES

    def hasLocale(self, locale):
        return locale.Language == "en"

    # XSpellChecker
    def isValid(self, word, locale, properties):
        # A word is "valid" unless it can be reformed (i.e. it is traditional
        # English with a euspell spelling). Reformed/unknown words pass.
        return len(_candidates(word)) == 0

    def spell(self, word, locale, properties):
        cands = _candidates(word)
        if not cands:
            return None
        return _SpellAlternatives(word, locale, cands)

    # XLinguServiceEventBroadcaster (no dynamic dictionary -> nothing to notify)
    def addLinguServiceEventListener(self, listener):
        return False

    def removeLinguServiceEventListener(self, listener):
        return False

    # XServiceDisplayName
    def getServiceDisplayName(self, locale):
        return "Euspell Spelling"

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
g_ImplementationHelper.addImplementation(EuspellSpellChecker, IMPL_NAME, (SERVICE,))
