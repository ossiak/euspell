/**
 * Disambiguates 'closer': /ˈkloʊsər/ (with /s/ → 'closer' — the comparative of
 * close meaning nearer: "come closer", "a closer look", "closer to") vs
 * /ˈkloʊzər/ (with /z/ → 'clozer' — the agent noun, one who/that closes: a
 * baseball relief pitcher, a deal-closer). Corpus: disambig/closer.txt
 *
 * The comparative dominates entirely, so 'closer' is the unmarked default.
 * 'clozer' (/kloʊzər/) is the agent noun, taken only with clear evidence of the
 * baseball relief role (pitcher, bullpen, save, ninth inning…) — the most
 * reliable agent-noun context; the bare "a/the closer" of "a closer look" is
 * still the comparative. The decision rests only on neighbouring words, never
 * the target's own JJR|NN1|RRR tag.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

const wordOf = (tok) => (tok?.word ?? '').toLowerCase().replace(/[.,!?;:'"]+$/, '');

// Anywhere in the clause window: baseball relief-pitching vocabulary, which
// marks "closer" as the agent noun (the relief pitcher) → /kloʊzər/ ('clozer').
const BASEBALL_FIELD = new Set([
  'pitcher', 'pitchers', 'pitch', 'pitched', 'pitching', 'reliever', 'relievers',
  'relief', 'bullpen', 'inning', 'innings', 'save', 'saves', 'mound', 'ninth',
  'strikeout', 'strikeouts', 'fastball', 'ballgame', 'batter', 'batters',
  'lineup', 'roster', 'mlb', 'baseball',
]);

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'closer' | 'clozer'}
 */
export function disambiguate_closer(tokens, idx) {
  // Baseball relief-pitching context → the agent noun, /kloʊzər/ ('clozer').
  for (let j = idx - 5; j <= idx + 5; j++) {
    if (j !== idx && tokens[j] && BASEBALL_FIELD.has(wordOf(tokens[j]))) return 'clozer';
  }

  // Otherwise the unmarked /kloʊsər/: the comparative meaning nearer.
  return 'closer';
}
