import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

export const htmlEntries = (
  root: string,
  exclude: string[] = []
): Record<string, string> =>
  Object.fromEntries(
    readdirSync(root)
      .filter((file) => file.endsWith('.html'))
      .filter((file) => !exclude.includes(file))
      .map((file) => [file.slice(0, -'.html'.length), resolve(root, file)])
  );
