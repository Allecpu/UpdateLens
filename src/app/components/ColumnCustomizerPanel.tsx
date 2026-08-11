/**
 * UI for creating, editing, and managing custom columns
 * Integrated into Views for per-view custom column definitions
 */

import React, { useState } from 'react';
import type { CustomColumn, CustomColumnType } from '../store/customColumnsStore';
import { useCustomColumnsStore } from '../store/customColumnsStore';
import { ValidatedInput, ValidatedSelect } from './FieldValidator';
import { useFieldValidator } from '../hooks/useFieldValidator';

const COLUMN_TYPES: Array<{ value: CustomColumnType; label: string; description: string }> = [
  { value: 'text', label: 'Testo', description: 'Stringa di testo breve' },
  { value: 'number', label: 'Numero', description: 'Numero intero o decimale' },
  { value: 'date', label: 'Data', description: 'Data e ora' },
  { value: 'choice', label: 'Scelta', description: 'Opzioni predefinite' },
  { value: 'lookup', label: 'Lookup', description: 'Riferimento a altro campo' }
];

interface ColumnCustomizerPanelProps {
  viewId: string;
  onColumnAdded?: (columnId: string) => void;
}

export function ColumnCustomizerPanel({ viewId, onColumnAdded }: ColumnCustomizerPanelProps) {
  const { addColumn, updateColumn, deleteColumn, getColumnsByView } =
    useCustomColumnsStore();
  const viewColumns = getColumnsByView(viewId);

  const [isExpanded, setIsExpanded] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form state for new column
  const nameValidator = useFieldValidator('', [{ type: 'required' }]);
  const displayNameValidator = useFieldValidator('', [{ type: 'required' }]);
  const typeValidator = useFieldValidator('text', [{ type: 'required' }]);

  const handleAddColumn = (e: React.FormEvent) => {
    e.preventDefault();

    if (!nameValidator.validate() || !displayNameValidator.validate()) {
      return;
    }

    const columnId = addColumn(viewId, {
      viewId,
      name: nameValidator.state.value,
      displayName: displayNameValidator.state.value,
      type: typeValidator.state.value,
      required: false,
      isVisible: true
    });

    nameValidator.reset();
    displayNameValidator.reset();
    typeValidator.reset();
    setShowForm(false);
    onColumnAdded?.(columnId);
  };

  const handleDeleteColumn = (columnId: string) => {
    if (confirm('Eliminare questa colonna personalizzata?')) {
      deleteColumn(columnId);
    }
  };

  const handleToggleVisibility = (columnId: string, visible: boolean) => {
    updateColumn(columnId, { isVisible: visible });
  };

  return (
    <div className="rounded-lg border border-border/60 bg-muted/10 p-4">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? '▼' : '▶'} Colonne Personalizzate ({viewColumns.length})
        </button>
        <button
          type="button"
          className="ul-button ul-button-sm ul-button-primary h-8 px-3"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Annulla' : '+ Nuova Colonna'}
        </button>
      </div>

      {isExpanded && (
        <div className="space-y-3">
          {/* Form to add new column */}
          {showForm && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
              <h4 className="mb-3 font-medium text-blue-900 dark:text-blue-100">
                Aggiungi Colonna Personalizzata
              </h4>
              <form onSubmit={handleAddColumn} className="space-y-3">
                <ValidatedInput
                  label="Nome (identificatore)"
                  placeholder="es: custom_field_1"
                  value={nameValidator.state.value}
                  onChange={(val) => nameValidator.setValue(val)}
                  onBlur={nameValidator.markTouched}
                  error={nameValidator.state.error}
                  isTouched={nameValidator.state.isTouched}
                  rules={[{ type: 'required' }]}
                  pattern="^[a-z_][a-z0-9_]*$"
                  description="Solo lettere minuscole, numeri e underscore"
                  showError
                />

                <ValidatedInput
                  label="Etichetta (label)"
                  placeholder="es: Campo Personalizzato"
                  value={displayNameValidator.state.value}
                  onChange={(val) => displayNameValidator.setValue(val)}
                  onBlur={displayNameValidator.markTouched}
                  error={displayNameValidator.state.error}
                  isTouched={displayNameValidator.state.isTouched}
                  rules={[{ type: 'required' }]}
                  description="Nome visibile nella tabella"
                  showError
                />

                <ValidatedSelect
                  label="Tipo di Dato"
                  options={COLUMN_TYPES.map((t) => ({
                    value: t.value,
                    label: `${t.label} - ${t.description}`
                  }))}
                  value={typeValidator.state.value}
                  onChange={(val) => typeValidator.setValue(val)}
                  error={typeValidator.state.error}
                  isTouched={typeValidator.state.isTouched}
                  rules={[{ type: 'required' }]}
                />

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className="ul-button ul-button-ghost h-9 px-4"
                    onClick={() => setShowForm(false)}
                  >
                    Annulla
                  </button>
                  <button type="submit" className="ul-button ul-button-primary h-9 px-4">
                    Aggiungi Colonna
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* List of existing columns */}
          {viewColumns.length > 0 ? (
            <div className="space-y-2">
              {viewColumns.map((col) => (
                <div
                  key={col.id}
                  className="flex items-center justify-between rounded-lg border border-border/40 bg-background/50 p-3"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={col.isVisible !== false}
                        onChange={(e) => handleToggleVisibility(col.id, e.target.checked)}
                        className="h-4 w-4"
                      />
                      <span className="font-medium text-foreground">{col.displayName}</span>
                      <span className="text-xs text-muted-foreground">
                        ({col.name})
                      </span>
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-100">
                        {col.type}
                      </span>
                    </div>
                    {col.description && (
                      <p className="mt-1 text-xs text-muted-foreground">{col.description}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="ul-button ul-button-ghost h-8 px-2 text-xs"
                      onClick={() => setEditingId(editingId === col.id ? null : col.id)}
                    >
                      {editingId === col.id ? 'Chiudi' : 'Modifica'}
                    </button>
                    <button
                      type="button"
                      className="ul-button ul-button-ghost text-red-600 hover:bg-red-50 h-8 px-2 text-xs dark:hover:bg-red-900/20"
                      onClick={() => handleDeleteColumn(col.id)}
                    >
                      Elimina
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Nessuna colonna personalizzata. Clicca "Nuova Colonna" per crearne una.</p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Column editor modal for detailed column configuration
 * (Advanced - rendered when editing an existing column)
 */
interface ColumnEditorProps {
  column: CustomColumn;
  onSave: (column: CustomColumn) => void;
  onClose: () => void;
}

export function ColumnEditor({ column, onSave, onClose }: ColumnEditorProps) {
  const [formData, setFormData] = useState<CustomColumn>(column);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-background p-6">
        <h2 className="mb-4 text-lg font-bold">Modifica Colonna: {column.displayName}</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <ValidatedInput
              label="Nome (identificatore)"
              value={formData.name}
              onChange={(val) => setFormData({ ...formData, name: val })}
              pattern="^[a-z_][a-z0-9_]*$"
              disabled
            />
            <ValidatedInput
              label="Etichetta"
              value={formData.displayName}
              onChange={(val) => setFormData({ ...formData, displayName: val })}
            />
          </div>

          <ValidatedSelect
            label="Tipo di Dato"
            options={COLUMN_TYPES.map((t) => ({ value: t.value, label: t.label }))}
            value={formData.type}
            onChange={(val) => setFormData({ ...formData, type: val as CustomColumnType })}
          />

          <ValidatedInput
            label="Descrizione"
            placeholder="Descrizione opzionale"
            value={formData.description || ''}
            onChange={(val) => setFormData({ ...formData, description: val })}
          />

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="required"
              checked={formData.required || false}
              onChange={(e) => setFormData({ ...formData, required: e.target.checked })}
            />
            <label htmlFor="required" className="text-sm font-medium">
              Campo obbligatorio
            </label>
          </div>

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <button type="button" className="ul-button ul-button-ghost h-9 px-4" onClick={onClose}>
              Annulla
            </button>
            <button type="submit" className="ul-button ul-button-primary h-9 px-4">
              Salva Colonna
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
