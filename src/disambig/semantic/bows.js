/**
 * Disambiguates 'bows' (encoding 114, NN2|VVZ) four ways, on two axes — the
 * vowel (/boʊ/ vs /baʊ/) and part of speech (noun vs verb):
 *   bows — /boʊz/ plural noun: archery/violin bows, ribbon/knot bows
 *   bowz — /boʊz/ the verb, /boʊ/ sense ("she bows the violin")
 *   buws — /baʊz/ plural noun: bends from the waist, a ship's bows (prow)
 *   buwz — /baʊz/ the verb, /baʊ/ sense ("he bows to the crowd")
 * Corpus: disambig/bows.txt
 *
 * Only the vowel is pronunciation-critical: bows/bowz are homophones (/boʊz/),
 * as are buws/buwz (/baʊz/). So the vowel is decided first by sense vocabulary —
 * a ship's-prow context, the "across the bows" idiom, or a bending gesture give
 * /baʊ/; archery/ribbon/violin vocabulary gives /boʊ/; otherwise a noun defaults
 * to /boʊ/ (the object — weapons/ribbons) and a verb to /baʊ/ (bending, the only
 * common verb sense). The noun/verb split is then resolved by the shared is_VVZ
 * test. The decision rests only on neighbouring words, never the target's own
 * NN2|VVZ tag.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

import { is_VVZ } from '../pos.js';
import { BOW } from './bow.js';

const wordOf = (tok) => (tok?.word ?? '').toLowerCase().replace(/[.,!?;:'"]+$/, '');

// Ship-structure vocabulary — a ship's bows (the prow) are /baʊ/. Kept to hull
// words, so an archer's "bows above the water" is not dragged in.
const SHIP = new Set([
  'ship', 'ships', 'boat', 'boats', 'vessel', 'vessels', 'prow', 'stern',
  'hull', 'deck', 'decks', 'keel', 'mast', 'masts', 'sail', 'sails', 'rudder',
  'gunwale', 'gunwales', 'forecastle', 'bowsprit', 'waterline', 'schooner',
  'frigate', 'galley', 'galleon', 'barge', 'dhow', 'helm', 'starboard',
  'amidships', 'figurehead', 'keelson', 'scupper', 'scuppers',
]);

// Distinctive bending-gesture vocabulary → /baʊ/. (Generic words like "deep"
// are handled as immediate pre-modifiers below, not here.)
const BEND_FIELD = new Set([
  'curtsy', 'curtsey', 'curtsies', 'curtseys', 'curtsied', 'scrape', 'scrapes',
  'scraped', 'scraping', 'applause', 'audience', 'stage', 'curtain', 'ovation',
  'salaam', 'salaams', 'genuflect', 'genuflected', 'knelt', 'kneel', 'kneeling',
  'kneels', 'courtier', 'courtiers', 'farewell', 'farewells', 'greeting',
  'greetings', 'flourish', 'flourishes', 'waist', 'curtsying', 'bowing',
]);

// Adjectives that, immediately before "bows", mark the bending-gesture noun.
const BEND_PREMOD = new Set([
  'deep', 'deepest', 'deeper', 'low', 'lower', 'polite', 'formal', 'sweeping',
  'elaborate', 'slight', 'curt', 'stiff', 'graceful', 'courtly', 'mocking',
  'theatrical', 'respectful', 'gracious', 'deferential', 'little', 'quick',
  'exaggerated', 'solemn', 'profound', 'ceremonial', 'mutual',
]);

// Verbs that, just before "bows", take the bending-gesture noun as object
// ("took/made/exchanged their bows").
const BEND_VERB = new Set([
  'took', 'take', 'takes', 'taking', 'taken', 'made', 'make', 'makes', 'making',
  'gave', 'give', 'gives', 'giving', 'given', 'exchanged', 'exchange',
  'returned', 'return', 'acknowledged', 'performed', 'traded',
]);

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'bows' | 'bowz' | 'buws' | 'buwz'}
 */
export function disambiguate_bows(tokens, idx) {
  const prev = wordOf(tokens[idx - 1]);
  const prev2 = wordOf(tokens[idx - 2]);
  const verb = is_VVZ(tokens, idx);

  let baU = false; // /baʊ/ — ship's prow or bending gesture
  let boO = false; // /boʊ/ — archery / ribbon / violin

  // "(a shot) across the/their/her bows" — the naval idiom, a ship's bows.
  if (prev === 'across' || prev2 === 'across') baU = true;

  // Window scan for ship, bending, and archery vocabulary.
  for (let j = idx - 5; j <= idx + 5; j++) {
    if (j === idx || !tokens[j]) continue;
    const w = wordOf(tokens[j]);
    if (SHIP.has(w) || BEND_FIELD.has(w)) baU = true;
    if (BOW.has(w)) boO = true;
  }

  // Immediate pre-modifier / governing verb of the bending-gesture noun.
  if (BEND_PREMOD.has(prev) || BEND_VERB.has(prev) || BEND_VERB.has(prev2)) baU = true;

  // "saddle bows" — the arched fronts of saddles (saddlebows) are /boʊ/. Only as
  // an immediate compound; "from the saddle … bows" (horseback bow) is not.
  if (prev === 'saddle') boO = true;

  // Resolve the vowel: /baʊ/ evidence wins; else archery vocabulary; else the
  // default — noun → /boʊ/ (object), verb → /baʊ/ (bending).
  let sense;
  if (baU) sense = 'baU';
  else if (boO) sense = 'boO';
  else sense = verb ? 'baU' : 'boO';

  if (sense === 'boO') return verb ? 'bowz' : 'bows';
  return verb ? 'buwz' : 'buws';
}
