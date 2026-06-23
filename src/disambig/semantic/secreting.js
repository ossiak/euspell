/**
 * Disambiguates 'secreting': /sɪˈkriːtɪŋ/ (the present participle of "secrete",
 * to exude a substance → 'secreting', e.g. "glands secreting hormones",
 * "secreting acid") vs /ˈsiːkrətɪŋ/ (concealing/stashing away, from "secret" →
 * 'secretting', e.g. "secreting the passport", "secreting himself away").
 * Corpus: disambig/secreting.txt
 *
 * As with 'secreted', the conceal sense leads ("secreting themselves", "secreting
 * the coins/bodies/money", "secreting away"), so 'secretting' is the unmarked
 * default. The exude /sɪˈkriːtɪŋ/ sense is taken only on biological/discharge
 * evidence: a gland/secretion/substance word in the clause, or a "secreting by
 * <organism>" passive. The decision rests only on neighbouring words, never the
 * target's own JJ|NN|VVG tag.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

const wordOf = (tok) => (tok?.word ?? '').toLowerCase().replace(/[.,!?;:'"]+$/, '');

// Biological / discharge vocabulary that marks the exude sense → /sɪˈkriːtɪŋ/
// ('secreting'). Kept to words unambiguously about producing a fluid/substance,
// so concealable physical objects (a vial, drugs) are NOT included.
const EXUDE_FIELD = new Set([
  'gland', 'glands', 'glandular', 'hormone', 'hormones', 'mucus', 'mucous', 'saliva',
  'salivary', 'enzyme', 'enzymes', 'secretion', 'secretions', 'secrete', 'secretes',
  'membrane', 'membranes', 'venom', 'resin', 'bile', 'insulin', 'pheromone',
  'pheromones', 'sebum', 'sebaceous', 'pancreas', 'liver', 'pituitary', 'mammary',
  'bloodstream', 'pore', 'pores', 'cytokine', 'cytokines', 'allelochemical',
  'alleochemical', 'digestive', 'lymph', 'nectar', 'slime', 'ooze', 'oozed',
  'oozing', 'exude', 'exuded', 'exudes', 'exuding', 'orifice', 'orifices',
  'effluence', 'acid', 'acids', 'potassium', 'enzymatic', 'mollusk', 'mollusc',
  'oyster', 'oysters', 'microfauna', 'protein', 'proteins', 'toxin', 'toxins',
  'fluid', 'fluids', 'foam',
]);

// Organisms/body parts that, as the agent of a "secreting by …" passive, fix the
// exude sense even without other biological vocabulary ("secreting by the trees").
const EXUDE_AGENT = new Set([
  'blood', 'body', 'skin', 'trees', 'tree', 'plant', 'plants', 'scales', 'scale',
  'glands', 'gland', 'cells', 'cell', 'snail', 'snails', 'insect', 'insects',
  'stomach', 'intestine', 'intestines', 'kidney', 'kidneys', 'moss', 'spider',
]);

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'secreting' | 'secretting'}
 */
export function disambiguate_secreting(tokens, idx) {
  // Biological / discharge vocabulary in the clause → the exude sense.
  for (let j = idx - 5; j <= idx + 5; j++) {
    if (j !== idx && tokens[j] && EXUDE_FIELD.has(wordOf(tokens[j]))) return 'secreting';
  }

  // "secreting by <organism/body part>" — the agentive exude passive.
  if (wordOf(tokens[idx + 1]) === 'by') {
    if (EXUDE_AGENT.has(wordOf(tokens[idx + 2])) ||
        (wordOf(tokens[idx + 2]) === 'the' && EXUDE_AGENT.has(wordOf(tokens[idx + 3])))) {
      return 'secreting';
    }
  }

  // Otherwise the unmarked /ˈsiːkrətɪŋ/: concealing/stashing away.
  return 'secretting';
}
