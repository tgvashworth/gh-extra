import { getSettings, saveSettings, DEFAULT_SETTINGS } from "../lib/storage";
import { generateBranchName } from "../lib/branch";

const EXAMPLE_DATA = {
  id: 42,
  title: "Fix login button not responding on mobile",
  repo: "my-app",
  owner: "acme",
};

const formatInput = document.getElementById("branchFormat") as HTMLInputElement;
const saveButton = document.getElementById("save") as HTMLButtonElement;
const statusEl = document.getElementById("status") as HTMLSpanElement;
const previewEl = document.getElementById("preview") as HTMLDivElement;

function updatePreview(): void {
  const format = formatInput.value || DEFAULT_SETTINGS.branchFormat;
  const branch = generateBranchName(format, EXAMPLE_DATA);

  previewEl.textContent = "";
  const strong = document.createElement("strong");
  strong.textContent = "Preview: ";
  const code = document.createElement("code");
  code.textContent = branch;
  previewEl.appendChild(strong);
  previewEl.appendChild(code);
}

async function load(): Promise<void> {
  const settings = await getSettings();
  formatInput.value = settings.branchFormat;
  updatePreview();
}

async function save(): Promise<void> {
  await saveSettings({
    branchFormat: formatInput.value || DEFAULT_SETTINGS.branchFormat,
  });
  statusEl.textContent = "Saved!";
  setTimeout(() => {
    statusEl.textContent = "";
  }, 2000);
}

formatInput.addEventListener("input", updatePreview);
saveButton.addEventListener("click", save);

load();
