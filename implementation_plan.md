# UpdateLens Implementation Plan

## Goal
Build "UpdateLens", an offline-first static web portal to analyze Microsoft Release Plans, EOS Apps, Microsoft Fabric Roadmap, and Microsoft 365 Roadmap updates. The app runs locally with no backend services (optional backend for ingestion/proxy) and uses local snapshots plus refresh tools.

## Scope (Current Version - v0.3.0)

### Core Features ✅
- Offline-first React app (Vite + TS + Tailwind + Zustand).
- Local JSON snapshots for **4 data sources**:
  - Microsoft Release Plans
  - EOS Apps What's New
  - Microsoft Fabric Roadmap
  - Microsoft 365 Roadmap
- Four connectors (internal scripts) to refresh snapshots.
- Dashboard with KPI cards, filters, drill-down, and export to Markdown.
- **Multi-client management** with per-customer filter overrides.
- **Global filters** with bulk apply to customers.
- **GitHub Issues integration** (read/create issues, image upload).
- User preferences stored in LocalStorage.
- UI language: Italian.

### Optional Backend ✅
- Express + SQLite for Release Plans ingestion.
- API endpoints for internal use.
- GitHub Issues proxy for Web mode.
- Cron scheduler for periodic data refresh.

## Non-Goals (Current Version)
- No PDF/HTML export (only Markdown).
- No authentication (optional for future Web mode).
- No real-time updates (snapshot-based).

## Tech Stack

### Frontend
- **Framework**: Vite + React 18 + TypeScript
- **Styling**: Tailwind CSS (custom design system)
- **State Management**: Zustand
- **Validation**: Zod (schema validation)
- **Routing**: React Router v6
- **Build**: Vite (with custom release build for file:// protocol)

### Backend (Optional)
- **Runtime**: Node.js + Express
- **Database**: SQLite + Better-SQLite3
- **Scheduler**: node-cron
- **Scraping**: Cheerio (for HTML parsing)

### Tools
- **TypeScript Execution**: tsx
- **Package Manager**: npm
- **Version Control**: Git

## Data Strategy

### Snapshots
Store in `src/data/snapshots/` and `public/data/`:
- `microsoft_releaseplans_YYYY_MM_DD.json`
- `eos_whatsnew_YYYY_MM_DD.json`
- `fabric_roadmap_YYYY_MM_DD.json`
- `m365roadmap_data_YYYY_MM_DD.json`

Also provide a pointer to the "active" snapshots:
- `src/data/snapshots/latest.json` with:
  ```json
  {
    "microsoft": "microsoft_releaseplans_2026_01_23.json",
    "eos": "eos_whatsnew_2026_01_23.json",
    "fabric": "fabric_roadmap_2026_01_23.json",
    "m365roadmap": "m365roadmap_data_2026_01_22.json"
  }
  ```

### Normalized Model
`src/models/ReleaseItem.ts` - Unified schema for all sources:

```typescript
type ReleaseItem = {
  // Core fields (required)
  id: string;
  source: 'Microsoft' | 'EOS' | 'Fabric' | 'MICROSOFT 365';
  product: string;
  productName: string;
  title: string;
  summary: string;
  description: string;
  status: 'Planned' | 'Rolling out' | 'Try now' | 'Launched' | 'Unknown';
  availabilityDate: string; // YYYY-MM format
  releaseDate: string; // ISO date format
  tryNow: boolean;
  minBcVersion: number | null;

  // Optional fields
  productId?: string;
  releasePlanId?: string | null;
  category?: string;
  tags?: string[];
  wave?: string;
  availabilityTypes?: string[];
  geography?: string;
  sourceUrl?: string | null;
  learnUrl?: string | null;
  // ... other optional fields
};
```

### Config Files
`src/data/config/`:
- **`products.catalog.json`** - Product catalog with categories
- **`rules.json`** - Default filter rules (global defaults)
- **`customers/`** - Per-customer overrides (stored in LocalStorage, not files)

### Runtime Data Loading
- `DataLoader` loads `latest.json`, then fetches the referenced snapshot files at runtime.
- Supports both `file://` protocol (offline) and HTTP (web).
- If a snapshot is missing or invalid, shows a friendly Italian error and falls back to empty state.
- Validates all items with Zod schema, skips invalid items with logging.

### Dedup & Conflict Rules
- Deduplicate by `source + id` (primary key).
- Fallback: `source + title + availabilityDate`.
- If duplicates exist, keep the item with the newest `availabilityDate`.

### Date Parsing
- Normalize all dates to ISO `YYYY-MM-DD` during snapshot generation.
- `availabilityDate` stored as `YYYY-MM` for filtering.
- Use local timezone only for display; filtering uses normalized dates.

## Multi-Client Architecture

### Customer Concepts
- **Cliente in focus**: Global selection used for dashboard and customer filters.
- **Customer state** (active/inactive): Persistent flag; inactive customers are excluded from selections and filters.
- **Filter modes**:
  - `global`: Inherit global filters
  - `custom`: Use customer-specific overrides
  - `disabled`: Exclude customer from all filtering

### Customer Data Model
```typescript
type Customer = {
  id: string;
  name: string;
  isActive: boolean;
  filterMode: 'global' | 'custom' | 'disabled';
  filters: FilterState; // Custom overrides
};
```

### Filter Hierarchy
1. **Global Filters** (defined in GlobalFiltersPage)
   - Default rules applied to all customers in `global` mode
   - Can be bulk-applied to specific customers
2. **Customer Filters** (defined per customer)
   - Override global filters when `filterMode === 'custom'`
   - Stored in LocalStorage per customer ID
3. **Dashboard Filters** (temporary)
   - Session-only filters applied in Dashboard
   - Not persisted

### Safety Constraints
- When in **Customer Scope** (activeCustomerId set):
  - Bulk operations are **disabled**
  - Filter changes affect **only** the active customer
  - Preview shows **only** the active customer
- When in **Global Scope** (no activeCustomerId):
  - Bulk operations are **enabled**
  - Filter changes affect global defaults
  - Preview shows all included customers

## GitHub Issues Integration

### Architecture
- **Local Mode** (file:// protocol):
  - Token stored in `localStorage` (`updatelens.github.pat.issues`)
  - Direct API calls from browser to GitHub API
  - Image uploads **not supported** (CORS limitations)
- **Web Mode** (HTTP server):
  - Token stored in server environment (`GITHUB_ISSUES_TOKEN`)
  - API calls proxied through backend
  - Image uploads via GitHub Content API (stored in `main` branch `/public/uploads/`)

### Features
- List issues (open/closed) with pagination
- Search and filter issues
- Create new issue with:
  - Title and description (Markdown support)
  - Labels (multi-select)
  - Image attachments (Web mode only)
- Token validation with test button
- Error handling and empty states

### API Endpoints (Web Mode)
```
GET  /api/github/issues         # List issues
POST /api/github/issues         # Create issue
POST /api/github/upload         # Upload image to GitHub
```

## Connectors (Tools)

### 1) Microsoft Release Plans
`tools/refreshMicrosoft.ts`
- Fetch page HTML from https://releaseplans.microsoft.com/
- Parse list items into normalized structure.
- Save snapshot JSON to `src/data/snapshots/` and `public/data/`.
- Update `latest.json` to point to the new file.

### 2) EOS Apps What's New
`tools/refreshEos.ts`
- Fetch HTML from EOS docs URL.
- Parse headings and list items.
- Save snapshot JSON.
- Update `latest.json`.

### 3) Microsoft Fabric Roadmap
`tools/refreshFabric.ts`
- Fetch JSON from Fabric GPS API.
- Transform to ReleaseItem schema.
- Save snapshot JSON.
- Update `latest.json`.

### 4) Microsoft 365 Roadmap
`tools/refreshM365Roadmap.ts`
- Fetch JSON from M365 Roadmap API.
- Transform to ReleaseItem schema.
- Save snapshot JSON.
- Update `latest.json`.

**Note**: These tools are developer-only and not used at runtime.

## App Architecture

```
src/
  app/
    components/         # Reusable React components
      CustomerSelector.tsx
      FilterSidebar.tsx
      ReleaseCard.tsx
      ExportModal.tsx
      GitHubTokenModal.tsx
      IssueCreateModal.tsx
      ...
    pages/              # Main application pages
      DashboardPage.tsx
      ClientsPage.tsx
      GlobalFiltersPage.tsx
      IssuesPage.tsx
      VersionPage.tsx
    hooks/              # Custom React hooks
  data/
    snapshots/          # JSON snapshot files
      latest.json
      microsoft_releaseplans_*.json
      eos_whatsnew_*.json
      fabric_roadmap_*.json
      m365roadmap_data_*.json
    config/             # Configuration files
      products.catalog.json
      rules.json
  exports/              # Export utilities
  models/               # Zod schemas and TypeScript types
    ReleaseItem.ts
    Customer.ts
    FilterState.ts
  services/             # Business logic
    DataLoader.ts       # Load and parse snapshots
    FilterService.ts    # Apply filters to items
    FilterDefinitions.ts # Filter capabilities per source
    ExportService.ts    # Generate Markdown exports
    StorageService.ts   # LocalStorage persistence
    GitHubService.ts    # GitHub API integration
  utils/                # Utility functions
    productColors.ts    # Color mapping for products
    dateUtils.ts
    textUtils.ts
```

### Core Services

#### DataLoader
- Load `latest.json` manifest
- Fetch snapshot files (supports file:// and HTTP)
- Parse and validate with Zod schema
- Normalize data across sources
- Handle errors gracefully

#### FilterService
- Apply filters: product, status, date horizon, source, geography, etc.
- Support source-specific filter capabilities
- Deduplication logic
- Sorting and grouping

#### FilterDefinitions
- Define supported filters per source:
  - Microsoft: All filters (wave, geography, enabledFor, etc.)
  - EOS: Most filters (no wave)
  - Fabric: Subset (no wave, geography)
  - M365 Roadmap: Similar to Fabric
- Provide helper functions for filter validation

#### ExportService
- Generate Markdown from filtered items
- Support customer-specific exports
- Include metadata (date, filters applied)
- Trigger browser download

#### StorageService
- Persist customer data in LocalStorage
- Persist filter states (global + per-customer)
- Persist GitHub token (local mode)
- Persist UI preferences (active customer, etc.)

#### GitHubService
- Detect mode (local vs web)
- Fetch issues from GitHub API
- Create issues with Markdown body
- Upload images (web mode only)
- Validate token

## UI/UX Direction

### Design System
- **Colors**: Custom Tailwind palette with dark mode support
- **Typography**: System fonts with careful hierarchy
- **Components**: Card-based layout, rounded corners, subtle shadows
- **Interactions**: Hover states, smooth transitions, drill-down
- **Responsive**: Mobile-first, tablet, desktop breakpoints

### Color Families by Source
- **Microsoft**: Blue (`bg-blue-600`)
- **EOS**: Amber (`bg-amber-600`)
- **Fabric**: Teal/Cyan (`bg-teal-600`)
- **M365 Roadmap**: Purple (`bg-purple-600`)

### Pages

#### DashboardPage
- KPI cards for each source (clickable for drill-down)
- Filter sidebar (temporary filters)
- Release items list/grid
- Export button
- Customer selector dropdown

#### ClientsPage
- Customer list with CRUD operations
- Filter mode selector (global/custom/disabled)
- Active/Inactive toggle
- Per-customer filter configuration

#### GlobalFiltersPage
- Global filter rules editor
- Preview of included customers
- Bulk apply to customers
- Safety: Disabled when in customer scope

#### IssuesPage
- GitHub token configuration
- Issues list (open/closed tabs)
- Search and filters
- Create issue modal
- Image upload (web mode)

#### VersionPage
- Changelog
- Build info (version, commit, build time)
- Credits

## Delivery

### Build Process
```bash
# Development
npm run dev

# Production build (for web server)
npm run build

# Release build (for file:// protocol)
npm run build:release
```

### Release Build
- Generates `release/` folder with:
  - `index.html` (entry point)
  - `assets/` (bundled JS/CSS with inlined paths)
  - `data/` (snapshot JSON files)
- Optimized for `file://` protocol (no server required)
- All assets inlined or relatively pathed

### ZIP Distribution
```
UpdateLens_v0.3.0.zip
├── index.html
├── assets/
│   ├── index-[hash].js
│   └── index-[hash].css
└── data/
    ├── latest.json
    ├── microsoft_releaseplans_2026_01_23.json
    ├── eos_whatsnew_2026_01_23.json
    ├── fabric_roadmap_2026_01_23.json
    └── m365roadmap_data_2026_01_22.json
```

## Verification

### Automated
- `npm run build` - Verify build succeeds
- `npm run typecheck` - TypeScript type checking
- `npm run test:releaseplans` - Test Release Plans URL

### Manual
- Open `release/index.html` and verify:
  - Loads without network (offline)
  - All 4 sources load correctly
  - Filters work (global + customer)
  - Customer management works
  - Export Markdown downloads and content is Italian
  - Preferences persist in LocalStorage
  - GitHub Issues integration works (local + web mode)

## Environment Variables

### Backend (Optional)
```bash
# Release Plans Ingestion
RELEASEPLANS_URL=https://releaseplans.microsoft.com/en-US/allreleaseplans/
RELEASEPLANS_LANG=en-US
RELEASEPLANS_CRON=0 */6 * * *

# GitHub Issues (Web Mode)
GITHUB_ISSUES_TOKEN=ghp_your_token_here
GITHUB_OWNER=your-org
GITHUB_REPO=your-repo

# Server
PORT=3000
NODE_ENV=production
```

## Constraints

### Runtime
- Must work offline (file:// protocol)
- No mandatory backend (backend is optional)
- Browser compatibility: Chrome, Firefox, Edge, Safari (ES2020+)
- LocalStorage for all persistence (no cookies, no IndexedDB)

### Performance
- Initial load < 3s (with cached snapshots)
- Filter operations < 500ms (for datasets up to 10k items)
- Export generation < 1s

### Security
- GitHub token stored in LocalStorage (local mode) - user responsibility
- GitHub token stored in server env (web mode) - never exposed to client
- No XSS vulnerabilities (React escapes by default)
- No CSRF (no cookies, no sessions)

## Future Considerations

### Scalability
- If snapshot files exceed 10MB, consider:
  - Compression (gzip)
  - Lazy loading by source
  - IndexedDB for large datasets

### Extensibility
- New data sources can be added following the template in:
  `docs/DATA_SOURCE_INTEGRATION_TEMPLATE.md`
- Estimated effort: 10-15 hours per source

### Internationalization
- Currently Italian-only
- Future: Add i18n support (English, Italian)
- Estimated effort: 20-30 hours

---

**Last Updated**: 2026-01-23  
**Version**: 0.3.0  
**Status**: ✅ Production Ready
