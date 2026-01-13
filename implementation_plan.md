# UpdateLens Implementation Plan

## Goal
Build "UpdateLens", an offline-first static web portal to analyze Microsoft Release Plans and EOS Apps updates. The app runs locally with no backend services and uses local snapshots plus optional refresh tools.

## Scope (V1)
- Offline-first React app (Vite + TS + Tailwind).
- Local JSON snapshots for Microsoft Release Plans and EOS Apps.
- Two connectors (internal scripts) to refresh snapshots from:
  - https://releaseplans.microsoft.com/it-it/allreleaseplans/
  - https://docs.eos-solutions.it/it/docs/apps-func/whats-new-eos-apps.html
- Dashboard with filters, cards, and export to Markdown.
- User preferences stored in LocalStorage.
- UI language: Italian.

## Non-Goals (V1)
- No backend, no DB, no server APIs.
- No PDF/HTML export.
- No authentication.

## Tech Stack
- Vite + React + TypeScript
- Tailwind CSS
- Zod (schema validation)
- Zustand or React Context (state; pick simplest)
- Optional: Recharts for charts (only if needed)

## Data Strategy
### Snapshots
Store in `src/data/snapshots/`:
- `microsoft_releaseplans_<date>.json`
- `eos_whatsnew_<date>.json`
Also provide a pointer to the "active" snapshots:
- `src/data/snapshots/latest.json` with `{ "microsoft": "<filename>", "eos": "<filename>" }`

### Normalized Model
`src/models/ReleaseItem.ts`
- id, source, product, title, summary, status, availabilityDate, url

### Config
`src/data/config/`
- `products.json` (catalog)
- `rules.json` (default filter rules)
- `customers/<id>.json` (per-customer overrides)

### Runtime Data Loading
- `DataLoader` loads `latest.json`, then fetches the referenced snapshot files at runtime.
- If a snapshot is missing or invalid, show a friendly Italian error and fall back to empty state.

### Dedup & Conflict Rules
- Deduplicate by `source + url` (fallback: `source + title + availabilityDate`).
- If duplicates exist, keep the item with the newest `availabilityDate`.

### Date Parsing
- Normalize all dates to ISO `YYYY-MM-DD` during snapshot generation.
- Use local timezone only for display; filtering uses normalized dates.

## Customer Concepts
- Cliente in focus: selezione globale usata per dashboard e filtri cliente.
- Stato cliente (attivo/inattivo): flag persistente; i clienti inattivi sono esclusi da selezioni e filtri.

## Connectors (Tools)
### 1) Microsoft Release Plans
`tools/refreshMicrosoft.ts`
- Fetch page HTML or JSON endpoint if available.
- Parse list items into normalized structure.
- Save snapshot JSON to `src/data/snapshots/`.
- Update `latest.json` to point to the new file.

### 2) EOS Apps What's New
`tools/refreshEos.ts`
- Fetch HTML from EOS docs URL.
- Parse headings and list items.
- Save snapshot JSON to `src/data/snapshots/`.
- Update `latest.json` to point to the new file.

Note: These tools are developer-only and not used at runtime.

## App Architecture
```
src/
  app/
    components/
    pages/
    hooks/
  data/
    snapshots/
    config/
  exports/
  models/
  services/
```

### Core Services
- `DataLoader`: load snapshots + config.
- `FilterService`: apply filters (product, status, date horizon, source).
- `ExportService`: generate Markdown and trigger download.
- `StorageService`: LocalStorage persistence for preferences.

## UI/UX Direction
- Use the provided reference style:
  - Clean, soft background, card-based layout.
  - Rounded corners, gentle shadows, green primary.
  - Clear sidebar navigation, top search, dashboard cards.
- Typography: select a non-default Google font (Italian-friendly).
- Italian labels, filter names, and export text.

## Delivery
- Build with `npm run build`.
- ZIP layout:
  - `/app` (dist assets)
  - `/data` (snapshots + config)
  - `index.html`

## Verification
### Automated
- `npm run build`
- `npm run typecheck` (if configured)

### Manual
- Open `dist/index.html` and verify:
  - Loads without network.
  - Filters work.
  - Export Markdown downloads and content is Italian.
  - Preferences persist in LocalStorage.
