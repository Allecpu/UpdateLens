import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ColumnKey =
  | 'customer'
  | 'lastUpdate'
  | 'blBu'
  | 'issue'
  | 'issueStatus'
  | 'listStatus'
  | 'details'
  | 'cssOwner'
  | 'eosOwners'
  | 'customerOwners'
  | 'cssAction'
  | 'notes'
  | 'customerPriority'
  | 'cssPriority'
  | 'dueDate'
  | 'rating'
  | 'itemType';

export interface CssView {
  id: string;
  name: string;
  description?: string;
  isDefault?: boolean;
  visibleColumns: Record<ColumnKey, boolean>;
  filters: {
    customer?: string;
    owner?: string;
    status?: string;
    rating?: string;
    query?: string;
  };
  sortBy?: 'customerName' | 'lastUpdate' | 'blBu' | 'issue' | 'issueStatus' | 'cssOwner';
  sortDirection?: 'asc' | 'desc';
  createdAt: number;
  isSystem?: boolean; // viste di sistema non eliminabili
}

interface ViewsStore {
  views: CssView[];
  activeViewId: string;
  hasUnsavedChanges: boolean;

  // Actions
  createView: (view: Omit<CssView, 'id' | 'createdAt'>) => void;
  duplicateView: (id: string) => void;
  updateView: (id: string, updates: Partial<CssView>) => void;
  deleteView: (id: string) => void;
  switchView: (id: string) => void;
  setUnsavedChanges: (hasChanges: boolean) => void;
  saveActiveView: (updates: Partial<CssView>) => void;
  exportViews: (ids?: string[]) => string;
  importViews: (json: string) => void;
  resetToDefaults: () => void;
  getActiveView: () => CssView | undefined;
}

const DEFAULT_VIEWS: CssView[] = [
  {
    id: 'action-required',
    name: '⚠️ Action Required',
    description: 'Mostra solo issues con status Action required',
    isDefault: true,
    isSystem: true,
    visibleColumns: {
      customer: true,
      lastUpdate: true,
      blBu: true,
      issue: true,
      issueStatus: true,
      listStatus: true,
      details: false,
      cssOwner: true,
      eosOwners: false,
      customerOwners: false,
      cssAction: false,
      notes: false,
      customerPriority: false,
      cssPriority: false,
      dueDate: false,
      rating: true,
      itemType: false,
    },
    filters: {
      status: 'Action required',
    },
    sortBy: 'lastUpdate',
    sortDirection: 'desc',
    createdAt: Date.now(),
  },
  {
    id: 'in-progress',
    name: '🔄 In Progress',
    description: 'Issues attualmente in lavorazione',
    isSystem: true,
    visibleColumns: {
      customer: true,
      lastUpdate: true,
      blBu: true,
      issue: true,
      issueStatus: true,
      listStatus: true,
      details: true,
      cssOwner: true,
      eosOwners: false,
      customerOwners: false,
      cssAction: true,
      notes: true,
      customerPriority: false,
      cssPriority: false,
      dueDate: true,
      rating: true,
      itemType: false,
    },
    filters: {
      status: 'In progress',
    },
    sortBy: 'lastUpdate',
    sortDirection: 'desc',
    createdAt: Date.now(),
  },
  {
    id: 'all-items',
    name: '📋 Tutte',
    description: 'Vista completa con tutte le colonne',
    isSystem: true,
    visibleColumns: {
      customer: true,
      lastUpdate: true,
      blBu: true,
      issue: true,
      issueStatus: true,
      listStatus: true,
      details: true,
      cssOwner: true,
      eosOwners: true,
      customerOwners: true,
      cssAction: true,
      notes: true,
      customerPriority: true,
      cssPriority: true,
      dueDate: true,
      rating: true,
      itemType: true,
    },
    filters: {},
    sortBy: 'lastUpdate',
    sortDirection: 'desc',
    createdAt: Date.now(),
  },
];

export const useViewsStore = create<ViewsStore>()(
  persist(
    (set, get) => ({
      views: DEFAULT_VIEWS,
      activeViewId: 'action-required',
      hasUnsavedChanges: false,

      createView: (newView) =>
        set((state) => {
          const id = `view-${Date.now()}`;
          return {
            views: [
              ...state.views,
              {
                ...newView,
                id,
                createdAt: Date.now(),
              },
            ],
          };
        }),

      duplicateView: (id) =>
        set((state) => {
          const view = state.views.find((v) => v.id === id);
          if (!view) return state;

          const newId = `view-${Date.now()}`;
          const newView: CssView = {
            ...view,
            id: newId,
            name: `${view.name} (copia)`,
            isSystem: false,
            createdAt: Date.now(),
          };

          return {
            views: [...state.views, newView],
            activeViewId: newId,
          };
        }),

      updateView: (id, updates) =>
        set((state) => ({
          views: state.views.map((view) =>
            view.id === id && !view.isSystem ? { ...view, ...updates } : view
          ),
        })),

      deleteView: (id) =>
        set((state) => {
          const view = state.views.find((v) => v.id === id);
          if (view?.isSystem) return state;

          return {
            views: state.views.filter((v) => v.id !== id),
            activeViewId:
              state.activeViewId === id ? 'action-required' : state.activeViewId,
          };
        }),

      switchView: (id) =>
        set((state) => ({
          activeViewId: state.views.find((v) => v.id === id) ? id : state.activeViewId,
          hasUnsavedChanges: false,
        })),

      setUnsavedChanges: (hasChanges) =>
        set({ hasUnsavedChanges: hasChanges }),

      saveActiveView: (updates) =>
        set((state) => ({
          views: state.views.map((view) =>
            view.id === state.activeViewId && !view.isSystem
              ? { ...view, ...updates }
              : view
          ),
          hasUnsavedChanges: false,
        })),

      exportViews: (ids?: string[]) => {
        const state = get();
        const viewsToExport = ids
          ? state.views.filter((v) => ids.includes(v.id))
          : state.views.filter((v) => !v.isSystem);

        return JSON.stringify(viewsToExport, null, 2);
      },

      importViews: (json) => {
        try {
          const imported = JSON.parse(json) as CssView[];
          set((state) => {
            const newViews = imported.map((v) => ({
              ...v,
              id: `imported-${Date.now()}-${Math.random()}`,
              isSystem: false,
            }));

            return {
              views: [...state.views, ...newViews],
            };
          });
        } catch (err) {
          console.error('Errore import viste:', err);
        }
      },

      resetToDefaults: () =>
        set({
          views: DEFAULT_VIEWS,
          activeViewId: 'action-required',
          hasUnsavedChanges: false,
        }),

      getActiveView: () => {
        const state = get();
        return state.views.find((v) => v.id === state.activeViewId);
      },
    }),
    {
      name: 'css-views-store',
      version: 1,
    }
  )
);
