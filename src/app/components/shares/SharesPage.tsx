import { useState, useEffect } from 'react';
import type { OutgoingShare, IncomingShare, VisibilityScope } from '../../../models/Filters';
import { presetService } from '../../../services/PresetService';
import { useAuthStore } from '../../store/useAuthStore';
import { usePresetStore } from '../../store/usePresetStore';

type Tab = 'outgoing' | 'incoming';

const SharesPage = () => {
  const { isAuthenticated, isAuthConfigured, currentUser } = useAuthStore();
  const { duplicatePreset, setActivePreset, applyPresetToFilters } = usePresetStore();

  const [activeTab, setActiveTab] = useState<Tab>('outgoing');
  const [outgoingShares, setOutgoingShares] = useState<OutgoingShare[]>([]);
  const [incomingShares, setIncomingShares] = useState<IncomingShare[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load shares
  useEffect(() => {
    if (!isAuthenticated) return;

    const loadShares = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const [outgoing, incoming] = await Promise.all([
          presetService.getOutgoingShares(),
          presetService.getIncomingShares()
        ]);

        setOutgoingShares(outgoing.shares);
        setIncomingShares(incoming.shares);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Errore durante il caricamento';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    loadShares();
  }, [isAuthenticated]);

  const handleRevokeSharing = async (presetId: string) => {
    if (!confirm('Sei sicuro di voler revocare tutte le condivisioni per questo preset?')) {
      return;
    }

    try {
      await presetService.updateSharing(presetId, {
        visibilityScope: 'private',
        granteeEmails: []
      });

      // Refresh outgoing shares
      const outgoing = await presetService.getOutgoingShares();
      setOutgoingShares(outgoing.shares);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Errore durante la revoca';
      alert(message);
    }
  };

  const handleDuplicateShared = async (preset: IncomingShare) => {
    const newName = `Copia di ${preset.name}`;
    try {
      const duplicated = await duplicatePreset(preset.id, newName);
      setActivePreset(duplicated.id);
      applyPresetToFilters(duplicated.id);
      alert('Preset duplicato con successo. Il preset è ora disponibile tra i tuoi preset.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Errore durante la duplicazione';
      alert(message);
    }
  };

  const getVisibilityLabel = (scope: VisibilityScope): string => {
    switch (scope) {
      case 'all_users':
        return 'Tutti gli utenti';
      case 'specific_users':
        return 'Utenti specifici';
      default:
        return 'Privato';
    }
  };

  if (!isAuthConfigured) {
    return (
      <div className="ul-surface p-6">
        <h1 className="text-2xl font-semibold mb-4">Condivisioni Preset</h1>
        <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-amber-700 dark:text-amber-400">
          <p>La funzionalità di condivisione richiede Azure Easy Auth.</p>
          <p className="text-sm mt-1">Su Azure App Service, questa funzionalità sarà abilitata automaticamente.</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="ul-surface p-6">
        <h1 className="text-2xl font-semibold mb-4">Condivisioni Preset</h1>
        <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-amber-700 dark:text-amber-400">
          <p>Effettua l'accesso per gestire le condivisioni dei tuoi preset.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="ul-surface p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold">Condivisioni Preset</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gestisci i preset che hai condiviso e quelli condivisi con te
            </p>
          </div>
          {currentUser && (
            <div className="text-sm text-muted-foreground">
              {currentUser.name || currentUser.email}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border mb-6">
          <button
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'outgoing'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab('outgoing')}
          >
            Condivisi da me ({outgoingShares.length})
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'incoming'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab('incoming')}
          >
            Condivisi con me ({incomingShares.length})
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <>
            {/* Outgoing Shares Tab */}
            {activeTab === 'outgoing' && (
              <div>
                {outgoingShares.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <svg className="mx-auto h-12 w-12 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                    <p>Non hai ancora condiviso nessun preset.</p>
                    <p className="text-sm mt-1">Vai alla pagina Filtri globali per condividere i tuoi preset.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {outgoingShares.map((share) => (
                      <div key={share.id} className="border border-border rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-medium">{share.name}</h3>
                            {share.description && (
                              <p className="text-sm text-muted-foreground mt-1">{share.description}</p>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1">
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                {getVisibilityLabel(share.visibilityScope)}
                              </span>
                              <span>
                                Aggiornato: {new Date(share.updatedAt).toLocaleDateString('it-IT')}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleRevokeSharing(share.id)}
                            className="ul-button ul-button-ghost text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                          >
                            Revoca
                          </button>
                        </div>

                        {/* Recipients for specific_users */}
                        {share.visibilityScope === 'specific_users' && share.sharedWith.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-border">
                            <div className="text-xs text-muted-foreground mb-2">
                              Condiviso con ({share.sharedWith.length}):
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {share.sharedWith.map((recipient) => (
                                <span
                                  key={recipient.email}
                                  className="inline-flex items-center px-2 py-1 text-xs rounded-full bg-accent text-accent-foreground"
                                >
                                  {recipient.email}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Incoming Shares Tab */}
            {activeTab === 'incoming' && (
              <div>
                {incomingShares.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <svg className="mx-auto h-12 w-12 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                    <p>Nessun preset è stato condiviso con te.</p>
                    <p className="text-sm mt-1">Quando qualcuno condivide un preset con te, apparirà qui.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {incomingShares.map((share) => (
                      <div key={share.id} className="border border-border rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-medium">{share.name}</h3>
                            {share.description && (
                              <p className="text-sm text-muted-foreground mt-1">{share.description}</p>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400">
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                Condiviso da: {share.sharedBy.name || share.sharedBy.email}
                              </span>
                              <span>
                                Aggiornato: {new Date(share.updatedAt).toLocaleDateString('it-IT')}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDuplicateShared(share)}
                            className="ul-button ul-button-secondary text-xs"
                          >
                            Crea copia
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SharesPage;
