const IN_PROGRESS = "in progress";

export async function moveToInProgress(): Promise<
  { ok: true } | { ok: false; reason: string }
> {
  // Find the Projects sidebar section
  const statusButton = findStatusButton();
  if (!statusButton) {
    return { ok: false, reason: "Issue is not in a project" };
  }

  // Check if already "In Progress"
  if (statusButton.textContent?.toLowerCase().includes(IN_PROGRESS)) {
    return { ok: true }; // Already in progress, nothing to do
  }

  // Click to open the status dropdown
  statusButton.click();

  // Wait for options to appear in the listbox (not just the listbox container)
  const firstOption = await waitForElement<HTMLElement>(
    '[role="dialog"] [role="listbox"] [role="option"]',
    2000
  );
  if (!firstOption) {
    return { ok: false, reason: "Could not open status dropdown" };
  }

  const listbox = firstOption.closest('[role="listbox"]')!;
  const options = listbox.querySelectorAll('[role="option"]');
  let inProgressOption: Element | null = null;

  for (const option of options) {
    const labelId = option.getAttribute("aria-labelledby");
    if (labelId) {
      const labelEl = document.getElementById(labelId.split(" ")[0]);
      if (labelEl?.textContent?.toLowerCase().trim() === IN_PROGRESS) {
        inProgressOption = option;
        break;
      }
    }
    // Fallback: check direct text content
    const text = option.textContent?.toLowerCase() ?? "";
    if (text.startsWith(IN_PROGRESS)) {
      inProgressOption = option;
      break;
    }
  }

  if (!inProgressOption) {
    // Close the dropdown by pressing Escape on the dialog
    const dialog = document.querySelector('[role="dialog"]');
    (dialog ?? document).dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
    );
    return { ok: false, reason: 'No "In Progress" option found in project' };
  }

  // Click the "In Progress" option
  (inProgressOption as HTMLElement).click();

  return { ok: true };
}

function findStatusButton(): HTMLElement | null {
  // The Projects sidebar section contains elements with project status values.
  // Look for sidebar items that reference project status options like
  // "Todo", "In Progress", "Done" etc.
  // The sidebar uses a structure where each project field has a clickable button.

  // Strategy: find all sidebar buttons/elements that contain known status texts
  // within the sidebar area (right side of the issue page).
  const sidebar = document.querySelector(
    '.Layout-sidebar, [class*="sidebar"], aside'
  );
  if (!sidebar) return null;

  // Look for elements that are clickable and contain status-like text
  // GitHub renders project fields as buttons in the sidebar
  const candidates = sidebar.querySelectorAll<HTMLElement>(
    'button, [role="button"], a[data-testid]'
  );

  const statusTexts = ["todo", "in progress", "done", "backlog", "ready", "in review"];

  for (const el of candidates) {
    const text = el.textContent?.toLowerCase().trim() ?? "";
    if (statusTexts.some((s) => text === s || text.startsWith(s))) {
      return el;
    }
  }

  // Fallback: look for the "Status" label and find the adjacent interactive element
  const labels = sidebar.querySelectorAll("span, div, p");
  for (const label of labels) {
    if (label.textContent?.trim() === "Status") {
      // Look for the next sibling or nearby interactive element
      const parent = label.closest("[class]");
      if (parent) {
        const btn = parent.querySelector<HTMLElement>(
          'button, [role="button"]'
        );
        if (btn) return btn;
      }
    }
  }

  return null;
}

function waitForElement<T extends Element>(
  selector: string,
  timeout: number
): Promise<T | null> {
  return new Promise((resolve) => {
    const existing = document.querySelector<T>(selector);
    if (existing) {
      resolve(existing);
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout>;
    const observer = new MutationObserver(() => {
      const el = document.querySelector<T>(selector);
      if (el) {
        observer.disconnect();
        clearTimeout(timeoutId);
        resolve(el);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    timeoutId = setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeout);
  });
}
