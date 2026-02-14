# Chrome Extension Development with Manifest V3 and TypeScript

## 1. Manifest V3 Structure

### Required Files

A Chrome Extension at minimum requires:

- **`manifest.json`** -- The core configuration file
- **At least one functional script or page** (background service worker, content script, popup, or options page)

Typical project structure:

```
my-extension/
  manifest.json
  src/
    background.ts        # Service worker
    content.ts           # Content script
    options/
      options.html       # Settings page
      options.ts         # Settings logic
  dist/                  # Build output (loaded as unpacked extension)
    manifest.json
    background.js
    content.js
    options/
      options.html
      options.js
  icons/
    icon-16.png
    icon-48.png
    icon-128.png
  package.json
  tsconfig.json
  build.mjs             # esbuild script
```

### manifest.json Format

The three required fields are `manifest_version`, `name`, and `version`. Example targeting GitHub:

```json
{
  "manifest_version": 3,
  "name": "GitHub Extra",
  "version": "1.0.0",
  "description": "Adds extra functionality to GitHub pages.",
  "icons": {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  },
  "permissions": [
    "storage",
    "activeTab"
  ],
  "host_permissions": [
    "https://github.com/*"
  ],
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["https://github.com/*"],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ],
  "options_ui": {
    "page": "options/options.html",
    "open_in_tab": true
  }
}
```

### Common Permissions

| Permission | Purpose |
|---|---|
| `"storage"` | Access `chrome.storage` API for persisting data |
| `"activeTab"` | Temporary access to the currently active tab when user invokes the extension |
| `"scripting"` | Programmatic injection of content scripts via `chrome.scripting` |
| `"tabs"` | Access `chrome.tabs` API (tab URLs, titles, etc.) |
| `"clipboardWrite"` | Write to the clipboard from the extension context |

Host permissions (`host_permissions`) control which websites your extension can interact with.

---

## 2. Content Scripts

Content scripts run in the context of web pages. They can read and modify the DOM but execute in an "isolated world" -- they cannot access JavaScript variables defined by the page.

### Static Declaration (manifest.json)

```json
{
  "content_scripts": [
    {
      "matches": ["https://github.com/*"],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ]
}
```

**`run_at` options:**
- `"document_idle"` (default) -- after DOM complete and `window.onload`
- `"document_end"` -- after DOM complete but before subresources
- `"document_start"` -- before any DOM is constructed

### Content Script Communication

```typescript
// Listen for messages from the service worker
chrome.runtime.onMessage.addListener(
  (message: { type: string; data?: unknown }, sender, sendResponse) => {
    if (message.type === "COPY_BRANCH") {
      // Do something on the page
      sendResponse({ status: "ok" });
    }
    return true; // Keep channel open for async response
  }
);
```

---

## 3. Background Service Workers

In MV3, background pages are replaced by service workers. They are event-driven: start up when needed, handle events, then terminate when idle.

### Registration

```json
{
  "background": {
    "service_worker": "background.js",
    "type": "module"
  }
}
```

### Key Constraints

1. **No DOM access** -- no `window` or `document`
2. **Ephemeral** -- terminate after ~30 seconds of inactivity. Use `chrome.storage` for persistence.
3. **No `localStorage`** -- use `chrome.storage.local` or `chrome.storage.session`
4. **Event listeners must be registered synchronously** at the top level

### Communication: Service Worker to Content Script

```typescript
// Service worker sends to a specific tab:
const response = await chrome.tabs.sendMessage(tabId, {
  type: "COPY_BRANCH",
  data: { format: "feature/{id}-{title}" }
});
```

---

## 4. Options/Settings Pages

### Manifest Configuration

```json
{
  "options_ui": {
    "page": "options/options.html",
    "open_in_tab": true
  }
}
```

`"open_in_tab": true` opens in a full browser tab. `false` embeds in a dialog within `chrome://extensions`.

### Opening Programmatically

```typescript
chrome.runtime.openOptionsPage();
```

---

## 5. Chrome Storage API

Requires the `"storage"` permission.

### Storage Areas

| Area | Quota | Sync | Use Case |
|---|---|---|---|
| `chrome.storage.sync` | ~100 KB total, 8 KB/item | Yes, across browsers | User preferences |
| `chrome.storage.local` | 10 MB | No | Larger datasets, cached data |
| `chrome.storage.session` | 10 MB | No | Temporary session data |

### Core Methods

```typescript
// SET
await chrome.storage.sync.set({ branchFormat: "feature/{id}-{title}" });

// GET (with defaults)
const result = await chrome.storage.sync.get({ branchFormat: "{id}-{title}" });

// LISTEN for changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "sync") return;
  for (const [key, change] of Object.entries(changes)) {
    console.log(`${key}: ${change.oldValue} -> ${change.newValue}`);
  }
});
```

### TypeScript Helper Pattern

```typescript
export interface ExtensionSettings {
  branchFormat: string;
  autoMoveToInProgress: boolean;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  branchFormat: "{id}-{title}",
  autoMoveToInProgress: true,
};

export async function getSettings(): Promise<ExtensionSettings> {
  const result = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  return result as ExtensionSettings;
}

export async function updateSettings(
  partial: Partial<ExtensionSettings>
): Promise<void> {
  await chrome.storage.sync.set(partial);
}
```

---

## 6. TypeScript Setup

### Dependencies

```bash
npm install --save-dev typescript @types/chrome esbuild
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "dist",
    "rootDir": "src",
    "sourceMap": true,
    "declaration": false,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["chrome"]
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

---

## 7. Building and Bundling with esbuild

### Build Script

```javascript
// build.mjs
import * as esbuild from "esbuild";
import { copyFileSync, mkdirSync, existsSync, cpSync } from "fs";

const isWatch = process.argv.includes("--watch");

const commonOptions = {
  bundle: true,
  sourcemap: true,
  target: "chrome120",
  minify: !isWatch,
  logLevel: "info",
};

const entryPoints = [
  {
    entryPoints: ["src/background.ts"],
    outfile: "dist/background.js",
    format: "esm",       // ES modules for service worker
  },
  {
    entryPoints: ["src/content.ts"],
    outfile: "dist/content.js",
    format: "iife",       // IIFE for content scripts
  },
  {
    entryPoints: ["src/options/options.ts"],
    outfile: "dist/options/options.js",
    format: "iife",
  },
];

function copyStaticFiles() {
  mkdirSync("dist/options", { recursive: true });
  mkdirSync("dist/icons", { recursive: true });
  copyFileSync("manifest.json", "dist/manifest.json");
  copyFileSync("src/options/options.html", "dist/options/options.html");
  if (existsSync("icons")) {
    cpSync("icons", "dist/icons", { recursive: true });
  }
}

async function build() {
  copyStaticFiles();
  if (isWatch) {
    const contexts = await Promise.all(
      entryPoints.map((ep) => esbuild.context({ ...commonOptions, ...ep }))
    );
    await Promise.all(contexts.map((ctx) => ctx.watch()));
    console.log("Watching for changes...");
  } else {
    await Promise.all(
      entryPoints.map((ep) => esbuild.build({ ...commonOptions, ...ep }))
    );
    console.log("Build complete.");
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

### Loading in Chrome

1. Navigate to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist/` directory

### Distribution

```bash
cd dist && zip -r ../gh-extra.zip . && cd ..
```

---

## Sources

- [Manifest file format](https://developer.chrome.com/docs/extensions/reference/manifest)
- [Content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- [Extension service worker basics](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/basics)
- [chrome.storage API](https://developer.chrome.com/docs/extensions/reference/api/storage)
- [Message passing](https://developer.chrome.com/docs/extensions/develop/concepts/messaging)
- [esbuild Getting Started](https://esbuild.github.io/getting-started/)
- [Loading unpacked extensions](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world)
