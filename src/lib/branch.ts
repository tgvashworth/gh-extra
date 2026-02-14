import { IssueData } from "./extract";

export function generateBranchName(
  format: string,
  data: IssueData
): string {
  const slugTitle = slugify(data.title);

  return format
    .replace(/\{id\}/g, String(data.id))
    .replace(/\{title\}/g, slugTitle)
    .replace(/\{repo\}/g, data.repo)
    .replace(/\{owner\}/g, data.owner);
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
