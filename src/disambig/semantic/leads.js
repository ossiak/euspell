/**
 * Disambiguates 'leads' (encoding 113, NN2|VVZ) three ways:
 *   leads — /liːdz/ plural noun of /liːd/: clues/tips, electrical leads (wires),
 *           dog leads (leashes), the theatrical/sales leads
 *   ledds — /lɛdz/  plural of the metal/graphite 'lead' (Pb): "pencil leads",
 *           the lead sheets of a roof ("the leads")
 *   leadz — /liːdz/ the 3rd-person-singular present verb ("the path leads to…")
 * Corpus: disambig/leads.txt
 *
 * Two axes: verb vs. noun (the NN2|VVZ diatone), and — within the noun — the
 * metal Pb vs. the /liːd/ senses. The verb dominates the data ("leads to/us/the
 * way"), so it is resolved first with the shared is_VVZ test; a plural noun is
 * then the metal /lɛdz/ only on graphite/pencil evidence, else the unmarked
 * /liːdz/ noun (clue, wire, leash). Note electrical "leads" are the /liːd/
 * conductor, NOT the metal. The decision rests only on neighbouring words, never
 * the target's own NN2|VVZ tag.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

import { is_VVZ } from '../pos.js';

const wordOf = (tok) => (tok?.word ?? '').toLowerCase().replace(/[.,!?;:'"]+$/, '');

// Graphite / pencil words that, as the immediate modifier of "leads", fix the
// metal-plural /lɛdz/ ('ledds') — the writing cores of pencils. Bulk-Pb plurals
// are otherwise rare, and electrical "leads" are excluded (those are the /liːd/
// conductor, not the metal).
const PENCIL_MOD = new Set([
  'pencil', 'pencils', 'graphite', 'propelling', 'leadholder',
  'hb', '2b', '3b', '4b', '5b', '6b', '7b', '8b', '2h', '4h',
]);

// Words after "leads" that signal the leading verb, so "pencil leads to…" is not
// mistaken for the metal noun "pencil leads".
const VERB_COMPLEMENT = new Set([
  'to', 'into', 'toward', 'towards', 'up', 'down', 'out', 'through', 'here',
  'there', 'nowhere', 'away', 'back', 'off', 'onward', 'past', 'directly',
  'only', 'eventually', 'straight', 'inevitably', 'ultimately',
  'the', 'a', 'an', 'him', 'her', 'them', 'us', 'me', 'you', 'it', 'his', 'their',
]);

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'leads' | 'ledds' | 'leadz'}
 */
export function disambiguate_leads(tokens, idx) {
  const prev = wordOf(tokens[idx - 1]);
  const next = wordOf(tokens[idx + 1]);

  // "pencil / graphite leads" as a metal noun compound — but not "pencil leads
  // to…" (the verb). Checked before is_VVZ, which misreads the modifier as a
  // subject.
  if (PENCIL_MOD.has(prev) && !VERB_COMPLEMENT.has(next)) return 'ledds';

  // "that / this leads to…" — a demonstrative subject + verb (the plural noun
  // would take "those/these leads"). is_VVZ misses this, penalising "that" as a
  // determiner, so handle it explicitly.
  if (prev === 'that' || prev === 'this') return 'leadz';

  // The general verb test ("the path leads to…", "she leads him").
  if (is_VVZ(tokens, idx)) return 'leadz';

  // Otherwise the unmarked /liːdz/ noun: clues, wires, leashes.
  return 'leads';
}
