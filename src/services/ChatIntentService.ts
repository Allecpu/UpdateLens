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
  | 'FILTER_BY_CATEGORY'
  | 'FILTER_BY_WAVE'
  | 'FILTER_BY_DATE_RANGE'
  | 'FILTER_COMBINED'
  | 'SEARCH_TEXT'
  | 'RESET_FILTERS'
  | 'ANALYTICS_COUNT'
  | 'ANALYTICS_TOP'
  | 'ANALYTICS_COMPARE'
  | 'ANALYTICS_TREND'
  | 'UNKNOWN';

export type ParsedIntent = {
  type: IntentType;
  entities: string[];
  filterPatch: Partial<FilterState>;
  negated?: boolean;
  analyticsTarget?: string;
  compareTargets?: [string, string];
  trendTarget?: string;
  trendPeriod?: string;
  correction?: { original: string; corrected: string };
};

// Store last intent for context
let lastIntent: ParsedIntent | null = null;

export const getLastIntent = (): ParsedIntent | null => lastIntent;
export const clearLastIntent = (): void => { lastIntent = null; };

// ============================================================================
// Aliases for fuzzy matching (Italian only)
// ============================================================================

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
  'flow': 'Power Automate',
  'onedrive': 'OneDrive',
  'onenote': 'OneNote',
  'planner': 'Microsoft Planner',
  'viva': 'Microsoft Viva',
  'loop': 'Microsoft Loop'
};

const AVAILABILITY_ALIASES: Record<string, string> = {
  'ga': 'General Availability',
  'general availability': 'General Availability',
  'disponibilità generale': 'General Availability',
  'disponibilita generale': 'General Availability',
  'preview': 'Public Preview',
  'public preview': 'Public Preview',
  'anteprima': 'Public Preview',
  'anteprima pubblica': 'Public Preview'
};

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

const MONTH_NAMES: Record<string, number> = {
  'gennaio': 1, 'febbraio': 2, 'marzo': 3, 'aprile': 4,
  'maggio': 5, 'giugno': 6, 'luglio': 7, 'agosto': 8,
  'settembre': 9, 'ottobre': 10, 'novembre': 11, 'dicembre': 12,
  'gen': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'mag': 5, 'giu': 6,
  'lug': 7, 'ago': 8, 'set': 9, 'ott': 10, 'nov': 11, 'dic': 12
};

// ============================================================================
// Levenshtein distance for typo correction
// ============================================================================

const levenshtein = (a: string, b: string): number => {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
};

/**
 * Find best match with typo tolerance
 */
const fuzzyMatchWithTypo = (
  query: string,
  candidates: string[],
  maxDistance = 2
): { match: string | null; original: string; corrected: string | null } => {
  const normalized = query.toLowerCase().trim();

  // Exact match first
  const exact = candidates.find(c => c.toLowerCase() === normalized);
  if (exact) return { match: exact, original: query, corrected: null };

  // Find closest match within distance
  let bestMatch: string | null = null;
  let bestDistance = maxDistance + 1;

  for (const candidate of candidates) {
    const dist = levenshtein(normalized, candidate.toLowerCase());
    if (dist <= maxDistance && dist < bestDistance) {
      bestDistance = dist;
      bestMatch = candidate;
    }
  }

  return {
    match: bestMatch,
    original: query,
    corrected: bestMatch && bestDistance > 0 ? bestMatch : null
  };
};

// ============================================================================
// Fuzzy matchers
// ============================================================================

const fuzzyMatchProduct = (
  query: string,
  metadata: FilterMetadata
): { match: string | null; correction?: { original: string; corrected: string } } => {
  const normalized = query.toLowerCase().trim();

  // Check aliases first
  const aliasMatch = PRODUCT_ALIASES[normalized];
  if (aliasMatch) {
    const found = metadata.products.find(
      p => p.value.toLowerCase() === aliasMatch.toLowerCase()
    );
    if (found) return { match: found.value };
  }

  // Check alias with typo tolerance
  const aliasKeys = Object.keys(PRODUCT_ALIASES);
  const aliasTypoResult = fuzzyMatchWithTypo(normalized, aliasKeys);
  if (aliasTypoResult.match && aliasTypoResult.corrected) {
    const aliasValue = PRODUCT_ALIASES[aliasTypoResult.match];
    const found = metadata.products.find(
      p => p.value.toLowerCase() === aliasValue.toLowerCase()
    );
    if (found) {
      return {
        match: found.value,
        correction: { original: query, corrected: aliasTypoResult.match }
      };
    }
  }

  // Exact match in metadata
  const exactMatch = metadata.products.find(
    p => p.value.toLowerCase() === normalized
  );
  if (exactMatch) return { match: exactMatch.value };

  // Typo tolerance in metadata products
  const productNames = metadata.products.map(p => p.value);
  const typoResult = fuzzyMatchWithTypo(normalized, productNames);
  if (typoResult.match) {
    return {
      match: typoResult.match,
      correction: typoResult.corrected
        ? { original: query, corrected: typoResult.match }
        : undefined
    };
  }

  // Partial match
  const partialMatch = metadata.products.find(
    p => p.value.toLowerCase().includes(normalized) ||
         normalized.includes(p.value.toLowerCase())
  );
  if (partialMatch) return { match: partialMatch.value };

  return { match: null };
};

const fuzzyMatchSource = (
  query: string
): { match: ReleaseSource | null; correction?: { original: string; corrected: string } } => {
  const normalized = query.toLowerCase().trim();

  // Check aliases
  const aliasMatch = SOURCE_ALIASES[normalized];
  if (aliasMatch) return { match: aliasMatch };

  // Typo tolerance for aliases
  const aliasKeys = Object.keys(SOURCE_ALIASES);
  const aliasTypoResult = fuzzyMatchWithTypo(normalized, aliasKeys);
  if (aliasTypoResult.match && aliasTypoResult.corrected) {
    return {
      match: SOURCE_ALIASES[aliasTypoResult.match],
      correction: { original: query, corrected: aliasTypoResult.match }
    };
  }

  // Direct match
  const directMatch = ALL_RELEASE_SOURCES.find(
    s => s.toLowerCase() === normalized
  );
  if (directMatch) return { match: directMatch };

  // Typo tolerance for sources
  const typoResult = fuzzyMatchWithTypo(normalized, [...ALL_RELEASE_SOURCES]);
  if (typoResult.match) {
    return {
      match: typoResult.match as ReleaseSource,
      correction: typoResult.corrected
        ? { original: query, corrected: typoResult.match }
        : undefined
    };
  }

  return { match: null };
};

const fuzzyMatchCategory = (
  query: string,
  metadata: FilterMetadata
): string | null => {
  const normalized = query.toLowerCase().trim();

  const exactMatch = metadata.categories.find(
    c => c.value.toLowerCase() === normalized
  );
  if (exactMatch) return exactMatch.value;

  const partialMatch = metadata.categories.find(
    c => c.value.toLowerCase().includes(normalized) ||
         normalized.includes(c.value.toLowerCase())
  );
  if (partialMatch) return partialMatch.value;

  return null;
};

// ============================================================================
// Entity extractors
// ============================================================================

type ExtractResult<T> = {
  value: T | null;
  remaining: string;
  label: string;
  correction?: { original: string; corrected: string };
};

type MultiExtractResult<T> = {
  values: T[];
  remaining: string;
  labels: string[];
  correction?: { original: string; corrected: string };
};

/**
 * Extract period (ultimi N giorni) from text
 */
const extractPeriod = (text: string): ExtractResult<number> => {
  const patterns = [
    /(?:negli?\s+)?ultimi?\s+(\d+)\s+giorni?/i,
    /(?:degli?\s+)?ultimi?\s+(\d+)\s+giorni?/i,
    /(\d+)\s+giorni?\s+(?:fa|recenti)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const days = parseInt(match[1], 10);
      const remaining = text.replace(match[0], ' ').replace(/\s+/g, ' ').trim();
      return { value: days, remaining, label: `ultimi ${days} giorni` };
    }
  }

  return { value: null, remaining: text, label: '' };
};

/**
 * Extract date range (da gennaio a marzo 2024) from text
 */
const extractDateRange = (text: string): ExtractResult<{ from: string; to: string }> => {
  // Pattern: da [mese] a [mese] [anno]
  const rangePattern = /da\s+(\w+)\s+a\s+(\w+)(?:\s+(\d{4}))?/i;
  const match = text.match(rangePattern);

  if (match) {
    const fromMonth = MONTH_NAMES[match[1].toLowerCase()];
    const toMonth = MONTH_NAMES[match[2].toLowerCase()];
    const year = match[3] || new Date().getFullYear().toString();

    if (fromMonth && toMonth) {
      const fromDate = `${year}-${String(fromMonth).padStart(2, '0')}-01`;
      const toDate = `${year}-${String(toMonth).padStart(2, '0')}-${new Date(parseInt(year), toMonth, 0).getDate()}`;
      const remaining = text.replace(match[0], ' ').replace(/\s+/g, ' ').trim();
      return {
        value: { from: fromDate, to: toDate },
        remaining,
        label: `da ${match[1]} a ${match[2]} ${year}`
      };
    }
  }

  // Single month pattern: [mese] [anno]
  const singleMonthPattern = /\b(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s*(\d{4})?\b/i;
  const singleMatch = text.match(singleMonthPattern);

  if (singleMatch) {
    const month = MONTH_NAMES[singleMatch[1].toLowerCase()];
    const year = singleMatch[2] || new Date().getFullYear().toString();

    if (month) {
      const fromDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const toDate = `${year}-${String(month).padStart(2, '0')}-${new Date(parseInt(year), month, 0).getDate()}`;
      const remaining = text.replace(singleMatch[0], ' ').replace(/\s+/g, ' ').trim();
      return {
        value: { from: fromDate, to: toDate },
        remaining,
        label: `${singleMatch[1]} ${year}`
      };
    }
  }

  return { value: null, remaining: text, label: '' };
};

/**
 * Extract wave (wave 1 2024) from text
 */
const extractWave = (text: string): ExtractResult<string> => {
  const patterns = [
    /wave\s*(\d)\s*(\d{4})?/i,
    /(\d{4})\s*wave\s*(\d)/i,
    /w(\d)\s*(\d{4})/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let waveNum: string;
      let year: string;

      if (pattern.source.startsWith('wave')) {
        waveNum = match[1];
        year = match[2] || new Date().getFullYear().toString();
      } else if (pattern.source.startsWith('(\\d{4})')) {
        year = match[1];
        waveNum = match[2];
      } else {
        waveNum = match[1];
        year = match[2] || new Date().getFullYear().toString();
      }

      const waveValue = `${year} Wave ${waveNum}`;
      const remaining = text.replace(match[0], ' ').replace(/\s+/g, ' ').trim();
      return { value: waveValue, remaining, label: waveValue };
    }
  }

  return { value: null, remaining: text, label: '' };
};

/**
 * Extract availability type (GA, preview) from text
 */
const extractAvailability = (text: string): ExtractResult<string> => {
  const patterns = [
    /\b(?:in\s+)?(ga|general\s+availability)\b/i,
    /\b(?:in\s+)?(preview|public\s+preview)\b/i,
    /\b(?:in\s+)?(anteprima(?:\s+pubblica)?)\b/i,
    /\b(?:in\s+)?(disponibilit[àa]\s+generale)\b/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const rawType = match[1].toLowerCase();
      const availabilityType = AVAILABILITY_ALIASES[rawType] || rawType;
      const remaining = text.replace(match[0], ' ').replace(/\s+/g, ' ').trim();
      return { value: availabilityType, remaining, label: availabilityType };
    }
  }

  return { value: null, remaining: text, label: '' };
};

/**
 * Extract status from text
 */
const extractStatus = (text: string): ExtractResult<string> => {
  const patterns = [
    /\b(?:stato\s+)?(launched|lanciato|rilasciato)\b/i,
    /\b(?:stato\s+)?(rolling\s+out|in\s+corso|in\s+rilascio)\b/i,
    /\b(?:stato\s+)?(planned|pianificato)\b/i,
    /\b(?:stato\s+)?(try\s+now|prova\s+ora)\b/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const rawStatus = match[1].toLowerCase().trim();
      const status = STATUS_ALIASES[rawStatus] || rawStatus;
      const normalizedStatus = status.charAt(0).toUpperCase() + status.slice(1);
      const remaining = text.replace(match[0], ' ').replace(/\s+/g, ' ').trim();
      return { value: normalizedStatus, remaining, label: normalizedStatus };
    }
  }

  return { value: null, remaining: text, label: '' };
};

/**
 * Extract source from text (single)
 */
const extractSource = (text: string): ExtractResult<ReleaseSource> => {
  const normalized = text.toLowerCase();

  const sortedAliases = Object.entries(SOURCE_ALIASES)
    .sort((a, b) => b[0].length - a[0].length);

  for (const [alias, source] of sortedAliases) {
    const pattern = new RegExp(`\\b${alias.replace(/\s+/g, '\\s+')}\\b`, 'i');
    if (pattern.test(normalized)) {
      const remaining = text.replace(pattern, ' ').replace(/\s+/g, ' ').trim();
      return { value: source, remaining, label: source };
    }
  }

  for (const source of ALL_RELEASE_SOURCES) {
    const pattern = new RegExp(`\\b${source.replace(/\s+/g, '\\s+')}\\b`, 'i');
    if (pattern.test(text)) {
      const remaining = text.replace(pattern, ' ').replace(/\s+/g, ' ').trim();
      return { value: source, remaining, label: source };
    }
  }

  return { value: null, remaining: text, label: '' };
};

/**
 * Extract multiple products from text (supports "e", ",")
 */
const extractMultipleProducts = (
  text: string,
  metadata: FilterMetadata
): MultiExtractResult<string> => {
  const values: string[] = [];
  const labels: string[] = [];
  let remaining = text;
  let correction: { original: string; corrected: string } | undefined;

  const sortedAliases = Object.entries(PRODUCT_ALIASES)
    .sort((a, b) => b[0].length - a[0].length);

  for (const [alias, productName] of sortedAliases) {
    const pattern = new RegExp(`\\b${alias.replace(/\s+/g, '\\s+')}\\b`, 'i');
    if (pattern.test(remaining.toLowerCase())) {
      const found = metadata.products.find(
        p => p.value.toLowerCase() === productName.toLowerCase()
      );
      if (found && !values.includes(found.value)) {
        values.push(found.value);
        labels.push(found.value);
        remaining = remaining.replace(pattern, ' ').replace(/\s+/g, ' ').trim();
      }
    }
  }

  const sortedProducts = [...metadata.products]
    .sort((a, b) => b.value.length - a.value.length);

  for (const product of sortedProducts) {
    const pattern = new RegExp(
      `\\b${product.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')}\\b`,
      'i'
    );
    if (pattern.test(remaining) && !values.includes(product.value)) {
      values.push(product.value);
      labels.push(product.value);
      remaining = remaining.replace(pattern, ' ').replace(/\s+/g, ' ').trim();
    }
  }

  // Try typo correction on remaining words if no products found
  if (values.length === 0) {
    const words = remaining.split(/\s+/);
    for (const word of words) {
      if (word.length >= 3) {
        const result = fuzzyMatchProduct(word, metadata);
        if (result.match && result.correction) {
          values.push(result.match);
          labels.push(result.match);
          correction = result.correction;
          remaining = remaining.replace(new RegExp(`\\b${word}\\b`, 'i'), ' ').trim();
          break;
        }
      }
    }
  }

  remaining = remaining
    .replace(/\s+(?:e|,)\s+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return { values, remaining, labels, correction };
};

/**
 * Extract category from text
 */
const extractCategory = (
  text: string,
  metadata: FilterMetadata
): ExtractResult<string> => {
  const categoryPattern = /(?:categoria|cat\.?)\s+["']?([^"']+)["']?/i;
  const match = text.match(categoryPattern);

  if (match) {
    const categoryName = match[1].trim();
    const found = fuzzyMatchCategory(categoryName, metadata);
    if (found) {
      const remaining = text.replace(match[0], ' ').replace(/\s+/g, ' ').trim();
      return { value: found, remaining, label: found };
    }
  }

  return { value: null, remaining: text, label: '' };
};

/**
 * Check for negation in text
 */
const extractNegation = (text: string): { negated: boolean; remaining: string } => {
  const negationPatterns = [
    /\b(?:non|senza|escludi|escludendo|tranne)\s+/i
  ];

  for (const pattern of negationPatterns) {
    if (pattern.test(text)) {
      const remaining = text.replace(pattern, ' ').replace(/\s+/g, ' ').trim();
      return { negated: true, remaining };
    }
  }

  return { negated: false, remaining: text };
};

/**
 * Check for context reference ("e per...", "anche per...")
 */
const extractContextReference = (text: string): { isContextRef: boolean; target: string } => {
  const patterns = [
    /^e\s+(?:per\s+)?(.+)$/i,
    /^anche\s+(?:per\s+)?(.+)$/i,
    /^stesso\s+(?:per\s+)?(.+)$/i,
    /^idem\s+(?:per\s+)?(.+)$/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && lastIntent) {
      return { isContextRef: true, target: match[1].trim() };
    }
  }

  return { isContextRef: false, target: '' };
};

/**
 * Check for analytics queries
 */
const parseAnalyticsQuery = (text: string, metadata: FilterMetadata): ParsedIntent | null => {
  const normalized = text.toLowerCase().trim();

  // Comparison queries
  const comparePatterns = [
    /^confronta\s+(.+?)\s+(?:con|e|vs\.?)\s+(.+)$/i,
    /^(.+?)\s+vs\.?\s+(.+)$/i,
    /^differenz[ae]\s+(?:tra\s+)?(.+?)\s+e\s+(.+)$/i
  ];

  for (const pattern of comparePatterns) {
    const match = normalized.match(pattern);
    if (match) {
      const target1 = match[1].trim();
      const target2 = match[2].trim();
      return {
        type: 'ANALYTICS_COMPARE',
        entities: [target1, target2],
        filterPatch: {},
        compareTargets: [target1, target2]
      };
    }
  }

  // Trend queries
  const trendPatterns = [
    /^(?:trend|andamento)\s+(?:di\s+)?(.+?)(?:\s+(?:ultim[oi]\s+)?(\d+)\s+(?:mes[ei]|settiman[ae]))?$/i,
    /^come\s+(?:[èe]\s+)?(?:andato|cambiato)\s+(.+?)(?:\s+(?:negli?\s+)?ultim[oi]\s+(\d+)\s+(?:mes[ei]|settiman[ae]))?$/i,
    /^evoluzione\s+(?:di\s+)?(.+)$/i
  ];

  for (const pattern of trendPatterns) {
    const match = normalized.match(pattern);
    if (match) {
      const target = match[1].trim();
      const period = match[2] ? `${match[2]} mesi` : '6 mesi';
      return {
        type: 'ANALYTICS_TREND',
        entities: [target],
        filterPatch: {},
        trendTarget: target,
        trendPeriod: period
      };
    }
  }

  // Count queries
  const countPatterns = [
    /^quanti?\s+(?:elementi?|novit[àa])\s+(?:ci\s+sono\s+)?(?:per|in|da)?\s*(.+)?$/i,
    /^(?:numero|totale)\s+(?:di\s+)?(?:elementi?|novit[àa])?\s*(?:per|in|da)?\s*(.+)?$/i
  ];

  for (const pattern of countPatterns) {
    const match = normalized.match(pattern);
    if (match) {
      const target = match[1]?.trim() || '';
      return {
        type: 'ANALYTICS_COUNT',
        entities: target ? [target] : [],
        filterPatch: {},
        analyticsTarget: target || 'all'
      };
    }
  }

  // Top queries
  const topPatterns = [
    /^(?:qual[ie]\s+[èe]\s+il\s+)?(?:prodotto|fonte)\s+(?:con\s+)?pi[ùu]\s+(?:novit[àa]|elementi?)/i,
    /^top\s+(?:prodott[oi]|font[ei])/i,
    /^(?:prodott[oi]|font[ei])\s+(?:pi[ùu]\s+)?(?:popolari?|attiv[oi])/i
  ];

  for (const pattern of topPatterns) {
    if (pattern.test(normalized)) {
      const isSource = /fonte/i.test(normalized);
      return {
        type: 'ANALYTICS_TOP',
        entities: [],
        filterPatch: {},
        analyticsTarget: isSource ? 'source' : 'product'
      };
    }
  }

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
    lastIntent = null;
    return {
      type: 'RESET_FILTERS',
      entities: [],
      filterPatch: {}
    };
  }

  // Check for context reference first
  const contextRef = extractContextReference(normalized);
  if (contextRef.isContextRef && lastIntent) {
    // Apply same filters but with new target
    const newText = contextRef.target;
    const sourceResult = fuzzyMatchSource(newText);
    const productResult = fuzzyMatchProduct(newText, metadata);

    if (sourceResult.match) {
      const newIntent: ParsedIntent = {
        ...lastIntent,
        type: 'FILTER_BY_SOURCE',
        entities: [sourceResult.match],
        filterPatch: { ...lastIntent.filterPatch, sources: [sourceResult.match] },
        correction: sourceResult.correction
      };
      lastIntent = newIntent;
      return newIntent;
    }

    if (productResult.match) {
      const newIntent: ParsedIntent = {
        ...lastIntent,
        type: 'FILTER_BY_PRODUCT',
        entities: [productResult.match],
        filterPatch: { ...lastIntent.filterPatch, products: [productResult.match] },
        correction: productResult.correction
      };
      lastIntent = newIntent;
      return newIntent;
    }
  }

  // Check for analytics queries
  const analyticsIntent = parseAnalyticsQuery(normalized, metadata);
  if (analyticsIntent) {
    lastIntent = analyticsIntent;
    return analyticsIntent;
  }

  // Pattern: explicit search
  const searchMatch = normalized.match(/^(?:cerca|trova)\s+(.+)$/i);
  if (searchMatch) {
    const searchText = searchMatch[1].trim();
    const intent: ParsedIntent = {
      type: 'SEARCH_TEXT',
      entities: [searchText],
      filterPatch: { query: searchText }
    };
    lastIntent = intent;
    return intent;
  }

  // Check for negation
  const { negated, remaining: afterNegation } = extractNegation(normalized);

  // Remove common prefixes
  let workingText = afterNegation
    .replace(/^(?:mostra(?:mi)?|dammi|trova|filtra|voglio|vorrei)\s+/i, '')
    .replace(/^(?:le\s+)?(?:ultime\s+)?novit[àa]\s*/i, '')
    .replace(/^(?:per|di|su|da)\s+/i, '')
    .trim();

  // Extract all entities
  const filterPatch: Partial<FilterState> = {};
  const entities: string[] = [];
  let correction: { original: string; corrected: string } | undefined;

  // Extract date range
  const dateRangeResult = extractDateRange(workingText);
  if (dateRangeResult.value !== null) {
    filterPatch.releaseDateFrom = dateRangeResult.value.from;
    filterPatch.releaseDateTo = dateRangeResult.value.to;
    entities.push(dateRangeResult.label);
    workingText = dateRangeResult.remaining;
  }

  // Extract wave
  const waveResult = extractWave(workingText);
  if (waveResult.value !== null) {
    filterPatch.waves = [waveResult.value];
    entities.push(waveResult.label);
    workingText = waveResult.remaining;
  }

  // Extract period
  const periodResult = extractPeriod(workingText);
  if (periodResult.value !== null) {
    filterPatch.periodNewDays = periodResult.value;
    entities.push(periodResult.label);
    workingText = periodResult.remaining;
  }

  // Extract availability
  const availabilityResult = extractAvailability(workingText);
  if (availabilityResult.value !== null) {
    filterPatch.availabilityTypes = [availabilityResult.value];
    entities.push(availabilityResult.label);
    workingText = availabilityResult.remaining;
  }

  // Extract status
  const statusResult = extractStatus(workingText);
  if (statusResult.value !== null) {
    filterPatch.statuses = [statusResult.value];
    entities.push(statusResult.label);
    workingText = statusResult.remaining;
  }

  // Extract category
  const categoryResult = extractCategory(workingText, metadata);
  if (categoryResult.value !== null) {
    filterPatch.categories = [categoryResult.value];
    entities.push(`categoria: ${categoryResult.label}`);
    workingText = categoryResult.remaining;
  }

  // Extract source
  const sourceResult = extractSource(workingText);
  if (sourceResult.value !== null) {
    filterPatch.sources = [sourceResult.value];
    entities.push(sourceResult.label);
    workingText = sourceResult.remaining;
  }

  // Extract multiple products (only if no source found)
  if (!sourceResult.value) {
    const productsResult = extractMultipleProducts(workingText, metadata);
    if (productsResult.values.length > 0) {
      filterPatch.products = productsResult.values;
      entities.push(...productsResult.labels);
      workingText = productsResult.remaining;
      if (productsResult.correction) {
        correction = productsResult.correction;
      }
    }
  }

  // Determine intent type
  const filterCount = Object.keys(filterPatch).length;

  if (filterCount === 0) {
    const cleanedText = workingText
      .replace(/^(?:per|di|su|da|e|con)\s+/gi, '')
      .trim();

    if (cleanedText.length > 2) {
      // Try with typo correction
      const sourceTypo = fuzzyMatchSource(cleanedText);
      if (sourceTypo.match) {
        const intent: ParsedIntent = {
          type: 'FILTER_BY_SOURCE',
          entities: [sourceTypo.match],
          filterPatch: { sources: [sourceTypo.match] },
          negated,
          correction: sourceTypo.correction
        };
        lastIntent = intent;
        return intent;
      }

      const productTypo = fuzzyMatchProduct(cleanedText, metadata);
      if (productTypo.match) {
        const intent: ParsedIntent = {
          type: 'FILTER_BY_PRODUCT',
          entities: [productTypo.match],
          filterPatch: { products: [productTypo.match] },
          negated,
          correction: productTypo.correction
        };
        lastIntent = intent;
        return intent;
      }

      const intent: ParsedIntent = {
        type: 'SEARCH_TEXT',
        entities: [cleanedText],
        filterPatch: { query: cleanedText }
      };
      lastIntent = intent;
      return intent;
    }

    return {
      type: 'UNKNOWN',
      entities: [],
      filterPatch: {}
    };
  }

  let intentType: IntentType;

  if (filterCount === 1) {
    if (filterPatch.products) {
      intentType = filterPatch.products.length > 1 ? 'FILTER_COMBINED' : 'FILTER_BY_PRODUCT';
    } else if (filterPatch.sources) {
      intentType = 'FILTER_BY_SOURCE';
    } else if (filterPatch.periodNewDays) {
      intentType = 'FILTER_BY_PERIOD';
    } else if (filterPatch.availabilityTypes) {
      intentType = 'FILTER_BY_AVAILABILITY';
    } else if (filterPatch.statuses) {
      intentType = 'FILTER_BY_STATUS';
    } else if (filterPatch.categories) {
      intentType = 'FILTER_BY_CATEGORY';
    } else if (filterPatch.waves) {
      intentType = 'FILTER_BY_WAVE';
    } else if (filterPatch.releaseDateFrom || filterPatch.releaseDateTo) {
      intentType = 'FILTER_BY_DATE_RANGE';
    } else {
      intentType = 'FILTER_COMBINED';
    }
  } else {
    intentType = 'FILTER_COMBINED';
  }

  const intent: ParsedIntent = {
    type: intentType,
    entities,
    filterPatch,
    negated,
    correction
  };

  lastIntent = intent;
  return intent;
};

/**
 * Get autocomplete suggestions based on partial input
 */
export const getAutocompleteSuggestions = (
  partial: string,
  metadata: FilterMetadata,
  maxResults = 5
): string[] => {
  if (!partial || partial.length < 2) return [];

  const normalized = partial.toLowerCase().trim();
  const suggestions: Array<{ text: string; score: number }> = [];

  // Match sources
  for (const source of ALL_RELEASE_SOURCES) {
    if (source.toLowerCase().startsWith(normalized)) {
      suggestions.push({ text: source, score: 100 });
    } else if (source.toLowerCase().includes(normalized)) {
      suggestions.push({ text: source, score: 50 });
    }
  }

  // Match source aliases
  for (const [alias, source] of Object.entries(SOURCE_ALIASES)) {
    if (alias.startsWith(normalized)) {
      suggestions.push({ text: source, score: 90 });
    }
  }

  // Match products
  for (const product of metadata.products) {
    if (product.value.toLowerCase().startsWith(normalized)) {
      suggestions.push({ text: product.value, score: 100 });
    } else if (product.value.toLowerCase().includes(normalized)) {
      suggestions.push({ text: product.value, score: 50 });
    }
  }

  // Match product aliases
  for (const [alias, product] of Object.entries(PRODUCT_ALIASES)) {
    if (alias.startsWith(normalized)) {
      const found = metadata.products.find(p => p.value.toLowerCase() === product.toLowerCase());
      if (found) {
        suggestions.push({ text: found.value, score: 90 });
      }
    }
  }

  // Dedupe and sort
  const seen = new Set<string>();
  return suggestions
    .filter(s => {
      if (seen.has(s.text.toLowerCase())) return false;
      seen.add(s.text.toLowerCase());
      return true;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map(s => s.text);
};
