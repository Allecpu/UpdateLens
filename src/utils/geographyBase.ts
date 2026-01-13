const SEPARATOR_REGEX = /[,\n;/|•·]+/;
const LEADING_TRAILING_PUNCT = /^[\s\-–—•·,;:()]+|[\s\-–—•·,;:()]+$/g;

const normalizeWhitespace = (value: string): string =>
  value.replace(/\s+/g, ' ').trim();

const normalizeKey = (value: string): string => {
  const cleaned = value
    .toLowerCase()
    .replace(/['’]/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.replace(/\b([a-z])\s+([a-z])\b/g, '$1$2');
};

const stripEdgePunctuation = (value: string): string =>
  value.replace(LEADING_TRAILING_PUNCT, '').trim();

const REGION_EXCLUSIONS = new Set(
  [
    'apac',
    'emea',
    'latam',
    'worldwide',
    'global',
    'europa',
    'europe',
    'asia',
    'asia pacifico',
    'pacifico',
    'america del sud',
    'america del nord',
    'north america',
    'south america',
    'middle east',
    'medio oriente'
  ].map((value) => normalizeKey(value))
);

const BLOCKLIST_TERMS = [
  'microsoft',
  'azure',
  'report',
  'visita',
  'visitare',
  'esplora',
  'funzionalita',
  'pianificata',
  'disponibile',
  'aree geografiche',
  'area geografica'
];

const COUNTRY_SYNONYMS: Record<string, string> = {
  usa: 'Stati Uniti',
  'u s': 'Stati Uniti',
  'u s a': 'Stati Uniti',
  us: 'Stati Uniti',
  'united states': 'Stati Uniti',
  'united states of america': 'Stati Uniti',
  'stati uniti': 'Stati Uniti',
  'stati uniti d america': 'Stati Uniti',
  uk: 'Regno Unito',
  'u k': 'Regno Unito',
  'united kingdom': 'Regno Unito',
  'great britain': 'Regno Unito',
  britain: 'Regno Unito',
  uae: 'Emirati Arabi Uniti',
  'u a e': 'Emirati Arabi Uniti',
  'united arab emirates': 'Emirati Arabi Uniti',
  'emirati arabi uniti': 'Emirati Arabi Uniti',
  'south korea': 'Corea del Sud',
  'korea south': 'Corea del Sud',
  'republic of korea': 'Corea del Sud',
  'corea del sud': 'Corea del Sud',
  'north korea': 'Corea del Nord',
  'korea north': 'Corea del Nord',
  dprk: 'Corea del Nord',
  'corea del nord': 'Corea del Nord',
  czechia: 'Repubblica Ceca',
  'czech republic': 'Repubblica Ceca',
  'repubblica ceca': 'Repubblica Ceca',
  'viet nam': 'Vietnam',
  vietnam: 'Vietnam'
};

const isBlockedKey = (key: string): boolean => {
  if (!key) {
    return true;
  }
  if (REGION_EXCLUSIONS.has(key)) {
    return true;
  }
  return BLOCKLIST_TERMS.some((term) => key.includes(term));
};

export const normalizeCountry = (value: string): string => {
  const cleaned = normalizeWhitespace(value);
  const stripped = stripEdgePunctuation(cleaned);
  if (!stripped) {
    return '';
  }
  const key = normalizeKey(stripped);
  if (isBlockedKey(key)) {
    return '';
  }
  const synonym = COUNTRY_SYNONYMS[key];
  if (synonym) {
    return synonym;
  }
  return stripped;
};

export const dedupeCaseInsensitive = (values: string[]): string[] => {
  const map = new Map<string, string>();
  values.forEach((value) => {
    const key = value.toLowerCase();
    if (!map.has(key)) {
      map.set(key, value);
    }
  });
  return Array.from(map.values());
};

export const extractCountriesFromText = (text: string): string[] => {
  const cleaned = normalizeWhitespace(text);
  if (!cleaned) {
    return [];
  }

  const hasSeparators = SEPARATOR_REGEX.test(cleaned);
  const listReady = !hasSeparators
    ? cleaned.replace(/\s+(and|e)\s+/gi, ',')
    : cleaned;

  const parts = listReady.split(SEPARATOR_REGEX);
  const results: string[] = [];

  parts.forEach((part) => {
    let segment = normalizeWhitespace(part);
    if (!segment) {
      return;
    }
    if (segment.includes(':')) {
      segment = segment.split(':').pop() ?? '';
      segment = normalizeWhitespace(segment);
    }
    segment = stripEdgePunctuation(segment);
    if (!segment) {
      return;
    }
    const wordCount = segment.split(' ').length;
    if (wordCount > 6) {
      return;
    }
    const normalized = normalizeCountry(segment);
    if (!normalized) {
      return;
    }
    results.push(normalized);
  });

  return dedupeCaseInsensitive(results);
};
