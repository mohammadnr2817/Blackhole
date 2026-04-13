const MESSAGE_TYPES = {
  GET_STATE: "get-state",
  UNLOCK_URL: "unlock-url",
};

const blockedUrl = new URLSearchParams(window.location.search).get("blocked") || "";
const blockedUrlElement = document.getElementById("blocked_url");
const form = document.getElementById("unlock_form");
const passwordInput = document.getElementById("unlock_password");
const statusElement = document.getElementById("unlock_status");

document.addEventListener("DOMContentLoaded", init);
form.addEventListener("submit", unlockBlockedSite);

async function init() {
  renderBlockedUrl();

  const state = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_STATE });
  if (!state?.hasRemovalPassword) {
    passwordInput.disabled = true;
    form.querySelector("button").disabled = true;
    setStatus("Set a removal password in Blackhole settings to open blocked sites from here.", true);
  }
}

function renderBlockedUrl() {
  if (!blockedUrl) {
    blockedUrlElement.textContent = "Unknown blocked site";
    blockedUrlElement.removeAttribute("href");
    return;
  }

  blockedUrlElement.textContent = blockedUrl;
  blockedUrlElement.href = blockedUrl;
}

async function unlockBlockedSite(event) {
  event.preventDefault();

  if (!blockedUrl) {
    setStatus("No blocked site was provided.", true);
    return;
  }

  const response = await chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.UNLOCK_URL,
    url: blockedUrl,
    password: passwordInput.value,
  });

  if (!response?.ok) {
    setStatus(response?.error || "Could not open this site.", true);
    return;
  }

  window.location.href = response.url;
}

function setStatus(message, isError) {
  statusElement.textContent = message;
  statusElement.classList.toggle("error", isError);
}
