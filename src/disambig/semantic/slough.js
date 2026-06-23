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
 * vocabulary (mud, water, marsh) cannot separate them; the split is carried by a
 * few high-precision frames plus a dialect default. Order of decision:
 *   1. the verb / cast-off-skin sense → 'sloff' (split off first)
 *   2. the figurative idiom "slough of <despair…>" → 'slouh'
 *   3. a proper-noun waterway "<Name> Slough" → 'sluh'
 *   4. a mire field (quagmire, bottomless, sank, stuck) → 'slouh'
 *   5. a backwater field (tidal, channel, canoe, duck) → 'sluh'
 *   6. otherwise the unmarked literal /sluː/ ('sluh') — the AmE running-text
 *      default; flip this constant to 'slouh' for BrE/literary input.
 * The decision rests only on neighbouring words, never the target's own tag.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

import { is_verb_VV0 } from '../pos.js';

const wordOf = (tok) => (tok?.word ?? '').toLowerCase().replace(/[.,!?;:'"]+$/, '');

// Abstract states in the figurative "slough of <state>" idiom → /slaʊ/.
const DESPOND = new Set([
  'despond', 'despondency', 'despair', 'depression', 'misery', 'self-pity',
  'gloom', 'sorrow', 'melancholy', 'sin', 'vice', 'sloth', 'ignorance',
  'indifference', 'complacency', 'doubt', 'hopelessness', 'apathy', 'grief',
  'sadness', 'desolation', 'wretchedness', 'despair',
]);

// Shedding vocabulary fixing the cast-off-skin sense → /slʌf/. ("snake" alone
// is excluded — a snake may equally be in a backwater /sluː/.)
const SHED_FIELD = new Set([
  'shed', 'sheds', 'shedding', 'molt', 'molts', 'molted', 'molting', 'moult',
  'moulted', 'moulting', 'skin', 'scales', 'epidermis', 'eschar', 'membrane',
  'cells', 'callus', 'scab',
]);

// A slough one sinks into → /slaʊ/.
const MIRE = new Set([
  'mire', 'quagmire', 'bog', 'bottomless', 'impassable', 'sank', 'sunk', 'sink',
  'sinking', 'stuck', 'mired', 'bogged', 'floundered', 'founder', 'foundered',
  'quag', 'mud', 'muddy',
]);

// A slough that holds navigable water → /sluː/.
const BACKWATER = new Set([
  'tidal', 'backwater', 'channel', 'channels', 'inlet', 'estuary', 'bayou',
  'levee', 'levees', 'delta', 'paddle', 'paddled', 'canoe', 'canoed', 'kayak',
  'boat', 'boated', 'wade', 'waded', 'ford', 'duck', 'ducks', 'waterfowl',
  'heron', 'herons', 'cattails', 'cattail', 'reeds', 'reedy', 'mudflat',
  'mudflats', 'marsh', 'marshy', 'sloughs',
]);

const inWindow = (tokens, idx, field) => {
  for (let j = idx - 4; j <= idx + 4; j++) {
    if (j !== idx && tokens[j] && field.has(wordOf(tokens[j]))) return true;
  }
  return false;
};

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'sloff' | 'slouh' | 'sluh'}
 */
export function disambiguate_slough(tokens, idx) {
  const prev = tokens[idx - 1];
  const next = wordOf(tokens[idx + 1]);
  const next2 = wordOf(tokens[idx + 2]);
  const next3 = wordOf(tokens[idx + 3]);

  // --- 1. /slʌf/: shed / cast off -----------------------------------------
  // "slough off" (discard), or "slough" used as a verb (to shed).
  if (next === 'off') return 'sloff';
  if (is_verb_VV0(tokens, idx)) return 'sloff';
  // "the slough of dead skin", "a slough of cells" — the cast-off layer.
  if (next === 'of' && (SHED_FIELD.has(next2) || SHED_FIELD.has(next3))) return 'sloff';
  // Shedding vocabulary in the clause ("shed its slough on a rock").
  if (inWindow(tokens, idx, SHED_FIELD)) return 'sloff';

  // --- 2. /slaʊ/: the figurative idiom ------------------------------------
  // "slough of despond / despair / self-pity".
  if (next === 'of' && (DESPOND.has(next2) || DESPOND.has(next3))) return 'slouh';

  // --- 3. /sluː/: proper-noun waterway ------------------------------------
  // "Steamboat Slough", "Elkhorn Slough" — a capitalised name + "Slough".
  const cap = /^[A-Z]/.test(tokens[idx]?.word ?? '');
  const prevTags = (prev?.tag ?? '').split('|');
  if (cap && prevTags.some((t) => t.startsWith('NP'))) return 'sluh';

  // --- 4 & 5. mire vs backwater field -------------------------------------
  if (inWindow(tokens, idx, MIRE)) return 'slouh';      // sank into / quagmire
  if (inWindow(tokens, idx, BACKWATER)) return 'sluh';  // tidal / canoe / duck
  // A bare figurative use without "of" ("trapped in a slough of his own").
  if (inWindow(tokens, idx, DESPOND)) return 'slouh';

  // --- 6. default: the unmarked literal /sluː/ (AmE running text) ----------
  return 'sluh';
}
