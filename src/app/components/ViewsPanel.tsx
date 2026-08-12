import { useRef, useState } from 'react';
import { useViewsStore, type ColumnKey } from '../store/viewsStore';

interface ViewsPanelProps {
  compact?: boolean;
}

export function ViewsPanel({ compact = false }: ViewsPanelProps) {
  const {
    views,
    activeViewId,
    hasUnsavedChanges,
    switchView,
    deleteView,
    createView,
    duplicateView,
    updateView,
    exportViews,
    importViews,
    resetToDefaults,
  } = useViewsStore();

  const [isCreating, setIsCreating] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [showMenu, setShowMenu] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeView = views.find((v) => v.id === activeViewId);
  const customViews = views.filter((v) => !v.isSystem);
  const systemViews = views.filter((v) => v.isSystem);

  const handleCreateView = () => {
    const nextName = newViewName.trim();
    if (!nextName) return;
    createView({
      name: nextName,
      visibleColumns: (activeView?.visibleColumns || {}) as Record<ColumnKey, boolean>,
      filters: activeView?.filters || {},
      sortBy: activeView?.sortBy,
      sortDirection: activeView?.sortDirection,
    });
    setNewViewName('');
    setIsCreating(false);
    setShowAll(true);
  };

  const handleDeleteView = (id: string) => {
    deleteView(id);
    setConfirmDeleteId(null);
    setShowMenu(null);
  };

  const handleEditName = (id: string) => {
    const view = views.find((v) => v.id === id);
    if (view && !view.isSystem) {
      setEditingId(id);
      setEditName(view.name);
    }
  };

  const handleSaveEdit = (id: string) => {
    if (editName.trim()) {
      updateView(id, { name: editName.trim() });
      setEditingId(null);
      setShowMenu(null);
    }
  };

  const handleExport = (id?: string) => {
    const json = exportViews(id ? [id] : undefined);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `viste-css-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setShowMenu(null);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const json = event.target?.result as string;
          importViews(json);
          alert('Viste importate con successo!');
        } catch (err) {
          alert('Errore nella importazione delle viste');
        }
      };
      reader.readAsText(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const ViewButton = ({ view }: { view: any }) => {
    const isActive = activeViewId === view.id;
    const isSystem = view.isSystem;
    const isEditing = editingId === view.id;

    return (
      <div key={view.id} className="relative group">
        {isEditing ? (
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={() => handleSaveEdit(view.id)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') handleSaveEdit(view.id);
              if (e.key === 'Escape') setEditingId(null);
            }}
            className="rounded-full border-2 border-blue-500 bg-white px-4 py-2 text-sm font-medium focus:outline-none"
            autoFocus
          />
        ) : (
          <button
            onClick={() => switchView(view.id)}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
              isActive
                ? `${isSystem ? 'bg-blue-600 text-white' : 'bg-purple-600 text-white'} shadow-md`
                : `${isSystem ? 'bg-gray-200 text-gray-900' : 'bg-purple-100 text-purple-900'} hover:${isSystem ? 'bg-gray-300' : 'bg-purple-200'}`
            }`}
            title={view.description}
          >
            {view.name}
            {isSystem && <span className="text-xs">🔒</span>}
          </button>
        )}

        {/* Menu tasto destro */}
        {!isEditing && (
          <div className="absolute -right-1 -top-1 hidden group-hover:flex">
            <button
              onClick={() => setShowMenu(showMenu === view.id ? null : view.id)}
              className="rounded-full bg-gray-400 p-1 text-white hover:bg-gray-600"
              title="Menu"
            >
              ⋮
            </button>

            {showMenu === view.id && (
              <div className="absolute right-0 top-8 z-50 w-48 rounded-lg border border-gray-300 bg-white shadow-lg">
                {!isSystem && (
                  <>
                    <button
                      onClick={() => handleEditName(view.id)}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
                    >
                      ✏️ Modifica nome
                    </button>
                    <button
                      onClick={() => duplicateView(view.id)}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
                    >
                      📋 Duplica
                    </button>
                  </>
                )}
                <button
                  onClick={() => handleExport(view.id)}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
                >
                  📥 Esporta
                </button>
                {!isSystem && (
                  <>
                    <div className="border-t border-gray-200" />
                    <button
                      onClick={() => setConfirmDeleteId(view.id)}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                    >
                      🗑️ Elimina
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Dialog conferma elimina */}
        {confirmDeleteId === view.id && (
          <div className="absolute -right-24 -top-20 z-50 rounded-lg border border-red-300 bg-white p-3 shadow-lg">
            <p className="mb-3 text-sm font-medium">Elimina "{view.name}"?</p>
            <div className="flex gap-2">
              <button
                onClick={() => handleDeleteView(view.id)}
                className="flex-1 rounded bg-red-600 px-3 py-1 text-sm font-medium text-white hover:bg-red-700"
              >
                Sì, elimina
              </button>
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 rounded bg-gray-300 px-3 py-1 text-sm font-medium text-gray-900 hover:bg-gray-400"
              >
                Annulla
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Early return per compact mode - solo pillole
  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-1">
          {/* System Views */}
          {systemViews.map((view) => (
            <button
              key={view.id}
              onClick={() => switchView(view.id)}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium transition ${
                activeViewId === view.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-200 text-gray-900 hover:bg-gray-300'
              }`}
              title={view.description}
            >
              {view.name}
              {view.isSystem && <span className="text-sm">🔒</span>}
            </button>
          ))}

          {/* Custom Views */}
          {(showAll || customViews.length <= 3) && customViews.map((view) => (
            <div key={view.id} className="inline-flex items-center gap-1 rounded-full bg-purple-100 pr-1">
              <button
                onClick={() => switchView(view.id)}
                className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium transition ${
                  activeViewId === view.id
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-purple-900 hover:bg-purple-200'
                }`}
                title={view.description}
              >
                {view.name}
              </button>
              <button
                type="button"
                className="h-6 w-6 rounded-full text-xs font-bold text-purple-700 hover:bg-purple-200"
                title={`Elimina vista "${view.name}"`}
                onClick={(event) => {
                  event.stopPropagation();
                  if (confirm(`Eliminare la vista "${view.name}"?`)) {
                    deleteView(view.id);
                  }
                }}
              >
                ×
              </button>
            </div>
          ))}

          {customViews.length > 3 && !showAll && (
            <button
              onClick={() => setShowAll(true)}
              className="rounded-full bg-gray-100 px-2 py-1 text-sm font-medium text-gray-600 hover:bg-gray-200"
              title={`${customViews.length - 3} viste nascoste`}
            >
              +{customViews.length - 3}
            </button>
          )}

          {/* Quick add */}
          <button
            onClick={() => setIsCreating(!isCreating)}
            className="rounded-full bg-emerald-100 px-2 py-1 text-sm font-medium text-emerald-700 hover:bg-emerald-200"
            title="Crea nuova vista"
          >
            {isCreating ? '✕' : '+'}
          </button>
        </div>

        {isCreating && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2">
            <input
              type="text"
              value={newViewName}
              onChange={(e) => setNewViewName(e.target.value)}
              placeholder="Nome nuova vista..."
              className="h-8 min-w-[220px] flex-1 rounded border border-emerald-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateView();
                if (e.key === 'Escape') setIsCreating(false);
              }}
              autoFocus
            />
            <button
              type="button"
              onClick={handleCreateView}
              className="rounded bg-emerald-600 px-3 py-1 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Crea
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mb-4">
      <div className="space-y-3">
        {/* Switcher viste */}
        <div className="flex flex-wrap items-center gap-2">
          {/* System Views */}
          {systemViews.map((view) => (
            <ViewButton key={view.id} view={view} />
          ))}

          {/* Divider */}
          {customViews.length > 0 && <div className="h-6 w-px bg-gray-300" />}

          {/* Custom Views */}
          {(showAll || customViews.length <= 3) && customViews.map((view) => (
            <ViewButton key={view.id} view={view} />
          ))}

          {customViews.length > 3 && !showAll && (
            <button
              onClick={() => setShowAll(true)}
              className="rounded-full px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              +{customViews.length - 3}
            </button>
          )}

          {/* Azioni */}
          <div className="ml-auto flex gap-2">
            {hasUnsavedChanges && (
              <span className="flex items-center gap-1 rounded-full bg-amber-100 px-3 py-2 text-xs font-medium text-amber-700">
                ⚠️ Non salvate
              </span>
            )}

            <button
              onClick={() => setIsCreating(!isCreating)}
              className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-200"
            >
              {isCreating ? '✕' : '+ Nuova'}
            </button>

            {/* Menu globale */}
            <div className="relative">
              <button
                onClick={() => setShowMenu(showMenu === 'global' ? null : 'global')}
                className="rounded-full bg-gray-200 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-300"
              >
                ⋯
              </button>

              {showMenu === 'global' && (
                <div className="absolute right-0 top-10 z-50 w-48 rounded-lg border border-gray-300 bg-white shadow-lg">
                  <button
                    onClick={() => {
                      fileInputRef.current?.click();
                      setShowMenu(null);
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
                  >
                    📤 Importa viste
                  </button>
                  <button
                    onClick={() => handleExport()}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
                  >
                    📥 Esporta tutte
                  </button>
                  <div className="border-t border-gray-200" />
                  <button
                    onClick={() => {
                      if (confirm('Ripristinare le viste predefinite? Le custom verranno eliminate.')) {
                        resetToDefaults();
                      }
                      setShowMenu(null);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                  >
                    🔄 Ripristina default
                  </button>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
            </div>
          </div>
        </div>

        {/* Form creazione vista */}
        {isCreating && (
          <div className="flex gap-2 rounded-lg bg-emerald-50 p-3">
            <input
              type="text"
              value={newViewName}
              onChange={(e) => setNewViewName(e.target.value)}
              placeholder="Nome vista (es: My Items, Closed Issues)..."
              className="flex-1 rounded border border-emerald-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateView();
                if (e.key === 'Escape') setIsCreating(false);
              }}
              autoFocus
            />
            <button
              onClick={handleCreateView}
              className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Crea
            </button>
            <button
              onClick={() => setIsCreating(false)}
              className="rounded bg-gray-300 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-400"
            >
              Annulla
            </button>
          </div>
        )}

        {/* Info vista attiva */}
        {activeView && (
          <div className="text-xs text-gray-600">
            <span className="font-medium">📍 Vista attiva:</span> {activeView.name}
            {activeView.description && <span> — {activeView.description}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
