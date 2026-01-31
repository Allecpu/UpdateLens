// Shared utility functions for refresh modules
/**
 * Generate today's date stamp in YYYY_MM_DD format
 */
export const todayStamp = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}_${month}_${day}`;
};
/**
 * Generate current month stamp in YYYY-MM format
 */
export const monthStamp = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
};
/**
 * Generate a URL-safe slug from a string
 */
export const slugify = (value) => value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
/**
 * Normalize whitespace in text (collapse multiple spaces, trim)
 */
export const normalizeText = (value) => value.replace(/\s+/g, ' ').trim();
/**
 * Strip HTML tags and return normalized text
 */
export const stripHtml = (value) => {
    // Simple HTML stripping without cheerio for performance
    const text = value.replace(/<[^>]*>/g, '');
    return normalizeText(text);
};
/**
 * Parse a date string to YYYY-MM format
 */
export const parseDate = (value) => {
    const cleaned = normalizeText(value);
    if (!cleaned) {
        return null;
    }
    // Match DD/MM/YYYY or DD.MM.YYYY or DD-MM-YYYY
    const fullMatch = cleaned.match(/(\d{1,2})[./-](\d{1,2})[./-](20\d{2})/);
    if (fullMatch) {
        const first = Number(fullMatch[1]);
        const second = Number(fullMatch[2]);
        const year = fullMatch[3];
        let month;
        // Determine month vs day based on values
        if (first > 12 && second <= 12) {
            month = second;
        }
        else if (second > 12 && first <= 12) {
            month = first;
        }
        else {
            month = first; // Assume European format (DD/MM)
        }
        const monthText = String(month).padStart(2, '0');
        return `${year}-${monthText}`;
    }
    // Match YYYY-MM or YYYY/MM
    const yearMatch = cleaned.match(/(20\d{2})[-/](\d{1,2})/);
    if (yearMatch) {
        const year = yearMatch[1];
        const month = String(Number(yearMatch[2])).padStart(2, '0');
        return `${year}-${month}`;
    }
    return null;
};
/**
 * Parse a date string to YYYY-MM-DD format
 */
export const parseDateFull = (value) => {
    const cleaned = normalizeText(value);
    if (!cleaned) {
        return null;
    }
    // Match DD/MM/YYYY or DD.MM.YYYY or DD-MM-YYYY
    const fullMatch = cleaned.match(/(\d{1,2})[./-](\d{1,2})[./-](20\d{2})/);
    if (fullMatch) {
        const first = Number(fullMatch[1]);
        const second = Number(fullMatch[2]);
        const year = fullMatch[3];
        let month;
        let day;
        // Determine month vs day based on values
        if (first > 12 && second <= 12) {
            day = first;
            month = second;
        }
        else if (second > 12 && first <= 12) {
            day = second;
            month = first;
        }
        else {
            month = first;
            day = second; // Assume European format (DD/MM)
        }
        const monthText = String(month).padStart(2, '0');
        const dayText = String(day).padStart(2, '0');
        return `${year}-${monthText}-${dayText}`;
    }
    // Match ISO format YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
        return cleaned;
    }
    return null;
};
/**
 * Check if a string is a valid GUID
 */
export const isValidGuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
/**
 * Check if a string is a valid HTTP(S) URL
 */
export const isValidHttpUrl = (urlString) => {
    try {
        const url = new URL(urlString);
        return url.protocol === 'http:' || url.protocol === 'https:';
    }
    catch {
        return false;
    }
};
// ============================================================================
// Release Plans URL Building
// ============================================================================
const RELEASEPLANS_BASE_URL = 'https://releaseplans.microsoft.com/';
const APP_MAPPINGS = [
    { match: /business central/i, app: 'Business Central' },
    { match: /dynamics 365 sales/i, app: 'Sales' },
    { match: /customer insights\s*-\s*journeys/i, app: 'Customer Insights - Journeys' },
    { match: /customer insights\s*-\s*data/i, app: 'Customer Insights - Data' },
    { match: /field service/i, app: 'Field Service' },
    { match: /customer service/i, app: 'Customer Service' },
    { match: /finance/i, app: 'Finance' },
    { match: /supply chain/i, app: 'Supply Chain Management' },
    { match: /commerce/i, app: 'Commerce' },
    { match: /human resources/i, app: 'Human Resources' },
    { match: /project operations/i, app: 'Project Operations' },
    { match: /power platform/i, app: 'Power Platform' },
    { match: /power apps/i, app: 'Power Apps' },
    { match: /power automate/i, app: 'Power Automate' },
    { match: /power bi/i, app: 'Power BI' },
    { match: /copilot studio/i, app: 'Copilot Studio' },
    { match: /intelligent order management/i, app: 'Intelligent Order Management' },
    { match: /sustainability manager/i, app: 'Microsoft Sustainability Manager' }
];
const normalizeProductApp = (product) => product
    .replace(/^Microsoft\s+/i, '')
    .replace(/^Dynamics\s*365\s*/i, '')
    .trim();
export const resolveAppNameFromProduct = (product) => {
    const mapping = APP_MAPPINGS.find((entry) => entry.match.test(product));
    const appName = mapping ? mapping.app : normalizeProductApp(product);
    return appName || null;
};
export const encodeApp = (appName) => {
    const params = new URLSearchParams({ app: appName });
    return params.toString().replace(/^app=/, '');
};
export const buildReleasePlansUrl = (appName, planId) => {
    const appParam = encodeApp(appName);
    return `${RELEASEPLANS_BASE_URL}?app=${appParam}&planID=${planId}`;
};
// ============================================================================
// Geography Extraction (simplified version without cheerio dependency)
// ============================================================================
const SEPARATOR_REGEX = /[,\n;/|•·]+/;
const LEADING_TRAILING_PUNCT = /^[\s\-–—•·,;:()]+|[\s\-–—•·,;:()]+$/g;
const normalizeKey = (value) => {
    const cleaned = value
        .toLowerCase()
        .replace(/['']/g, ' ')
        .replace(/[^a-z0-9 ]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return cleaned.replace(/\b([a-z])\s+([a-z])\b/g, '$1$2');
};
const stripEdgePunctuation = (value) => value.replace(LEADING_TRAILING_PUNCT, '').trim();
const REGION_EXCLUSIONS = new Set([
    'apac', 'emea', 'latam', 'worldwide', 'global',
    'europa', 'europe', 'asia', 'asia pacifico', 'pacifico',
    'america del sud', 'america del nord', 'north america',
    'south america', 'middle east', 'medio oriente'
].map((value) => normalizeKey(value)));
const BLOCKLIST_TERMS = [
    'microsoft', 'azure', 'report', 'visita', 'visitare',
    'esplora', 'funzionalita', 'pianificata', 'disponibile',
    'aree geografiche', 'area geografica'
];
const COUNTRY_SYNONYMS = {
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
const isBlockedKey = (key) => {
    if (!key)
        return true;
    if (REGION_EXCLUSIONS.has(key))
        return true;
    return BLOCKLIST_TERMS.some((term) => key.includes(term));
};
const normalizeCountry = (value) => {
    const cleaned = normalizeText(value);
    const stripped = stripEdgePunctuation(cleaned);
    if (!stripped)
        return '';
    const key = normalizeKey(stripped);
    if (isBlockedKey(key))
        return '';
    const synonym = COUNTRY_SYNONYMS[key];
    if (synonym)
        return synonym;
    return stripped;
};
const dedupeCaseInsensitive = (values) => {
    const map = new Map();
    values.forEach((value) => {
        const key = value.toLowerCase();
        if (!map.has(key)) {
            map.set(key, value);
        }
    });
    return Array.from(map.values());
};
export const extractCountriesFromText = (text) => {
    const cleaned = normalizeText(text);
    if (!cleaned)
        return [];
    const hasSeparators = SEPARATOR_REGEX.test(cleaned);
    const listReady = !hasSeparators
        ? cleaned.replace(/\s+(and|e)\s+/gi, ',')
        : cleaned;
    const parts = listReady.split(SEPARATOR_REGEX);
    const results = [];
    parts.forEach((part) => {
        let segment = normalizeText(part);
        if (!segment)
            return;
        if (segment.includes(':')) {
            segment = segment.split(':').pop() ?? '';
            segment = normalizeText(segment);
        }
        segment = stripEdgePunctuation(segment);
        if (!segment)
            return;
        const wordCount = segment.split(' ').length;
        if (wordCount > 6)
            return;
        const normalized = normalizeCountry(segment);
        if (!normalized)
            return;
        results.push(normalized);
    });
    return dedupeCaseInsensitive(results);
};
