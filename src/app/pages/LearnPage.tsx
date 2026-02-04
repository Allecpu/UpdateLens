import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import type { ReleaseItem } from '../../models/ReleaseItem';
import { loadAllSnapshots } from '../../services/DataLoader';
import { isValidHttpUrl } from '../../utils/url';
import {
  getLearnLevelLabel,
  getLearnLevelRank,
  getLearnTypeLabel,
  getLearnTypeRank,
  normalizeLearnLevel,
  normalizeLearnType,
  resolveLearnProductKey,
  type LearnLevel,
  type LearnType
} from '../../utils/learn';

type LearnResource = {
  id: string;
  productKey: string;
  productName: string;
  title: string;
  description: string;
  url: string;
  type: LearnType;
  level: LearnLevel;
  source: string;
};

type LearnFiltersState = {
  selectedProductKey: string;
  types: LearnType[];
  levels: LearnLevel[];
  sources: string[];
  query: string;
};

const SESSION_KEY = 'updatelens.learn.filters.v1';
const SOURCE_MICROSOFT_LEARN = 'Microsoft Learn';
const SOURCE_EXTERNAL = 'External';

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

const buildProductKey = (item: ReleaseItem): string => {
  return (
    resolveLearnProductKey(item.productName ?? item.product) ??
    slugify(item.productName ?? item.product)
  );
};

const buildLearnResources = (items: ReleaseItem[]): LearnResource[] => {
  const dedupe = new Map<string, LearnResource>();

  items.forEach((item) => {
    const learnUrl = item.learnUrl;
    if (!learnUrl || !isValidHttpUrl(learnUrl)) {
      return;
    }

    const productName = (item.productName ?? item.product).trim();
    if (!productName) {
      return;
    }

    const productKey = buildProductKey(item);
    const type = normalizeLearnType(item.learnMeta?.type);
    const level = normalizeLearnLevel(item.learnMeta?.level);
    const source = /learn\.microsoft\.com/i.test(learnUrl)
      ? SOURCE_MICROSOFT_LEARN
      : SOURCE_EXTERNAL;

    const resource: LearnResource = {
      id: `${item.id}-${productKey}`,
      productKey,
      productName,
      title: item.learnMeta?.title || item.title,
      description: item.summary || item.description || '',
      url: learnUrl,
      type,
      level,
      source
    };

    const dedupeKey = `${resource.productKey}::${resource.url}`;
    if (!dedupe.has(dedupeKey)) {
      dedupe.set(dedupeKey, resource);
    }
  });

  return Array.from(dedupe.values());
};

const sortResources = (resources: LearnResource[]): LearnResource[] => {
  return resources
    .slice()
    .sort((a, b) => {
      const byType = getLearnTypeRank(a.type) - getLearnTypeRank(b.type);
      if (byType !== 0) {
        return byType;
      }
      const byLevel = getLearnLevelRank(a.level) - getLearnLevelRank(b.level);
      if (byLevel !== 0) {
        return byLevel;
      }
      return a.title.localeCompare(b.title);
    });
};

const loadSavedFilters = (): Partial<LearnFiltersState> => {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) {
      return {};
    }
    return JSON.parse(raw) as Partial<LearnFiltersState>;
  } catch {
    return {};
  }
};

const LearnPage = () => {
  const { productKey: routeProductKey } = useParams<{ productKey?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ReleaseItem[]>([]);
  const [filters, setFilters] = useState<LearnFiltersState>({
    selectedProductKey: '',
    types: [],
    levels: [],
    sources: [],
    query: ''
  });

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);
    loadAllSnapshots()
      .then((result) => {
        if (!active) {
          return;
        }
        setItems(result.items);
        if (result.errors.length > 0) {
          setError(result.errors.join(' | '));
        }
      })
      .catch((err: unknown) => {
        if (!active) {
          return;
        }
        const reason = err instanceof Error ? err.message : 'Errore caricamento Learn';
        setError(reason);
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const resources = useMemo(() => buildLearnResources(items), [items]);
  const productOptions = useMemo(() => {
    const groups = new Map<string, { key: string; name: string; count: number }>();
    resources.forEach((resource) => {
      const current = groups.get(resource.productKey);
      if (current) {
        current.count += 1;
        return;
      }
      groups.set(resource.productKey, {
        key: resource.productKey,
        name: resource.productName,
        count: 1
      });
    });
    return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [resources]);

  const sourceOptions = useMemo(() => {
    return Array.from(new Set(resources.map((resource) => resource.source))).sort();
  }, [resources]);
  const selectedProduct = useMemo(
    () => productOptions.find((entry) => entry.key === filters.selectedProductKey) ?? null,
    [filters.selectedProductKey, productOptions]
  );

  useEffect(() => {
    if (productOptions.length === 0) {
      return;
    }

    const saved = loadSavedFilters();
    const validKeys = new Set(productOptions.map((entry) => entry.key));
    const fromRoute =
      routeProductKey && validKeys.has(routeProductKey) ? routeProductKey : '';
    const fromSession =
      saved.selectedProductKey && validKeys.has(saved.selectedProductKey)
        ? saved.selectedProductKey
        : '';
    const fallback = productOptions[0].key;

    setFilters((current) => {
      if (current.selectedProductKey) {
        return current;
      }
      return {
        selectedProductKey: fromRoute || fromSession || fallback,
        types: Array.isArray(saved.types) ? saved.types : [],
        levels: Array.isArray(saved.levels) ? saved.levels : [],
        sources: Array.isArray(saved.sources) ? saved.sources : [],
        query: typeof saved.query === 'string' ? saved.query : ''
      };
    });
  }, [productOptions, routeProductKey]);

  useEffect(() => {
    if (!routeProductKey) {
      return;
    }
    const validKeys = new Set(productOptions.map((entry) => entry.key));
    if (!validKeys.has(routeProductKey)) {
      return;
    }
    setFilters((current) => {
      if (current.selectedProductKey === routeProductKey) {
        return current;
      }
      return { ...current, selectedProductKey: routeProductKey };
    });
  }, [productOptions, routeProductKey]);

  useEffect(() => {
    if (!filters.selectedProductKey) {
      return;
    }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(filters));
  }, [filters]);

  const filteredResources = useMemo(() => {
    const query = filters.query.trim().toLowerCase();
    return sortResources(
      resources.filter((resource) => {
        if (resource.productKey !== filters.selectedProductKey) {
          return false;
        }
        if (filters.types.length > 0 && !filters.types.includes(resource.type)) {
          return false;
        }
        if (filters.levels.length > 0 && !filters.levels.includes(resource.level)) {
          return false;
        }
        if (filters.sources.length > 0 && !filters.sources.includes(resource.source)) {
          return false;
        }
        if (!query) {
          return true;
        }
        return `${resource.title} ${resource.description}`
          .toLowerCase()
          .includes(query);
      })
    );
  }, [filters, resources]);

  const setSelectedProduct = (nextProductKey: string) => {
    setFilters((current) => ({ ...current, selectedProductKey: nextProductKey }));
    if (location.pathname !== `/learn/${nextProductKey}`) {
      navigate(`/learn/${nextProductKey}`);
    }
  };

  const resetFilters = () => {
    setFilters((current) => ({
      selectedProductKey: current.selectedProductKey,
      types: [],
      levels: [],
      sources: [],
      query: ''
    }));
  };

  const toggleArrayFilter = <T extends string>(key: 'types' | 'levels' | 'sources', value: T) => {
    setFilters((current) => {
      const currentValues = current[key] as T[];
      const nextValues = currentValues.includes(value)
        ? currentValues.filter((entry) => entry !== value)
        : [...currentValues, value];
      return { ...current, [key]: nextValues };
    });
  };

  return (
    <div className="flex min-h-[calc(100vh-140px)] gap-6">
      <aside className="w-72 rounded-3xl bg-sidebar px-4 py-5 text-sidebar-foreground shadow-soft">
        <div className="sticky top-4 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Learn</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Contenuti formativi filtrabili per prodotto.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs uppercase text-muted-foreground">Prodotto</label>
            <select
              className="ul-input rounded-xl"
              value={filters.selectedProductKey}
              onChange={(event) => setSelectedProduct(event.target.value)}
            >
              {productOptions.map((product) => (
                <option key={product.key} value={product.key}>
                  {product.name} ({product.count})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs uppercase text-muted-foreground">Ricerca</label>
            <input
              className="ul-input rounded-xl"
              value={filters.query}
              placeholder="Cerca titolo o descrizione..."
              onChange={(event) =>
                setFilters((current) => ({ ...current, query: event.target.value }))
              }
            />
          </div>

          <div>
            <div className="mb-1 text-xs uppercase text-muted-foreground">Tipo contenuto</div>
            <div className="space-y-1">
              {(['learningPath', 'module', 'course', 'certification'] as LearnType[]).map(
                (type) => (
                  <label key={type} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="ul-checkbox"
                      checked={filters.types.includes(type)}
                      onChange={() => toggleArrayFilter('types', type)}
                    />
                    {getLearnTypeLabel(type)}
                  </label>
                )
              )}
            </div>
          </div>

          <div>
            <div className="mb-1 text-xs uppercase text-muted-foreground">Livello</div>
            <div className="space-y-1">
              {(['beginner', 'intermediate', 'advanced'] as LearnLevel[]).map((level) => (
                <label key={level} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="ul-checkbox"
                    checked={filters.levels.includes(level)}
                    onChange={() => toggleArrayFilter('levels', level)}
                  />
                  {getLearnLevelLabel(level)}
                </label>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1 text-xs uppercase text-muted-foreground">Fonte</div>
            <div className="space-y-1">
              {sourceOptions.map((source) => (
                <label key={source} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="ul-checkbox"
                    checked={filters.sources.includes(source)}
                    onChange={() => toggleArrayFilter('sources', source)}
                  />
                  {source}
                </label>
              ))}
            </div>
          </div>

          <button className="ul-button ul-button-ghost w-full" onClick={resetFilters}>
            Reset filtri
          </button>
        </div>
      </aside>

      <main className="flex-1">
        <header className="mb-4">
          <h1 className="text-3xl font-semibold">Learn</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {filteredResources.length} risorse disponibili
            {selectedProduct ? ` per ${selectedProduct.name}` : ''}.
          </p>
        </header>

        {isLoading ? (
          <section className="grid gap-4">
            {[1, 2, 3, 4].map((skeleton) => (
              <div key={skeleton} className="ul-surface p-5 animate-pulse">
                <div className="h-5 w-2/3 rounded bg-muted" />
                <div className="mt-3 h-4 w-full rounded bg-muted" />
                <div className="mt-2 h-4 w-5/6 rounded bg-muted" />
              </div>
            ))}
          </section>
        ) : error ? (
          <div className="ul-surface p-6">
            <div className="text-sm font-semibold text-amber-700">Errore caricamento</div>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          </div>
        ) : filteredResources.length === 0 ? (
          <div className="ul-surface p-8 text-center">
            <div className="text-lg font-semibold">Nessuna risorsa trovata</div>
            <p className="mt-2 text-sm text-muted-foreground">
              Prova a cambiare prodotto o azzera i filtri.
            </p>
            <button className="ul-button ul-button-primary mt-4" onClick={resetFilters}>
              Reset filtri
            </button>
          </div>
        ) : (
          <section className="grid gap-4">
            {filteredResources.map((resource) => (
              <article key={resource.id} className="ul-surface p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="ul-chip">{getLearnTypeLabel(resource.type)}</span>
                  {resource.level !== 'unknown' && (
                    <span className="ul-chip">{getLearnLevelLabel(resource.level)}</span>
                  )}
                  <span className="ul-chip">{resource.source}</span>
                </div>
                <h2 className="mt-3 text-lg font-semibold">{resource.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground line-clamp-3">
                  {resource.description || 'Contenuto formativo Microsoft Learn.'}
                </p>
                <div className="mt-4">
                  <a
                    className="ul-button ul-button-primary inline-flex items-center gap-2"
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Apri su Learn
                  </a>
                </div>
              </article>
            ))}
          </section>
        )}
      </main>
    </div>
  );
};

export default LearnPage;
