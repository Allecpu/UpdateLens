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

## Phase 11 - Azure Migration ✅
- [x] Azure Functions deployment (Timer + HTTP triggers).
- [x] Azure Blob Storage integration for snapshots.
- [x] Azure App Service deployment for Web App.
- [x] Application Insights setup for monitoring.
- [x] GitHub Actions CI/CD pipelines.
- [x] Managed Identity configuration (System + User Assigned).
- [x] OIDC authentication for GitHub Actions.
- [x] Resource Groups setup (runtime + shared).
- [x] Migration from West Europe to Italy North.
- [x] Automated refresh scheduling (every 6 hours).

---

## Phase 12 - Governance & Automation ✅
- [x] **Azure Resource Tags** - Standardizzazione tags per governance, cost management e ownership.
  - [x] Tags comuni: Environment, Project, Owner, CostCenter, ManagedBy
  - [x] Applicazione a: Resource Groups, Web App, Functions, Storage, App Insights, App Service Plans
  - [x] Script PowerShell/CLI per applicazione batch (`scripts/azure-tags-apply.ps1`)
  - [x] Validazione compliance (`scripts/azure-tags-verify.ps1`)
  - [x] Documentation (`docs/AZURE_TAGS.md`)
  - [ ] Policy Azure per enforcement tags obbligatori

## Phase 13 - Advanced Documentation [/]
- [/] **Developer Architecture Update** - Aggiornamento `ARCHITECTURE.md` con dettagli Azure.
- [ ] **Developer Setup Guide** - Aggiornamento `DEVELOPER_GUIDE.md` con Azure setup.
- [ ] **Azure Deployment Guide** - Creazione `AZURE_DEPLOYMENT.md` completa.
- [ ] **User Guide Cloud Update** - Aggiornamento `USER_GUIDE.md` per modalità Web Cloud.

---

## Future Enhancements 🚀

### High Priority (Azure)
- [ ] **Azure Key Vault** - Secrets management sicuro (GitHub token, Function keys).
- [ ] **Application Insights Alerting** - Alert su failures, 5xx errors, storage quota.
- [ ] **Health Check Endpoint** - `/api/health` con diagnostics.
- [ ] **Export to PDF/HTML** - In addition to Markdown.
- [ ] **Advanced analytics dashboard** - Charts, trends, time-series.

### Medium Priority (Azure)
- [ ] **Cosmos DB** - Change tracking e storico modifiche.
- [ ] **Delta-based Snapshots** - Riduzione storage e bandwidth.
- [ ] **Email/Teams Notifications** - Notifiche nuove release.
- [ ] **User authentication** - Azure AD / Entra ID integration.
- [ ] **Role-based access control** - Admin, Viewer roles.
- [ ] **Custom tags and categorization** - Tagging personalizzato.
- [ ] **Saved filter presets** - Preset filtri salvati.

### Low Priority (Azure)
- [ ] **Private Endpoints** - VNet integration per Storage e Key Vault.
- [ ] **Azure OpenAI Integration** - Miglioramento chatbot e assistenza utenti.
- [ ] **CDN** - Azure CDN per snapshot delivery.
- [ ] **Multi-language support** - English, Italian.
- [ ] **Mobile app** - React Native.
- [ ] **Teams/Slack Integration** - Notifiche e bot.

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

**Last Updated**: 2026-02-02
**Version**: 0.4.0
