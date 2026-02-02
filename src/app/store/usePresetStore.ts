import { create } from 'zustand';
import type { FilterState, FilterPreset, FilterPresetWithSharing, VisibilityScope } from '../../models/Filters';
import { useFilterStore } from './useFilterStore';
import { useAuthStore } from './useAuthStore';
import { presetService } from '../../services/PresetService';

type PresetStoreState = {
  // State
  presets: FilterPresetWithSharing[];
  sharedPresets: FilterPresetWithSharing[];
  activePresetId: string | null;
  isLoading: boolean;
  error: string | null;
  hasMigrated: boolean;

  // Getters
  getPreset: (id: string) => FilterPresetWithSharing | undefined;
  getDefaultPreset: () => FilterPresetWithSharing | undefined;
  getActivePreset: () => FilterPresetWithSharing | undefined;
  isActivePresetDefault: () => boolean;
  getAllPresets: () => FilterPresetWithSharing[]; // Own + shared

  // Actions
  loadPresets: () => Promise<void>;
  createPreset: (name: string, filters: FilterState, description?: string) => Promise<FilterPresetWithSharing>;
  updatePreset: (id: string, updates: Partial<Omit<FilterPreset, 'id' | 'createdAt'>>) => Promise<void>;
  renamePreset: (id: string, newName: string) => Promise<void>;
  duplicatePreset: (id: string, newName: string) => Promise<FilterPresetWithSharing>;
  deletePreset: (id: string) => Promise<boolean>;
  setAsDefault: (id: string) => Promise<void>;
  setActivePreset: (id: string) => void;
  applyPresetToFilters: (id: string) => void;
  migrateLocalPresets: () => Promise<void>;
  clearError: () => void;

  // Internal
  persist: () => void;
};

const PRESETS_KEY = 'updatelens.presets.v1';
const ACTIVE_KEY = 'updatelens.presets.active';
const MIGRATED_KEY = 'updatelens.presets.migrated';

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
 * Convert local preset to preset with sharing (for localStorage mode)
 */
const localToSharing = (preset: FilterPreset): FilterPresetWithSharing => ({
  ...preset,
  visibilityScope: 'private' as VisibilityScope,
  owner: { email: '', name: null },
  isOwner: true
});

/**
 * Synchronously load presets from localStorage at store creation time.
 * This avoids FOUC by ensuring presets are available on first render.
 */
const getInitialState = (): {
  presets: FilterPresetWithSharing[];
  activePresetId: string | null;
  hasMigrated: boolean
} => {
  const localPresets = readJson<FilterPreset[]>(PRESETS_KEY, []);
  const presets = localPresets.map(localToSharing);
  let activePresetId = readJson<string | null>(ACTIVE_KEY, null);
  const hasMigrated = readJson<boolean>(MIGRATED_KEY, false);

  // Auto-select an active preset if none is set but presets exist
  if (!activePresetId && presets.length > 0) {
    const defaultPreset = presets.find(p => p.isDefault);
    activePresetId = defaultPreset?.id ?? presets[0].id;
  }

  return { presets, activePresetId, hasMigrated };
};

const initialState = getInitialState();

export const usePresetStore = create<PresetStoreState>((set, get) => {
  return {
    presets: initialState.presets,
    sharedPresets: [],
    activePresetId: initialState.activePresetId,
    isLoading: false,
    error: null,
    hasMigrated: initialState.hasMigrated,

    // Getters
    getPreset: (id: string) => {
      const { presets, sharedPresets } = get();
      return presets.find((p) => p.id === id) || sharedPresets.find((p) => p.id === id);
    },

    getDefaultPreset: () => {
      return get().presets.find((p) => p.isDefault);
    },

    getActivePreset: () => {
      const { activePresetId } = get();
      if (!activePresetId) return undefined;
      return get().getPreset(activePresetId);
    },

    isActivePresetDefault: () => {
      const activePreset = get().getActivePreset();
      return activePreset?.isDefault === true;
    },

    getAllPresets: () => {
      const { presets, sharedPresets } = get();
      return [...presets, ...sharedPresets];
    },

    // Actions
    loadPresets: async () => {
      const authStore = useAuthStore.getState();

      // If authenticated, load from API
      if (authStore.isAuthenticated) {
        set({ isLoading: true, error: null });

        try {
          const response = await presetService.getPresets(true);
          const activePresetId = get().activePresetId;

          // Check if active preset still exists
          const allPresets = [...response.myPresets, ...response.sharedPresets];
          const activeExists = activePresetId && allPresets.some(p => p.id === activePresetId);

          let newActiveId = activePresetId;
          if (!activeExists && response.myPresets.length > 0) {
            const defaultPreset = response.myPresets.find(p => p.isDefault);
            newActiveId = defaultPreset?.id ?? response.myPresets[0].id;
          }

          set({
            presets: response.myPresets,
            sharedPresets: response.sharedPresets,
            activePresetId: newActiveId,
            isLoading: false
          });

          // Persist active preset ID to localStorage
          localStorage.setItem(ACTIVE_KEY, JSON.stringify(newActiveId));
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Errore durante il caricamento dei preset';
          set({ isLoading: false, error: message });
        }
        return;
      }

      // Not authenticated - load from localStorage
      const localPresets = readJson<FilterPreset[]>(PRESETS_KEY, []);
      const activePresetId = readJson<string | null>(ACTIVE_KEY, null);

      // Auto-cleanup: Remove duplicate presets by name
      const uniquePresets: FilterPreset[] = [];
      const seenNames = new Set<string>();

      localPresets.forEach((preset) => {
        if (!seenNames.has(preset.name)) {
          seenNames.add(preset.name);
          uniquePresets.push(preset);
        } else if (preset.name === 'Default' && preset.isDefault) {
          const index = uniquePresets.findIndex((p) => p.name === 'Default');
          if (index >= 0) {
            uniquePresets[index] = preset;
          }
        }
      });

      if (uniquePresets.length < localPresets.length) {
        console.log(`[Cleanup] Removed ${localPresets.length - uniquePresets.length} duplicate presets`);
        localStorage.setItem(PRESETS_KEY, JSON.stringify(uniquePresets));
      }

      set({
        presets: uniquePresets.map(localToSharing),
        sharedPresets: [],
        activePresetId
      });
    },

    createPreset: async (name: string, filters: FilterState, description?: string) => {
      const authStore = useAuthStore.getState();

      if (authStore.isAuthenticated) {
        set({ isLoading: true, error: null });

        try {
          const newPreset = await presetService.createPreset({
            name,
            filters,
            description,
            isDefault: false,
            visibilityScope: 'private'
          });

          set(state => ({
            presets: [...state.presets, newPreset],
            isLoading: false
          }));

          return newPreset;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Errore durante la creazione del preset';
          set({ isLoading: false, error: message });
          throw error;
        }
      }

      // Not authenticated - create locally
      const now = new Date().toISOString();
      const newPreset: FilterPresetWithSharing = {
        id: generatePresetId(name),
        name,
        description,
        filters,
        isDefault: false,
        createdAt: now,
        updatedAt: now,
        visibilityScope: 'private',
        owner: { email: '', name: null },
        isOwner: true
      };

      const nextPresets = [...get().presets, newPreset];
      set({ presets: nextPresets });
      get().persist();

      return newPreset;
    },

    updatePreset: async (id: string, updates: Partial<Omit<FilterPreset, 'id' | 'createdAt'>>) => {
      const authStore = useAuthStore.getState();
      const preset = get().getPreset(id);

      if (!preset) {
        throw new Error('Preset non trovato');
      }

      if (authStore.isAuthenticated) {
        // Only owner can update
        if (!preset.isOwner) {
          throw new Error('Non autorizzato a modificare questo preset');
        }

        set({ isLoading: true, error: null });

        try {
          const updated = await presetService.updatePreset(id, updates);

          set(state => ({
            presets: state.presets.map(p => p.id === id ? updated : p),
            isLoading: false
          }));
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Errore durante l\'aggiornamento del preset';
          set({ isLoading: false, error: message });
          throw error;
        }
        return;
      }

      // Not authenticated - update locally
      const nextPresets = get().presets.map((p) => {
        if (p.id !== id) return p;
        return {
          ...p,
          ...updates,
          updatedAt: new Date().toISOString()
        };
      });

      set({ presets: nextPresets });
      get().persist();
    },

    renamePreset: async (id: string, newName: string) => {
      await get().updatePreset(id, { name: newName });
    },

    duplicatePreset: async (id: string, newName: string) => {
      const authStore = useAuthStore.getState();
      const original = get().getPreset(id);

      if (!original) {
        throw new Error(`Preset ${id} not found`);
      }

      if (authStore.isAuthenticated) {
        set({ isLoading: true, error: null });

        try {
          const duplicated = await presetService.duplicatePreset(id, newName);

          set(state => ({
            presets: [...state.presets, duplicated],
            isLoading: false
          }));

          return duplicated;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Errore durante la duplicazione del preset';
          set({ isLoading: false, error: message });
          throw error;
        }
      }

      // Not authenticated - duplicate locally
      return get().createPreset(newName, original.filters, original.description);
    },

    deletePreset: async (id: string) => {
      const authStore = useAuthStore.getState();
      const preset = get().getPreset(id);

      if (!preset) return false;

      // Block if it's the only preset
      if (get().presets.length === 1) {
        alert('Non puoi eliminare l\'unico preset rimanente.');
        return false;
      }

      if (authStore.isAuthenticated) {
        // Only owner can delete
        if (!preset.isOwner) {
          alert('Non autorizzato a eliminare questo preset');
          return false;
        }

        set({ isLoading: true, error: null });

        try {
          await presetService.deletePreset(id);

          // If deleting the active preset, select another
          if (get().activePresetId === id) {
            const nextPreset = get().presets.find((p) => p.id !== id);
            if (nextPreset) {
              set({ activePresetId: nextPreset.id });
              get().applyPresetToFilters(nextPreset.id);
              localStorage.setItem(ACTIVE_KEY, JSON.stringify(nextPreset.id));
            }
          }

          set(state => ({
            presets: state.presets.filter(p => p.id !== id),
            isLoading: false
          }));

          return true;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Errore durante l\'eliminazione del preset';
          set({ isLoading: false, error: message });
          return false;
        }
      }

      // Not authenticated - delete locally
      if (get().activePresetId === id) {
        const nextPreset = get().presets.find((p) => p.id !== id);
        if (nextPreset) {
          set({ activePresetId: nextPreset.id });
          get().applyPresetToFilters(nextPreset.id);
        }
      }

      const nextPresets = get().presets.filter((p) => p.id !== id);
      set({ presets: nextPresets });
      get().persist();
      return true;
    },

    setAsDefault: async (id: string) => {
      const authStore = useAuthStore.getState();

      if (authStore.isAuthenticated) {
        set({ isLoading: true, error: null });

        try {
          const updated = await presetService.updatePreset(id, { isDefault: true });

          // Update all presets - only one can be default
          set(state => ({
            presets: state.presets.map(p => ({
              ...p,
              isDefault: p.id === id ? true : false
            })),
            isLoading: false
          }));
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Errore durante l\'impostazione del preset predefinito';
          set({ isLoading: false, error: message });
          throw error;
        }
        return;
      }

      // Not authenticated - set locally
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

      const filterStore = useFilterStore.getState();
      filterStore.setCssFilters(preset.filters);
    },

    migrateLocalPresets: async () => {
      const { hasMigrated, presets } = get();

      // Skip if already migrated or no presets to migrate
      if (hasMigrated || presets.length === 0) {
        return;
      }

      const authStore = useAuthStore.getState();
      if (!authStore.isAuthenticated) {
        return;
      }

      console.log(`[PresetStore] Migrating ${presets.length} preset(s) from localStorage...`);

      try {
        // Convert to localStorage format for migration
        const localPresets: FilterPreset[] = presets.map(p => ({
          id: p.id,
          name: p.name,
          description: p.description,
          filters: p.filters,
          isDefault: p.isDefault,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt
        }));

        const result = await presetService.migrateFromLocalStorage(localPresets);

        console.log(`[PresetStore] Migration complete: ${result.migrated} migrated, ${result.skipped} skipped`);

        if (result.errors.length > 0) {
          console.warn('[PresetStore] Migration errors:', result.errors);
        }

        // Mark as migrated and clear localStorage
        localStorage.setItem(MIGRATED_KEY, JSON.stringify(true));
        localStorage.removeItem(PRESETS_KEY);
        set({ hasMigrated: true });

        // Reload presets from API
        await get().loadPresets();
      } catch (error) {
        console.error('[PresetStore] Migration failed:', error);
        // Don't mark as migrated so it can be retried
      }
    },

    clearError: () => {
      set({ error: null });
    },

    // Internal
    persist: () => {
      try {
        const { presets } = get();
        // Convert back to localStorage format (without sharing info)
        const localPresets: FilterPreset[] = presets.map(p => ({
          id: p.id,
          name: p.name,
          description: p.description,
          filters: p.filters,
          isDefault: p.isDefault,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt
        }));
        localStorage.setItem(PRESETS_KEY, JSON.stringify(localPresets));
      } catch (error) {
        console.error('Failed to persist presets:', error);
      }
    }
  };
});
