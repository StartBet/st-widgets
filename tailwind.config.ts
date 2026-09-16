import { stTailwindPlugins, stTailwindTheme } from '@startbet/st-core-ui';

export default {
  content: [
    './*.html',
    './src/**/*.{vue,ts}',
    './node_modules/@startbet/st-core-ui/dist/**/*.{js,cjs,mjs}'
  ],
  theme: {
    extend: stTailwindTheme
  },
  plugins: stTailwindPlugins
};
