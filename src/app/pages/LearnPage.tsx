import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import type { ReleaseItem, ReleaseSource } from '../../models/ReleaseItem';
import { loadAllSnapshotsWithPrevious } from '../../services/DataLoader';
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

type LearnDurationBucket = 'short' | 'medium' | 'long' | 'unknown';
type LearnSnapshotDelta = 'new' | 'updated' | null;

type LearnResource = {
  id: string;
  productKey: string;
  productName: string;
  category: string;
  roles: string[];
  subjects: string[];
  moduleCount: number | null;
  xp: number | null;
  title: string;
  description: string;
  url: string;
  type: LearnType;
  level: LearnLevel;
  source: string;
  lastUpdatedDate: string;
  estimatedMinutes: number | null;
  durationBucket: LearnDurationBucket;
  snapshotDelta: LearnSnapshotDelta;
};

type LearnFiltersState = {
  selectedProductKey: string;
  types: LearnType[];
  levels: LearnLevel[];
  sources: string[];
  durations: LearnDurationBucket[];
  query: string;
};

type LearnPreset = {
  id: string;
  name: string;
  createdAt: string;
  filters: LearnFiltersState;
};

const SESSION_KEY = 'updatelens.learn.filters.v2';
const PRESETS_KEY = 'updatelens.learn.presets.v1';
const SOURCE_MICROSOFT_LEARN = 'Microsoft Learn';
const SOURCE_EXTERNAL = 'External';
const DURATION_BUCKETS: LearnDurationBucket[] = ['short', 'medium', 'long', 'unknown'];
const ALL_PRODUCTS_KEY = '__all__';

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

const parseDateAny = (value?: string | null): Date | null => {
  if (!value) {
    return null;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) {
      return null;
    }
    return new Date(year, month - 1, day);
  }
  if (/^\d{4}-\d{2}$/.test(value)) {
    const [year, month] = value.split('-').map(Number);
    if (!year || !month) {
      return null;
    }
    return new Date(year, month - 1, 1);
  }
  return null;
};

const getDurationBucketLabel = (bucket: LearnDurationBucket): string => {
  if (bucket === 'short') {
    return 'Breve (<=30 min)';
  }
  if (bucket === 'medium') {
    return 'Media (31-90 min)';
  }
  if (bucket === 'long') {
    return 'Lunga (>90 min)';
  }
  return 'N/D durata';
};

const formatDuration = (minutes: number): string => {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (remainder === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${remainder}m`;
};

const formatDateLabel = (value?: string | null): string | null => {
  const parsed = parseDateAny(value);
  if (!parsed) {
    return null;
  }
  return parsed.toLocaleDateString('it-IT');
};

const humanizeSlug = (value: string): string =>
  value
    .split('-')
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ');

const readStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => entry.length > 0);
};

const parseDurationTextToMinutes = (value: string): number | null => {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  const hourMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(h|hr|hrs|hour|hours|ora|ore)/);
  const minuteMatch = normalized.match(/(\d+)\s*(m|min|mins|minute|minutes|minuti)/);

  if (hourMatch || minuteMatch) {
    const hours = hourMatch ? Number(hourMatch[1].replace(',', '.')) : 0;
    const minutes = minuteMatch ? Number(minuteMatch[1]) : 0;
    const total = Math.round(hours * 60 + minutes);
    return Number.isFinite(total) && total > 0 ? total : null;
  }

  const numberOnly = normalized.match(/^(\d+)$/);
  if (!numberOnly) {
    return null;
  }
  const minutes = Number(numberOnly[1]);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : null;
};

const resolveEstimatedMinutes = (item: ReleaseItem): number | null => {
  const meta = item.learnMeta as Record<string, unknown> | null | undefined;
  if (!meta) {
    return null;
  }

  const directCandidates = [meta.durationMinutes, meta.estimatedMinutes];
  for (const candidate of directCandidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate) && candidate > 0) {
      return Math.round(candidate);
    }
  }

  const textCandidates = [meta.duration, meta.durationText, meta.timeToComplete];
  for (const candidate of textCandidates) {
    if (typeof candidate === 'string') {
      const parsed = parseDurationTextToMinutes(candidate);
      if (parsed) {
        return parsed;
      }
    }
  }
  return null;
};

const resolveModuleCount = (item: ReleaseItem): number | null => {
  const meta = item.learnMeta as Record<string, unknown> | null | undefined;
  if (!meta) {
    return null;
  }
  const candidate = meta.moduleCount ?? meta.numberOfChildren ?? meta.number_of_children;
  if (typeof candidate !== 'number' || !Number.isFinite(candidate) || candidate < 0) {
    return null;
  }
  return Math.round(candidate);
};

const resolveXp = (item: ReleaseItem): number | null => {
  const meta = item.learnMeta as Record<string, unknown> | null | undefined;
  if (!meta) {
    return null;
  }
  const candidate = meta.xp ?? meta.xpPoints;
  if (typeof candidate !== 'number' || !Number.isFinite(candidate) || candidate <= 0) {
    return null;
  }
  return Math.round(candidate);
};

const resolveRoles = (item: ReleaseItem): string[] => {
  const meta = item.learnMeta as Record<string, unknown> | null | undefined;
  if (!meta) {
    return [];
  }
  return readStringArray(meta.roles).map(humanizeSlug);
};

const resolveSubjects = (item: ReleaseItem): string[] => {
  const meta = item.learnMeta as Record<string, unknown> | null | undefined;
  if (!meta) {
    return [];
  }
  return readStringArray(meta.subjects).map(humanizeSlug);
};

const getDurationBucket = (minutes: number | null): LearnDurationBucket => {
  if (minutes === null) {
    return 'unknown';
  }
  if (minutes <= 30) {
    return 'short';
  }
  if (minutes <= 90) {
    return 'medium';
  }
  return 'long';
};

const buildProductKey = (item: ReleaseItem): string => {
  return (
    resolveLearnProductKey(item.productName ?? item.product) ??
    slugify(item.productName ?? item.product)
  );
};

const buildComparableSignature = (
  item: ReleaseItem,
  productKey: string,
  learnUrl: string,
  estimatedMinutes: number | null
): string => {
  const normalizedUrl = learnUrl.trim().toLowerCase();
  const title = (item.learnMeta?.title || item.title || '').trim().toLowerCase();
  const description = (item.summary || item.description || '').trim().toLowerCase();
  const type = normalizeLearnType(item.learnMeta?.type);
  const level = normalizeLearnLevel(item.learnMeta?.level);
  const updated = parseDateAny(item.lastUpdatedDate)?.toISOString() ?? '';
  return [
    productKey,
    item.id.trim().toLowerCase(),
    normalizedUrl,
    title,
    description,
    type,
    level,
    estimatedMinutes?.toString() ?? '',
    updated
  ].join('::');
};

const getDeltaRank = (delta: LearnSnapshotDelta): number => {
  if (delta === 'updated') {
    return 2;
  }
  if (delta === 'new') {
    return 1;
  }
  return 0;
};

const buildLearnResources = (
  items: ReleaseItem[],
  previousItems: ReleaseItem[],
  previousBaselineSources: ReleaseSource[]
): LearnResource[] => {
  const dedupe = new Map<string, LearnResource>();
  const previousByItem = new Map<string, string>();
  const previousByUrl = new Map<string, string>();
  const baselineSet = new Set(previousBaselineSources);

  previousItems.forEach((item) => {
    const learnUrl = item.learnUrl;
    if (!learnUrl || !isValidHttpUrl(learnUrl)) {
      return;
    }
    const productName = (item.productName ?? item.product).trim();
    if (!productName) {
      return;
    }
    const productKey = buildProductKey(item);
    const estimatedMinutes = resolveEstimatedMinutes(item);
    const signature = buildComparableSignature(item, productKey, learnUrl, estimatedMinutes);
    const itemKey = `${item.source}::${item.id.trim().toLowerCase()}::${productKey}`;
    const urlKey = `${item.source}::${productKey}::${learnUrl.trim().toLowerCase()}`;
    previousByItem.set(itemKey, signature);
    previousByUrl.set(urlKey, signature);
  });

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
    const roles = resolveRoles(item);
    const subjects = resolveSubjects(item);
    const moduleCount = resolveModuleCount(item);
    const xp = resolveXp(item);
    const estimatedMinutes = resolveEstimatedMinutes(item);
    const signature = buildComparableSignature(item, productKey, learnUrl, estimatedMinutes);
    const itemKey = `${item.source}::${item.id.trim().toLowerCase()}::${productKey}`;
    const urlKey = `${item.source}::${productKey}::${learnUrl.trim().toLowerCase()}`;
    const previousSignature = previousByItem.get(itemKey) ?? previousByUrl.get(urlKey);

    let snapshotDelta: LearnSnapshotDelta = null;
    if (baselineSet.has(item.source)) {
      if (!previousSignature) {
        snapshotDelta = 'new';
      } else if (previousSignature !== signature) {
        snapshotDelta = 'updated';
      }
    }

    const resource: LearnResource = {
      id: `${productKey}::${learnUrl}`,
      productKey,
      productName,
      category: item.category?.trim() || '',
      roles,
      subjects,
      moduleCount,
      xp,
      title: item.learnMeta?.title || item.title,
      description: item.summary || item.description || '',
      url: learnUrl,
      type,
      level,
      source,
      lastUpdatedDate: item.lastUpdatedDate ?? '',
      estimatedMinutes,
      durationBucket: getDurationBucket(estimatedMinutes),
      snapshotDelta
    };

    const dedupeKey = resource.id;
    const current = dedupe.get(dedupeKey);
    if (!current) {
      dedupe.set(dedupeKey, resource);
      return;
    }

    if (getDeltaRank(resource.snapshotDelta) > getDeltaRank(current.snapshotDelta)) {
      current.snapshotDelta = resource.snapshotDelta;
    }
    if (current.estimatedMinutes === null && resource.estimatedMinutes !== null) {
      current.estimatedMinutes = resource.estimatedMinutes;
      current.durationBucket = resource.durationBucket;
    }
    if (resource.description.length > current.description.length) {
      current.description = resource.description;
    }
    if (current.roles.length === 0 && resource.roles.length > 0) {
      current.roles = resource.roles;
    }
    if (current.subjects.length === 0 && resource.subjects.length > 0) {
      current.subjects = resource.subjects;
    }
    if (current.moduleCount === null && resource.moduleCount !== null) {
      current.moduleCount = resource.moduleCount;
    }
    if (current.xp === null && resource.xp !== null) {
      current.xp = resource.xp;
    }
    if (!current.category && resource.category) {
      current.category = resource.category;
    }
    if (resource.lastUpdatedDate && (!current.lastUpdatedDate || resource.lastUpdatedDate > current.lastUpdatedDate)) {
      current.lastUpdatedDate = resource.lastUpdatedDate;
    }
  });

  return Array.from(dedupe.values());
};

const sortResources = (resources: LearnResource[]): LearnResource[] => {
  return resources
    .slice()
    .sort((a, b) => {
      const byDelta = getDeltaRank(b.snapshotDelta) - getDeltaRank(a.snapshotDelta);
      if (byDelta !== 0) {
        return byDelta;
      }
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

const loadLearnPresets = (): LearnPreset[] => {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as LearnPreset[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((preset) => typeof preset.id === 'string' && typeof preset.name === 'string');
  } catch {
    return [];
  }
};

const saveLearnPresets = (presets: LearnPreset[]): void => {
  try {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
  } catch {
    // Ignore write errors and keep app usable.
  }
};

const LearnPage = () => {
  const { productKey: routeProductKey } = useParams<{ productKey?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ReleaseItem[]>([]);
  const [previousItems, setPreviousItems] = useState<ReleaseItem[]>([]);
  const [previousBaselineSources, setPreviousBaselineSources] = useState<ReleaseSource[]>([]);
  const [filters, setFilters] = useState<LearnFiltersState>({
    selectedProductKey: '',
    types: [],
    levels: [],
    sources: [],
    durations: [],
    query: ''
  });
  const [presets, setPresets] = useState<LearnPreset[]>(() => loadLearnPresets());
  const [selectedPresetId, setSelectedPresetId] = useState('');
  const [newPresetName, setNewPresetName] = useState('');
  const [copiedResourceId, setCopiedResourceId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);
    loadAllSnapshotsWithPrevious()
      .then((result) => {
        if (!active) {
          return;
        }
        setItems(result.items);
        setPreviousItems(result.previousItems);
        setPreviousBaselineSources(result.previousBaselineSources);
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

  useEffect(() => {
    saveLearnPresets(presets);
  }, [presets]);

  const resources = useMemo(
    () => buildLearnResources(items, previousItems, previousBaselineSources),
    [items, previousItems, previousBaselineSources]
  );
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
    validKeys.add(ALL_PRODUCTS_KEY);
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
        durations: Array.isArray(saved.durations) ? saved.durations : [],
        query: typeof saved.query === 'string' ? saved.query : ''
      };
    });
  }, [productOptions, routeProductKey]);

  useEffect(() => {
    if (!routeProductKey) {
      return;
    }
    const validKeys = new Set(productOptions.map((entry) => entry.key));
    validKeys.add(ALL_PRODUCTS_KEY);
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
        if (
          filters.selectedProductKey !== ALL_PRODUCTS_KEY &&
          resource.productKey !== filters.selectedProductKey
        ) {
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
        if (filters.durations.length > 0 && !filters.durations.includes(resource.durationBucket)) {
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
    const nextPath = nextProductKey === ALL_PRODUCTS_KEY ? '/learn' : `/learn/${nextProductKey}`;
    if (location.pathname !== nextPath) {
      navigate(nextPath);
    }
  };

  const resetFilters = () => {
    setFilters((current) => ({
      selectedProductKey: current.selectedProductKey,
      types: [],
      levels: [],
      sources: [],
      durations: [],
      query: ''
    }));
  };

  const toggleArrayFilter = <T extends string>(
    key: 'types' | 'levels' | 'sources' | 'durations',
    value: T
  ) => {
    setFilters((current) => {
      const currentValues = current[key] as T[];
      const nextValues = currentValues.includes(value)
        ? currentValues.filter((entry) => entry !== value)
        : [...currentValues, value];
      return { ...current, [key]: nextValues };
    });
  };

  const handleSavePreset = () => {
    const name = newPresetName.trim();
    if (!name) {
      return;
    }

    const now = new Date().toISOString();
    setPresets((current) => {
      const existing = current.find(
        (preset) => preset.name.toLowerCase() === name.toLowerCase()
      );
      if (existing) {
        const updated = current.map((preset) =>
          preset.id === existing.id ? { ...preset, filters } : preset
        );
        setSelectedPresetId(existing.id);
        return updated;
      }
      const id = `learn-preset-${Date.now()}`;
      setSelectedPresetId(id);
      return [...current, { id, name, createdAt: now, filters }];
    });
    setNewPresetName('');
  };

  const handleApplyPreset = () => {
    if (!selectedPresetId) {
      return;
    }
    const preset = presets.find((entry) => entry.id === selectedPresetId);
    if (!preset) {
      return;
    }

    const validProductKeys = new Set(productOptions.map((entry) => entry.key));
    validProductKeys.add(ALL_PRODUCTS_KEY);
    const fallbackProductKey = productOptions[0]?.key ?? '';
    const nextProductKey = validProductKeys.has(preset.filters.selectedProductKey)
      ? preset.filters.selectedProductKey
      : filters.selectedProductKey || fallbackProductKey;

    const nextFilters = { ...preset.filters, selectedProductKey: nextProductKey };
    setFilters(nextFilters);
    const nextPath = nextProductKey === ALL_PRODUCTS_KEY ? '/learn' : `/learn/${nextProductKey}`;
    if (nextProductKey && location.pathname !== nextPath) {
      navigate(nextPath);
    }
  };

  const handleDeletePreset = () => {
    if (!selectedPresetId) {
      return;
    }
    setPresets((current) =>
      current.filter((preset) => preset.id !== selectedPresetId)
    );
    setSelectedPresetId('');
  };

  const handleCopyLink = (resource: LearnResource) => {
    navigator.clipboard.writeText(resource.url).then(() => {
      setCopiedResourceId(resource.id);
      setTimeout(
        () =>
          setCopiedResourceId((current) =>
            current === resource.id ? null : current
          ),
        1500
      );
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

          <div className="rounded-2xl border border-border/60 p-3">
            <div className="mb-2 text-xs uppercase text-muted-foreground">Miei preset Learn</div>
            <select
              className="ul-input rounded-xl"
              value={selectedPresetId}
              onChange={(event) => setSelectedPresetId(event.target.value)}
            >
              <option value="">Seleziona preset...</option>
              {presets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </select>
            <div className="mt-2 flex gap-2">
              <button
                className="ul-button ul-button-ghost flex-1"
                onClick={handleApplyPreset}
                disabled={!selectedPresetId}
              >
                Applica
              </button>
              <button
                className="ul-button ul-button-ghost flex-1"
                onClick={handleDeletePreset}
                disabled={!selectedPresetId}
              >
                Elimina
              </button>
            </div>
            <input
              className="ul-input mt-2 rounded-xl"
              value={newPresetName}
              placeholder="Nome nuovo preset..."
              onChange={(event) => setNewPresetName(event.target.value)}
            />
            <button className="ul-button ul-button-primary mt-2 w-full" onClick={handleSavePreset}>
              Salva preset corrente
            </button>
          </div>

          <div>
            <label className="mb-1 block text-xs uppercase text-muted-foreground">Prodotto</label>
            <select
              className="ul-input rounded-xl"
              value={filters.selectedProductKey}
              onChange={(event) => setSelectedProduct(event.target.value)}
            >
              <option value={ALL_PRODUCTS_KEY}>Tutti ({resources.length})</option>
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
            <div className="mb-1 text-xs uppercase text-muted-foreground">Durata stimata</div>
            <div className="space-y-1">
              {DURATION_BUCKETS.map((bucket) => (
                <label key={bucket} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="ul-checkbox"
                    checked={filters.durations.includes(bucket)}
                    onChange={() => toggleArrayFilter('durations', bucket)}
                  />
                  {getDurationBucketLabel(bucket)}
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
            {filters.selectedProductKey === ALL_PRODUCTS_KEY
              ? ' per tutti i prodotti'
              : selectedProduct
                ? ` per ${selectedProduct.name}`
                : ''}
            .
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
                  {resource.snapshotDelta && (
                    <span
                      className={`ul-chip ${
                        resource.snapshotDelta === 'new'
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                          : 'bg-amber-100 text-amber-800 border-amber-200'
                      }`}
                    >
                      {resource.snapshotDelta === 'new' ? 'Nuovo' : 'Aggiornato'}
                    </span>
                  )}
                  <span className="ul-chip">{getLearnTypeLabel(resource.type)}</span>
                  {resource.level !== 'unknown' && (
                    <span className="ul-chip">{getLearnLevelLabel(resource.level)}</span>
                  )}
                  {resource.estimatedMinutes !== null && (
                    <span className="ul-chip">Durata: {formatDuration(resource.estimatedMinutes)}</span>
                  )}
                  {resource.moduleCount !== null && (
                    <span className="ul-chip">
                      {resource.moduleCount} {resource.moduleCount === 1 ? 'modulo' : 'moduli'}
                    </span>
                  )}
                  {resource.xp !== null && <span className="ul-chip">{resource.xp} XP</span>}
                </div>
                <h2 className="mt-3 text-lg font-semibold">{resource.title}</h2>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="ul-chip font-medium">👤 Ruolo: {resource.roles.length > 0 ? resource.roles.join(', ') : 'N/D'}</span>
                  <span className="ul-chip font-medium">📶 Level: {getLearnLevelLabel(resource.level)}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {resource.category && <span>Categoria: {resource.category}</span>}
                  {resource.subjects.length > 0 && <span>Oggetto: {resource.subjects.join(', ')}</span>}
                  <span>Prodotto: {resource.productName}</span>
                  {formatDateLabel(resource.lastUpdatedDate) && (
                    <span>Aggiornato: {formatDateLabel(resource.lastUpdatedDate)}</span>
                  )}
                </div>
                <p className="mt-2 text-sm text-muted-foreground line-clamp-3">
                  {resource.description || 'Contenuto formativo Microsoft Learn.'}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <a
                    className="ul-button ul-button-primary inline-flex items-center gap-2"
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Apri su Learn
                  </a>
                  <button
                    className="ul-button ul-button-ghost inline-flex items-center gap-2"
                    onClick={() => handleCopyLink(resource)}
                  >
                    {copiedResourceId === resource.id ? 'Link copiato' : 'Copia link'}
                  </button>
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
