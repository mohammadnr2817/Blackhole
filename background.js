const redirectUrl = 'redirect.html'
const forbiddenUrls = [
  'example.com'
];
chrome.tabs.onUpdated.addListener(
  async (tabId, changeInfo, tab) => {
   for (const url of forbiddenUrls) {
    if (tab.url.includes(url)) {
      await chrome.tabs.update(tab.id, { url: redirectUrl });
      return;
    }
  }
  }
)