/**
 * Disambiguates 'bach' (encoding 202, NP|VV0), two pronunciations:
 *   baqh — /bɑːk/ (rhymes with "rock") the surname Bach (the composer) and
 *          Welsh "bach" (term of endearment) — the proper-noun reading
 *   bach — /bætʃ/ (rhymes with "match") the verb "to bach" (live as a bachelor;
 *          chiefly NZ/Australian), and the NZ noun for a holiday cottage
 * Corpus: none.
 *
 * The surname overwhelmingly dominates, so a capitalised "Bach" (or anything
 * tagged as a proper noun) takes /bɑːk/ ('baqh'); a lower-case "bach" is the
 * verb/cottage sense, /bætʃ/ ('bach'). The decision rests only on the token's
 * own form/tag and neighbours, never on assuming the NP|VV0 split.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

const tagsOf = (tok) => (tok && tok.tag ? tok.tag.split('|') : []);

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'baqh' | 'bach'}
 */
export function disambiguate_bach(tokens, idx) {
  const tok = tokens[idx];
  const isProper = /^[A-Z]/.test(tok?.word ?? '') || tagsOf(tok).some((t) => t.startsWith('NP'));
  return isProper ? 'baqh' : 'bach';
}
