# UpdateLens

**UpdateLens** è un portale web statico e offline-first per analizzare, filtrare e presentare gli aggiornamenti da **quattro fonti dati**: **Microsoft Release Plans**, **EOS Apps**, **Microsoft Fabric Roadmap** e **Microsoft 365 Roadmap**.

Funziona completamente offline con snapshot locali. In alternativa, è disponibile un backend opzionale per ingestione e API interne.

---

## 🎯 Funzionalità Principali

### Core Features
- ✅ **Web app offline-first** - Funziona senza connessione internet
- ✅ **Distribuzione via ZIP** - Facile deployment e portabilità
- ✅ **4 Fonti Dati Integrate** - Microsoft, EOS, Fabric, M365 Roadmap
- ✅ **Gestione Multi-Cliente** - Configurazioni personalizzate per cliente
- ✅ **Filtri Globali e Per-Cliente** - Sistema di filtri avanzato e granulare
- ✅ **Dashboard Interattiva** - Visualizzazione KPI e drill-down
- ✅ **Export Markdown** - Esportazione report personalizzati
- ✅ **GitHub Issues Integration** - Gestione bug/feature direttamente dal portale
- ✅ **Snapshot Locali** - Dati versionati e tracciabili

### Pagine Disponibili
- **Dashboard** - Vista aggregata con KPI e filtri
- **Clienti** - Gestione configurazioni cliente
- **Filtri Globali** - Definizione regole di filtro globali
- **Issues** - Integrazione GitHub per bug tracking
- **Versione** - Changelog e informazioni release

---

## 🛠️ Tech Stack

- **Frontend**: Vite + React + TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Validation**: Zod
- **Routing**: React Router
- **Backend (opzionale)**: Express + SQLite + Better-SQLite3

---

## 🚀 Quick Start

### Setup Sviluppo

```bash
npm install
npm run dev
```

### Build Produzione

```bash
npm run build
```

### Build Offline (File System)

Per aprire `index.html` direttamente da file system (senza server):

```bash
npm run build:release
```

Poi apri `release/index.html` nel browser.

---

## 📊 Fonti Dati

UpdateLens integra **4 fonti dati** con refresh automatizzato:

### 1. Microsoft Release Plans
- **Source**: https://releaseplans.microsoft.com/
- **Prodotti**: Dynamics 365, Power Platform
- **Refresh**: `npm run refresh:microsoft`
- **Formato**: Web scraping + normalizzazione

### 2. EOS What's New
- **Source**: https://docs.eos-solutions.it/
- **Prodotti**: EOS Apps for Business Central
- **Refresh**: `npm run refresh:eos`
- **Formato**: HTML parsing

### 3. Microsoft Fabric Roadmap
- **Source**: https://fabric-gps.com/api/releases
- **Prodotti**: Data Factory, Power BI, OneLake, Data Warehouse, Real-Time Intelligence
- **Refresh**: `npm run refresh:fabric`
- **Formato**: REST API JSON

### 4. Microsoft 365 Roadmap
- **Source**: Microsoft 365 Roadmap API
- **Prodotti**: Microsoft 365, Office, Teams, SharePoint, Exchange
- **Refresh**: `npm run refresh:m365roadmap`
- **Formato**: REST API JSON

### Esecuzione Refresh Completo

```bash
# Refresh singola fonte
npm run refresh:microsoft
npm run refresh:eos
npm run refresh:fabric
npm run refresh:m365roadmap

# Refresh tutte le fonti (manuale)
npm run refresh:microsoft && npm run refresh:eos && npm run refresh:fabric && npm run refresh:m365roadmap
```

---

## 👥 Gestione Clienti

UpdateLens supporta configurazioni multi-cliente con:

- **Filtri Personalizzati** - Ogni cliente può avere regole di filtro custom
- **Modalità Override** - Modalità `global`, `custom`, `disabled` per cliente
- **Persistenza Locale** - Configurazioni salvate in `localStorage`
- **Selezione Globale** - Dropdown per switch rapido tra clienti
- **Stato Attivo/Inattivo** - Gestione visibilità clienti

### Workflow Cliente

1. Vai su **Clienti** → Crea nuovo cliente
2. Configura filtri personalizzati (o eredita da globali)
3. Imposta modalità: `global` (eredita), `custom` (override), `disabled` (escluso)
4. Seleziona cliente dal dropdown globale per visualizzare dati filtrati

---

## 🔧 Configurazione

### Aggiornamento Versione

Modifica `src/version.ts`:

```typescript
export const lastUpdateTitle = 'Titolo aggiornamento';
export const lastUpdateDate = '2026-01-23';
export const lastUpdateNotes = [
  'Nota 1',
  'Nota 2'
];
```

### Variabili Ambiente (Backend Opzionale)

Crea `.env` nella root:

```bash
# Release Plans Ingestion
RELEASEPLANS_URL=https://releaseplans.microsoft.com/en-US/allreleaseplans/
RELEASEPLANS_LANG=en-US
RELEASEPLANS_CRON=0 */6 * * *

# GitHub Issues Integration
GITHUB_ISSUES_TOKEN=ghp_your_token_here
GITHUB_OWNER=your-org
GITHUB_REPO=your-repo
```

---

## 🐛 GitHub Issues Integration

La funzionalità **Issues** permette di leggere e creare segnalazioni GitHub direttamente dal portale.

### Modalità Locale (Offline/Dev)

1. Vai su **Issues**
2. Clicca **Configura Token**
3. Inserisci un **GitHub Personal Access Token (PAT)**
   - Permessi richiesti (Fine-grained): `Issues: Read & Write`, `Metadata: Read-only`
   - Permessi richiesti (Classic): `repo` scope
4. Il token viene salvato in `localStorage` (`updatelens.github.pat.issues`)
5. Le richieste vengono fatte **direttamente a GitHub API** dal browser

### Modalità Web (Server Proxy)

1. Configura `GITHUB_ISSUES_TOKEN` nel server (variabile ambiente)
2. Opzionalmente imposta `GITHUB_OWNER` e `GITHUB_REPO`
3. Gli utenti **non vedono mai il token**
4. Le richieste vengono proxate dal backend

### Funzionalità Issues

- ✅ Visualizzazione lista issues (open/closed)
- ✅ Ricerca e filtri
- ✅ Creazione nuove issue con:
  - Titolo e descrizione (Markdown)
  - Labels
  - Upload immagini (solo modalità Web)
- ✅ Validazione token con test preventivo
- ✅ Gestione errori e stati vuoti

---

## 🖥️ Backend Opzionale

Il backend Node.js esegue:
- Ingestione periodica da Microsoft Release Plans
- Storage in SQLite
- API REST interne
- Proxy GitHub Issues (modalità Web)

### Avvio Backend

```bash
# Ingestione manuale
npm run ingest:releaseplans

# Server dev
npm run server:dev
```

### Endpoint API

```
GET  /api/releaseplans          # Lista release plans
GET  /api/releaseplans/:planId  # Dettaglio plan
GET  /api/releaseplans/meta     # Metadata
GET  /api/releaseplans/changes  # Changelog (query: ?since=YYYY-MM-DD)

# GitHub Issues Proxy (solo modalità Web)
GET  /api/github/issues         # Lista issues
POST /api/github/issues         # Crea issue
POST /api/github/upload         # Upload immagine
```

---

## 📁 Struttura Progetto

```
UpdateLens/
├── src/
│   ├── app/
│   │   ├── components/      # Componenti React riutilizzabili
│   │   └── pages/           # Pagine principali (Dashboard, Clienti, Issues, etc.)
│   ├── data/
│   │   ├── config/          # Configurazioni (products.catalog.json, rules.json)
│   │   └── snapshots/       # Snapshot dati (*.json, latest.json)
│   ├── models/              # Zod schemas e TypeScript types
│   ├── services/            # Business logic (DataLoader, FilterService, etc.)
│   └── utils/               # Utility functions
├── tools/                   # Script refresh fonti dati
├── server/                  # Backend opzionale (Express + SQLite)
├── public/                  # Asset statici
└── docs/                    # Documentazione
```

---

## 📖 Guida Utente

### Workflow Base

1. **Apri il portale** - `index.html` (offline) o URL web
2. **Seleziona cliente** - Dropdown in alto (default: "Tutti i clienti")
3. **Applica filtri** - Fonte, stato, prodotto, date, etc.
4. **Visualizza dashboard** - KPI cards + lista release items
5. **Drill-down** - Click su KPI per filtrare per fonte/prodotto
6. **Export** - Genera report Markdown personalizzato

### Gestione Filtri

- **Filtri Globali** - Vai su **Filtri Globali** → Configura regole default
- **Filtri Cliente** - Vai su **Clienti** → Seleziona cliente → Configura override
- **Filtri Dashboard** - Usa sidebar per filtri temporanei (non persistiti)

### Persistenza Dati

- **LocalStorage** - Tutte le preferenze (clienti, filtri, token GitHub)
- **Snapshot Files** - Dati fonte in `public/data/*.json`
- **No Database** - Nessun database lato client

---

## 🧪 Testing

```bash
# Type checking
npm run typecheck

# Test URL Release Plans
npm run test:releaseplans
```

---

## 📦 Deployment

### Build Release

```bash
npm run build:release
```

Genera cartella `release/` con:
```
release/
├── index.html          # Entry point
├── assets/             # JS/CSS bundled
└── data/               # Snapshot JSON
```

### Distribuzione ZIP

1. Comprimi cartella `release/` → `UpdateLens_vX.X.X.zip`
2. Distribuisci ZIP ai clienti
3. Istruzioni: "Estrai ZIP → Apri index.html"

---

## 🔒 Vincoli Runtime

- ✅ **Offline-first** - Funziona senza internet (eccetto Issues in modalità locale)
- ✅ **File Protocol** - Supporta `file://` protocol
- ✅ **No Backend Required** - Backend opzionale solo per ingestion/proxy
- ✅ **Browser Moderni** - Chrome, Firefox, Edge, Safari (ES2020+)

---

## 📚 Documentazione Aggiuntiva

### Per Utenti
- **[Guida Utente](./docs/USER_GUIDE.md)** - Guida completa all'uso del portale (Dashboard, Clienti, Filtri, Issues, Export)

### Per Sviluppatori
- **[Developer Guide](./docs/DEVELOPER_GUIDE.md)** - Setup ambiente, workflow, convenzioni di codice
- **[Architettura](./docs/ARCHITECTURE.md)** - Architettura dettagliata, componenti, flusso dati
- **[Implementation Plan](./implementation_plan.md)** - Piano architetturale e decisioni tecniche
- **[Data Source Integration Template](./docs/DATA_SOURCE_INTEGRATION_TEMPLATE.md)** - Guida per integrare nuove fonti dati

### Altro
- **[Tasks](./tasks.md)** - Task list, roadmap e future enhancements
- **[Changelog](#-changelog)** - Storico versioni (vedi sotto)

---

## 📝 Changelog

### v0.3.0 (2026-01-23)
- ✅ Integrazione GitHub Issues (lettura/creazione)
- ✅ Persistenza token GitHub in localStorage
- ✅ Upload immagini via GitHub Content API (modalità Web)
- ✅ Validazione token con test preventivo

### v0.2.0
- ✅ Integrazione Microsoft 365 Roadmap (4a fonte dati)
- ✅ Gestione multi-cliente avanzata
- ✅ Filtri globali e per-cliente
- ✅ Dashboard con drill-down

### v0.1.0
- ✅ MVP con 3 fonti dati (Microsoft, EOS, Fabric)
- ✅ Offline-first architecture
- ✅ Export Markdown

---

## 👤 Autore

**Alessandro Levantini**  
Project Owner & Lead Developer

---

## 🤝 Contributi

Per aggiungere nuove fonti dati, segui il template in:
**[docs/DATA_SOURCE_INTEGRATION_TEMPLATE.md](./docs/DATA_SOURCE_INTEGRATION_TEMPLATE.md)**

---

**UpdateLens** - Mantieni il controllo sugli aggiornamenti Microsoft, EOS e Fabric 🚀
