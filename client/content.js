chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'SCROLL') window.scrollBy({top: msg.deltaY, behavior: 'auto'});
  if (msg.type === 'CLICK') document.elementFromPoint(msg.x, msg.y)?.click();
  if (msg.type === 'NAV_BACK') history.back();
});