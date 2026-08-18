import { parse as csvParse } from "papaparse";
import { readTextFile, writeTextFile, ensureDirectoryExists } from "./file_system.js";

export function readCsvFile<T>(path: string): T[] {
  const content = readTextFile(path);
  const result = csvParse<T>(content, {
    header: true,
    skipEmptyLines: true,
  });
  return result.data;
}

export function writeCsvFile<T>(
  path: string,
  data: T[],
  columns?: string[]
): void {
  if (data.length === 0) {
    ensureDirectoryExists(path);
    writeTextFile(path, "");
    return;
  }

  const headers = columns ?? Object.keys(data[0] as object);
  const header = headers.join(",");
  const rows = data
    .map((row) =>
      headers.map((col) => (row as Record<string, unknown>)[col]).join(",")
    )
    .join("\n");

  ensureDirectoryExists(path);
  writeTextFile(path, `${header}\n${rows}`);
}
