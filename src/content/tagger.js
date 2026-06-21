import { data as lexicon } from '../../dist/lexicon.js';
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
  const entry = lexicon.get(key) ?? abbreviations.get(key) ?? contractions.get(key);
  return entry ? entry.pos.join('|') : '';
}
