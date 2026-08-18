import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "fs";
import { dirname, resolve, extname } from "path";

export function ensureDirectoryExists(path: string): void {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function directoryExists(path: string): boolean {
  return existsSync(path);
}

export function fileExists(path: string): boolean {
  return existsSync(path);
}

export function readTextFile(path: string): string {
  return readFileSync(path, "utf-8");
}

export function readBinaryFile(path: string): Buffer {
  return readFileSync(path);
}

export function writeTextFile(path: string, content: string): void {
  writeFileSync(path, content, "utf-8");
}

export function writeJsonFile<T>(path: string, data: T, indent = 4): void {
  ensureDirectoryExists(path);
  writeFileSync(path, JSON.stringify(data, null, indent), "utf-8");
}

export function readJsonFile<T>(path: string): T {
  if (!existsSync(path)) {
    throw new Error(`File not found: ${path}`);
  }
  const content = readFileSync(path, "utf-8");
  return JSON.parse(content) as T;
}

export function listFiles(directory: string): string[] {
  if (!existsSync(directory)) {
    return [];
  }
  return readdirSync(directory);
}

export function listFilesByExtension(directory: string, extension: string): string[] {
  const normalizedExt = extension.startsWith(".") ? extension : `.${extension}`;
  return listFiles(directory).filter(
    (file) => extname(file).toLowerCase() === normalizedExt.toLowerCase()
  );
}

export function resolveFilePath(directory: string, filename: string): string {
  return resolve(directory, filename);
}
