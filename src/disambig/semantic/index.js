/**
 * Registry of semantic (pronunciation) disambiguation rules, keyed by the
 * lowercase surface word. Each rule has signature (tokens, idx) and returns one
 * of the word's euspellings or null (undecidable → caller uses the default).
 *
 * Used by converter.js route() to dispatch encoding-202 words.
 */
import { disambiguate_bass } from './bass.js';
import { disambiguate_beloved } from './beloved.js';
import { disambiguate_blessed } from './blessed.js';
import { disambiguate_bow } from './bow.js';
import { disambiguate_bowed } from './bowed.js';
import { disambiguate_bowing } from './bowing.js';
import { disambiguate_bowman } from './bowman.js';
import { disambiguate_bowmen } from './bowmen.js';
import { disambiguate_chi } from './chi.js';
import { disambiguate_cleanly } from './cleanly.js';
import { disambiguate_close } from './close.js';
import { disambiguate_closer } from './closer.js';
import { disambiguate_copyread } from './copyread.js';
import { disambiguate_does } from './does.js';
import { disambiguate_dogged } from './dogged.js';
import { disambiguate_dove } from './dove.js';
import { disambiguate_foreread } from './foreread.js';
import { disambiguate_jagged } from './jagged.js';
import { disambiguate_lead } from './lead.js';
import { disambiguate_learned } from './learned.js';
import { disambiguate_minute } from './minute.js';
import { disambiguate_misread } from './misread.js';
import { disambiguate_outread } from './outread.js';
import { disambiguate_primate } from './primate.js';
import { disambiguate_primates } from './primates.js';
import { disambiguate_proofread } from './proofread.js';
import { disambiguate_read } from './read.js';
import { disambiguate_reread } from './reread.js';
import { disambiguate_row } from './row.js';
import { disambiguate_rowed } from './rowed.js';
import { disambiguate_rowing } from './rowing.js';
import { disambiguate_secreted } from './secreted.js';
import { disambiguate_secreting } from './secreting.js';
import { disambiguate_shower } from './shower.js';
import { disambiguate_sightread } from './sightread.js';
import { disambiguate_slough } from './slough.js';
import { disambiguate_sloughed } from './sloughed.js';
import { disambiguate_sloughier } from './sloughier.js';
import { disambiguate_sloughiest } from './sloughiest.js';
import { disambiguate_sloughiness } from './sloughiness.js';
import { disambiguate_sloughy } from './sloughy.js';
import { disambiguate_tear } from './tear.js';
import { disambiguate_tearing } from './tearing.js';
import { disambiguate_wicked } from './wicked.js';
import { disambiguate_wind } from './wind.js';
import { disambiguate_winding } from './winding.js';
import { disambiguate_wound } from './wound.js';

/** @type {Map<string, (tokens: import('../../content/context.js').Token[], idx: number) => (string | null)>} */
export const SEMANTIC = new Map([
  ['bass', disambiguate_bass],
  ['beloved', disambiguate_beloved],
  ['blessed', disambiguate_blessed],
  ['bow', disambiguate_bow],
  ['bowed', disambiguate_bowed],
  ['bowing', disambiguate_bowing],
  ['bowman', disambiguate_bowman],
  ['bowmen', disambiguate_bowmen],
  ['chi', disambiguate_chi],
  ['cleanly', disambiguate_cleanly],
  ['close', disambiguate_close],
  ['closer', disambiguate_closer],
  ['copyread', disambiguate_copyread],
  ['does', disambiguate_does],
  ['dogged', disambiguate_dogged],
  ['dove', disambiguate_dove],
  ['foreread', disambiguate_foreread],
  ['jagged', disambiguate_jagged],
  ['lead', disambiguate_lead],
  ['learned', disambiguate_learned],
  ['minute', disambiguate_minute],
  ['misread', disambiguate_misread],
  ['outread', disambiguate_outread],
  ['primate', disambiguate_primate],
  ['primates', disambiguate_primates],
  ['proofread', disambiguate_proofread],
  ['read', disambiguate_read],
  ['reread', disambiguate_reread],
  ['row', disambiguate_row],
  ['rowed', disambiguate_rowed],
  ['rowing', disambiguate_rowing],
  ['secreted', disambiguate_secreted],
  ['secreting', disambiguate_secreting],
  ['shower', disambiguate_shower],
  ['sightread', disambiguate_sightread],
  ['slough', disambiguate_slough],
  ['sloughed', disambiguate_sloughed],
  ['sloughier', disambiguate_sloughier],
  ['sloughiest', disambiguate_sloughiest],
  ['sloughiness', disambiguate_sloughiness],
  ['sloughy', disambiguate_sloughy],
  ['tear', disambiguate_tear],
  ['tearing', disambiguate_tearing],
  ['wicked', disambiguate_wicked],
  ['wind', disambiguate_wind],
  ['winding', disambiguate_winding],
  ['wound', disambiguate_wound],
]);
