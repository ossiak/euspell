/**
 * Disambiguates 'minute' (encoding 202, JJ|JJ44|NNT1|VV0) two ways:
 *   minut  — /ˈmɪnɪt/ noun (unit of time) or verb ("to minute a meeting")
 *   minute — /maɪˈnjuːt/ adjective ("minute detail")
 * Corpus: disambig/minute.txt
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'minut' | 'minute' | null}  null = unable to determine
 */
export function disambiguate_minute(tokens, idx) {
  // TODO: implement using rules derived from disambig/minute.txt corpus
  return null;
}
