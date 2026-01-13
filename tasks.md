# UpdateLens Tasks

## Phase 0 - Setup
- [x] Confirm UI reference and palette from provided example.
- [x] Scaffold Vite + React + TypeScript project.
- [x] Install Tailwind and configure base styles.
- [x] Create base folder structure under `src/`.

## Phase 1 - Data and Models
- [x] Define `ReleaseItem` model and Zod schema.
- [x] Create `products.json` and `rules.json`.
- [x] Add initial mock snapshots in `src/data/snapshots/`.

## Phase 2 - Connectors (Tools)
- [x] Implement `tools/refreshMicrosoft.ts`.
- [x] Implement `tools/refreshEos.ts`.
- [x] Normalize and validate output structure.
- [x] Document how to run tools in README.
- [x] Write/update `src/data/snapshots/latest.json` on refresh.

## Phase 3 - Core Services
- [x] Implement `DataLoader` (load config + snapshots).
- [x] Implement `FilterService` (products, status, date, source).
- [x] Implement `ExportService` (Markdown).
- [x] Implement `StorageService` (LocalStorage).
- [x] Align `DataLoader` to read `latest.json` and fetch snapshots at runtime.
- [x] Add friendly error UI for missing/invalid snapshots (Italian).

## Phase 4 - UI
- [x] Layout: sidebar + top bar + main dashboard.
- [x] Filters: product list, status, date horizon, source.
- [x] Cards/list for release items.
- [x] Export button with preview/download.
- [x] Empty states and loading states (Italian).

## Phase 5 - QA and Packaging
- [x] Run build.
- [ ] Verify offline load.
- [ ] Verify LocalStorage persistence.
- [x] Package ZIP with `/assets`, `/data`, `index.html`.
- [x] Add short user guide in README.
- [ ] Verify date parsing and dedup rules with a quick sample check.
