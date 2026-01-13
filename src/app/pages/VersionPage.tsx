import { useState } from 'react';
import {
  appEnvironment,
  appVersion,
  buildTime,
  gitCommit,
  lastUpdateDate,
  lastUpdateNotes,
  lastUpdateTitle
} from '../../version';

type RefreshOutcome = 'idle' | 'running' | 'success' | 'error';

type RefreshInfo = {
  status: RefreshOutcome;
  lastRefreshAt: string | null;
  lastResult: 'success' | 'error' | null;
  microsoftCount: number | null;
  eosCount: number | null;
  message?: string | null;
};

type ReleaseState = 'idle' | 'running' | 'success' | 'error';

type ToastInfo = {
  type: 'success' | 'error' | 'info';
  message: string;
};

const REFRESH_STORAGE_KEY = 'updatelens.refresh.status';

const loadRefreshInfo = (): RefreshInfo => {
  if (typeof window === 'undefined') {
    return {
      status: 'idle',
      lastRefreshAt: null,
      lastResult: null,
      microsoftCount: null,
      eosCount: null,
      message: null
    };
  }
  try {
    const raw = window.localStorage.getItem(REFRESH_STORAGE_KEY);
    if (!raw) {
      throw new Error('missing');
    }
    return JSON.parse(raw) as RefreshInfo;
  } catch {
    return {
      status: 'idle',
      lastRefreshAt: null,
      lastResult: null,
      microsoftCount: null,
      eosCount: null,
      message: null
    };
  }
};

const persistRefreshInfo = (info: RefreshInfo) => {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(REFRESH_STORAGE_KEY, JSON.stringify(info));
};

const parseFilename = (contentDisposition: string | null): string | null => {
  if (!contentDisposition) {
    return null;
  }
  const match = contentDisposition.match(/filename="([^"]+)"/i);
  return match?.[1] ?? null;
};

const isFileProtocol =
  typeof window !== 'undefined' && window.location.protocol === 'file:';

const VersionPage = () => {
  const buildLabel = buildTime || 'N/D';
  const commitLabel = gitCommit || 'N/D';
  const [refreshInfo, setRefreshInfo] = useState<RefreshInfo>(() => loadRefreshInfo());
  const [toast, setToast] = useState<ToastInfo | null>(null);
  const [releaseState, setReleaseState] = useState<ReleaseState>('idle');

  const updateRefreshInfo = (next: RefreshInfo) => {
    setRefreshInfo(next);
    persistRefreshInfo(next);
  };

  const triggerToast = (next: ToastInfo) => {
    setToast(next);
    window.setTimeout(() => setToast(null), 3500);
  };

  const handleRefresh = async () => {
    if (refreshInfo.status === 'running') {
      return;
    }
    const runningState: RefreshInfo = {
      ...refreshInfo,
      status: 'running',
      message: 'Aggiornamento in corso...',
      lastResult: null
    };
    updateRefreshInfo(runningState);
    triggerToast({ type: 'info', message: 'Aggiornamento in corso...' });

    try {
      const response = await fetch('/api/refresh-zip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sources: ['microsoft', 'eos'] })
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        const errorMessage =
          errorPayload?.error || `Errore refresh (${response.status}).`;
        throw new Error(errorMessage);
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get('content-disposition');
      const filename =
        parseFilename(contentDisposition) ??
        `UpdateLens_refresh_${new Date().toISOString().replace(/[:.]/g, '-')}.zip`;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(url);

      const refreshAt =
        response.headers.get('x-updatelens-refresh-at') ?? new Date().toISOString();
      const microsoftCount = Number(
        response.headers.get('x-updatelens-items-microsoft') ?? 0
      );
      const eosCount = Number(
        response.headers.get('x-updatelens-items-eos') ?? 0
      );

      updateRefreshInfo({
        status: 'success',
        lastRefreshAt: refreshAt,
        lastResult: 'success',
        microsoftCount,
        eosCount,
        message: 'Aggiornamento completato'
      });
      triggerToast({
        type: 'success',
        message: 'Aggiornamento completato, download avviato.'
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore inatteso.';
      updateRefreshInfo({
        status: 'error',
        lastRefreshAt: refreshInfo.lastRefreshAt,
        lastResult: 'error',
        microsoftCount: refreshInfo.microsoftCount,
        eosCount: refreshInfo.eosCount,
        message
      });
      triggerToast({ type: 'error', message });
    }
  };

  const handleReleaseDownload = async () => {
    if (releaseState === 'running') {
      return;
    }
    setReleaseState('running');
    triggerToast({ type: 'info', message: 'Generazione release in corso...' });

    try {
      const response = await fetch('/api/release-zip', { method: 'POST' });
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        const errorMessage =
          errorPayload?.error || `Errore release (${response.status}).`;
        throw new Error(errorMessage);
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get('content-disposition');
      const filename =
        parseFilename(contentDisposition) ??
        `UpdateLens_release_${new Date().toISOString().replace(/[:.]/g, '-')}.zip`;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(url);

      setReleaseState('success');
      triggerToast({
        type: 'success',
        message: 'Release completa generata, download avviato.'
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore inatteso.';
      setReleaseState('error');
      triggerToast({ type: 'error', message });
    }
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div
          className={`ul-surface border-l-4 px-4 py-3 text-sm ${
            toast.type === 'success'
              ? 'border-emerald-500 text-emerald-500'
              : toast.type === 'error'
                ? 'border-rose-500 text-rose-500'
                : 'border-amber-400 text-amber-400'
          }`}
        >
          {toast.message}
        </div>
      )}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Versione</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Dettagli di rilascio e ultimo aggiornamento.
          </p>
        </div>
        <div className="text-xs text-muted-foreground">Ambiente: {appEnvironment}</div>
      </header>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="ul-surface p-6">
          <h2 className="text-lg font-semibold">Versione app</h2>
          <dl className="mt-4 space-y-3 text-sm text-muted-foreground">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <dt className="text-xs uppercase">Versione</dt>
              <dd className="font-medium text-foreground">{appVersion}</dd>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <dt className="text-xs uppercase">Build</dt>
              <dd className="font-medium text-foreground">{buildLabel}</dd>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <dt className="text-xs uppercase">Ambiente</dt>
              <dd className="font-medium text-foreground">{appEnvironment}</dd>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <dt className="text-xs uppercase">Sorgente</dt>
              <dd className="font-medium text-foreground">{commitLabel}</dd>
            </div>
          </dl>
        </div>

        <div className="ul-surface p-6">
          <h2 className="text-lg font-semibold">Ultimo aggiornamento</h2>
          <div className="mt-3 text-sm text-foreground">{lastUpdateTitle}</div>
          <div className="mt-1 text-xs text-muted-foreground">{lastUpdateDate}</div>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            {lastUpdateNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="ul-surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Aggiornamento dati</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Esegue il refresh degli snapshot e genera lo ZIP con manifest.
            </p>
          </div>
          {!isFileProtocol && (
            <button
              className="ul-button ul-button-primary"
              onClick={handleRefresh}
              disabled={refreshInfo.status === 'running'}
            >
              {refreshInfo.status === 'running' ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Aggiornamento in corso...
                </span>
              ) : (
                'Esegui ultimo aggiornamento + Scarica ZIP'
              )}
            </button>
          )}
        </div>

        {isFileProtocol && (
          <div className="mt-4 text-sm text-muted-foreground">
            Funzione disponibile solo con server attivo (non in versione locale).
          </div>
        )}

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-border/60 p-4 text-sm">
            <div className="text-xs uppercase text-muted-foreground">Ultimo refresh</div>
            <div className="mt-2 font-medium text-foreground">
              {refreshInfo.lastRefreshAt ?? 'N/D'}
            </div>
          </div>
          <div className="rounded-lg border border-border/60 p-4 text-sm">
            <div className="text-xs uppercase text-muted-foreground">Esito</div>
            <div className="mt-2 font-medium text-foreground">
              {refreshInfo.lastResult ?? 'N/D'}
            </div>
            {refreshInfo.message && (
              <div className="mt-2 text-xs text-muted-foreground">
                {refreshInfo.message}
              </div>
            )}
          </div>
          <div className="rounded-lg border border-border/60 p-4 text-sm">
            <div className="text-xs uppercase text-muted-foreground">Conteggi</div>
            <div className="mt-2 text-sm text-muted-foreground">
              MS: {refreshInfo.microsoftCount ?? 'N/D'} | EOS:{' '}
              {refreshInfo.eosCount ?? 'N/D'}
            </div>
          </div>
        </div>
      </section>

      <section className="ul-surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Prima installazione</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Scarica la release completa con HTML, asset e dati.
            </p>
          </div>
          {!isFileProtocol && (
            <button
              className="ul-button ul-button-ghost"
              onClick={handleReleaseDownload}
              disabled={releaseState === 'running'}
            >
              {releaseState === 'running'
                ? 'Preparazione release...'
                : 'Scarica release completa'}
            </button>
          )}
        </div>
        {isFileProtocol && (
          <div className="mt-4 text-sm text-muted-foreground">
            Funzione disponibile solo con server attivo (non in versione locale).
          </div>
        )}
      </section>
    </div>
  );
};

export default VersionPage;
