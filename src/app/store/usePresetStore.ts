import { create } from 'zustand';
import type { FilterState, FilterPreset } from '../../models/Filters';
import { useFilterStore } from './useFilterStore';

type PresetStoreState = {
  presets: FilterPreset[];
  activePresetId: string | null;

  // Getters
  getPreset: (id: string) => FilterPreset | undefined;
  getDefaultPreset: () => FilterPreset | undefined;
  getActivePreset: () => FilterPreset | undefined;

  // Actions
  loadPresets: () => void;
  createPreset: (name: string, filters: FilterState, description?: string) => FilterPreset;
  updatePreset: (id: string, updates: Partial<Omit<FilterPreset, 'id' | 'createdAt'>>) => void;
  renamePreset: (id: string, newName: string) => void;
  duplicatePreset: (id: string, newName: string) => FilterPreset;
  deletePreset: (id: string) => boolean;
  setAsDefault: (id: string) => void;
  setActivePreset: (id: string) => void;
  applyPresetToFilters: (id: string) => void;

  // Internal
  persist: () => void;
};

const PRESETS_KEY = 'updatelens.presets.v1';
const ACTIVE_KEY = 'updatelens.presets.active';

const readJson = <T,>(key: string, fallback: T): T => {
  const raw = localStorage.getItem(key);
  if (!raw) {
    return fallback;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const generatePresetId = (name: string): string => {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
  return `${slug || 'preset'}-${Date.now()}`;
};

/**
 * Synchronously load presets from localStorage at store creation time.
 * This avoids FOUC by ensuring presets are available on first render.
 */
const getInitialState = (): { presets: FilterPreset[]; activePresetId: string | null } => {
  const presets = readJson<FilterPreset[]>(PRESETS_KEY, []);
  let activePresetId = readJson<string | null>(ACTIVE_KEY, null);

  // Auto-select an active preset if none is set but presets exist
  if (!activePresetId && presets.length > 0) {
    const defaultPreset = presets.find(p => p.isDefault);
    activePresetId = defaultPreset?.id ?? presets[0].id;
  }

  return { presets, activePresetId };
};

const initialState = getInitialState();

export const usePresetStore = create<PresetStoreState>((set, get) => {
  return {
    presets: initialState.presets,
    activePresetId: initialState.activePresetId,

    // Getters
    getPreset: (id: string) => {
      return get().presets.find((p) => p.id === id);
    },

    getDefaultPreset: () => {
      return get().presets.find((p) => p.isDefault);
    },

    getActivePreset: () => {
      const { activePresetId, presets } = get();
      if (!activePresetId) return undefined;
      return presets.find((p) => p.id === activePresetId);
    },

    // Actions
    loadPresets: () => {
      const presets = readJson<FilterPreset[]>(PRESETS_KEY, []);
      const activePresetId = readJson<string | null>(ACTIVE_KEY, null);

      // Auto-cleanup: Remove duplicate presets by name, keeping the default one if present
      const uniquePresets: FilterPreset[] = [];
      const seenNames = new Set<string>();

      presets.forEach((preset) => {
        if (!seenNames.has(preset.name)) {
          seenNames.add(preset.name);
          uniquePresets.push(preset);
        } else if (preset.name === 'Default' && preset.isDefault) {
          // Replace with the one marked as default
          const index = uniquePresets.findIndex((p) => p.name === 'Default');
          if (index >= 0) {
            uniquePresets[index] = preset;
          }
        }
      });

      // If duplicates were found and removed, persist the cleaned version
      if (uniquePresets.length < presets.length) {
        console.log(`[Cleanup] Removed ${presets.length - uniquePresets.length} duplicate presets`);
        localStorage.setItem(PRESETS_KEY, JSON.stringify(uniquePresets));
      }

      set({ presets: uniquePresets, activePresetId });
    },

    createPreset: (name: string, filters: FilterState, description?: string) => {
      const now = new Date().toISOString();
      const newPreset: FilterPreset = {
        id: generatePresetId(name),
        name,
        description,
        filters,
        isDefault: false,
        createdAt: now,
        updatedAt: now
      };

      const nextPresets = [...get().presets, newPreset];
      set({ presets: nextPresets });
      get().persist();

      return newPreset;
    },

    updatePreset: (id: string, updates: Partial<Omit<FilterPreset, 'id' | 'createdAt'>>) => {
      const nextPresets = get().presets.map((preset) => {
        if (preset.id !== id) return preset;
        return {
          ...preset,
          ...updates,
          updatedAt: new Date().toISOString()
        };
      });

      set({ presets: nextPresets });
      get().persist();
    },

    renamePreset: (id: string, newName: string) => {
      get().updatePreset(id, { name: newName });
    },

    duplicatePreset: (id: string, newName: string) => {
      const original = get().getPreset(id);
      if (!original) {
        throw new Error(`Preset ${id} not found`);
      }

      return get().createPreset(newName, original.filters, original.description);
    },

    deletePreset: (id: string) => {
      const preset = get().presets.find((p) => p.id === id);
      if (!preset) return false;

      // BLOCCO 1: Non eliminare se è l'unico preset
      if (get().presets.length === 1) {
        alert('Non puoi eliminare l\'unico preset rimanente.');
        return false;
      }

      // BLOCCO 2: Se elimini il preset attivo, seleziona un altro
      if (get().activePresetId === id) {
        const nextPreset = get().presets.find((p) => p.id !== id);
        if (nextPreset) {
          set({ activePresetId: nextPreset.id });
          get().applyPresetToFilters(nextPreset.id);
        }
      }

      // Elimina
      const nextPresets = get().presets.filter((p) => p.id !== id);
      set({ presets: nextPresets });
      get().persist();
      return true;
    },

    setAsDefault: (id: string) => {
      // Rimuovi isDefault da tutti
      const nextPresets = get().presets.map((preset) => ({
        ...preset,
        isDefault: preset.id === id
      }));

      set({ presets: nextPresets });
      get().persist();
    },

    setActivePreset: (id: string) => {
      set({ activePresetId: id });
      localStorage.setItem(ACTIVE_KEY, JSON.stringify(id));
    },

    applyPresetToFilters: (id: string) => {
      const preset = get().getPreset(id);
      if (!preset) {
        console.warn(`[PresetStore] Preset ${id} not found`);
        return;
      }

      console.log(`[PresetStore] Applying preset "${preset.name}" (${id})`);
      console.log('[PresetStore] Preset filters:', preset.filters);

      // Apply to global filters (cssFilters) via useFilterStore
      // Use getState() to ensure we're updating the current store instance
      const filterStore = useFilterStore.getState();
      filterStore.setCssFilters(preset.filters);

      console.log('[PresetStore] Filters applied to store');
    },

    // Internal
    persist: () => {
      try {
        const { presets } = get();
        localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
      } catch (error) {
        console.error('Failed to persist presets:', error);
      }
    }
  };
});
