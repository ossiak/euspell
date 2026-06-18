chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({ enabled: true });
});

chrome.action.onClicked.addListener(async (tab) => {
  const { enabled = true } = await chrome.storage.sync.get('enabled');
  await chrome.storage.sync.set({ enabled: !enabled });
  await chrome.tabs.reload(tab.id);
});
