/**
 * Generate today's date stamp in YYYY_MM_DD format
 */
export declare const todayStamp: () => string;
/**
 * Generate current month stamp in YYYY-MM format
 */
export declare const monthStamp: () => string;
/**
 * Generate a URL-safe slug from a string
 */
export declare const slugify: (value: string) => string;
/**
 * Normalize whitespace in text (collapse multiple spaces, trim)
 */
export declare const normalizeText: (value: string) => string;
/**
 * Strip HTML tags and return normalized text
 */
export declare const stripHtml: (value: string) => string;
/**
 * Parse a date string to YYYY-MM format
 */
export declare const parseDate: (value: string) => string | null;
/**
 * Parse a date string to YYYY-MM-DD format
 */
export declare const parseDateFull: (value: string) => string | null;
/**
 * Check if a string is a valid GUID
 */
export declare const isValidGuid: (value: string) => boolean;
/**
 * Check if a string is a valid HTTP(S) URL
 */
export declare const isValidHttpUrl: (urlString: string) => boolean;
export declare const resolveAppNameFromProduct: (product: string) => string | null;
export declare const encodeApp: (appName: string) => string;
export declare const buildReleasePlansUrl: (appName: string, planId: string) => string;
export declare const extractCountriesFromText: (text: string) => string[];
