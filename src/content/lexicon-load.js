// Fetches the lexicon at runtime and installs it, for bundles built against the
// runtime lexicon source (lexicon-source.runtime.js via the rollup alias). The
// table ships once as the web-accessible resource dist/lexicon.data — a JSON
// [key, entry] array — instead of being inlined into both the content-script and
// PDF-viewer bundles.
//
// The import below resolves to lexicon-source.runtime.js under the alias, so
// setLexicon() here and lookupEntry() in converter.js/tagger.js share the same
// module state. Callers must await ensureLexicon() before converting anything;
// the fetch is memoised, so repeated calls (and both consumers) share one load.
import { setLexicon } from './lexicon-source.js';
import { browser } from '../lib/browser.js';

/** @type {Promise<void> | null} */
let loading = null;

/**
 * Load dist/lexicon.data once and install it as the active lexicon. Idempotent:
 * the first call starts the fetch, later calls await the same promise.
 * @returns {Promise<void>}
 */
export function ensureLexicon() {
  if (!loading) {
    const url = browser.runtime.getURL('dist/lexicon.data');
    loading = fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`lexicon fetch failed: ${res.status}`);
        return res.json();
      })
      .then((entries) => {
        setLexicon(new Map(entries));
      })
      .catch((err) => {
        // Reset so a transient failure can be retried on the next call; until a
        // load succeeds, lookups miss and text passes through unchanged.
        loading = null;
        throw err;
      });
  }
  return loading;
}
