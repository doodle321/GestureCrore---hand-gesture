chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
  chrome.tabs.query({active: true, currentWindow: true}, tabs => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, msg);
    }
  });
});