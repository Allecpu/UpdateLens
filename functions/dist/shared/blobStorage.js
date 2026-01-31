import { BlobServiceClient } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';
const CONTAINER_NAME = 'data';
const MANIFEST_FILENAME = 'latest.json';
let containerClient = null;
/**
 * Get or create a container client for blob operations.
 * Uses Managed Identity (DefaultAzureCredential) when running in Azure,
 * or falls back to connection string for local development.
 */
const getContainerClient = () => {
    if (containerClient) {
        return containerClient;
    }
    const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    let blobServiceClient;
    if (accountName) {
        // Use Managed Identity (preferred in Azure)
        const credential = new DefaultAzureCredential();
        const accountUrl = `https://${accountName}.blob.core.windows.net`;
        blobServiceClient = new BlobServiceClient(accountUrl, credential);
        console.log(`[BlobStorage] Using Managed Identity for account: ${accountName}`);
    }
    else if (connectionString) {
        // Fallback to connection string (local development)
        blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        console.log('[BlobStorage] Using connection string (local development)');
    }
    else {
        throw new Error('Either AZURE_STORAGE_ACCOUNT_NAME (for Managed Identity) or ' +
            'AZURE_STORAGE_CONNECTION_STRING (for local dev) must be set');
    }
    containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);
    return containerClient;
};
/**
 * Upload a snapshot file to blob storage
 */
export const uploadSnapshot = async (source, filename, data) => {
    const client = getContainerClient();
    const blockBlobClient = client.getBlockBlobClient(filename);
    const content = JSON.stringify(data, null, 2);
    const contentBuffer = Buffer.from(content, 'utf-8');
    await blockBlobClient.upload(contentBuffer, contentBuffer.length, {
        blobHTTPHeaders: {
            blobContentType: 'application/json',
            blobCacheControl: 'public, max-age=3600'
        }
    });
    console.log(`[BlobStorage] Uploaded ${filename} (${contentBuffer.length} bytes)`);
    return blockBlobClient.url;
};
/**
 * Read the current manifest from blob storage
 */
export const getManifest = async () => {
    const client = getContainerClient();
    const blockBlobClient = client.getBlockBlobClient(MANIFEST_FILENAME);
    try {
        const downloadResponse = await blockBlobClient.download(0);
        const downloaded = await streamToString(downloadResponse.readableStreamBody);
        return JSON.parse(downloaded);
    }
    catch (error) {
        // If blob doesn't exist, return empty manifest
        if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 404) {
            console.log('[BlobStorage] Manifest not found, returning empty manifest');
            return {};
        }
        throw error;
    }
};
/**
 * Update the manifest file in blob storage (merge-safe)
 */
export const updateManifest = async (updates) => {
    const client = getContainerClient();
    const blockBlobClient = client.getBlockBlobClient(MANIFEST_FILENAME);
    // Read current manifest
    const current = await getManifest();
    // Merge updates
    const next = { ...current, ...updates };
    // Write updated manifest
    const content = JSON.stringify(next, null, 2);
    const contentBuffer = Buffer.from(content, 'utf-8');
    await blockBlobClient.upload(contentBuffer, contentBuffer.length, {
        blobHTTPHeaders: {
            blobContentType: 'application/json',
            blobCacheControl: 'no-cache'
        }
    });
    console.log(`[BlobStorage] Updated manifest: ${JSON.stringify(updates)}`);
    return next;
};
/**
 * Helper to convert readable stream to string
 */
const streamToString = async (readableStream) => {
    if (!readableStream) {
        throw new Error('No readable stream available');
    }
    return new Promise((resolve, reject) => {
        const chunks = [];
        readableStream.on('data', (data) => {
            chunks.push(Buffer.isBuffer(data) ? data : Buffer.from(data));
        });
        readableStream.on('end', () => {
            resolve(Buffer.concat(chunks).toString('utf-8'));
        });
        readableStream.on('error', reject);
    });
};
/**
 * Ensure the container exists (call during function app startup).
 * Note: With Managed Identity, you need "Storage Blob Data Contributor" role.
 */
export const ensureContainer = async () => {
    const client = getContainerClient();
    // Check if container exists (don't try to create - might not have permission)
    const exists = await client.exists();
    if (!exists) {
        throw new Error(`Container '${CONTAINER_NAME}' does not exist. Please create it manually.`);
    }
    console.log(`[BlobStorage] Container '${CONTAINER_NAME}' is ready`);
};
