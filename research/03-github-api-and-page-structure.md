# GitHub API, Page Structure, and Authentication

## 1. Extracting Issue Data from the Page (No API Needed)

A content script can extract all relevant issue metadata without any API calls.

### From the URL

```javascript
const match = window.location.pathname.match(
  /^\/([^/]+)\/([^/]+)\/(issues|pull)\/(\d+)/
);
// match[1] = owner (e.g. "facebook")
// match[2] = repo (e.g. "react")
// match[3] = type ("issues" or "pull")
// match[4] = number (e.g. "31407")
```

### From Meta Tags

GitHub embeds useful metadata in `<meta>` tags:

```html
<!-- Repository info -->
<meta name="octolytics-dimension-repository_nwo" content="facebook/react">
<meta name="octolytics-dimension-repository_id" content="10270250">

<!-- Owner -->
<meta name="octolytics-dimension-user_login" content="facebook">

<!-- Current logged-in user -->
<meta name="user-login" content="tgvashworth">

<!-- Issue database ID -->
<meta name="hovercard-subject-tag" content="issue:2630641287">
```

### From the Embedded React App Data

GitHub issue pages use a `<react-app>` element containing a JSON payload:

```javascript
const reactApp = document.querySelector('react-app[app-name="issues-react"]');
const script = reactApp?.querySelector(
  'script[data-target="react-app.embeddedData"]'
);
const data = JSON.parse(script?.textContent || '{}');
```

This payload contains:
- `data.appPayload.scoped_repository` -- `{ id, owner, name, is_archived }`
- `data.appPayload.current_user` -- `{ login, id }`
- `data.payload.structured_data` -- JSON-LD with `headline` (issue title), `url`, `datePublished`, `author`

The `scoped_repository.id` is the GraphQL node ID (base64-encoded), usable directly in GraphQL API calls.

### From `document.title`

Pattern: `{Issue Title} . Issue #{number} . {owner}/{repo}`

```javascript
const titleMatch = document.title.match(
  /^(.*?)\s+·\s+Issue #(\d+)\s+·\s+(.+?)\/(.+)$/
);
```

### Complete Extraction Function

```javascript
function extractIssueData() {
  const urlMatch = window.location.pathname.match(
    /^\/([^/]+)\/([^/]+)\/(issues|pull)\/(\d+)/
  );
  if (!urlMatch) return null;

  const getMeta = (name) =>
    document.querySelector(`meta[name="${name}"]`)?.content;

  const reactApp = document.querySelector('react-app[app-name="issues-react"]');
  const embeddedScript = reactApp?.querySelector(
    'script[data-target="react-app.embeddedData"]'
  );
  let embeddedData = null;
  try {
    embeddedData = JSON.parse(embeddedScript?.textContent || '{}');
  } catch (e) {}

  return {
    owner: urlMatch[1],
    repo: urlMatch[2],
    type: urlMatch[3],
    number: parseInt(urlMatch[4]),
    title: embeddedData?.payload?.structured_data?.headline,
    repoNwo: getMeta('octolytics-dimension-repository_nwo'),
    repoNodeId: embeddedData?.appPayload?.scoped_repository?.id,
    currentUser: getMeta('user-login'),
  };
}
```

---

## 2. GitHub REST API for Issues

### Get a Single Issue

```
GET /repos/{owner}/{repo}/issues/{issue_number}
Authorization: Bearer <TOKEN>
```

Response includes: `id`, `number`, `title`, `body`, `state` (open/closed), `labels`, `assignees`, `node_id`.

### Important Limitation

The REST API only supports `state` as `open` or `closed`. There is **no "in progress" concept** at the issue level. Status tracking is handled exclusively through **GitHub Projects v2** via the GraphQL API.

---

## 3. GitHub Projects v2 API (Setting "In Progress")

Moving an issue to "In Progress" requires multiple GraphQL calls.

### Step 1: Find the Project and Status Field

```graphql
query {
  repository(owner: "OWNER", name: "REPO") {
    issue(number: NUMBER) {
      projectItems(first: 20) {
        nodes {
          id
          project {
            id
            title
            fields(first: 20) {
              nodes {
                ... on ProjectV2SingleSelectField {
                  id
                  name
                  options {
                    id
                    name
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
```

This returns the project item ID, the project ID, and the Status field with its option IDs.

### Step 2: Update the Status

```graphql
mutation {
  updateProjectV2ItemFieldValue(
    input: {
      projectId: "PROJECT_ID"
      itemId: "ITEM_ID"
      fieldId: "STATUS_FIELD_ID"
      value: {
        singleSelectOptionId: "IN_PROGRESS_OPTION_ID"
      }
    }
  ) {
    projectV2Item {
      id
    }
  }
}
```

### If the Issue Isn't in a Project Yet

```graphql
mutation {
  addProjectV2ItemById(
    input: {
      projectId: "PROJECT_ID"
      contentId: "ISSUE_NODE_ID"
    }
  ) {
    item {
      id
    }
  }
}
```

Note: You cannot add and update an item in the same call.

### Required IDs Summary

| Parameter | How to Obtain |
|-----------|---------------|
| `projectId` | Query `organization.projectV2(number:)` or from issue's `projectItems` |
| `itemId` | Query `issue.projectItems.nodes.id` |
| `fieldId` | Query project's `fields.nodes` for the Status field |
| `singleSelectOptionId` | From the `options` array on the Status field |

---

## 4. Authentication Options

### For a Chrome Extension

| Method | Complexity | Backend Needed? | Best For |
|--------|-----------|----------------|----------|
| **User-provided PAT** | Low | No | Personal use, simplest approach |
| **OAuth Web Flow** | Medium | Yes (for client_secret) | Multi-user apps |
| **Device Flow** | High | Yes | Not practical for extensions |

### Recommended: User-provided PAT (Simplest)

1. User generates a PAT at GitHub Settings > Developer settings > Personal access tokens
2. Extension stores it in `chrome.storage.local`
3. Used as `Authorization: Bearer <token>` in API calls

### Required Token Scopes

For this extension's functionality:

| Scope | Purpose |
|-------|---------|
| `repo` | Read issue details (title, number) -- needed for private repos |
| `project` | Read/write project items (to set "In Progress" status) |
| `read:project` | Read-only alternative if only reading project data |

For fine-grained PATs, set:
- **Issues**: `read`
- **Projects**: `read` and `write`

### Token Storage

```javascript
// Store
chrome.storage.local.set({ githubToken: 'ghp_xxxx' });

// Retrieve
const { githubToken } = await chrome.storage.local.get('githubToken');
```

### GraphQL API Endpoint

```
POST https://api.github.com/graphql
Authorization: Bearer <TOKEN>
Content-Type: application/json

{ "query": "..." }
```

---

## 5. OAuth Scopes Reference

| Scope | Grants |
|-------|--------|
| `repo` | Full access to repositories (includes issues) |
| `public_repo` | Read/write for public repos only |
| `project` | Read/write to user and organization projects |
| `read:project` | Read-only access to projects |
| `read:org` | Read-only org membership and projects |

---

## 6. End-to-End Flow Summary

For the Chrome extension to copy a branch name and move the issue to "In Progress":

1. **Extract context from the page** (no API): owner, repo, issue number from URL; title from embedded data
2. **Generate branch name** using the configured template (e.g., `feature/{id}-{title}`)
3. **Copy to clipboard** using `navigator.clipboard.writeText()`
4. **Authenticate** using stored PAT from `chrome.storage.local`
5. **Find the project item** (GraphQL query on `issue.projectItems`)
6. **Get Status field + "In Progress" option ID** (can be cached after first lookup)
7. **Update the status** (GraphQL mutation `updateProjectV2ItemFieldValue`)

---

## Sources

- [REST API endpoints for issues - GitHub Docs](https://docs.github.com/en/rest/issues/issues)
- [Using the API to manage Projects - GitHub Docs](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-api-to-manage-projects)
- [Scopes for OAuth apps - GitHub Docs](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps)
- [Authenticating to the REST API - GitHub Docs](https://docs.github.com/en/rest/authentication/authenticating-to-the-rest-api)
- [GraphQL mutations reference - GitHub Docs](https://docs.github.com/en/graphql/reference/mutations)
