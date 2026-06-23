/**
 * Disambiguates 'sloughs' (encoding 114, NN2|VVZ) four ways, across the three
 * senses of the slough family — only the shed sense has a verb form:
 *   slouhs — /slaʊz/ plural noun: bogs, mires; figurative "sloughs of despond"
 *   sluhs  — /sluːz/ plural noun: backwater swamps / channels (chiefly N. Amer.)
 *   sloffs — /slʌfs/ plural noun: cast-off layers of dead skin
 *   sloffz — /slʌfs/ the verb ("the mucosa sloughs off")
 * Corpus: disambig/sloughs.txt
 *
 * The pronunciation-critical axis is the three-way sense (/slaʊ/ vs /sluː/ vs
 * /slʌf/); the noun/verb split within the shed sense is homophonic — sloffs and
 * sloffz are both /slʌfs/ — so a POS slip there is only orthographic. Sense is
 * therefore classified first by the shared sloughSense collocation fields. The
 * fallback is conditioned on the POS guess: a verb reading with no swamp evidence
 * is the shed verb, while a bare plural noun defaults to the backwater swamp (the
 * corpus is overwhelmingly Delta geography), but any positive mire/backwater/shed
 * field still overrides. is_VVZ then only splits the homophonic shed spellings.
 * The decision rests only on neighbouring words, never the target's own NN2|VVZ
 * tag.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

import { is_VVZ } from '../pos.js';
import { sloughSense } from './slough-sense.js';

/** sense → euspelling for the plural noun forms. */
const NOUN = { shed: 'sloffs', mire: 'slouhs', backwater: 'sluhs' };

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'slouhs' | 'sluhs' | 'sloffs' | 'sloffz'}
 */
export function disambiguate_sloughs(tokens, idx) {
  const verb = is_VVZ(tokens, idx);
  // Classify the sense; a verb with no swamp evidence is the shed verb, a bare
  // noun the backwater swamp — but a positive collocation field overrides either.
  const sense = sloughSense(tokens, idx, verb ? 'shed' : 'backwater');

  // The shed sense is the only one with a verb; its noun/verb spellings are
  // homophones, so is_VVZ picks between them with no effect on pronunciation.
  if (sense === 'shed') return verb ? 'sloffz' : 'sloffs';
  return NOUN[sense];
}
