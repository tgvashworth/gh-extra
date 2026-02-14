import { extractIssueData } from "./lib/extract";
import { generateBranchName } from "./lib/branch";
import { getSettings } from "./lib/storage";
import { moveToInProgress } from "./lib/status";
import { showToast } from "./lib/toast";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "copy-branch") {
    handleCopyBranch().then(sendResponse);
    return true; // Keep channel open for async response
  }
});

function copyToClipboard(text: string): boolean {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand("copy");
  textarea.remove();
  return ok;
}

async function handleCopyBranch(): Promise<{ success: boolean }> {
  const issueData = extractIssueData();
  if (!issueData) {
    showToast("Not on a GitHub issue page", "warning");
    return { success: false };
  }

  const settings = await getSettings();
  const branchName = generateBranchName(settings.branchFormat, issueData);

  if (!copyToClipboard(branchName)) {
    showToast("Failed to copy to clipboard", "warning");
    return { success: false };
  }

  showToast(`Copied: ${branchName}`);

  // Move to "In Progress" (non-blocking — don't fail the whole operation)
  const statusResult = await moveToInProgress();
  if (!statusResult.ok) {
    showToast(statusResult.reason, "warning");
  }

  return { success: true };
}
