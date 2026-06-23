/**
 * Disambiguates 'slough' (encoding 103, NN|NN1|VV0) three ways:
 *   sloff — /slʌf/ to shed / cast off (a snake's skin, dead cells); the cast-off
 *           layer itself; figurative "slough off" (discard)
 *   slouh — /slaʊ/ a bog or mire; the figurative "Slough of Despond"; the
 *           English town Slough
 *   sluh  — /sluː/ a backwater swamp, marshy pond, or slow river channel
 *           (chiefly North American; also spelled "slew"/"slue")
 * Corpus: none — rules are derived from register/collocation, not a tagged set.
 *
 * The two swamp readings (slouh, sluh) are near-synonyms, so shared topical
 * vocabulary cannot separate them; the split is carried by a few high-precision
 * frames plus a dialect default (see slough-sense.js). The base form adds two
 * checks the shared classifier cannot make: the verb reading (→ the shed sense)
 * and a proper-noun waterway "<Name> Slough" (→ the backwater sense). The bare
 * literal residue defaults to /sluː/ ('sluh') — the AmE running-text default;
 * flip the fallback to 'mire' for BrE/literary input. The decision rests only on
 * neighbouring words, never the target's own NN|NN1|VV0 tag.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

import { is_verb_VV0 } from '../pos.js';
import { sloughSense } from './slough-sense.js';

/** sense → euspelling for the base noun/verb form. */
const SPELLING = { shed: 'sloff', mire: 'slouh', backwater: 'sluh' };

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'sloff' | 'slouh' | 'sluh'}
 */
export function disambiguate_slough(tokens, idx) {
  // The verb reading is always the shed sense ("to slough off", "snakes slough
  // their skin") — the swamp senses are nouns only.
  if (is_verb_VV0(tokens, idx)) return 'sloff';

  // "Steamboat Slough", "Elkhorn Slough" — a capitalised name + "Slough" is the
  // North-American waterway, regardless of nearby mire vocabulary.
  const cap = /^[A-Z]/.test(tokens[idx]?.word ?? '');
  const prevTags = (tokens[idx - 1]?.tag ?? '').split('|');
  if (cap && prevTags.some((t) => t.startsWith('NP'))) return 'sluh';

  // Otherwise classify by collocation, defaulting the bare literal to /sluː/.
  return SPELLING[sloughSense(tokens, idx, 'backwater')];
}
