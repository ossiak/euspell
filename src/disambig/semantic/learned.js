/**
 * Disambiguates 'learned': /ˈlɜːnɪd/ (2-syllable adjective meaning erudite →
 * 'lerned', e.g. "a learned scholar", "my learned friend") vs /lɜːnd/
 * (1-syllable past tense/participle verb → 'lernd', e.g. "I learned", "was
 * learned by heart"). Corpus: disambig/learned.txt
 *
 * The split is semantic, not grammatical: only the erudite/scholarly meaning is
 * /ˈlɜːnɪd/. The past tense, the passive ("was learned"), and even attributive
 * *acquired* uses ("learned behavior", "learned conventions") are all /lɜːnd/.
 * So the gold JJ tag does not settle the pronunciation, and the verb sense
 * overwhelmingly dominates — 'lernd' is the unmarked default. 'lerned' is taken
 * only on erudite evidence: an erudite head noun right after ("learned
 * scholar/judge/society"), or an erudite intensifier just before ("most/widely
 * learned"). The decision rests only on neighbouring words, never the target's
 * own JJ|VVD|VVN tag.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

const wordOf = (tok) => (tok?.word ?? '').toLowerCase().replace(/[.,!?;:'"]+$/, '');

// Immediately after "learned": an erudite person or scholarly work, marking the
// /ˈlɜːnɪd/ adjective ("learned scholar", "my learned friend", "learned journal").
const ERUDITE_HEAD = new Set([
  'scholar', 'scholars', 'professor', 'professors', 'doctor', 'doctors', 'judge',
  'judges', 'justice', 'justices', 'counsel', 'friend', 'friends', 'colleague',
  'colleagues', 'gentleman', 'gentlemen', 'man', 'men', 'lady', 'ladies', 'society',
  'societies', 'journal', 'journals', 'treatise', 'treatises', 'discourse',
  'discourses', 'dissertation', 'dissertations', 'tome', 'tomes', 'author',
  'authors', 'body', 'profession', 'elder', 'elders', 'sage', 'sages', 'rabbi',
  'rabbis', 'divine', 'clerk', 'clerks', 'brother', 'brethren', 'jurist', 'jurists',
  'council', 'academy', 'pundit', 'pundits', 'pedant', 'pedants', 'doctors',
  'physician', 'physicians', 'theologian', 'theologians', 'scribe', 'scribes',
]);

// Immediately before "learned": an intensifier specific to eruditeness, marking
// the /ˈlɜːnɪd/ adjective even predicatively ("most learned", "profoundly learned").
const ERUDITE_BEFORE = new Set([
  'most', 'widely', 'profoundly', 'immensely', 'prodigiously', 'vastly', 'erudite',
  'exceedingly', 'remarkably', 'famously', 'reputedly',
]);

// Quality adjectives that, coordinated with "learned" ("wise and learned",
// "learned and pious"), mark it as the erudite adjective describing a person.
const ERUDITE_COORD = new Set([
  'wise', 'scholarly', 'erudite', 'cultured', 'eloquent', 'distinguished',
  'venerable', 'pious', 'noble', 'gentle', 'clever', 'brilliant', 'devout',
  'respected', 'eminent', 'lovely', 'godly', 'holy', 'sober', 'gifted', 'wittier',
  'witty', 'cultivated', 'refined', 'studious', 'bookish',
]);

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'lerned' | 'lernd'}
 */
export function disambiguate_learned(tokens, idx) {
  // An erudite head noun right after, or an erudite intensifier just before,
  // marks the scholarly adjective /ˈlɜːnɪd/ ('lerned').
  if (ERUDITE_HEAD.has(wordOf(tokens[idx + 1]))) return 'lerned';
  if (ERUDITE_BEFORE.has(wordOf(tokens[idx - 1]))) return 'lerned';

  // Coordinated with a quality adjective ("lovely and learned", "learned and
  // wise") — the erudite adjective describing a person.
  if (wordOf(tokens[idx - 1]) === 'and' && ERUDITE_COORD.has(wordOf(tokens[idx - 2]))) return 'lerned';
  if (wordOf(tokens[idx + 1]) === 'and' && ERUDITE_COORD.has(wordOf(tokens[idx + 2]))) return 'lerned';

  // Otherwise the unmarked /lɜːnd/: the past tense / participle verb.
  return 'lernd';
}
