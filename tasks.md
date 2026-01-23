# UpdateLens Tasks

## Phase 0 - Setup ✅
- [x] Confirm UI reference and palette from provided example.
- [x] Scaffold Vite + React + TypeScript project.
- [x] Install Tailwind and configure base styles.
- [x] Create base folder structure under `src/`.

## Phase 1 - Data and Models ✅
- [x] Define `ReleaseItem` model and Zod schema.
- [x] Create `products.json` and `rules.json`.
- [x] Add initial mock snapshots in `src/data/snapshots/`.
- [x] Extend schema for 4 data sources (Microsoft, EOS, Fabric, M365 Roadmap).

## Phase 2 - Connectors (Tools) ✅
- [x] Implement `tools/refreshMicrosoft.ts`.
- [x] Implement `tools/refreshEos.ts`.
- [x] Implement `tools/refreshFabric.ts`.
- [x] Implement `tools/refreshM365Roadmap.ts`.
- [x] Normalize and validate output structure.
- [x] Document how to run tools in README.
- [x] Write/update `src/data/snapshots/latest.json` on refresh.

## Phase 3 - Core Services ✅
- [x] Implement `DataLoader` (load config + snapshots).
- [x] Implement `FilterService` (products, status, date, source).
- [x] Implement `ExportService` (Markdown).
- [x] Implement `StorageService` (LocalStorage).
- [x] Align `DataLoader` to read `latest.json` and fetch snapshots at runtime.
- [x] Add friendly error UI for missing/invalid snapshots (Italian).
- [x] Support 4 data sources in DataLoader.

## Phase 4 - UI ✅
- [x] Layout: sidebar + top bar + main dashboard.
- [x] Filters: product list, status, date horizon, source.
- [x] Cards/list for release items.
- [x] Export button with preview/download.
- [x] Empty states and loading states (Italian).
- [x] Dashboard with KPI cards for all 4 sources.
- [x] Drill-down functionality (source → product).

## Phase 5 - Multi-Client Management ✅
- [x] Implement ClientsPage with CRUD operations.
- [x] Customer filter mode: `global`, `custom`, `disabled`.
- [x] Per-customer filter overrides.
- [x] Global customer selector dropdown.
- [x] Customer state persistence in LocalStorage.
- [x] Active/Inactive customer status.

## Phase 6 - Global Filters ✅
- [x] Implement GlobalFiltersPage.
- [x] Define global filter rules (default for all customers).
- [x] Bulk apply filters to included customers.
- [x] Customer-specific filter safety (prevent bulk operations in customer scope).
- [x] Filter preview with included customer count.

## Phase 7 - GitHub Issues Integration ✅
- [x] Implement IssuesPage.
- [x] GitHub PAT configuration modal.
- [x] Token persistence in LocalStorage (`updatelens.github.pat.issues`).
- [x] Token validation with test button.
- [x] List issues (open/closed) with search and filters.
- [x] Create new issue with title, description (Markdown), labels.
- [x] Image upload support (Web mode only via GitHub Content API).
- [x] Server proxy mode for Web deployment.
- [x] Error handling and empty states.

## Phase 8 - Backend (Optional) ✅
- [x] Express server setup.
- [x] SQLite database schema.
- [x] Release Plans ingestion script.
- [x] API endpoints: `/api/releaseplans`, `/api/releaseplans/:id`, `/api/releaseplans/meta`.
- [x] Cron scheduler for periodic ingestion.
- [x] GitHub Issues proxy endpoints (Web mode).

## Phase 9 - QA and Packaging ✅
- [x] Run build.
- [x] Verify offline load.
- [x] Verify LocalStorage persistence.
- [x] Package ZIP with `/assets`, `/data`, `index.html`.
- [x] Add short user guide in README.
- [x] Verify date parsing and dedup rules with sample check.
- [x] Test all 4 data sources integration.
- [x] Test GitHub Issues flow (local + web mode).

## Phase 10 - Documentation ✅
- [x] Update README with all features.
- [x] Create DATA_SOURCE_INTEGRATION_TEMPLATE.md.
- [x] Document GitHub Issues setup (local + web).
- [x] Document multi-client workflow.
- [x] Add changelog to README.

---

## Future Enhancements 🚀

### High Priority
- [ ] Automated refresh scheduler (cron job for all sources).
- [ ] Export to PDF/HTML (in addition to Markdown).
- [ ] Advanced analytics dashboard (charts, trends).
- [ ] Notification system for new releases.

### Medium Priority
- [ ] User authentication (optional for Web mode).
- [ ] Role-based access control (Admin, Viewer).
- [ ] Custom tags and categorization.
- [ ] Saved filter presets.
- [ ] Dark mode toggle (currently auto-detects system preference).

### Low Priority
- [ ] Multi-language support (English, Italian).
- [ ] Mobile app (React Native).
- [ ] Integration with Teams/Slack for notifications.
- [ ] AI-powered release summarization.

---

## Known Issues 🐛

- [ ] Search placeholder centering on IssuesPage (minor visual issue).
- [ ] Large snapshot files (>5MB) may cause slow initial load.
- [ ] GitHub image uploads limited to 1MB per file.

---

## Technical Debt 💳

- [ ] Refactor FilterService for better performance with large datasets.
- [ ] Add unit tests for critical services (DataLoader, FilterService).
- [ ] Add E2E tests with Playwright/Cypress.
- [ ] Optimize bundle size (code splitting, lazy loading).
- [ ] Add TypeScript strict mode.

---

**Last Updated**: 2026-01-23
**Version**: 0.3.0
