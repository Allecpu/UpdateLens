import type { CssActivity, CssDocument, CssMeta, CssProposal } from '../models/Css';

type ActivityFilters = {
  customer?: string;
  owner?: string;
  status?: string;
  query?: string;
};

type CreateActivityRequest = {
  customerName: string;
  cssOwner?: string | null;
  lastUpdate?: string | null;
  blBu?: string | null;
  issue: string;
  listStatus?: string | null;
  issueStatus: string;
  details?: string | null;
  eosOwners?: string | null;
  customerOwners?: string | null;
  cssAction?: string | null;
  notes?: string | null;
  customerPriority?: string | null;
  cssPriority?: string | null;
  dueDate?: string | null;
  rating?: number | null;
  itemType?: string | null;
  sourceRef?: string | null;
};

type ValidateBatchRequest = {
  approveAll?: boolean;
  decisions?: Array<{
    proposalId: string;
    decision: 'approved' | 'rejected';
    note?: string | null;
    payloadOverride?: Record<string, unknown>;
  }>;
};

const parseError = async (response: Response): Promise<never> => {
  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await response.json().catch(() => null) : null;
  const message =
    payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
      ? payload.error
      : `HTTP ${response.status}`;
  throw new Error(message);
};

const request = async <T>(path: string, options?: RequestInit): Promise<T> => {
  const headers = new Headers(options?.headers);
  headers.set('Accept', 'application/json');
  headers.set('X-Requested-With', 'XMLHttpRequest');
  const hasBody = options?.body !== undefined && options?.body !== null;
  if (hasBody && !headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(path, {
    ...options,
    headers,
    credentials: 'same-origin'
  });
  if (!response.ok) {
    return parseError(response);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
};

export const cssService = {
  async getMeta(): Promise<CssMeta> {
    return request<CssMeta>('/api/css/meta');
  },

  async listActivities(filters: ActivityFilters = {}): Promise<{ items: CssActivity[]; total: number }> {
    const params = new URLSearchParams();
    if (filters.customer) params.set('customer', filters.customer);
    if (filters.owner) params.set('owner', filters.owner);
    if (filters.status) params.set('status', filters.status);
    if (filters.query) params.set('query', filters.query);
    const qs = params.toString();
    return request<{ items: CssActivity[]; total: number }>(`/api/css/activities${qs ? `?${qs}` : ''}`);
  },

  async createActivity(payload: CreateActivityRequest): Promise<CssActivity> {
    return request<CssActivity>('/api/css/activities', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async updateActivity(activityId: string, payload: Partial<CreateActivityRequest>): Promise<CssActivity> {
    return request<CssActivity>(`/api/css/activities/${encodeURIComponent(activityId)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  },

  async bulkUpdateStatus(activityIds: string[], issueStatus: string): Promise<{ updated: number }> {
    return request<{ updated: number }>('/api/css/activities/bulk-status', {
      method: 'POST',
      body: JSON.stringify({ activityIds, issueStatus })
    });
  },

  async listDocuments(): Promise<{ items: CssDocument[] }> {
    return request<{ items: CssDocument[] }>('/api/css/documents');
  },

  async uploadDocument(file: File): Promise<CssDocument> {
    const contentBase64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Impossibile leggere il file selezionato'));
      reader.onload = () => {
        const result = reader.result;
        if (typeof result !== 'string') {
          reject(new Error('Formato file non valido'));
          return;
        }
        const comma = result.indexOf(',');
        if (comma < 0) {
          reject(new Error('Formato base64 non valido'));
          return;
        }
        resolve(result.slice(comma + 1));
      };
      reader.readAsDataURL(file);
    });

    return request<CssDocument>('/api/css/documents/upload', {
      method: 'POST',
      body: JSON.stringify({
        filename: file.name,
        mimeType: file.type || null,
        contentBase64
      })
    });
  },

  async extractDocument(documentId: string): Promise<{ batchId: string; proposals: CssProposal[]; aiProvider: string; aiModel: string | null; notes: string | null }> {
    return request<{ batchId: string; proposals: CssProposal[]; aiProvider: string; aiModel: string | null; notes: string | null }>(
      `/api/css/documents/${encodeURIComponent(documentId)}/extract`,
      { method: 'POST' }
    );
  },

  async getProposals(batchId: string): Promise<{ items: CssProposal[]; total: number }> {
    return request<{ items: CssProposal[]; total: number }>(`/api/css/proposals/${encodeURIComponent(batchId)}`);
  },

  async validateBatch(batchId: string, payload: ValidateBatchRequest): Promise<{ applied: number; rejected: number; proposals: CssProposal[] }> {
    return request<{ applied: number; rejected: number; proposals: CssProposal[] }>(
      `/api/css/proposals/${encodeURIComponent(batchId)}/validate`,
      {
        method: 'POST',
        body: JSON.stringify(payload)
      }
    );
  }
};
