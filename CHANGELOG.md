# UpdateLens - Changelog Dettagliato

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
