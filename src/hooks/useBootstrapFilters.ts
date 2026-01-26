import { useEffect } from 'react';
import { useFilterStore } from '../app/store/useFilterStore';
import { FilterExportSchema } from '../validators/FilterSchema';

const BOOTSTRAP_FILE_PATH = 'data/config/globalFilters.json';
const CSS_FILTER_KEY = 'updatelens.filters.css.v3';

export const useBootstrapFilters = () => {
    const { cssFilters, setCssFilters } = useFilterStore();

    useEffect(() => {
        const bootstrap = async () => {
            // 1. Check if user already has filters (bootstrapping only happens if empty)
            const hasLocalFilters = localStorage.getItem(CSS_FILTER_KEY);
            if (hasLocalFilters) {
                return;
            }

            // 2. Avoid re-running if store is already populated (double check)
            if (cssFilters) {
                return;
            }

            try {
                // 3. Fetch the bootstrap file
                const response = await fetch(BOOTSTRAP_FILE_PATH);
                if (!response.ok) {
                    // File might not exist, which is fine (no bootstrap)
                    return;
                }

                const json = await response.json();

                // 4. Validate schema
                const result = FilterExportSchema.safeParse(json);
                if (!result.success) {
                    console.warn('[Bootstrap] Invalid filter file:', result.error);
                    return;
                }

                // 5. Apply filters
                console.log('[Bootstrap] Applying global filters from release:', result.data.meta);
                setCssFilters(result.data.data);

            } catch (error) {
                // Silent fail for bootstrap
                console.warn('[Bootstrap] Failed to load initial filters:', error);
            }
        };

        bootstrap();
    }, [cssFilters, setCssFilters]);
};
