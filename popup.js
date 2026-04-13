const MESSAGE_TYPES = {
  ADD_URL: "add-url",
  GET_STATE: "get-state",
};

const elements = {};

document.addEventListener("DOMContentLoaded", () => {
  cacheElements();
  bindEvents();
  refreshState();
  renderCurrentSite();
});

function cacheElements() {
  elements.addUrlButton = document.getElementById("btn_add_url");
  elements.blockCurrentButton = document.getElementById("btn_block_current");
  elements.currentSite = document.getElementById("current_site");
  elements.emptyState = document.getElementById("empty_state");
  elements.list = document.getElementById("list_urls");
  elements.openSettingsButton = document.getElementById("btn_open_settings");
  elements.status = document.getElementById("status_message");
  elements.urlCount = document.getElementById("url_count");
  elements.urlInput = document.getElementById("field_add_url");
}

function bindEvents() {
  elements.addUrlButton.addEventListener("click", addUrl);
  elements.blockCurrentButton.addEventListener("click", blockCurrentSite);
  elements.openSettingsButton.addEventListener("click", openSettings);
  elements.urlInput.addEventListener("keydown", (event) => handleEnter(event, addUrl));
}

function handleEnter(event, action) {
  if (event.key === "Enter") {
    action();
  }
}

function sendMessage(message) {
  return chrome.runtime.sendMessage(message);
}

async function refreshState() {
  updateState(await sendMessage({ type: MESSAGE_TYPES.GET_STATE }));
}

function updateState(response) {
  if (!response) {
    setStatus("The extension background is not available.", true);
    return;
  }

  updateBlockedVisitCount(response.blockedVisitCount || 0);
  renderCurrentSite(response.urls || []);
  renderRecentBlockedUrls(response.recentBlockedUrls || []);
  setStatus(response.error || response.notice || "", !response.ok);
}

async function addUrl() {
  const url = elements.urlInput.value.trim();

  if (!url) {
    setStatus("Enter a website first.", true);
    return;
  }

  updateState(await sendMessage({ type: MESSAGE_TYPES.ADD_URL, url }));
  elements.urlInput.value = "";
}

async function blockCurrentSite() {
  const currentSite = await getCurrentSite();

  if (!currentSite) {
    setStatus("Open a website tab first.", true);
    return;
  }

  updateState(await sendMessage({ type: MESSAGE_TYPES.ADD_URL, url: currentSite }));
}

async function openSettings() {
  await chrome.runtime.openOptionsPage();
  window.close();
}

async function renderCurrentSite(blockedUrls = []) {
  const currentSite = await getCurrentSite();
  const isAlreadyBlocked = currentSite
    ? blockedUrls.some((blockedUrl) => isCurrentSiteBlocked(currentSite, blockedUrl))
    : false;

  elements.currentSite.textContent = currentSite || "Open a website tab to block it quickly.";
  elements.blockCurrentButton.disabled = !currentSite || isAlreadyBlocked;
  elements.blockCurrentButton.textContent = isAlreadyBlocked
    ? "Current site is blocked"
    : "Block current site";
}

async function getCurrentSite() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const activeUrl = tabs[0]?.url;

  if (!activeUrl) {
    return "";
  }

  try {
    const url = new URL(activeUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "";
    }
    return url.hostname.replace(/^www\./, "");
  } catch (error) {
    return "";
  }
}

function isCurrentSiteBlocked(hostname, blockedEntry) {
  const entry = blockedEntry.trim();

  if (!entry) {
    return false;
  }

  try {
    const blockedUrl = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(entry) ? entry : `https://${entry}`);
    const normalizedHostname = normalizeHostname(hostname);
    const blockedHostname = normalizeHostname(blockedUrl.hostname);
    return normalizedHostname === blockedHostname || normalizedHostname.endsWith(`.${blockedHostname}`);
  } catch (error) {
    return false;
  }
}

function normalizeHostname(hostname) {
  return hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
}

function renderRecentBlockedUrls(urls) {
  elements.list.innerHTML = "";
  elements.emptyState.hidden = urls.length > 0;

  for (const url of urls) {
    elements.list.appendChild(createUrlListItem(url));
  }
}

function updateBlockedVisitCount(count) {
  elements.urlCount.textContent = `${count} blocks`;
}

function createUrlListItem(url) {
  const listItem = document.createElement("li");
  const label = document.createElement("span");

  label.textContent = url;

  listItem.append(label);
  return listItem;
}

function setStatus(message, isError) {
  elements.status.textContent = message;
  elements.status.classList.toggle("error", isError);
}
