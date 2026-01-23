import type { ReleaseItem, ReleaseSource } from '../models/ReleaseItem';
import { ALL_RELEASE_SOURCES, RELEASE_SOURCE_LABELS } from './FilterDefinitions';
import { normalizeProductLabel } from './FilterMetadata';

export type ProductCount = {
  label: string;
  count: number;
};

export type SourceCounts = {
  source: ReleaseSource;
  label: string;
  total: number;
  products: ProductCount[] | null;
};

export type CountsInfo = {
  updatedAt: string;
  sources: SourceCounts[];
};

const buildCountsForSource = (
  items: ReleaseItem[]
): { total: number; products: ProductCount[] | null } => {
  const productCounts = new Map<string, number>();
  items.forEach((item) => {
    const raw = item.productName || item.product;
    if (!raw) {
      return;
    }
    const normalized = normalizeProductLabel(raw);
    if (!normalized) {
      return;
    }
    productCounts.set(normalized, (productCounts.get(normalized) ?? 0) + 1);
  });

  const products = Array.from(productCounts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.label.localeCompare(b.label);
    });

  return {
    total: items.length,
    products: products.length > 0 ? products : null
  };
};

export const computeCountsBySourceAndProduct = (
  items: ReleaseItem[],
  sources: ReleaseSource[] = ALL_RELEASE_SOURCES
): CountsInfo => {
  const bySource = new Map<ReleaseSource, ReleaseItem[]>();
  sources.forEach((source) => bySource.set(source, []));
  items.forEach((item) => {
    const bucket = bySource.get(item.source) ?? [];
    bucket.push(item);
    bySource.set(item.source, bucket);
  });

  const sourceCounts = sources.map((source) => {
    const sourceItems = bySource.get(source) ?? [];
    const counts = buildCountsForSource(sourceItems);
    return {
      source,
      label: RELEASE_SOURCE_LABELS[source] ?? source,
      total: counts.total,
      products: counts.products
    };
  });

  return {
    updatedAt: new Date().toISOString(),
    sources: sourceCounts
  };
};
