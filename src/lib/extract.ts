export interface IssueData {
  owner: string;
  repo: string;
  id: number;
  title: string;
}

export function extractIssueData(): IssueData | null {
  const urlMatch = window.location.pathname.match(
    /^\/([^/]+)\/([^/]+)\/issues\/(\d+)/
  );
  if (!urlMatch) return null;

  const owner = urlMatch[1];
  const repo = urlMatch[2];
  const id = parseInt(urlMatch[3], 10);
  const title = getIssueTitle();

  if (!title) return null;

  return { owner, repo, id, title };
}

function getIssueTitle(): string | null {
  // Try embedded React app data first (most reliable)
  const reactApp = document.querySelector(
    'react-app[app-name="issues-react"]'
  );
  if (reactApp) {
    const script = reactApp.querySelector(
      'script[data-target="react-app.embeddedData"]'
    );
    if (script?.textContent) {
      try {
        const data = JSON.parse(script.textContent);
        const headline = data?.payload?.structured_data?.headline;
        if (headline) return headline;
      } catch {
        // Fall through to other methods
      }
    }
  }

  // Fallback: parse document.title
  // Format: "{Title} · Issue #{number} · {owner}/{repo}"
  const titleMatch = document.title.match(/^(.*?)\s+·\s+Issue #\d+/);
  if (titleMatch) return titleMatch[1];

  return null;
}
