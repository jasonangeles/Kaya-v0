// Manually define ImportMetaEnv to avoid 'vite/client' resolution errors
interface ImportMetaEnv {
  readonly VITE_API_KEY: string;
  [key: string]: any;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
  glob: (pattern: string, options?: {
    eager?: boolean;
    query?: string;
    import?: string;
  }) => Record<string, any>;
}
