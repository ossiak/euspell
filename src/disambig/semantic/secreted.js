/**
 * Disambiguates 'secreted': /sɪˈkriːtɪd/ (the past tense of "secrete", to exude
 * a substance → 'secreted', e.g. "mucus secreted by the gland") vs /ˈsiːkrətɪd/
 * (concealed/stashed away, from "secret" → 'secretted', e.g. "secreted the gun
 * in a drawer", "secreted himself away"). Corpus: disambig/secreted.txt
 *
 * The conceal sense dominates the data ("secreted away", "secreted X in/under/
 * about …", "secreted himself"), so 'secretted' is the unmarked default. The
 * single-t /sɪˈkriːtɪd/ exude sense is taken only on biological/discharge
 * evidence: a gland/secretion vocabulary word in the clause, or a "secreted by
 * <organism>" passive. The decision rests only on neighbouring words, never the
 * target's own JJ|VVD|VVN tag.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

const wordOf = (tok) => (tok?.word ?? '').toLowerCase().replace(/[.,!?;:'"]+$/, '');

// Biological / discharge vocabulary that marks the exude sense → /sɪˈkriːtɪd/
// ('secreted'). Kept to words that are unambiguously about producing a fluid,
// so concealable physical objects (drugs, poison, a vial) are NOT included.
const EXUDE_FIELD = new Set([
  'gland', 'glands', 'glandular', 'hormone', 'hormones', 'mucus', 'mucous', 'saliva',
  'salivary', 'enzyme', 'enzymes', 'secretion', 'secretions', 'secrete', 'secretes',
  'membrane', 'membranes', 'venom', 'resin',
  'bile', 'insulin', 'pheromone', 'pheromones', 'sebum', 'sebaceous', 'pancreas',
  'liver', 'pituitary', 'mammary', 'bloodstream', 'pore', 'pores', 'cytokine',
  'cytokines', 'allelochemical', 'alleochemical', 'digestive', 'lymph', 'nectar',
  'slime', 'ooze', 'oozed', 'oozing', 'exude', 'exuded', 'exudes', 'exuding',
  'snail', 'snails', 'larva', 'larvae', 'organ', 'organs', 'tissue', 'tissues',
]);

// Organisms/body parts that, as the agent of a "secreted by …" passive, fix the
// exude sense even without other biological vocabulary ("secreted by the trees").
const EXUDE_AGENT = new Set([
  'blood', 'body', 'skin', 'trees', 'tree', 'plant', 'plants', 'scales', 'scale',
  'glands', 'gland', 'cells', 'cell', 'snail', 'snails', 'insect', 'insects',
  'stomach', 'intestine', 'intestines', 'kidney', 'kidneys',
]);

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'secreted' | 'secretted'}
 */
export function disambiguate_secreted(tokens, idx) {
  // Biological / discharge vocabulary in the clause → the exude sense.
  for (let j = idx - 5; j <= idx + 5; j++) {
    if (j !== idx && tokens[j] && EXUDE_FIELD.has(wordOf(tokens[j]))) return 'secreted';
  }

  // "secreted by <organism/body part>" — the agentive exude passive.
  if (wordOf(tokens[idx + 1]) === 'by') {
    if (EXUDE_AGENT.has(wordOf(tokens[idx + 2])) ||
        (wordOf(tokens[idx + 2]) === 'the' && EXUDE_AGENT.has(wordOf(tokens[idx + 3])))) {
      return 'secreted';
    }
  }

  // Otherwise the unmarked /ˈsiːkrətɪd/: concealed/stashed away.
  return 'secretted';
}
