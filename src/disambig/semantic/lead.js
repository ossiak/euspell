/**
 * Disambiguates 'lead': /liːd/ (rhymes with "seed" → 'lead' — the verb to guide,
 * and the nouns the lead/first position, a lead singer/role, a clue/lead, a dog's
 * lead) vs /lɛd/ (rhymes with "bed" → 'ledd' — the metal Pb: lead pipe, lead
 * paint, pencil lead, "heavy as lead"). Corpus: disambig/lead.txt
 *
 * The guide verb and the "first/foremost" nouns dominate, so 'lead' is the
 * unmarked default. 'ledd' is the metal, taken only with metal evidence: a metal
 * head noun ("lead pipe/paint/bullets"), a metal modifier ("molten/sheet/pencil
 * lead"), metallurgy vocabulary in the clause (smelt, ore, poisoning), or a
 * heaviness simile ("like lead", "heavy as lead"). The decision rests only on
 * neighbouring words, never the target's own NN|NN1|VV0 tag.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

const wordOf = (tok) => (tok?.word ?? '').toLowerCase().replace(/[.,!?;:'"]+$/, '');

// Immediately after "lead": a head noun that names a thing made of the metal Pb.
const METAL_HEAD = new Set([
  'pipe', 'pipes', 'piping', 'paint', 'painted', 'poisoning', 'bullet', 'bullets',
  'shot', 'slug', 'slugs', 'weight', 'weights', 'solder', 'crystal', 'sinker',
  'sinkers', 'apron', 'aprons', 'foil', 'acetate', 'ball', 'balls', 'roof',
  'roofing', 'lining', 'casket', 'coffin', 'oxide', 'ore', 'glaze', 'sheath',
  'sheathing', 'plate', 'plating', 'shielding', 'pellets', 'pellet', 'projectile',
  'projectiles',
]);

// Immediately before "lead": a modifier that fixes the metal sense.
const METAL_MOD = new Set([
  'molten', 'sheet', 'pencil', 'leaded', 'powdered', 'tetraethyl', 'white', 'red',
  'sheets', 'block', 'cold',
]);

// Anywhere in the clause window: metallurgy / metal vocabulary.
const METAL_FIELD = new Set([
  'smelt', 'smelted', 'smelting', 'mine', 'mined', 'mines', 'mining', 'foundry',
  'poisoning', 'toxic', 'alchemy', 'alchemist', 'alchemists', 'solder', 'soldering',
  'pewter', 'antimony', 'tetraethyl', 'leaden', 'musket', 'muskets', 'ingot',
  'ingots', 'molten', 'ore',
]);

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'ledd' | 'lead'}
 */
export function disambiguate_lead(tokens, idx) {
  const prev = wordOf(tokens[idx - 1]);
  const prev2 = wordOf(tokens[idx - 2]);
  const next = wordOf(tokens[idx + 1]);

  // Metal head noun ("lead pipe") or metal modifier ("molten lead") → /lɛd/.
  if (METAL_HEAD.has(next)) return 'ledd';
  if (METAL_MOD.has(prev)) return 'ledd';

  // Heaviness simile: "like lead", "like a lead (weight)", "as heavy as lead".
  if (prev === 'like' || (prev === 'a' && prev2 === 'like') || prev2 === 'heavy' || prev2 === 'heavier') {
    return 'ledd';
  }

  // Metallurgy / metal vocabulary anywhere in the clause → /lɛd/.
  for (let j = idx - 4; j <= idx + 4; j++) {
    if (j !== idx && tokens[j] && METAL_FIELD.has(wordOf(tokens[j]))) return 'ledd';
  }

  // Otherwise the unmarked /liːd/: the guide verb or the "first/foremost" noun.
  return 'lead';
}
