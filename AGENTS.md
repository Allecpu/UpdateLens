# Repository Guidelines

## Project Structure & Module Organization
- `src/` contains the React + TypeScript app (`app/components`, `app/pages`, `services`, `models`, `utils`).
- `public/` holds static assets and production snapshots under `public/data/`.
- `tools/` contains data refresh scripts (e.g., `refreshMicrosoft.ts`).
- `server/` is the optional Express + SQLite backend (API + ingestion).
- Build outputs go to `dist/` (web) and `release/` (offline ZIP).

## Build, Test, and Development Commands
- `npm run dev` starts the Vite dev server at http://localhost:5173.
- `npm run build` builds the web bundle into `dist/`.
- `npm run build:release` builds an offline bundle and inlines assets into `release/`.
- `npm run preview` serves the production build locally.
- `npm run typecheck` runs TypeScript type checking.
- `npm run server:dev` starts the optional backend.
- Data refresh: `npm run refresh:microsoft|eos|fabric|m365roadmap`.

## Coding Style & Naming Conventions
- TypeScript + React function components; avoid `any`, prefer explicit types and Zod schemas.
- File naming: PascalCase for components (`DashboardPage.tsx`), camelCase for utilities (`dateUtils.ts`).
- Symbols: components/types in PascalCase, functions in camelCase, constants in `UPPER_SNAKE_CASE`.
- Keep imports ordered: React, libraries, then local modules.

## Testing Guidelines
- Primary checks are `npm run typecheck` and manual QA.
- Smoke-test offline mode with `npm run build:release` and open `release/index.html`.
- Release plans URL check: `npm run test:releaseplans`.
- Follow the checklist in `PRESET_TEST_CHECKLIST.md` for preset changes.

## Commit & Pull Request Guidelines
- Commit messages follow Conventional Commits (e.g., `feat: add m365 filters`, `fix: handle empty snapshots`).
- PRs should describe scope, include test results, and link related issues. Add screenshots for UI changes.
- Update docs and `CHANGELOG.md` when behavior or features change.

## Configuration & Security
- Store secrets in `.env` only; never commit tokens (GitHub PAT, etc.).
- Optional backend config uses `RELEASEPLANS_*`, `GITHUB_*`, `PORT`, `NODE_ENV`.
