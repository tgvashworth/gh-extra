# gh-extra

Chrome extension that adds a keyboard shortcut to GitHub issue pages. Press the shortcut and it:

1. Copies a branch name generated from the issue (e.g. `42-fix-login-button`)
2. Moves the issue to "In Progress" in its GitHub Project

No API tokens needed — works by manipulating the page directly using your existing GitHub session.

## Install

```sh
npm install
npm run build
```

Then load the `dist/` folder as an unpacked extension at `chrome://extensions/` (enable Developer Mode).

## Configuration

**Keyboard shortcut** — configure at `chrome://extensions/shortcuts`. Default is `Alt+Shift+C`.

**Branch format** — right-click the extension icon and choose Options, or go to the extension's settings page. The format uses template variables:

| Variable | Description |
|----------|-------------|
| `{id}` | Issue number |
| `{title}` | Issue title (slugified) |
| `{repo}` | Repository name |
| `{owner}` | Repository owner |

Default format: `{id}-{title}`

## Development

```sh
npm run watch    # rebuild on changes
npm run typecheck
```
