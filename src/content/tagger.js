import { lookupEntry } from './lexicon-source.js';
import { data as abbreviations } from '../../dist/abbreviations.js';
import { data as contractions } from '../../dist/contractions.js';

/**
 * Lexical PoS tagger: returns every CLAWS7 tag a surface word can take, as the
 * lexicon's native pipe-joined string (e.g. 'NN2|VVZ', 'AT|AT1'), or '' when
 * the word is unknown.
 *
 * This is deliberately a *lexical* tagger — it reports the full candidate set
 * without choosing which tag applies in context. The disambiguation rules
 * (pos.js / semantic) narrow that set using the surrounding token window.
 *
 * @param {string} word
 * @returns {string}
 */
export function tagWord(word) {
  const key = word.toLowerCase();
  const entry = lookupEntry(key) ?? abbreviations.get(key) ?? contractions.get(key);
  if (entry) return entry.pos.join('|');
  // A digit-initial token ("3", "1999", "2nd") is a cardinal numeral. The
  // lexicon holds only spelled-out numbers ("three"), so without this a numeric
  // neighbor would tag as unknown and lose its determiner-like noun cue ("the 3
  // records" vs "the three records"). CLAWS7 MC; ordinals fold to the same
  // pre-modifier family downstream, so MC suffices.
  if (/^\d/.test(key)) return 'MC';
  return '';
}
