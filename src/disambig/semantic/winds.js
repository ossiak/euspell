/**
 * Disambiguates 'winds' (encoding 113, NN2|VVZ) three ways:
 *   winds — /wɪndz/ plural noun: moving air ("the trade winds", "strong winds")
 *   windz — /wɪndz/ the 3rd-sg verb of /wɪnd/ — to wind a baby (burp), to wind
 *           someone (knock the breath out)
 *   wyndz — /waɪndz/ the 3rd-sg verb of /waɪnd/ — to coil/turn: "the road winds",
 *           "winds up the clock", "winds its way", "winds down"
 * Corpus: disambig/winds.txt
 *
 * Two axes: verb vs. noun (the NN2|VVZ diatone), and — among verbs — the coil
 * /waɪnd/ vs. the breath /wɪnd/ senses. Only the coil verb changes the vowel
 * (winds the noun and windz the breath verb are homophones, /wɪndz/), so it is
 * the pronunciation-critical reading. The air noun dominates the data, so 'winds'
 * is the default; 'wyndz' is taken on coil evidence — a path/watercourse subject,
 * a 3rd-sg subject pronoun, the phrasals "winds up/down/around", "winds its way",
 * or a transitive coil object — with a noun premodifier (article, possessive,
 * wind adjective) suppressing those, as in wind.js. The rare breath verb is taken
 * only on "winds the baby". The decision rests only on neighbouring words, never
 * the target's own NN2|VVZ tag.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

import { NOUN_MARKER, COIL_OBJECT } from './wind.js';

const wordOf = (tok) => (tok?.word ?? '').toLowerCase().replace(/[.,!?;:'"]+$/, '');

// Subjects that snake/coil — a path, watercourse, or flexible length. None form
// an "X winds" air-noun compound, so they fix the coil verb.
const PATH_SUBJECT = new Set([
  'road', 'roads', 'roadway', 'highway', 'street', 'streets', 'lane', 'lanes',
  'path', 'paths', 'pathway', 'trail', 'trails', 'track', 'tracks', 'route',
  'river', 'rivers', 'stream', 'streams', 'brook', 'creek', 'estuary', 'coastline',
  'shoreline', 'staircase', 'stair', 'stairs', 'stairway', 'corridor', 'corridors',
  'passage', 'passageway', 'tunnel', 'queue', 'line', 'column', 'procession',
  'ribbon', 'snake', 'serpent', 'string', 'thread', 'wire', 'cable', 'rope',
  'smoke', 'vine', 'ivy', 'crack', 'crevice', 'scar',
]);

// 3rd-singular subject pronouns/relatives that can only be a verb's subject —
// a plural noun "winds" never follows these.
const SUBJECT_3SG = new Set(['it', 'he', 'she']);

// Possessives before "way" in "winds its/his/their way".
const POSS = new Set(['its', 'his', 'her', 'their', 'my', 'your', 'our']);

// Phrasal particles of the coil verb ("winds up/down/back/around").
const PARTICLE = new Set(['up', 'down', 'back', 'around', 'round']);

// Verbs of moving air — if one follows "winds", then "winds" is the plural-noun
// subject ("the Gulf Stream winds kick…"), not the coil verb, even after a word
// that can otherwise be a path subject ("stream").
const WIND_VERB = new Set([
  'blow', 'blew', 'blowing', 'blows', 'howl', 'howled', 'howling', 'howls',
  'kick', 'kicked', 'kicks', 'sweep', 'swept', 'sweeping', 'sweeps', 'gust',
  'gusted', 'gusting', 'gusts', 'buffet', 'buffeted', 'rage', 'raged', 'whip',
  'whipped', 'whipping', 'rose', 'rise', 'died', 'die', 'picked', 'carried',
  'carry', 'stir', 'stirred', 'roar', 'roared', 'moaned', 'wailed', 'screamed',
  'rattled', 'tore', 'tugged', 'scoured', 'lashed',
]);

// Things a baby-burping / breath-knocking "winds" takes as object → /wɪndz/.
const BREATH_OBJECT = new Set(['baby', 'babies', 'infant', 'newborn']);

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'winds' | 'windz' | 'wyndz'}
 */
export function disambiguate_winds(tokens, idx) {
  const prev = wordOf(tokens[idx - 1]);
  const prev2 = wordOf(tokens[idx - 2]);
  const next = wordOf(tokens[idx + 1]);
  const next2 = wordOf(tokens[idx + 2]);

  // A path/watercourse subject → the coil verb /waɪndz/. Checked before the noun
  // guard so "the road winds" beats the article — but not "Gulf Stream winds
  // kick", where a wind-verb after marks "winds" as the noun subject.
  if (!WIND_VERB.has(next)) {
    if (PATH_SUBJECT.has(prev)) return 'wyndz';
    if ((prev === 'that' || prev === 'which') && PATH_SUBJECT.has(prev2)) return 'wyndz';
  }

  // "winds its / his / their way" — the coil verb.
  if (POSS.has(next) && next2 === 'way') return 'wyndz';

  // A 3rd-sg subject pronoun → a verb. "winds the baby" is the breath /wɪndz/;
  // anything else is the coil /waɪndz/.
  if (SUBJECT_3SG.has(prev)) {
    if ((next === 'the' || next === 'a') && BREATH_OBJECT.has(next2)) return 'windz';
    return 'wyndz';
  }

  // A noun premodifier (article, possessive, wind adjective) fixes the air noun
  // /wɪndz/ and suppresses the phrasal/transitive coil rules below.
  if (NOUN_MARKER.has(prev)) return 'winds';

  // Phrasal "winds up / down / around", and transitive "winds the clock".
  if (PARTICLE.has(next)) return 'wyndz';
  if ((next === 'the' || next === 'a' || POSS.has(next)) && COIL_OBJECT.has(next2)) {
    return 'wyndz';
  }

  // Otherwise the unmarked /wɪndz/ noun: moving air.
  return 'winds';
}
