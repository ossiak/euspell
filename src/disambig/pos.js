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

import { contextWindow, crossesSentenceBreak } from '../content/context.js';
import { VVZ_SVM } from './vvz-svm.js';
import { VV0_VERB_DEFAULT } from './vv0-prior.js';

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

/**
 * anyPrefix, ignoring ditto tags — for a test whose result CATEGORICALLY
 * decides the answer rather than contributing a vote.
 *
 * Ditto tags (RR22, NN132, JJ43 …) mark "word k of an n-word expression"; as
 * candidate readings of an isolated word they are noise, which is why the SVM's
 * fam() drops them. In a vote they are mostly harmless — for a determiner they
 * point the same way its genuine reading does, so they only inflate a magnitude
 * (measured: stripping them moves the VVZ and VV0 decisions by <0.4% and
 * changes accuracy by <0.05pt either way). In a branch that RETURNS, one
 * spurious match flips the answer outright: "a" carries NN132, so it counted as
 * the noun in is_verbal_s's attributive test and turned "the author's published
 * a book" into a genitive.
 */
function anyPrefixReal(token, prefixes) {
  return tagsOf(token).some((t) => !DITTO.test(t) && prefixes.some((p) => t.startsWith(p)));
}

// Determiners/articles (exact, so the wh-determiner DDQ 'which' is excluded),
// split by the grammatical number they force on a following head noun.
// DD1 is the singular set that can ALSO stand alone as a pronoun subject: this,
// that, each, either, neither, another. AT1 is deliberately not among them --
// "the" is tagged AT|AT1, so an AT1 member would drag the commonest determiner
// of all into the exempt set.
const DETERMINER_DD1 = ['DD1'];
const DETERMINER_DD2 = ['DD2', 'DA2', 'DB2'];
const DETERMINER_DD = ['AT', 'AT1', 'DD', 'DA', 'DA1', 'DAR', 'DAT', 'DB'];
const DETERMINER = [...DETERMINER_DD1, ...DETERMINER_DD2, ...DETERMINER_DD];
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
const SINGULAR_NOUN = ['NN1', 'NNU1', 'NNL1', 'NNT1', 'NNO1', 'NNB', 'NP1', 'NPD1', 'NPM1'];
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
 * Scoped to words tagged exactly `NN2|VVZ` in the lexicon ("records", "tools",
 * "functions"). What qualifies is the tag pair, not a stress shift, so most of
 * them are not diatones: only "records" of those three is one. The plural noun
 * is the unmarked default —
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
  const relSubject = anyPrefix(left, REL_SUBJECT);
  if (anyExact(left, SUBJECT_3SG)) vote += 3;                 // "it records"
  else if (relSubject) vote += 2;                            // "device which records"
  else if (anyPrefix(left, ['NP'])) vote += 2;              // "John records" — proper-noun subject
  else if (anyExact(left, DETERMINER_DD1)) vote += 2;      // "this records" — demonstrative pronoun subject

  // Noun-phrase context before → the plural-noun reading (the default), but only
  // for the determiners a plural head noun can actually follow. DD1 is excluded
  // outright. It is singular, and this scorer only ever runs on plural NN2|VVZ
  // forms, so "this maps" / "that maps" / "each maps" cannot be a noun phrase at
  // all; both readings of a DD1 word point at the verb instead — demonstrative
  // pronoun subject ("this maps letters") or relativiser ("that maps letters") —
  // which is why it takes the subject bonus above. Measured on the held-out
  // fiction targets, a DD1 word before one of these forms precedes a VVZ 95.5%
  // of the time (4,094 against 193): the -3 was voting against the evidence.
  //
  // The two sets that keep the penalty are not an oversight. AT1 is in
  // DETERMINER_DD because "the" is tagged AT|AT1, and the 8,840 held-out targets
  // after a word carrying both are 0.0% VVZ. DA1 is there because "little" is an
  // adjective homograph (DA1|JJ|NN1, 25% VVZ: "little swords"). And "those maps"
  // keeps its -3, DD2 being plural, which is what a plural noun follows.
  //
  // relSubject still guards the whole test for the wh-words: DDQ and PNQS are
  // not in any DETERMINER set, but a relativiser must never be read as the head
  // of the noun phrase it introduces.
  if (!relSubject && (anyExact(left, DETERMINER_DD) || anyExact(left, DETERMINER_DD2)
    || anyPrefix(left, PREMODIFIER))) vote -= 3;             // "the/old/two tools"
  if (anyPrefix(left, PREPOSITION)) vote -= 3;               // "of tools"
  if (anyPrefix(left, ['NN'])) vote -= 2;                    // "learning tools" — compound modifier
  if (anyExact(left, ['VM', 'TO'])) vote -= 3;               // "will/to tool(s)" — never VVZ
  else if (anyPrefix(left, VERB_ANY) && !anyExact(left, SUBJECT_3SG)) vote -= 1; // "plays records"

  // --- AFTER: a complement only a finite verb takes argues for the verb. ----
  // A plural-agreeing verb after (through an adverb) marks the noun subject:
  // "records show", "records also show".
  const afterVerb = isPureAdverb(w1a) ? w2a : w1a;
  if (anyExact(afterVerb, PLURAL_VERB)) vote -= 3;
  // A past-tense verb after does too ("the phone calls stopped"): a finite verb
  // cannot immediately follow a finite VVZ, so the target must be its subject.
  // Only when the word cannot be a noun ("calls last" JJ|NN1|RR|VV0 stays open —
  // "calls last week" is a verb frame with a noun complement, not a subject). A
  // JJ candidate does NOT block the cue: regular -ed forms all carry one
  // ("stopped" JJ|VVD|VVN), and an attributive reading needs a noun after
  // anyway, which the verb complement rules below credit separately.
  else if (anyExact(afterVerb, ['VVD']) && !anyPrefix(afterVerb, ['NN'])) vote -= 3;
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

// CLAWS7 ditto tags (II22, JJ21, NN132, …) mark "word k of an n-word multiword
// expression". Only a ditto tag ends in two digits.
const DITTO = /\d\d$/;

/**
 * Coarsens a single CLAWS7 tag to the feature family used by the SVM, or null
 * for a ditto tag. As candidate readings of an isolated word, ditto tags are
 * noise that smears function words across families ("between" II|II22|JJ22|RL|
 * RL22 would fire PREP+PREMOD+ADV at once), so they map to no family. Mirrors
 * the families the rule predicates test (subject pronoun, determiner, object
 * pronoun, …) so each neighbor candidate tag maps to one stable feature key.
 * MUST stay byte-identical to fam() in build/gen-vvz-svm.py — the weights are
 * keyed on these strings.
 * @param {string} tag @returns {string | null}
 */
function svmFamily(tag) {
  if (DITTO.test(tag)) return null;
  if (tag.startsWith('NP')) return 'NP';
  if (tag.startsWith('NN')) return 'NN';
  if (tag === 'PPHS1' || tag === 'PPH1') return 'SUBJ3SG';
  if (tag.startsWith('PPHO') || tag.startsWith('PPIO') || tag.startsWith('PPX') || tag.startsWith('PPY')) return 'OBJPRON';
  if (tag === 'AT' || tag === 'AT1' || tag.startsWith('DD') || tag.startsWith('DA') || tag.startsWith('DB')) return 'DET';
  if (tag.startsWith('APPGE')) return 'POSS';
  if (tag.startsWith('II') || tag.startsWith('IO') || tag.startsWith('IF') || tag.startsWith('IW')) return 'PREP';
  if (tag.startsWith('JJ') || tag.startsWith('MC') || tag.startsWith('MD') || tag.startsWith('MF')) return 'PREMOD';
  if (tag === 'VV0' || tag === 'VBR' || tag === 'VBDR' || tag === 'VH0' || tag === 'VD0') return 'PLVERB';
  // Past tense is its own family: a finite past verb right after the target
  // ("the phone calls VPAST…") marks the target as its subject noun, a signal
  // the generic VERB family (infinitives, participles) dilutes.
  if (tag === 'VVD') return 'VPAST';
  if (tag.startsWith('VV') || tag.startsWith('VB') || tag.startsWith('VH') || tag.startsWith('VD') || tag.startsWith('VM')) return 'VERB';
  if (tag.startsWith('RR') || tag.startsWith('RG') || tag.startsWith('RP') || tag.startsWith('RL') || tag.startsWith('RT') || tag.startsWith('RA')) return 'ADV';
  if (tag === 'PNQS' || tag === 'DDQ' || tag === 'CST') return 'RELSUBJ';
  return tag.slice(0, 2);
}

// The six context-window slots paired with their signed offset, in the order
// contextWindow returns them: [w-3, w-2, w-1, target, w+1, w+2, w+3].
const SVM_SLOTS = [[0, -3], [1, -2], [2, -1], [4, 1], [5, 2], [6, 3]];

// Closed-class candidate tags (preposition / conjunction / infinitival to) that
// lexicalize an adjacent neighbor — see svmFeatures.
const CLOSED_CLASS = /^(II|IO|IF|IW|CC|CS|TO)/;

/**
 * Family set for one context token: one family per non-ditto candidate tag, or
 * UNK for a word the lexicon doesn't know (or whose every reading is a ditto
 * tag), or null for a boundary slot (past a sentence edge, tag 'ZB').
 * @param {Token} tok @returns {Set<string> | null}
 */
function slotFams(tok) {
  if (tok.tag === 'ZB') return null;
  if (tok.tag === '') return new Set(['UNK']);
  const fams = new Set();
  for (const t of tok.tag.split('|')) {
    const f = svmFamily(t);
    if (f !== null) fams.add(f);
  }
  return fams.size ? fams : new Set(['UNK']);
}

/**
 * Builds the SVM feature keys for the target at `idx`, identically to
 * featurize() in build/gen-vvz-svm.py. Each neighbor fires one
 * "<offset>=<family>" per candidate tag (multi-hot, ditto tags dropped), or
 * "<offset>=UNK" for a word the lexicon doesn't know. A boundary slot fires
 * nothing — absence of context is not evidence; the bias carries the base
 * rate. Plus the bias, a capitalization flag, and the lexical "w=<word>"
 * identity (the per-word prior).
 *
 * Two structural feature groups beyond the per-slot families:
 * - An adjacent (±1) closed-class word (preposition/conjunction/to) also fires
 *   its identity ("1w=of"): the family alone cannot tell a post-nominal PP
 *   ("records OF the meeting" → noun) from a phrasal-verb complement ("calls
 *   FOR backup" → verb). Closed class, so the vocabulary stays tiny.
 * - The (-2,-1) family pair fires as a conjunction ("p=DET~NN"): it separates
 *   a subject frame ("the machine records…" → verb) from a noun-compound
 *   frame ("the call records…" → noun), which single-slot features cannot
 *   represent in a linear model.
 *
 * @param {Token[]} tokens @param {number} idx @returns {string[]}
 */
function svmFeatures(tokens, idx) {
  const win = contextWindow(tokens, idx);
  const word = tokens[idx]?.word ?? '';
  const feats = ['bias', `w=${word.toLowerCase()}`];
  if (/^\p{Lu}/u.test(word)) feats.push('cap');
  /** @type {Map<number, Set<string> | null>} */
  const perOff = new Map();
  for (const [slot, off] of SVM_SLOTS) {
    const tok = win[slot];
    const fams = slotFams(tok);
    perOff.set(off, fams);
    if ((off === -1 || off === 1) && tok.tag !== 'ZB' && tok.tag !== '') {
      const closed = tok.tag.split('|').some((t) => !DITTO.test(t) && CLOSED_CLASS.test(t));
      if (closed) feats.push(`${off}w=${tok.word.toLowerCase()}`);
    }
    if (fams === null) continue;
    for (const f of fams) feats.push(`${off}=${f}`);
  }
  const before2 = perOff.get(-2);
  const before1 = perOff.get(-1);
  if (before2 && before1) {
    for (const fa of before2) for (const fb of before1) feats.push(`p=${fa}~${fb}`);
  }
  return feats;
}

// How much one hand-rule vote point counts against the SVM score in the
// blended decision below. Rule cues come in ±3 steps, so one strong noun cue
// (a determiner or preposition before, a finite past verb after) can veto
// about half a unit of SVM confidence; two cues about a full unit.
const RULE_VETO = 0.16;

// Heads that can anchor a clause subject before the target: a determiner or
// possessive opens a subject NP, a subject pronoun or relativiser is one
// outright, an existential fills the slot, and a proper noun can stand alone as
// one ("John records."). A bare common noun or adjective cannot open a subject
// NP in English, so a run of them is a noun compound, not a subject.
const SUBJECT_HEAD = [
  ...DETERMINER, 'APPGE', 'EX',
  'PPHS1', 'PPH1', 'PPHS2', 'PPIS1', 'PPIS2', 'PPY', // subject pronouns
  ...REL_SUBJECT,
];

/**
 * True when the target ends a block that cannot be a clause, so it heads a noun
 * phrase: a heading, title, table cell, button or list label ("Notes",
 * "Release Notes", "Software Release Notes", "Phone Calls").
 *
 * Two conditions, both required. Nothing follows the target within its block —
 * a finite VVZ almost always takes a complement, and a heading's head word is
 * final. And nothing before it can head a subject — without one there is no
 * clause for the target to be the verb of. "The machine records." and
 * "He records." keep a subject, so they stay with the SVM.
 *
 * @param {Token[]} tokens @param {number} idx @returns {boolean}
 */
function endsIsolatedNounPhrase(tokens, idx) {
  if (idx + 1 < tokens.length && !crossesSentenceBreak(tokens, idx, idx + 1)) return false;
  // Walk back to the start of this sentence. Testing breakAfter directly is
  // equivalent to crossesSentenceBreak(k, idx) here — every slot between k and
  // idx was cleared on an earlier step, so tokens[k] is the only new one — and
  // it keeps the walk linear. The span form re-scanned k..idx every step, which
  // made a long unbroken block (a list or table flattened into one text node)
  // quadratic: 3,200 tokens cost 10ms against 1ms for 800.
  for (let k = idx - 1; k >= 0 && !tokens[k]?.breakAfter; k--) {
    if (anyExact(tokens[k], SUBJECT_HEAD) || anyPrefix(tokens[k], ['NP'])) return false;
  }
  return true;
}

/**
 * The production decision for an NN2|VVZ ambiguity: the linear SVM score
 * (vvz-svm.js, trained on the fiction + non-fiction _corpus_012_112*.txt by
 * build/gen-vvz-svm.py) blended with the hand rule's NEGATIVE (noun) votes:
 *
 *   svm(tokens, idx) + RULE_VETO · min(0, vvzScore(tokens, idx)) > 0  ⇒ VVZ
 *
 * The SVM carries the decision — 94.6% held-out accuracy alone vs the rule's
 * 88.5% — but its rare false verbs are weak positives on noun-compound frames
 * the corpus under-represents ("the call records between…" +0.3), where the
 * rule has categorical noun evidence (vote ≤ −3). Letting only the rule's
 * negative votes count keeps its role to that veto: the SVM's verb recall is
 * already high, so positive rule votes would add nothing but noise. Measured
 * on the held-out split: 94.5% accuracy with precision 93.3% → 95.2% vs the
 * SVM alone — the false-verb rate nearly halves for a ~0.1pt accuracy cost,
 * the right trade for a converter whose noun spelling is the safe default.
 * A word unseen in training has no "w=" weight and falls back to the
 * learned context weights.
 *
 * A target heading an isolated noun phrase (a heading, title, cell or label)
 * short-circuits to the noun — see {@link endsIsolatedNounPhrase}. The corpus
 * is running prose, so these shapes are absent from training and the model
 * reads them out-of-distribution: with no complement the boundary slots fire
 * nothing, leaving the "w=" weight — a residual fitted *alongside* context
 * features, not a standalone base rate — to decide, and it can contradict the
 * counts it was trained on (lone "notes" scores +0.40 = verb, though the corpus
 * holds 628 NN2 vs 553 VVZ). A heading is also exactly where the pair feature
 * that separates a compound from a subject frame ("p=DET~NN") cannot fire, for
 * want of a determiner. Falling back to the lexicon's noun-first default suits
 * a converter whose noun spelling is the safe choice.
 * @param {Token[]} tokens @param {number} idx @returns {boolean}
 */
export function is_VVZ_svm(tokens, idx) {
  if (endsIsolatedNounPhrase(tokens, idx)) return false;
  let score = 0;
  for (const f of svmFeatures(tokens, idx)) score += VVZ_SVM.get(f) ?? 0;
  return score + RULE_VETO * Math.min(0, vvzScore(tokens, idx)) > 0;
}

// Subject pronouns — a preceding one marks the clitic 's as a contracted verb.
const SUBJECT_PRON = ['PPHS1', 'PPH1', 'PPHS2', 'PPIS1', 'PPIS2', 'PPY'];

/**
 * For the clitic 's (lexicon tag `GE|VBZ|VHZ|…`): true when it is a contracted
 * verb (is/has → 'z), false when it is the genitive marker ('s).
 *
 * Verbal 's attaches to a pronoun subject ("he's"), precedes a predicative
 * participle ("the bus's arriving", "she's gone"), or precedes a deictic locative
 * predicate ("the cat's here", "everyone's there"); genitive 's links a noun to a
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
/**
 * True when `token` can head a noun phrase — a noun reading that is not also an
 * adverb or particle reading.
 *
 * The exclusion is the point. English post-verbal particles and adverbs almost
 * all carry a noun candidate as well ("fast" JJ|NN1|RR|VV0, "over" II|JJ|NN1|RG|
 * RP|VV0, and likewise down, well, home, back, hard), so a bare noun-candidate
 * test finds a "noun" after the participle in "the horse's running fast" and
 * calls the participle attributive — making the clitic a genitive. Requiring the
 * word to be nominal AND not adverbial keeps the real attributive cases ("the
 * author's published works", NN|VVZ; "today's featured article", NN1).
 *
 * @param {Token} token
 * @returns {boolean}
 */
function isNounHead(token) {
  return anyPrefixReal(token, ['NN', 'NP']) && !anyPrefixReal(token, ADVERB);
}

// Modifiers that can sit either ATTRIBUTIVELY before a noun (making the clitic a
// genitive: "today's featured article", "the man's old car") or PREDICATIVELY
// with nothing to modify (making it a verb: "the bus's arriving", "the man's
// old"). Which one it is depends on whether a noun head follows.
const AMBIGUOUS_MODIFIER = ['VVN', 'VVG', 'JJ', 'RR', 'RG'];

// Categories that cannot open a noun phrase at all, so they cannot follow a
// genitive — the clitic before them is a contracted is/has. Measured on the
// held-out fifth of disambig/_corpus_clitic_s.txt: after a genitive, XX, DB,
// PN1, VBN, VVGK, VDN, TO, DD* and APPGE occur ZERO times in 289,133 cases,
// AT1 occurs 46 against 19,781 verbal, and II 34 against 6,824.
// Split by how absolute the corpus evidence is, because the noun-head guard
// below is itself fallible: function words pick up stray noun readings from the
// lexicon ("not" is CSW33|NN|RA21|XX), and guarding on those suppresses a cue
// that is never wrong.
//
// DECISIVE — zero genitives in 289,133, or close enough: DD*, DB, XX, PN1, TO,
// APPGE, VBN, VVGK, VDN all literally never follow a genitive; AT1 does 46 times
// against 19,781 verbal, AT 303 against 16,108.
const NOT_NP_INITIAL_DECISIVE = [
  'AT', 'DD', 'DB',         // a/the, this/that/which, all/both
  'APPGE',                  // "the man's his own worst enemy"
  'XX',                     // "the man's not here"
  'PN1',                    // "the man's one of them"
  'VB', 'VD', 'VVGK', 'TO', // "'s been", "'s done", "'s going to", "'s to blame"
];
// GUARDED — strongly verbal but not absolute, so a word that can head a noun
// phrase keeps the genitive reading ("John's back" stays open, "the man's in the
// car" does not).
const NOT_NP_INITIAL_GUARDED = [
  'PP',                     // "'s it", "'s he", "'s her friend"
  ...PREPOSITION,           // II 6,824 verbal against 34 genitive
];

// Locative/directional adverbs (here, away, abroad, upstairs) — a predicate of
// place, never a possessed noun. Guarded by a no-noun test in is_verbal_s so the
// words that are ALSO nouns ("home", "back", "upstairs") keep their genitive
// default, since "the family's home" is a genuine genitive the tags can't rule
// out. The existential/locative "there" (EX|NN1|RL) is handled separately: its EX
// reading marks it verbal despite the noun reading ("everyone's there").
const PREDICATE_LOCATIVE = ['RL'];

export function is_verbal_s(tokens, idx) {
  const [, , w1b, , w1a, w2a, w3a] = contextWindow(tokens, idx);
  if (anyExact(w1b, SUBJECT_PRON)) return true;        // "he 's …" — contracted verb

  // A modifier after the clitic is attributive — hence genitive — only when a
  // noun head follows it; otherwise it is a predicate and the clitic is a verb.
  // "the author's published works" vs "the author's published a book"; "the
  // man's old car" vs "the man's old".
  //
  // anyPrefixReal, not anyPrefix: both arms RETURN, so one spurious ditto match
  // flips the answer. "a" carries NN132, which made "the author's published a
  // book" read as attributive — hence genitive — instead of "has published".
  // The head can sit two slots out when modifiers stack ("the man's really nice
  // car", "today's widely featured article"), so scan the modifier run rather
  // than testing one slot.
  // ...but only when the word is a modifier and nothing else. A word with a noun
  // reading of its own is the head, not a modifier stacked before one, so the
  // clitic is a genitive and the two-slots-ahead scan must not run.
  //
  // Without this guard the branch captured every noun that also carries JJ —
  // "the shepherd's head", "the family's home", "the horse's back" — and,
  // finding no second noun after them, returned "predicative, hence verb".
  // The locative guard below was written to keep exactly those words on the
  // genitive default and never saw them, because JJ matched two branches
  // earlier. NN/NP rather than isNounHead: the adverbial exclusion is what puts
  // "home" and "back" here in the first place.
  //
  // Participles are exempt from the guard, because a gerund ALWAYS carries a
  // noun reading ("coming" is JJ|NN|NN1|VVG) and would otherwise be read as a
  // head — losing "anybody's coming along", which is the case the branch exists
  // for. So the noun reading only wins when it is not also a participle.
  // The guard is also lifted when the possessor is an indefinite pronoun, since
  // "everyone's ready" and "anybody's coming" are predicative where "the
  // shepherd's head" is not. PN1 is deliberately absent from SUBJECT_PRON above,
  // because it does take genitives ("anybody's guess") — but those are a plain
  // noun after the clitic, which never reaches this branch at all.
  const participle = anyPrefixReal(w1a, ['VVG', 'VVN']);
  const pronounPossessor = anyPrefixReal(w1b, ['PN']);
  if (
    anyPrefixReal(w1a, AMBIGUOUS_MODIFIER)
    && (participle || pronounPossessor || !anyPrefixReal(w1a, ['NN', 'NP']))
  ) {
    for (const w of [w2a, w3a]) {
      if (isNounHead(w)) return false;                  // attributive → genitive
      if (!anyPrefixReal(w, AMBIGUOUS_MODIFIER)) break; // run ended without a head
    }
    return true;                                        // predicative → verb
  }

  // Nothing that can head or open a noun phrase follows, so there is no genitive
  // reading available: the clitic is a contracted verb.
  if (anyPrefixReal(w1a, NOT_NP_INITIAL_DECISIVE)) return true;
  if (!isNounHead(w1a) && anyPrefixReal(w1a, NOT_NP_INITIAL_GUARDED)) return true;

  // A deictic locative/existential predicate after the clitic: a pure locative
  // adverb with no noun reading ("here", "away") or existential/locative "there"
  // (EX). It heads a place-predicate, not a possessed noun, so the clitic is a
  // contracted verb ("the cat's here" = "is here", "everyone's there" = "is
  // there"). The no-noun guard keeps "home"/"back" (NN1|RL) on the genitive
  // default; the EX arm still catches "there" despite its NN1 reading.
  if (
    (anyPrefixReal(w1a, PREDICATE_LOCATIVE) && !anyPrefixReal(w1a, ['NN', 'NP'])) ||
    anyExact(w1a, ['EX'])
  ) {
    return true;
  }

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
 * Returns the signed context vote (> 0 ⇒ verb); {@link is_verb_VV0} thresholds
 * it. Split out for the same reason as {@link vvzScore}: so the context rules
 * can be read, tested, and measured in isolation from the decision boundary.
 *
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {number}
 */
export function vv0Score(tokens, idx) {
  const [, w2b, w1b, , w1a, w2a] = contextWindow(tokens, idx);
  // Look through a single intervening adverb to the real pre-modifier
  // ("they carefully separate", "the largely separate systems"). Only a word
  // that can EXCLUSIVELY be an adverb is skipped (isPureAdverb) — the same
  // strictness vvzScore uses, and for the same reason: the tagger reports a
  // word's full candidate set, and ordinary determiners carry stray ditto-adverb
  // tags ("the" is AT|…|RG42|RR22|RT42). A loose prefix test treats those as
  // adverbs and looks straight past them, discarding the determiner cue that
  // settles the noun reading — which silently cost this rule its single most
  // decisive signal on "the"/"a", the commonest left neighbours it sees.
  const left = isPureAdverb(w1b) ? w2b : w1b;
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
  // An attributive adjective ("polar bear", "brown bear", "separate estimate").
  // This was missing while the numerals beside it were not, so "two separate"
  // was read as a noun phrase and "polar bear" was not — and with no other cue
  // in the frame the vote landed on exactly 0, handing the decision to the
  // word's base rate, which for "bear" is the verb. On the Wikipedia "Polar
  // bear" article that lost 212 of 239 singular instances; with this cue it is
  // 28. vvzScore has always voted on the whole PREMODIFIER set; vv0Score simply
  // lacked the adjective member of it.
  //
  // A base-form verb is not normally preceded by an adjective, which is what
  // makes this safe: the nominalised-subject frame that would break it ("the
  // poor bear the cost") is rare, and rarer than the noun phrase it fixes.
  // Weighted below the determiner and possessive cues, so an explicit verb cue
  // (to/will/do, +4) still wins outright.
  //
  // anyPrefixReal, NOT anyPrefix — this is the whole difference between the cue
  // working and wrecking the rule. Ditto tags (JJ21, JJ43 …) mark a word as part
  // of a multi-word expression, and ordinary words carry them as stray candidate
  // readings, exactly as they carry the ditto-adverb tags isPureAdverb exists to
  // ignore. Counting those, the cue fires almost everywhere and held-out accuracy
  // falls from 94.3% to 82.5% — "use" 90.2 → 66.8, "live" 92.9 → 62.5. Excluding
  // them it is +0.12pt weighted overall (94.3% → 94.5%), +5.3pt on "bear".
  if (anyPrefixReal(left, ['JJ'])) vote -= 3;       // "polar bear", "separate estimate"
  if (anyExact(w1b, DEGREE_ADVERB)) vote -= 3;      // "very deliberate", "more appropriate"

  // --- Post-modifier: a following object NP argues for the verb ----------
  // Look through an intervening adverb here too ("separate carefully the eggs").
  // Without this the object cue is simply lost, and because it is the ONLY verb
  // cue in a frame with no subject pronoun the vote lands on exactly 0 — the one
  // value is_verb_VV0 treats specially, handing the decision to the per-word
  // default. So an adverb did not weaken the reading, it silently reversed it.
  const right = isPureAdverb(w1a) ? w2a : w1a;
  if (anyExact(right, DETERMINER) || anyPrefix(right, ['APPGE'])) vote += 2; // "separate the / his X"
  if (anyPrefix(right, OBJECT_PRONOUN)) vote += 2;  // "separate them"

  return vote;
}

/**
 * Thresholds {@link vv0Score}: true ⇒ the verb reading. On a ZERO vote — no
 * contextual evidence either way — a listed word falls back to the verb
 * reading instead of the global noun-first default.
 *
 * The context vote carries no per-word bias: it applies one noun-first default
 * to every word, and measured on the CLAWS corpus that was its dominant error
 * source — 75% of its mistakes were zero-vote cases. One default cannot serve a
 * class whose base rates run from 0.1% verb ("mouth") to 98% ("mow"): the rule
 * scored 46.7% on "live" (87% verb), worse than always guessing. Deferring
 * those silent cases to the word's own base rate lifts held-out accuracy from
 * 82.3% to 88.6% (see build/gen-vv0-prior.mjs).
 *
 * The default applies ONLY on a zero vote. Adding a scaled bias to the vote
 * instead scores higher in aggregate (90.6%) but is the wrong trade: a bias big
 * enough to fix "live" also outweighs a determiner, turning "the live
 * broadcast" into "liv", and one big enough to fix "house" made its verb
 * reading unreachable. Categorical context must win — the same principle by
 * which the rule's negative votes veto the NN2|VVZ model in {@link is_VVZ_svm}.
 *
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {boolean}
 */
export function is_verb_VV0(tokens, idx) {
  const vote = vv0Score(tokens, idx);
  if (vote !== 0) return vote > 0; // context has an opinion — it wins
  return VV0_VERB_DEFAULT.has((tokens[idx]?.word ?? '').toLowerCase());
}

// Removed: is_past_tense and is_past_participle, unimplemented stubs that
// returned false and had no callers. The JJ|VVD|VVN split (encoding 022:
// blessed, dogged, jagged, learned) is decided by the per-word semantic rules in
// src/disambig/semantic/ instead, which is where a real implementation would go.

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

// Removed: is_adjective, likewise an unimplemented stub with no callers.
