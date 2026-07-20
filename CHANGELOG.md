# UpdateLens - Changelog Dettagliato

## v0.5.0 (Unreleased) - Export PowerPoint brandizzato EOS

### 🎉 Nuove Funzionalità

#### Generazione presentazioni dalla Dashboard
- ✅ **Bottone "Esporta PPTX"** - Genera un deck PowerPoint dagli aggiornamenti filtrati
  - Modal `ExportDeckModal` con titolo, sottotitolo e sezioni selezionabili
  - Stima live del numero di slide prima della generazione
  - Generazione interamente client-side con `pptxgenjs` (nessuna chiamata server)
- ✅ **Identità visiva EOS Solutions** applicata dai token del Brand Book
  - Palette ufficiale: arancione `#F08019`, marrone `#382F2D`, accenti `#00B0E8` / `#485870`
  - Logo negli slide master: versione a colori su fondo chiaro, **versione negativa su
    fondo scuro** (cover e closing), come richiesto dal Brand Book
  - Copertina e chiusura con claim "Digital Systems | Human Feelings" e contatti
  - Max 6 voci per slide, corpo >= 16 pt, palette grafici a 4 serie
- ✅ **Sezioni configurabili**: sintesi KPI, perimetro del report (filtri applicati),
  prodotti più interessati (grafico a barre), novità per prodotto, dettaglio aggiornamenti
- ✅ **Perimetro del report nel deck** - i filtri applicati sono documentati nelle slide,
  informazione che l'export Markdown non riportava

### 🔧 Miglioramenti Tecnici

- ✅ `describeFilterState` (`src/services/FilterDescription.ts`) - descrizione dei filtri
  attivi estratta dalla Dashboard e condivisa con l'export: una sola fonte di verità per
  le etichette dei chip e per le slide
- ✅ `resolveItemLinks` e `groupByProduct` esportati da `ExportService` e riusati dal deck
  (output Markdown verificato byte-identico su 3813 item)
- ✅ `downloadBlob` - download generalizzato ai contenuti binari; `downloadMarkdown` vi delega
- ✅ Logo incorporati come data URI base64 e inseriti negli **slide master**: una sola copia
  per file invece di una per slide (media da 419 KB a 18 KB)
- ✅ `tools/deckSmokeTest.ts` - collaudo headless che valida il pacchetto OOXML, la
  deduplicazione dei logo, i colori di brand e i limiti di densità
- ✅ Tetto di 3 slide per prodotto e 15 sezioni prodotto: sull'intero dataset il deck resta
  a ~51 slide invece di ~480. Le omissioni sono sempre dichiarate nella slide

### 🐛 Correzioni emerse dal QA visivo

- ✅ **Layout slide** - `pptx.defineLayout` esplicito derivato da `EOS_LAYOUT`: il preset
  `LAYOUT_16x9` di pptxgenjs è 10 x 5.625 pollici, non 13.333 x 7.5, e mandava fuori slide
  la quinta tile KPI, il logo e parte del grafico
- ✅ **Etichetta prodotto** - `resolveProductLabel`: 391 item su 3813 hanno `product` ma non
  `productName` e finivano sotto il titolo letterale "undefined" (difetto presente anche
  nell'export Markdown, dove produceva `## undefined`)
- ✅ **Date** - `resolveItemDate` con fallback su `availabilityDateFull` / `availabilityDate` /
  `firstAvailableDate`: gli stessi 391 item mostravano "data non disponibile" ovunque
- ✅ **Entità HTML** - `decodeHtmlEntities` (`src/utils/html.ts`): 48 titoli contengono entità
  già codificate dalla sorgente (`l&#39;agente`) che finivano letterali nel documento
- ✅ **Logo sulle slide di contenuto** spostato in basso a destra su fondo bianco: il PNG a
  colori ha fondo bianco e sulla banda arancione si vedeva come un riquadro
- ✅ **Slide "Perimetro del report"** - `summarizeFilterState` riassume per gruppo con "+N altri"
  invece di elencare ogni valore: con i filtri di default produceva oltre cento righe fuori slide
- ✅ **Grafico** - altezza proporzionale al numero di barre e serie unica in arancione
- ✅ Il test `test:deck` ora verifica le **dimensioni della slide** e che **nessun oggetto esca
  dai bordi**: entrambi i controlli falliscono sul codice pre-correzione

### ⚠️ Limiti Noti

- I font brand (Humble, Open Sans) **non sono incorporabili** in un .pptx: il deck usa
  `Calibri`, che è il fallback previsto dal Brand Book ed è presente su ogni Office
- Il template ufficiale `eos-template.potx` non viene usato: pptxgenjs non sa leggerlo,
  quindi il deck è una ricostruzione che ne applica i token
- Il collaudo automatico verifica struttura, geometria e colori del pacchetto, ma non la
  resa tipografica: per quella si esportano le slide in PNG con PowerPoint
  (`$ppt.Presentations.Open(...).SaveCopyAs($dir, 18)` via COM) e si guardano

### 📦 Dipendenze

- ➕ `pptxgenjs ^4.0.1` (bundle da 542 KB a 957 KB, gzip da 150 KB a 302 KB)
- ⚙️ `vite.config.ts`: `build.rollupOptions.output.inlineDynamicImports = true` — obbligatorio
  perché pptxgenjs introduce uno stub di builtin Node che altrimenti diventa un secondo
  chunk e rompe la modalità offline di `npm run build:release`

## v0.4.0 (2026-02-02) - Azure Migration \u0026 Cloud Deployment

### 🎉 Nuove Funzionalità

#### Azure Cloud Deployment
- ✅ **Azure Functions** - Ingestion automatica con Timer Triggers
  - `refreshAllScheduled` - Refresh tutte le fonti ogni 6 ore
  - `refreshMicrosoft`, `refreshEos`, `refreshFabric`, `refreshM365` - Refresh singole fonti
  - HTTP triggers per health check e API
- ✅ **Azure Blob Storage** - Storage snapshot versionati
  - Container `snapshots` per tutti i file JSON
  - Versioning automatico: `fonte_YYYY_MM_DD.json`
  - Manifest `latest.json` aggiornato automaticamente
- ✅ **Azure App Service** - Hosting Web App
  - Deployment su `updatelens-api.azurewebsites.net`
  - Runtime Node.js 20 LTS
  - Persistent storage per SQLite database
- ✅ **Application Insights** - Monitoring e logging
  - Telemetry automatica per tutte le funzioni
  - Log centralizzati in Log Analytics Workspace
  - Query Kusto per diagnostica avanzata
- ✅ **Managed Identity** - RBAC sicuro
  - System Assigned MI per Function App e Web App
  - User Assigned MI per GitHub OIDC
  - Cross-RG access con role assignments
- ✅ **GitHub Actions CI/CD** - Deployment automatico
  - `deploy-api.yml` - Deploy Web App su branch `Azure`
  - `deploy-functions.yml` - Deploy Functions su branch `main`
  - OIDC authentication (no publish profiles)

#### Automated Data Refresh
- ✅ **Scheduled Refresh** - Refresh automatico ogni 6 ore (00:00, 06:00, 12:00, 18:00 UTC)
- ✅ **All Sources** - Microsoft Release Plans, EOS Apps, Fabric Roadmap, M365 Roadmap
- ✅ **Blob Storage Integration** - Snapshot salvati su Azure Storage
- ✅ **Versioning** - Snapshot datati con rollback capability
- ✅ **Error Handling** - Retry logic e fallback su errori

### 🔧 Miglioramenti Tecnici

#### Architettura
- ✅ **Migrazione Italy North** - Tutti i componenti migrati da West Europe
- ✅ **Resource Groups** - Separazione runtime (`rg-updatelens-runtime`) e shared (`rg-updatelens-shared`)
- ✅ **OIDC Authentication** - GitHub Actions con federated credentials
- ✅ **Cross-RG RBAC** - Configurazione role assignments per accesso sicuro

#### Deployment
- ✅ **GitHub Actions Workflows** - Automazione completa deploy
- ✅ **Environment Variables** - Gestione via Azure App Settings
- ✅ **Secrets Management** - Token e chiavi in App Settings (Key Vault ready)
- ✅ **Health Checks** - Endpoint `/api/health` per monitoring

#### Performance
- ✅ **Blob Storage CDN-ready** - Preparato per Azure CDN integration
- ✅ **Function Cold Start** - Ottimizzato con Always On (App Service Plan)
- ✅ **Caching** - Snapshot cached per ridurre latenza

### 📝 Documentazione
- ✅ **README.md** - Sezione "Modalità di Deployment" con Azure
- ✅ **ARCHITECTURE.md** - Capitolo "Azure Architecture" (in progress)
- ✅ **DEVELOPER_GUIDE.md** - Setup Azure e debugging Functions (in progress)
- ✅ **Azure Deployment Guide** - Nuova guida completa (in progress)
- ✅ **Implementation Plan** - Aggiornato con v0.4.0 scope

### 🐛 Bug Fix
- ✅ Fix CORS issues in Web mode con Azure Functions
- ✅ Fix snapshot loading da Blob Storage con fallback
- ✅ Fix GitHub token rotation e sicurezza
- ✅ Fix timezone handling per scheduled triggers

### ⚠️ Breaking Changes
- **Deployment Mode**: Azure deployment richiede Azure subscription
- **Environment Variables**: Nuove variabili richieste per Azure Functions:
  - `AZURE_STORAGE_CONNECTION_STRING` o Managed Identity
  - `APPLICATIONINSIGHTS_CONNECTION_STRING`
- **Snapshot Location**: In Azure mode, snapshot caricati da Blob Storage invece di `/public/data/`
- **Backend URL**: Web App URL cambiato da localhost a `updatelens-api.azurewebsites.net`

### 🔄 Migration Notes
- **Da v0.3.0 a v0.4.0**:
  - Nessuna breaking change per modalità Offline e Web (locale)
  - Azure mode è completamente nuovo e opzionale
  - LocalStorage schema invariato (compatibilità completa)
  - Snapshot format invariato (compatibilità completa)

---

## v0.3.0 (2026-01-23) - GitHub Issues Integration

### 🎉 Nuove Funzionalità

#### GitHub Issues Integration
- ✅ **Pagina Issues** - Nuova sezione dedicata alla gestione issues GitHub
- ✅ **Configurazione Token** - Modal per configurare GitHub Personal Access Token
- ✅ **Persistenza Token** - Token salvato in localStorage (`updatelens.github.pat.issues`)
- ✅ **Validazione Token** - Test preventivo del token con feedback immediato
- ✅ **Lista Issues** - Visualizzazione issues (open/closed) con ricerca e filtri
- ✅ **Creazione Issues** - Form completo per creare nuove issue con:
  - Titolo e descrizione (supporto Markdown)
  - Selezione labels
  - Upload immagini (solo modalità Web)
- ✅ **Modalità Dual** - Supporto sia locale (direct API) che Web (proxy server)
- ✅ **Upload Immagini** - Upload via GitHub Content API (branch main, folder `/public/uploads/`)

#### Miglioramenti UI/UX
- ✅ Icone e badge per stato issues (open/closed)
- ✅ Empty states informativi
- ✅ Loading states durante operazioni async
- ✅ Error handling con messaggi user-friendly
- ✅ Responsive design per mobile/tablet

### 🔧 Miglioramenti Tecnici

#### Backend (Server Proxy)
- ✅ Endpoint `/api/github/issues` (GET/POST)
- ✅ Endpoint `/api/github/upload` (POST)
- ✅ Gestione token server-side (`GITHUB_ISSUES_TOKEN`)
- ✅ Proxy sicuro senza esporre token al client

#### Frontend
- ✅ Nuovo service `GitHubService.ts`
- ✅ Componenti riutilizzabili:
  - `GitHubTokenModal.tsx`
  - `IssueCreateModal.tsx`
  - `IssueCard.tsx`
- ✅ Gestione stato con Zustand
- ✅ Validazione form con Zod

### 📝 Documentazione
- ✅ Sezione GitHub Issues nel README
- ✅ Guida configurazione token (locale + web)
- ✅ Esempi permessi PAT

### 🐛 Bug Fix
- ✅ Fix placeholder centering su search input (IssuesPage)
- ✅ Fix gestione errori upload immagini
- ✅ Fix validazione Markdown nella descrizione issue

---

## v0.2.0 (2026-01-15) - Multi-Client & Global Filters

### 🎉 Nuove Funzionalità

#### Gestione Multi-Cliente
- ✅ **Pagina Clienti** - CRUD completo per gestione clienti
- ✅ **Modalità Filtri** - Tre modalità per cliente:
  - `global`: Eredita filtri globali
  - `custom`: Override con filtri personalizzati
  - `disabled`: Escluso da tutti i filtri
- ✅ **Stato Attivo/Inattivo** - Flag per abilitare/disabilitare clienti
- ✅ **Persistenza** - Tutti i dati cliente in localStorage
- ✅ **Selettore Globale** - Dropdown in header per switch rapido tra clienti

#### Filtri Globali
- ✅ **Pagina Filtri Globali** - Definizione regole di default
- ✅ **Bulk Apply** - Applicazione filtri a clienti multipli
- ✅ **Preview** - Anteprima clienti inclusi prima di applicare
- ✅ **Safety Constraints** - Prevenzione operazioni bulk in customer scope

#### Microsoft 365 Roadmap (4a Fonte Dati)
- ✅ **Integrazione M365 Roadmap** - Nuova fonte dati
- ✅ **Script Refresh** - `tools/refreshM365Roadmap.ts`
- ✅ **Normalizzazione** - Mapping a schema ReleaseItem
- ✅ **Dashboard KPI** - Card viola per M365
- ✅ **Filtri** - Supporto filtri specifici M365

### 🔧 Miglioramenti Tecnici

#### Architettura
- ✅ Refactoring `FilterService` per supporto multi-cliente
- ✅ Nuovo `FilterDefinitions` per capabilities per fonte
- ✅ Estensione `StorageService` per customer data
- ✅ Nuovo `CustomerStore` (Zustand)

#### UI/UX
- ✅ Dashboard drill-down (click su KPI → filtra per fonte)
- ✅ Color coding per fonte (Blue, Amber, Teal, Purple)
- ✅ Responsive design migliorato
- ✅ Dark mode auto-detect

### 📝 Documentazione
- ✅ Aggiornamento README con 4 fonti
- ✅ Documentazione workflow multi-cliente
- ✅ Esempi configurazione filtri

### 🐛 Bug Fix
- ✅ Fix persistenza selezione cliente
- ✅ Fix applicazione filtri in customer scope
- ✅ Fix deduplicazione items cross-source
- ✅ Fix date parsing per M365 Roadmap

---

## v0.1.0 (2025-12-20) - MVP Release

### 🎉 Funzionalità Iniziali

#### Core Features
- ✅ **Dashboard** - Vista principale con KPI e lista items
- ✅ **3 Fonti Dati**:
  - Microsoft Release Plans
  - EOS Apps What's New
  - Microsoft Fabric Roadmap
- ✅ **Filtri** - Sistema filtri avanzato:
  - Fonte, stato, prodotto, date range
  - Query text search
  - Horizon/History months
- ✅ **Export Markdown** - Generazione report personalizzati
- ✅ **Offline-first** - Funzionamento senza internet

#### Data Management
- ✅ **Snapshot System** - Versionamento dati con `latest.json`
- ✅ **Refresh Scripts** - Tool per aggiornare snapshot:
  - `refreshMicrosoft.ts`
  - `refreshEos.ts`
  - `refreshFabric.ts`
- ✅ **Validation** - Zod schema per tutti i dati
- ✅ **Deduplication** - Logica dedup cross-source

#### UI/UX
- ✅ **Design System** - Tailwind CSS custom
- ✅ **Responsive** - Mobile, tablet, desktop
- ✅ **Dark Mode** - Auto-detect system preference
- ✅ **Italian UI** - Tutte le label in italiano

#### Backend (Optional)
- ✅ **Express Server** - API REST interne
- ✅ **SQLite Database** - Storage Release Plans
- ✅ **Ingestion Script** - Refresh automatico da Microsoft
- ✅ **Cron Scheduler** - Aggiornamenti periodici

### 🔧 Tech Stack
- ✅ Vite + React 18 + TypeScript
- ✅ Tailwind CSS
- ✅ Zustand (state management)
- ✅ Zod (validation)
- ✅ React Router v6
- ✅ Express + Better-SQLite3 (backend)

### 📝 Documentazione
- ✅ README completo
- ✅ Implementation Plan
- ✅ Tasks list
- ✅ Data Source Integration Template

---

## Roadmap Futura

### v0.4.0 (Planned)
- [ ] **Export PDF/HTML** - Oltre a Markdown
- [ ] **Advanced Analytics** - Charts e trends
- [ ] **Notification System** - Alert per nuovi release
- [ ] **Automated Refresh** - Cron job per tutte le fonti

### v0.5.0 (Planned)
- [ ] **User Authentication** - Login/logout (Web mode)
- [ ] **Role-based Access** - Admin, Viewer roles
- [ ] **Custom Tags** - Tagging personalizzato
- [ ] **Saved Presets** - Preset filtri salvati

### v1.0.0 (Future)
- [ ] **Multi-language** - English, Italian
- [ ] **Mobile App** - React Native
- [ ] **Teams/Slack Integration** - Notifiche
- [ ] **AI Summarization** - Riassunti AI-powered

---

## Breaking Changes

### v0.3.0
- Nessun breaking change

### v0.2.0
- **LocalStorage Schema Change**: Aggiunto `customers` e `customerFilters.*`
  - **Migrazione**: Automatica, nessuna azione richiesta
- **FilterState Type Change**: Aggiunto `filterMode` per cliente
  - **Migrazione**: Automatica con fallback a `global`

### v0.1.0
- Initial release, nessun breaking change

---

## Deprecations

### v0.3.0
- Nessuna deprecation

### v0.2.0
- Nessuna deprecation

### v0.1.0
- Nessuna deprecation

---

## Known Issues

### v0.3.0
- [ ] Search placeholder centering su IssuesPage (minor visual issue)
- [ ] GitHub image upload limitato a 1MB per file
- [ ] Upload immagini non disponibile in modalità locale (CORS)

### v0.2.0
- [x] ~~Customer selection non persistente~~ (Fixed in v0.3.0)
- [x] ~~Bulk apply in customer scope non bloccato~~ (Fixed in v0.2.1)

### v0.1.0
- [x] ~~Snapshot files non versionati~~ (Fixed in v0.2.0)
- [x] ~~Date parsing inconsistente~~ (Fixed in v0.1.1)

---

## Contributors

- **Alessandro Levantini** - Project Owner & Lead Developer
- **Team CSS** - Product Owner & Testing

---

## License

Proprietario - **Alessandro Levantini**  
Sviluppato per CSS S.r.l.

---

**Ultimo Aggiornamento**: 2026-01-23  
**Versione Corrente**: 0.3.0
