import { useState, useEffect, useCallback } from 'react';
import type { VisibilityScope, SharingInfo } from '../../../models/Filters';
import { presetService } from '../../../services/PresetService';

type SharePresetModalProps = {
  presetId: string;
  presetName: string;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
};

const ALLOWED_DOMAIN = '@eos-solutions.it';

const SharePresetModal = ({ presetId, presetName, isOpen, onClose, onSaved }: SharePresetModalProps) => {
  const [visibilityScope, setVisibilityScope] = useState<VisibilityScope>('private');
  const [emails, setEmails] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load current sharing info
  useEffect(() => {
    if (!isOpen || !presetId) return;

    const loadSharingInfo = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const info = await presetService.getSharing(presetId);
        setVisibilityScope(info.visibilityScope);
        setEmails(info.shares.map(s => s.email));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Errore durante il caricamento';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    loadSharingInfo();
  }, [isOpen, presetId]);

  const validateEmail = (email: string): boolean => {
    if (!email.includes('@')) {
      setEmailError('Inserisci un indirizzo email valido');
      return false;
    }
    if (!email.toLowerCase().endsWith(ALLOWED_DOMAIN.toLowerCase())) {
      setEmailError(`Solo email ${ALLOWED_DOMAIN} sono consentite`);
      return false;
    }
    if (emails.includes(email.toLowerCase())) {
      setEmailError('Questo indirizzo è già nella lista');
      return false;
    }
    setEmailError(null);
    return true;
  };

  const handleAddEmail = () => {
    const email = newEmail.trim().toLowerCase();
    if (!email) return;

    if (validateEmail(email)) {
      setEmails(prev => [...prev, email]);
      setNewEmail('');
    }
  };

  const handleRemoveEmail = (emailToRemove: string) => {
    setEmails(prev => prev.filter(e => e !== emailToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddEmail();
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      await presetService.updateSharing(presetId, {
        visibilityScope,
        granteeEmails: visibilityScope === 'specific_users' ? emails : []
      });

      onSaved?.();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Errore durante il salvataggio';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = useCallback(() => {
    setNewEmail('');
    setEmailError(null);
    setError(null);
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl bg-card text-foreground border border-border p-6 shadow-2xl">
        <h3 className="mb-4 text-lg font-semibold">Condividi Preset</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Scegli come condividere il preset "{presetName}"
        </p>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-4 rounded-md bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}

            <div className="space-y-3">
              {/* Private */}
              <label className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-accent/50 transition-colors">
                <input
                  type="radio"
                  name="visibility"
                  value="private"
                  checked={visibilityScope === 'private'}
                  onChange={() => setVisibilityScope('private')}
                  className="mt-0.5"
                />
                <div>
                  <div className="font-medium">Privato</div>
                  <div className="text-xs text-muted-foreground">Solo tu puoi vedere questo preset</div>
                </div>
              </label>

              {/* All users */}
              <label className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-accent/50 transition-colors">
                <input
                  type="radio"
                  name="visibility"
                  value="all_users"
                  checked={visibilityScope === 'all_users'}
                  onChange={() => setVisibilityScope('all_users')}
                  className="mt-0.5"
                />
                <div>
                  <div className="font-medium">Tutti gli utenti</div>
                  <div className="text-xs text-muted-foreground">Tutti gli utenti EOS potranno vedere questo preset</div>
                </div>
              </label>

              {/* Specific users */}
              <label className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-accent/50 transition-colors">
                <input
                  type="radio"
                  name="visibility"
                  value="specific_users"
                  checked={visibilityScope === 'specific_users'}
                  onChange={() => setVisibilityScope('specific_users')}
                  className="mt-0.5"
                />
                <div>
                  <div className="font-medium">Utenti specifici</div>
                  <div className="text-xs text-muted-foreground">Condividi solo con persone specifiche</div>
                </div>
              </label>
            </div>

            {/* Email input for specific users */}
            {visibilityScope === 'specific_users' && (
              <div className="mt-4 space-y-3">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">
                    Aggiungi destinatario (solo {ALLOWED_DOMAIN})
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => {
                        setNewEmail(e.target.value);
                        setEmailError(null);
                      }}
                      onKeyDown={handleKeyDown}
                      className="flex-1 rounded-md border border-border bg-card text-foreground px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder="nome.cognome@eos-solutions.it"
                    />
                    <button
                      type="button"
                      onClick={handleAddEmail}
                      className="ul-button ul-button-secondary text-xs"
                    >
                      Aggiungi
                    </button>
                  </div>
                  {emailError && (
                    <p className="mt-1 text-xs text-red-500">{emailError}</p>
                  )}
                </div>

                {/* Email list */}
                {emails.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">Destinatari ({emails.length})</div>
                    <div className="max-h-32 overflow-y-auto rounded-md border border-border divide-y divide-border">
                      {emails.map((email) => (
                        <div key={email} className="flex items-center justify-between px-3 py-2">
                          <span className="text-sm truncate">{email}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveEmail(email)}
                            className="ml-2 text-muted-foreground hover:text-red-500 transition-colors"
                            title="Rimuovi"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {emails.length === 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Aggiungi almeno un destinatario per condividere con utenti specifici
                  </p>
                )}
              </div>
            )}
          </>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={handleClose}
            disabled={isSaving}
            className="ul-button ul-button-ghost text-xs"
          >
            Annulla
          </button>
          <button
            onClick={handleSave}
            disabled={isLoading || isSaving || (visibilityScope === 'specific_users' && emails.length === 0)}
            className="ul-button ul-button-primary text-xs"
          >
            {isSaving ? 'Salvataggio...' : 'Salva'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SharePresetModal;
