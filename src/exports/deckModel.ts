import { z } from 'zod';
import type { ReleaseItem } from '../models/ReleaseItem';
import type { FilterState } from '../models/Filters';
import { groupByProduct, resolveItemLinks } from '../services/ExportService';
import {
  DASHBOARD_KPI_DEFINITIONS,
  computeDashboardKpis
} from '../services/KpiService';
import { computeCountsBySourceAndProduct } from '../services/CountsService';
import { describeActiveFilters } from '../services/FilterDescription';
import { EOS_CLAIM, EOS_CONTACT, EOS_DENSITY } from './brandTokens';

/** Numero massimo di sezioni prodotto prima del collasso in "Altri prodotti". */
const MAX_PRODUCT_SECTIONS = 15;
/**
 * Slide per singolo prodotto. Senza questo tetto un prodotto con 800
 * aggiornamenti genererebbe 130 slide da solo: con i dati reali il deck
 * arrivava a ~480 slide, inutilizzabile come report cliente.
 */
const MAX_SLIDES_PER_PRODUCT = 3;
/** Voci mostrate nella slide riepilogativa "Altri prodotti". */
const MAX_OTHER_PRODUCTS_ROWS = 6;
/** Prodotti mostrati nel grafico "Top prodotti". */
const TOP_PRODUCTS_LIMIT = 10;
const MAX_TITLE_CHARS = 90;
const MAX_SUMMARY_CHARS = 320;

export const DeckOptionsSchema = z.object({
  includeKpis: z.boolean(),
  includeFilterContext: z.boolean(),
  includeTopProducts: z.boolean(),
  includeProductSections: z.boolean(),
  includeItemDetails: z.boolean(),
  maxItemDetailSlides: z.number().int().min(1).max(60),
  customerName: z.string().min(1),
  deckTitle: z.string().min(1),
  subtitle: z.string()
});

export type DeckOptions = z.infer<typeof DeckOptionsSchema>;

/** Le sole sezioni configurabili, senza i campi testuali del deck. */
export type DeckSections = Omit<
  DeckOptions,
  'customerName' | 'deckTitle' | 'subtitle'
>;

/**
 * Default delle sezioni configurabili. Cover e closing non compaiono perche'
 * il Brand Book (par. 5) le richiede sempre: non sono disattivabili.
 */
export const DEFAULT_DECK_SECTIONS: DeckSections = {
  includeKpis: true,
  includeFilterContext: true,
  includeTopProducts: true,
  includeProductSections: true,
  includeItemDetails: false,
  maxItemDetailSlides: 20
};

export type DeckBullet = {
  text: string;
  sub?: string[];
  link?: string;
};

export type DeckSlide =
  | {
      kind: 'cover';
      title: string;
      subtitle: string;
      customerName: string;
      generatedAt: string;
    }
  | { kind: 'kpi'; title: string; tiles: { label: string; value: number }[] }
  | { kind: 'filters'; title: string; lines: string[] }
  | {
      kind: 'topProducts';
      title: string;
      rows: { label: string; count: number }[];
    }
  | {
      kind: 'bullets';
      title: string;
      subtitle?: string;
      bullets: DeckBullet[];
      note?: string;
    }
  | { kind: 'closing'; claim: string; contact: typeof EOS_CONTACT };

export type DeckModel = {
  fileName: string;
  slides: DeckSlide[];
};

const truncate = (text: string, max: number): string =>
  text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;

const chunk = <T,>(items: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
};

const formatDate = (value: string | null | undefined): string =>
  value && value.length > 0 ? value : 'data non disponibile';

/** Nome file sicuro per il download, senza caratteri vietati da Windows. */
const buildFileName = (customerName: string, generatedAt: Date): string => {
  // NFD + filtro ASCII: "Città" -> "Citta" invece di "Citt-".
  const safeName =
    customerName
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'Cliente';
  const stamp = generatedAt.toISOString().slice(0, 10);
  return `UpdateLens-${safeName}-${stamp}.pptx`;
};

const buildItemBullet = (item: ReleaseItem): DeckBullet => {
  const links = resolveItemLinks(item);
  const sub = [`${item.status} · ${formatDate(item.releaseDate)}`];
  return {
    text: truncate(item.title, MAX_TITLE_CHARS),
    sub,
    link: links.sourceUrl ?? undefined
  };
};

const buildProductSlides = (items: ReleaseItem[]): DeckSlide[] => {
  const grouped = groupByProduct(items);
  const products = Object.keys(grouped).sort(
    (a, b) => grouped[b].length - grouped[a].length || a.localeCompare(b)
  );

  const slides: DeckSlide[] = [];
  const shown = products.slice(0, MAX_PRODUCT_SECTIONS);
  const hidden = products.slice(MAX_PRODUCT_SECTIONS);

  shown.forEach((product) => {
    const productItems = grouped[product];
    const allPages = chunk(productItems, EOS_DENSITY.maxBulletsPerSlide);
    const pages = allPages.slice(0, MAX_SLIDES_PER_PRODUCT);
    const shownCount = pages.reduce((sum, page) => sum + page.length, 0);
    const omitted = productItems.length - shownCount;

    pages.forEach((page, index) => {
      const isLastPage = index === pages.length - 1;
      slides.push({
        kind: 'bullets',
        title: product,
        subtitle:
          pages.length > 1
            ? `${index + 1}/${pages.length} · ${productItems.length} aggiornamenti`
            : `${productItems.length} aggiornamenti`,
        bullets: page.map(buildItemBullet),
        // L'omissione va dichiarata, mai silenziosa.
        note:
          isLastPage && omitted > 0
            ? `+${omitted} altri aggiornamenti per ${product} non elencati`
            : undefined
      });
    });
  });

  if (hidden.length > 0) {
    const rows = hidden.slice(0, MAX_OTHER_PRODUCTS_ROWS);
    const remaining = hidden.length - rows.length;
    slides.push({
      kind: 'bullets',
      title: 'Altri prodotti',
      subtitle: `${hidden.length} prodotti non dettagliati`,
      bullets: rows.map((product) => ({
        text: product,
        sub: [`${grouped[product].length} aggiornamenti`]
      })),
      note: remaining > 0 ? `+${remaining} altri prodotti` : undefined
    });
  }

  return slides;
};

const buildDetailSlides = (
  items: ReleaseItem[],
  maxSlides: number
): DeckSlide[] => {
  const selected = items.slice(0, maxSlides);
  const omitted = items.length - selected.length;

  const slides: DeckSlide[] = selected.map((item) => {
    const links = resolveItemLinks(item);
    const summary = item.summary || item.description || '';
    const bullets: DeckBullet[] = [];

    if (summary) {
      bullets.push({ text: truncate(summary, MAX_SUMMARY_CHARS) });
    }
    bullets.push({ text: `Stato: ${item.status}` });
    bullets.push({ text: `Disponibilità: ${formatDate(item.releaseDate)}` });
    if (links.sourceUrl) {
      bullets.push({ text: 'Fonte ufficiale', link: links.sourceUrl });
    }
    if (links.docUrl) {
      bullets.push({ text: 'Documentazione Microsoft Learn', link: links.docUrl });
    }

    return {
      kind: 'bullets',
      title: truncate(item.title, MAX_TITLE_CHARS),
      subtitle: `${item.source} · ${item.productName}`,
      bullets
    };
  });

  if (omitted > 0) {
    slides.push({
      kind: 'bullets',
      title: 'Aggiornamenti non inclusi',
      subtitle: 'Dettaglio limitato per contenere la lunghezza del deck',
      bullets: [
        {
          text: `+${omitted} aggiornamenti non dettagliati in questo report`,
          sub: ['L’elenco completo è disponibile in Update Lens e nell’export Markdown']
        }
      ]
    });
  }

  return slides;
};

/**
 * Costruisce il modello del deck a partire dagli item gia' filtrati e ordinati
 * dalla Dashboard. Funzione pura: nessuna dipendenza da pptxgenjs o dal DOM,
 * cosi' il modal puo' usarla anche solo per stimare il numero di slide.
 */
export const buildDeckModel = (
  items: ReleaseItem[],
  filters: FilterState,
  options: DeckOptions,
  now: Date = new Date()
): DeckModel => {
  const slides: DeckSlide[] = [];
  const generatedAt = now.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  slides.push({
    kind: 'cover',
    title: options.deckTitle,
    subtitle: options.subtitle,
    customerName: options.customerName,
    generatedAt
  });

  if (options.includeKpis) {
    const kpis = computeDashboardKpis(items);
    slides.push({
      kind: 'kpi',
      title: 'Sintesi aggiornamenti',
      tiles: DASHBOARD_KPI_DEFINITIONS.map((definition) => ({
        label: definition.label,
        value: kpis[definition.key]
      }))
    });
  }

  if (options.includeFilterContext) {
    const active = describeActiveFilters(filters);
    slides.push({
      kind: 'filters',
      title: 'Perimetro del report',
      lines: [
        `Cliente: ${options.customerName}`,
        `Aggiornamenti selezionati: ${items.length}`,
        `Generato il: ${generatedAt}`,
        ...(active.length > 0
          ? active
          : ['Nessun filtro applicato — vista completa'])
      ]
    });
  }

  if (options.includeTopProducts) {
    const counts = computeCountsBySourceAndProduct(items);
    const totals = new Map<string, number>();
    counts.sources.forEach((source) => {
      source.products?.forEach((product) => {
        totals.set(product.label, (totals.get(product.label) ?? 0) + product.count);
      });
    });
    const rows = [...totals.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
      .slice(0, TOP_PRODUCTS_LIMIT);

    if (rows.length > 0) {
      slides.push({ kind: 'topProducts', title: 'Prodotti più interessati', rows });
    }
  }

  if (options.includeProductSections) {
    slides.push(...buildProductSlides(items));
  }

  if (options.includeItemDetails) {
    slides.push(...buildDetailSlides(items, options.maxItemDetailSlides));
  }

  slides.push({ kind: 'closing', claim: EOS_CLAIM, contact: EOS_CONTACT });

  return { fileName: buildFileName(options.customerName, now), slides };
};
