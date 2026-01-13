# UpdateLens

**UpdateLens** e un portale web statico e offline per analizzare, filtrare e presentare gli aggiornamenti dei Microsoft Release Plans e delle EOS Apps.

Funziona completamente offline con snapshot locali. In alternativa, e disponibile un backend opzionale per ingestione e API interne.

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

```bash
npm run refresh:microsoft
npm run refresh:eos
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

Fine README.
