/**
 * Registry of semantic (pronunciation) disambiguation rules, keyed by the
 * lowercase surface word. Each rule has signature (tokens, idx) and returns one
 * of the word's euspellings or null (undecidable → caller uses the default).
 *
 * Used by converter.js route() to dispatch encoding-202 words.
 */
import { disambiguate_barred } from './barred.js';
import { disambiguate_bass } from './bass.js';
import { disambiguate_beloved } from './beloved.js';
import { disambiguate_blessed } from './blessed.js';
import { disambiguate_bow } from './bow.js';
import { disambiguate_bowed } from './bowed.js';
import { disambiguate_bowing } from './bowing.js';
import { disambiguate_bowman } from './bowman.js';
import { disambiguate_bowings } from './bowings.js';
import { disambiguate_bowmen } from './bowmen.js';
import { disambiguate_bows } from './bows.js';
import { disambiguate_chi } from './chi.js';
import { disambiguate_cleanly } from './cleanly.js';
import { disambiguate_close } from './close.js';
import { disambiguate_closer } from './closer.js';
import { disambiguate_conch } from './conch.js';
import { disambiguate_copyread } from './copyread.js';
import { disambiguate_does } from './does.js';
import { disambiguate_dogged } from './dogged.js';
import { disambiguate_dove } from './dove.js';
import { disambiguate_fillet } from './fillet.js';
import { disambiguate_filleted } from './filleted.js';
import { disambiguate_filleting } from './filleting.js';
import { disambiguate_fillets } from './fillets.js';
import { disambiguate_foreread } from './foreread.js';
import { disambiguate_gets } from './gets.js';
import { disambiguate_jagged } from './jagged.js';
import { disambiguate_lead } from './lead.js';
import { disambiguate_leads } from './leads.js';
import { disambiguate_learned } from './learned.js';
import { disambiguate_longed } from './longed.js';
import { disambiguate_looks } from './looks.js';
import { disambiguate_makes } from './makes.js';
import { disambiguate_means } from './means.js';
import { disambiguate_minute } from './minute.js';
import { disambiguate_misread } from './misread.js';
import { disambiguate_moire } from './moire.js';
import { disambiguate_moires } from './moires.js';
import { disambiguate_outread } from './outread.js';
import { disambiguate_primate } from './primate.js';
import { disambiguate_primates } from './primates.js';
import { disambiguate_proofread } from './proofread.js';
import { disambiguate_putting } from './putting.js';
import { disambiguate_ragged } from './ragged.js';
import { disambiguate_read } from './read.js';
import { disambiguate_reread } from './reread.js';
import { disambiguate_row } from './row.js';
import { disambiguate_rowed } from './rowed.js';
import { disambiguate_rows } from './rows.js';
import { disambiguate_rowing } from './rowing.js';
import { disambiguate_secreted } from './secreted.js';
import { disambiguate_secreting } from './secreting.js';
import { disambiguate_shower } from './shower.js';
import { disambiguate_showers } from './showers.js';
import { disambiguate_sightread } from './sightread.js';
import { disambiguate_slough } from './slough.js';
import { disambiguate_sloughed } from './sloughed.js';
import { disambiguate_sounds } from './sounds.js';
import { disambiguate_thinks } from './thinks.js';
import { disambiguate_wants } from './wants.js';
import { disambiguate_sloughs } from './sloughs.js';
import { disambiguate_sloughier } from './sloughier.js';
import { disambiguate_sloughiest } from './sloughiest.js';
import { disambiguate_sloughiness } from './sloughiness.js';
import { disambiguate_sloughy } from './sloughy.js';
import { disambiguate_tear } from './tear.js';
import { disambiguate_tearing } from './tearing.js';
import { disambiguate_tears } from './tears.js';
import { disambiguate_unbowed } from './unbowed.js';
import { disambiguate_unbowing } from './unbowing.js';
import { disambiguate_uncleanly } from './uncleanly.js';
import { disambiguate_wicked } from './wicked.js';
import { disambiguate_wind } from './wind.js';
import { disambiguate_winding } from './winding.js';
import { disambiguate_winds } from './winds.js';
import { disambiguate_wound } from './wound.js';

/** @type {Map<string, (tokens: import('../../content/context.js').Token[], idx: number) => (string | null)>} */
export const SEMANTIC = new Map([
  ['barred', disambiguate_barred],
  ['bass', disambiguate_bass],
  ['beloved', disambiguate_beloved],
  ['blessed', disambiguate_blessed],
  ['bow', disambiguate_bow],
  ['bowed', disambiguate_bowed],
  ['bowing', disambiguate_bowing],
  ['bowman', disambiguate_bowman],
  ['bowings', disambiguate_bowings],
  ['bowmen', disambiguate_bowmen],
  ['bows', disambiguate_bows],
  ['chi', disambiguate_chi],
  ['cleanly', disambiguate_cleanly],
  ['close', disambiguate_close],
  ['closer', disambiguate_closer],
  ['conch', disambiguate_conch],
  ['copyread', disambiguate_copyread],
  ['does', disambiguate_does],
  ['dogged', disambiguate_dogged],
  ['dove', disambiguate_dove],
  ['fillet', disambiguate_fillet],
  ['filleted', disambiguate_filleted],
  ['filleting', disambiguate_filleting],
  ['fillets', disambiguate_fillets],
  ['foreread', disambiguate_foreread],
  ['gets', disambiguate_gets],
  ['jagged', disambiguate_jagged],
  ['lead', disambiguate_lead],
  ['leads', disambiguate_leads],
  ['learned', disambiguate_learned],
  ['longed', disambiguate_longed],
  ['looks', disambiguate_looks],
  ['makes', disambiguate_makes],
  ['means', disambiguate_means],
  ['minute', disambiguate_minute],
  ['misread', disambiguate_misread],
  ['moire', disambiguate_moire],
  ['moires', disambiguate_moires],
  ['outread', disambiguate_outread],
  ['primate', disambiguate_primate],
  ['primates', disambiguate_primates],
  ['proofread', disambiguate_proofread],
  ['putting', disambiguate_putting],
  ['ragged', disambiguate_ragged],
  ['read', disambiguate_read],
  ['reread', disambiguate_reread],
  ['row', disambiguate_row],
  ['rowed', disambiguate_rowed],
  ['rows', disambiguate_rows],
  ['rowing', disambiguate_rowing],
  ['secreted', disambiguate_secreted],
  ['secreting', disambiguate_secreting],
  ['shower', disambiguate_shower],
  ['showers', disambiguate_showers],
  ['sightread', disambiguate_sightread],
  ['slough', disambiguate_slough],
  ['sloughed', disambiguate_sloughed],
  ['sloughier', disambiguate_sloughier],
  ['sloughiest', disambiguate_sloughiest],
  ['sloughiness', disambiguate_sloughiness],
  ['sloughs', disambiguate_sloughs],
  ['sloughy', disambiguate_sloughy],
  ['sounds', disambiguate_sounds],
  ['tear', disambiguate_tear],
  ['tearing', disambiguate_tearing],
  ['tears', disambiguate_tears],
  ['thinks', disambiguate_thinks],
  ['unbowed', disambiguate_unbowed],
  ['unbowing', disambiguate_unbowing],
  ['uncleanly', disambiguate_uncleanly],
  ['wants', disambiguate_wants],
  ['wicked', disambiguate_wicked],
  ['wind', disambiguate_wind],
  ['winding', disambiguate_winding],
  ['winds', disambiguate_winds],
  ['wound', disambiguate_wound],
]);
