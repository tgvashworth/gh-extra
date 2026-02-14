# Chrome Extension Keyboard Shortcuts: Commands API Reference

## Table of Contents

1. [Chrome Commands API Overview](#1-chrome-commands-api-overview)
2. [Defining Commands in manifest.json](#2-defining-commands-in-manifestjson)
3. [suggested_key Format and Modifier Keys](#3-suggested_key-format-and-modifier-keys)
4. [Allowed Keys](#4-allowed-keys)
5. [Platform Differences (Mac vs Windows/Linux)](#5-platform-differences-mac-vs-windowslinux)
6. [Reserved and Special Commands](#6-reserved-and-special-commands)
7. [Listening for Command Events in Service Workers](#7-listening-for-command-events-in-service-workers)
8. [Communication: Background Service Worker to Content Script](#8-communication-background-service-worker-to-content-script)
9. [User-Configurable Shortcuts (chrome://extensions/shortcuts)](#9-user-configurable-shortcuts-chromeextensionsshortcuts)
10. [Global Commands](#10-global-commands)
11. [Querying Registered Commands](#11-querying-registered-commands)
12. [Chrome Reserved Shortcuts to Avoid](#12-chrome-reserved-shortcuts-to-avoid)
13. [Best Practices and Limitations](#13-best-practices-and-limitations)
14. [Complete Working Example: GitHub Page Command Extension](#14-complete-working-example-github-page-command-extension)
15. [Sources](#15-sources)

---

## 1. Chrome Commands API Overview

The `chrome.commands` API lets you define keyboard shortcuts that trigger actions in
your Chrome extension. Commands are declared in `manifest.json` and listened for in
the extension's background service worker. When a user presses the configured key
combination, Chrome fires the `commands.onCommand` event, which the service worker
can handle to execute extension logic.

Key facts:

- **Manifest V3** is the current manifest version for Chrome extensions.
- The `"commands"` permission is **not** required in the `"permissions"` array. Declaring the `"commands"` key in `manifest.json` is sufficient.
- An extension can define **many** commands, but may specify **at most 4** suggested keyboard shortcuts. Users can manually bind additional commands via `chrome://extensions/shortcuts`.
- Commands fire in the **background service worker**, not in content scripts or popups.

---

## 2. Defining Commands in manifest.json

Commands are declared under the `"commands"` key in `manifest.json`. Each property key
is the command name, and the value is an object with `suggested_key` and `description`.

### Basic structure

```json
{
  "manifest_version": 3,
  "name": "My Extension",
  "version": "1.0",
  "background": {
    "service_worker": "service-worker.js"
  },
  "commands": {
    "run-action": {
      "suggested_key": {
        "default": "Ctrl+Shift+Y",
        "mac": "Command+Shift+Y"
      },
      "description": "Run the main action"
    },
    "toggle-sidebar": {
      "suggested_key": {
        "default": "Alt+S"
      },
      "description": "Toggle the sidebar"
    }
  }
}
```

### Command object properties

| Property | Required | Description |
|---|---|---|
| `suggested_key` | No | Default keyboard shortcut. Can be a string (all platforms) or an object with platform keys. If omitted, the command is **unbound** until the user assigns one. |
| `description` | Yes (for standard commands) | Human-readable description shown in the `chrome://extensions/shortcuts` UI. Ignored for `_execute_action`. |

### Defining a command without a default shortcut

You can declare a command with an empty object `{}` to let the user assign a
shortcut themselves:

```json
"commands": {
  "do-something": {
    "description": "Do something useful"
  }
}
```

Or even:

```json
"commands": {
  "do-something": {}
}
```

This registers the command name so the user can bind it in `chrome://extensions/shortcuts`.

---

## 3. suggested_key Format and Modifier Keys

### Format

Key combinations are specified as strings with keys separated by `+`:

```
"Ctrl+Shift+Y"
"Alt+K"
"Command+Shift+L"
"MacCtrl+Shift+P"
```

A key combination consists of **2 or 3 keys**:

1. **Primary modifier** (mandatory, except for function keys and media keys)
2. **Secondary modifier** (optional)
3. **Key** (mandatory)

### Platform-specific suggested_key object

```json
"suggested_key": {
  "default": "Ctrl+Shift+F",
  "windows": "Ctrl+Shift+F",
  "mac": "Command+Shift+F",
  "linux": "Ctrl+Shift+F",
  "chromeos": "Ctrl+Shift+F"
}
```

If only `"default"` is provided, it applies to all platforms. Platform-specific
entries override `"default"` for that platform.

### String shorthand

If the shortcut is the same on all platforms, you can use a plain string:

```json
"suggested_key": "Alt+Shift+J"
```

### Modifier keys reference

| Modifier | Windows/Linux | macOS | ChromeOS |
|---|---|---|---|
| `Ctrl` | Ctrl key | **Command** key (auto-converted) | Ctrl key |
| `Alt` | Alt key | Option key | Alt key |
| `Shift` | Shift key | Shift key | Shift key |
| `MacCtrl` | (not applicable) | **Ctrl** key (the actual Control key) | (not applicable) |
| `Command` | (not applicable) | Command key | (not applicable) |
| `Search` | (not applicable) | (not applicable) | Search/Launcher key |

### Rules for modifier combinations

- Every key combination **must** include either `Ctrl` or `Alt` as the primary modifier. Exception: function keys (`F1`-`F12`) and media keys can stand alone.
- `Shift` can be used as a secondary modifier alongside `Ctrl` or `Alt`.
- **`Ctrl+Alt` combinations are prohibited** because they conflict with the `AltGr` key on international keyboards.
- On macOS, `Ctrl` is automatically interpreted as `Command`. If you need the actual Control key on Mac, use `MacCtrl`.
- A secondary modifier must be different from the primary modifier.

---

## 4. Allowed Keys

### Letters and numbers
`A` through `Z`, `0` through `9`

### Function keys
`F1` through `F12`

### Arrow keys
`Up`, `Down`, `Left`, `Right`

### Special keys
`Comma`, `Period`, `Home`, `End`, `PageUp`, `PageDown`, `Space`, `Insert`, `Delete`

### Media keys (standalone, no modifiers)
`MediaNextTrack`, `MediaPlayPause`, `MediaPrevTrack`, `MediaStop`

**Key names are case-sensitive.** Use `Ctrl+Shift+Y`, not `ctrl+shift+y`.

---

## 5. Platform Differences (Mac vs Windows/Linux)

### The Ctrl/Command conversion on macOS

This is the most important platform difference to understand:

| You write in manifest | Windows/Linux result | macOS result |
|---|---|---|
| `Ctrl+Shift+Y` | Ctrl+Shift+Y | **Cmd+Shift+Y** |
| `MacCtrl+Shift+Y` | (ignored / not applicable) | **Ctrl+Shift+Y** |
| `Command+Shift+Y` | (ignored / not applicable) | **Cmd+Shift+Y** |
| `Alt+K` | Alt+K | **Option+K** |

### Recommended approach for cross-platform shortcuts

Use the platform-specific object when you need different behavior on Mac:

```json
"suggested_key": {
  "default": "Ctrl+Shift+Y",
  "mac": "Command+Shift+Y"
}
```

Or rely on the automatic conversion (using just `"default"` with `Ctrl` will
auto-convert to `Command` on Mac):

```json
"suggested_key": {
  "default": "Ctrl+Shift+Y"
}
```

Both are equivalent -- `Ctrl` in `"default"` is automatically mapped to `Command` on
macOS. Only use the explicit `"mac"` key when you want a **different** key combination
on Mac (e.g., different letter or using `MacCtrl` instead of `Command`).

---

## 6. Reserved and Special Commands

### _execute_action (Manifest V3)

The `_execute_action` command is a **reserved** command name that triggers the
extension's action (toolbar icon click / popup open). It does **not** fire the
`commands.onCommand` event.

```json
"commands": {
  "_execute_action": {
    "suggested_key": {
      "default": "Ctrl+Shift+F"
    }
  }
}
```

When this shortcut is pressed:
- If the extension has a popup, the popup opens.
- If no popup, the `action.onClicked` event fires.
- The `commands.onCommand` event does **not** fire.

To react to it, listen in your popup's script or use `chrome.action.onClicked`:

```javascript
// service-worker.js
chrome.action.onClicked.addListener((tab) => {
  // Runs when toolbar icon is clicked OR _execute_action shortcut is pressed
  // (only if no popup is configured)
});
```

### Legacy reserved commands (Manifest V2, do not use in MV3)

- `_execute_browser_action`
- `_execute_page_action`

When migrating from MV2 to MV3, `_execute_browser_action` shortcuts automatically
carry over to `_execute_action` (Chrome 111+).

---

## 7. Listening for Command Events in Service Workers

### Basic listener

```javascript
// service-worker.js
chrome.commands.onCommand.addListener((command, tab) => {
  console.log(`Command "${command}" triggered`);
  console.log(`Active tab:`, tab);
});
```

The callback receives:
- `command` (string): The name of the command as declared in the manifest.
- `tab` (Tab object): The currently active tab when the command was triggered.

### Routing multiple commands

```javascript
// service-worker.js
chrome.commands.onCommand.addListener((command, tab) => {
  switch (command) {
    case "run-action":
      handleRunAction(tab);
      break;
    case "toggle-sidebar":
      handleToggleSidebar(tab);
      break;
    case "open-settings":
      chrome.runtime.openOptionsPage();
      break;
  }
});

function handleRunAction(tab) {
  // Do something with the active tab
  chrome.tabs.sendMessage(tab.id, { action: "run" });
}

function handleToggleSidebar(tab) {
  chrome.tabs.sendMessage(tab.id, { action: "toggle-sidebar" });
}
```

### Critical rule: Register listeners at the top level

In Manifest V3, the background script is a **service worker** that can be terminated
and restarted at any time. All event listeners **must** be registered synchronously
at the top level of the service worker script. Do **not** nest them inside async
functions, callbacks, or conditionals.

```javascript
// CORRECT: Top-level registration
chrome.commands.onCommand.addListener((command) => {
  // handle command
});

// WRONG: Nested registration (will break after service worker restart)
async function setup() {
  chrome.commands.onCommand.addListener((command) => {
    // This listener may not be restored after restart!
  });
}
setup();
```

---

## 8. Communication: Background Service Worker to Content Script

When a keyboard shortcut fires in the service worker, you typically need to forward
the action to a content script running on the active page (e.g., a GitHub page).
This requires **message passing**.

### Prerequisites

Your content script must be declared in `manifest.json`:

```json
{
  "content_scripts": [
    {
      "matches": ["https://github.com/*"],
      "js": ["content-script.js"]
    }
  ]
}
```

### Method 1: One-time messages with chrome.tabs.sendMessage

This is the simplest and most common approach.

**service-worker.js:**

```javascript
chrome.commands.onCommand.addListener(async (command, tab) => {
  // Ensure we have a valid tab with an ID
  if (!tab?.id) return;

  // Only send to GitHub pages (optional guard)
  if (!tab.url?.startsWith("https://github.com")) return;

  try {
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: "COMMAND",
      command: command,
    });
    console.log("Content script responded:", response);
  } catch (error) {
    // Content script may not be injected on this page
    console.error("Failed to send message:", error);
  }
});
```

**content-script.js:**

```javascript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "COMMAND") return;

  switch (message.command) {
    case "run-action":
      performAction();
      sendResponse({ success: true });
      break;
    case "toggle-sidebar":
      toggleSidebar();
      sendResponse({ success: true });
      break;
    default:
      sendResponse({ success: false, error: "Unknown command" });
  }

  // Return true if you need to call sendResponse asynchronously
  // return true;
});

function performAction() {
  // Manipulate the GitHub page DOM
  console.log("Action performed on GitHub page");
}

function toggleSidebar() {
  const sidebar = document.querySelector(".sidebar");
  if (sidebar) {
    sidebar.style.display = sidebar.style.display === "none" ? "" : "none";
  }
}
```

### Method 2: Programmatic script injection (no pre-declared content script needed)

If you want to run code on demand without a persistent content script:

```javascript
// service-worker.js
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command === "inject-script") {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["injected-script.js"],
    });
  }
});
```

This requires the `"scripting"` permission and appropriate `"host_permissions"` in
the manifest:

```json
{
  "permissions": ["scripting"],
  "host_permissions": ["https://github.com/*"]
}
```

### Method 3: Long-lived connections with chrome.tabs.connect

For persistent two-way communication:

**service-worker.js:**

```javascript
chrome.commands.onCommand.addListener((command, tab) => {
  const port = chrome.tabs.connect(tab.id, { name: "commands" });
  port.postMessage({ command: command });
  port.onMessage.addListener((response) => {
    console.log("Response from content script:", response);
  });
});
```

**content-script.js:**

```javascript
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "commands") return;
  port.onMessage.addListener((msg) => {
    // Handle the command
    port.postMessage({ result: "done" });
  });
});
```

### Important notes on messaging

- **You cannot use `chrome.runtime.sendMessage()` to reach content scripts.** You must use `chrome.tabs.sendMessage(tabId, ...)`.
- Messages must be **JSON-serializable** (no functions, no `undefined` values, no DOM elements).
- Maximum message size is **64 MiB**.
- If the content script is not injected on the target page, `chrome.tabs.sendMessage` will throw an error. Always wrap in try/catch.
- For **async responses**, return `true` from the `onMessage` listener to keep the message channel open, or return a Promise.

---

## 9. User-Configurable Shortcuts (chrome://extensions/shortcuts)

Chrome provides a built-in UI at `chrome://extensions/shortcuts` where users can view
and customize keyboard shortcuts for all installed extensions.

### How it works

1. Navigate to `chrome://extensions/shortcuts` (or click the hamburger menu in `chrome://extensions` and select "Keyboard shortcuts").
2. All extensions with declared commands are listed, each showing its command descriptions and current bindings.
3. Click the pencil icon next to a shortcut to re-bind it.
4. Press the new key combination. It saves automatically.
5. Press Backspace to clear/remove a shortcut.
6. Users can also set the shortcut scope to "In Chrome" (default) or "Global" (works even when Chrome is not focused).

### Implications for extension developers

- **Users can change or remove any shortcut you define.** Never assume your suggested shortcut is active.
- Users can bind commands that have **no** suggested_key defined in the manifest.
- If two extensions define the same shortcut, only one will work. The user must resolve conflicts manually.
- Use `chrome.commands.getAll()` to check what shortcuts are actually active at runtime (see section 11).
- An extension can define **unlimited commands**, but only **4** can have `suggested_key` defaults. The rest must be bound by users.

---

## 10. Global Commands

By default, commands only work when Chrome has focus. A "global" command works
system-wide, even when Chrome is in the background.

```json
"commands": {
  "show-window": {
    "suggested_key": {
      "default": "Ctrl+Shift+1"
    },
    "description": "Show the extension window",
    "global": true
  }
}
```

### Restrictions on global commands

- Suggested key combinations for global commands are **limited to `Ctrl+Shift+[0-9]`**. This prevents conflicts with OS-level shortcuts.
- Users can reassign global commands to other key combinations via `chrome://extensions/shortcuts`.
- **ChromeOS does not support global commands.**
- Global commands are useful for media control extensions, clipboard managers, or quick-launcher style tools.

---

## 11. Querying Registered Commands

Use `chrome.commands.getAll()` to retrieve all registered commands and their current
shortcut bindings at runtime:

```javascript
// service-worker.js or popup.js
const commands = await chrome.commands.getAll();
for (const cmd of commands) {
  console.log(`Command: ${cmd.name}`);
  console.log(`  Description: ${cmd.description}`);
  console.log(`  Shortcut: ${cmd.shortcut || "(not set)"}`);
}
```

The returned `Command` objects have:
- `name` (string): The command name from the manifest.
- `description` (string): The description from the manifest.
- `shortcut` (string): The currently active shortcut, or an empty string if unbound.

This is useful for:
- Displaying current shortcuts in your extension's UI.
- Detecting if the user has unbound a required shortcut and showing a prompt.
- Linking to the shortcuts page: `chrome://extensions/shortcuts`.

Note: Before Chrome 110, `getAll()` excluded the `_execute_action` command from
results.

---

## 12. Chrome Reserved Shortcuts to Avoid

The following Chrome shortcuts **cannot be overridden** by extensions. If you define a
command with one of these key combinations, Chrome's built-in behavior takes priority
and your command will not fire.

### Common reserved Ctrl+Shift shortcuts (Windows/Linux)

| Shortcut | Chrome action |
|---|---|
| `Ctrl+Shift+T` | Reopen last closed tab |
| `Ctrl+Shift+N` | Open new incognito window |
| `Ctrl+Shift+W` | Close current window |
| `Ctrl+Shift+Q` | Quit Chrome |
| `Ctrl+Shift+B` | Toggle bookmarks bar |
| `Ctrl+Shift+J` | Open DevTools Console |
| `Ctrl+Shift+I` | Open DevTools |
| `Ctrl+Shift+Delete` | Open Clear Browsing Data |
| `Ctrl+Shift+M` | Switch Chrome profile |

### Common reserved Ctrl shortcuts (Windows/Linux)

| Shortcut | Chrome action |
|---|---|
| `Ctrl+T` | New tab |
| `Ctrl+W` | Close tab |
| `Ctrl+N` | New window |
| `Ctrl+L` | Focus address bar |
| `Ctrl+D` | Bookmark current page |
| `Ctrl+H` | Open history |
| `Ctrl+J` | Open downloads |
| `Ctrl+F` | Find on page |
| `Ctrl+P` | Print |

### Common reserved Cmd shortcuts (macOS)

| Shortcut | Chrome action |
|---|---|
| `Cmd+T` | New tab |
| `Cmd+W` | Close tab |
| `Cmd+Q` | Quit Chrome |
| `Cmd+Shift+T` | Reopen last closed tab |
| `Cmd+Shift+N` | Open new incognito window |
| `Cmd+Option+I` | Open DevTools |
| `Cmd+Option+J` | Open DevTools Console |

### Safer shortcut ranges

These ranges are **less likely** to conflict with Chrome or OS shortcuts:

- `Ctrl+Shift+[1-9]` (but check for conflicts with tab switching)
- `Alt+Shift+[A-Z]`
- `Ctrl+Shift+[A-Z]` (avoid the letters listed above: T, N, W, Q, B, J, I, M, Delete)

---

## 13. Best Practices and Limitations

### Limitations

1. **Maximum 4 suggested shortcuts.** You can define more commands, but only 4 can have `suggested_key` values. The rest need user configuration.
2. **`Ctrl+Alt` is prohibited.** Conflicts with AltGr on international keyboards.
3. **OS/Chrome shortcuts always win.** Your extension cannot override browser-reserved shortcuts.
4. **Service worker lifecycle.** The service worker can be terminated at any time. Register all listeners at the top level synchronously.
5. **`_execute_action` does not fire `onCommand`.** Use `action.onClicked` or popup `DOMContentLoaded` instead.
6. **Content script must be loaded.** `chrome.tabs.sendMessage` will error if no content script is listening on the target tab.
7. **No programmatic shortcut updates in Chrome.** Unlike Firefox (which has `commands.update()`), Chrome does not allow extensions to programmatically change shortcut bindings. Only users can change them.

### Best practices

1. **Choose uncommon key combinations.** Use 3-key combos (modifier + Shift + key) to reduce conflicts. Good examples: `Ctrl+Shift+U`, `Alt+Shift+P`.
2. **Always provide platform-specific Mac shortcuts.** Even though `Ctrl` auto-converts to `Command` on Mac, being explicit avoids confusion:
   ```json
   "suggested_key": {
     "default": "Ctrl+Shift+E",
     "mac": "Command+Shift+E"
   }
   ```
3. **Write clear descriptions.** The `description` field shows up in `chrome://extensions/shortcuts`. Make it user-friendly.
4. **Handle missing shortcuts gracefully.** Use `chrome.commands.getAll()` to check if your shortcut is actually bound. If the user has removed it, show a notification or settings prompt.
5. **Wrap `tabs.sendMessage` in try/catch.** The content script may not be injected on every page.
6. **Define commands without shortcuts for power users.** Let power users bind their own preferred keys to your lesser-used features.
7. **Test on multiple platforms.** Verify shortcuts on Windows, Mac, and Linux. What works on one platform may conflict on another.
8. **Log the command in the service worker.** This aids debugging when shortcuts silently fail.

---

## 14. Complete Working Example: GitHub Page Command Extension

Here is a full Manifest V3 extension that defines keyboard shortcuts, listens for
them in the service worker, and sends messages to a content script running on GitHub.

### manifest.json

```json
{
  "manifest_version": 3,
  "name": "GitHub Extra Shortcuts",
  "version": "1.0",
  "description": "Keyboard shortcuts for GitHub pages",
  "background": {
    "service_worker": "service-worker.js"
  },
  "content_scripts": [
    {
      "matches": ["https://github.com/*"],
      "js": ["content-script.js"],
      "run_at": "document_idle"
    }
  ],
  "commands": {
    "_execute_action": {
      "suggested_key": {
        "default": "Ctrl+Shift+G",
        "mac": "Command+Shift+G"
      },
      "description": "Open extension popup"
    },
    "toggle-file-tree": {
      "suggested_key": {
        "default": "Alt+Shift+T"
      },
      "description": "Toggle the file tree sidebar"
    },
    "copy-branch-name": {
      "suggested_key": {
        "default": "Ctrl+Shift+B",
        "mac": "Command+Shift+B"
      },
      "description": "Copy the current branch name"
    },
    "focus-search": {
      "suggested_key": {
        "default": "Alt+Shift+S"
      },
      "description": "Focus the search bar"
    },
    "quick-navigate": {
      "description": "Quick navigate to a repo section (user-assigned shortcut)"
    }
  },
  "permissions": ["activeTab"],
  "action": {
    "default_popup": "popup.html",
    "default_icon": "icon.png"
  }
}
```

### service-worker.js

```javascript
// All listeners MUST be registered at the top level of the service worker.

chrome.commands.onCommand.addListener(async (command, tab) => {
  console.log(`Command received: "${command}" on tab ${tab?.id}`);

  // Guard: ensure we have a valid tab on a GitHub page
  if (!tab?.id) {
    console.warn("No active tab for command:", command);
    return;
  }

  if (!tab.url?.startsWith("https://github.com")) {
    console.log("Not a GitHub page, ignoring command:", command);
    return;
  }

  // Forward the command to the content script
  try {
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: "KEYBOARD_COMMAND",
      command: command,
      timestamp: Date.now(),
    });

    if (response?.success) {
      console.log(`Command "${command}" handled successfully`);
    } else {
      console.warn(`Command "${command}" failed:`, response?.error);
    }
  } catch (error) {
    console.error(`Could not reach content script on tab ${tab.id}:`, error);
    // Content script may not be loaded. Optionally inject it:
    // await chrome.scripting.executeScript({
    //   target: { tabId: tab.id },
    //   files: ["content-script.js"],
    // });
  }
});

// Log all registered commands on install for debugging
chrome.runtime.onInstalled.addListener(async () => {
  const commands = await chrome.commands.getAll();
  console.log("Registered commands:");
  for (const cmd of commands) {
    console.log(`  ${cmd.name}: ${cmd.shortcut || "(no shortcut)"} - ${cmd.description}`);
  }
});
```

### content-script.js

```javascript
// Listen for messages from the service worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Verify the message is from our extension (sender.id is our extension ID)
  if (message.type !== "KEYBOARD_COMMAND") return;

  console.log(`[GitHub Extra] Received command: ${message.command}`);

  try {
    switch (message.command) {
      case "toggle-file-tree":
        toggleFileTree();
        sendResponse({ success: true });
        break;

      case "copy-branch-name":
        copyBranchName()
          .then(() => sendResponse({ success: true }))
          .catch((err) => sendResponse({ success: false, error: err.message }));
        return true; // Keep message channel open for async sendResponse

      case "focus-search":
        focusSearch();
        sendResponse({ success: true });
        break;

      case "quick-navigate":
        quickNavigate();
        sendResponse({ success: true });
        break;

      default:
        sendResponse({ success: false, error: `Unknown command: ${message.command}` });
    }
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
});

function toggleFileTree() {
  // Example: toggle GitHub's file tree panel (available on repo code pages)
  const toggleButton = document.querySelector(
    'button[aria-label="Toggle file tree"]'
  );
  if (toggleButton) {
    toggleButton.click();
  }
}

async function copyBranchName() {
  // Find the branch name element on GitHub
  const branchSelector = document.querySelector(
    '[data-hotkey="w"] span, .branch-name, [class*="BranchName"]'
  );
  if (branchSelector) {
    const branchName = branchSelector.textContent.trim();
    await navigator.clipboard.writeText(branchName);
    showToast(`Copied: ${branchName}`);
  } else {
    throw new Error("Could not find branch name on this page");
  }
}

function focusSearch() {
  // Focus GitHub's search input
  const searchInput = document.querySelector(
    'input[name="query"], qbsearch-input input, [data-target="qbsearch-input.inputButton"]'
  );
  if (searchInput) {
    searchInput.focus();
    searchInput.click();
  }
}

function quickNavigate() {
  // Example: open GitHub's command palette
  const event = new KeyboardEvent("keydown", {
    key: "k",
    code: "KeyK",
    ctrlKey: true,
    bubbles: true,
  });
  document.dispatchEvent(event);
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.textContent = message;
  Object.assign(toast.style, {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    background: "#1a7f37",
    color: "white",
    padding: "12px 20px",
    borderRadius: "8px",
    fontSize: "14px",
    fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
    zIndex: "99999",
    boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
    transition: "opacity 0.3s ease",
  });
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}
```

---

## 15. Sources

- [chrome.commands API Reference - Chrome for Developers](https://developer.chrome.com/docs/extensions/reference/api/commands)
- [Respond to commands - Chrome for Developers](https://developer.chrome.com/docs/extensions/develop/ui/respond-to-commands)
- [Message passing - Chrome for Developers](https://developer.chrome.com/docs/extensions/develop/concepts/messaging)
- [commands manifest key - MDN Web Docs](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/commands)
- [About extension service workers - Chrome for Developers](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers)
- [Chrome keyboard shortcuts - Google Support](https://support.google.com/chrome/answer/157179?hl=en&co=GENIE.Platform%3DDesktop)
- [Manifest file format - Chrome for Developers](https://developer.chrome.com/docs/extensions/reference/manifest)
