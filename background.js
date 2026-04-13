const DEFAULT_SETTINGS = {
  urls: [],
  redirectUrl: "",
  removalPassword: "",
};

const MESSAGE_TYPES = {
  ADD_URL: "add-url",
  CLEAR_REMOVAL_PASSWORD: "clear-removal-password",
  GET_STATE: "get-state",
  REMOVE_URL: "remove-url",
  SAVE_SETTINGS: "save-settings",
};

function normalizeSettings(data) {
  if (Array.isArray(data)) {
    return { ...DEFAULT_SETTINGS, urls: data };
  }

  if (data && typeof data === "object") {
    return {
      ...DEFAULT_SETTINGS,
      ...data,
      urls: Array.isArray(data.urls) ? data.urls : [],
    };
  }

  return { ...DEFAULT_SETTINGS };
}

async function getSettings() {
  const storage = await chrome.storage.local.get("data");
  return normalizeSettings(storage.data);
}

async function saveSettings(settings) {
  await chrome.storage.local.set({ data: settings });
}

function getRedirectUrl(settings) {
  const url = settings.redirectUrl.trim();

  if (!url) {
    return chrome.runtime.getURL("redirect.html");
  }

  if (/^https?:\/\//i.test(url) || url.startsWith("moz-extension://") || url.startsWith("chrome-extension://")) {
    return url;
  }

  return `https://${url}`;
}

function isValidRedirectUrl(url) {
  if (!url) {
    return true;
  }

  const candidate = /^https?:\/\//i.test(url) ? url : `https://${url}`;

  try {
    const parsedUrl = new URL(candidate);
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
  } catch (error) {
    return false;
  }
}

function isRedirectDestination(currentUrl, destination) {
  try {
    return new URL(currentUrl).href === new URL(destination).href;
  } catch (error) {
    return currentUrl === destination;
  }
}

function getUrlCandidate(value) {
  const candidate = value.trim();

  if (!candidate) {
    return "";
  }

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(candidate)) {
    return candidate;
  }

  return `https://${candidate}`;
}

function normalizeHostname(hostname) {
  return hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
}

function isSameDomainOrSubdomain(hostname, blockedHostname) {
  const normalizedHostname = normalizeHostname(hostname);
  const normalizedBlockedHostname = normalizeHostname(blockedHostname);

  return normalizedHostname === normalizedBlockedHostname
    || normalizedHostname.endsWith(`.${normalizedBlockedHostname}`);
}

function isBlockedUrl(tabUrl, blockedEntry) {
  const entry = getUrlCandidate(blockedEntry);

  if (!entry) {
    return false;
  }

  try {
    const currentUrl = new URL(tabUrl);
    const blockedUrl = new URL(entry);

    if (!isSameDomainOrSubdomain(currentUrl.hostname, blockedUrl.hostname)) {
      return false;
    }

    if (blockedUrl.pathname === "/" && !blockedUrl.search && !blockedUrl.hash) {
      return true;
    }

    const blockedPath = `${blockedUrl.pathname}${blockedUrl.search}${blockedUrl.hash}`;
    const currentPath = `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`;
    return currentPath.startsWith(blockedPath);
  } catch (error) {
    return false;
  }
}

function getPublicState(settings, status = {}) {
  return {
    urls: settings.urls,
    redirectUrl: settings.redirectUrl,
    hasRemovalPassword: Boolean(settings.removalPassword),
    ...status,
  };
}

// Observe chrome message listener to handle list and settings events
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message)
    .then(sendResponse)
    .catch((error) => {
      sendResponse({
        ok: false,
        error: error.message || "Something went wrong.",
      });
    });

  return true;
});

async function handleMessage(message) {
  if (!message || typeof message.type !== "string") {
    return {
      ok: false,
      error: "Invalid extension action.",
    };
  }

  const settings = await getSettings();
  const url = message.url?.trim();

  switch (message.type) {
    case MESSAGE_TYPES.ADD_URL:
      return addUrl(settings, url);
    case MESSAGE_TYPES.REMOVE_URL:
      return removeUrl(settings, url, message.password);
    case MESSAGE_TYPES.SAVE_SETTINGS:
      return savePopupSettings(settings, message);
    case MESSAGE_TYPES.CLEAR_REMOVAL_PASSWORD:
      return clearRemovalPassword(settings, message.password);
    case MESSAGE_TYPES.GET_STATE:
      return getPublicState(settings, { ok: true });
    default:
      return getPublicState(settings, {
        ok: false,
        error: "Unsupported extension action.",
      });
  }
}

async function addUrl(settings, url) {
  if (!url) {
    return getPublicState(settings, {
      ok: false,
      error: "Enter a website first.",
    });
  }

  if (!settings.urls.includes(url)) {
    settings.urls.push(url);
    await saveSettings(settings);
  }

  return getPublicState(settings, { ok: true });
}

async function removeUrl(settings, url, password) {
  if (!url) {
    return getPublicState(settings, {
      ok: false,
      error: "Choose a website to remove.",
    });
  }

  if (settings.removalPassword && password !== settings.removalPassword) {
    return getPublicState(settings, {
      ok: false,
      error: "Incorrect removal password.",
    });
  }

  settings.urls = settings.urls.filter((item) => item !== url);
  await saveSettings(settings);
  return getPublicState(settings, { ok: true });
}

async function savePopupSettings(settings, message) {
  const nextPassword = message.removalPassword?.trim();
  const redirectUrl = message.redirectUrl?.trim() || "";

  if (!isValidRedirectUrl(redirectUrl)) {
    return getPublicState(settings, {
      ok: false,
      error: "Enter a valid redirect URL.",
    });
  }

  settings.redirectUrl = redirectUrl;

  if (nextPassword) {
    settings.removalPassword = nextPassword;
  }

  await saveSettings(settings);
  return getPublicState(settings, {
    ok: true,
    notice: "Settings saved.",
  });
}

async function clearRemovalPassword(settings, password) {
  if (!settings.removalPassword) {
    return getPublicState(settings, {
      ok: true,
      notice: "No removal password is set.",
    });
  }

  if (password !== settings.removalPassword) {
    return getPublicState(settings, {
      ok: false,
      error: "Enter the current password to remove it.",
    });
  }

  settings.removalPassword = "";
  await saveSettings(settings);
  return getPublicState(settings, {
    ok: true,
    notice: "Removal password removed.",
  });
}

// Observe chrome tabs info to take action when needed
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!tab.url) {
    return;
  }

  const settings = await getSettings();
  const destination = getRedirectUrl(settings);

  for (const url of settings.urls) {
    if (isBlockedUrl(tab.url, url) && !isRedirectDestination(tab.url, destination)) {
      await chrome.tabs.update(tab.id, { url: destination });
      return;
    }
  }
});
