/**
 * Disambiguates 'tears' (encoding 114, NN2|VVZ) four ways, on two axes — the
 * vowel (/tɪər/ vs /tɛər/) and part of speech (noun vs verb):
 *   tears — /tɪərz/ plural noun: teardrops from crying ("tears rolled down")
 *   tearz — /tɪərz/ the verb, /tɪər/ sense (eyes welling: "she tears up")
 *   taers — /tɛərz/ plural noun: rips/rents ("tears in the fabric")
 *   taerz — /tɛərz/ the verb, /tɛər/ sense ("he tears the envelope open")
 * Corpus: disambig/tears.txt
 *
 * Only the vowel is pronunciation-critical: tears/tearz are homophones (/tɪərz/),
 * as are taers/taerz (/tɛərz/). Across the whole plural the teardrop /tɪər/ so
 * dominates — and a noun misread as a verb must not flip the vowel — that /tɪər/
 * is the unconditional default. The rip /tɛər/ is taken only on positive rip
 * evidence: a rent frame ("tears in the fabric", "wear and tears") or, for the
 * verb, a ripping particle ("tears apart/off/open") or a direct object NP ("tears
 * the envelope", "tears it"). The noun/verb split is then resolved by the shared
 * is_VVZ test — but because each vowel's two spellings are homophones, a wrong
 * POS guess is only an orthographic slip. The decision rests only on neighbouring
 * words, never the target's own NN2|VVZ tag.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

import { is_VVZ } from '../pos.js';

const wordOf = (tok) => (tok?.word ?? '').toLowerCase().replace(/[.,!?;:'"]+$/, '');

// Material a rent runs through — "tears in the fabric/coat" is /tɛər/, the only
// reliable plural-rent frame ("tears in her eyes" is a teardrop, kept out).
const FABRIC = new Set([
  'fabric', 'cloth', 'clothes', 'clothing', 'shirt', 'shirts', 'dress', 'dresses',
  'coat', 'coats', 'jacket', 'jackets', 'trousers', 'sleeve', 'sleeves', 'paper',
  'canvas', 'flesh', 'skin', 'wallpaper', 'garment', 'garments', 'jeans', 'seam',
  'seams', 'curtain', 'curtains', 'net', 'nets', 'sail', 'sails', 'tent', 'tents',
  'upholstery', 'lining', 'material', 'leather', 'parchment', 'page', 'pages',
]);
// Complements that, right after the verb "tears", mark the ripping sense — a
// particle ("tears apart/off/open") or a direct object NP ("tears the envelope",
// "tears it"). All are gated on a verb reading: as a teardrop noun, "tears" is
// the OBJECT of an earlier verb, so "wiped the tears away" / "tears at the sound"
// must not count. "that"/"which" are relativizers after the noun ("tears that
// fell"), so they stay out of the object set.
const RIP_COMPLEMENT = new Set([
  'apart', 'off', 'open', 'away', 'loose', 'asunder', 'free', 'aside', 'at',
  'into', 'through', 'up', 'down', 'across',
]);
const OBJECT_NP = new Set([
  'the', 'a', 'an', 'his', 'her', 'its', 'their', 'my', 'your', 'our', 'it',
  'them', 'him', 'himself', 'herself', 'itself', 'themselves', 'one', 'each',
  'another', 'every', 'this',
]);
// Gerunds of shedding/handling tears — "leaking/shedding/wiping tears" makes
// "tears" the object (a teardrop noun), whatever an over-eager is_VVZ thinks.
const TEAR_GERUND = new Set([
  'leaking', 'shedding', 'weeping', 'crying', 'wiping', 'fighting', 'holding',
  'blinking', 'brimming', 'welling', 'streaming', 'dabbing', 'choking', 'sobbing',
]);

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'tears' | 'tearz' | 'taers' | 'taerz'}
 */
export function disambiguate_tears(tokens, idx) {
  const prev = wordOf(tokens[idx - 1]);
  const prev2 = wordOf(tokens[idx - 2]);
  const next = wordOf(tokens[idx + 1]);
  const verb = is_VVZ(tokens, idx);

  // "tears" as the object of a tear-shedding gerund is always the teardrop noun.
  if (TEAR_GERUND.has(prev)) return 'tears';

  let rip = false; // /tɛər/ — a rent, or the ripping verb

  // "that tears it" — the fixed "that settles it" idiom, a ripping metaphor;
  // is_VVZ misreads the leading "that" as a determiner, so flag it directly.
  if (prev === 'that' && next === 'it') rip = true;

  // Rent-noun frames: "tears in the/his coat" (a tear through a material — not
  // "tears in her eyes"), a "fabric/canvas tears" compound, and "wear and tears".
  if (next === 'in') {
    for (let j = idx + 2; j <= idx + 4; j++) {
      if (tokens[j] && FABRIC.has(wordOf(tokens[j]))) rip = true;
    }
  }
  if (FABRIC.has(prev)) rip = true;
  if (prev === 'and' && prev2 === 'wear') rip = true;

  // Ripping-verb evidence — only when "tears" itself reads as a verb taking a
  // ripping particle or a direct object.
  if (verb && (RIP_COMPLEMENT.has(next) || OBJECT_NP.has(next))) rip = true;

  // Default to the teardrop /tɪər/; the homophonic noun/verb spelling is picked
  // by is_VVZ.
  if (!rip) return verb ? 'tearz' : 'tears';
  return verb ? 'taerz' : 'taers';
}
