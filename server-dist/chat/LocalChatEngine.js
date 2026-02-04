import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const SOURCE_MAP = [
    { pattern: /\bmicrosoft 365\b|\bm365\b|\boffice 365\b/i, value: 'MICROSOFT 365' },
    { pattern: /\bfabric\b/i, value: 'Fabric' },
    { pattern: /\beos\b/i, value: 'EOS' },
    { pattern: /\bmicrosoft\b|\brelease plans?\b|\bms\b/i, value: 'Microsoft' }
];
const STOP_WORDS = new Set([
    'the', 'a', 'an', 'of', 'for', 'to', 'in', 'on', 'with', 'and',
    'il', 'lo', 'la', 'i', 'gli', 'le', 'di', 'del', 'della', 'delle', 'dei',
    'su', 'con', 'per', 'e', 'da', 'al', 'ai', 'alle', 'agli',
    'release', 'notes', 'novita', 'novità',
    'che', 'ci', 'sono', 'cosa', 'quale', 'quali', 'mi', 'puoi', 'puo', 'può'
]);
const normalizeText = (value) => {
    return value
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/\bd365\b/g, 'dynamics 365')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
};
const tokenizeQuery = (value) => {
    const normalized = normalizeText(value);
    if (!normalized) {
        return [];
    }
    return Array.from(new Set(normalized
        .split(' ')
        .map((token) => token.trim())
        .filter((token) => token.length >= 2 && !STOP_WORDS.has(token))));
};
const tokenizeHaystack = (value) => {
    const normalized = normalizeText(value);
    if (!normalized) {
        return new Set();
    }
    return new Set(normalized.split(' ').filter(Boolean));
};
const loadLatestItems = async () => {
    const latestPath = path.resolve(repoRoot, 'public', 'data', 'latest.json');
    const latestRaw = await readFile(latestPath, 'utf-8');
    const latest = JSON.parse(latestRaw);
    const files = [latest.microsoft, latest.eos, latest.fabric, latest.m365roadmap].filter((value) => Boolean(value));
    const groups = await Promise.all(files.map(async (filename) => {
        const fullPath = path.resolve(repoRoot, 'public', 'data', filename);
        const raw = await readFile(fullPath, 'utf-8');
        const parsed = JSON.parse(raw);
        return parsed.items ?? [];
    }));
    return groups.flat();
};
const detectSource = (text) => {
    const matches = [];
    for (const entry of SOURCE_MAP) {
        if (entry.pattern.test(text)) {
            matches.push(entry.value);
        }
    }
    return Array.from(new Set(matches));
};
const toPreviewItem = (item) => {
    return {
        id: item.id ?? crypto.randomUUID(),
        productName: item.productName ?? item.product ?? 'N/D',
        status: item.status ?? 'Unknown',
        title: item.title ?? 'N/D',
        description: item.description ?? item.summary ?? ''
    };
};
export const runLocalChatEngine = async (req) => {
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
    const filterPatch = {};
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
    }
    else if (/\bpreview\b|\banteprima\b/i.test(normalized)) {
        filterPatch.availabilityTypes = ['Public Preview'];
    }
    if (Object.keys(filterPatch).length === 0 && text.length >= 3) {
        filterPatch.query = text;
    }
    const allItems = await loadLatestItems();
    const quickQuery = filterPatch.query ? normalizeText(filterPatch.query) : '';
    const queryTokens = tokenizeQuery(filterPatch.query ?? '');
    const sourceFilter = filterPatch.sources;
    const chatContext = (req.chatContext ?? {});
    const showBookmarksOnly = chatContext.showBookmarksOnly === true;
    const bookmarkedIdsSet = new Set(Array.isArray(chatContext.bookmarkedIds)
        ? chatContext.bookmarkedIds
            .filter((value) => typeof value === 'string' && value.length > 0)
        : []);
    const filtered = allItems.filter((item) => {
        if (showBookmarksOnly && (!item.id || !bookmarkedIdsSet.has(item.id))) {
            return false;
        }
        if (sourceFilter?.length && (!item.source || !sourceFilter.includes(item.source))) {
            return false;
        }
        if (quickQuery || queryTokens.length > 0) {
            const haystackRaw = [
                item.title,
                item.summary,
                item.description,
                item.product,
                item.productName,
                item.source
            ]
                .filter(Boolean)
                .join(' ');
            const haystack = normalizeText(haystackRaw);
            const haystackTokens = tokenizeHaystack(haystackRaw);
            if (quickQuery && haystack.includes(quickQuery)) {
                return true;
            }
            if (queryTokens.length > 0) {
                return queryTokens.every((token) => haystackTokens.has(token));
            }
            return false;
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
