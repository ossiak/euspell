import { lookupEntry } from './lexicon-source.js';
import { getContraction } from './contractions.js';
import { is_VVZ_svm, is_verbal_s, is_plural_noun, is_verb_VV0 } from '../disambig/pos.js';
import { SEMANTIC } from '../disambig/semantic/index.js';
import { isPronounI } from '../disambig/pronoun-i.js';

/** @typedef {import('./context.js').Token} Token */

// Words carrying a disambiguation encoding (202/022) that are nonetheless left
// exactly as written — their euspellings aren't worth choosing between (a
// surname, the Greek-letter plural, an archaic disyllabic), so the original
// surface form is kept regardless of context.
export const KEEP_UNCHANGED = new Set(['bach', 'chis', 'ravined']);

/**
 * Converts a single word to its euspelling given surrounding token context.
 * @param {string} word
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {string}
 */
export function convert(word, tokens, idx) {
  // The pronoun "I" reforms to "ih". It is the one word whose case is NOT taken
  // from the source: written English always capitalizes "I", but "ih" is a
  // common word, so it follows normal capitalization — lowercase mid-sentence,
  // capitalized only at the start of a sentence.
  if (word === 'I') {
    // …unless it is the Roman numeral ("Section I") or the letter bound to what
    // follows ("I&A", "I-beam"), neither of which is a word to reform.
    if (!isPronounI(tokens, idx)) return word;
    return isSentenceStart(tokens, idx) ? 'Ih' : 'ih';
  }

  // Abbreviations are consulted only for their PoS (via tagger.js), never for
  // replacement — so the spelling lookup uses the lexicon and contractions only.
  // getContraction() normalizes case and apostrophe style (I'll, don’t).
  const key = word.toLowerCase();
  if (KEEP_UNCHANGED.has(key)) return word;
  const lexEntry = lookupEntry(key);
  const entry = lexEntry ?? getContraction(word);
  if (!entry) return word;

  // The encoding's last digit is the euspelling count: 0 ⇒ word unchanged,
  // 1 ⇒ one spelling, ≥2 ⇒ disambiguate between spellings. The ?? guards
  // entries whose euspelling field is [] despite a non-zero last digit.
  const variants = entry.encoding % 10;
  if (variants === 0) return word;
  const spelling =
    variants === 1 ? entry.spellings[0] ?? word : entry.spellings[route(key, entry, tokens, idx)] ?? word;

  // Contractions of the pronoun "I" (I'm, I've, I'll, I'd, Imma, …) reform with a
  // leading "ih" and follow the SAME rule as the standalone pronoun above: written
  // English always capitalizes "I", but "ih" is an ordinary word, so it is
  // lowercase mid-sentence and capitalized only at a sentence start — not given
  // the source's ever-present capital by matchCase. A lexicon word that reforms to
  // "ih…" (e.g. "Island") must NOT be caught, so this gates on the entry being a
  // contraction led by PPIS1 ("I"), not on the spelling.
  if (!lexEntry && leadsWithPronounI(entry)) {
    return isSentenceStart(tokens, idx) ? spelling[0].toUpperCase() + spelling.slice(1) : spelling;
  }
  return matchCase(word, spelling);
}

/**
 * True when a contraction's leading component is the pronoun "I" (CLAWS7 PPIS1),
 * across every alternative reading — I'm, I've, I'll, I'd, I'd've, Imma, Idunno.
 * @param {import('../../dist/lexicon.js').LexiconEntry} entry
 * @returns {boolean}
 */
function leadsWithPronounI(entry) {
  return (
    Array.isArray(entry.pos) &&
    entry.pos.length > 0 &&
    entry.pos.every((seq) => seq.split(/\s+/)[0] === 'PPIS1')
  );
}

/**
 * Selects the spelling index for an entry with multiple euspellings. Dispatches
 * on the POS pair (pos.js rules, which return an index) or the surface word
 * (semantic rules, which return a euspelling mapped back to its index). Each
 * rule reads the lexically-tagged token stream (dom-walker → tagger.js).
 * @param {string} key  lowercase surface word
 * @param {import('../../dist/lexicon.js').LexiconEntry} entry
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {number}
 */
function route(key, entry, tokens, idx) {
  const { pos } = entry;
  // NN2|VVZ diatones (encodings 012 and 112, e.g. "records", "anchors"): a plural
  // noun (spellings[0], the -s ending) vs a 3rd-sg-present verb (spellings[1], the
  // -z ending). 012 keeps the stem and changes only the ending; 112 also respells
  // the stem — either way the choice is the same noun-vs-verb test. The VVZ tag is
  // always final, paired with one or more nominal/other tags (NN2, NN, NNT2, UH,
  // …), so dispatch on the encoding rather than an exact NN2|VVZ pattern, which
  // would miss shapes like "aids" (NN|NN2|VVZ) or "dawns" (NNT2|VVZ). The rare
  // 3-/4-way splits (encodings 113/114: leads, bows, …) carry a semantic rule and
  // fall through to the SEMANTIC dispatch below.
  if ((entry.encoding === 12 || entry.encoding === 112) && pos.includes('VVZ') && !SEMANTIC.has(key)) {
    return is_VVZ_svm(tokens, idx) ? 1 : 0;
  }
  // The clitic 's: genitive ('s, spellings[0]) vs contracted is/has ('z, [1]).
  // GE (the genitive marker) is the FINAL tag of the reading — a bare tag for the
  // standalone "'s" (pos "GE|VBZ|VHZ|…"), the last of a sequence for a whole-word
  // possessive contraction ("anyone's" pos "PN1 GE|PN1 VBZ|PN1 VHZ", likewise
  // everyone's, someone's, somebody's, nobody's). Testing the final tag catches
  // both; a bare pos.includes('GE') matched only the standalone clitic, so the
  // whole-word contractions never reached is_verbal_s and always took the
  // genitive spelling ("anyone's coming" → "anywun's"). The exact 'GE' match skips
  // the possessive-pronoun tags APPGE/PPGE/DDQGE.
  //
  // is_verbal_s must be asked about the CLITIC's slot, which for a whole-word
  // contraction is not `idx`: the tokenizer expands a contraction to one
  // pseudo-token per PoS position, and identity rides on the first, so "anyone's"
  // occupies [PN1, GE|VBZ|VHZ] and idx points at the PN1. Asked at idx the rule
  // reads the contraction's OWN second pseudo-token as the following word, sees
  // its VBZ, and returns "contracted verb" unconditionally — every genitive came
  // out wrong ("Anybody's guess" → "Anybody'z ghess"). cliticSlot walks to the
  // last pseudo-token so the rule sees the real post-clitic context, which is the
  // slot it already gets for the bare "'s".
  if (pos.some((reading) => reading.split(/\s+/).pop() === 'GE')) {
    return is_verbal_s(tokens, cliticSlot(tokens, idx)) ? 1 : 0;
  }
  // French loanwords (encoding 702) whose singular and plural share one current
  // spelling (e.g. "chassis", "corps", "travois"): the reform gives the plural a
  // trailing -s, so spellings[0] = singular, spellings[1] = plural. ("manque" is
  // JJ|NN, not a number pair, so it has no NN2 and keeps the default spelling.)
  if (entry.encoding === 702 && pos.includes('NN2')) {
    return is_plural_noun(tokens, idx) ? 1 : 0;
  }
  // Heteronyms split by part of speech (encodings 102 and 152): the verb reading
  // takes the full-vowel spelling (spellings[1], e.g. "separate" /eɪt/, "use"
  // /juːz/), the noun/adjective reading the reduced one (spellings[0]).
  //
  // The two encodings ask the SAME question (verb vs noun/adjective) and so share
  // a decision today, but they are kept as separate branches because they are
  // very different populations and are expected to diverge:
  //   102 — the 150 "-ate" stress pairs (separate, advocate, delegate). One
  //         uniform phonological pattern, and individually rare: in the CLAWS
  //         corpus most have no usable instances of both readings, so they are
  //         the case a hand-written contextual rule serves well.
  //   152 — the 17 that are not "-ate" (use, house, live, bear, refuse, mouth,
  //         mow/sow, the -use /s/~/z/ family). A grab-bag of alternations, but
  //         individually COMMON — these carry the large majority of real-world
  //         occurrences of the whole class, and have ample corpus support for a
  //         learned model of the kind the NN2|VVZ diatones already use.
  //
  // Both classes are now purely POS-decided: a word that splits by SENSE instead
  // (row, shower — like bow) is encoded 202 and reaches the SEMANTIC dispatch
  // below on its own. The !SEMANTIC guard is therefore dead for today's data, and
  // kept deliberately: it is what stops a future 102/152 word that acquires a
  // semantic rule from being silently decided by the wrong mechanism.
  if ((entry.encoding === 102 || entry.encoding === 152) && pos.includes('VV0') && !SEMANTIC.has(key)) {
    return is_verb_VV0(tokens, idx) ? 1 : 0;
  }
  // Semantic (pronunciation) words, encoding 202 (e.g. "read"): the rule returns
  // a euspelling; map it back to its index, falling back to the default on null.
  const rule = SEMANTIC.get(key);
  if (rule) {
    const i = entry.spellings.indexOf(rule(tokens, idx));
    return i === -1 ? 0 : i;
  }
  return 0;
}

/**
 * The slot holding a contraction's final component — its clitic — given the slot
 * holding its identity.
 *
 * Read from the token stream rather than counted off the entry's PoS sequence, so
 * it cannot drift from what the tokenizer actually pushed (an entry from the
 * lexicon rather than the contractions table occupies one slot however many
 * positions its PoS names). A continuation pseudo-token is the only token carrying
 * an empty word — every real word and every collapsed phrase has text — so the run
 * of them after `idx` is exactly this contraction's remaining components.
 *
 * A single-component contraction (the bare "'s") has no continuation, so this
 * returns `idx` unchanged.
 *
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {number}
 */
function cliticSlot(tokens, idx) {
  let i = idx;
  while (tokens[i + 1]?.word === '') i++;
  return i;
}

/**
 * True when the token at `idx` begins a sentence — the first token of the block,
 * or the first token after one whose `breakAfter` marks a sentence boundary.
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {boolean}
 */
function isSentenceStart(tokens, idx) {
  return idx === 0 || tokens[idx - 1]?.breakAfter === true;
}

/**
 * Preserves the original word's capitalisation pattern in the replacement.
 * @param {string} original
 * @param {string} replacement
 * @returns {string}
 */
function matchCase(original, replacement) {
  if (original === original.toUpperCase()) return replacement.toUpperCase();
  if (original[0] === original[0].toUpperCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}
