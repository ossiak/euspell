/**
 * Disambiguates 'debouches' (encoding 113, NN2|VVZ) three ways:
 *   debooshehs — /ˌdeɪbuːˈʃeɪz/ plural of the French noun *débouché*: a way out
 *                for something that needs one — a market for goods, an opening
 *                for a career, a release for feeling ("career debouches")
 *   debouqhes  — /dɪˈbaʊtʃɪz/  plural of the English noun *debouch*: a narrow
 *                exit from a defile or pass
 *   debouqhez  — /dɪˈbaʊtʃɪz/  the 3rd-person-singular present verb ("the river
 *                debouches into the plain")
 * Corpus: disambig/debouches.txt
 *
 * Two axes, as in leads.js: verb vs. noun (the NN2|VVZ diatone), and — within
 * the noun — the French /buːˈʃeɪ/ sense against the anglicised /ˈbaʊtʃ/ one.
 * Only the second is pronunciation-critical: debouqhes and debouqhez are
 * homophones, so a wrong is_VVZ guess is an orthographic slip, while a wrong
 * sense is a mispronounced word. The rule therefore spends its evidence on the
 * sense and lets the ending look after itself.
 *
 * **Written with its accents, this word never arrives here.** *débouchés* is
 * bridged straight to debooshehs by data/euspell_lexicon_accents.csv, which
 * pins it — all 100 sentences of the debooshehs corpus resolve that way without
 * consulting this file. What is left for the rule is the unaccented spelling,
 * where the accent that would have settled the sense is exactly what is
 * missing.
 *
 * Order of evidence, strongest first: the emergence frame (see EMERGES), then
 * the sense fields, then is_VVZ, then the anglicised plural as the unmarked
 * default. Terrain and troops veto the French reading — a gap in the ground is
 * the anglicised noun however commercial the traffic through it ("the river's
 * rocky debouches ... for commercial vessels") — unless a modifier on the word
 * itself names the outlet.
 *
 * Scored over the 300 labelled sentences in disambig/debouches.txt, 100 per
 * reading:
 *
 *     gold \ predicted   debooshehs  debouqhes  debouqhez
 *     debooshehs                 69         23          8
 *     debouqhes                   1         91          8
 *     debouqhez                   0          2         98      = 86%
 *
 * **The debooshehs row is at its ceiling, not short of it.** Twenty-three of
 * its misses are terrain sentences whose de-accented form is word-for-word the
 * kind of sentence the debouqhes corpus is made of — "the narrow canyon
 * debouches" against "the narrow debouches of the canyon". Nothing separates
 * them once the accent is gone, and debouqhes is the right tie-break: an
 * unaccented spelling in that company is the anglicised noun. The accented
 * spelling, which is how anyone writing the French word actually writes it,
 * is already answered by the map and never gets here.
 *
 * The decision rests only on neighbouring words, never the target's own NN2|VVZ
 * tag.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

import { is_VVZ } from '../pos.js';

const wordOf = (tok) => (tok?.word ?? '').toLowerCase().replace(/[.,!?;:'"]+$/, '');

// Terrain and troops — the company the anglicised noun keeps. Used as a veto on
// the French reading rather than as evidence for itself, because these
// sentences frequently carry a commerce word too ("navigation hazardous for
// commercial vessels") without being about commerce.
const TERRAIN_FIELD = new Set([
  'mountain', 'mountains', 'canyon', 'canyons', 'valley', 'valleys', 'gorge',
  'gorges', 'defile', 'defiles', 'pass', 'passes', 'ravine', 'river', 'rivers',
  'delta', 'deltas', 'stream', 'streams', 'creek', 'forest', 'forests',
  'terrain', 'escarpment', 'plain', 'plains', 'coastal', 'glacial',
  'meltwater', 'rock', 'rocky', 'drainage', 'waterways', 'confluence', 'ford',
  'estuary', 'headland', 'troops', 'cavalry', 'infantry', 'artillery',
  'brigade', 'battalion', 'army', 'enemy', 'soldiers', 'commanders',
  'reconnaissance', 'garrison', 'fortifications', 'fortified', 'outposts',
  'ambush', 'ambushes', 'assault', 'invasion', 'naval', 'fleet', 'blockading',
  'landmines', 'armored', 'armoured', 'vanguard', 'herders', 'navigation',
  'navigable', 'scouting', 'flank', 'bottleneck', 'columns', 'aerial',
]);

// The abstract outlet in its three habitats: a market for goods, an opening for
// a career, a release for feeling or invention. French *débouché* runs through
// all three — a way out for something that needs one — so they are one set
// rather than three.
const OUTLET_FIELD = new Set([
  // a market for goods
  'market', 'markets', 'marketplaces', 'trade', 'commerce', 'commercial',
  'goods', 'wares', 'produce', 'product', 'products', 'export', 'exports',
  'exporters', 'import', 'imports', 'manufactures', 'manufacturers',
  'manufacturing', 'merchandise', 'surplus', 'demand', 'industry',
  'industries', 'industrial', 'commodities', 'buyers', 'customers',
  'consumer', 'sell', 'selling', 'sold', 'sales', 'retail', 'distribution',
  'shipping', 'revenue', 'brand', 'brands', 'inventory', 'stock', 'wineries',
  'textile', 'economic', 'tariff', 'merchant', 'enterprises', 'startup',
  'corporate', 'wealth', 'philanthropic', 'domestic', 'overseas', 'zones',
  'electronics', 'delegation', 'technology',
  // an opening for a career
  'career', 'careers', 'employment', 'job', 'jobs', 'occupational',
  'professional', 'vocational', 'graduates', 'graduate', 'students',
  'student', 'university', 'universities', 'academic', 'faculty', 'alumni',
  'degree', 'degrees', 'diploma', 'doctorate', 'fellowships', 'curriculum',
  'training', 'apprenticeships', 'internships', 'counselors', 'recruiters',
  'schools', 'institute', 'institution', 'programs', 'courses',
  'certification', 'skills', 'physicians', 'engineers', 'tradespeople',
  'entrepreneurship', 'freelance', 'diplomacy', 'translation', 'regulatory',
  'operational', 'managerial', 'sustainability',
  // a release for feeling or invention
  'creative', 'artistic', 'emotional', 'psychological', 'spiritual',
  'intellectual', 'recreational', 'cultural', 'social', 'political',
  'therapy', 'expression', 'energy', 'athletes', 'musicians', 'festivals',
  'community', 'dissatisfaction', 'trauma', 'patients', 'minds',
  'individuals', 'youth', 'philosophers', 'movements', 'creators',
]);

// Where a thing debouches TO, or FROM. A river or a column debouches into,
// onto or from somewhere, and this is the word's decisive verb signal: across
// the three corpora these complements follow the target 98 times in the verb
// sentences against 7 in the two noun sets ("from" alone is 28 against 1). It
// is stronger evidence than any vocabulary field, so it is tested first.
//
// It is also evidence is_VVZ cannot supply: that test fires on only 16 of the
// 100 verb sentences, because it reads the "<det> <noun> debouches" subject as
// a noun compound — the same blind spot that makes it miss "the path leads to
// the sea" for leads.js.
//
// "for" is deliberately absent: it is the frame of the French noun ("debouches
// for graduates"), and appears after no verb in the corpus.
const EMERGES = new Set([
  'into', 'onto', 'from', 'out', 'upon', 'through', 'toward', 'towards',
  'across', 'past', 'beyond',
]);

// "debouches directly into the bay", "debouches right in front of the steps" —
// an adverb may sit between the verb and its complement.
const ADVERB_TAG = /\b(RR|RG|RL|RT|REX|RP)\b/;

// Modifiers that name which outlet is meant when they touch the word. Only
// senses that cannot describe a gap in the ground, so that a landscape noun
// elsewhere in the sentence does not overrule a modifier on the word itself.
const OUTLET_MOD = new Set([
  'commercial', 'career', 'professional', 'employment', 'job', 'occupational',
  'academic', 'creative', 'artistic', 'cultural', 'emotional', 'psychological',
  'intellectual', 'recreational', 'managerial', 'operational', 'retail',
  'export', 'economic', 'vocational', 'spiritual', 'political',
]);

/**
 * True when any of `field` appears anywhere in the target's sentence.
 *
 * The other field rules scan a fixed +/-6 (primates.js, shower.js) and that is
 * too tight here: which outlet is meant is a property of the whole sentence,
 * and the word that says so is usually its subject — "Exporters warned that
 * losing access to European debouches …" — eight or ten words back. So this
 * scan runs to the sentence boundary the tokens already carry and no further.
 * The neighbouring-word tests stay local.
 *
 * Compounds are tested part by part and a possessive is trimmed, or
 * "free-trade zones" and "the river's rocky debouches" would not match `trade`
 * and `river`.
 */
function inSentence(tokens, idx, field) {
  const hit = (tok) => wordOf(tok).replace(/['’]s$/, '').split('-')
    .some((part) => field.has(part));
  for (let j = idx - 1; j >= 0 && !tokens[j].breakAfter; j--) {
    if (hit(tokens[j])) return true;
  }
  for (let j = idx + 1; j < tokens.length && !tokens[j - 1].breakAfter; j++) {
    if (hit(tokens[j])) return true;
  }
  return false;
}

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'debooshehs' | 'debouqhes' | 'debouqhez'}
 */
export function disambiguate_debouches(tokens, idx) {
  // "the river debouches into the plain", "the regiment debouches from the
  // ravine" — the emergence frame, and the strongest evidence available. It
  // outranks the vocabulary below, so "his artistic career debouches into a
  // new period" is read as the verb it is rather than as a career opening.
  // It over-fires on the few nouns taking the same complement ("the river's
  // debouches into the delta"), which costs nothing audible: debouqhes and
  // debouqhez are homophones.
  let after = tokens[idx + 1];
  if (after && ADVERB_TAG.test(after.tag ?? '')) after = tokens[idx + 2];
  if (after && EMERGES.has(wordOf(after))) return 'debouqhez';

  // "new debouches for our manufactures", "career debouches for graduates",
  // "creative debouches for engineers" — the French noun. Terrain vetoes it,
  // unless the word is modified outright ("vital commercial debouches for
  // isolated mountain communities"): a modifier touching the word is better
  // evidence of which outlet is meant than a landscape noun elsewhere.
  const modified = OUTLET_MOD.has(wordOf(tokens[idx - 1]))
    || OUTLET_MOD.has(wordOf(tokens[idx - 2]));
  if ((modified || !inSentence(tokens, idx, TERRAIN_FIELD))
      && inSentence(tokens, idx, OUTLET_FIELD)) {
    return 'debooshehs';
  }

  // The general verb test ("it debouches", "which debouches below the ford").
  if (is_VVZ(tokens, idx)) return 'debouqhez';

  // Otherwise the anglicised plural noun: narrow exits from a defile.
  return 'debouqhes';
}
