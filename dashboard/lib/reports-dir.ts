import { readdir } from "fs/promises";
import path from "path";

const CANDIDATES = [
  path.join(process.cwd(), "reports"),
  path.resolve(process.cwd(), "..", "reports"),
];

export async function getReportsDir(): Promise<string> {
  for (const dir of CANDIDATES) {
    try {
      await readdir(dir);
      return dir;
    } catch {
      continue;
    }
  }
  return CANDIDATES[0];
}
