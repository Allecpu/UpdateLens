# Template di Integrazione Nuove Fonti Dati - UpdateLens

> **Obiettivo:** Standardizzare il processo di integrazione di nuove fonti dati in UpdateLens per ridurre i tempi di sviluppo da 15-20h a 10-15h e garantire consistenza architetturale.

**Versione:** 1.0
**Ultima revisione:** 2026-01-22
**Basato su:** Integrazioni Microsoft Release Plans, EOS What's New, Microsoft Fabric Roadmap

---

## Indice

1. [Checklist Pre-Integrazione](#1-checklist-pre-integrazione)
2. [Backend Development](#2-backend-development)
3. [Frontend Development](#3-frontend-development)
4. [Configurazione](#4-configurazione)
5. [Testing & QA](#5-testing--qa)
6. [Deployment](#6-deployment)
7. [Decision Tree](#7-decision-tree)
8. [Esempi di Riferimento](#8-esempi-di-riferimento)

---

## 1. Checklist Pre-Integrazione

### 1.1 Analisi Fonte Dati

**Valutare il tipo di fonte:**

- [ ] **API REST**: Endpoint JSON, autenticazione, rate limits
- [ ] **Web Scraping**: Struttura HTML, stabilità del DOM, frequenza cambiamenti
- [ ] **Database**: Connessione diretta, query performance
- [ ] **File statico**: CSV, JSON, XML

**Informazioni da raccogliere:**

```markdown
| Campo | Dettaglio |
|-------|-----------|
| Nome fonte | [es. "Microsoft Fabric Roadmap"] |
| URL/Endpoint | [es. "https://fabric-gps.com/api/releases"] |
| Tipo accesso | [API / Scraping / DB / File] |
| Autenticazione | [Sì/No - tipo: OAuth, API Key, Basic] |
| Rate limiting | [Sì/No - limiti: X req/min] |
| Paginazione | [Sì/No - tipo: offset, cursor, page number] |
| Formato risposta | [JSON / XML / HTML / CSV] |
| Frequenza aggiornamenti | [Real-time / Oraria / Giornaliera / Settimanale] |
| Volume dati | [~N items attesi] |
```

### 1.2 Mapping Campi

**Creare tabella di mapping verso ReleaseItem schema:**

| Campo Fonte | Campo UpdateLens | Trasformazione | Obbligatorio | Note |
|-------------|------------------|----------------|--------------|------|
| `source_id` | `id` | Prefisso "{source}-" | ✅ | ID univoco |
| `feature_name` | `title` | Diretto | ✅ | |
| `description` | `summary`, `description` | Cleanup HTML | ✅ | |
| `status` | `status` | Mapping custom | ✅ | Vedi mapping status |
| `release_date` | `availabilityDate` | Parse → YYYY-MM | ✅ | |
| `product` | `product`, `productName` | Normalizzazione | ✅ | |
| `category` | `category` | Mapping categorie | ❌ | |
| `tags` | `tags` | Split array | ❌ | |

**Schema ReleaseItem di riferimento:**

```typescript
type ReleaseItem = {
  // OBBLIGATORI
  id: string;
  source: 'Microsoft' | 'EOS' | 'Fabric' | '{YourSource}'; // Aggiungere nuovo
  product: string;
  productName: string;
  title: string;
  summary: string;
  description: string;
  status: 'Planned' | 'Rolling out' | 'Try now' | 'Launched' | 'Unknown';
  availabilityDate: string; // YYYY-MM format
  releaseDate: string; // ISO date format
  tryNow: boolean;
  minBcVersion: number | null;

  // OPZIONALI
  productId?: string;
  releasePlanId?: string | null;
  sourcePlanId?: string | null;
  sourceAppName?: string | null;
  category?: string;
  tags?: string[];
  wave?: string;
  availabilityTypes?: string[]; // es. ['Public Preview', 'GA']
  enabledFor?: string;
  geography?: string;
  geographyCountries?: string[];
  language?: string;
  firstAvailableDate?: string;
  lastUpdatedDate?: string;
  availabilityDateFull?: string; // YYYY-MM-DD
  sourceUrl?: string | null;
  learnUrl?: string | null;
  url?: string | null;
};
```

### 1.3 Mapping Status

**Definire mapping status personalizzato:**

```typescript
// Esempio mapping Fabric
'Planned' → 'Planned'
'Shipped' → 'Launched'
'Public preview' (type) → 'Try now'

// Template per la tua fonte
'{Source Status 1}' → '{UpdateLens Status}'
'{Source Status 2}' → '{UpdateLens Status}'
```

**Statuses validi:** `'Planned'`, `'Rolling out'`, `'Try now'`, `'Launched'`, `'Unknown'`

### 1.4 Stima Complessità

**Calcolare punti complessità:**

| Fattore | Peso | Punteggio (1-3) | Note |
|---------|------|-----------------|------|
| Tipo fonte | x2 | API=1, Scraping=2, DB=2 | |
| Autenticazione | x1 | No=1, Basic=2, OAuth=3 | |
| Paginazione | x1 | No=1, Semplice=2, Complessa=3 | |
| Trasformazione dati | x2 | Diretta=1, Media=2, Complessa=3 | |
| Campi custom | x1 | 0-5=1, 6-10=2, 11+=3 | |
| **TOTALE** | | **[Somma pesata]** | |

**Stima ore:**
- **10-15 punti**: 10-15 ore
- **16-25 punti**: 15-20 ore
- **26+ punti**: 20-30 ore

---

## 2. Backend Development

### 2.1 Struttura Script Refresh

**Nome file:** `tools/refresh{SourceName}.ts`

**Template base:**

```typescript
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import * as cheerio from 'cheerio'; // Se web scraping
import { ReleaseItemSchema } from '../src/models/ReleaseItem';

// 1. COSTANTI
const SOURCE_URL = 'https://api.example.com/releases';
const PAGE_SIZE = 100; // Se paginato
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // ms

// 2. TIPI
type Raw{Source}Item = {
  // Definire struttura dati raw dalla fonte
  id: string;
  name: string;
  description: string;
  status: string;
  // ... altri campi
};

type Raw{Source}Response = {
  data: Raw{Source}Item[];
  pagination?: {
    page: number;
    total_pages: number;
    has_next: boolean;
  };
};

type ReleaseItem = {
  // Importare da ../src/models/ReleaseItem
};

type LatestManifest = {
  microsoft?: string;
  eos?: string;
  fabric?: string;
  {yourSource}?: string; // NUOVO
};

// 3. UTILITÀ DATE
const todayStamp = (): string => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}_${month}_${day}`;
};

const monthStamp = (): string => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const parseMonthDate = (dateStr: string): string => {
  // Implementare parsing specifico per formato fonte
  // Target: YYYY-MM
  if (!dateStr) return monthStamp();

  // Esempio: YYYY-MM-DD → YYYY-MM
  const [year, month] = dateStr.split('-');
  return `${year}-${month}`;
};

const parseDateFull = (dateStr: string): string | null => {
  // Validare e normalizzare a YYYY-MM-DD
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  return dateStr;
};

// 4. NORMALIZZAZIONE TESTO
const normalizeText = (value: string): string => {
  return value.replace(/\s+/g, ' ').trim();
};

const stripHtml = (value: string): string => {
  const $ = cheerio.load(value);
  return normalizeText($.text());
};

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

// 5. FETCH CON RETRY
async function fetchWithRetry(
  url: string,
  retries = MAX_RETRIES
): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'UpdateLens/1.0 (+data snapshot generator)',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    } catch (error) {
      console.warn(`[Refresh{Source}] Attempt ${attempt}/${retries} failed:`, error);

      if (attempt === retries) {
        throw error;
      }

      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
    }
  }

  throw new Error('Max retries exceeded');
}

// 6. FETCH DATI (GESTIONE PAGINAZIONE)
async function fetchAll{Source}Data(): Promise<Raw{Source}Item[]> {
  const allItems: Raw{Source}Item[] = [];
  let page = 1;
  let hasMore = true;

  console.log('[Refresh{Source}] Fetching data...');

  while (hasMore) {
    console.log(`[Refresh{Source}] Fetching page ${page}...`);

    const url = `${SOURCE_URL}?page=${page}&page_size=${PAGE_SIZE}`;
    const response = await fetchWithRetry(url);
    const payload: Raw{Source}Response = await response.json();

    allItems.push(...payload.data);

    // Controllare se ci sono più pagine
    hasMore = payload.pagination?.has_next ?? false;
    page++;

    // Safety: max 100 pagine
    if (page > 100) {
      console.warn('[Refresh{Source}] Max pages limit reached');
      break;
    }
  }

  console.log(`[Refresh{Source}] Fetched ${allItems.length} items across ${page - 1} pages`);
  return allItems;
}

// 7. TRASFORMAZIONE DATI
function buildStatus(raw: Raw{Source}Item): ReleaseItem['status'] {
  // Implementare mapping specifico status
  // IMPORTANTE: Seguire la logica di priorità

  // Esempio:
  if (raw.status === 'in_preview') return 'Try now';
  if (raw.status === 'released') return 'Launched';
  if (raw.status === 'planned') return 'Planned';

  console.warn(`[Refresh{Source}] Unknown status: ${raw.status} for item ${raw.id}`);
  return 'Unknown';
}

function buildAvailabilityTypes(raw: Raw{Source}Item): string[] {
  // Estrarre availability types se applicabile
  const types: string[] = [];

  // Esempio:
  if (raw.preview_date) types.push('Public Preview');
  if (raw.ga_date) types.push('GA');

  return types;
}

function extractItems(rawItems: Raw{Source}Item[]): ReleaseItem[] {
  const validItems: ReleaseItem[] = [];
  const skippedIds: string[] = [];

  rawItems.forEach((raw) => {
    try {
      // Validare campi obbligatori
      if (!raw.id || !raw.name) {
        skippedIds.push(raw.id ?? 'unknown');
        return;
      }

      // Costruire ReleaseItem
      const item: ReleaseItem = {
        id: `{source}-${raw.id}`, // Prefisso univoco fonte
        source: '{YourSource}', // Nome fonte
        product: raw.product_name ?? '{Default Product}',
        productName: raw.product_name ?? '{Default Product}',
        productId: `{SOURCE}:${raw.product_id}`,
        title: normalizeText(raw.name),
        summary: stripHtml(raw.description ?? ''),
        description: stripHtml(raw.description ?? ''),
        status: buildStatus(raw),
        availabilityDate: parseMonthDate(raw.release_date),
        availabilityDateFull: parseDateFull(raw.release_date),
        releaseDate: parseDateFull(raw.release_date) ??
                     new Date().toISOString().slice(0, 10),
        tryNow: buildStatus(raw) === 'Try now',
        minBcVersion: null, // o calcolare se applicabile

        // Campi opzionali
        category: raw.category,
        tags: raw.tags,
        availabilityTypes: buildAvailabilityTypes(raw),
        firstAvailableDate: parseDateFull(raw.first_available),
        lastUpdatedDate: parseDateFull(raw.last_modified),
        sourceUrl: `https://source.com/item/${raw.id}`,
        learnUrl: raw.documentation_url ?? null,
        url: `https://source.com/item/${raw.id}`
      };

      // Validare con Zod schema
      const validated = ReleaseItemSchema.parse(item);
      validItems.push(validated);

    } catch (error) {
      console.warn(`[Refresh{Source}] Skipped invalid item ${raw.id}:`, error);
      skippedIds.push(raw.id);
    }
  });

  if (skippedIds.length > 0) {
    console.warn(`[Refresh{Source}] Skipped ${skippedIds.length} invalid items:`, skippedIds.slice(0, 10));
  }

  return validItems;
}

// 8. MANIFEST MANAGEMENT
const readManifest = async (filePath: string): Promise<LatestManifest> => {
  try {
    const raw = await readFile(filePath, 'utf-8');
    return JSON.parse(raw) as LatestManifest;
  } catch {
    return {};
  }
};

const writeManifest = async (
  filePath: string,
  updates: Partial<LatestManifest>
): Promise<void> => {
  const current = await readManifest(filePath);
  const next = { ...current, ...updates };
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(next, null, 2), 'utf-8');
};

// 9. MAIN FUNCTION
async function run(): Promise<void> {
  try {
    // 1. Fetch dati
    const rawItems = await fetchAll{Source}Data();

    // 2. Trasforma items
    const items = extractItems(rawItems);

    if (items.length === 0) {
      throw new Error('No valid items extracted');
    }

    // 3. Crea snapshot
    const snapshot = {
      version: 1,
      items
    };

    // 4. Genera filename con timestamp
    const filename = `{source}_data_${todayStamp()}.json`;

    // 5. Scrivi snapshot in entrambe le locations
    const snapshotsPath = path.resolve('src', 'data', 'snapshots', filename);
    const publicPath = path.resolve('public', 'data', filename);

    await mkdir(path.dirname(snapshotsPath), { recursive: true });
    await mkdir(path.dirname(publicPath), { recursive: true });

    const content = JSON.stringify(snapshot, null, 2);
    await writeFile(snapshotsPath, content, 'utf-8');
    await writeFile(publicPath, content, 'utf-8');

    // 6. Aggiorna manifest files
    await writeManifest(
      path.resolve('public', 'data', 'latest.json'),
      { {yourSource}: filename }
    );
    await writeManifest(
      path.resolve('src', 'data', 'snapshots', 'latest.json'),
      { {yourSource}: filename }
    );

    // 7. Log successo
    console.log(`[Refresh{Source}] ✓ Snapshot saved: ${snapshotsPath}`);
    console.log(`[Refresh{Source}] ✓ Total items: ${items.length}`);
    console.log(`[Refresh{Source}] ✓ Manifest updated`);

  } catch (error) {
    console.error('[Refresh{Source}] ✗ Error:', error);
    process.exitCode = 1;
  }
}

// 10. ESEGUI
run();
```

### 2.2 Aggiornare package.json

```json
{
  "scripts": {
    "refresh:{source}": "tsx tools/refresh{Source}.ts"
  }
}
```

### 2.3 Checklist Backend

- [ ] Script refresh creato in `tools/refresh{Source}.ts`
- [ ] Gestione paginazione implementata (se applicabile)
- [ ] Retry logic per errori API
- [ ] Parsing e normalizzazione date
- [ ] Mapping status completato
- [ ] Validazione Zod schema
- [ ] Skip items invalidi con logging
- [ ] Generazione snapshot in entrambe le location
- [ ] Aggiornamento manifest files
- [ ] Logging informativo (INFO, WARN, ERROR)
- [ ] Script NPM aggiunto al package.json
- [ ] Testato manualmente con `npm run refresh:{source}`

---

## 3. Frontend Development

### 3.1 Aggiornamento Schema

**File:** `src/models/ReleaseItem.ts`

```typescript
// Aggiungere nuovo source all'enum
export const ReleaseSourceSchema = z.enum([
  'Microsoft',
  'EOS',
  'Fabric',
  '{YourSource}' // NUOVO
]);

export type ReleaseSource = z.infer<typeof ReleaseSourceSchema>;
```

### 3.2 Aggiornamento DataLoader

**File:** `src/services/DataLoader.ts`

**Modifiche necessarie:**

```typescript
// 1. Aggiornare tipo LatestSnapshots
type LatestSnapshots = {
  microsoft?: string;
  eos?: string;
  fabric?: string;
  {yourSource}?: string; // NUOVO
};

// 2. Aggiungere loading in loadAllSnapshots()
const {yourSource} = await loadSnapshotWithFallback(
  '{YourSource}',
  isFileProtocol ? undefined : manifest?.{yourSource},
  '{source}_data_' // Prefisso filename
);

const items: ReleaseItem[] = [
  ...microsoft.items,
  ...eos.items,
  ...fabric.items,
  ...{yourSource}.items // NUOVO
];

const errors = [
  microsoft.error,
  eos.error,
  fabric.error,
  {yourSource}.error // NUOVO
].filter(Boolean) as string[];

// 3. Aggiungere logica parsing in parseSnapshot()
if (item.source === '{YourSource}') {
  const normalized = {
    ...item,
    productName: item.product,
    description: item.summary,
    releaseDate: item.availabilityDateFull ||
                 toIsoDateFromMonth(item.availabilityDate) ||
                 new Date().toISOString().slice(0, 10),
    tryNow: item.status === 'Try now',
    minBcVersion: null // o logica custom
  };

  const parsed = ReleaseItemSchema.parse(normalized);

  return {
    ...parsed,
    sourceUrl: resolveSourceUrl(parsed),
    learnUrl: parsed.learnUrl && isValidHttpUrl(parsed.learnUrl)
              ? parsed.learnUrl
              : null
  };
}

// 4. Aggiornare resolveSourceUrl()
if (item.source === '{YourSource}') {
  const sourceId = item.id.replace('{source}-', '');
  return `https://source.com/item/${sourceId}`;
}
```

### 3.3 Aggiornamento Filter Definitions

**File:** `src/services/FilterDefinitions.ts`

```typescript
// 1. Aggiornare SourceKey type
export type SourceKey = 'microsoft' | 'eos' | 'fabric' | '{yourSource}';

// 2. Aggiungere a ALL_RELEASE_SOURCES
export const ALL_RELEASE_SOURCES: ReleaseSource[] = [
  'Microsoft',
  'EOS',
  'Fabric',
  '{YourSource}' // NUOVO
];

// 3. Aggiungere label
export const RELEASE_SOURCE_LABELS: Record<ReleaseSource, string> = {
  Microsoft: 'Microsoft Release Plans',
  EOS: 'EOS Apps',
  Fabric: 'Microsoft Fabric Roadmap',
  '{YourSource}': '{Display Name}' // NUOVO
};

// 4. Definire filter capabilities
export const FILTER_CAPABILITIES: Record<SourceKey, FilterKey[]> = {
  // ... existing
  {yourSource}: [
    'status',
    'categories',
    'productOrApp',
    'availabilityType',
    'releaseDateRange',
    'periodNewDays',
    'periodChangedDays',
    'releaseInDays',
    'months',
    'tags',
    'query',
    'sortOrder',
    'historyMonths',
    'horizonMonths'
    // Aggiungere/rimuovere in base a supporto effettivo
  ]
};

// 5. Aggiornare toSourceKey()
export const toSourceKey = (source: ReleaseSource): SourceKey => {
  if (source === 'Microsoft') return 'microsoft';
  if (source === 'EOS') return 'eos';
  if (source === 'Fabric') return 'fabric';
  return '{yourSource}'; // NUOVO
};
```

### 3.4 Product Colors

**File:** `src/utils/productColors.ts`

**Scegliere famiglia di colori distintiva:**

| Fonte | Colore Famiglia | Esempio |
|-------|-----------------|---------|
| Microsoft | Blue | `bg-blue-600` |
| EOS | Amber | `bg-amber-600` |
| Fabric | Teal/Cyan | `bg-teal-600` |
| **{YourSource}** | **[Scegliere]** | **`bg-{color}-600`** |

**Opzioni suggerite:** Purple, Green, Pink, Indigo, Rose

**Aggiungere colori per prodotti/categorie:**

```typescript
export const PRODUCT_COLOR_MAP: Record<string, ProductColorConfig> = {
  // ... existing colors

  // {YourSource} products (tema {color})
  '{Product Name 1}': {
    barClass: 'bg-{color}-500/90 dark:bg-{color}-400',
    badgeClass: 'bg-{color}-50 text-{color}-800 dark:bg-{color}-500/20 dark:text-{color}-200'
  },
  '{Product Name 2}': {
    barClass: 'bg-{color}-600/90 dark:bg-{color}-500',
    badgeClass: 'bg-{color}-50 text-{color}-900 dark:bg-{color}-600/20 dark:text-{color}-100'
  },
  // ... altri prodotti con variazioni di shade
};
```

### 3.5 Dashboard UI

**File:** `src/app/pages/DashboardPage.tsx`

**Aggiungere KPI card:**

```typescript
// Dopo le altre KPI cards
<button
  className={`ul-surface p-5 text-left transition-all hover:ring-2 hover:ring-{color}-500/50 ${
    drillSource === '{YourSource}' ? 'ring-2 ring-{color}-500' : ''
  }`}
  onClick={() => handleDrillSource('{YourSource}')}
>
  <div className="text-xs uppercase text-muted-foreground">{Display Name}</div>
  <div className="mt-3 text-3xl font-semibold text-{color}-600">
    {filteredItems.filter((item) => item.source === '{YourSource}').length}
  </div>
  {drillSource === '{YourSource}' && drillProduct && (
    <div className="mt-1 text-xs text-muted-foreground">
      Prodotto: {drilledItems.length}
    </div>
  )}
</button>
```

**Aggiornare grid layout:**

```typescript
// Incrementare numero colonne (da N a N+1)
<section className="mt-6 grid gap-4 md:grid-cols-{N+1}">
```

### 3.6 Checklist Frontend

- [ ] ReleaseSourceSchema aggiornato
- [ ] DataLoader: LatestSnapshots type aggiornato
- [ ] DataLoader: loadAllSnapshots() aggiornato
- [ ] DataLoader: parseSnapshot() logic aggiunta
- [ ] DataLoader: resolveSourceUrl() aggiornato
- [ ] FilterDefinitions: SourceKey aggiornato
- [ ] FilterDefinitions: ALL_RELEASE_SOURCES aggiornato
- [ ] FilterDefinitions: RELEASE_SOURCE_LABELS aggiornato
- [ ] FilterDefinitions: FILTER_CAPABILITIES definito
- [ ] FilterDefinitions: toSourceKey() aggiornato
- [ ] Product colors definiti (famiglia colori scelta)
- [ ] Dashboard KPI card aggiunta
- [ ] Dashboard grid layout aggiornato
- [ ] Responsive design testato (mobile/tablet/desktop)

---

## 4. Configurazione

### 4.1 Products Catalog

**File:** `src/data/config/products.catalog.json`

```json
{
  "version": 1,
  "items": [
    // ... existing items
    {
      "id": "{source}-{product-slug}",
      "label": "{Product Display Name}",
      "source": "{YourSource}",
      "category": "{Your Category}"
    }
    // Aggiungere entry per ogni prodotto/categoria
  ],
  "categories": [
    "Dynamics 365",
    "Power Platform",
    "EOS",
    "Microsoft Fabric",
    "{Your Category}" // NUOVO
  ],
  "tags": []
}
```

### 4.2 Rules Config

**File:** `src/data/config/rules.json`

```json
{
  "version": 1,
  "defaults": {
    "sources": [
      "Microsoft",
      "EOS",
      "Fabric",
      "{YourSource}" // NUOVO
    ],
    "statuses": ["Planned", "Rolling out", "Try now", "Launched", "Unknown"],
    "horizonMonths": 120,
    "historyMonths": 120
  }
}
```

### 4.3 Environment Variables (Opzionale)

**File:** `.env` (creare se necessario)

```bash
# {YourSource} Configuration
{SOURCE}_API_URL=https://api.example.com/v1
{SOURCE}_API_KEY=your_key_here
{SOURCE}_PAGE_SIZE=100
{SOURCE}_CRON=0 */6 * * *  # If automated refresh
```

**Caricare in script:**

```typescript
import dotenv from 'dotenv';
dotenv.config();

const SOURCE_URL = process.env.{SOURCE}_API_URL || 'default_url';
const API_KEY = process.env.{SOURCE}_API_KEY;
```

### 4.4 Checklist Configurazione

- [ ] Products catalog aggiornato con nuovi prodotti
- [ ] Categoria aggiunta a categories array
- [ ] Rules config aggiornato con nuovo source
- [ ] Environment variables definite (se necessarie)
- [ ] .env.example aggiornato con variabili template

---

## 5. Testing & QA

### 5.1 Testing Backend

**Test Script Refresh:**

```bash
# 1. Eseguire refresh
npm run refresh:{source}

# Verificare output console:
# ✓ Nessun errore
# ✓ Log fetch pagine
# ✓ Log items processati
# ✓ Log snapshot salvati
# ✓ Log manifest aggiornati
```

**Verificare file generati:**

```bash
# Check snapshot files esistono
ls -lh public/data/{source}_data_*.json
ls -lh src/data/snapshots/{source}_data_*.json

# Verificare manifest aggiornati
cat public/data/latest.json | jq '.{yourSource}'
cat src/data/snapshots/latest.json | jq '.{yourSource}'

# Validare struttura snapshot
cat public/data/{source}_data_*.json | jq '.version, .items | length'

# Ispezionare sample item
cat public/data/{source}_data_*.json | jq '.items[0]'
```

**Test edge cases:**

```typescript
// 1. API error handling
// Modificare URL a valore invalido, verificare graceful failure

// 2. Missing fields
// Verificare che items con campi mancanti vengano skippati con warning

// 3. Invalid data
// Verificare validazione Zod schema

// 4. Paginazione completa
// Verificare che tutte le pagine siano fetched (check count)
```

**Checklist Backend Testing:**

- [ ] Refresh script esegue senza errori
- [ ] Tutti gli items attesi sono fetchati
- [ ] Snapshot creati in entrambe le location
- [ ] Manifest files aggiornati correttamente
- [ ] Items invalidi skippati con warning
- [ ] Nessun errore Zod validation
- [ ] Campi obbligatori tutti presenti
- [ ] Date in formato corretto (YYYY-MM, YYYY-MM-DD)
- [ ] IDs univoci con prefisso corretto
- [ ] URLs validi (sourceUrl, learnUrl)

### 5.2 Testing Frontend

**Avviare dev server:**

```bash
npm run dev
# Aprire http://localhost:5173 (o porta configurata)
```

**Test in Browser:**

**1. Caricamento Dati:**
- [ ] Dashboard carica senza errori console
- [ ] Snapshot {source} caricato (check Network tab)
- [ ] Nessun errore Zod validation
- [ ] Items {source} inclusi in totale

**2. KPI Cards:**
- [ ] Card {source} visibile
- [ ] Count corretto
- [ ] Colore distintivo (famiglia scelta)
- [ ] Click card → drill-down funziona
- [ ] Breakdown prodotti mostrato

**3. Rendering Items:**
- [ ] Barra laterale colore corretto
- [ ] Badge prodotto con colori definiti
- [ ] Titolo e description renderizzati
- [ ] Status badge corretto
- [ ] Date formattate correttamente
- [ ] Link "Vai alla fonte" funziona
- [ ] Link "Documentazione" funziona (se presente)

**4. Filtri:**
- [ ] Filtro Source → checkbox {source} funziona
- [ ] Filtro Product → mostra prodotti {source}
- [ ] Filtro Category → mostra categorie {source}
- [ ] Filtro Status → funziona con items {source}
- [ ] Filtro Availability Type → funziona (se applicabile)
- [ ] Search query → trova items {source}
- [ ] Filtri date range → filtrano items {source}
- [ ] Sorting → ordina items {source} correttamente

**5. Cross-Source:**
- [ ] Total count = somma tutte fonti (incluso {source})
- [ ] Multi-source filter funziona
- [ ] Colori distinti per tutte le fonti
- [ ] Drill-down funziona su tutte le fonti
- [ ] Sorting cross-source corretto

**Validazione dati console:**

```javascript
// Aprire console browser dopo caricamento

// 1. Check items caricati
const {source}Items = items.filter(i => i.source === '{YourSource}');
console.log('{YourSource} items:', {source}Items.length);

// 2. Verifica campi required
const missingFields = {source}Items.filter(i =>
  !i.id || !i.title || !i.summary || !i.status || !i.availabilityDate
);
console.log('Items con campi mancanti:', missingFields.length); // Dovrebbe essere 0

// 3. Verifica date format
const invalidDates = {source}Items.filter(i =>
  !/^\d{4}-\d{2}$/.test(i.availabilityDate)
);
console.log('Items con date invalide:', invalidDates.length); // Dovrebbe essere 0

// 4. Status distribution
const statuses = {source}Items.reduce((acc, i) => {
  acc[i.status] = (acc[i.status] || 0) + 1;
  return acc;
}, {});
console.log('Status distribution:', statuses);

// 5. Product/Category distribution
const products = {source}Items.reduce((acc, i) => {
  acc[i.productName] = (acc[i.productName] || 0) + 1;
  return acc;
}, {});
console.log('Product distribution:', products);

// 6. Verifica URLs
const brokenUrls = {source}Items.filter(i =>
  !i.sourceUrl || !i.sourceUrl.startsWith('http')
);
console.log('Items con URL broken:', brokenUrls.length); // Dovrebbe essere 0
```

**Checklist Frontend Testing:**

- [ ] Dashboard si carica senza errori
- [ ] KPI card {source} visualizzata correttamente
- [ ] Items {source} renderizzati con colori corretti
- [ ] Tutti i filtri funzionano con items {source}
- [ ] Drill-down funziona
- [ ] Links validi e clickabili
- [ ] Responsive su mobile/tablet/desktop
- [ ] Nessun warning/errore in console
- [ ] Validazione dati in console OK

### 5.3 Testing Regressione

**Verificare che fonti esistenti funzionino ancora:**

- [ ] Microsoft Release Plans carica correttamente
- [ ] EOS What's New carica correttamente
- [ ] Fabric (se integrato) carica correttamente
- [ ] KPI cards esistenti inalterati
- [ ] Filtri fonti esistenti inalterati
- [ ] Colori fonti esistenti inalterati
- [ ] Drill-down fonti esistenti funziona
- [ ] Export Markdown include tutte le fonti
- [ ] Performance non degradata

**Metriche Performance:**

```bash
# Misurare performance refresh
time npm run refresh:{source}
# Target: < 2 minuti

# Misurare performance frontend (Chrome DevTools)
# Dashboard load time: < 3 secondi
# Filter change response: < 500ms
# Search query response: < 1 secondo
```

---

## 6. Deployment

### 6.1 Generazione Snapshot Iniziale

```bash
# 1. Generare snapshot
npm run refresh:{source}

# 2. Verificare generazione corretta
ls -lh public/data/{source}_data_*.json
cat public/data/latest.json | jq

# 3. Verificare dimensione file
du -h public/data/{source}_data_*.json
# Se > 5MB, considerare ottimizzazioni (rimuovere campi non necessari)
```

### 6.2 Git Commit

**Commit Message Template:**

```bash
git add .
git commit -m "feat: Add {Source Name} integration

- Add refresh{Source}.ts script to fetch from {API/source}
- Update DataLoader to load {source} snapshots
- Add {source} source filter and UI components
- Add {N} {source} product colors ({color} theme)
- Update products catalog and filter definitions
- Include initial {source} snapshot with {N} items

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### 6.3 README Update

**File:** `README.md`

**Template sezione da aggiungere:**

```markdown
## Data Sources

UpdateLens aggregates release information from {N} sources:

{...existing sources...}

{N}. **{Source Display Name}** ({Source URL})
   - {Brief description of what this source provides}
   - Source: {API endpoint / website URL}
   - Refresh: {Manual via npm run refresh:{source} / Automated every Xh}
   - Items: ~{N} features/releases

## Scripts

### Data Refresh

{...existing scripts...}
- `npm run refresh:{source}` - Fetch latest {Source Name}
```

### 6.4 Documentation Updates

**Aggiungere note su:**

- Nuova fonte dati e cosa copre
- Refresh frequency e procedure
- Campi specifici disponibili
- Limitazioni o note particolari
- Link a documentazione fonte ufficiale

### 6.5 Checklist Deployment

- [ ] Snapshot iniziale generato e committato
- [ ] README aggiornato con nuova fonte
- [ ] Commit creato con messaggio descrittivo
- [ ] Push a remote repository
- [ ] PR creata (se workflow con PR)
- [ ] Code review completata
- [ ] CI/CD pipeline passa (se configurata)
- [ ] Deployment staging testato
- [ ] Deployment production eseguito
- [ ] Monitoring post-deployment (verificare logs, errori)
- [ ] Documentazione utente aggiornata (se applicabile)

---

## 7. Decision Tree

### 7.1 SQLite Database vs Solo JSON

**Usa SQLite Database quando:**
- ✅ Serve change history tracking
- ✅ Serve esporre API server endpoints
- ✅ Refresh automatico con cron job
- ✅ Volume dati molto elevato (>10k items)
- ✅ Query complesse su dati storici

**Usa Solo JSON Snapshots quando:**
- ✅ Fonte ha pochi items (<5k)
- ✅ Refresh manuale è accettabile
- ✅ Non serve change tracking
- ✅ Implementazione rapida prioritaria
- ✅ Frontend consuma direttamente snapshots

**Pattern di riferimento:**
- **Microsoft Release Plans**: SQLite + JSON (change history, API server)
- **EOS What's New**: Solo JSON (semplice, manuale)
- **Fabric Roadmap**: Solo JSON (manuale, senza change tracking)

### 7.2 Refresh Manuale vs Automatico

**Manuale (`npm run refresh:{source}`):**
- ✅ Controllo completo su quando refreshare
- ✅ Nessuna complessità scheduling
- ✅ Ideale per fonti poco frequenti
- ❌ Richiede intervento manuale

**Automatico (cron job):**
- ✅ Dati sempre aggiornati
- ✅ Nessun intervento manuale
- ✅ Ideale per fonti frequenti
- ❌ Richiede server o CI/CD setup
- ❌ Più complesso debugging

**Implementazione cron job (se automatico):**

```typescript
// server/scheduler.ts
import cron from 'node-cron';
import { exec } from 'child_process';

const REFRESH_CRON = process.env.{SOURCE}_CRON || '0 */6 * * *'; // Every 6 hours

cron.schedule(REFRESH_CRON, () => {
  console.log('[Scheduler] Running {source} refresh...');
  exec('npm run refresh:{source}', (error, stdout, stderr) => {
    if (error) {
      console.error('[Scheduler] Refresh failed:', error);
      return;
    }
    console.log('[Scheduler] Refresh completed:', stdout);
  });
});
```

### 7.3 Scelta Colore UI

**Regola: Evitare conflitti con fonti esistenti**

| Colore | Usato da | Disponibile |
|--------|----------|-------------|
| Blue | Microsoft | ❌ |
| Amber/Yellow | EOS | ❌ |
| Teal/Cyan | Fabric | ❌ |
| **Purple** | - | ✅ |
| **Green** | - | ✅ |
| **Pink/Rose** | - | ✅ |
| **Indigo** | - | ✅ |
| **Orange** | - | ✅ |

**Verificare contrasto accessibilità:**
- Light mode: testo dark su background light
- Dark mode: testo light su background dark
- WCAG AA standard: contrast ratio ≥ 4.5:1

### 7.4 Gestione Conflitti Nome Prodotti

**Scenario:** Stesso prodotto in fonti diverse (es. "Power BI" in Microsoft e Fabric)

**Soluzione implementata:**
- `productSourceMap` in FilterService scopa prodotti per fonte
- ProductId con prefisso univoco: `{SOURCE}:{id}`
- UI mostra source badge quando multiple sources attive

**Best practice:**
- Normalizzare product names con `normalizeProductLabel()`
- Usare productId univoco invece di productName per filtering
- Mostrare source indicator in UI quando ambiguo

---

## 8. Esempi di Riferimento

### 8.1 Confronto Fonti Esistenti

| Aspetto | Microsoft | EOS | Fabric |
|---------|-----------|-----|--------|
| **Tipo fonte** | API REST + OData | Web Scraping | API REST (Fabric GPS) |
| **Auth** | No | No | No |
| **Paginazione** | OData $skip/$top | No | Page number |
| **Items** | ~2000 | ~50 | ~847 |
| **Refresh** | Automatico (6h) | Manuale | Manuale |
| **Storage** | SQLite + JSON | Solo JSON | Solo JSON |
| **Campi** | 19 | 11 | 15 |
| **Complessità** | Alta | Bassa | Media |
| **Tempo dev** | ~20h | ~10h | ~15h |

### 8.2 File di Riferimento

**Backend:**
- [tools/refreshMicrosoft.ts](../tools/refreshMicrosoft.ts) - Esempio complesso (API + OData, SQLite)
- [tools/refreshEos.ts](../tools/refreshEos.ts) - Esempio semplice (Web scraping, solo JSON)
- [tools/refreshFabric.ts](../tools/refreshFabric.ts) - Esempio medio (API REST, paginazione, solo JSON)

**Frontend:**
- [src/services/DataLoader.ts](../src/services/DataLoader.ts) - Loading snapshots, parsing
- [src/services/FilterDefinitions.ts](../src/services/FilterDefinitions.ts) - Source labels, capabilities
- [src/utils/productColors.ts](../src/utils/productColors.ts) - Color theming
- [src/app/pages/DashboardPage.tsx](../src/app/pages/DashboardPage.tsx) - KPI cards, UI

**Config:**
- [src/data/config/products.catalog.json](../src/data/config/products.catalog.json) - Product definitions
- [src/data/config/rules.json](../src/data/config/rules.json) - Default filter rules

**Schema:**
- [src/models/ReleaseItem.ts](../src/models/ReleaseItem.ts) - ReleaseItem type e Zod schema

### 8.3 Pattern Comuni

**Retry Logic:**
```typescript
// Vedere refreshFabric.ts per implementazione completa
async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fetch(url);
    } catch (error) {
      if (i === retries - 1) throw error;
      await sleep(2000 * (i + 1)); // Exponential backoff
    }
  }
}
```

**Paginazione Cursor-based:**
```typescript
let cursor = null;
while (cursor !== undefined) {
  const url = `${API_URL}${cursor ? `?cursor=${cursor}` : ''}`;
  const data = await fetch(url).then(r => r.json());
  items.push(...data.items);
  cursor = data.next_cursor; // null quando fine
}
```

**Paginazione Offset-based:**
```typescript
let offset = 0;
const limit = 100;
while (true) {
  const data = await fetch(`${API_URL}?offset=${offset}&limit=${limit}`);
  items.push(...data.results);
  if (data.results.length < limit) break;
  offset += limit;
}
```

---

## 9. Troubleshooting

### Problemi Comuni & Soluzioni

**1. Snapshot non si genera**
- ✓ Verificare che API sia raggiungibile: `curl {API_URL}`
- ✓ Verificare autenticazione (se richiesta)
- ✓ Controllare errori in console log
- ✓ Verificare permessi scrittura cartelle

**2. Items non validano con Zod**
- ✓ Ispezionare sample item raw: `console.log(rawItem)`
- ✓ Verificare mapping campi obbligatori
- ✓ Controllare formato date (deve essere YYYY-MM)
- ✓ Verificare status values validi

**3. Frontend non carica snapshot**
- ✓ Verificare latest.json contiene chiave {source}
- ✓ Verificare filename snapshot corretto
- ✓ Controllare console browser per errori
- ✓ Verificare Vite include snapshot in build

**4. Colori UI non appaiono**
- ✓ Verificare Tailwind config include nuove classi
- ✓ Rebuild frontend: `npm run build`
- ✓ Clear cache browser (Ctrl+Shift+R)
- ✓ Verificare productName match esatto in PRODUCT_COLOR_MAP

**5. Filtri non funzionano**
- ✓ Verificare FILTER_CAPABILITIES include filter key
- ✓ Verificare toSourceKey() include nuovo source
- ✓ Verificare items hanno campi filtrabili popolati
- ✓ Controllare FilterService logic per nuovo source

**6. Performance lenta**
- ✓ Ridurre dimensione snapshot (rimuovere campi non necessari)
- ✓ Ottimizzare paginazione (page size più grande)
- ✓ Implementare caching (ETag, conditional requests)
- ✓ Lazy loading items nel frontend

---

## 10. Metriche di Successo

**Completamento integrazione verificato quando:**

✅ Backend:
- Script refresh esegue senza errori
- Snapshot generati in entrambe le location
- Manifest files aggiornati
- Logging informativo e chiaro
- NPM script funzionante

✅ Frontend:
- Dashboard carica con nuova fonte
- KPI card visibile e funzionante
- Items renderizzati con colori corretti
- Tutti i filtri supportati funzionano
- Links validi e clickabili

✅ Quality:
- Nessun errore validazione Zod
- Nessuna regressione fonti esistenti
- Performance accettabile
- Codice commentato e leggibile

✅ Documentazione:
- README aggiornato
- Template checklist completate
- Commit descrittivo

**Tempo stimato totale:** 10-15 ore (vs 15-20h senza template)
**Risparmio:** ~25-30% tempo di sviluppo

---

## 11. Changelog Template

Quando aggiorni questo documento, registra le modifiche:

### v1.1 - {YYYY-MM-DD} - {Author}
- {Aggiunta/Modifica/Rimozione} {descrizione}
- Basato su integrazione {Source Name}
- {Note particolari}

### v1.0 - 2026-01-22 - Claude Sonnet 4.5
- Versione iniziale del template
- Basato su integrazioni: Microsoft, EOS, Fabric
- Include 7 sezioni principali: Pre-integration, Backend, Frontend, Config, Testing, Deployment, Decision Tree

---

## 12. Supporto

**Domande?** Consulta:
- Piano Fabric: [C:\Users\ALEVANTINI\.claude\plans\quirky-stargazing-walrus.md]
- File di riferimento: Sezione 8.2
- Pattern comuni: Sezione 8.3
- Troubleshooting: Sezione 9

**Contributi:** Questo template è vivo. Miglioralo dopo ogni integrazione!

---

**Fine Template** ✨
