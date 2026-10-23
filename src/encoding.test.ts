// Guards against text that was saved with the wrong encoding (e.g. "·" turning into "Â·").
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const SKIP = new Set(['node_modules', 'dist', '.git', '.impeccable', 'encoding.test.ts']);
const EXT = /\.(ts|mjs|html|css|md|yml|json)$/;
// UTF-8 bytes of common characters (· — − → × ≈ …) misread as Windows-1252
const GARBLED = /Ã.|Â[· -¿]|â€|â†|â‰/;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    if (SKIP.has(name)) return [];
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : EXT.test(name) ? [path] : [];
  });
}

describe('text encoding', () => {
  it('has no garbled characters in any source file', () => {
    const bad = files(ROOT).filter(f => GARBLED.test(readFileSync(f, 'utf8')));
    expect(bad.map(f => f.slice(ROOT.length + 1))).toEqual([]);
  });

  it('has no byte-order mark at the start of source files', () => {
    const bad = files(ROOT).filter(f => readFileSync(f).subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])));
    expect(bad.map(f => f.slice(ROOT.length + 1))).toEqual([]);
  });
});
