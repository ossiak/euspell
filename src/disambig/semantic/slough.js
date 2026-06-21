/**
 * Disambiguates 'slough' (encoding 103, NN|NN1|VV0) three ways:
 *   sloff — /slʌf/ shed/cast off (dead skin); the cast-off layer
 *   slouh — /slaʊ/ a bog or mire ("Slough of Despond"); the place Slough
 *   sluh  — /sluː/ a backwater swamp or marsh (chiefly N. American)
 * Corpus: none yet
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'sloff' | 'slouh' | 'sluh' | null}  null = unable to determine
 */
export function disambiguate_slough(tokens, idx) {
  // TODO: implement (no corpus yet — derive rules from POS/semantic context)
  return null;
}
