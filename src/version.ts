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

export const lastUpdateTitle = 'Release locale allineata ai filtri globali';

export const lastUpdateDate = '2026-01-16';

export const lastUpdateNotes = [
  'Release locale allineata alla logica Filtri Globali/Dashboard.',
  'Normalizzazione filtri aggiornata e coerente in offline.',
  'Build release ripulita per evitare asset obsoleti.',
  'Dataset locale aggiornato con snapshot correnti.'
];

export const appEnvironment = resolveAppEnvironment();
