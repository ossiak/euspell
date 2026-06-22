/**
 * Shared disambiguation core for '-ed' heteronyms that are split between a
 * 2-syllable adjective (/-ɪd/) and a 1-syllable past tense/participle verb
 * (/-d/) — e.g. blessed, dogged, learned, aged, cursed. The grammatical cues
 * are identical across these words; only the euspellings and the majority
 * default differ, so each word's file maps the result and picks the default.
 *
 * Returns 'adj', 'verb', or null (no decisive local cue — caller defaults).
 * Cue precisions are corpus-derived (disambig/blessed.txt, disambig/dogged.txt).
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

const tagsOf = (tok) => (tok && tok.tag ? tok.tag.split('|') : []);
const isPre = (tok, prefixes) => tagsOf(tok).some((t) => prefixes.some((p) => t.startsWith(p)));

const DET = ['AT', 'DD', 'APPGE', 'DA', 'DB', 'MC'];   // the/a/every/his/one
const NOUN = ['NN', 'NP'];
const PREP = ['II', 'IO', 'IW', 'IF'];
const OBJECT = ['NN', 'NP', 'PP', 'AT', 'DD', 'APPGE'];

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'adj' | 'verb' | null}
 */
export function edAdjOrVerb(tokens, idx) {
  const w1b = tokens[idx - 1];
  const w1a = tokens[idx + 1];

  // Proper name (capitalized mid-sentence beside a proper noun, e.g. "Blessed
  // Tregesser", "wife Blessed Alice") — keep the full form.
  if (/^[A-Z]/.test(tokens[idx]?.word ?? '') && idx > 0 && !tokens[idx - 1]?.breakAfter &&
      (isPre(w1a, ['NP']) || isPre(w1b, ['NP']))) {
    return 'adj';
  }

  // --- Left neighbor (highest precision) -----------------------------------
  if (isPre(w1b, ['VH', 'VB'])) return 'verb';     // "was/has/been X" (passive/perfect)
  if (isPre(w1b, ['PP'])) return 'verb';           // "he/she X" (subject before)
  if (isPre(w1b, DET)) return 'adj';               // "the/a/every/one X" (attributive)
  if (isPre(w1b, PREP)) return 'adj';              // "of/with X determination"

  // Subject + X + object ⇒ past verb ("God blessed Abraham", "Miles dogged him").
  if (isPre(w1b, NOUN) && isPre(w1a, OBJECT)) return 'verb';

  // --- Right neighbor -------------------------------------------------------
  if (isPre(w1a, ['AT', 'DD', 'APPGE'])) return 'verb';  // "X the/his door" (object NP)
  if (isPre(w1a, ['PP'])) return 'verb';                 // "X them/him/it"
  if (isPre(w1a, PREP)) return 'verb';                   // "X by/with" (passive/agent)
  if (isPre(w1a, ['VH', 'VB'])) return 'adj';            // "X be/is" (subject NP)
  if (isPre(w1a, NOUN)) return 'adj';                    // "X determination" (attributive)
  if (isPre(w1a, ['JJ'])) return 'adj';                  // "X green eyes"

  return null;
}
