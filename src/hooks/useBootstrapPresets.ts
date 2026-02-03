import { useEffect, useRef, useState } from 'react';
import { usePresetStore } from '../app/store/usePresetStore';
import { useFilterStore } from '../app/store/useFilterStore';

const BOOTSTRAP_FLAG_KEY = 'updatelens.presets.bootstrapped';

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
    // Skip if already processed
    if (bootstrappedRef.current) {
      if (!ready) setReady(true);
      return;
    }
    bootstrappedRef.current = true;

    const bootstrap = async () => {
      const alreadyBootstrapped = localStorage.getItem(BOOTSTRAP_FLAG_KEY) === 'true';
      const { presets, activePresetId, createPreset, setAsDefault, setActivePreset, getDefaultPreset, loadPresets } = usePresetStore.getState();

      // If already bootstrapped and presets exist, we're done
      if (alreadyBootstrapped && presets.length > 0) {
        // Ensure an active preset is set (store should handle this, but double-check)
        if (!activePresetId) {
          const defaultPreset = getDefaultPreset();
          if (defaultPreset) {
            setActivePreset(defaultPreset.id);
          } else if (presets.length > 0) {
            setActivePreset(presets[0].id);
          }
        }
        if (!ready) setReady(true);
        return;
      }

      // First-time bootstrap: create Default preset if none exist
      if (presets.length === 0) {
        const { cssFilters } = useFilterStore.getState();

        if (cssFilters) {
          console.log('[Bootstrap] Creating initial Default preset');
          try {
            const defaultPreset = await createPreset('Default', cssFilters, 'Configurazione iniziale');
            await setAsDefault(defaultPreset.id);
            setActivePreset(defaultPreset.id);
          } catch {
            // Preset might already exist (race/duplicate): reload and recover.
            await loadPresets();
            const recoveredDefault = usePresetStore.getState().getDefaultPreset();
            if (recoveredDefault) {
              setActivePreset(recoveredDefault.id);
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
    };

    void bootstrap();
  }, []);

  return { ready };
}
