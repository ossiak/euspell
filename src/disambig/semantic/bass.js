/**
 * Disambiguates 'bass': /bæs/ (the fish, and the proper name "Bass" → 'bass',
 * kept) vs /beɪs/ (the low musical register/voice/instrument → 'basse').
 * Corpus: disambig/bass.txt
 *
 * Purely semantic, so it scans the surrounding clause for fish vs music
 * vocabulary. The fish sense is almost always marked (caught/lake/boat/
 * largemouth/…); the proper name is capitalized; and the unmarked low-voice/
 * sound sense is the default — so the order is: name → adjacent music noun →
 * fish evidence → otherwise music.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

const tagsOf = (tok) => (tok && tok.tag ? tok.tag.split('|') : []);
const isPre = (tok, prefixes) => tagsOf(tok).some((t) => prefixes.some((p) => t.startsWith(p)));
const wordOf = (tok) => (tok?.word ?? '').toLowerCase().replace(/[.,!?;:'"]+$/, '');

// Immediately after "bass": a music head noun ("bass guitar/voice/line").
const MUSIC_HEAD = new Set([
  'voice', 'voices', 'vocal', 'vocals', 'drum', 'drums', 'note', 'notes', 'string',
  'strings', 'player', 'players', 'line', 'lines', 'clef', 'guitar', 'guitars',
  'viol', 'viola', 'fiddle', 'fiddles', 'section', 'amp', 'amplifier', 'riff',
  'riffs', 'solo', 'solos', 'chord', 'chords', 'run', 'runs', 'progression',
  'accompaniment', 'vibration', 'register', 'rumble', 'singer', 'man', 'monotone',
]);
// Immediately after "bass": a fish head noun ("bass boat/lake/fishing").
const FISH_HEAD = new Set(['boat', 'boats', 'lake', 'lakes', 'pond', 'ponds', 'fishing', 'fisherman', 'fishermen', 'fillet', 'fillets', 'stream']);
// Immediately before "bass": a fish modifier ("largemouth/sea bass").
const FISH_MOD = new Set(['largemouth', 'smallmouth', 'bigmouth', 'sea', 'striped', 'rock', 'spotted', 'peacock', 'channel', 'white', 'black', 'small']);
// Anywhere in the clause window: clear fish vocabulary.
const FISH_FIELD = new Set([
  'fish', 'fishes', 'fished', 'fishing', 'fisherman', 'fishermen', 'caught', 'catch',
  'catching', 'lake', 'lakes', 'river', 'rivers', 'pond', 'boat', 'bait', 'hook',
  'hooks', 'rod', 'rods', 'reel', 'angler', 'anglers', 'lure', 'lures', 'cast',
  'bluegill', 'bluegills', 'trout', 'perch', 'pike', 'walleye', 'crappie', 'spawn',
  'spawning', 'fillet', 'gills', 'bait',
]);
const TITLE = new Set(['mr', 'mrs', 'dr', 'miss', 'ms', 'sir', 'lord', 'lady', 'captain', 'professor', 'st', 'rev']);

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'bass' | 'basse'}
 */
export function disambiguate_bass(tokens, idx) {
  const surface = tokens[idx]?.word ?? '';
  const w1b = tokens[idx - 1];
  const w1a = tokens[idx + 1];

  // Adjacent head noun settles most cases, ahead of the name heuristic so that
  // e.g. "BASS GUITAR" in all-caps liner notes is still music.
  if (MUSIC_HEAD.has(wordOf(w1a))) return 'basse';     // "bass guitar/voice/line"
  if (FISH_HEAD.has(wordOf(w1a)) || FISH_MOD.has(wordOf(w1b))) return 'bass'; // "bass boat" / "sea bass"

  // Proper name "Bass" (Mrs./Dr./W.T. Bass, Bass Ale/Weejuns) → kept as 'bass'.
  const capitalized = /^[A-Z]/.test(surface) && idx > 0 && !tokens[idx - 1]?.breakAfter;
  if (isPre(tokens[idx], ['NP']) || capitalized || TITLE.has(wordOf(w1b))) return 'bass';

  // Otherwise look for fish vocabulary in the clause; default to the low-music sense.
  for (let j = idx - 5; j <= idx + 5; j++) {
    if (j !== idx && tokens[j] && FISH_FIELD.has(wordOf(tokens[j]))) return 'bass';
  }
  return 'basse';
}
