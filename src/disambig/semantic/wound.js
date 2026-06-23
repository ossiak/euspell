/**
 * Disambiguates 'wound': /wuːnd/ (rhymes with "tuned" → 'woond' — an injury, the
 * noun "a deep wound" / "a bullet wound", and the present-tense verb to injure)
 * vs /waʊnd/ (rhymes with "found" → 'wound' — the past tense and participle of
 * "wind": "the road wound uphill", "she wound the clock", "wound up", "wound
 * tight"). Corpus: disambig/wound.txt
 *
 * The injury sense dominates roughly two to one, and the injure verb is regular
 * (its past tense is "wounded", never "wound"), so 'woond' is the unmarked
 * default. The /waʊnd/ past-of-wind 'wound' is taken on verb evidence: the
 * phrasals "wound up/down/around/round/back/about", "wound <poss> way", "wound
 * tight/taut", a path/coil noun as subject ("the trail wound", "the cable
 * wound"), a perfect/passive auxiliary ("had/been wound"), a nominative-pronoun
 * subject ("he/she/it wound"), a transitive coil object ("wound the ribbon"), a
 * reflexive ("wound itself around"), or a following motion adverb ("wound away /
 * through / upwards"). A determiner, possessive, injury adjective, or body-part/
 * weapon compound before "wound" fixes the injury noun ("head wound", "his
 * wound", "deep wound"). The decision rests only on neighbouring words, never the
 * target's own NN1|VV0|VVD|VVN tag.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

const wordOf = (tok) => (tok?.word ?? '').toLowerCase().replace(/[.,!?;:'"]+$/, '');

// Right after "wound": phrasal particles of the past-of-wind verb. An injury
// noun is never followed by these.
const PARTICLE = new Set(['up', 'down', 'around', 'round', 'back', 'about']);

// Right after "wound": adverbs of a path/road snaking along → the verb.
const MOTION = new Set([
  'away', 'upward', 'upwards', 'downward', 'downwards', 'higher', 'deeper',
  'ever', 'through', 'along', 'onward', 'onwards', 'inward', 'outward',
]);

// Possessive determiners that precede "way" in "wound its/his/their way".
const POSS = new Set(['its', 'his', 'her', 'their', 'my', 'your', 'our']);

// Reflexives that follow the coil verb ("wound itself around", "wound themselves
// about the thorns").
const REFLEXIVE = new Set(['itself', 'themselves', 'himself', 'herself', 'myself', 'oneself']);

// Subjects that snake/coil — a path, watercourse, or flexible length. None of
// these form an "X wound" injury compound, so they fix the verb.
const PATH_SUBJECT = new Set([
  'road', 'roadway', 'roadways', 'roads', 'trail', 'trails', 'path', 'paths',
  'pathway', 'pathways', 'river', 'rivers', 'lane', 'lanes', 'tunnel', 'tunnels',
  'street', 'streets', 'valley', 'valleys', 'creek', 'corridor', 'corridors',
  'route', 'routes', 'stair', 'stairs', 'stairway', 'stairways', 'passage',
  'passages', 'track', 'tracks', 'ride', 'line', 'lines', 'scarf', 'cable',
  'cables', 'cord', 'cords', 'ribbon', 'ribbons', 'fabric', 'tape', 'rope',
  'ropes', 'wire', 'wires', 'string', 'strings', 'thread', 'threads', 'snake',
  'snakes', 'tendril', 'tendrils', 'stem', 'vine', 'vines', 'strand', 'strands',
  'tabby', 'cat',
]);

// Auxiliaries that make "wound" the past participle of "wind" ("had wound up",
// "can be wound").
const AUX = new Set(['had', 'have', 'has', 'having', 'be', 'been', "'d"]);

// Nominative pronouns as subject — "he/she/it/they wound …". The injure verb's
// past is "wounded", so these can only be past-of-wind. ("I"/"you" are excluded:
// "you wound me" could be the present injure verb; their phrasal uses are caught
// by the particle rule instead.)
const SUBJECT_PRON = new Set(['he', 'she', 'it', 'they', 'we', 'who']);

// Concrete things one coils — for the transitive "wound the ribbon / a cloth".
const COIL_OBJECT = new Set([
  'fabric', 'cloth', 'ribbon', 'ribbons', 'cord', 'cords', 'rope', 'ropes',
  'wire', 'wires', 'string', 'strings', 'thread', 'threads', 'bandage', 'cable',
  'cables', 'tape', 'scarf', 'strand', 'strands', 'hair', 'yarn', 'wool', 'chain',
  'chains', 'vine', 'vines', 'machine', 'machines', 'clock', 'clocks', 'watch',
  'spring', 'springs', 'handle', 'crank', 'key', 'car', 'power',
]);

// Premodifiers that fix the injury noun: determiners, possessives, injury
// adjectives, and body-part/weapon compounds ("head/bullet/stab wound").
const INJURY_MARKER = new Set([
  // determiners / quantifiers
  'a', 'an', 'the', 'this', 'that', 'these', 'those', 'such', 'no', 'any', 'each',
  'every', 'one', 'another', 'other', 'same', 'first', 'second', 'third', 'last',
  // possessives
  'my', 'your', 'his', 'her', 'its', 'their', 'our',
  // injury adjectives
  'deep', 'fresh', 'open', 'gaping', 'mortal', 'deadly', 'fatal', 'lethal',
  'serious', 'severe', 'grievous', 'internal', 'external', 'spiritual', 'physical',
  'superficial', 'clean', 'terrible', 'festering', 'bleeding', 'single', 'massive',
  'raw', 'bloody', 'shallow', 'old', 'huge', 'minor', 'precise', 'nasty', 'ugly',
  'crusted', 'cranial', 'spinal', 'abdominal',
  // body-part / weapon / cause compounds
  'head', 'bullet', 'gunshot', 'stab', 'flesh', 'knife', 'trident', 'death',
  'sword', 'spear', 'arrow', 'exit', 'entry', 'entrance', 'shrapnel', 'puncture',
  'war', 'battle', 'leg', 'chest', 'belly', 'neck', 'arm', 'shoulder', 'back',
  'contact', 'shotgun', 'blast', 'saber', 'sabre', 'lance', 'claw', 'bite',
]);

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'woond' | 'wound'}
 */
export function disambiguate_wound(tokens, idx) {
  const prev = wordOf(tokens[idx - 1]);
  const prev2 = wordOf(tokens[idx - 2]);
  const next = wordOf(tokens[idx + 1]);
  const next2 = wordOf(tokens[idx + 2]);
  const next3 = wordOf(tokens[idx + 3]);

  // --- Strong past-of-wind /waʊnd/ signals ('wound') ---

  // "wound up / down / around / round / back / about".
  if (PARTICLE.has(next)) return 'wound';
  // "wound its / his / their way".
  if (POSS.has(next) && next2 === 'way') return 'wound';
  // "wound tight / taut", "tightly wound".
  if (next === 'tight' || next === 'taut' || next === 'tighter') return 'wound';
  if (prev === 'tightly') return 'wound';
  // A path / watercourse / flexible length as subject: "the trail wound …".
  if (PATH_SUBJECT.has(prev)) return 'wound';
  // "the trail that wound", "valleys which wound".
  if ((prev === 'that' || prev === 'which') && PATH_SUBJECT.has(prev2)) return 'wound';
  // Perfect / passive auxiliary: "had wound", "can be wound".
  if (AUX.has(prev)) return 'wound';
  // Nominative-pronoun subject: "he/she/it/they wound …".
  if (SUBJECT_PRON.has(prev)) return 'wound';
  // Transitive coil object: "wound the ribbon", "wound a clean cloth", "wound
  // the duffel's cotton cord". The object head can sit a few words into the noun
  // phrase, so scan a short window for a coil noun.
  if (next === 'the' || next === 'a' || next === 'an' || POSS.has(next)) {
    for (let j = idx + 2; j <= idx + 5; j++) {
      if (COIL_OBJECT.has(wordOf(tokens[j]))) return 'wound';
    }
  }

  // --- Injury noun /wuːnd/ ('woond') ---

  // A determiner, possessive, injury adjective, or body-part/weapon compound
  // before "wound" fixes the injury noun ("head wound", "his wound").
  if (INJURY_MARKER.has(prev)) return 'woond';

  // --- Weaker past-of-wind signals, after the injury check ---

  // "wound itself / themselves around" — the coil verb.
  if (REFLEXIVE.has(next)) return 'wound';
  // A road snaking: "wound away / through / upwards" (also "wound steadily
  // upwards", where the motion adverb is one further on).
  if (MOTION.has(next) || MOTION.has(next2)) return 'wound';

  // Otherwise the unmarked /wuːnd/: an injury.
  return 'woond';
}
