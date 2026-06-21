/**
 * Disambiguates 'bows' (encoding 114, NN2|VVZ) four ways:
 *   bows — /boʊz/ plural noun (ribbons, archery/violin bows)
 *   bowz — /boʊz/ 3rd-sg-pres verb ("she bows the violin")
 *   buws — /baʊz/ plural noun (bends from the waist; ship's bows)
 *   buwz — /baʊz/ 3rd-sg-pres verb ("he bows to the crowd")
 * Corpus: disambig/bows.txt
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'bows' | 'bowz' | 'buws' | 'buwz' | null}  null = unable to determine
 */
export function disambiguate_bows(tokens, idx) {
  // TODO: implement using rules derived from disambig/bows.txt corpus
  return null;
}
