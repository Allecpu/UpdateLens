# UpdateLens - Architettura e Struttura

## Indice

1. [Panoramica](#panoramica)
2. [Architettura Generale](#architettura-generale)
3. [Struttura Cartelle](#struttura-cartelle)
4. [Componenti Principali](#componenti-principali)
5. [Flusso Dati](#flusso-dati)
6. [Gestione Stato](#gestione-stato)
7. [Persistenza](#persistenza)
8. [Integrazione Fonti Dati](#integrazione-fonti-dati)
9. [Build e Deployment](#build-e-deployment)

---

## Panoramica

UpdateLens è un'applicazione **offline-first** costruita con:
- **Frontend**: React + TypeScript + Vite
- **State Management**: Zustand
- **Styling**: Tailwind CSS
- **Validation**: Zod
- **Backend (opzionale)**: Express + SQLite

### Caratteristiche Architetturali

- ✅ **Offline-first**: Funziona senza connessione internet
- ✅ **File Protocol Support**: Può essere aperto direttamente da `file://`
- ✅ **Zero Dependencies Runtime**: Nessun backend obbligatorio
- ✅ **LocalStorage Persistence**: Tutti i dati utente in localStorage
- ✅ **Multi-Source**: 4 fonti dati integrate (Microsoft, EOS, Fabric, M365)
- ✅ **Multi-Client**: Gestione configurazioni per più clienti

---

## Architettura Generale

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              React Application                         │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │  │
│  │  │  Dashboard   │  │   Clients    │  │   Issues    │ │  │
│  │  │     Page     │  │     Page     │  │    Page     │ │  │
│  │  └──────────────┘  └──────────────┘  └─────────────┘ │  │
│  │         │                  │                  │        │  │
│  │         └──────────────────┴──────────────────┘        │  │
│  │                           │                             │  │
│  │                  ┌────────▼────────┐                    │  │
│  │                  │  Zustand Store  │                    │  │
│  │                  └────────┬────────┘                    │  │
│  │                           │                             │  │
│  │         ┌─────────────────┼─────────────────┐          │  │
│  │         │                 │                 │           │  │
│  │    ┌────▼────┐      ┌────▼────┐      ┌────▼────┐      │  │
│  │    │  Data   │      │ Filter  │      │ Storage │      │  │
│  │    │ Loader  │      │ Service │      │ Service │      │  │
│  │    └────┬────┘      └─────────┘      └────┬────┘      │  │
│  │         │                                  │            │  │
│  └─────────┼──────────────────────────────────┼───────────┘  │
│            │                                  │               │
│     ┌──────▼──────┐                  ┌───────▼────────┐     │
│     │  Snapshot   │                  │  LocalStorage  │     │
│     │   Files     │                  │                │     │
│     │  (JSON)     │                  │  - Customers   │     │
│     └─────────────┘                  │  - Filters     │     │
│                                      │  - GitHub PAT  │     │
│                                      └────────────────┘     │
└─────────────────────────────────────────────────────────────┘

Optional Backend (Web Mode)
┌─────────────────────────────────────────────────────────────┐
│                    Express Server                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   GitHub     │  │  Release     │  │   SQLite     │      │
│  │   Proxy      │  │  Plans API   │  │   Database   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

---

## Struttura Cartelle

```
UpdateLens/
├── src/                          # Codice sorgente frontend
│   ├── app/                      # Componenti React
│   │   ├── components/           # Componenti riutilizzabili
│   │   │   ├── CustomerSelector.tsx
│   │   │   ├── FilterSidebar.tsx
│   │   │   ├── ReleaseCard.tsx
│   │   │   ├── ExportModal.tsx
│   │   │   ├── GitHubTokenModal.tsx
│   │   │   ├── IssueCreateModal.tsx
│   │   │   └── ...
│   │   └── pages/                # Pagine principali
│   │       ├── DashboardPage.tsx
│   │       ├── ClientsPage.tsx
│   │       ├── GlobalFiltersPage.tsx
│   │       ├── IssuesPage.tsx
│   │       └── VersionPage.tsx
│   │
│   ├── data/                     # Dati statici
│   │   ├── config/               # Configurazioni
│   │   │   ├── products.catalog.json
│   │   │   └── rules.json
│   │   └── snapshots/            # Snapshot dati (dev)
│   │       ├── latest.json
│   │       ├── microsoft_releaseplans_*.json
│   │       ├── eos_whatsnew_*.json
│   │       ├── fabric_roadmap_*.json
│   │       └── m365roadmap_data_*.json
│   │
│   ├── models/                   # Zod schemas e TypeScript types
│   │   ├── ReleaseItem.ts
│   │   ├── Customer.ts
│   │   ├── FilterState.ts
│   │   └── ...
│   │
│   ├── services/                 # Business logic
│   │   ├── DataLoader.ts         # Caricamento snapshot
│   │   ├── FilterService.ts      # Logica filtri
│   │   ├── FilterDefinitions.ts  # Definizioni filtri per fonte
│   │   ├── ExportService.ts      # Export Markdown
│   │   ├── StorageService.ts     # Persistenza LocalStorage
│   │   ├── GitHubService.ts      # Integrazione GitHub
│   │   └── ...
│   │
│   ├── utils/                    # Utility functions
│   │   ├── productColors.ts
│   │   ├── dateUtils.ts
│   │   ├── textUtils.ts
│   │   └── ...
│   │
│   ├── App.tsx                   # Root component
│   ├── main.tsx                  # Entry point
│   ├── index.css                 # Global styles
│   └── version.ts                # Version info
│
├── tools/                        # Script refresh dati
│   ├── refreshMicrosoft.ts
│   ├── refreshEos.ts
│   ├── refreshFabric.ts
│   ├── refreshM365Roadmap.ts
│   ├── inlineReleaseAssets.ts    # Build release
│   └── ...
│
├── server/                       # Backend opzionale
│   ├── api.ts                    # API routes
│   ├── db.ts                     # Database setup
│   ├── ingest.ts                 # Ingestion script
│   ├── scheduler.ts              # Cron jobs
│   └── index.ts                  # Server entry
│
├── public/                       # Asset statici
│   └── data/                     # Snapshot dati (prod)
│       ├── latest.json
│       └── *.json
│
├── docs/                         # Documentazione
│   ├── DATA_SOURCE_INTEGRATION_TEMPLATE.md
│   └── ARCHITECTURE.md (questo file)
│
├── dist/                         # Build output (web)
├── release/                      # Build output (offline)
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── README.md
```

---

## Componenti Principali

### 1. DataLoader (`src/services/DataLoader.ts`)

**Responsabilità**:
- Carica `latest.json` per determinare quali snapshot usare
- Fetcha i file snapshot (supporta `file://` e `http://`)
- Valida i dati con Zod schema
- Normalizza i dati tra le diverse fonti
- Gestisce errori e fallback

**Flusso**:
```typescript
loadAllSnapshots()
  → loadManifest('latest.json')
  → loadSnapshotWithFallback('Microsoft', filename)
  → parseSnapshot(rawData)
  → ReleaseItemSchema.parse(item)
  → return { items, errors }
```

### 2. FilterService (`src/services/FilterService.ts`)

**Responsabilità**:
- Applica filtri ai release items
- Supporta filtri specifici per fonte (via FilterDefinitions)
- Deduplicazione
- Sorting e grouping

**Filtri Supportati**:
- **Comuni**: status, product, date range, query, tags
- **Microsoft**: wave, geography, enabledFor, language
- **EOS**: bcMinVersion
- **Fabric/M365**: availabilityType

### 3. StorageService (`src/services/StorageService.ts`)

**Responsabilità**:
- Persistenza in LocalStorage
- Gestione customers
- Gestione filter states (global + per-customer)
- Gestione GitHub PAT
- Gestione UI preferences

**Chiavi LocalStorage**:
```
updatelens.customers              # Array<Customer>
updatelens.activeCustomerId       # string | null
updatelens.globalFilters          # FilterState
updatelens.customerFilters.<id>   # FilterState
updatelens.github.pat.issues      # string (GitHub token)
```

### 4. GitHubService (`src/services/GitHubService.ts`)

**Responsabilità**:
- Integrazione GitHub API
- Gestione autenticazione (local vs web mode)
- Fetch issues
- Create issues
- Upload immagini (solo web mode)

**Modalità**:
- **Local**: Token da localStorage, chiamate dirette a GitHub API
- **Web**: Token da server env, chiamate proxate dal backend

---

## Flusso Dati

### 1. Caricamento Iniziale

```
User opens app
  → App.tsx mounts
  → useDataStore.loadData()
  → DataLoader.loadAllSnapshots()
  → Fetch latest.json
  → Fetch snapshot files (parallel)
  → Parse and validate
  → Store in Zustand
  → Render Dashboard
```

### 2. Applicazione Filtri

```
User changes filter
  → Update Zustand store
  → FilterService.applyFilters(items, filterState)
  → Filter by source
  → Filter by status
  → Filter by date range
  → Filter by product
  → Filter by query (text search)
  → Return filtered items
  → Re-render UI
```

### 3. Gestione Cliente

```
User selects customer
  → Update activeCustomerId in Zustand
  → Load customer filters from StorageService
  → Apply customer filters (if mode === 'custom')
  → Re-filter items
  → Re-render Dashboard
```

### 4. Export Markdown

```
User clicks Export
  → ExportService.generateMarkdown(items, filters)
  → Group by product
  → Format as Markdown
  → Add metadata (date, filters)
  → Trigger download
```

### 5. GitHub Issues

```
User creates issue
  → GitHubService.createIssue(data)
  → If web mode: POST /api/github/issues
  → If local mode: POST https://api.github.com/repos/.../issues
  → Upload images (if web mode)
  → Return issue URL
  → Refresh issues list
```

---

## Gestione Stato

### Zustand Stores

#### 1. DataStore (`useDataStore`)
```typescript
{
  items: ReleaseItem[];
  isLoading: boolean;
  errors: string[];
  loadData: () => Promise<void>;
}
```

#### 2. FilterStore (`useFilterStore`)
```typescript
{
  filterState: FilterState;
  updateFilter: (key, value) => void;
  resetFilters: () => void;
}
```

#### 3. CustomerStore (`useCustomerStore`)
```typescript
{
  customers: Customer[];
  activeCustomerId: string | null;
  addCustomer: (customer) => void;
  updateCustomer: (id, updates) => void;
  deleteCustomer: (id) => void;
  setActiveCustomer: (id) => void;
}
```

### State Flow

```
User Action
  → Update Zustand Store
  → Trigger re-render
  → Components read from store
  → Display updated UI
  → (Optional) Persist to LocalStorage
```

---

## Persistenza

### LocalStorage Schema

```typescript
// Customers
{
  key: 'updatelens.customers',
  value: [
    {
      id: 'customer-1',
      name: 'Cliente A',
      isActive: true,
      filterMode: 'custom',
      filters: { ... }
    }
  ]
}

// Global Filters
{
  key: 'updatelens.globalFilters',
  value: {
    sources: ['Microsoft', 'EOS', 'Fabric', 'MICROSOFT 365'],
    statuses: ['Planned', 'Rolling out', 'Try now', 'Launched'],
    horizonMonths: 120,
    historyMonths: 120,
    ...
  }
}

// Customer Filters
{
  key: 'updatelens.customerFilters.customer-1',
  value: {
    sources: ['Microsoft'],
    statuses: ['Planned'],
    ...
  }
}

// GitHub Token
{
  key: 'updatelens.github.pat.issues',
  value: 'ghp_xxxxxxxxxxxxxxxxxxxx'
}
```

### Sync Strategy

- **Write**: Immediate (on every change)
- **Read**: On app init + on customer switch
- **Clear**: Manual (via UI) or on logout (future)

---

## Integrazione Fonti Dati

### 1. Microsoft Release Plans

**Source**: Web scraping  
**URL**: https://releaseplans.microsoft.com/  
**Refresh**: `npm run refresh:microsoft`  
**Output**: `microsoft_releaseplans_YYYY_MM_DD.json`

**Campi Specifici**:
- `wave` (es. "2024 release wave 1")
- `geography` (es. "United States")
- `enabledFor` (es. "Users by admins")
- `language` (es. "English")

### 2. EOS Apps What's New

**Source**: HTML parsing  
**URL**: https://docs.eos-solutions.it/  
**Refresh**: `npm run refresh:eos`  
**Output**: `eos_whatsnew_YYYY_MM_DD.json`

**Campi Specifici**:
- `minBcVersion` (es. 24.0)
- `sourceAppName` (es. "EOS Advanced Warehouse")

### 3. Microsoft Fabric Roadmap

**Source**: REST API  
**URL**: https://fabric-gps.com/api/releases  
**Refresh**: `npm run refresh:fabric`  
**Output**: `fabric_roadmap_YYYY_MM_DD.json`

**Campi Specifici**:
- `availabilityTypes` (es. ["Public Preview", "GA"])
- `category` (es. "Data Factory")

### 4. Microsoft 365 Roadmap

**Source**: REST API  
**URL**: Microsoft 365 Roadmap API  
**Refresh**: `npm run refresh:m365roadmap`  
**Output**: `m365roadmap_data_YYYY_MM_DD.json`

**Campi Specifici**:
- `availabilityTypes` (es. ["Public Preview"])
- `category` (es. "Microsoft Teams")

### Schema Unificato

Tutte le fonti vengono normalizzate a `ReleaseItem`:

```typescript
{
  id: 'microsoft-12345',
  source: 'Microsoft',
  product: 'Dynamics 365 Sales',
  productName: 'Dynamics 365 Sales',
  title: 'New AI-powered insights',
  summary: 'Get AI-powered insights...',
  description: 'Full description...',
  status: 'Planned',
  availabilityDate: '2024-04',
  releaseDate: '2024-04-15',
  tryNow: false,
  minBcVersion: null,
  wave: '2024 release wave 1',
  geography: 'United States',
  sourceUrl: 'https://...',
  learnUrl: 'https://...'
}
```

---

## Build e Deployment

### Build Modes

#### 1. Development
```bash
npm run dev
```
- Vite dev server
- Hot reload
- Source maps
- No minification

#### 2. Production (Web)
```bash
npm run build
```
- Output: `dist/`
- Minified JS/CSS
- Optimized assets
- Requires HTTP server

#### 3. Release (Offline)
```bash
npm run build:release
```
- Output: `release/`
- Inlined assets (for `file://`)
- Self-contained
- No server required

### Deployment Strategies

#### Offline (ZIP Distribution)
1. `npm run build:release`
2. Comprimi `release/` → `UpdateLens_v0.3.0.zip`
3. Distribuisci ZIP
4. Utente: Estrai → Apri `index.html`

#### Web (HTTP Server)
1. `npm run build`
2. Deploy `dist/` su server (Nginx, Apache, Vercel, Netlify)
3. (Opzionale) Avvia backend: `npm run server:dev`
4. Configura env vars (`GITHUB_ISSUES_TOKEN`, etc.)

#### Backend (Optional)
```bash
# Produzione
npm run server:dev

# Con PM2
pm2 start server/index.ts --name updatelens-server
```

---

## Sicurezza

### Considerazioni

1. **GitHub Token (Local Mode)**:
   - Stored in localStorage (user responsibility)
   - Never sent to any server except GitHub
   - User should use fine-grained PAT with minimal permissions

2. **GitHub Token (Web Mode)**:
   - Stored in server environment variables
   - Never exposed to client
   - Backend proxies all GitHub API calls

3. **XSS Prevention**:
   - React escapes all user input by default
   - No `dangerouslySetInnerHTML` (except for Markdown preview with sanitization)

4. **CORS**:
   - Local mode: Direct calls to GitHub API (CORS allowed by GitHub)
   - Web mode: Backend proxies calls (no CORS issues)

5. **Data Privacy**:
   - All customer data in localStorage (client-side only)
   - No analytics, no tracking
   - No cookies (except for backend session if implemented)

---

## Performance

### Ottimizzazioni

1. **Lazy Loading**:
   - Routes lazy-loaded con React.lazy()
   - Snapshot files loaded on demand

2. **Memoization**:
   - useMemo for expensive computations (filtering, sorting)
   - React.memo for components

3. **Virtualization**:
   - (Future) Virtual scrolling for large lists

4. **Bundle Size**:
   - Tree shaking
   - Code splitting
   - Minification

### Metriche Target

- **Initial Load**: < 3s (with cached snapshots)
- **Filter Operation**: < 500ms (up to 10k items)
- **Export Generation**: < 1s
- **Bundle Size**: < 500KB (gzipped)

---

## Testing Strategy

### Current
- Manual testing
- TypeScript type checking
- Build verification

### Future
- Unit tests (Vitest)
- Integration tests (React Testing Library)
- E2E tests (Playwright)
- Visual regression tests (Percy/Chromatic)

---

## Troubleshooting

### Common Issues

#### 1. Snapshot not loading
**Sintomo**: Empty dashboard, error in console  
**Causa**: Missing or invalid snapshot file  
**Soluzione**: Run `npm run refresh:<source>`

#### 2. Filters not persisting
**Sintomo**: Filters reset on reload  
**Causa**: LocalStorage disabled or full  
**Soluzione**: Enable localStorage, clear old data

#### 3. GitHub Issues not working
**Sintomo**: 401 Unauthorized  
**Causa**: Invalid or expired token  
**Soluzione**: Re-configure token with correct permissions

#### 4. Offline mode not working
**Sintomo**: App requires internet  
**Causa**: Using `npm run build` instead of `npm run build:release`  
**Soluzione**: Use `npm run build:release` for offline build

---

## 👤 Autore

**Alessandro Levantini**  
Project Owner & Lead Developer

Sviluppato per **CSS S.r.l.**

---

**Versione**: 0.3.0  
**Ultimo Aggiornamento**: 2026-01-23
