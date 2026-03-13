import { useEffect, useRef, useState } from 'react';
import { usePresetStore } from '../app/store/usePresetStore';
import { useFilterStore } from '../app/store/useFilterStore';
import { useAuthStore } from '../app/store/useAuthStore';

const BOOTSTRAP_FLAG_KEY = 'updatelens.presets.bootstrapped';

// Shared bootstrap state to prevent duplicate work across pages/components.
let bootstrapPromise: Promise<void> | null = null;
let bootstrapCompleted = false;

const syncStartupPreset = () => {
  const presetState = usePresetStore.getState();
  const defaultPreset =
    presetState.getDefaultPreset() ?? presetState.presets.find((preset) => preset.name === 'Default');
  const activePreset = presetState.activePresetId
    ? presetState.getPreset(presetState.activePresetId)
    : undefined;
  const startupPreset = defaultPreset ?? activePreset ?? presetState.presets[0];

  if (!startupPreset) {
    return false;
  }

  presetState.applyPresetToFilters(startupPreset.id);

  if (presetState.activePresetId !== startupPreset.id) {
    presetState.setActivePreset(startupPreset.id);
  }

  return true;
};

const isStoreReady = () => {
  const { presets } = usePresetStore.getState();
  return presets.length > 0;
};

/**
 * Hook to bootstrap presets on first load.
 *
 * Since the preset store now hydrates synchronously from localStorage,
 * this hook mainly handles first-time setup (creating the Default preset)
 * and reports the ready state.
 */
export function useBootstrapPresets() {
  const bootstrappedRef = useRef(false);
  const { hasFetched } = useAuthStore();

  const [ready, setReady] = useState(() => {
    return bootstrapCompleted || (hasFetched && isStoreReady());
  });

  useEffect(() => {
    if (!hasFetched) {
      return;
    }

    // Skip if already processed for this component instance
    if (bootstrappedRef.current) {
      if (!ready) {
        setReady(true);
      }
      return;
    }
    bootstrappedRef.current = true;

    const runBootstrap = async () => {
      const alreadyBootstrapped = localStorage.getItem(BOOTSTRAP_FLAG_KEY) === 'true';
      const {
        presets: initialPresets,
        createPreset,
        setAsDefault,
        setActivePreset,
        loadPresets
      } = usePresetStore.getState();
      const { isAuthenticated } = useAuthStore.getState();

      // Always align the startup preset on app load. The "bootstrapped" flag
      // only controls one-time creation, not which preset must be loaded.
      if (alreadyBootstrapped && initialPresets.length > 0) {
        syncStartupPreset();
        return;
      }

      // If authenticated, first try to load presets from server
      // This prevents trying to create a preset that already exists on the server
      if (isAuthenticated) {
        console.log('[Bootstrap] User authenticated, loading presets from server first');
        try {
          await loadPresets();
          const serverState = usePresetStore.getState();

          if (serverState.presets.length > 0) {
            // Server has presets, use them
            console.log('[Bootstrap] Found', serverState.presets.length, 'preset(s) on server');
            syncStartupPreset();
            localStorage.setItem(BOOTSTRAP_FLAG_KEY, 'true');
            return;
          }
        } catch (err) {
          console.warn('[Bootstrap] Failed to load presets from server:', err instanceof Error ? err.message : err);
          // Continue with local bootstrap/recovery.
        }
      }

      // If presets already exist locally, use the Default preset at startup.
      const { presets } = usePresetStore.getState();
      if (presets.length > 0) {
        syncStartupPreset();
        localStorage.setItem(BOOTSTRAP_FLAG_KEY, 'true');
        return;
      }

      // First-time bootstrap: create Default preset if none exist
      if (presets.length === 0) {
        const { cssFilters } = useFilterStore.getState();

        if (cssFilters) {
          console.log('[Bootstrap] Creating initial Default preset');
          try {
            const defaultPreset = await createPreset('Default', cssFilters, 'Configurazione iniziale');
            // Set as default only if we have a valid ID
            if (defaultPreset?.id) {
              await setAsDefault(defaultPreset.id);
              setActivePreset(defaultPreset.id);
              usePresetStore.getState().applyPresetToFilters(defaultPreset.id);
            }
          } catch (err) {
            // Preset might already exist (race/duplicate): reload and recover.
            console.log('[Bootstrap] Create failed, attempting recovery:', err instanceof Error ? err.message : err);
            await loadPresets();

            // After loadPresets, the state should be updated - get fresh reference
            const freshState = usePresetStore.getState();

            // First try to find preset by isDefault, then by name "Default"
            let recoveredPreset = freshState.getDefaultPreset();
            if (!recoveredPreset) {
              recoveredPreset = freshState.presets.find(p => p.name === 'Default');
            }

            if (recoveredPreset?.id) {
              console.log('[Bootstrap] Recovered preset:', recoveredPreset.id);
              setActivePreset(recoveredPreset.id);
              freshState.applyPresetToFilters(recoveredPreset.id);
            } else if (freshState.presets.length > 0) {
              // Fallback to first available preset
              console.log('[Bootstrap] Using first available preset:', freshState.presets[0].id);
              setActivePreset(freshState.presets[0].id);
              freshState.applyPresetToFilters(freshState.presets[0].id);
            }
          }
          localStorage.setItem(BOOTSTRAP_FLAG_KEY, 'true');
        }
      }
    };

    if (!bootstrapPromise) {
      bootstrapPromise = runBootstrap()
        .catch((err) => {
          // Ensure any unhandled errors are logged but don't crash the app
          console.error('[Bootstrap] Unhandled error:', err);
        })
        .finally(() => {
          bootstrapCompleted = true;
        });
    }

    bootstrapPromise.finally(() => {
      setReady(true);
    });
  }, [hasFetched, ready]);

  return { ready };
}
