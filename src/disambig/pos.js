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

// Subject pronouns — a preceding one marks the clitic 's as a contracted verb.
const SUBJECT_PRON = ['PPHS1', 'PPH1', 'PPHS2', 'PPIS1', 'PPIS2', 'PPY'];

/**
 * For the clitic 's (lexicon tag `GE|VBZ|VHZ|…`): true when it is a contracted
 * verb (is/has → 'z), false when it is the genitive marker ('s).
 *
 * Verbal 's attaches to a pronoun/clause subject ("he's") or precedes a
 * participle ("the bus's arriving / arrived"); genitive 's links a noun to a
 * following noun ("the cat's tail"). With neither signal it defaults to
 * genitive, matching the lexicon's 's-first spelling order.
 *
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {boolean}
 */
export function is_verbal_s(tokens, idx) {
  const [, w1b, , w1a] = contextWindow(tokens, idx);
  if (anyExact(w1b, SUBJECT_PRON)) return true;        // "he 's …"
  if (anyPrefix(w1a, ['VVN', 'VVG'])) return true;     // "'s gone / going"
  return false;                                         // default: genitive
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

// Determiners/pre-modifiers that force a PLURAL head noun.
const PLURAL_DET = ['DD2', 'DA2', 'DB2']; // these/those, many/several/few, both
// Cardinal numerals two and up (CLAWS gives "one" the separate tag MC1).
const CARDINAL = ['MC', 'MC2'];
// Determiners/pre-modifiers that force a SINGULAR head noun.
const SINGULAR_DET = ['AT1', 'DD1', 'MC1', 'DA1']; // a/an/every, this/that, one, much/little
// Finite verbs that agree with a PLURAL subject ("corps were", "corps have").
const PLURAL_AGREE = ['VBR', 'VBDR', 'VH0', 'VD0'];
// Finite verbs that agree with a SINGULAR subject ("chassis is", "chassis has").
const SINGULAR_AGREE = ['VBZ', 'VBDZ', 'VHZ', 'VDZ', 'VVZ'];

/**
 * Returns true if the token at `idx` is functioning as a plural noun (NN2)
 * rather than a singular noun (NN1).
 *
 * Scoped to nouns whose singular and plural share one surface form (the French
 * loanwords of encoding 702, e.g. "chassis", "corps", "travois"): the only
 * question is grammatical number, which the target's own NN1|NN2 tag cannot
 * answer, so the decision rests on the neighbours. Votes over the two-before /
 * two-after window — a plural determiner or cardinal numeral before, or a
 * plural-agreeing verb after, argues for NN2; a singular determiner before, or
 * a singular-agreeing verb after, argues for NN1. With no net evidence it
 * returns false, matching the singular-first lexicon spelling order.
 *
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {boolean}
 */
export function is_plural_noun(tokens, idx) {
  const [w2b, w1b, , w1a] = contextWindow(tokens, idx);
  let vote = 0; // > 0 ⇒ NN2 (plural); ≤ 0 ⇒ NN1 (singular)

  // --- Determiner / pre-modifier immediately BEFORE the target -------------
  if (anyExact(w1b, PLURAL_DET) || anyExact(w1b, CARDINAL)) vote += 3; // "these / two chassis"
  if (anyExact(w1b, SINGULAR_DET)) vote -= 3;                          // "a chassis", "one corps"

  // An adjective can sit between the determiner and the noun: look one further
  // back. "the two grey chassis", "a single corps".
  if (anyPrefix(w1b, ['JJ'])) {
    if (anyExact(w2b, PLURAL_DET) || anyExact(w2b, CARDINAL)) vote += 2;
    if (anyExact(w2b, SINGULAR_DET)) vote -= 2;
  }

  // --- Finite verb immediately AFTER the target agrees in number -----------
  if (anyExact(w1a, PLURAL_AGREE)) vote += 3;   // "chassis are / were / have"
  if (anyExact(w1a, SINGULAR_AGREE)) vote -= 3; // "chassis is / was / has"

  return vote > 0;
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
