document.addEventListener("DOMContentLoaded", function(){
  const urlListElement = document.getElementById("list_urls");
  document.getElementById("btn_add_url").addEventListener("click", f);
  // The workaround to let "enter" key have the same behaviour as "Add" action when text field is in focus.
  document.getElementById("field_add_url").addEventListener("keydown", (key) => {
    console.log(key)
    if(key.key == "Enter"){
      f();
    }
  });
  function f(){
    const url = document.getElementById("field_add_url").value;
    chrome.runtime.sendMessage({ type: "add-url", url: url });
    // Clear input field
    document.getElementById("field_add_url").value = "";
  }
});

chrome.runtime.onMessage.addListener((message) => {
const urlListElement = document.getElementById("list_urls");
  if(message.type === "update-list"){
    // Clear existing list items
    urlListElement.innerHTML = "";
    for (const url of message.urls) {
      const listItem = document.createElement("li");
      listItem.textContent = url;
      const removeButton = document.createElement("button");
      removeButton.textContent = "x";
      removeButton.addEventListener("click", () => {
        chrome.runtime.sendMessage({ type: "remove-url", url: url });
      });
      listItem.appendChild(removeButton);
      urlListElement.appendChild(listItem);
    }
  }
});

chrome.runtime.sendMessage({ type: "get-list" });