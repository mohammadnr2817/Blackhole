const redirectUrl = 'redirect.html'

// Get urls to redirect from local storage
async function getUrlsToRedirect() {
  let urlsToRedirect = (await chrome.storage.local.get()).data
  if(urlsToRedirect == null){
    urlsToRedirect = []
  }
  return urlsToRedirect
}

// Save urls to redirect to local storage
async function saveUrlsToRedirect(urlsToRedirect) {
  await chrome.storage.local.set({data: urlsToRedirect});
}

// Observe chrome message listener to handle list events
chrome.runtime.onMessage.addListener(async (message) => {
  let urlsToRedirect = await getUrlsToRedirect()
  if (message.type === "add-url") {
    urlsToRedirect.push(message.url);
    chrome.runtime.sendMessage({ type: "update-list", urls: urlsToRedirect });
  } else if (message.type === "remove-url") {
    const index = urlsToRedirect.indexOf(message.url);
    if (index !== -1) {
      urlsToRedirect.splice(index, 1);
    }
    chrome.runtime.sendMessage({ type: "update-list", urls: urlsToRedirect });
  } else if (message.type === "get-list") {
    chrome.runtime.sendMessage({ type: "update-list", urls: urlsToRedirect });
  }
  await saveUrlsToRedirect(urlsToRedirect)
});

// Observe chrome tabs info to take action when needed
chrome.tabs.onUpdated.addListener(
  async (tabId, changeInfo, tab) => {
    let urlsToRedirect = await getUrlsToRedirect()
    for (const url of urlsToRedirect) {
      if (tab.url.includes(url)) {
        await chrome.tabs.update(tab.id, { url: redirectUrl });
        return;
      }
    }
  }
)