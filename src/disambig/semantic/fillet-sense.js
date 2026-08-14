/**
 * Shared sense classifier for the 'fillet' family (fillet, fillets, filleted,
 * filleting). All four split along one axis, and it is the only axis that
 * changes the pronunciation:
 *   meat    — /fɪˈleɪ/  a boneless cut of fish or meat, and the verb for cutting
 *                       one ('filleh…')
 *   machine — /ˈfɪlɪt/  the engineering sense: a rounded internal corner, a
 *                       fillet weld, and the architectural narrow band, which
 *                       keeps the traditional spelling ('fillet…')
 *
 * Unusually for this directory the two senses share almost no vocabulary — a
 * kitchen and a machine shop — so a topical field scan separates them cleanly
 * and no fallback per caller is needed. The meat sense is far commoner in
 * general prose, so it is the unmarked default and the machine sense is taken
 * only on positive evidence. Words that plausibly belong to both ('plate',
 * 'surface', 'trim') are deliberately in neither set. The decision rests only on
 * neighbouring words, never on the target's own tag.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

const wordOf = (tok) => (tok?.word ?? '').toLowerCase().replace(/[.,!?;:'"]+$/, '');

// Immediately after "fillet": an engineering head noun ("fillet weld/radius").
const MACHINE_HEAD = new Set([
  'weld', 'welds', 'welded', 'welding', 'radius', 'radii', 'radiused', 'joint',
  'joints', 'geometry', 'curve', 'curves', 'arc', 'arcs', 'tool', 'tools',
  'feature', 'features', 'operation', 'moulding', 'molding', 'mouldings',
  'moldings', 'cornice', 'cornices',
]);
// Immediately before "fillet": an engineering modifier ("concave/weld fillet").
const MACHINE_MOD = new Set([
  'concave', 'convex', 'weld', 'welded', 'internal', 'external', 'rounded',
  'corner', 'root', 'toe', 'variable', 'constant', 'tangent',
]);
// Anywhere in the clause window: unambiguous engineering or architectural
// vocabulary. 'plate', 'surface' and 'trim' are excluded — a kitchen has those.
const MACHINE_FIELD = new Set([
  'cad', 'autocad', 'solidworks', 'catia', 'inventor', 'chamfer', 'chamfers',
  'chamfered', 'weld', 'welds', 'welded', 'welding', 'weldment', 'radius',
  'radii', 'geometry', 'geometric', 'sketch', 'extrude', 'extrusion', 'mesh',
  'machining', 'machined', 'milled', 'milling', 'lathe', 'casting', 'castings',
  'flange', 'flanges', 'gusset', 'gussets', 'bracket', 'brackets', 'beam',
  'beams', 'stress', 'stresses', 'fatigue', 'tangent', 'blend', 'blends',
  'toolpath', 'engineering', 'mechanical', 'structural', 'cross-section',
  'cornice', 'architrave', 'moulding', 'molding', 'pilaster',
]);

// Immediately after "fillet": a food head noun ("fillet steak/mignon/knife").
const MEAT_HEAD = new Set(['steak', 'steaks', 'mignon', 'knife', 'knives', 'roast', 'roasts']);
// Immediately before "fillet": the animal or cut ("salmon/beef fillet").
const MEAT_MOD = new Set([
  'salmon', 'cod', 'haddock', 'sole', 'trout', 'tuna', 'halibut', 'plaice',
  'mackerel', 'herring', 'anchovy', 'snapper', 'tilapia', 'catfish', 'perch',
  'pollock', 'beef', 'pork', 'chicken', 'lamb', 'veal', 'turkey', 'duck',
  'venison', 'tenderloin', 'sirloin', 'breast',
]);
// Anywhere in the clause window: kitchen and menu vocabulary.
const MEAT_FIELD = new Set([
  'cook', 'cooks', 'cooked', 'cooking', 'grill', 'grilled', 'grilling', 'fry',
  'fried', 'frying', 'pan', 'bake', 'baked', 'baking', 'roast', 'roasted',
  'poach', 'poached', 'sear', 'seared', 'season', 'seasoned', 'seasoning',
  'marinade', 'marinated', 'sauce', 'sauces', 'dish', 'dishes', 'menu', 'menus',
  'recipe', 'recipes', 'dinner', 'lunch', 'supper', 'meal', 'meat', 'meats',
  'boneless', 'skinless', 'bone', 'bones', 'butcher', 'chef', 'kitchen', 'oven',
  'skillet', 'serve', 'served', 'serving', 'eat', 'ate', 'eaten', 'delicious',
  'tender', 'juicy', 'fish', 'salmon', 'cod', 'beef', 'steak', 'mignon',
  'restaurant', 'garlic', 'butter', 'lemon', 'olive', 'pepper', 'salt', 'herbs',
]);

/**
 * True when the surrounding clause marks the engineering/architectural sense.
 * @param {Token[]} tokens
 * @param {number} idx
 */
export function isMachineFillet(tokens, idx) {
  const before = wordOf(tokens[idx - 1]);
  const after = wordOf(tokens[idx + 1]);

  // An adjacent head noun or modifier settles it, either way, before any scan.
  if (MACHINE_HEAD.has(after) || MACHINE_MOD.has(before)) return true;
  if (MEAT_HEAD.has(after) || MEAT_MOD.has(before)) return false;

  // Otherwise the clause decides, and the nearer field wins so that a passage
  // mentioning both ("weld the bracket, then eat") is not settled by whichever
  // set happens to be scanned first.
  for (let d = 1; d <= 5; d++) {
    for (const j of [idx - d, idx + d]) {
      const w = tokens[j] && wordOf(tokens[j]);
      if (!w) continue;
      if (MACHINE_FIELD.has(w)) return true;
      if (MEAT_FIELD.has(w)) return false;
    }
  }
  return false; // unmarked: the food sense
}
