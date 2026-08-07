// Word lookup for the popup: given a word, say what Euspell does to it.
//
// This is deliberately not the converter. The converter has to pick one
// spelling for the 5,905 entries that carry more than one, which is what the
// VVZ SVM, the VV0 prior and src/disambig/semantic/* exist for. A lookup has no
// sentence to read and no reason to guess — it shows every spelling the entry
// carries and labels them, so it is never wrong where the converter can be.
// That is why nothing here imports the disambiguation stack.
//
// The three small tables are imported outright (~53 KB combined); the 205k-entry
// lexicon is installed by the caller via setLexicon(), because it costs ~400 ms
// to fetch and parse and should not be paid until someone actually types.

import { data as abbreviations } from '../../dist/abbreviations.js';
import { data as contractions } from '../../dist/contractions.js';
import { data as phrases } from '../../dist/phrases.js';
import { descriptions, pad } from './encodings.js';

/** @typedef {import('../../dist/lexicon.js').LexiconEntry} LexiconEntry */

/**
 * @typedef {{ spelling: string, label: string | null, same: boolean }} Sense
 * @typedef {{ kind: 'empty' }
 *   | { kind: 'loading' }
 *   | { kind: 'miss', word: string }
 *   | { kind: 'unchanged', word: string, encoding: number, code: string,
 *       description: string, pos: string, expansion: string | null }
 *   | { kind: 'spellings', word: string, encoding: number, code: string,
 *       description: string, pos: string, senses: Sense[] }
 *   | { kind: 'reverse', word: string,
 *       sources: { word: string, code: string, description: string, pos: string }[] }
 * } Result
 */

/** @type {Map<string, LexiconEntry> | null} */
let lexicon = null;

/** @type {Map<string, string[]> | null} */
let reverse = null;

/**
 * Install the main lexicon. Clears any reverse index built from an older table.
 * @param {Map<string, LexiconEntry>} map
 */
export function setLexicon(map) {
  lexicon = map;
  reverse = null;
}

/** @returns {boolean} */
export function hasLexicon() {
  return lexicon !== null;
}

/* ------------------------------------------------------------------ labels */

// CLAWS7 uses 270 distinct tags across the lexicon, so these are prefix rules
// rather than a table: the family is carried by the first letters, and the
// digits that follow mark number, degree and multiword position. Exact matches
// come first, because a few tags contradict their own initial (APPGE is a
// possessive, not an article).
const EXACT = new Map([
  ['APPGE', 'possessive'], ['PPGE', 'possessive'], ['GE', 'possessive'],
  ['TO', 'infinitive'], ['XX', 'negation'], ['EX', 'existential'],
]);

/**
 * A readable name for one CLAWS7 tag.
 * @param {string} tag
 * @returns {string}
 */
function nameOf(tag) {
  const t = tag.toUpperCase();
  const exact = EXACT.get(t);
  if (exact) return exact;
  if (t.startsWith('NP')) return 'proper noun';
  if (t.startsWith('N')) return 'noun';
  if (t.startsWith('V')) return 'verb';
  if (t.startsWith('J')) return 'adjective';
  if (t.startsWith('R')) return 'adverb';
  if (t.startsWith('P')) return 'pronoun';
  if (t.startsWith('M')) return 'number';
  if (t.startsWith('I')) return 'preposition';
  if (t.startsWith('C') || t.startsWith('B')) return 'conjunction';
  if (t.startsWith('A') || t.startsWith('D')) return 'determiner';
  if (t.startsWith('U')) return 'interjection';
  if (t.startsWith('Z')) return 'letter';
  return t.toLowerCase();
}

/**
 * One tag's atoms. An enclitic is written as a tag per part, space-separated,
 * because it is two words fused into one: `cannot` is `VM XX` (modal + not),
 * `'tis` is `PPH1 VBZ` (it + is), `anybody's` is `PN1 GE` or `PN1 VBZ`
 * depending on which `'s` it is. Reading such a tag whole names it from the
 * first half and silently drops the second.
 * @param {string} tag
 * @returns {string[]}
 */
const atomsOf = (tag) => tag.split(/\s+/).filter(Boolean);

/**
 * The parts of speech an entry can be, as one readable list. Tags collapse
 * heavily — NN, NN1 and NN2 are all "noun" — so this is deduplicated.
 * @param {string[]} tags
 * @returns {string}
 */
function partsOfSpeech(tags) {
  const seen = [];
  for (const tag of tags) {
    // A stray empty tag ("DAT||NN1") yields no atoms and contributes nothing.
    for (const atom of atomsOf(tag)) {
      const name = nameOf(atom);
      if (!seen.includes(name)) seen.push(name);
    }
  }
  return seen.join(', ');
}

/**
 * Whether a tag is verbal — true if any of its atoms is. The atom matters for
 * the eight clitic-'s pronouns (`anybody's`, `someone's`, …), whose readings are
 * all `PN1 …`: tested whole they are uniformly non-verbal, which collapses the
 * 012/112 split below and labels both spellings identically. It is the genitive
 * `'s` against the contracted is/has that separates them, and that lives in the
 * second atom.
 * @param {string} tag
 */
const isVerb = (tag) => atomsOf(tag).some((a) => a.toUpperCase().startsWith('V'));

// Encodings whose two spellings split by grammar, in a fixed order. This
// mirrors route() in src/content/converter.js, which is what actually picks a
// spelling — 012/112 put the plural noun first and the 3rd-singular verb
// second, and 102/152 put the noun/adjective reading first and the verb second.
// Both therefore mean "everything that is not the verb" at [0] and "the verb"
// at [1]. 702 splits a French loanword by number instead.
const VERB_LAST = new Set([12, 112, 102, 152]);
const BY_NUMBER = 702;

/**
 * Pair spellings with part-of-speech labels.
 *
 * Position only carries meaning for the encodings above; none of their words
 * are in the semantic layer, so the encoding alone settles it. Everywhere else
 * — 202 and the 3-/4-way 1x3/1x4 splits — the division is by sound and sense,
 * and each spelling can carry every tag the entry has: `bow` and `buw` are both
 * noun and verb. Labelling those by index would state something false, so they
 * all take the entry's full list.
 *
 * @param {string} word the headword, so a sense that keeps it can be marked
 * @param {number} encoding
 * @param {string[]} pos
 * @param {string[]} spellings
 * @returns {Sense[]}
 */
function senses(word, encoding, pos, spellings) {
  const mark = (spelling, label) => ({ spelling, label, same: spelling === word });
  const all = partsOfSpeech(pos);

  if (spellings.length === 2 && VERB_LAST.has(encoding)) {
    const others = partsOfSpeech(pos.filter((t) => !isVerb(t)));
    const verbs = partsOfSpeech(pos.filter(isVerb));
    return [mark(spellings[0], others || all), mark(spellings[1], verbs || all)];
  }

  if (spellings.length === 2 && encoding === BY_NUMBER) {
    return [mark(spellings[0], 'noun, singular'), mark(spellings[1], 'noun, plural')];
  }

  return spellings.map((spelling) => mark(spelling, all));
}

/* ------------------------------------------------------------------ tables */

/** Search order: the main lexicon, then the three specialised tables. */
function* tables() {
  if (lexicon) yield lexicon;
  yield contractions;
  yield abbreviations;
  yield phrases;
}

/**
 * Reverse index, built on first miss rather than on load: most lookups are
 * forward and never need it. ~36 ms over the whole lexicon.
 * @returns {Map<string, string[]>}
 */
function reverseIndex() {
  if (reverse) return reverse;
  reverse = new Map();
  for (const table of tables()) {
    for (const [word, entry] of table) {
      if (entry.encoding % 10 === 0) continue; // unchanged: spelling is the word
      for (const spelling of entry.spellings) {
        if (spelling === word) continue; // the sense that keeps its spelling
        const hit = reverse.get(spelling);
        if (hit) {
          if (!hit.includes(word)) hit.push(word);
        } else {
          reverse.set(spelling, [word]);
        }
      }
    }
  }
  return reverse;
}

/* ------------------------------------------------------------------ lookup */

/**
 * Normalise a typed query to a lexicon key: lowercase, trimmed, with runs of
 * whitespace collapsed so a phrase like "a bit" still matches.
 * @param {string} raw
 * @returns {string}
 */
export function normalise(raw) {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Answer one query.
 * @param {string} raw what was typed
 * @returns {Result}
 */
export function lookup(raw) {
  const word = normalise(raw);
  if (!word) return { kind: 'empty' };
  if (!lexicon) return { kind: 'loading' };

  for (const table of tables()) {
    const entry = table.get(word);
    if (!entry) continue;

    const code = pad(entry.encoding);
    const description = descriptions.get(entry.encoding) ?? '';

    if (entry.encoding % 10 === 0) {
      // Abbreviations carry their expansion in the spelling field rather than a
      // reformed spelling — worth showing, since it is the answer to "what is
      // this short for?" even though the word itself does not change.
      const expansion = entry.encoding === 900 && entry.spellings.length
        ? entry.spellings.join(', ')
        : null;
      return {
        kind: 'unchanged',
        word,
        encoding: entry.encoding,
        code,
        description,
        pos: partsOfSpeech(entry.pos),
        expansion,
      };
    }

    return {
      kind: 'spellings',
      word,
      encoding: entry.encoding,
      code,
      description,
      pos: partsOfSpeech(entry.pos),
      senses: senses(word, entry.encoding, entry.pos, entry.spellings),
    };
  }

  // Nothing forward: the word may itself be a euspelling someone is reading.
  const sources = reverseIndex().get(word);
  if (sources) {
    return {
      kind: 'reverse',
      word,
      sources: sources.map((w) => {
        const entry = lexicon?.get(w) ?? contractions.get(w) ?? phrases.get(w);
        return {
          word: w,
          code: entry ? pad(entry.encoding) : '',
          description: entry ? descriptions.get(entry.encoding) ?? '' : '',
          pos: entry ? partsOfSpeech(entry.pos) : '',
        };
      }),
    };
  }

  return { kind: 'miss', word };
}
