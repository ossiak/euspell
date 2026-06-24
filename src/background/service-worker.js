// Seed default settings on install. The enable/disable controls live in the
// popup (src/popup) and options page (src/options) — chrome.action.onClicked is
// intentionally NOT used, because it never fires while a default_popup is set.
chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.sync.get(['enabled', 'disabledSites']);
  await chrome.storage.sync.set({
    enabled: current.enabled ?? true,
    disabledSites: current.disabledSites ?? [],
  });
});
