import type { FilterState } from '../models/Filters';
import type { ReleaseItem } from '../models/ReleaseItem';

export type ChatBackendRequest = {
  message: string;
  searchScope: 'current' | 'all';
  baseFilters?: Partial<FilterState>;
  chatContext?: Record<string, unknown>;
  preferAzure?: boolean;
  topK?: number;
};

export type ChatBackendResponse = {
  message: string;
  items: ReleaseItem[];
  showPreview: boolean;
  canApplyFilters: boolean;
  filterPatch: Partial<FilterState>;
  engine: 'local' | 'azure';
  fallbackUsed: boolean;
  traceId: string;
};

export const queryChatBackend = async (
  payload: ChatBackendRequest
): Promise<ChatBackendResponse> => {
  const response = await fetch('/api/chat/query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    const message =
      errorPayload?.error ?? `Errore backend chat (${response.status})`;
    throw new Error(message);
  }

  return (await response.json()) as ChatBackendResponse;
};
