import { useState } from 'react';
import type { UserRole } from '../../../models/Filters';

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (data: { email: string; name?: string; role: UserRole }) => Promise<void>;
  canAssignAdmin: boolean;
}

const AddUserModal = ({ isOpen, onClose, onAdd, canAssignAdmin }: AddUserModalProps) => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('viewer');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate email domain
    if (!email.toLowerCase().endsWith('@eos-solutions.it')) {
      setError('Solo email @eos-solutions.it sono consentite');
      return;
    }

    setIsSubmitting(true);

    try {
      await onAdd({
        email: email.trim(),
        name: name.trim() || undefined,
        role
      });

      // Reset form and close
      setEmail('');
      setName('');
      setRole('viewer');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante l\'aggiunta');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setEmail('');
    setName('');
    setRole('viewer');
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      {/* Modal */}
      <div className="relative bg-background border border-border rounded-lg shadow-lg w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold">Aggiungi Utente</h2>
          <button
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome.cognome@eos-solutions.it"
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              required
              disabled={isSubmitting}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Solo email @eos-solutions.it
            </p>
          </div>

          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-1">
              Nome (opzionale)
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mario Rossi"
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label htmlFor="role" className="block text-sm font-medium mb-1">
              Ruolo <span className="text-red-500">*</span>
            </label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              disabled={isSubmitting}
            >
              <option value="viewer">Viewer - Solo visualizzazione</option>
              <option value="sharing_manager">Manager - Gestione utenti</option>
              {canAssignAdmin && (
                <option value="admin">Admin - Accesso completo</option>
              )}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              {role === 'admin' && 'Accesso completo, puo assegnare ruoli admin'}
              {role === 'sharing_manager' && 'Puo aggiungere e gestire utenti non-admin'}
              {role === 'viewer' && 'Utente standard, nessun accesso alla gestione'}
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="ul-button ul-button-secondary"
              disabled={isSubmitting}
            >
              Annulla
            </button>
            <button
              type="submit"
              className="ul-button ul-button-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                  Aggiunta...
                </>
              ) : (
                'Aggiungi Utente'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddUserModal;
