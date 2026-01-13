import assert from 'node:assert/strict';

import type { ReleaseItem } from '../src/models/ReleaseItem';
import { filterReleaseItems } from '../src/services/FilterService';
import type { FilterState } from '../src/models/Filters';

const makeItem = (overrides: Partial<ReleaseItem>): ReleaseItem => ({
  id: overrides.id ?? 'id',
  productId: overrides.productId ?? 'prod',
  source: overrides.source ?? 'Microsoft',
  product: overrides.product ?? 'Product',
  productName: overrides.productName ?? 'Product',
  title: overrides.title ?? 'Title',
  summary: overrides.summary ?? 'Summary',
  description: overrides.description ?? 'Description',
  status: overrides.status ?? 'Planned',
  availabilityDate: overrides.availabilityDate ?? '2025-01',
  releaseDate: overrides.releaseDate ?? '2025-01-10',
  tryNow: overrides.tryNow ?? false,
  minBcVersion: overrides.minBcVersion ?? null,
  ...overrides
});

const baseFilters = (sources: FilterState['sources']): FilterState => ({
  targetCustomerIds: [],
  targetGroupIds: [],
  targetCssOwners: [],
  products: [],
  sources,
  statuses: [],
  categories: [],
  tags: [],
  waves: [],
  months: [],
  availabilityTypes: [],
  enabledFor: [],
  geography: [],
  language: [],
  periodNewDays: 0,
  periodChangedDays: 0,
  releaseInDays: 0,
  minBcVersionMin: null,
  releaseDateFrom: '',
  releaseDateTo: '',
  sortOrder: 'newest',
  query: '',
  horizonMonths: 120,
  historyMonths: 120
});

(() => {
  const msItem = makeItem({
    id: 'ms-1',
    source: 'Microsoft',
    wave: 'Wave 1',
    productName: 'MS Product'
  });
  const eosItem = makeItem({
    id: 'eos-1',
    source: 'EOS',
    wave: undefined,
    productName: 'EOS App'
  });
  const filters = {
    ...baseFilters(['Microsoft', 'EOS']),
    waves: ['Wave 1']
  };
  const result = filterReleaseItems([msItem, eosItem], filters);
  assert.equal(result.length, 2, 'MS-only wave filter must not exclude EOS items');
})();

(() => {
  const msItem = makeItem({
    id: 'ms-2',
    source: 'Microsoft',
    minBcVersion: null
  });
  const eosItem = makeItem({
    id: 'eos-2',
    source: 'EOS',
    minBcVersion: 21
  });
  const filters = {
    ...baseFilters(['Microsoft', 'EOS']),
    minBcVersionMin: 22
  };
  const result = filterReleaseItems([msItem, eosItem], filters);
  assert.equal(
    result.some((item) => item.id === 'ms-2'),
    true,
    'EOS-only BC filter must not exclude MS items'
  );
  assert.equal(
    result.some((item) => item.id === 'eos-2'),
    false,
    'EOS-only BC filter must exclude EOS items below min version'
  );
})();

(async () => {
  const storeData: Record<string, string> = {};
  globalThis.localStorage = {
    getItem: (key: string) => (key in storeData ? storeData[key] : null),
    setItem: (key: string, value: string) => {
      storeData[key] = value;
    },
    removeItem: (key: string) => {
      delete storeData[key];
    },
    clear: () => {
      Object.keys(storeData).forEach((key) => delete storeData[key]);
    },
    key: (index: number) => Object.keys(storeData)[index] ?? null,
    get length() {
      return Object.keys(storeData).length;
    }
  } as Storage;

  const { useFilterStore } = await import('../src/app/store/useFilterStore');
  const cssFilters = baseFilters(['Microsoft']);
  const customerFilters = baseFilters(['EOS']);

  useFilterStore.getState().setCssFilters(cssFilters);
  useFilterStore.getState().setCustomerFilters('cust-1', customerFilters);

  const state = useFilterStore.getState();
  assert.deepEqual(state.cssFilters, cssFilters, 'CSS filters must remain intact');
  assert.deepEqual(
    state.customerFilters['cust-1'],
    customerFilters,
    'Customer filters must be scoped by customerId'
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

console.log('filterService tests: OK');
