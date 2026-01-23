import type { FilterState } from '../models/Filters';
import type { FilterMetadata } from './FilterMetadata';
import type { ReleaseSource } from '../models/ReleaseItem';
import { ALL_RELEASE_SOURCES } from './FilterDefinitions';

export type IntentType =
  | 'FILTER_BY_PRODUCT'
  | 'FILTER_BY_SOURCE'
  | 'FILTER_BY_PERIOD'
  | 'FILTER_BY_AVAILABILITY'
  | 'FILTER_BY_STATUS'
  | 'SEARCH_TEXT'
  | 'RESET_FILTERS'
  | 'UNKNOWN';

export type ParsedIntent = {
  type: IntentType;
  entity?: string;
  value?: string | number;
  filterPatch: Partial<FilterState>;
};

// Source aliases for fuzzy matching
const SOURCE_ALIASES: Record<string, ReleaseSource> = {
  'microsoft': 'Microsoft',
  'ms': 'Microsoft',
  'release plans': 'Microsoft',
  'releaseplans': 'Microsoft',
  'eos': 'EOS',
  'eos apps': 'EOS',
  'fabric': 'Fabric',
  'microsoft fabric': 'Fabric',
  'm365': 'MICROSOFT 365',
  'microsoft 365': 'MICROSOFT 365',
  '365': 'MICROSOFT 365',
  'office 365': 'MICROSOFT 365',
  'roadmap': 'MICROSOFT 365'
};

// Product aliases for common names
const PRODUCT_ALIASES: Record<string, string> = {
  'bc': 'Business Central',
  'business central': 'Business Central',
  'dynamics 365 business central': 'Business Central',
  'd365 bc': 'Business Central',
  'teams': 'Microsoft Teams',
  'sharepoint': 'SharePoint',
  'outlook': 'Microsoft Outlook',
  'excel': 'Microsoft Excel',
  'word': 'Microsoft Word',
  'powerpoint': 'Microsoft PowerPoint',
  'power bi': 'Power BI',
  'powerbi': 'Power BI',
  'copilot': 'Copilot',
  'dynamics': 'Dynamics 365',
  'd365': 'Dynamics 365',
  'dataverse': 'Dataverse',
  'power platform': 'Power Platform',
  'power apps': 'Power Apps',
  'powerapps': 'Power Apps',
  'power automate': 'Power Automate',
  'flow': 'Power Automate'
};

// Availability type mapping
const AVAILABILITY_ALIASES: Record<string, string> = {
  'ga': 'General Availability',
  'general availability': 'General Availability',
  'disponibilità generale': 'General Availability',
  'preview': 'Public Preview',
  'public preview': 'Public Preview',
  'anteprima': 'Public Preview',
  'anteprima pubblica': 'Public Preview'
};

// Status mapping
const STATUS_ALIASES: Record<string, string> = {
  'launched': 'Launched',
  'lanciato': 'Launched',
  'rilasciato': 'Launched',
  'rolling out': 'Rolling out',
  'in corso': 'Rolling out',
  'in rilascio': 'Rolling out',
  'planned': 'Planned',
  'pianificato': 'Planned',
  'try now': 'Try now',
  'prova ora': 'Try now'
};

/**
 * Fuzzy match a product name against metadata
 */
const fuzzyMatchProduct = (
  query: string,
  metadata: FilterMetadata
): string | null => {
  const normalized = query.toLowerCase().trim();

  // Check aliases first
  const aliasMatch = PRODUCT_ALIASES[normalized];
  if (aliasMatch) {
    // Find exact match in metadata
    const found = metadata.products.find(
      p => p.value.toLowerCase() === aliasMatch.toLowerCase()
    );
    if (found) return found.value;
  }

  // Try exact match
  const exactMatch = metadata.products.find(
    p => p.value.toLowerCase() === normalized
  );
  if (exactMatch) return exactMatch.value;

  // Try partial match (contains)
  const partialMatch = metadata.products.find(
    p => p.value.toLowerCase().includes(normalized) ||
         normalized.includes(p.value.toLowerCase())
  );
  if (partialMatch) return partialMatch.value;

  return null;
};

/**
 * Fuzzy match a source name
 */
const fuzzyMatchSource = (query: string): ReleaseSource | null => {
  const normalized = query.toLowerCase().trim();

  // Check aliases
  const aliasMatch = SOURCE_ALIASES[normalized];
  if (aliasMatch) return aliasMatch;

  // Try direct match
  const directMatch = ALL_RELEASE_SOURCES.find(
    s => s.toLowerCase() === normalized
  );
  if (directMatch) return directMatch;

  // Try partial match
  const partialMatch = ALL_RELEASE_SOURCES.find(
    s => s.toLowerCase().includes(normalized) ||
         normalized.includes(s.toLowerCase())
  );
  if (partialMatch) return partialMatch;

  return null;
};

/**
 * Parse user query into intent and filter patch
 */
export const parseIntent = (
  text: string,
  metadata: FilterMetadata
): ParsedIntent => {
  const normalized = text.toLowerCase().trim();

  // Pattern: reset/mostra tutto
  if (/^(mostra tutto|reset|resetta|azzera|pulisci filtri?)$/i.test(normalized)) {
    return {
      type: 'RESET_FILTERS',
      filterPatch: {}
    };
  }

  // Pattern: ultime novità per {product/source}
  const novitaMatch = normalized.match(
    /^(?:ultime\s+)?novit[àa]\s+(?:per|di|su)\s+(.+)$/i
  );
  if (novitaMatch) {
    const entity = novitaMatch[1].trim();

    // Try source first
    const sourceMatch = fuzzyMatchSource(entity);
    if (sourceMatch) {
      return {
        type: 'FILTER_BY_SOURCE',
        entity: sourceMatch,
        filterPatch: {
          sources: [sourceMatch]
        }
      };
    }

    // Try product
    const productMatch = fuzzyMatchProduct(entity, metadata);
    if (productMatch) {
      return {
        type: 'FILTER_BY_PRODUCT',
        entity: productMatch,
        filterPatch: {
          products: [productMatch]
        }
      };
    }

    // No match - try as search
    return {
      type: 'SEARCH_TEXT',
      value: entity,
      filterPatch: {
        query: entity
      }
    };
  }

  // Pattern: cosa è uscito negli ultimi {N} giorni
  const periodMatch = normalized.match(
    /^(?:cosa\s+[èe]\s+uscito|novit[àa]|aggiornamenti)\s+(?:negli?\s+)?ultimi?\s+(\d+)\s+giorni?$/i
  );
  if (periodMatch) {
    const days = parseInt(periodMatch[1], 10);
    return {
      type: 'FILTER_BY_PERIOD',
      value: days,
      filterPatch: {
        periodNewDays: days
      }
    };
  }

  // Pattern: ultimi {N} giorni (short form)
  const shortPeriodMatch = normalized.match(/^ultimi?\s+(\d+)\s+giorni?$/i);
  if (shortPeriodMatch) {
    const days = parseInt(shortPeriodMatch[1], 10);
    return {
      type: 'FILTER_BY_PERIOD',
      value: days,
      filterPatch: {
        periodNewDays: days
      }
    };
  }

  // Pattern: novità in {availability} (GA, preview)
  const availabilityMatch = normalized.match(
    /^novit[àa]\s+in\s+(ga|general\s+availability|preview|public\s+preview|anteprima(?:\s+pubblica)?)$/i
  );
  if (availabilityMatch) {
    const rawType = availabilityMatch[1].toLowerCase();
    const availabilityType = AVAILABILITY_ALIASES[rawType] || rawType;
    return {
      type: 'FILTER_BY_AVAILABILITY',
      entity: availabilityType,
      filterPatch: {
        availabilityTypes: [availabilityType]
      }
    };
  }

  // Pattern: filtri per stato {status}
  const statusMatch = normalized.match(
    /^(?:filtr[io]\s+per\s+)?stato\s+(.+)$/i
  );
  if (statusMatch) {
    const rawStatus = statusMatch[1].toLowerCase().trim();
    const status = STATUS_ALIASES[rawStatus] || rawStatus;
    // Capitalize first letter
    const normalizedStatus = status.charAt(0).toUpperCase() + status.slice(1);
    return {
      type: 'FILTER_BY_STATUS',
      entity: normalizedStatus,
      filterPatch: {
        statuses: [normalizedStatus]
      }
    };
  }

  // Pattern: cerca {text}
  const searchMatch = normalized.match(/^cerca\s+(.+)$/i);
  if (searchMatch) {
    const searchText = searchMatch[1].trim();
    return {
      type: 'SEARCH_TEXT',
      value: searchText,
      filterPatch: {
        query: searchText
      }
    };
  }

  // Pattern: solo {source}
  const soloSourceMatch = normalized.match(/^solo\s+(.+)$/i);
  if (soloSourceMatch) {
    const entity = soloSourceMatch[1].trim();
    const sourceMatch = fuzzyMatchSource(entity);
    if (sourceMatch) {
      return {
        type: 'FILTER_BY_SOURCE',
        entity: sourceMatch,
        filterPatch: {
          sources: [sourceMatch]
        }
      };
    }
  }

  // Pattern: direct source name
  const directSource = fuzzyMatchSource(normalized);
  if (directSource) {
    return {
      type: 'FILTER_BY_SOURCE',
      entity: directSource,
      filterPatch: {
        sources: [directSource]
      }
    };
  }

  // Pattern: direct product name
  const directProduct = fuzzyMatchProduct(normalized, metadata);
  if (directProduct) {
    return {
      type: 'FILTER_BY_PRODUCT',
      entity: directProduct,
      filterPatch: {
        products: [directProduct]
      }
    };
  }

  // Fallback: treat as search query
  if (normalized.length > 2) {
    return {
      type: 'SEARCH_TEXT',
      value: normalized,
      filterPatch: {
        query: normalized
      }
    };
  }

  return {
    type: 'UNKNOWN',
    filterPatch: {}
  };
};
