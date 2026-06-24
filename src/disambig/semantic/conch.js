/**
 * Disambiguates 'conch' (encoding 202, NN1) — the same noun (a sea snail and its
 * spiral shell), two pronunciations:
 *   conch — /kɒntʃ/ ("con-ch") — the modern dictionary-first pronunciation
 *   conqh — /kɒŋk/ ("conk") — the older / British pronunciation
 * Corpus: disambig/conch.txt (single-source; all the "conch shell" sense).
 *
 * The two pronunciations are dialectal/idiolectal variants of one word — they do
 * not track sense or any neighbouring-word context, so there is no reliable
 * textual cue to choose between them. 'conch' (/kɒntʃ/), the more common modern
 * pronunciation and the lexicon's spellings[0], is therefore the default. The
 * decision rests only on neighbouring words, never on the NN1 tag.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'conch' | 'conqh'}
 */
export function disambiguate_conch(tokens, idx) {
  // No contextual cue distinguishes the two pronunciations; default to /kɒntʃ/.
  return 'conch';
}
