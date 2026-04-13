let hasRemovalPassword = false;
let currentUrls = [];

const MESSAGE_TYPES = {
  ADD_URL: "add-url",
  CLEAR_REMOVAL_PASSWORD: "clear-removal-password",
  GET_STATE: "get-state",
  REMOVE_URL: "remove-url",
  SAVE_SETTINGS: "save-settings",
};

const elements = {};

document.addEventListener("DOMContentLoaded", () => {
  cacheElements();
  bindEvents();
  refreshState();
});

function cacheElements() {
  elements.addUrlButton = document.getElementById("btn_add_url");
  elements.clearPasswordButton = document.getElementById("btn_clear_password");
  elements.currentPasswordInput = document.getElementById("field_current_password");
  elements.emptyState = document.getElementById("empty_state");
  elements.list = document.getElementById("list_urls");
  elements.newPasswordInput = document.getElementById("field_removal_password");
  elements.passwordRemoveGroup = document.getElementById("password_remove_group");
  elements.passwordState = document.getElementById("password_state");
  elements.redirectUrlInput = document.getElementById("field_redirect_url");
  elements.saveSettingsButton = document.getElementById("btn_save_settings");
  elements.status = document.getElementById("status_message");
  elements.urlCount = document.getElementById("url_count");
  elements.urlInput = document.getElementById("field_add_url");
}

function bindEvents() {
  elements.addUrlButton.addEventListener("click", addUrl);
  elements.clearPasswordButton.addEventListener("click", clearRemovalPassword);
  elements.saveSettingsButton.addEventListener("click", saveSettings);
  elements.urlInput.addEventListener("keydown", (event) => handleEnter(event, addUrl));
  elements.newPasswordInput.addEventListener("keydown", (event) => handleEnter(event, saveSettings));
  elements.currentPasswordInput.addEventListener("keydown", (event) => handleEnter(event, clearRemovalPassword));
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

  hasRemovalPassword = response.hasRemovalPassword;
  elements.redirectUrlInput.value = response.redirectUrl || "";
  elements.passwordState.textContent = hasRemovalPassword
    ? "Password protection is active."
    : "No password is set.";
  elements.passwordRemoveGroup.hidden = !hasRemovalPassword;

  if (!hasRemovalPassword) {
    elements.currentPasswordInput.value = "";
  }

  renderUrlList(response.urls || []);
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

async function saveSettings() {
  const response = await sendMessage({
    type: MESSAGE_TYPES.SAVE_SETTINGS,
    redirectUrl: elements.redirectUrlInput.value,
    removalPassword: elements.newPasswordInput.value,
  });

  updateState(response);
  elements.newPasswordInput.value = "";
}

async function clearRemovalPassword() {
  const response = await sendMessage({
    type: MESSAGE_TYPES.CLEAR_REMOVAL_PASSWORD,
    password: elements.currentPasswordInput.value,
  });

  updateState(response);
  elements.currentPasswordInput.value = "";
}

function renderUrlList(urls) {
  currentUrls = urls;
  elements.list.innerHTML = "";
  elements.emptyState.hidden = urls.length > 0;
  elements.urlCount.textContent = `${urls.length} entries`;

  for (const url of urls) {
    elements.list.appendChild(createUrlListItem(url));
  }
}

function createUrlListItem(url) {
  const listItem = document.createElement("li");
  const label = document.createElement("span");
  const removeButton = document.createElement("button");

  label.textContent = url;
  removeButton.type = "button";
  removeButton.textContent = "Remove";
  removeButton.addEventListener("click", () => requestRemoval(url));

  listItem.append(label, removeButton);
  return listItem;
}

function requestRemoval(url) {
  if (!hasRemovalPassword) {
    removeUrl(url);
    return;
  }

  renderUrlList(currentUrls);
  showPasswordPrompt(url);
}

function showPasswordPrompt(url) {
  const listItems = document.querySelectorAll("#list_urls li");

  for (const item of listItems) {
    const label = item.querySelector("span");
    if (!label) {
      continue;
    }

    if (label.textContent !== url) {
      item.classList.remove("confirming");
      continue;
    }

    item.classList.add("confirming");
    item.innerHTML = "";

    const passwordInput = document.createElement("input");
    const confirmButton = document.createElement("button");
    const cancelButton = document.createElement("button");

    passwordInput.type = "password";
    passwordInput.placeholder = "Password";
    confirmButton.type = "button";
    confirmButton.textContent = "Confirm";
    cancelButton.type = "button";
    cancelButton.textContent = "Cancel";
    cancelButton.className = "ghost-button";

    passwordInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        removeUrl(url, passwordInput.value);
      }
    });
    confirmButton.addEventListener("click", () => removeUrl(url, passwordInput.value));
    cancelButton.addEventListener("click", () => renderUrlList(currentUrls));

    item.append(passwordInput, confirmButton, cancelButton);
    passwordInput.focus();
  }
}

async function removeUrl(url, password = "") {
  updateState(await sendMessage({
    type: MESSAGE_TYPES.REMOVE_URL,
    url,
    password,
  }));
}

function setStatus(message, isError) {
  elements.status.textContent = message;
  elements.status.classList.toggle("error", isError);
}
