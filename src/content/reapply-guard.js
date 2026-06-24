/**
 * Per-node rate guard for the re-apply MutationObserver.
 *
 * When the extension reforms a word and the page then rewrites that text (a
 * framework re-render, or a script that reverts our edit), the change re-triggers
 * conversion. Without a bound, a page that reverts on every edit ping-pongs with
 * us forever. This guard allows a node to be re-applied a few times within a
 * sliding window, then freezes it permanently.
 *
 * The sliding window distinguishes the two cases by rate, not by a total count:
 * a legitimately updating node (a clock ticking once a second) stays under the
 * per-window limit indefinitely and keeps converting, while a tight revert loop
 * (many changes per window) blows past the limit almost immediately and is
 * frozen — so genuine dynamic content is preserved and only runaway churn is cut.
 *
 * @param {{ windowMs?: number, maxPerWindow?: number, now?: () => number }} [opts]
 * @returns {(node: object) => boolean} allow — false once the node is frozen
 */
export function createRateGuard({ windowMs = 1000, maxPerWindow = 12, now = () => performance.now() } = {}) {
  /** @type {WeakMap<object, { start: number, count: number }>} */
  const rate = new WeakMap();
  const frozen = new WeakSet();

  return function allow(node) {
    if (frozen.has(node)) return false;
    const t = now();
    let r = rate.get(node);
    if (!r || t - r.start > windowMs) {
      r = { start: t, count: 0 };
      rate.set(node, r);
    }
    if (++r.count > maxPerWindow) {
      frozen.add(node);
      return false;
    }
    return true;
  };
}
