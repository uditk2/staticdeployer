import { promises as fs } from 'node:fs';
import path from 'node:path';

export async function* walkDir(dir: string): AsyncGenerator<string, void, unknown> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkDir(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

export function relPath(file: string, root: string): string {
  return path.relative(root, file).split(path.sep).join('/');
}