/**
 * Collaudo headless della generazione PowerPoint.
 *
 * Costruisce un deck da uno snapshot reale, lo salva come .pptx e verifica
 * che sia un pacchetto OOXML valido: parti obbligatorie presenti, numero di
 * slide atteso, colori di brand e font effettivamente presenti nell'XML.
 *
 *   npx tsx tools/deckSmokeTest.ts
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';
import { buildDeckModel, DEFAULT_DECK_SECTIONS } from '../src/exports/deckModel';
import PptxGenJS from 'pptxgenjs';
import {
  buildPresentation,
  resolvePptxCtor
} from '../src/exports/pptxRenderer';
import { EOS_COLORS, EOS_FONTS, EOS_LAYOUT } from '../src/exports/brandTokens';
import type { ReleaseItem } from '../src/models/ReleaseItem';
import type { FilterState } from '../src/models/Filters';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT_DIR = path.join(ROOT, 'tmp');

const loadItems = async (): Promise<ReleaseItem[]> => {
  const snapshotDir = path.join(ROOT, 'src', 'data', 'snapshots');
  const latest = JSON.parse(
    await readFile(path.join(snapshotDir, 'latest.json'), 'utf8')
  ) as Record<string, string>;

  const items: ReleaseItem[] = [];
  for (const file of Object.values(latest)) {
    const payload = JSON.parse(
      await readFile(path.join(snapshotDir, file), 'utf8')
    ) as { items: ReleaseItem[] };
    items.push(...payload.items);
  }
  return items;
};

const makeFilters = (): FilterState =>
  ({
    sources: ['Microsoft', 'EOS'],
    statuses: ['Planned'],
    products: [],
    tags: [],
    months: [],
    categories: [],
    waves: [],
    availabilityTypes: [],
    enabledFor: [],
    geography: [],
    language: [],
    bcVersions: [],
    targetCustomerIds: [],
    targetGroupIds: [],
    targetCssOwners: [],
    query: 'copilot',
    periodNewDays: 30,
    periodChangedDays: 0,
    releaseInDays: 0,
    releaseDateFrom: '',
    releaseDateTo: '',
    horizonMonths: 12,
    historyMonths: 6,
    minBcVersionMin: null,
    sortOrder: 'newest'
  }) as unknown as FilterState;

const assert = (condition: boolean, message: string): void => {
  if (!condition) {
    throw new Error(`FALLITO: ${message}`);
  }
  console.log(`  ok  ${message}`);
};

const run = async (): Promise<void> => {
  const allItems = await loadItems();
  const items = allItems.slice(0, 240);
  console.log(`Snapshot caricati: ${allItems.length} item, ne uso ${items.length}\n`);

  const model = buildDeckModel(items, makeFilters(), {
    ...DEFAULT_DECK_SECTIONS,
    includeItemDetails: true,
    maxItemDetailSlides: 5,
    customerName: 'Cliente di Prova S.p.A.',
    deckTitle: 'Release Update',
    subtitle: 'Aggiornamenti Microsoft ed EOS'
  });

  console.log(`Slide generate: ${model.slides.length}`);
  console.log(`Nome file: ${model.fileName}\n`);

  const buffer = (await buildPresentation(
    resolvePptxCtor(PptxGenJS),
    model
  ).write({ outputType: 'nodebuffer' })) as Buffer;

  await mkdir(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, model.fileName);
  await writeFile(outPath, buffer);
  console.log(`Scritto ${outPath} (${Math.round(buffer.byteLength / 1024)} KB)\n`);

  console.log('Verifiche sul pacchetto OOXML:');
  const zip = await JSZip.loadAsync(buffer);
  const names = Object.keys(zip.files);

  assert(names.includes('[Content_Types].xml'), 'contiene [Content_Types].xml');
  assert(
    names.includes('ppt/presentation.xml'),
    'contiene ppt/presentation.xml'
  );
  const slideFiles = names.filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n));
  assert(
    slideFiles.length === model.slides.length,
    `slide nel pacchetto (${slideFiles.length}) = slide nel modello (${model.slides.length})`
  );
  const mediaFiles = Object.values(zip.files).filter(
    (file) => file.name.startsWith('ppt/media/') && !file.dir
  );
  assert(mediaFiles.length > 0, 'contiene le immagini del logo in ppt/media/');
  // I due logo stanno negli slide master: se finissero nelle singole slide,
  // pptxgenjs ne incorporerebbe una copia ciascuna e il file esploderebbe.
  assert(
    mediaFiles.length <= 2,
    `logo deduplicato negli slide master (${mediaFiles.length} file media, atteso <= 2)`
  );
  const mediaBytes = (
    await Promise.all(mediaFiles.map((file) => file.async('nodebuffer')))
  ).reduce((sum, data) => sum + data.byteLength, 0);
  assert(
    mediaBytes < 100 * 1024,
    `media totali sotto i 100 KB (${Math.round(mediaBytes / 1024)} KB)`
  );

  // Fondo, banda e logo vivono nei master, che pptxgenjs materializza come
  // slideLayout (non come slideMaster: slideMaster1 resta quello di default).
  const layoutFiles = names.filter((n) =>
    /^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(n)
  );
  const layouts = await Promise.all(
    layoutFiles.map(async (n) => ({
      name: n,
      xml: (await zip.file(n)?.async('string')) ?? ''
    }))
  );
  const darkLayout = layouts.find((l) => l.xml.includes(EOS_COLORS.brown));
  const contentLayout = layouts.find((l) => l.xml.includes(EOS_COLORS.orange));
  assert(
    darkLayout !== undefined,
    `master scuro con fondo marrone ${EOS_COLORS.brown}`
  );
  assert(
    contentLayout !== undefined,
    `master di contenuto con banda arancione ${EOS_COLORS.orange}`
  );
  assert(
    (darkLayout?.xml.includes('<p:pic>') ?? false) &&
      (contentLayout?.xml.includes('<p:pic>') ?? false),
    'entrambi i master contengono il logo'
  );

  // La cover e la closing devono usare il master scuro (logo negativo), le
  // altre slide quello chiaro: il logo a colori su fondo scuro e' vietato.
  const layoutOf = async (slideName: string): Promise<string> => {
    const rels =
      (await zip.file(`ppt/slides/_rels/${slideName}.xml.rels`)?.async('string')) ??
      '';
    return rels.match(/slideLayout\d+\.xml/)?.[0] ?? '';
  };
  const darkName = path.basename(darkLayout?.name ?? '');
  const contentName = path.basename(contentLayout?.name ?? '');
  assert((await layoutOf('slide1')) === darkName, 'cover usa il master scuro');
  assert(
    (await layoutOf(`slide${slideFiles.length}`)) === darkName,
    'closing usa il master scuro'
  );
  assert(
    (await layoutOf('slide2')) === contentName,
    'le slide di contenuto usano il master chiaro'
  );

  const slide1 = (await zip.file('ppt/slides/slide1.xml')?.async('string')) ?? '';
  assert(
    slide1.includes(EOS_FONTS.heading),
    `font dichiarato = ${EOS_FONTS.heading}`
  );

  const allSlidesXml = (
    await Promise.all(
      slideFiles.map((n) => zip.file(n)?.async('string') ?? Promise.resolve(''))
    )
  ).join('');
  assert(
    allSlidesXml.includes(EOS_COLORS.orange),
    `arancione di brand ${EOS_COLORS.orange} presente`
  );
  assert(
    !/FF0000|0000FF|00FF00/.test(allSlidesXml),
    'nessun colore fuori palette (rosso/blu/verde puri)'
  );

  // Geometria: ogni oggetto deve stare dentro i bordi della slide.
  // Questo controllo intercetta il caso in cui il layout dichiarato non
  // corrisponde alle coordinate usate (es. preset 'LAYOUT_16x9' = 10 x 5.625
  // pollici mentre gli oggetti sono posizionati per 13.333 x 7.5): logo, tile
  // KPI e grafici finiscono fuori slide senza che il file risulti invalido.
  const EMU_PER_INCH = 914400;
  const presentationXml =
    (await zip.file('ppt/presentation.xml')?.async('string')) ?? '';
  const sldSz = presentationXml.match(/<p:sldSz[^>]*cx="(\d+)"[^>]*cy="(\d+)"/);
  const slideW = Number(sldSz?.[1] ?? 0) / EMU_PER_INCH;
  const slideH = Number(sldSz?.[2] ?? 0) / EMU_PER_INCH;
  assert(
    Math.abs(slideW - EOS_LAYOUT.slideW) < 0.01 &&
      Math.abs(slideH - EOS_LAYOUT.slideH) < 0.01,
    `dimensioni slide ${slideW.toFixed(2)}x${slideH.toFixed(2)}" = EOS_LAYOUT (${EOS_LAYOUT.slideW}x${EOS_LAYOUT.slideH}")`
  );

  const outOfBounds: string[] = [];
  const targets = [...slideFiles, ...layoutFiles];
  for (const name of targets) {
    const xml = (await zip.file(name)?.async('string')) ?? '';
    const frames = xml.matchAll(
      /<a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/>/g
    );
    for (const frame of frames) {
      const x = Number(frame[1]) / EMU_PER_INCH;
      const y = Number(frame[2]) / EMU_PER_INCH;
      const w = Number(frame[3]) / EMU_PER_INCH;
      const h = Number(frame[4]) / EMU_PER_INCH;
      // Tolleranza di 0.02" per gli arrotondamenti EMU.
      if (x < -0.02 || y < -0.02 || x + w > slideW + 0.02 || y + h > slideH + 0.02) {
        outOfBounds.push(
          `${path.basename(name)}: ${x.toFixed(2)},${y.toFixed(2)} ${w.toFixed(2)}x${h.toFixed(2)}"`
        );
      }
    }
  }
  assert(
    outOfBounds.length === 0,
    `nessun oggetto fuori dai bordi della slide${
      outOfBounds.length > 0 ? ` — trovati: ${outOfBounds.slice(0, 4).join(' | ')}` : ''
    }`
  );

  const filterSlides = model.slides.filter((s) => s.kind === 'filters');
  const longFilterSlides = filterSlides.filter(
    (s) => s.kind === 'filters' && s.lines.length > 12
  );
  assert(
    longFilterSlides.length === 0,
    'la slide dei filtri riassume invece di elencare tutti i valori'
  );

  const bulletSlides = model.slides.filter((s) => s.kind === 'bullets');
  const overLimit = bulletSlides.filter(
    (s) => s.kind === 'bullets' && s.bullets.length > 6
  );
  assert(overLimit.length === 0, 'nessuna slide supera i 6 bullet del brand book');

  // Con il dataset completo il deck deve restare un report, non un elenco:
  // senza tetto per prodotto si arrivava a ~480 slide.
  const fullModel = buildDeckModel(allItems, makeFilters(), {
    ...DEFAULT_DECK_SECTIONS,
    customerName: 'Cliente',
    deckTitle: 'Release Update',
    subtitle: ''
  });
  assert(
    fullModel.slides.length <= 60,
    `deck su tutti i ${allItems.length} item resta sotto le 60 slide (${fullModel.slides.length})`
  );

  console.log('\nTutte le verifiche superate.');
};

run().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
