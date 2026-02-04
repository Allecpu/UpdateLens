import assert from 'node:assert/strict';
import {
  clearLastIntent,
  parseIntent,
  type ParsedIntent
} from '../src/services/ChatIntentService.js';
import type { FilterMetadata } from '../src/services/FilterMetadata.js';

const metadata: FilterMetadata = {
  sources: [
    { value: 'Microsoft', count: 1, sources: ['Microsoft'] },
    { value: 'EOS', count: 1, sources: ['EOS'] },
    { value: 'Fabric', count: 1, sources: ['Fabric'] }
  ],
  products: [
    { value: 'Business Central', count: 1, sources: ['Microsoft'] },
    { value: 'Microsoft Teams', count: 1, sources: ['MICROSOFT 365'] },
    { value: 'Copilot', count: 1, sources: ['MICROSOFT 365'] }
  ],
  statuses: [{ value: 'Launched', count: 1, sources: ['Microsoft'] }],
  categories: [{ value: 'AI', count: 1, sources: ['Microsoft'] }],
  tags: [{ value: 'Copilot', count: 1, sources: ['MICROSOFT 365'] }],
  waves: [{ value: '2025 Wave 1', count: 1, sources: ['EOS'] }],
  months: [{ value: '2026-01', count: 1, sources: ['Microsoft'] }],
  availabilityTypes: [
    { value: 'General Availability', count: 1, sources: ['Microsoft'] },
    { value: 'Public Preview', count: 1, sources: ['Fabric'] }
  ],
  enabledFor: [{ value: 'All users', count: 1, sources: ['Microsoft'] }],
  geography: [{ value: 'Global', count: 1, sources: ['Microsoft'] }],
  language: [{ value: 'it-IT', count: 1, sources: ['Microsoft'] }]
};

const assertIntentType = (intent: ParsedIntent, expected: ParsedIntent['type']) => {
  assert.equal(intent.type, expected, `Expected intent type ${expected}, got ${intent.type}`);
};

const run = () => {
  clearLastIntent();

  const reset = parseIntent('mostra tutto', metadata);
  assertIntentType(reset, 'RESET_FILTERS');

  const combined = parseIntent('Fabric ultimi 30 giorni in GA', metadata);
  assertIntentType(combined, 'FILTER_COMBINED');
  assert.deepEqual(combined.filterPatch.sources, ['Fabric']);
  assert.equal(combined.filterPatch.periodNewDays, 30);
  assert.deepEqual(combined.filterPatch.availabilityTypes, ['General Availability']);

  const dateRange = parseIntent('gennaio 2024', metadata);
  assert.equal(
    ['FILTER_BY_DATE_RANGE', 'FILTER_COMBINED'].includes(dateRange.type),
    true,
    `Unexpected date-range intent type: ${dateRange.type}`
  );
  assert.match(dateRange.filterPatch.releaseDateFrom ?? '', /^\d{4}-01-01$/);
  assert.match(dateRange.filterPatch.releaseDateTo ?? '', /^\d{4}-01-31$/);

  const compare = parseIntent('confronta Fabric con EOS', metadata);
  assertIntentType(compare, 'ANALYTICS_COMPARE');
  assert.deepEqual(compare.compareTargets, ['fabric', 'eos']);

  const search = parseIntent('cerca copilot', metadata);
  assertIntentType(search, 'SEARCH_TEXT');
  assert.equal(search.filterPatch.query, 'copilot');

  parseIntent('fabric', metadata);
  const contextRef = parseIntent('e per eos', metadata);
  assertIntentType(contextRef, 'FILTER_BY_SOURCE');
  assert.deepEqual(contextRef.filterPatch.sources, ['EOS']);

  console.log('[test:chat-intent] OK');
};

run();
