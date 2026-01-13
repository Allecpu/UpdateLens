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

export const lastUpdateTitle = 'Pagina versione con refresh ZIP';

export const lastUpdateDate = '2026-01-13';

export const lastUpdateNotes = [
  'Aggiunta pagina versione con dettagli build e sorgente.',
  'Stamp versione inserito in index.html per traceability.',
  'Navigazione aggiornata con voce Versione.',
  'Avvio refresh snapshot e download ZIP dalla pagina Versione.'
];

export const appEnvironment = resolveAppEnvironment();
