# UpdateLens - Architettura e Struttura

## Indice

1. [Azure Architecture](#azure-architecture) ⭐ NEW
2. [Panoramica](#panoramica)
3. [Architettura Generale](#architettura-generale)
4. [Struttura Cartelle](#struttura-cartelle)
5. [Componenti Principali](#componenti-principali)
6. [Flusso Dati](#flusso-dati)
7. [Gestione Stato](#gestione-stato)
8. [Persistenza](#persistenza)
9. [Integrazione Fonti Dati](#integrazione-fonti-dati)
10. [Build e Deployment](#build-e-deployment)
11. [Azure Tagging Strategy](file:///c:/Github/UpdateLens/docs/AZURE_TAGS.md) ⭐ NEW

---

## Azure Architecture

### Panoramica Azure

UpdateLens è deployato su **Azure** con un'architettura **cloud-native** che supporta:
- ✅ **Automated Data Ingestion** - Refresh automatico ogni 6 ore
- ✅ **Scalable Storage** - Azure Blob Storage per snapshot versionati
- ✅ **Serverless Functions** - Azure Functions per processing
- ✅ **Managed Hosting** - Azure App Service per Web App
- ✅ **Monitoring** - Application Insights per telemetry
- ✅ **CI/CD** - GitHub Actions per deployment automatico
- ✅ **Governance** - [Tagging standardizzato](file:///c:/Github/UpdateLens/docs/AZURE_TAGS.md) per tutte le risorse

### Architettura Completa Azure

```
┌──────────────────────────────────────────────────────────────────────┐
│                          GitHub Repository                            │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐         │
│  │  Source Code   │  │  GitHub Actions│  │   Workflows    │         │
│  │  (main/Azure)  │  │   (CI/CD)      │  │  deploy-*.yml  │         │
│  └────────┬───────┘  └────────┬───────┘  └────────┬───────┘         │
└───────────┼──────────────────┼──────────────────┼──────────────────┘
            │                  │                  │
            │ Push             │ OIDC Auth        │ Deploy
            ▼                  ▼                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│                         Azure Italy North                             │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │              rg-updatelens-runtime                           │    │
│  │  ┌──────────────────┐         ┌──────────────────┐          │    │
│  │  │ Azure Functions  │         │ Azure App Service│          │    │
│  │  │ (Timer Triggers) │         │   (Web App)      │          │    │
│  │  │                  │         │                  │          │    │
│  │  │ • refreshAll     │         │ updatelens-api   │          │    │
│  │  │ • refreshMS      │         │ (Node.js 20)     │          │    │
│  │  │ • refreshEOS     │         │                  │          │    │
│  │  │ • refreshFabric  │         │ Express + React  │          │    │
│  │  │ • refreshM365    │         │                  │          │    │
│  │  └────────┬─────────┘         └────────┬─────────┘          │    │
│  │           │ Write                      │ Read               │    │
│  └───────────┼────────────────────────────┼────────────────────┘    │
│              │                            │                          │
│  ┌───────────┼────────────────────────────┼────────────────────┐    │
│  │           │  rg-updatelens-shared      │                    │    │
│  │           │                            │                    │    │
│  │      ┌────▼────────────────────────────▼──────┐             │    │
│  │      │   Azure Blob Storage                   │             │    │
│  │      │   (updatelensdataitn)                  │             │    │
│  │      │                                        │             │    │
│  │      │   Container: snapshots/                │             │    │
│  │      │   • microsoft_releaseplans_*.json      │             │    │
│  │      │   • eos_whatsnew_*.json                │             │    │
│  │      │   • fabric_roadmap_*.json              │             │    │
│  │      │   • m365_roadmap_*.json                │             │    │
│  │      │   • latest.json (manifest)             │             │    │
│  │      └────────────────────────────────────────┘             │    │
│  │                                                              │    │
│  │      ┌────────────────────────────────────────┐             │    │
│  │      │   Application Insights                 │             │    │
│  │      │   (updatelens-appinsights)             │             │    │
│  │      │                                        │             │    │
│  │      │   • Function telemetry                 │             │    │
│  │      │   • Web App metrics                    │             │    │
│  │      │   • Custom events                      │             │    │
│  │      │   • Performance monitoring             │             │    │
│  │      └────────────────────────────────────────┘             │    │
│  │                                                              │    │
│  │      ┌────────────────────────────────────────┐             │    │
│  │      │   Log Analytics Workspace              │             │    │
│  │      │   (updatelens-law)                     │             │    │
│  │      └────────────────────────────────────────┘             │    │
│  │                                                              │    │
│  │      ┌────────────────────────────────────────┐             │    │
│  │      │   Managed Identity (OIDC)              │             │    │
│  │      │   (oidc-updatelens-msi)                │             │    │
│  │      │                                        │             │    │
│  │      │   • GitHub Actions auth                │             │    │
│  │      │   • Cross-RG access                    │             │    │
│  │      └────────────────────────────────────────┘             │    │
│  └──────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS
                              ▼
                    ┌──────────────────┐
                    │   End Users      │
                    │   (Browser)      │
                    └──────────────────┘
```

### Resource Groups

UpdateLens utilizza **due Resource Groups** separati per organizzazione logica:

#### 1. rg-updatelens-runtime
**Scopo**: Componenti runtime e computazionali

| Risorsa | Nome | Tipo | Scopo |
|---------|------|------|-------|
| Function App | `updatelens-functions-itn` | Azure Functions | Timer triggers per refresh automatico |
| Web App | `updatelens-api` | Azure App Service | Hosting portale web |
| App Service Plan (Functions) | `plan-updatelens-functions` | Consumption/Premium | Hosting Functions |
| App Service Plan (Web) | `plan-updatelens-api` | Basic/Standard | Hosting Web App |

#### 2. rg-updatelens-shared
**Scopo**: Componenti condivisi e dati

| Risorsa | Nome | Tipo | Scopo |
|---------|------|------|-------|
| Storage Account | `updatelensdataitn` | Blob Storage | Snapshot JSON versionati |
| Application Insights | `updatelens-appinsights` | Monitoring | Telemetry e logging |
| Log Analytics Workspace | `updatelens-law` | Logging | Centralizzazione log |
| Managed Identity | `oidc-updatelens-msi` | User Assigned MI | GitHub OIDC auth |

### Data Flow End-to-End

#### 1. Ingestion Flow (Automated)

```
Timer Trigger (Cron: 0 */6 * * *)
         │
         ▼
Azure Function (refreshAllScheduled)
         │
         ├─► refreshMicrosoft() ──► Fetch Microsoft Release Plans API
         ├─► refreshEOS() ────────► Scrape EOS Docs
         ├─► refreshFabric() ─────► Fetch Fabric GPS API
         └─► refreshM365() ───────► Fetch M365 Roadmap API
                 │
                 ▼
         Normalize to ReleaseItem[]
                 │
                 ▼
         Write to Blob Storage
         • snapshots/microsoft_releaseplans_2026_02_02.json
         • snapshots/eos_whatsnew_2026_02_02.json
         • snapshots/fabric_roadmap_2026_02_02.json
         • snapshots/m365_roadmap_2026_02_02.json
                 │
                 ▼
         Update latest.json manifest
         {
           "microsoft": "snapshots/microsoft_releaseplans_2026_02_02.json",
           "eos": "snapshots/eos_whatsnew_2026_02_02.json",
           "fabric": "snapshots/fabric_roadmap_2026_02_02.json",
           "m365": "snapshots/m365_roadmap_2026_02_02.json",
           "lastUpdate": "2026-02-02T10:00:00Z"
         }
                 │
                 ▼
         Log to Application Insights
         • Success/Failure
         • Duration
         • Item count
```

#### 2. Frontend Load Flow (User Access)

```
User opens https://updatelens-api.azurewebsites.net
         │
         ▼
Azure App Service serves index.html
         │
         ▼
React App boots
         │
         ▼
DataLoader.loadLatestManifest()
         │
         ▼
Fetch latest.json from Blob Storage
         │
         ▼
Parse manifest → Get snapshot URLs
         │
         ▼
Parallel fetch all snapshots
         ├─► microsoft_releaseplans_2026_02_02.json
         ├─► eos_whatsnew_2026_02_02.json
         ├─► fabric_roadmap_2026_02_02.json
         └─► m365_roadmap_2026_02_02.json
                 │
                 ▼
         Merge + Deduplicate → ReleaseItem[]
                 │
                 ▼
         Store in Zustand (dataStore)
                 │
                 ▼
         Apply filters (FilterService)
                 │
                 ▼
         Render Dashboard
```

### Managed Identity \u0026 RBAC

#### System Assigned Managed Identity
- **Function App** → Accesso Blob Storage (Storage Blob Data Contributor)
- **Web App** → Accesso Blob Storage (Storage Blob Data Reader)

#### User Assigned Managed Identity
- **GitHub Actions** → OIDC Federated Credentials
  - Deploy Function App
  - Deploy Web App
  - Access Resource Groups

#### Role Assignments

| Principal | Role | Scope | Scopo |
|-----------|------|-------|-------|
| `updatelens-functions-itn` (System MI) | Storage Blob Data Contributor | `updatelensdataitn` | Write snapshots |
| `updatelens-api` (System MI) | Storage Blob Data Reader | `updatelensdataitn` | Read snapshots |
| `oidc-updatelens-msi` (User MI) | Contributor | `rg-updatelens-runtime` | Deploy resources |
| `oidc-updatelens-msi` (User MI) | Contributor | `rg-updatelens-shared` | Deploy resources |

### Deployment Pipeline (GitHub Actions)

#### Workflow: deploy-functions.yml
**Trigger**: Push to `main` branch

```yaml
Steps:
1. Checkout code
2. Setup Node.js 20
3. npm install (functions/)
4. npm run build (TypeScript → JavaScript)
5. Azure Login (OIDC with oidc-updatelens-msi)
6. Deploy to updatelens-functions-itn
7. Verify deployment
8. Log to Application Insights
```

#### Workflow: deploy-api.yml
**Trigger**: Push to `Azure` branch

```yaml
Steps:
1. Checkout code
2. Setup Node.js 20
3. npm install
4. npm run build (Vite build)
5. Azure Login (OIDC)
6. Deploy to updatelens-api
7. Restart Web App
8. Health check (GET /api/health)
```

### Monitoring \u0026 Observability

#### Application Insights Telemetry

**Function App**:
- Execution count per function
- Duration (avg, p50, p95, p99)
- Success/Failure rate
- Exceptions and stack traces
- Custom events (snapshot size, item count)

**Web App**:
- HTTP request metrics (latency, status codes)
- Page views and user sessions
- Browser performance (load time, render time)
- Custom events (filter applied, export triggered)

#### Log Analytics Queries

**Query 1: Function Execution Summary**
```kusto
traces
| where cloud_RoleName == "updatelens-functions-itn"
| where message contains "Refresh completed"
| summarize 
    count(), 
    avg(duration), 
    percentile(duration, 95) 
  by bin(timestamp, 1h), operation_Name
```

**Query 2: Snapshot Size Trends**
```kusto
customEvents
| where name == "SnapshotWritten"
| extend source = tostring(customDimensions.source)
| extend sizeBytes = tolong(customDimensions.sizeBytes)
| summarize avg(sizeBytes), max(sizeBytes) by bin(timestamp, 1d), source
```

### Security

#### Secrets Management
- **GitHub Token**: Stored in App Settings (migrate to Key Vault)
- **Function Keys**: Auto-generated, rotated periodically
- **Connection Strings**: Managed Identity (no connection strings needed)

#### Network Security
- **Public Endpoints**: Currently enabled (migrate to Private Endpoints)
- **HTTPS Only**: Enforced on Web App and Functions
- **CORS**: Configured for `updatelens-api.azurewebsites.net`

#### Authentication
- **GitHub Actions**: OIDC Federated Credentials (no secrets)
- **Function App**: System Assigned MI for Blob Storage
- **Web App**: System Assigned MI for Blob Storage

---

## Panoramica

UpdateLens è un'applicazione web costruita con:
- **Frontend**: React + TypeScript + Vite
- **State Management**: Zustand
- **Styling**: Tailwind CSS
- **Validation**: Zod
- **Backend (opzionale)**: Express + SQLite

### Caratteristiche Architetturali

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
│   │   │   ├── exports/
│   │   │   │   └── ExportDeckModal.tsx    # Modal export PowerPoint
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
│   ├── exports/                  # Generazione PowerPoint brandizzato EOS
│   │   ├── brandTokens.ts        # Palette, font, layout dal Brand Book
│   │   ├── eosLogoBase64.ts      # Logo (positivo + negativo) come data URI
│   │   ├── deckModel.ts          # Modello del deck (puro, testabile)
│   │   ├── pptxRenderer.ts       # Rendering pptxgenjs + slide master
│   │   ├── downloadBlob.ts       # Download di contenuti binari
│   │   └── index.ts
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
- Fetcha i file snapshot via HTTP
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

### Deployment Strategies

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

## Build e Deployment

UpdateLens supporta **due modalità di deployment** per adattarsi a diverse esigenze:

### 1. Web Mode (Local Server)

**Ideale per**: Sviluppo, testing, deployment intranet

#### Build
```bash
npm run build
```

#### Avvio Server
```bash
# Development
npm run server:dev

# Production
npm run server:start
```

#### Architettura
```
┌─────────────────────────────────────┐
│   Express Server (localhost:3000)   │
│  ┌───────────────────────────────┐  │
│  │  Static Files (dist/)         │  │
│  │  • index.html                 │  │
│  │  • assets/                    │  │
│  └───────────────────────────────┘  │
│  ┌───────────────────────────────┐  │
│  │  API Routes                   │  │
│  │  • /api/releaseplans          │  │
│  │  • /api/github/issues         │  │
│  │  • /api/github/upload         │  │
│  └───────────────────────────────┘  │
│  ┌───────────────────────────────┐  │
│  │  SQLite Database              │  │
│  │  • releaseplans.db            │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

#### Caratteristiche
- ✅ Backend Express locale
- ✅ SQLite database
- ✅ GitHub Issues proxy (no CORS)
- ✅ API REST interne
- ✅ Refresh manuale con script

#### Environment Variables
```env
PORT=3000
GITHUB_ISSUES_TOKEN=ghp_xxx...
GITHUB_OWNER=Allecpu
GITHUB_REPO=UpdateLens
```

---

### 2. Azure Mode (Cloud Deployment)

**Ideale per**: Produzione, scalabilità, refresh automatico

#### Architettura
Vedi sezione [Azure Architecture](#azure-architecture) per dettagli completi.

#### Deployment via GitHub Actions

**Workflow 1: deploy-functions.yml**
```yaml
name: Deploy Azure Functions
on:
  push:
    branches: [main]
    paths: ['functions/**']

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: azure/login@v1
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
      - name: Deploy Functions
        run: |
          cd functions
          npm install
          npm run build
          func azure functionapp publish updatelens-functions-itn
```

**Workflow 2: deploy-api.yml**
```yaml
name: Deploy Web App
on:
  push:
    branches: [Azure]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: azure/login@v1
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
      - name: Build and Deploy
        run: |
          npm install
          npm run build
          az webapp deploy \
            --resource-group rg-updatelens-runtime \
            --name updatelens-api \
            --src-path dist.zip
```

#### Caratteristiche
- ✅ Automated refresh (ogni 6 ore)
- ✅ Scalable storage (Azure Blob)
- ✅ Serverless functions
- ✅ Managed hosting
- ✅ Application Insights monitoring
- ✅ CI/CD automatico

#### Costi Stimati (Italy North)
| Componente | Tier | Costo/mese (€) |
|------------|------|----------------|
| Azure Functions | Consumption | ~5-10 |
| Azure App Service | Basic B1 | ~13 |
| Blob Storage | Standard LRS | ~1-2 |
| Application Insights | Pay-as-you-go | ~5 |
| **Totale** | | **~24-30 €/mese** |

---

### Comparison Matrix

| Feature | Web (Local) | Azure (Cloud) |
|---------|-------------|---------------|
| **Server Required** | ✅ Yes (local) | ✅ Yes (cloud) |
| **Automated Refresh** | ⚠️ Script | ✅ Automatic |
| **GitHub Issues** | ✅ Yes (proxy) | ✅ Yes (proxy) |
| **Scalability** | ⚠️ Limited | ✅ High |
| **Monitoring** | ⚠️ Basic logs | ✅ App Insights |
| **Cost** | Free (hosting) | ~25 €/month |
| **Deployment** | npm run | GitHub Actions |
| **Best For** | Dev, intranet | Production |

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

---

## 👤 Autore

**Alessandro Levantini**  
Project Owner & Lead Developer

Sviluppato per **CSS S.r.l.**

---

**Versione**: 0.4.0  
**Ultimo Aggiornamento**: 2026-02-02
