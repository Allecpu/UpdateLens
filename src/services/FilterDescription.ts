import type { FilterState } from '../models/Filters';

/**
 * Descrittore di un filtro attivo: l'etichetta leggibile piu' l'informazione
 * necessaria per rimuoverlo.
 *
 * Esiste per avere UNA sola fonte di verita' per "quali filtri sono attivi":
 * la Dashboard ci costruisce sopra i chip rimuovibili, l'export PowerPoint
 * ne usa le sole etichette. Prima la logica viveva dentro un useMemo con le
 * closure onRemove, quindi non era riutilizzabile fuori dal componente.
 */
export type FilterDescriptor =
  | {
      /** Filtro multi-valore: si rimuove il singolo valore dalla lista. */
      kind: 'value';
      label: string;
      key: keyof FilterState;
      value: string;
    }
  | {
      /** Filtro scalare: si azzera riportandolo a `resetValue`. */
      kind: 'scalar';
      label: string;
      key: keyof FilterState;
      resetValue: string | number | null;
    };

/**
 * Elenca i filtri attivi in forma strutturata, nell'ordine in cui vanno
 * mostrati all'utente.
 */
export const describeFilterState = (filters: FilterState): FilterDescriptor[] => {
  const entries: FilterDescriptor[] = [];

  const pushValues = (label: string, key: keyof FilterState, values: string[]) => {
    values.forEach((value) => {
      entries.push({ kind: 'value', label: `${label}: ${value}`, key, value });
    });
  };

  pushValues('Fonte', 'sources', filters.sources);
  pushValues('Stato', 'statuses', filters.statuses);
  pushValues('Prodotto', 'products', filters.products);
  pushValues('Tag', 'tags', filters.tags);
  pushValues('Mese', 'months', filters.months);

  if (filters.query) {
    entries.push({
      kind: 'scalar',
      label: `Ricerca: ${filters.query}`,
      key: 'query',
      resetValue: ''
    });
  }
  if (filters.periodNewDays > 0) {
    entries.push({
      kind: 'scalar',
      label: `Nuovi: ${filters.periodNewDays} giorni`,
      key: 'periodNewDays',
      resetValue: 0
    });
  }
  if (filters.periodChangedDays > 0) {
    entries.push({
      kind: 'scalar',
      label: `Modificati: ${filters.periodChangedDays} giorni`,
      key: 'periodChangedDays',
      resetValue: 0
    });
  }
  if (filters.releaseInDays > 0) {
    entries.push({
      kind: 'scalar',
      label: `Release entro: ${filters.releaseInDays} giorni`,
      key: 'releaseInDays',
      resetValue: 0
    });
  }
  if (filters.bcVersions.length > 0) {
    pushValues('BC', 'bcVersions', filters.bcVersions);
  } else if (filters.minBcVersionMin !== null) {
    entries.push({
      kind: 'scalar',
      label: `BC Min Version >= ${filters.minBcVersionMin}`,
      key: 'minBcVersionMin',
      resetValue: null
    });
  }
  if (filters.releaseDateFrom) {
    entries.push({
      kind: 'scalar',
      label: `Da: ${filters.releaseDateFrom}`,
      key: 'releaseDateFrom',
      resetValue: ''
    });
  }
  if (filters.releaseDateTo) {
    entries.push({
      kind: 'scalar',
      label: `A: ${filters.releaseDateTo}`,
      key: 'releaseDateTo',
      resetValue: ''
    });
  }

  return entries;
};

/** Sole etichette dei filtri attivi, per gli export testuali. */
export const describeActiveFilters = (filters: FilterState): string[] =>
  describeFilterState(filters).map((entry) => entry.label);
