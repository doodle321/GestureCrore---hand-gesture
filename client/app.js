// Replace local actions with extension messages
chrome.runtime.sendMessage('your-extension-id', {
  type: 'SCROLL',
  deltaY: r.data.deltaY
});