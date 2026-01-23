# UpdateLens

**UpdateLens** è un portale web statico e offline per analizzare, filtrare e presentare gli aggiornamenti da tre fonti: **Microsoft Release Plans**, **EOS Apps** e **Microsoft Fabric Roadmap**.

Funziona completamente offline con snapshot locali. In alternativa, è disponibile un backend opzionale per ingestione e API interne.

---

## Funzionalita principali (V1)

- Web app offline-first
- Distribuzione via ZIP
- Catalogo prodotti e regole globali
- Selezioni per cliente e preferenze locali
- Dashboard con filtri
- Export Markdown
- Snapshot locali dei dati

---

## Tech Stack

- Vite + React + TypeScript
- Tailwind CSS
- Zod

---

## Setup sviluppo

```bash
npm install
npm run dev
```

## Build produzione

```bash
npm run build
```

---

## Aggiornamento info versione

Aggiorna le note di rilascio in `src/version.ts` modificando:

- `lastUpdateTitle`
- `lastUpdateDate`
- `lastUpdateNotes`

---

## Build offline (apertura file)

Per aprire `index.html` direttamente da file system (senza server), usa:

```bash
npm run build:release
```

Poi apri `release/index.html`.

---

## Guida utente rapida

1. Apri `index.html` dalla cartella di rilascio (offline).
2. Seleziona un cliente o resta su CSS globale.
3. Usa i filtri per fonte, stato, mese e testo.
4. Esporta in Markdown con "Esporta Markdown".
5. Le preferenze vengono salvate in LocalStorage del browser.

---

## Aggiornamento snapshot (tool interni)

I connettori per aggiornare le snapshot sono in `tools/` e non vengono eseguiti dai clienti.

### Fonti dati

**1. Microsoft Release Plans**
- Source: https://releaseplans.microsoft.com/
- Prodotti: Dynamics 365, Power Platform
- Refresh: `npm run refresh:microsoft`

**2. EOS What's New**
- Source: https://docs.eos-solutions.it/
- Prodotti: EOS Apps for Business Central
- Refresh: `npm run refresh:eos`

**3. Microsoft Fabric Roadmap**
- Source: https://fabric-gps.com/api/releases (Fabric GPS API)
- Prodotti: Data Factory, Power BI, OneLake, Data Warehouse, Real-Time Intelligence, etc.
- Refresh: `npm run refresh:fabric`

### Esecuzione refresh

```bash
npm run refresh:microsoft
npm run refresh:eos
npm run refresh:fabric
```

---

## Backend ingestion (opzionale)

Il backend Node.js esegue ingestione da `https://releaseplans.microsoft.com/en-US/allreleaseplans/`,
salva i dati in SQLite e espone API interne.

### Script

```bash
npm run ingest:releaseplans
npm run server:dev
```

### Variabili ambiente

- `RELEASEPLANS_URL` (default en-US)
- `RELEASEPLANS_LANG` (default `en-US`)
- `RELEASEPLANS_CRON` (default ogni 6 ore)

### Endpoint API

- `GET /api/releaseplans`
- `GET /api/releaseplans/:planId`
- `GET /api/releaseplans/meta`
- `GET /api/releaseplans/changes?since=...`

---

## Vincoli runtime

- Offline
- Apertura diretta di `index.html`
- Nessun servizio backend

---

## File principali

- `implementation_plan.md`
- `tasks.md`
- `src/data/snapshots/`
- `src/data/config/`

---

## Configurazione GitHub Issues

La funzionalità **Issues** permette di leggere e creare segnalazioni direttamente dal portale.

### In Locale (Offline / Dev)
1. Accedi alla pagina **Issues**.
2. Clicca su **Configura Token**.
3. Inserisci un **GitHub Personal Access Token (PAT)**.
   - I permessi necessari (Fine-grained) sono: `Issues: Read & Write` e `Metadata: Read-only`.
4. Il token viene salvato nel `localStorage` del browser e non viene mai inviato a server esterni (direttamente a GitHub API).

### In Web (Server Proxy)
1. Configura la variabile d'ambiente `GITHUB_ISSUES_TOKEN` sul server.
2. Opzionalmente, imposta `GITHUB_OWNER` e `GITHUB_REPO`.
3. Gli utenti non vedranno mai il token, le richieste verranno proxate dal backend.

---

Fine README.
