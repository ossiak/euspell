/**
 * POS disambiguation utilities.
 * Generated stubs are produced by: node build/gen-disambig.js
 *
 * Each function receives the full token array for a sentence and the index of
 * the target word. Return true if the word matches the named part-of-speech.
 * Obtain the fixed two-before / two-after view with `contextWindow(tokens, idx)`
 * from ../content/context.js — out-of-range and cross-sentence slots arrive as
 * the BOUNDARY sentinel (tag 'ZB'), so clause edges are signal, not absence.
 *
 * @typedef {import('../content/context.js').Token} Token
 */

import { contextWindow } from '../content/context.js';

// --- Tag-class helpers -------------------------------------------------------
// Context tokens carry the candidate CLAWS7 tag set imported from the lexicon,
// pipe-joined exactly as stored there (e.g. 'AT|AT1', 'PPHS1', 'NN2|VVZ').

/** @param {Token} token @returns {string[]} candidate CLAWS7 tags */
function tagsOf(token) {
  return token.tag ? token.tag.split('|') : [];
}

/** True if any candidate tag of `token` starts with one of `prefixes`. */
function anyPrefix(token, prefixes) {
  return tagsOf(token).some((t) => prefixes.some((p) => t.startsWith(p)));
}

/** True if any candidate tag of `token` exactly equals one of `tags`. */
function anyExact(token, tags) {
  return tagsOf(token).some((t) => tags.includes(t));
}

// Determiners/articles (exact, so the wh-determiner DDQ 'which' is excluded).
const DETERMINER = ['AT', 'AT1', 'DD', 'DD1', 'DD2', 'DA', 'DA1', 'DA2', 'DAR', 'DAT', 'DB', 'DB2'];
// Possessives, adjectives, numerals — other noun-phrase pre-modifiers.
const PREMODIFIER = ['APPGE', 'JJ', 'MC', 'MD', 'MF'];
// Prepositions — a finite verb never directly follows one.
const PREPOSITION = ['II', 'IO', 'IF', 'IW'];
// 3rd-person-singular subject pronouns: he, she, it.
const SUBJECT_3SG = ['PPHS1', 'PPH1'];
// Relativisers that can be the subject of the target verb: who, which, that.
const REL_SUBJECT = ['PNQS', 'DDQ', 'CST'];
// Any verb or modal.
const VERB_ANY = ['VV', 'VB', 'VH', 'VD', 'VM'];
// Verb forms agreeing with a PLURAL subject (base forms, are/were, plural have/do).
const PLURAL_VERB = ['VV0', 'VBR', 'VBDR', 'VH0', 'VD0'];
// Object pronouns / objects that can follow a finite verb: him, her, them, it, you.
const OBJECT_PRONOUN = ['PPHO', 'PPIO', 'PPX', 'PPH1', 'PPY'];
// Singular common/proper nouns (for the "determiner + singular-noun + target" test).
const SINGULAR_NOUN = ['NN1', 'NNU1', 'NNL1', 'NNT1', 'NNO1', 'NNB', 'NP1'];
// Adverbs.
const ADVERB = ['RR', 'RG', 'RP', 'RL', 'RT', 'RA'];

/**
 * Returns true if the token at `idx` is functioning as a 3rd-person-singular
 * present-tense verb (CLAWS7: VVZ) rather than a plural noun (NN2).
 *
 * Scoped to words tagged exactly `NN2|VVZ` in the lexicon (diatones such as
 * "records"): the only question is noun-subject/object vs. finite verb. Votes
 * over the two-before / two-after window — a 3rd-sg subject or a following
 * object NP argues for VVZ; a determiner/preposition before, or a
 * plural-agreeing verb after, argues for the NN2 subject reading. With no net
 * evidence it returns false, matching the noun-first lexicon fallback.
 *
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {boolean}
 */
export function is_VVZ(tokens, idx) {
  const [w2b, w1b, , w1a] = contextWindow(tokens, idx);
  let vote = 0; // > 0 ⇒ VVZ (verb); ≤ 0 ⇒ NN2 (noun)

  // --- Word immediately BEFORE the target ----------------------------------
  if (anyExact(w1b, SUBJECT_3SG)) vote += 3;                   // "it records"
  else if (anyPrefix(w1b, REL_SUBJECT)) vote += 2;            // "device which records"
  if (anyExact(w1b, DETERMINER) || anyPrefix(w1b, PREMODIFIER)) vote -= 3; // "the/old/two records"
  if (anyPrefix(w1b, PREPOSITION)) vote -= 3;                 // "of records"
  if (anyExact(w1b, ['VM', 'TO'])) vote -= 2;                 // "will/to record(s)" — not VVZ
  else if (anyPrefix(w1b, VERB_ANY) && !anyExact(w1b, SUBJECT_3SG)) vote -= 1; // "plays records" (object)
  if (anyPrefix(w1b, ADVERB)) vote += 1;                      // "regularly records"

  // Subject pattern: (determiner) + singular noun + target → the target is the verb.
  if (anyExact(w1b, SINGULAR_NOUN) &&
      (anyExact(w2b, DETERMINER) || anyPrefix(w2b, PREMODIFIER))) vote += 2; // "the machine records"

  // --- Word immediately AFTER the target -----------------------------------
  if (anyExact(w1a, PLURAL_VERB)) vote -= 3;                  // "records are / records show"
  if (anyExact(w1a, DETERMINER) || anyPrefix(w1a, ['APPGE'])) vote += 2; // "records the / his meeting"
  if (anyPrefix(w1a, OBJECT_PRONOUN)) vote += 2;             // "records them"
  if (anyPrefix(w1a, ['NN', 'NP'])) vote += 1;               // "records data" (bare object)
  if (anyPrefix(w1a, ADVERB)) vote += 1;                     // "records quickly"

  return vote > 0;
}

/**
 * Returns true if the token at `idx` is functioning as a past-tense verb (VVD).
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {boolean}
 */
export function is_past_tense(tokens, idx) {
  // TODO: implement
  return false;
}

/**
 * Returns true if the token at `idx` is functioning as a past participle (VVN).
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {boolean}
 */
export function is_past_participle(tokens, idx) {
  // TODO: implement
  return false;
}

/**
 * Returns true if the token at `idx` is functioning as a plural noun (NN2).
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {boolean}
 */
export function is_plural_noun(tokens, idx) {
  // TODO: implement
  return false;
}

/**
 * Returns true if the token at `idx` is functioning as an adjective (JJ).
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {boolean}
 */
export function is_adjective(tokens, idx) {
  // TODO: implement
  return false;
}
