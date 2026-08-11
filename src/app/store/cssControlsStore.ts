import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CssListControls {
  // Colonne nascoste di default (Microsoft Lists style)
  hiddenByDefault: string[];
  // Preferenze utente (persistate)
  userHiddenColumns: string[];
}

interface CssControlsStore {
  controls: CssListControls;
  
  // Actions
  toggleColumnVisibility: (columnName: string) => void;
  resetToDefaults: () => void;
  
  // Getters
  isColumnHidden: (columnName: string) => boolean;
}

const DEFAULT_CONTROLS: CssListControls = {
  // Colonne nascoste di default (come da screenshot Microsoft)
  hiddenByDefault: ['details', 'cssAction', 'notes'],
  
  // User preferences (persist)
  userHiddenColumns: [],
};

export const useCssControlsStore = create<CssControlsStore>()(
  persist(
    (set, get) => ({
      controls: DEFAULT_CONTROLS,

      toggleColumnVisibility: (columnName: string) =>
        set((state) => ({
          controls: {
            ...state.controls,
            userHiddenColumns: state.controls.userHiddenColumns.includes(columnName)
              ? state.controls.userHiddenColumns.filter((c) => c !== columnName)
              : [...state.controls.userHiddenColumns, columnName],
          },
        })),

      resetToDefaults: () =>
        set({
          controls: { ...DEFAULT_CONTROLS, userHiddenColumns: [] },
        }),

      isColumnHidden: (columnName: string) => {
        const state = get();
        const key = columnName.toLowerCase();
        return (
          state.controls.hiddenByDefault.includes(key) ||
          state.controls.userHiddenColumns.includes(columnName)
        );
      },
    }),
    {
      name: 'css-list-controls',
      version: 1,
    }
  )
);
