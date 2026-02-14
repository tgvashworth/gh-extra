export interface Settings {
  branchFormat: string;
}

export const DEFAULT_SETTINGS: Settings = {
  branchFormat: "{id}-{title}",
};

export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  return result as Settings;
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.sync.set(settings);
}
