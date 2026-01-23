import type { ReleaseItem } from '../models/ReleaseItem';
import type { ParsedIntent } from './ChatIntentService';

export type ChatResponse = {
  message: string;
  items: ReleaseItem[];
  showPreview: boolean;
  canApplyFilters: boolean;
};

/**
 * Generate Italian response based on intent and results
 */
export const generateResponse = (
  intent: ParsedIntent,
  filteredItems: ReleaseItem[],
  totalItems: number
): ChatResponse => {
  const count = filteredItems.length;
  const preview = filteredItems.slice(0, 5);

  switch (intent.type) {
    case 'RESET_FILTERS':
      return {
        message: `Filtri azzerati. Mostro tutti i ${totalItems} elementi disponibili.`,
        items: [],
        showPreview: false,
        canApplyFilters: true
      };

    case 'FILTER_BY_PRODUCT':
      if (count === 0) {
        return {
          message: `Nessun risultato trovato per "${intent.entity}".`,
          items: [],
          showPreview: false,
          canApplyFilters: false
        };
      }
      return {
        message: `Trovati ${count} elementi per "${intent.entity}".`,
        items: preview,
        showPreview: true,
        canApplyFilters: true
      };

    case 'FILTER_BY_SOURCE':
      if (count === 0) {
        return {
          message: `Nessun elemento trovato dalla fonte "${intent.entity}".`,
          items: [],
          showPreview: false,
          canApplyFilters: false
        };
      }
      return {
        message: `Trovati ${count} elementi da "${intent.entity}".`,
        items: preview,
        showPreview: true,
        canApplyFilters: true
      };

    case 'FILTER_BY_PERIOD':
      if (count === 0) {
        return {
          message: `Nessuna novità negli ultimi ${intent.value} giorni.`,
          items: [],
          showPreview: false,
          canApplyFilters: false
        };
      }
      return {
        message: `Trovati ${count} elementi negli ultimi ${intent.value} giorni.`,
        items: preview,
        showPreview: true,
        canApplyFilters: true
      };

    case 'FILTER_BY_AVAILABILITY':
      if (count === 0) {
        return {
          message: `Nessun elemento in "${intent.entity}".`,
          items: [],
          showPreview: false,
          canApplyFilters: false
        };
      }
      return {
        message: `Trovati ${count} elementi in "${intent.entity}".`,
        items: preview,
        showPreview: true,
        canApplyFilters: true
      };

    case 'FILTER_BY_STATUS':
      if (count === 0) {
        return {
          message: `Nessun elemento con stato "${intent.entity}".`,
          items: [],
          showPreview: false,
          canApplyFilters: false
        };
      }
      return {
        message: `Trovati ${count} elementi con stato "${intent.entity}".`,
        items: preview,
        showPreview: true,
        canApplyFilters: true
      };

    case 'SEARCH_TEXT':
      if (count === 0) {
        return {
          message: `Nessun risultato per "${intent.value}".`,
          items: [],
          showPreview: false,
          canApplyFilters: false
        };
      }
      return {
        message: `Trovati ${count} risultati per "${intent.value}".`,
        items: preview,
        showPreview: true,
        canApplyFilters: true
      };

    case 'UNKNOWN':
    default:
      return {
        message: 'Non ho capito la richiesta. Prova con:\n' +
          '• "novità per Fabric"\n' +
          '• "ultimi 30 giorni"\n' +
          '• "novità in GA"\n' +
          '• "cerca Teams"\n' +
          '• "mostra tutto"',
        items: [],
        showPreview: false,
        canApplyFilters: false
      };
  }
};

/**
 * Get welcome message
 */
export const getWelcomeMessage = (): string => {
  return 'Ciao! Sono l\'assistente UpdateLens. Puoi chiedermi:\n' +
    '• "novità per [prodotto]"\n' +
    '• "ultimi [N] giorni"\n' +
    '• "novità in GA" o "in preview"\n' +
    '• "cerca [testo]"\n' +
    '• "mostra tutto"';
};
