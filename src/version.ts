type AppEnvironment = 'dev' | 'staging' | 'prod';

declare const __APP_VERSION__: string | undefined;
declare const __BUILD_TIME__: string | undefined;
declare const __GIT_COMMIT__: string | undefined;

const resolveAppEnvironment = (): AppEnvironment => {
  const mode =
    (import.meta as ImportMeta & { env?: Record<string, string> }).env?.MODE ?? '';
  const normalized = mode.toLowerCase();
  if (normalized === 'production' || normalized === 'prod') {
    return 'prod';
  }
  if (normalized === 'staging') {
    return 'staging';
  }
  return 'dev';
};

export const appVersion =
  typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';

export const buildTime =
  typeof __BUILD_TIME__ === 'string' ? __BUILD_TIME__ : '';

export const gitCommit =
  typeof __GIT_COMMIT__ === 'string' ? __GIT_COMMIT__ : '';

export const lastUpdateTitle = 'Integrazione GitHub Issues e persistenza Token';

export const lastUpdateDate = '2026-01-23';

export const lastUpdateNotes = [
  'Nuova sezione Issues per la gestione diretta dei bug/richieste.',
  'Configurazione persistente del GitHub PAT in locale (LocalStorage).',
  'Interfaccia di validazione token con test preventivo.',
  'Supporto Web: proxy server-side con GITHUB_ISSUES_TOKEN.',
  'Supporto Web: upload immagini via GitHub Content API (main/public/uploads).'
];

export const appEnvironment = resolveAppEnvironment();
