/**
 * Shared disambiguation core for the 'read' heteronym family — read, reread,
 * misread, copyread, foreread, outread, proofread, sightread. They are spelled
 * identically in the base/infinitive (/riːd/) and the past/participle (/rɛd/),
 * so the reading is decided purely from surrounding context, independent of the
 * prefix. Each word's file maps the result to its own euspellings.
 *
 * Returns 'base' (/riːd/), 'past' (/rɛd/, incl. attributive participle), or null
 * (locally undecidable — e.g. "I read", where present and past are identical).
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

const tagsOf = (tok) => (tok && tok.tag ? tok.tag.split('|') : []);
const isAny = (tok, list) => tagsOf(tok).some((t) => list.includes(t));
const isPre = (tok, prefixes) => tagsOf(tok).some((t) => prefixes.some((p) => t.startsWith(p)));

const PAST_CUE = /^(yesterday|ago|earlier|previously|already|recently|formerly|once)$/i;
const PRESENT_CUE = /^(now|today|nowadays|currently)$/i;

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'base' | 'past' | null}
 */
export function readVerbReading(tokens, idx) {
  // 1. Nearest governing auxiliary / modal / infinitive marker. Skip adverbs,
  //    negation and the subject (so inversion "have you read" is caught), and
  //    stop at a clause boundary or any other content word.
  for (let j = idx - 1; j >= 0 && j >= idx - 5; j--) {
    const t = tokens[j];
    if (!t || t.breakAfter) break;
    if (isPre(t, ['CC'])) {                                       // coordination
      if (isAny(tokens[j - 1], ['VVD'])) return 'past';          // "sat and read"
      break;
    }
    if (isPre(t, ['CS'])) break;                                  // subordinator boundary
    if (isPre(t, ['R']) || isAny(t, ['XX']) || isPre(t, ['PP'])) continue; // adv/neg/subject
    if (isPre(t, ['VH', 'VB'])) return 'past';                   // perfect/passive participle
    if (isAny(t, ['TO']) || isPre(t, ['VM'])) return 'base';     // "to read" / "can read"
    if (isAny(t, ['VD0', 'VDI', 'VDZ'])) return 'base';          // "do/does … read"
    if (isAny(t, ['VDD', 'VDN'])) return 'past';                 // "did … read"
    if (isAny(t, ['VVD'])) return 'past';                        // "paused … read" (serial past)
    break;                                                        // other content word
  }

  const w1b = tokens[idx - 1];
  const w1a = tokens[idx + 1];

  // 2. Attributive participle: (determiner/adjective/possessive) X-read NOUN —
  //    "a proofread memo", "the misread instructions" → past (/rɛd/).
  if ((isAny(w1b, ['AT', 'AT1']) || isPre(w1b, ['DD', 'APPGE', 'JJ', 'DA'])) &&
      isPre(w1a, ['NN', 'NP', 'JJ'])) {
    return 'past';
  }

  // 3. Relative clause "X who/that read": a singular antecedent means the present
  //    would be "reads", so this is past.
  if (isAny(w1b, ['PNQS']) || isPre(w1b, ['CST'])) {
    for (let j = idx - 2; j >= 0 && j >= idx - 5; j--) {
      const a = tokens[j];
      if (!a || a.breakAfter) break;
      if (isPre(a, ['R']) || isAny(a, ['XX'])) continue;
      if (isPre(a, ['NP1']) || isAny(a, ['NN1', 'NNB', 'NNL1', 'NNT1'])) return 'past';
      break;
    }
  }

  // 4. Immediately preceding 3rd-singular subject ⇒ past (present would be "reads").
  if (isAny(w1b, ['PPHS1', 'PPH1']) ||
      isPre(w1b, ['NP1']) ||
      isAny(w1b, ['NN', 'NN1', 'NNL1', 'NNT1', 'NNB', 'NNO', 'NNU1'])) {
    return 'past';
  }

  // 5. Residual (I/you/we/they read, or imperative): tipped only by a nearby
  //    temporal adverbial; otherwise undecidable.
  for (let j = idx - 3; j <= idx + 3; j++) {
    if (j === idx || !tokens[j]) continue;
    if (PAST_CUE.test(tokens[j].word)) return 'past';
    if (PRESENT_CUE.test(tokens[j].word)) return 'base';
  }
  return null;
}
