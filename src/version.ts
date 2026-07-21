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

export const lastUpdateTitle = 'Manuale operativo e semplificazione aggiornamenti';

export const lastUpdateDate = '2026-07-20';

export const lastUpdateNotes = [
  'Nuova sezione Manuale con procedure, glossario, ruoli, checklist e risoluzione problemi.',
  'Navigazione interna del manuale compatibile con HashRouter.',
  'Rimosso dalla pagina Versione il download ZIP legato al precedente flusso offline.',
  'Il comando "Aggiorna tutte le fonti" diventa l\'unica azione principale per il refresh dei dati.',
  'Documentati sicurezza del GitHub PAT, snapshot e aggiornamenti parziali.'
];

export const appEnvironment = resolveAppEnvironment();
