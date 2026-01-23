import type { ReleaseItem } from '../models/ReleaseItem';
import type { ParsedIntent } from './ChatIntentService';

export type ChatResponse = {
  message: string;
  items: ReleaseItem[];
  showPreview: boolean;
  canApplyFilters: boolean;
};

/**
 * Format entities list for display
 */
const formatEntities = (entities: string[]): string => {
  if (entities.length === 0) return '';
  if (entities.length === 1) return entities[0];
  if (entities.length === 2) return `${entities[0]} e ${entities[1]}`;
  return entities.slice(0, -1).join(', ') + ' e ' + entities[entities.length - 1];
};

/**
 * Generate count by source
 */
const countBySource = (items: ReleaseItem[]): Map<string, number> => {
  const counts = new Map<string, number>();
  items.forEach(item => {
    counts.set(item.source, (counts.get(item.source) ?? 0) + 1);
  });
  return counts;
};

/**
 * Generate count by product
 */
const countByProduct = (items: ReleaseItem[]): Map<string, number> => {
  const counts = new Map<string, number>();
  items.forEach(item => {
    const product = item.productName || item.product || 'Sconosciuto';
    counts.set(product, (counts.get(product) ?? 0) + 1);
  });
  return counts;
};

/**
 * Get top N entries from a count map
 */
const getTopN = (counts: Map<string, number>, n: number): Array<[string, number]> => {
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
};

/**
 * Group items by month for trend analysis
 */
const groupByMonth = (items: ReleaseItem[]): Map<string, number> => {
  const counts = new Map<string, number>();
  items.forEach(item => {
    const date = item.releaseDate || item.modifiedDate;
    if (date) {
      const monthKey = date.slice(0, 7); // YYYY-MM
      counts.set(monthKey, (counts.get(monthKey) ?? 0) + 1);
    }
  });
  return counts;
};

/**
 * Format correction message
 */
const formatCorrection = (correction: { original: string; corrected: string }): string => {
  return `(intendevi "${correction.corrected}"?)`;
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
  const entity = intent.entities[0] ?? '';
  const negatedPrefix = intent.negated ? 'escluso ' : '';
  const correctionSuffix = intent.correction ? ` ${formatCorrection(intent.correction)}` : '';

  switch (intent.type) {
    case 'RESET_FILTERS':
      return {
        message: `Filtri azzerati. Mostro tutti i ${totalItems} elementi disponibili.`,
        items: [],
        showPreview: false,
        canApplyFilters: true
      };

    case 'ANALYTICS_COUNT': {
      if (intent.analyticsTarget === 'all') {
        const sourceCounts = countBySource(filteredItems);
        const sourceList = Array.from(sourceCounts.entries())
          .map(([source, c]) => `• ${source}: ${c}`)
          .join('\n');
        return {
          message: `Totale elementi: ${totalItems}\n\nPer fonte:\n${sourceList}`,
          items: [],
          showPreview: false,
          canApplyFilters: false
        };
      }
      return {
        message: `Trovati ${count} elementi per "${entity}".`,
        items: [],
        showPreview: false,
        canApplyFilters: false
      };
    }

    case 'ANALYTICS_TOP': {
      const isSource = intent.analyticsTarget === 'source';
      const counts = isSource ? countBySource(filteredItems) : countByProduct(filteredItems);
      const top5 = getTopN(counts, 5);
      const label = isSource ? 'fonti' : 'prodotti';
      const list = top5.map(([name, c], i) => `${i + 1}. ${name}: ${c}`).join('\n');
      return {
        message: `Top 5 ${label} con più elementi:\n${list}`,
        items: [],
        showPreview: false,
        canApplyFilters: false
      };
    }

    case 'ANALYTICS_COMPARE': {
      const [target1, target2] = intent.compareTargets || ['', ''];
      const items1 = filteredItems.filter(
        i => i.source.toLowerCase().includes(target1.toLowerCase()) ||
             (i.productName || '').toLowerCase().includes(target1.toLowerCase())
      );
      const items2 = filteredItems.filter(
        i => i.source.toLowerCase().includes(target2.toLowerCase()) ||
             (i.productName || '').toLowerCase().includes(target2.toLowerCase())
      );

      const diff = items1.length - items2.length;
      const comparison = diff > 0
        ? `${target1} ha ${diff} elementi in più`
        : diff < 0
        ? `${target2} ha ${Math.abs(diff)} elementi in più`
        : 'Hanno lo stesso numero di elementi';

      return {
        message: `Confronto tra ${target1} e ${target2}:\n\n` +
          `• ${target1}: ${items1.length} elementi\n` +
          `• ${target2}: ${items2.length} elementi\n\n` +
          comparison,
        items: [],
        showPreview: false,
        canApplyFilters: false
      };
    }

    case 'ANALYTICS_TREND': {
      const target = intent.trendTarget || '';
      const targetItems = filteredItems.filter(
        i => i.source.toLowerCase().includes(target.toLowerCase()) ||
             (i.productName || '').toLowerCase().includes(target.toLowerCase())
      );

      const monthCounts = groupByMonth(targetItems);
      const sortedMonths = Array.from(monthCounts.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-6); // Last 6 months

      if (sortedMonths.length === 0) {
        return {
          message: `Nessun dato trend disponibile per "${target}".`,
          items: [],
          showPreview: false,
          canApplyFilters: false
        };
      }

      const trendList = sortedMonths
        .map(([month, c]) => {
          const [y, m] = month.split('-');
          const monthName = new Date(parseInt(y), parseInt(m) - 1).toLocaleString('it-IT', { month: 'short', year: 'numeric' });
          return `• ${monthName}: ${c}`;
        })
        .join('\n');

      const first = sortedMonths[0][1];
      const last = sortedMonths[sortedMonths.length - 1][1];
      const trend = last > first ? 'in crescita' : last < first ? 'in calo' : 'stabile';

      return {
        message: `Trend "${target}" (${intent.trendPeriod}):\n\n${trendList}\n\nAndamento: ${trend}`,
        items: [],
        showPreview: false,
        canApplyFilters: false
      };
    }

    case 'FILTER_BY_PRODUCT':
      if (count === 0) {
        return {
          message: `Nessun risultato trovato per ${negatedPrefix}"${entity}".${correctionSuffix}`,
          items: [],
          showPreview: false,
          canApplyFilters: false
        };
      }
      return {
        message: `Trovati ${count} elementi per ${negatedPrefix}"${entity}".${correctionSuffix}`,
        items: preview,
        showPreview: true,
        canApplyFilters: true
      };

    case 'FILTER_BY_SOURCE':
      if (count === 0) {
        return {
          message: `Nessun elemento trovato ${negatedPrefix}dalla fonte "${entity}".${correctionSuffix}`,
          items: [],
          showPreview: false,
          canApplyFilters: false
        };
      }
      return {
        message: `Trovati ${count} elementi ${negatedPrefix}da "${entity}".${correctionSuffix}`,
        items: preview,
        showPreview: true,
        canApplyFilters: true
      };

    case 'FILTER_BY_PERIOD':
      if (count === 0) {
        return {
          message: `Nessuna novità ${entity}.`,
          items: [],
          showPreview: false,
          canApplyFilters: false
        };
      }
      return {
        message: `Trovati ${count} elementi ${entity}.`,
        items: preview,
        showPreview: true,
        canApplyFilters: true
      };

    case 'FILTER_BY_DATE_RANGE':
      if (count === 0) {
        return {
          message: `Nessun elemento nel periodo ${entity}.`,
          items: [],
          showPreview: false,
          canApplyFilters: false
        };
      }
      return {
        message: `Trovati ${count} elementi nel periodo ${entity}.`,
        items: preview,
        showPreview: true,
        canApplyFilters: true
      };

    case 'FILTER_BY_WAVE':
      if (count === 0) {
        return {
          message: `Nessun elemento per ${entity}.`,
          items: [],
          showPreview: false,
          canApplyFilters: false
        };
      }
      return {
        message: `Trovati ${count} elementi per ${entity}.`,
        items: preview,
        showPreview: true,
        canApplyFilters: true
      };

    case 'FILTER_BY_AVAILABILITY':
      if (count === 0) {
        return {
          message: `Nessun elemento ${negatedPrefix}in "${entity}".`,
          items: [],
          showPreview: false,
          canApplyFilters: false
        };
      }
      return {
        message: `Trovati ${count} elementi ${negatedPrefix}in "${entity}".`,
        items: preview,
        showPreview: true,
        canApplyFilters: true
      };

    case 'FILTER_BY_STATUS':
      if (count === 0) {
        return {
          message: `Nessun elemento ${negatedPrefix}con stato "${entity}".`,
          items: [],
          showPreview: false,
          canApplyFilters: false
        };
      }
      return {
        message: `Trovati ${count} elementi ${negatedPrefix}con stato "${entity}".`,
        items: preview,
        showPreview: true,
        canApplyFilters: true
      };

    case 'FILTER_BY_CATEGORY':
      if (count === 0) {
        return {
          message: `Nessun elemento ${negatedPrefix}nella categoria "${entity}".`,
          items: [],
          showPreview: false,
          canApplyFilters: false
        };
      }
      return {
        message: `Trovati ${count} elementi ${negatedPrefix}nella categoria "${entity}".`,
        items: preview,
        showPreview: true,
        canApplyFilters: true
      };

    case 'FILTER_COMBINED': {
      const description = formatEntities(intent.entities);
      if (count === 0) {
        return {
          message: `Nessun risultato per: ${negatedPrefix}${description}.${correctionSuffix}`,
          items: [],
          showPreview: false,
          canApplyFilters: false
        };
      }
      return {
        message: `Trovati ${count} elementi con filtri: ${negatedPrefix}${description}.${correctionSuffix}`,
        items: preview,
        showPreview: true,
        canApplyFilters: true
      };
    }

    case 'SEARCH_TEXT':
      if (count === 0) {
        return {
          message: `Nessun risultato per "${entity}".`,
          items: [],
          showPreview: false,
          canApplyFilters: false
        };
      }
      return {
        message: `Trovati ${count} risultati per "${entity}".`,
        items: preview,
        showPreview: true,
        canApplyFilters: true
      };

    case 'UNKNOWN':
    default:
      return {
        message: 'Non ho capito la richiesta. Prova con:\n' +
          '• "novità Fabric ultimi 30 giorni in GA"\n' +
          '• "da gennaio a marzo 2024"\n' +
          '• "wave 1 2024"\n' +
          '• "confronta Fabric con EOS"\n' +
          '• "trend Microsoft"\n' +
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
    '• "novità Fabric ultimi 30 giorni"\n' +
    '• "da gennaio a marzo 2024"\n' +
    '• "wave 1 2024"\n' +
    '• "confronta Fabric con EOS"\n' +
    '• "trend Microsoft"';
};
