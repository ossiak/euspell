/**
 * POS disambiguation utilities.
 *
 * Each function receives the full token array for a sentence and the index of
 * the target word. Return true if the word matches the named part-of-speech.
 * Obtain the fixed three-before / three-after view with `contextWindow(tokens, idx)`
 * from ../content/context.js — out-of-range and cross-sentence slots arrive as
 * the BOUNDARY sentinel (tag 'ZB'), so clause edges are signal, not absence.
 *
 * @typedef {import('../content/context.js').Token} Token
 */

import { contextWindow } from '../content/context.js';
import { VVZ_SVM } from './vvz-svm.js';

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
 * True when `token` can ONLY be an adverb — every candidate tag in its set is an
 * adverb tag. Only such a word is looked through as an intervening adverb ("John
 * regularly records", "records also show").
 *
 * The strict, all-tags test is deliberate. The tagger is lexical (tagger.js): it
 * reports a word's full CLAWS7 candidate set, and ordinary determiners,
 * prepositions, and adjectives carry stray ditto-adverb tags ("the" AT|…|RR22,
 * "on" II|…|RP|RR22, "large" JJ|…|RR22|RR33). A loose "has an adverb tag" test
 * would treat those as adverbs and skip them — discarding the very determiner,
 * preposition, or adjective cue that settles the noun reading ("large bumps on
 * the edge" wrongly read as a verb). On a cleanly single-tagged token this is
 * identical to a plain adverb test.
 *
 * @param {Token} token
 * @returns {boolean}
 */
function isPureAdverb(token) {
  const tags = tagsOf(token);
  return tags.length > 0 && tags.every((t) => ADVERB.some((p) => t.startsWith(p)));
}

/**
 * Returns true if the token at `idx` is functioning as a 3rd-person-singular
 * present-tense verb (CLAWS7: VVZ) rather than a plural noun (NN2).
 *
 * Scoped to words tagged exactly `NN2|VVZ` in the lexicon (diatones such as
 * "records", "tools", "functions"). The plural noun is the unmarked default —
 * the verb is taken only when the context confirms it — because the commonest
 * source of error is a noun-modifier compound ("learning tools", "computer
 * functions", "bank accounts"), where a noun sits right before the target and
 * naively looks like a subject. Such a preceding common noun argues for the
 * compound noun, not the verb.
 *
 * VVZ is confirmed by: an unambiguous subject before — a 3rd-sg pronoun
 * "it/he/she", a relativiser "which/who/that", or a proper noun ("John records",
 * "Mary speaks"); a complement only a finite verb takes after (an object pronoun
 * "records them", an object NP "records the data", or a proper-noun object "meets
 * Mary"); or a determiner +
 * (optional adjective) + common-noun subject followed by such a complement ("the
 * new machine records the data", "the mucosa sloughs off"). A preceding
 * determiner/preposition/common-noun, or a following plural-agreeing verb, argues
 * for the noun ("John records show errors" → noun). With no net evidence it
 * returns false (NN2), the lexicon's noun-first default.
 *
 * Reads the three-before / three-after window so a single intervening adverb is
 * looked through on each side ("John regularly records his notes", "the tools
 * clearly are old") and a determiner can sit two words ahead of the subject noun
 * ("the new machine records").
 *
 * Returns the signed context vote (> 0 ⇒ VVZ); {@link is_VVZ} thresholds it.
 * This is the interpretable hand-written rule; production routes the decision
 * through the learned {@link is_VVZ_svm} instead. Kept separate so the context
 * rules can be read and tested in isolation.
 *
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {number}
 */
export function vvzScore(tokens, idx) {
  const [w3b, w2b, w1b, , w1a, w2a] = contextWindow(tokens, idx);
  // Look through a single intervening adverb to the real neighbour on each side.
  // Only a word that can exclusively be an adverb is skipped (see isPureAdverb),
  // so a determiner/preposition/adjective carrying a stray ditto-adverb tag keeps
  // its role and its decisive noun cue is not discarded ("large bumps on …").
  const beforeAdv = isPureAdverb(w1b);
  const left = beforeAdv ? w2b : w1b;        // nearest non-adverb before
  const leftBack = beforeAdv ? w3b : w2b;    // the word before `left`
  let vote = 0; // > 0 ⇒ VVZ (verb); ≤ 0 ⇒ NN2 (noun)

  // --- BEFORE: an unambiguous subject before argues for the verb. ----------
  if (anyExact(left, SUBJECT_3SG)) vote += 3;                 // "it records"
  else if (anyPrefix(left, REL_SUBJECT)) vote += 2;          // "device which records"
  else if (anyPrefix(left, ['NP'])) vote += 2;              // "John records" — proper-noun subject

  // Noun-phrase context before → the plural-noun reading (the default).
  if (anyExact(left, DETERMINER) || anyPrefix(left, PREMODIFIER)) vote -= 3; // "the/old/two tools"
  if (anyPrefix(left, PREPOSITION)) vote -= 3;               // "of tools"
  if (anyPrefix(left, ['NN'])) vote -= 2;                    // "learning tools" — compound modifier
  if (anyExact(left, ['VM', 'TO'])) vote -= 3;               // "will/to tool(s)" — never VVZ
  else if (anyPrefix(left, VERB_ANY) && !anyExact(left, SUBJECT_3SG)) vote -= 1; // "plays records"

  // --- AFTER: a complement only a finite verb takes argues for the verb. ----
  // A plural-agreeing verb after (through an adverb) marks the noun subject:
  // "records show", "records also show".
  const afterVerb = isPureAdverb(w1a) ? w2a : w1a;
  if (anyExact(afterVerb, PLURAL_VERB)) vote -= 3;
  if (anyPrefix(w1a, OBJECT_PRONOUN)) vote += 3;            // "records them"
  if (anyExact(w1a, DETERMINER) || anyPrefix(w1a, ['APPGE'])) vote += 2; // "records the / his X"
  if (anyPrefix(w1a, ['NP'])) vote += 2;                    // "meets Mary" — proper-noun object
  if (anyPrefix(w1a, ['RR'])) vote += 1;                    // "functions well"

  // A clear subject NP + target + verb complement → a finite verb. The subject
  // is a proper noun, or a determiner + (optionally one adjective/numeral) +
  // common noun; the trailing complement is what separates this from a bare
  // "[det] noun noun" compound ("the computer functions list").
  const detSubject = anyExact(leftBack, DETERMINER) ||
    (!beforeAdv && anyPrefix(w2b, ['JJ', 'MC', 'MD', 'MF']) && anyExact(w3b, DETERMINER));
  const subjectNoun = anyPrefix(left, ['NP']) || (anyExact(left, SINGULAR_NOUN) && detSubject);
  const verbComplement = anyPrefix(w1a, OBJECT_PRONOUN) || anyExact(w1a, DETERMINER) ||
    anyPrefix(w1a, ['APPGE', 'RR', 'RP', 'NP']);
  if (subjectNoun && verbComplement) vote += 3;

  return vote;
}

/**
 * True if the token at `idx` is a 3rd-sg-present verb (VVZ) by the hand-written
 * context vote alone — the unseeded {@link vvzScore}. This is the interpretable
 * rule used by the unit tests; production routes through the linear SVM
 * {@link is_VVZ_svm}, which learned weights over the same context families.
 * @param {Token[]} tokens @param {number} idx @returns {boolean}
 */
export function is_VVZ(tokens, idx) {
  return vvzScore(tokens, idx) > 0;
}

/**
 * Coarsens a single CLAWS7 tag to the feature family used by the SVM. Mirrors
 * the families the rule predicates test (subject pronoun, determiner, object
 * pronoun, …) so each neighbor candidate tag maps to one stable feature key.
 * MUST stay byte-identical to fam() in build/gen-vvz-svm.py — the weights are
 * keyed on these strings.
 * @param {string} tag @returns {string}
 */
function svmFamily(tag) {
  if (tag.startsWith('NP')) return 'NP';
  if (tag.startsWith('NN')) return 'NN';
  if (tag === 'PPHS1' || tag === 'PPH1') return 'SUBJ3SG';
  if (tag.startsWith('PPHO') || tag.startsWith('PPIO') || tag.startsWith('PPX') || tag.startsWith('PPY')) return 'OBJPRON';
  if (tag === 'AT' || tag === 'AT1' || tag.startsWith('DD') || tag.startsWith('DA') || tag.startsWith('DB')) return 'DET';
  if (tag.startsWith('APPGE')) return 'POSS';
  if (tag.startsWith('II') || tag.startsWith('IO') || tag.startsWith('IF') || tag.startsWith('IW')) return 'PREP';
  if (tag.startsWith('JJ') || tag.startsWith('MC') || tag.startsWith('MD') || tag.startsWith('MF')) return 'PREMOD';
  if (tag === 'VV0' || tag === 'VBR' || tag === 'VBDR' || tag === 'VH0' || tag === 'VD0') return 'PLVERB';
  if (tag.startsWith('VV') || tag.startsWith('VB') || tag.startsWith('VH') || tag.startsWith('VD') || tag.startsWith('VM')) return 'VERB';
  if (tag.startsWith('RR') || tag.startsWith('RG') || tag.startsWith('RP') || tag.startsWith('RL') || tag.startsWith('RT') || tag.startsWith('RA')) return 'ADV';
  if (tag === 'PNQS' || tag === 'DDQ' || tag === 'CST') return 'RELSUBJ';
  return tag.slice(0, 2);
}

// The six context-window slots paired with their signed offset, in the order
// contextWindow returns them: [w-3, w-2, w-1, target, w+1, w+2, w+3].
const SVM_SLOTS = [[0, -3], [1, -2], [2, -1], [4, 1], [5, 2], [6, 3]];

/**
 * Builds the SVM feature keys for the target at `idx`, identically to
 * featurize() in build/gen-vvz-svm.py. Each neighbor fires one
 * "<offset>=<family>" per candidate tag (multi-hot), or "<offset>=UNK" for a
 * word the lexicon doesn't know. A boundary slot (past a sentence edge, tag
 * 'ZB') fires nothing — absence of context is not evidence; the bias carries
 * the base rate. Plus the bias, a capitalization flag, and the lexical
 * "w=<word>" identity (the per-word prior).
 * @param {Token[]} tokens @param {number} idx @returns {string[]}
 */
function svmFeatures(tokens, idx) {
  const win = contextWindow(tokens, idx);
  const word = tokens[idx]?.word ?? '';
  const feats = ['bias', 'w=' + word.toLowerCase()];
  if (/^\p{Lu}/u.test(word)) feats.push('cap');
  for (const [slot, off] of SVM_SLOTS) {
    const tok = win[slot];
    if (tok.tag === 'ZB') continue;                  // boundary: no feature
    if (tok.tag === '') { feats.push(off + '=UNK'); continue; }
    const fams = new Set();
    for (const t of tok.tag.split('|')) fams.add(svmFamily(t));
    for (const f of fams) feats.push(off + '=' + f);
  }
  return feats;
}

/**
 * The production decision for an NN2|VVZ diatone via the linear SVM
 * (vvz-svm.js, trained on the fiction + non-fiction _corpus_012_112*.txt by
 * build/gen-vvz-svm.py). Sums the learned weights of the word's active
 * features; > 0 ⇒ VVZ (verb). Replaces the earlier hand-tuned
 * rule-vote-plus-prior: measured 94.0% accuracy on a held-out split (94.1%
 * fiction, 93.8% non-fiction) vs the rule's 88.5%, with much higher verb
 * recall. A diatone unseen in training has no "w=" weight and falls back to the
 * learned context weights.
 * @param {Token[]} tokens @param {number} idx @returns {boolean}
 */
export function is_VVZ_svm(tokens, idx) {
  let score = 0;
  for (const f of svmFeatures(tokens, idx)) score += VVZ_SVM.get(f) ?? 0;
  return score > 0;
}

// Subject pronouns — a preceding one marks the clitic 's as a contracted verb.
const SUBJECT_PRON = ['PPHS1', 'PPH1', 'PPHS2', 'PPIS1', 'PPIS2', 'PPY'];

/**
 * For the clitic 's (lexicon tag `GE|VBZ|VHZ|…`): true when it is a contracted
 * verb (is/has → 'z), false when it is the genitive marker ('s).
 *
 * Verbal 's attaches to a pronoun subject ("he's") or precedes a predicative
 * participle ("the bus's arriving", "she's gone"); genitive 's links a noun to a
 * following noun phrase ("the cat's tail"). The participle cue alone is
 * ambiguous, because a participle right after the 's can instead be ATTRIBUTIVE,
 * modifying a following noun — which makes the 's a genitive ("today's featured
 * article", "the author's published works"). So the two-after slot is consulted:
 * a noun after the participle means attributive, hence genitive. With no verbal
 * signal it defaults to genitive, matching the lexicon's 's-first spelling order.
 *
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {boolean}
 */
export function is_verbal_s(tokens, idx) {
  const [, , w1b, , w1a, w2a] = contextWindow(tokens, idx);
  if (anyExact(w1b, SUBJECT_PRON)) return true;        // "he 's …" — contracted verb
  // "'s" + participle: contracted is/has ("bus's arriving", "author's published a
  // book") — unless the participle is attributive (a noun follows it), making the
  // 's a genitive ("today's featured article", "author's published works").
  if (anyPrefix(w1a, ['VVN', 'VVG'])) return !anyPrefix(w2a, ['NN', 'NP']);
  return false;                                         // default: genitive
}

// Nominative pronouns that take a VV0 (base-form) verb: I, we, you, they.
// (he/she/it would force the -s form VVZ, so they are not VV0 subjects.)
const VV0_SUBJECT_PRON = ['PPIS1', 'PPIS2', 'PPHS2', 'PPY'];
// Degree adverbs (very/more/most/quite/too/so) — these pre-modify an adjective.
const DEGREE_ADVERB = ['RG', 'RGR', 'RGT', 'RGQ'];

/**
 * Returns true if the token at `idx` is functioning as a base-form verb (VV0)
 * rather than a noun or adjective.
 *
 * Scoped to the encoding-102 heteronyms whose verb and noun/adjective readings
 * differ only in pronunciation (mostly the "-ate" stress pair, e.g. "separate"
 * /eɪt/ verb vs /ət/ adjective, plus the /s/~/z/ pairs "use", "house"): the verb
 * takes the full-vowel spelling, the noun/adjective the reduced one. The
 * target's own JJ|NN1|VV0 tag cannot decide this, so the decision rests on the
 * neighbours. Votes over the two-before / two-after window, looking through one
 * intervening adverb — an infinitive "to", a modal/do, a base-form subject
 * pronoun (I/we/you/they), or a following object NP argues for the verb; a
 * determiner, possessive, degree adverb, copula, preposition, or numeral before
 * argues for the noun/adjective. With no net evidence (and for the ambiguous
 * "…ate + bare noun" frame) it returns false, matching the lexicon's
 * noun/adjective-first spelling order.
 *
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {boolean}
 */
export function is_verb_VV0(tokens, idx) {
  const [, w2b, w1b, , w1a] = contextWindow(tokens, idx);
  // Look through a single intervening adverb to the real pre-modifier
  // ("they carefully separate", "the largely separate systems").
  const left = anyPrefix(w1b, ADVERB) ? w2b : w1b;
  let vote = 0; // > 0 ⇒ VV0 (verb); ≤ 0 ⇒ noun / adjective

  // --- Pre-modifier: verb cues -------------------------------------------
  if (anyExact(left, ['TO'])) vote += 4;            // "to separate"
  if (anyPrefix(left, ['VM'])) vote += 4;           // "will / can separate"
  if (anyPrefix(left, ['VD'])) vote += 3;           // "do / does / did separate"
  if (anyExact(left, VV0_SUBJECT_PRON)) vote += 3;  // "I / we / you / they separate"
  if (anyPrefix(left, REL_SUBJECT)) vote += 2;      // "rules that separate"

  // --- Pre-modifier: noun / adjective cues -------------------------------
  if (anyExact(left, DETERMINER)) vote -= 4;        // "a / the / this estimate"
  if (anyPrefix(left, ['APPGE'])) vote -= 4;        // "his estimate"
  if (anyPrefix(left, ['VB'])) vote -= 3;           // "is / are separate" (predicate adjective)
  if (anyPrefix(left, PREPOSITION)) vote -= 3;      // "in separate", "of the estimate"
  if (anyPrefix(left, ['MC', 'MD', 'MF'])) vote -= 2; // "two separate", "first estimate"
  if (anyExact(w1b, DEGREE_ADVERB)) vote -= 3;      // "very deliberate", "more appropriate"

  // --- Post-modifier: a following object NP argues for the verb ----------
  if (anyExact(w1a, DETERMINER) || anyPrefix(w1a, ['APPGE'])) vote += 2; // "separate the / his X"
  if (anyPrefix(w1a, OBJECT_PRONOUN)) vote += 2;    // "separate them"

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
  const [, w2b, w1b, , w1a] = contextWindow(tokens, idx);
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
