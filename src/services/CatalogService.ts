import type { Product, ProductsConfig } from '../models/Config';

type CatalogOverride = {
  items: Product[];
  categories: string[];
  tags: string[];
};

const OVERRIDE_KEY = 'updatelens.catalog.override';

const readOverride = (): CatalogOverride => {
  const raw = localStorage.getItem(OVERRIDE_KEY);
  if (!raw) {
    return { items: [], categories: [], tags: [] };
  }
  try {
    const parsed = JSON.parse(raw) as CatalogOverride;
    return {
      items: parsed.items ?? [],
      categories: parsed.categories ?? [],
      tags: parsed.tags ?? []
    };
  } catch {
    return { items: [], categories: [], tags: [] };
  }
};

const writeOverride = (override: CatalogOverride): void => {
  localStorage.setItem(OVERRIDE_KEY, JSON.stringify(override));
};

export const loadCatalog = (base: ProductsConfig): ProductsConfig => {
  const override = readOverride();
  const mergedItems = [
    ...base.items,
    ...override.items.filter(
      (item) => !base.items.some((baseItem) => baseItem.id === item.id)
    )
  ];
  const mergedCategories = Array.from(
    new Set([...(base.categories ?? []), ...override.categories])
  );
  const mergedTags = Array.from(
    new Set([...(base.tags ?? []), ...override.tags])
  );

  return {
    ...base,
    items: mergedItems,
    categories: mergedCategories,
    tags: mergedTags
  };
};

export const addCatalogItem = (item: Product): void => {
  const override = readOverride();
  if (override.items.some((entry) => entry.id === item.id)) {
    return;
  }
  writeOverride({
    ...override,
    items: [...override.items, item]
  });
};

export const addCatalogCategory = (category: string): void => {
  const override = readOverride();
  if (override.categories.includes(category)) {
    return;
  }
  writeOverride({
    ...override,
    categories: [...override.categories, category]
  });
};

export const addCatalogTag = (tag: string): void => {
  const override = readOverride();
  if (override.tags.includes(tag)) {
    return;
  }
  writeOverride({
    ...override,
    tags: [...override.tags, tag]
  });
};
