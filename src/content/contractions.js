import { data as contractions } from '../../dist/contractions.js';

/** Normalises curly apostrophes to straight so lookups match the data keys. */
export function normalizeApostrophes(word) {
  return word.replace(/[’ʼ]/g, "'");
}

// Case- and apostrophe-normalised view of the contractions map, so surface
// forms like "I'll" or curly "don’t" still resolve.
const byKey = new Map();
for (const [key, entry] of contractions) {
  byKey.set(normalizeApostrophes(key).toLowerCase(), entry);
}

/** Returns the contraction entry for `word` (any case/apostrophe), or undefined. */
export function getContraction(word) {
  return byKey.get(normalizeApostrophes(word).toLowerCase());
}

/** True if `word` is a known contraction surface form. */
export function isContraction(word) {
  return byKey.has(normalizeApostrophes(word).toLowerCase());
}

/**
 * Component PoS analysis of a contraction: one entry per sequence position,
 * each a pipe-joined union of the CLAWS7 tags that position can take across all
 * alternative readings. Returns [] for a non-contraction or an untagged one.
 *
 *   "anybody's" (PoS "PN1 GE|PN1 VBZ|PN1 VHZ") -> ['PN1', 'GE|VBZ|VHZ']
 *   "don't"     (PoS "VD0 XX")                 -> ['VD0', 'XX']
 *   "'s"        (PoS "GE|VBDZ|VBZ|VDZ|VHZ")    -> ['GE|VBDZ|VBZ|VDZ|VHZ']
 */
export function contractionComponents(word) {
  const entry = getContraction(word);
  return entry ? componentTags(entry.pos) : [];
}

/**
 * @param {string[]} alternatives  entry.pos — each element a space-separated
 *   CLAWS7 sequence (one analysis); the array is the set of analyses.
 * @returns {string[]} per-position tag unions
 */
function componentTags(alternatives) {
  const seqs = alternatives.map((a) => a.trim().split(/\s+/).filter(Boolean));
  const width = Math.max(0, ...seqs.map((s) => s.length));
  const positions = Array.from({ length: width }, () => new Set());
  for (const seq of seqs) seq.forEach((tag, i) => positions[i].add(tag));
  return positions.map((set) => [...set].join('|'));
}
