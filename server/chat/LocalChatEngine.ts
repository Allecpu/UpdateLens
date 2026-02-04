import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ChatQueryRequest, ChatQueryResponse } from './ChatSchemas.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

type SnapshotItem = {
  id?: string;
  source?: string;
  product?: string;
  productName?: string;
  title?: string;
  summary?: string;
  description?: string;
  status?: string;
};

const SOURCE_MAP: Array<{ pattern: RegExp; value: 'Microsoft' | 'EOS' | 'Fabric' | 'MICROSOFT 365' }> = [
  { pattern: /\bmicrosoft 365\b|\bm365\b|\boffice 365\b/i, value: 'MICROSOFT 365' },
  { pattern: /\bfabric\b/i, value: 'Fabric' },
  { pattern: /\beos\b/i, value: 'EOS' },
  { pattern: /\bmicrosoft\b|\brelease plans?\b|\bms\b/i, value: 'Microsoft' }
];

const loadLatestItems = async (): Promise<SnapshotItem[]> => {
  const latestPath = path.resolve(repoRoot, 'public', 'data', 'latest.json');
  const latestRaw = await readFile(latestPath, 'utf-8');
  const latest = JSON.parse(latestRaw) as Record<string, string>;

  const files = [latest.microsoft, latest.eos, latest.fabric, latest.m365roadmap].filter(
    (value): value is string => Boolean(value)
  );

  const groups = await Promise.all(
    files.map(async (filename) => {
      const fullPath = path.resolve(repoRoot, 'public', 'data', filename);
      const raw = await readFile(fullPath, 'utf-8');
      const parsed = JSON.parse(raw) as { items?: SnapshotItem[] };
      return parsed.items ?? [];
    })
  );

  return groups.flat();
};

const detectSource = (text: string): Array<'Microsoft' | 'EOS' | 'Fabric' | 'MICROSOFT 365'> => {
  const matches: Array<'Microsoft' | 'EOS' | 'Fabric' | 'MICROSOFT 365'> = [];
  for (const entry of SOURCE_MAP) {
    if (entry.pattern.test(text)) {
      matches.push(entry.value);
    }
  }
  return Array.from(new Set(matches));
};

const toPreviewItem = (item: SnapshotItem) => {
  return {
    id: item.id ?? crypto.randomUUID(),
    productName: item.productName ?? item.product ?? 'N/D',
    status: item.status ?? 'Unknown',
    title: item.title ?? 'N/D',
    description: item.description ?? item.summary ?? ''
  };
};

export const runLocalChatEngine = async (
  req: ChatQueryRequest
): Promise<ChatQueryResponse> => {
  const traceId = crypto.randomUUID();
  const text = req.message.trim();
  const normalized = text.toLowerCase();

  if (/^(mostra tutto|reset|resetta|azzera|pulisci filtri?)$/i.test(normalized)) {
    return {
      message: 'Filtri azzerati. Mostro tutti gli elementi disponibili.',
      items: [],
      showPreview: false,
      canApplyFilters: true,
      filterPatch: {},
      engine: 'local',
      fallbackUsed: false,
      traceId
    };
  }

  const filterPatch: ChatQueryResponse['filterPatch'] = {};

  const detectedSources = detectSource(text);
  if (detectedSources.length > 0) {
    filterPatch.sources = detectedSources;
  }

  const periodMatch = normalized.match(/ultimi?\s+(\d+)\s+giorni?/i);
  if (periodMatch) {
    filterPatch.periodNewDays = Number(periodMatch[1]);
  }

  if (/\bga\b|\bgeneral availability\b|\bdisponibilit[aà]\s+generale\b/i.test(normalized)) {
    filterPatch.availabilityTypes = ['General Availability'];
  } else if (/\bpreview\b|\banteprima\b/i.test(normalized)) {
    filterPatch.availabilityTypes = ['Public Preview'];
  }

  if (Object.keys(filterPatch).length === 0 && text.length >= 3) {
    filterPatch.query = text;
  }

  const allItems = await loadLatestItems();
  const quickQuery = filterPatch.query?.toLowerCase();
  const sourceFilter = filterPatch.sources;
  const filtered = allItems.filter((item) => {
    if (sourceFilter?.length && (!item.source || !sourceFilter.includes(item.source as never))) {
      return false;
    }
    if (quickQuery) {
      const haystack = [
        item.title,
        item.summary,
        item.description,
        item.product,
        item.productName,
        item.source
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(quickQuery);
    }
    return true;
  });

  const preview = filtered.slice(0, req.topK).map(toPreviewItem);

  return {
    message: `Trovati ${filtered.length} elementi per "${text}".`,
    items: preview,
    showPreview: preview.length > 0,
    canApplyFilters: Object.keys(filterPatch).length > 0,
    filterPatch,
    engine: 'local',
    fallbackUsed: false,
    traceId
  };
};
