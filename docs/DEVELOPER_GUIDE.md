# UpdateLens - Developer Guide

## Indice

1. [Setup Ambiente](#setup-ambiente)
2. [Struttura Progetto](#struttura-progetto)
3. [Comandi NPM](#comandi-npm)
4. [Sviluppo](#sviluppo)
5. [Testing](#testing)
6. [Build e Deploy](#build-e-deploy)
7. [Aggiungere Nuove Fonti Dati](#aggiungere-nuove-fonti-dati)
8. [Convenzioni Codice](#convenzioni-codice)
9. [Troubleshooting](#troubleshooting)

---

## Setup Ambiente

### Prerequisiti

- **Node.js**: v18+ (consigliato v20 LTS)
- **npm**: v9+
- **Git**: v2.30+
- **Editor**: VS Code (consigliato) con estensioni:
  - ESLint
  - Prettier
  - TypeScript and JavaScript Language Features

### Installazione

```bash
# Clone repository
git clone https://github.com/your-org/UpdateLens.git
cd UpdateLens

# Install dependencies
npm install

# Start dev server
npm run dev
```

Il portale sarà disponibile su `http://localhost:5173`

### Variabili Ambiente (Opzionali)

Crea `.env` nella root:

```bash
# Backend (opzionale)
RELEASEPLANS_URL=https://releaseplans.microsoft.com/en-US/allreleaseplans/
RELEASEPLANS_LANG=en-US
RELEASEPLANS_CRON=0 */6 * * *

# GitHub Issues (Web mode)
GITHUB_ISSUES_TOKEN=ghp_your_token_here
GITHUB_OWNER=your-org
GITHUB_REPO=UpdateLens

# Server
PORT=3000
NODE_ENV=development
```

---

## Struttura Progetto

```
UpdateLens/
├── src/                          # Frontend source
│   ├── app/                      # React components
│   │   ├── components/           # Reusable components
│   │   └── pages/                # Page components
│   ├── data/                     # Static data
│   │   ├── config/               # Configuration files
│   │   └── snapshots/            # Data snapshots (dev)
│   ├── models/                   # Zod schemas & types
│   ├── services/                 # Business logic
│   ├── utils/                    # Utility functions
│   ├── App.tsx                   # Root component
│   ├── main.tsx                  # Entry point
│   └── version.ts                # Version info
│
├── tools/                        # Data refresh scripts
│   ├── refreshMicrosoft.ts
│   ├── refreshEos.ts
│   ├── refreshFabric.ts
│   ├── refreshM365Roadmap.ts
│   └── inlineReleaseAssets.ts
│
├── server/                       # Backend (optional)
│   ├── api.ts
│   ├── db.ts
│   ├── ingest.ts
│   └── index.ts
│
├── public/                       # Static assets
│   └── data/                     # Data snapshots (prod)
│
├── docs/                         # Documentation
├── dist/                         # Build output (web)
├── release/                      # Build output (offline)
│
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── README.md
```

---

## Comandi NPM

### Development

```bash
# Start dev server (hot reload)
npm run dev

# Type checking
npm run typecheck

# Build for production (web)
npm run build

# Build for offline (file://)
npm run build:release

# Preview production build
npm run preview
```

### Data Refresh

```bash
# Refresh single source
npm run refresh:microsoft
npm run refresh:eos
npm run refresh:fabric
npm run refresh:m365roadmap

# Test Release Plans URL
npm run test:releaseplans
```

### Backend (Optional)

```bash
# Ingest Release Plans
npm run ingest:releaseplans

# Start backend server
npm run server:dev
```

---

## Sviluppo

### Workflow Tipico

1. **Crea branch feature**
   ```bash
   git checkout -b feature/my-feature
   ```

2. **Sviluppa**
   ```bash
   npm run dev
   # Edit files
   # Test in browser
   ```

3. **Type check**
   ```bash
   npm run typecheck
   ```

4. **Build test**
   ```bash
   npm run build
   ```

5. **Commit**
   ```bash
   git add .
   git commit -m "feat: add my feature"
   ```

6. **Push e PR**
   ```bash
   git push origin feature/my-feature
   # Create Pull Request on GitHub
   ```

### Hot Reload

Vite supporta hot reload automatico:
- Modifiche a `.tsx`, `.ts`, `.css` → Reload istantaneo
- Modifiche a `vite.config.ts` → Riavvio server necessario

### Debugging

#### Browser DevTools

```typescript
// Add breakpoints in code
debugger;

// Console logging
console.log('Debug:', value);
console.table(array);
console.group('Group Name');
```

#### VS Code Debugging

Crea `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "chrome",
      "request": "launch",
      "name": "Launch Chrome",
      "url": "http://localhost:5173",
      "webRoot": "${workspaceFolder}/src"
    }
  ]
}
```

---

## Testing

### Type Checking

```bash
npm run typecheck
```

Verifica errori TypeScript senza build.

### Export PowerPoint

```bash
npm run test:deck
```

Genera un deck da uno snapshot reale in `tmp/` e verifica il pacchetto OOXML:
parti obbligatorie, numero di slide, deduplicazione dei logo negli slide master,
colori di brand, limite dei 6 bullet per slide e tetto complessivo del deck.

Il test verifica anche che le **dimensioni della slide** corrispondano a
`EOS_LAYOUT` e che **nessun oggetto esca dai bordi**: i preset di pptxgenjs non
corrispondono a queste misure (`LAYOUT_16x9` è 10 × 5.625 pollici) e con il
preset sbagliato logo, tile e grafici finiscono fuori slide senza che il file
risulti invalido.

Il test **non verifica la resa tipografica**. Per quella, esporta le slide in
PNG con PowerPoint e guardale:

```powershell
$ppt = New-Object -ComObject PowerPoint.Application
$pres = $ppt.Presentations.Open("C:\...\deck.pptx", $true, $false, $false)
$pres.SaveCopyAs("C:\out\s", 18)   # 18 = ppSaveAsPNG
$pres.Close(); $ppt.Quit()
```

#### Aggiungere un tipo di slide

1. Aggiungi la variante alla union `DeckSlide` in `src/exports/deckModel.ts`
2. Componila dentro `buildDeckModel` (funzione pura, nessuna dipendenza da pptxgenjs)
3. Aggiungi il `case` corrispondente in `renderSlide` (`src/exports/pptxRenderer.ts`) —
   lo `switch` è esaustivo, quindi senza il case il typecheck fallisce
4. Se la sezione è opzionale, aggiungi il flag a `DeckOptionsSchema` e la checkbox
   in `src/app/components/exports/ExportDeckModal.tsx`

Colori, font e geometria vanno presi **sempre** da `src/exports/brandTokens.ts`,
mai scritti inline: è l'unico punto in cui il Brand Book EOS è codificato.

### Manual Testing

1. **Offline Mode**
   ```bash
   npm run build:release
   # Open release/index.html in browser
   ```

2. **Web Mode**
   ```bash
   npm run build
   npm run preview
   # Open http://localhost:4173
   ```

3. **Test Checklist**
   - [ ] Dashboard loads without errors
   - [ ] All 4 sources display data
   - [ ] Filters work correctly
   - [ ] Customer management CRUD works
   - [ ] Global filters apply correctly
   - [ ] Export Markdown downloads
   - [ ] GitHub Issues integration works
   - [ ] LocalStorage persists data

### Future: Automated Tests

```bash
# Unit tests (Vitest)
npm run test

# E2E tests (Playwright)
npm run test:e2e

# Coverage
npm run test:coverage
```

---

## Build e Deploy

### Build Web (Production)

```bash
npm run build
```

Output: `dist/` folder

Deploy su:
- **Vercel**: `vercel deploy`
- **Netlify**: `netlify deploy`
- **Nginx/Apache**: Copia `dist/` su server

### Build Offline (Release)

```bash
npm run build:release
```

Output: `release/` folder

Distribuzione:
1. Comprimi `release/` → `UpdateLens_v0.3.0.zip`
2. Distribuisci ZIP
3. Utente: Estrai → Apri `index.html`

### Backend Deploy

```bash
# PM2 (consigliato)
pm2 start server/index.ts --name updatelens-server

# Docker (future)
docker build -t updatelens-server .
docker run -p 3000:3000 updatelens-server
```

---

## Aggiungere Nuove Fonti Dati

Segui il template completo in:  
**[docs/DATA_SOURCE_INTEGRATION_TEMPLATE.md](./DATA_SOURCE_INTEGRATION_TEMPLATE.md)**

### Quick Steps

1. **Crea script refresh**
   ```bash
   cp tools/refreshFabric.ts tools/refreshMySource.ts
   # Edit refreshMySource.ts
   ```

2. **Aggiorna models**
   ```typescript
   // src/models/ReleaseItem.ts
   export const ReleaseSourceSchema = z.enum([
     'Microsoft',
     'EOS',
     'Fabric',
     'MICROSOFT 365',
     'MySource' // NEW
   ]);
   ```

3. **Aggiorna DataLoader**
   ```typescript
   // src/services/DataLoader.ts
   const mySource = await loadSnapshotWithFallback(
     'MySource',
     isFileProtocol ? undefined : manifest?.mySource,
     'mysource_data_'
   );
   ```

4. **Aggiorna FilterDefinitions**
   ```typescript
   // src/services/FilterDefinitions.ts
   export const ALL_RELEASE_SOURCES: ReleaseSource[] = [
     'Microsoft',
     'EOS',
     'Fabric',
     'MICROSOFT 365',
     'MySource' // NEW
   ];
   ```

5. **Aggiorna Dashboard**
   ```tsx
   // src/app/pages/DashboardPage.tsx
   <button
     onClick={() => handleDrillSource('MySource')}
   >
     MySource: {count}
   </button>
   ```

6. **Aggiungi colori**
   ```typescript
   // src/utils/productColors.ts
   'MyProduct': {
     barClass: 'bg-green-500/90',
     badgeClass: 'bg-green-50 text-green-800'
   }
   ```

7. **Test**
   ```bash
   npm run refresh:mysource
   npm run dev
   # Verify data loads
   ```

---

## Convenzioni Codice

### TypeScript

```typescript
// Use explicit types
const items: ReleaseItem[] = [];

// Prefer interfaces for objects
interface Customer {
  id: string;
  name: string;
}

// Use Zod for validation
const schema = z.object({
  id: z.string(),
  name: z.string()
});

// Avoid 'any'
// ❌ const data: any = ...
// ✅ const data: unknown = ...
```

### React

```tsx
// Functional components
export const MyComponent: React.FC<Props> = ({ prop1, prop2 }) => {
  // Hooks at top
  const [state, setState] = useState<string>('');
  const data = useDataStore((s) => s.data);

  // Event handlers
  const handleClick = () => {
    setState('clicked');
  };

  // Render
  return (
    <div onClick={handleClick}>
      {prop1} - {prop2}
    </div>
  );
};

// Props interface
interface Props {
  prop1: string;
  prop2: number;
}
```

### Naming

- **Files**: PascalCase per componenti (`DashboardPage.tsx`), camelCase per utils (`dateUtils.ts`)
- **Components**: PascalCase (`CustomerSelector`)
- **Functions**: camelCase (`loadData`, `applyFilters`)
- **Constants**: UPPER_SNAKE_CASE (`ALL_RELEASE_SOURCES`)
- **Types**: PascalCase (`ReleaseItem`, `FilterState`)

### Imports

```typescript
// Order: React, libraries, local
import React, { useState } from 'react';
import { z } from 'zod';
import { useDataStore } from '../services/DataStore';
import { formatDate } from '../utils/dateUtils';
```

### Comments

```typescript
// Single-line comments for brief explanations
const value = 42; // Magic number

/**
 * Multi-line JSDoc for functions/components
 * @param items - Array of release items
 * @param filters - Filter state
 * @returns Filtered items
 */
export const applyFilters = (
  items: ReleaseItem[],
  filters: FilterState
): ReleaseItem[] => {
  // Implementation
};
```

---

## Troubleshooting

### Build Errors

#### "Cannot find module"
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### "Type error in ..."
```bash
# Run type check to see all errors
npm run typecheck
```

#### "Vite build failed"
```bash
# Check vite.config.ts
# Verify all imports are correct
# Clear cache
rm -rf dist .vite
npm run build
```

### Runtime Errors

#### "Snapshot not found"
```bash
# Refresh data
npm run refresh:microsoft
npm run refresh:eos
npm run refresh:fabric
npm run refresh:m365roadmap
```

#### "LocalStorage quota exceeded"
```javascript
// Clear localStorage in browser console
localStorage.clear();
// Or selectively
localStorage.removeItem('updatelens.customers');
```

#### "GitHub API rate limit"
```bash
# Wait 1 hour or use authenticated requests
# Check rate limit:
curl https://api.github.com/rate_limit
```

### Performance Issues

#### Slow filtering
```typescript
// Use useMemo for expensive computations
const filteredItems = useMemo(
  () => applyFilters(items, filterState),
  [items, filterState]
);
```

#### Large bundle size
```bash
# Analyze bundle
npm run build
# Check dist/assets/*.js sizes
# Consider code splitting
```

---

## Risorse Utili

### Documentazione

- **React**: https://react.dev/
- **TypeScript**: https://www.typescriptlang.org/docs/
- **Vite**: https://vitejs.dev/
- **Tailwind CSS**: https://tailwindcss.com/docs
- **Zustand**: https://github.com/pmndrs/zustand
- **Zod**: https://zod.dev/

### Tools

- **TypeScript Playground**: https://www.typescriptlang.org/play
- **Tailwind Play**: https://play.tailwindcss.com/
- **Regex101**: https://regex101.com/
- **JSON Formatter**: https://jsonformatter.org/

### GitHub

- **Issues**: https://github.com/your-org/UpdateLens/issues
- **Pull Requests**: https://github.com/your-org/UpdateLens/pulls
- **Wiki**: https://github.com/your-org/UpdateLens/wiki

---

## Versioning

Seguiamo **Semantic Versioning** (semver):

- **MAJOR**: Breaking changes (es. 1.0.0 → 2.0.0)
- **MINOR**: New features (es. 1.0.0 → 1.1.0)
- **PATCH**: Bug fixes (es. 1.0.0 → 1.0.1)

### Aggiornare Versione

1. **Modifica `package.json`**
   ```json
   {
     "version": "0.4.0"
   }
   ```

2. **Modifica `src/version.ts`**
   ```typescript
   export const lastUpdateTitle = 'Titolo aggiornamento';
   export const lastUpdateDate = '2026-01-23';
   export const lastUpdateNotes = [
     'Feature 1',
     'Feature 2',
     'Bug fix 3'
   ];
   ```

3. **Aggiorna README.md (Changelog)**
   ```markdown
   ### v0.4.0 (2026-01-23)
   - ✅ Feature 1
   - ✅ Feature 2
   - 🐛 Bug fix 3
   ```

4. **Commit e Tag**
   ```bash
   git add .
   git commit -m "chore: bump version to 0.4.0"
   git tag v0.4.0
   git push origin main --tags
   ```

---

## Contributing

### Workflow

1. Fork repository
2. Create feature branch
3. Make changes
4. Test thoroughly
5. Submit Pull Request

### PR Checklist

- [ ] Code follows conventions
- [ ] TypeScript compiles without errors
- [ ] Build succeeds (web + offline)
- [ ] Manual testing completed
- [ ] Documentation updated (if needed)
- [ ] Changelog updated (if user-facing change)

### Commit Messages

Seguiamo **Conventional Commits**:

```
feat: add new feature
fix: fix bug
docs: update documentation
style: formatting changes
refactor: code refactoring
test: add tests
chore: maintenance tasks
```

Esempi:
```
feat: add M365 Roadmap integration
fix: resolve filter persistence issue
docs: update USER_GUIDE with GitHub Issues section
refactor: extract filter logic to service
```

---

## 👤 Autore

**Alessandro Levantini**  
Project Owner & Lead Developer

Sviluppato per **CSS S.r.l.**

---

**Versione**: 0.3.0  
**Ultimo Aggiornamento**: 2026-01-23

**Happy coding! 🚀**
