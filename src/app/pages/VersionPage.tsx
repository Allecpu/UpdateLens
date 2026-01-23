import { useEffect, useState } from 'react';
import { loadAllSnapshots } from '../../services/DataLoader';
import {
  computeCountsBySourceAndProduct,
  type CountsInfo
} from '../../services/CountsService';
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

type SourceStatus = 'ok' | 'failed' | 'missing';

type SourceUpdateResult = {
  source: 'microsoft' | 'eos' | 'fabric';
  status: SourceStatus;
  itemCount: number | null;
  duration: number;
  error?: string;
  timestamp: string;
};

type UpdateAllState = 'idle' | 'running' | 'completed';

type UpdateAllInfo = {
  state: UpdateAllState;
  results: SourceUpdateResult[] | null;
  completedAt: string | null;
};

const REFRESH_STORAGE_KEY = 'updatelens.refresh.status';
const COUNTS_STORAGE_KEY = 'updatelens.refresh.counts';
const MAX_PRODUCTS_VISIBLE = 4;

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

const loadCountsInfo = (): CountsInfo | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(COUNTS_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as CountsInfo;
  } catch {
    return null;
  }
};

const persistCountsInfo = (info: CountsInfo) => {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(COUNTS_STORAGE_KEY, JSON.stringify(info));
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
  const [countsInfo, setCountsInfo] = useState<CountsInfo | null>(() => loadCountsInfo());
  const [toast, setToast] = useState<ToastInfo | null>(null);
  const [releaseState, setReleaseState] = useState<ReleaseState>('idle');
  const [updateAllInfo, setUpdateAllInfo] = useState<UpdateAllInfo>({
    state: 'idle',
    results: null,
    completedAt: null
  });
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});

  const refreshCounts = async () => {
    try {
      const snapshotResult = await loadAllSnapshots();
      const counts = computeCountsBySourceAndProduct(snapshotResult.items);
      setCountsInfo(counts);
      persistCountsInfo(counts);
    } catch (error) {
      console.warn('[UpdateLens] Conteggi non aggiornati', error);
    }
  };

  const updateRefreshInfo = (next: RefreshInfo) => {
    setRefreshInfo(next);
    persistRefreshInfo(next);
  };

  const triggerToast = (next: ToastInfo) => {
    setToast(next);
    window.setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    refreshCounts();
  }, []);

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
      await refreshCounts();
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

  const handleUpdateAll = async () => {
    if (updateAllInfo.state === 'running') {
      return;
    }

    setUpdateAllInfo({
      state: 'running',
      results: null,
      completedAt: null
    });

    triggerToast({ type: 'info', message: 'Aggiornamento di tutte le fonti in corso...' });

    try {
      const response = await fetch('/api/sources/update-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        const errorMessage = errorPayload?.error || `Errore update-all (${response.status}).`;
        throw new Error(errorMessage);
      }

      const data = await response.json();

      setUpdateAllInfo({
        state: 'completed',
        results: data.results,
        completedAt: data.completedAt
      });
      await refreshCounts();

      const successCount = data.summary.successful;
      const totalCount = data.summary.total;

      if (successCount === totalCount) {
        triggerToast({
          type: 'success',
          message: `Aggiornamento completato: ${successCount}/${totalCount} fonti aggiornate con successo.`
        });
      } else {
        triggerToast({
          type: 'error',
          message: `Aggiornamento parziale: ${successCount}/${totalCount} fonti aggiornate.`
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore inatteso.';
      setUpdateAllInfo({
        state: 'idle',
        results: null,
        completedAt: null
      });
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
            {countsInfo ? (
              <div className="mt-3 space-y-3">
                {countsInfo.sources.map((source) => {
                  const products = source.products ?? [];
                  const isExpanded = expandedSources[source.source] ?? false;
                  const shouldCollapse = products.length > MAX_PRODUCTS_VISIBLE;
                  const visibleProducts = shouldCollapse && !isExpanded
                    ? products.slice(0, MAX_PRODUCTS_VISIBLE)
                    : products;

                  return (
                    <div key={source.source}>
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="font-medium text-foreground">{source.label}</span>
                        <span className="text-foreground">{source.total}</span>
                      </div>
                      {products.length > 0 ? (
                        <div className="ml-3 mt-2 space-y-1 text-xs text-muted-foreground">
                          {visibleProducts.map((product) => (
                            <div
                              key={`${source.source}-${product.label}`}
                              className="flex items-center justify-between gap-2"
                            >
                              <span className="min-w-0 flex-1 truncate">
                                {product.label}
                              </span>
                              <span className="text-foreground/80">{product.count}</span>
                            </div>
                          ))}
                          {shouldCollapse && (
                            <button
                              className="mt-1 text-xs text-foreground underline-offset-2 hover:underline"
                              onClick={() =>
                                setExpandedSources((prev) => ({
                                  ...prev,
                                  [source.source]: !isExpanded
                                }))
                              }
                            >
                              {isExpanded
                                ? 'Mostra meno'
                                : `Mostra altro (${products.length - MAX_PRODUCTS_VISIBLE})`}
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="ml-3 mt-2 text-xs text-muted-foreground">
                          Prodotti: N/D
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-2 text-sm text-muted-foreground">N/D</div>
            )}
          </div>
        </div>
      </section>

      <section className="ul-surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Aggiorna tutte le fonti</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Esegue l'aggiornamento di Microsoft, EOS e Fabric in parallelo.
            </p>
          </div>
          {!isFileProtocol && (
            <button
              className="ul-button ul-button-primary"
              onClick={handleUpdateAll}
              disabled={updateAllInfo.state === 'running'}
            >
              {updateAllInfo.state === 'running' ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Aggiornamento in corso...
                </span>
              ) : (
                'Aggiorna tutte le fonti'
              )}
            </button>
          )}
        </div>

        {isFileProtocol && (
          <div className="mt-4 text-sm text-muted-foreground">
            Funzione disponibile solo con server attivo (non in versione locale).
          </div>
        )}

        {updateAllInfo.results && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold uppercase text-muted-foreground mb-3">
              Risultati aggiornamento
            </h3>
            <div className="space-y-3">
              {updateAllInfo.results.map((result) => (
                <div
                  key={result.source}
                  className={`rounded-lg border p-4 ${
                    result.status === 'ok'
                      ? 'border-emerald-500/30 bg-emerald-500/5'
                      : result.status === 'failed'
                        ? 'border-rose-500/30 bg-rose-500/5'
                        : 'border-amber-400/30 bg-amber-400/5'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold capitalize">{result.source}</span>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            result.status === 'ok'
                              ? 'bg-emerald-500/20 text-emerald-500'
                              : result.status === 'failed'
                                ? 'bg-rose-500/20 text-rose-500'
                                : 'bg-amber-400/20 text-amber-400'
                          }`}
                        >
                          {result.status === 'ok' ? 'Successo' : result.status === 'failed' ? 'Errore' : 'Non disponibile'}
                        </span>
                      </div>
                      <div className="mt-2 text-sm text-muted-foreground">
                        {result.itemCount !== null ? `${result.itemCount} elementi` : 'N/D'}
                        {' · '}
                        {(result.duration / 1000).toFixed(1)}s
                      </div>
                      {result.error && (
                        <div className="mt-2 text-xs text-rose-500">
                          {result.error}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(result.timestamp).toLocaleString('it-IT')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {updateAllInfo.completedAt && (
              <div className="mt-4 text-xs text-muted-foreground text-right">
                Completato: {new Date(updateAllInfo.completedAt).toLocaleString('it-IT')}
              </div>
            )}
          </div>
        )}
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
