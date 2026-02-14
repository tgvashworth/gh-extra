# DOM Manipulation Approach for Status Changes

## Overview

Instead of using the GitHub API with a PAT, we can manipulate the GitHub page DOM directly. When the user clicks a status option in the Projects sidebar, GitHub's own React app fires a `POST /_graphql` mutation using the user's existing session. Our extension simply simulates those clicks.

## Sidebar Projects Section Structure

The issue sidebar contains a "Projects" section when an issue belongs to a project. The status is displayed as a clickable button.

### Finding the Status Button

The sidebar has a section for each project. The status is rendered as a button that opens a dropdown. Key selectors:

```javascript
// The Projects section contains buttons showing current status
// Look for the status text within the sidebar project items
// The button that triggers the dropdown has these characteristics:
// - It's within the sidebar area
// - Contains text like "Todo", "In Progress", "Done"
// - When clicked, opens a dialog overlay with a listbox
```

### The Status Dropdown (after clicking)

When the status button is clicked, a dialog overlay appears:

```html
<div class="prc-Overlay-Overlay-jfs-T" role="dialog">
  <!-- Contains a filter input and a listbox -->
  <input class="prc-components-Input-IwWrt" aria-controls="_r_8h_" />
  <ul id="_r_8h_" role="listbox" class="prc-ActionList-ActionList-rPFF2">
    <li role="option" data-id="f75ad846" aria-selected="true">
      <!-- Todo -->
    </li>
    <li role="option" data-id="47fc9ee4" aria-selected="false">
      <!-- In Progress -->
    </li>
    <li role="option" data-id="98236657" aria-selected="false">
      <!-- Done -->
    </li>
  </ul>
</div>
```

### Option Item Structure

Each `[role="option"]` element has:

| Attribute | Example | Purpose |
|-----------|---------|---------|
| `data-id` | `"47fc9ee4"` | GraphQL option ID |
| `aria-selected` | `"true"` / `"false"` | Whether this is the current status |
| `role` | `"option"` | ARIA role for accessibility |
| Text content | `"In ProgressThis is actively being worked on"` | Status name + description |

### Confirmed Data IDs

From the live inspection of a project with default status options:

| Status | `data-id` | Description |
|--------|-----------|-------------|
| Todo | `f75ad846` | "This item hasn't been started" |
| In Progress | `47fc9ee4` | "This is actively being worked on" |
| Done | `98236657` | "This has been completed" |

**Note:** These IDs are project-specific. Each project generates its own option IDs. The extension must find options by text content, not by ID.

## Implementation Strategy

### Step 1: Find the Projects sidebar section

```javascript
// The sidebar contains project status indicators
// We need to find the clickable element that shows the current status
// and click it to open the dropdown
```

### Step 2: Open the status dropdown

```javascript
// Click the status button to open the overlay dialog
statusButton.click();
// Wait for the overlay to appear
await waitForElement('[role="dialog"] [role="listbox"]');
```

### Step 3: Find and click "In Progress"

```javascript
const listbox = document.querySelector('[role="dialog"] [role="listbox"]');
const options = listbox.querySelectorAll('[role="option"]');
for (const option of options) {
  // Match by text content - look for "In Progress" in the label
  const labelId = option.getAttribute('aria-labelledby');
  const label = document.getElementById(labelId.split(' ')[0]);
  if (label && label.textContent.trim() === 'In Progress') {
    option.click();
    break;
  }
}
```

### Step 4: Close the overlay (happens automatically)

Clicking an option triggers:
1. A `POST /_graphql` request with the `updateProjectV2ItemFieldValue` mutation
2. The overlay closes
3. The sidebar updates to show the new status

## Network Requests (What GitHub Does Under the Hood)

When a status option is clicked, GitHub's React app fires:

1. **POST `/_graphql`** - The mutation to update the project item field value (same as the public API's `updateProjectV2ItemFieldValue`)
2. **GET `/_graphql`** - Follow-up queries to refresh the UI state

The mutation payload matches the public GraphQL API structure:
```json
{
  "query": "mutation { updateProjectV2ItemFieldValue(input: { projectId: \"...\", itemId: \"...\", fieldId: \"...\", value: { singleSelectOptionId: \"...\" } }) { ... } }"
}
```

## Advantages of DOM Manipulation

1. **No PAT required** - Uses the user's existing GitHub session
2. **No OAuth setup** - No app registration, no redirect flows
3. **No token storage** - Nothing sensitive to manage
4. **Matches user permissions** - If the user can change status via the UI, the extension can too
5. **Simpler extension** - Settings page only needs branch format template

## Limitations

1. **Requires the issue to be in a project** - If there's no Projects section in the sidebar, we can't change status
2. **DOM selectors may change** - GitHub can update their UI, breaking selectors
3. **Only works on issue pages** - Must be on `github.com/{owner}/{repo}/issues/{number}`
4. **Status name matching** - We match "In Progress" by text, which may differ in non-English locales or custom status names

## Robustness Considerations

- Use `MutationObserver` or polling to wait for the dropdown to appear after clicking
- Match status options case-insensitively
- If the issue isn't in a project, show a notification and skip the status change
- If "In Progress" option isn't found, show a notification with available options
