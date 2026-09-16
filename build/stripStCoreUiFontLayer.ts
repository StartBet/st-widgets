import type { Plugin } from 'vite';

const FONT_IMPORT =
  /^[^\S\n]*@import\s+["'][^"']*(?:montserrat|base-neue)[^"']*["']\s*;[^\S\n]*\n?/gm;

const GLOBAL_SCROLLBAR =
  /^[^\S\n]*\*::-webkit-scrollbar[^{]*\{[^}]*\}[^\S\n]*\n?/gm;

const PACKAGE_ID = '@startbet/st-core-ui';

const unwrapBaseLayer = (code: string) => {
  const opener = /@layer\s+base\s*\{/;
  let out = code;

  for (;;) {
    const match = opener.exec(out);
    if (!match) return out;

    const start = match.index;
    const inner = start + match[0].length;
    let depth = 1;
    let cursor = inner;

    while (cursor < out.length && depth > 0) {
      const char = out[cursor];
      if (char === '{') depth += 1;
      else if (char === '}') depth -= 1;
      cursor += 1;
    }

    if (depth !== 0) return out;

    out =
      out.slice(0, start) + out.slice(inner, cursor - 1) + out.slice(cursor);
  }
};

export const stripStCoreUiFontLayer = (): Plugin => ({
  name: 'st-core-ui:strip-font-layer',
  enforce: 'pre',
  transform(code: string, id: string) {
    const [file] = id.split('?');

    if (!file || !file.endsWith('.css')) return;
    if (!file.split('\\').join('/').includes(PACKAGE_ID)) return;

    const next = unwrapBaseLayer(
      code.replace(FONT_IMPORT, '').replace(GLOBAL_SCROLLBAR, '')
    );

    if (next === code) return;

    return { code: next, map: null };
  }
});
