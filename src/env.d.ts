/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ALTENAR_INTEGRATION: string;
  readonly VITE_ALTENAR_API_URL: string;
  readonly VITE_API_BASE_URL: string;
  readonly VITE_HOST_ORIGINS: string;
  readonly VITE_DEFAULT_THEME: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue';

  const component: DefineComponent<
    Record<string, never>,
    Record<string, never>,
    unknown
  >;

  export default component;
}
