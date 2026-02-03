import { useEffect, useRef, useState } from 'react';
import { usePresetStore } from '../app/store/usePresetStore';
import { useFilterStore } from '../app/store/useFilterStore';
import { useAuthStore } from '../app/store/useAuthStore';

const BOOTSTRAP_FLAG_KEY = 'updatelens.presets.bootstrapped';

// Global lock to prevent concurrent bootstrap executions (important for React 18 Strict Mode)
let globalBootstrapLock = false;

/**
 * Hook to bootstrap presets on first load.
 *
 * Since the preset store now hydrates synchronously from localStorage,
 * this hook mainly handles first-time setup (creating the Default preset)
 * and reports the ready state.
 */
export function useBootstrapPresets() {
  const bootstrappedRef = useRef(false);

  // Ready immediately if presets already exist in the store (hydrated synchronously)
  const [ready, setReady] = useState(() => {
    const { presets, activePresetId } = usePresetStore.getState();
    const alreadyBootstrapped = localStorage.getItem(BOOTSTRAP_FLAG_KEY) === 'true';
    return alreadyBootstrapped && presets.length > 0 && activePresetId !== null;
  });

  useEffect(() => {
    // Skip if already processed (ref for component instance, global lock for concurrent instances)
    if (bootstrappedRef.current || globalBootstrapLock) {
      if (!ready) setReady(true);
      return;
    }
    bootstrappedRef.current = true;
    globalBootstrapLock = true;

    const bootstrap = async () => {
      const alreadyBootstrapped = localStorage.getItem(BOOTSTRAP_FLAG_KEY) === 'true';
      const { presets: initialPresets, activePresetId, createPreset, setAsDefault, setActivePreset, getDefaultPreset, loadPresets } = usePresetStore.getState();
      const { isAuthenticated } = useAuthStore.getState();

      // If already bootstrapped and presets exist, we're done
      if (alreadyBootstrapped && initialPresets.length > 0) {
        // Ensure an active preset is set (store should handle this, but double-check)
        if (!activePresetId) {
          const defaultPreset = getDefaultPreset();
          if (defaultPreset) {
            setActivePreset(defaultPreset.id);
          } else if (initialPresets.length > 0) {
            setActivePreset(initialPresets[0].id);
          }
        }
        if (!ready) setReady(true);
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
            if (!serverState.activePresetId) {
              const defaultPreset = serverState.getDefaultPreset() || serverState.presets.find(p => p.name === 'Default');
              if (defaultPreset) {
                setActivePreset(defaultPreset.id);
              } else {
                setActivePreset(serverState.presets[0].id);
              }
            }
            localStorage.setItem(BOOTSTRAP_FLAG_KEY, 'true');
            setReady(true);
            return;
          }
        } catch (err) {
          console.warn('[Bootstrap] Failed to load presets from server:', err instanceof Error ? err.message : err);
          // Continue to create default preset locally
        }
      }

      // First-time bootstrap: create Default preset if none exist
      const { presets } = usePresetStore.getState();
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
            } else if (freshState.presets.length > 0) {
              // Fallback to first available preset
              console.log('[Bootstrap] Using first available preset:', freshState.presets[0].id);
              setActivePreset(freshState.presets[0].id);
            }
          }
          localStorage.setItem(BOOTSTRAP_FLAG_KEY, 'true');
        }
      } else {
        console.log('[Bootstrap] Presets already exist, skipping creation');

        // Ensure an active preset is set
        if (!activePresetId) {
          const defaultPreset = getDefaultPreset();
          if (defaultPreset) {
            setActivePreset(defaultPreset.id);
          } else {
            setActivePreset(presets[0].id);
          }
        }
        localStorage.setItem(BOOTSTRAP_FLAG_KEY, 'true');
      }

      setReady(true);
      // Note: we don't release globalBootstrapLock because bootstrap should only run once per app lifecycle
    };

    bootstrap().catch((err) => {
      // Ensure any unhandled errors are logged but don't crash the app
      console.error('[Bootstrap] Unhandled error:', err);
      setReady(true); // Still mark as ready to prevent infinite loading
    });
  }, []);

  return { ready };
}
