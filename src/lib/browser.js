// Cross-browser WebExtension API handle. Firefox exposes the standard,
// promise-based `browser` namespace; Chrome/Chromium expose `chrome` (which is
// also promise-based under Manifest V3). Preferring `browser` gives promise
// semantics on both engines, so `await`-ing these calls works everywhere — a
// bare `chrome.*` on Firefox is callback-style and would resolve to undefined.
export const browser = globalThis.browser ?? globalThis.chrome;
