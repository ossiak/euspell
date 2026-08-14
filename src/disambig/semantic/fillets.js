/**
 * Disambiguates 'fillets' (encoding 114, NN2|VVZ) four ways, on two axes — the
 * sense (/fɪˈleɪ/ food vs /ˈfɪlɪt/ engineering) and part of speech:
 *   fillehs — /fɪˈleɪz/  plural noun: cuts of fish or meat ("two salmon fillets")
 *   fillehz — /fɪˈleɪz/  the verb, food sense ("he fillets the trout")
 *   fillets — /ˈfɪlɪts/  plural noun: rounded corners, fillet welds, mouldings
 *   filletz — /ˈfɪlɪts/  the verb, engineering sense ("the tool fillets the edge")
 *
 * The fifth four-way word in the lexicon, added 11 Aug 2026, and the tidiest:
 * two stems from the semantic split times two endings from the NN2|VVZ split,
 * with every cell ordinary modern usage.
 *
 * Only the sense is pronunciation-critical — fillehs/fillehz are homophones, as
 * are fillets/filletz — so a wrong is_VVZ guess is an orthographic slip while a
 * wrong sense is an audible error. That is why the sense is decided first, by
 * the shared classifier, and the noun/verb split is then resolved by the shared
 * is_VVZ test. The decision rests only on neighbouring words, never on the
 * target's own NN2|VVZ tag.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

import { is_VVZ } from '../pos.js';
import { isMachineFillet } from './fillet-sense.js';

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'fillehs' | 'fillets' | 'fillehz' | 'filletz'}
 */
export function disambiguate_fillets(tokens, idx) {
  const machine = isMachineFillet(tokens, idx);
  const verb = is_VVZ(tokens, idx);
  if (machine) return verb ? 'filletz' : 'fillets';
  return verb ? 'fillehz' : 'fillehs';
}
