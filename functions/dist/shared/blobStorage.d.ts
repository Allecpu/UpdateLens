import type { LatestManifest } from './types.js';
/**
 * Upload a snapshot file to blob storage
 */
export declare const uploadSnapshot: (source: string, filename: string, data: object) => Promise<string>;
/**
 * Read the current manifest from blob storage
 */
export declare const getManifest: () => Promise<LatestManifest>;
/**
 * Update the manifest file in blob storage (merge-safe)
 */
export declare const updateManifest: (updates: Partial<LatestManifest>) => Promise<LatestManifest>;
/**
 * Ensure the container exists (call during function app startup).
 * Note: With Managed Identity, you need "Storage Blob Data Contributor" role.
 */
export declare const ensureContainer: () => Promise<void>;
