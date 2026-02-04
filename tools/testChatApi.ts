import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { createApi } from '../server/api.js';

type ChatResponse = {
  message: string;
  items: unknown[];
  showPreview: boolean;
  canApplyFilters: boolean;
  filterPatch: Record<string, unknown>;
  engine: 'local' | 'azure';
  fallbackUsed: boolean;
  traceId: string;
};

const postChatQuery = async (
  baseUrl: string,
  message: string,
  options?: { preferAzure?: boolean }
): Promise<{ status: number; body: ChatResponse | { error: string } }> => {
  const response = await fetch(`${baseUrl}/api/chat/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message,
      searchScope: 'all',
      preferAzure: options?.preferAzure ?? false,
      topK: 5
    })
  });

  const body = (await response.json()) as ChatResponse | { error: string };
  return { status: response.status, body };
};

const run = async () => {
  const app = createApi();
  const server = app.listen(0);

  try {
    await new Promise<void>((resolve, reject) => {
      server.once('listening', () => resolve());
      server.once('error', reject);
    });

    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const reset = await postChatQuery(baseUrl, 'mostra tutto');
    assert.equal(reset.status, 200, 'reset status must be 200');
    assert.equal((reset.body as ChatResponse).canApplyFilters, true);

    const healthRes = await fetch(`${baseUrl}/api/chat/health`);
    assert.equal(healthRes.status, 200, 'chat health status must be 200');
    const healthBody = (await healthRes.json()) as { ok?: boolean };
    assert.equal(healthBody.ok, true);

    const fabric = await postChatQuery(baseUrl, 'Fabric ultimi 30 giorni in GA');
    assert.equal(fabric.status, 200, 'fabric status must be 200');
    assert.equal((fabric.body as ChatResponse).engine, 'local');
    assert.equal(
      typeof (fabric.body as ChatResponse).traceId,
      'string',
      'traceId must be string'
    );
    assert.equal(
      Array.isArray((fabric.body as ChatResponse).items),
      true,
      'items must be an array'
    );
    assert.equal((fabric.body as ChatResponse).fallbackUsed, false);

    const azurePreferred = await postChatQuery(baseUrl, 'novita fabric', {
      preferAzure: true
    });
    assert.equal(azurePreferred.status, 200, 'azure preferred status must be 200');
    assert.equal(
      (azurePreferred.body as ChatResponse).fallbackUsed,
      true,
      'azure should fallback to local when not configured'
    );
    assert.equal((azurePreferred.body as ChatResponse).engine, 'local');

    const invalid = await fetch(`${baseUrl}/api/chat/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: '',
        searchScope: 'all'
      })
    });
    assert.equal(invalid.status, 400, 'invalid payload must return 400');

    console.log('[test:chat-api] OK');
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
};

run().catch((error) => {
  console.error('[test:chat-api] FAILED');
  console.error(error);
  process.exit(1);
});
