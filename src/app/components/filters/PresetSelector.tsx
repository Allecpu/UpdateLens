import { useState } from 'react';
import type { FilterState } from '../../../models/Filters';
import { usePresetStore } from '../../store/usePresetStore';
import { useFilterStore } from '../../store/useFilterStore';

type PresetSelectorProps = {
  currentFilters: FilterState;
  onPresetChange: (presetId: string) => void;
  disabled?: boolean;
  loading?: boolean;
  /** Controlled open state for collapsibility */
  open?: boolean;
  /** Callback when section is toggled */
  onToggle?: (isOpen: boolean) => void;
};

const PresetSelector = ({ currentFilters, onPresetChange, disabled, loading, open, onToggle }: PresetSelectorProps) => {
  const isControlled = open !== undefined;
  const effectiveOpen = isControlled ? open : true;
  const {
    presets,
    activePresetId,
    createPreset,
    updatePreset,
    renamePreset,
    duplicatePreset,
    deletePreset,
    setAsDefault,
    getActivePreset
  } = usePresetStore();

  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showNewPresetModal, setShowNewPresetModal] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetDescription, setNewPresetDescription] = useState('');

  const activePreset = getActivePreset();
  const canDelete = presets.length > 1;

  const handleSelectPreset = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const presetId = e.target.value;
    if (presetId) {
      onPresetChange(presetId);
    }
  };

  const handleSave = () => {
    if (!activePresetId) return;
    // Update the preset with current filters
    updatePreset(activePresetId, { filters: currentFilters });
    // Also persist to cssFilters (in case we were in non-auto-save mode)
    const { setCssFilters } = useFilterStore.getState();
    setCssFilters(currentFilters);
    alert('Preset aggiornato con successo');
  };

  const handleSaveAsNew = () => {
    setNewPresetName('');
    setNewPresetDescription('');
    setShowNewPresetModal(true);
  };

  const handleCreateNewPreset = () => {
    if (!newPresetName.trim()) {
      alert('Inserisci un nome per il preset');
      return;
    }
    const newPreset = createPreset(newPresetName.trim(), currentFilters, newPresetDescription.trim() || undefined);
    onPresetChange(newPreset.id);
    setShowNewPresetModal(false);
    alert('Nuovo preset creato con successo');
  };

  const handleRename = () => {
    if (!activePreset) return;
    setNewPresetName(activePreset.name);
    setShowRenameModal(true);
  };

  const handleRenameConfirm = () => {
    if (!activePresetId || !newPresetName.trim()) {
      alert('Inserisci un nome valido');
      return;
    }
    renamePreset(activePresetId, newPresetName.trim());
    setShowRenameModal(false);
    alert('Preset rinominato con successo');
  };

  const handleDuplicate = () => {
    if (!activePresetId || !activePreset) return;
    const newName = `Copia di ${activePreset.name}`;
    const duplicated = duplicatePreset(activePresetId, newName);
    onPresetChange(duplicated.id);
    alert('Preset duplicato con successo');
  };

  const handleDelete = () => {
    if (!activePresetId) return;
    if (!canDelete) {
      alert('Non puoi eliminare l\'unico preset rimanente');
      return;
    }
    if (confirm(`Sei sicuro di voler eliminare il preset "${activePreset?.name}"?`)) {
      const success = deletePreset(activePresetId);
      if (success) {
        alert('Preset eliminato con successo');
      }
    }
  };

  const handleToggleDefault = () => {
    if (!activePresetId) return;
    if (activePreset?.isDefault) {
      alert('Per rimuovere il Default, imposta un altro preset come Default');
      return;
    }
    setAsDefault(activePresetId);
    alert('Preset impostato come Default');
  };

  const isDisabled = disabled || loading;

  const handleToggle = (e: React.SyntheticEvent<HTMLDetailsElement>) => {
    if (onToggle) {
      onToggle(e.currentTarget.open);
    }
  };

  return (
    <details
      className={`ul-surface ${loading ? 'animate-pulse' : ''}`}
      open={effectiveOpen}
      onToggle={handleToggle}
    >
      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-4 p-6 select-none">
        <div className="flex items-center gap-3">
          <svg
            className={`h-4 w-4 text-muted-foreground transition-transform ${effectiveOpen ? 'rotate-90' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <div>
            <h2 className="text-lg font-semibold">Preset Filtri</h2>
            {!effectiveOpen && activePreset && (
              <p className="text-xs text-muted-foreground">
                Attivo: {activePreset.name} {activePreset.isDefault ? '⭐' : ''}
              </p>
            )}
          </div>
        </div>
      </summary>
      <div className="px-6 pb-6">
        <p className="text-sm text-muted-foreground">
          Gestisci configurazioni multiple di filtri globali.
        </p>

      <div className="mt-4">
        <div className="text-xs uppercase text-muted-foreground">Preset attivo</div>
        <select
          value={activePresetId || ''}
          onChange={handleSelectPreset}
          disabled={isDisabled}
          className="mt-2 w-full max-w-md rounded-md border border-border bg-card text-foreground px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {presets.length === 0 && <option value="">Nessun preset disponibile</option>}
          {presets.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.name} {preset.isDefault ? '⭐' : ''}
            </option>
          ))}
        </select>

        {activePreset && (
          <div className="mt-2 text-xs text-muted-foreground">
            {activePreset.description && <div className="mb-1">{activePreset.description}</div>}
            <div>
              Creato: {new Date(activePreset.createdAt).toLocaleDateString('it-IT')}
              {' • '}
              Aggiornato: {new Date(activePreset.updatedAt).toLocaleDateString('it-IT')}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={handleSave}
          disabled={isDisabled || !activePresetId}
          className="ul-button ul-button-primary text-xs"
        >
          Salva modifiche
        </button>

        <button
          onClick={handleSaveAsNew}
          disabled={isDisabled}
          className="ul-button ul-button-secondary text-xs"
        >
          Salva come nuovo
        </button>

        <button
          onClick={handleRename}
          disabled={isDisabled || !activePresetId}
          className="ul-button ul-button-ghost text-xs"
        >
          Rinomina
        </button>

        <button
          onClick={handleDuplicate}
          disabled={isDisabled || !activePresetId}
          className="ul-button ul-button-ghost text-xs"
        >
          Duplica
        </button>

        <button
          onClick={handleDelete}
          disabled={isDisabled || !activePresetId || !canDelete}
          className="ul-button ul-button-ghost text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
          title={!canDelete ? 'Devi avere almeno un preset' : ''}
        >
          Elimina
        </button>
      </div>

      {activePresetId && (
        <div className="mt-4 border-t pt-4">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              className="ul-checkbox"
              checked={activePreset?.isDefault || false}
              onChange={handleToggleDefault}
              disabled={isDisabled}
            />
            Imposta come preset predefinito (caricato all'avvio)
          </label>
        </div>
      )}

      {/* Modal Rinomina */}
      {showRenameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-96 rounded-xl bg-card text-foreground border border-border p-6 shadow-2xl">
            <h3 className="mb-4 text-lg font-semibold">Rinomina Preset</h3>
            <input
              type="text"
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              className="w-full rounded-md border-border bg-card text-foreground px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="Nome preset"
              autoFocus
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowRenameModal(false)}
                className="ul-button ul-button-ghost text-xs"
              >
                Annulla
              </button>
              <button
                onClick={handleRenameConfirm}
                className="ul-button ul-button-primary text-xs"
              >
                Conferma
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nuovo Preset */}
      {showNewPresetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-96 rounded-xl bg-card text-foreground border border-border p-6 shadow-2xl">
            <h3 className="mb-4 text-lg font-semibold">Crea Nuovo Preset</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Nome preset</label>
                <input
                  type="text"
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  className="w-full rounded-md border-border bg-card text-foreground px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Es. Filtri Q1 2025"
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Descrizione (opzionale)</label>
                <textarea
                  value={newPresetDescription}
                  onChange={(e) => setNewPresetDescription(e.target.value)}
                  className="w-full rounded-md border-border bg-card text-foreground px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Descrivi questo preset..."
                  rows={3}
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowNewPresetModal(false)}
                className="ul-button ul-button-ghost text-xs"
              >
                Annulla
              </button>
              <button
                onClick={handleCreateNewPreset}
                className="ul-button ul-button-primary text-xs"
              >
                Crea preset
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </details>
  );
};

export default PresetSelector;
