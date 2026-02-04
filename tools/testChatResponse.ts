import assert from 'node:assert/strict';
import { generateResponse, getWelcomeMessage } from '../src/services/ChatResponseService.js';
import type { ReleaseItem } from '../src/models/ReleaseItem.js';
import type { ParsedIntent } from '../src/services/ChatIntentService.js';

const makeItem = (overrides: Partial<ReleaseItem> = {}): ReleaseItem => ({
  id: 'x-1',
  productId: 'p-1',
  releasePlanId: null,
  sourcePlanId: null,
  sourceAppName: null,
  source: 'Fabric',
  product: 'Microsoft Fabric',
  productName: 'Microsoft Fabric',
  category: 'AI',
  tags: ['Copilot'],
  wave: '2026 Wave 1',
  availabilityTypes: ['General Availability'],
  enabledFor: 'All users',
  geography: 'Global',
  geographyCountries: ['Global'],
  language: 'it-IT',
  firstAvailableDate: '2026-01',
  lastUpdatedDate: '2026-01-20',
  title: 'Titolo test',
  summary: 'Summary test',
  description: 'Descrizione test',
  status: 'Launched',
  availabilityDate: '2026-01',
  availabilityDateFull: '2026-01',
  releaseDate: '2026-01-20',
  tryNow: false,
  minBcVersion: null,
  sourceUrl: 'https://example.com/source',
  learnUrl: 'https://example.com/learn',
  url: 'https://example.com/url',
  ...overrides
});

const run = () => {
  const items = [makeItem(), makeItem({ id: 'x-2', source: 'EOS', productName: 'Business Central' })];

  const resetIntent: ParsedIntent = {
    type: 'RESET_FILTERS',
    entities: [],
    filterPatch: {}
  };
  const reset = generateResponse(resetIntent, items, 20);
  assert.equal(reset.canApplyFilters, true);
  assert.equal(reset.showPreview, false);

  const sourceIntent: ParsedIntent = {
    type: 'FILTER_BY_SOURCE',
    entities: ['Fabric'],
    filterPatch: { sources: ['Fabric'] }
  };
  const bySource = generateResponse(sourceIntent, items, items.length);
  assert.equal(bySource.showPreview, true);
  assert.equal(bySource.items.length > 0, true);

  const topIntent: ParsedIntent = {
    type: 'ANALYTICS_TOP',
    entities: [],
    filterPatch: {},
    analyticsTarget: 'source'
  };
  const top = generateResponse(topIntent, items, items.length);
  assert.equal(top.showPreview, false);
  assert.equal(top.canApplyFilters, false);

  const unknownIntent: ParsedIntent = {
    type: 'UNKNOWN',
    entities: [],
    filterPatch: {}
  };
  const unknown = generateResponse(unknownIntent, [], 0);
  assert.match(unknown.message, /Non ho capito/i);

  const welcome = getWelcomeMessage();
  assert.match(welcome, /assistente UpdateLens/i);
  assert.equal(welcome.includes('Ã'), false, 'welcome message should not contain mojibake');

  console.log('[test:chat-response] OK');
};

run();
