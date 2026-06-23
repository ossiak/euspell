/**
 * Disambiguates 'showers' (encoding 113, NN2|VVZ) three ways:
 *   showers — /ˈʃoʊərz/ plural noun "ones who show" (agents of 'show')
 *   shuwers — /ˈʃaʊərz/ plural noun: rain/snow, bathing fixtures, gift parties,
 *             "showers of sparks/darts"
 *   shuwerz — /ˈʃaʊərz/ the 3rd-person-singular present verb ("it showers")
 * Corpus: disambig/showers.txt
 *
 * Two axes: verb vs. noun (the NN2|VVZ diatone), and — within the noun — the
 * agentive /ʃoʊ/ vs. the rain /ʃaʊ/ senses. The agent reading is the only one
 * that changes the pronunciation (shuwers and shuwerz are homophones, so their
 * split is orthographic), and it is vanishingly rare — the corpus is entirely
 * rain/spray — so it is taken only on an exhibit noun + show-competition context
 * (mirroring shower.js). Otherwise the verb is resolved with the shared is_VVZ
 * test, defaulting to the rain plural. The decision rests only on neighbouring
 * words, never the target's own NN2|VVZ tag.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

import { is_VVZ } from '../pos.js';
import { EXHIBIT, SHOW_FIELD } from './shower.js';

const wordOf = (tok) => (tok?.word ?? '').toLowerCase().replace(/[.,!?;:'"]+$/, '');

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'showers' | 'shuwers' | 'shuwerz'}
 */
export function disambiguate_showers(tokens, idx) {
  // Agentive "ones who show": "<animal> showers" within a show-competition
  // context. Both signals required, so it never fires on "showers of …". Checked
  // before is_VVZ, which would misread the exhibit modifier as a subject.
  if (EXHIBIT.has(wordOf(tokens[idx - 1]))) {
    for (let j = idx - 6; j <= idx + 6; j++) {
      if (j !== idx && tokens[j] && SHOW_FIELD.has(wordOf(tokens[j]))) return 'showers';
    }
  }

  // "showers of sparks / radiance / darts" — a partitive noun, never the verb.
  // (is_VVZ can misread a preceding adverb here as a subject context.)
  if (wordOf(tokens[idx + 1]) === 'of') return 'shuwers';

  // The verb ("it showers", "she showers them with gifts") → /ʃaʊərz/ verb.
  if (is_VVZ(tokens, idx)) return 'shuwerz';

  // Otherwise the dominant /ʃaʊərz/ noun: rain, bathing, "showers of sparks".
  return 'shuwers';
}
