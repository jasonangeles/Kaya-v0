// Manually define ImportMetaEnv to avoid 'vite/client' resolution errors
interface ImportMetaEnv {
  readonly VITE_API_KEY: string;
  [key: string]: any;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
