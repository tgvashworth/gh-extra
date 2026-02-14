chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== "copy-branch") return;
  if (!tab?.id) return;
  if (!tab.url?.startsWith("https://github.com")) return;

  try {
    await chrome.tabs.sendMessage(tab.id, { type: "copy-branch" });
  } catch {
    // Content script not loaded on this page
  }
});
