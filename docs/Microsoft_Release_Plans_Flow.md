# Microsoft Release Plans: Data Flow & API Documentation

This document describes the end-to-end data flow for the **Microsoft Release Plans** integration in UpdateLens, covering data ingestion, processing, storage, and the API endpoints that serve this data.

## 1. High-Level Overview

The system fetches official release plan data from Microsoft, normalizes it into a structured format, stores it in a local SQLite database, and exposes it via a REST API.

**Key Components:**
*   **Source**: `https://releaseplans.microsoft.com/...` (JSON payload)
*   **Ingestion**: `server/ingest.ts` (Node.js script)
*   **Database**: SQLite (`data.db`) via `better-sqlite3`
*   **API**: Express.js endpoints in `server/api.ts`
*   **Frontend**: React components consuming the API

---

## 2. Data Ingestion (`server/ingest.ts`)

The ingestion process is triggered via a scheduled task (e.g., GitHub Actions or cron) or manually.

### 2.1 Fetching Data
1.  **Source URL**: Fetches data from `https://releaseplans.microsoft.com/en-US/allreleaseplans/` (or via `process.env.RELEASEPLANS_URL`).
2.  **Snapshot Logic**:
    *   Checks the `ETag` header from the response against the last stored snapshot in the database.
    *   Computes a SHA-256 hash of the payload body to verify changes.
    *   If `ETag` matches or Hash matches, the process aborts (no changes).
3.  **Snapshot Storage**:
    *   If changes are detected, the raw JSON payload is stored in the `release_plan_snapshots` table.
    *   Metadata includes: `fetched_at`, `language`, `etag`, `hash`, `raw_payload`, `schema_version`.

### 2.2 Normalization
The raw data is an array of objects with keys like `Product name`, `Feature name`, `GA date`, etc. This is normalized into a cleaner structure:

| Raw Field | Normalized Field | Transformation / Notes |
| :--- | :--- | :--- |
| `Release Plan ID` | `releasePlanId` | Validated as GUID. |
| `Product name` | `productName` | Normalized text. |
| `Feature name` | `featureName` | Normalized text. |
| `Business value` | `summary` | Normalized text. Fallback to default message if empty. |
| `GA date` | `availabilityDate` | Parsed date. Logic prioritizes GA > Public Preview > Early Access. |
| `GA Release Wave` | `wave` | e.g., "2024 Release Wave 1". |

**Logic Highlights:**
*   **App Resolution**: Maps "Product Names" (e.g., "Dynamics 365 Sales") to "App Names" (e.g., "Sales") using a mapping table in `src/utils/releaseplans.ts`.
*   **Status Calculation**: derived from dates (`Launched`, `Try now`, `Planned`).
*   **Link Generation**: Constructs official links using `releaseplans.microsoft.com` query parameters.

### 2.3 Storage (SQLite)
Data is upserted into the `release_plan_items` table.
*   **Composite Key**: `source_plan_id` + `language`.
*   **History Tracking**:
    *   On insert/update, a record is written to `release_plan_history`.
    *   Captures `change_type` ('insert', 'update') and a JSON `diff` of what changed.
*   **Availability Types**: Maps items to multiple types (Early Access, Public Preview, GA) in `release_plan_availability_types`.

---

## 3. API Endpoints (`server/api.ts`)

The backend exposes the following endpoints to the frontend.

### 3.1 Get Items
`GET /api/releaseplans`

Retrieves a paginated list of release plan items with filtering and sorting.

*   **Query Parameters**:
    *   `app`: Filter by App Name (e.g., "Sales").
    *   `product`: Filter by Product Name.
    *   `status`: Filter by Status ("Launched", "Try now", "Planned").
    *   `wave`: Filter by Wave.
    *   `lang`: Language code (default: `en-US`).
    *   `updatedSince`: Filter items updated on or after this date.
    *   `limit`: Max items (default: 50, max: 200).
    *   `offset`: Pagination offset.
    *   `sort`: `newest` (default) or `oldest` based on availability date.
*   **Response**:
    ```json
    {
      "items": [ ... ],
      "total": 150
    }
    ```
*   **Caching**: Supports `ETag` / `If-None-Match` for client-side caching.

### 3.2 Get Metadata
`GET /api/releaseplans/meta`

Returns distinct values for filters to populate frontend dropdowns.

*   **Query Parameters**: `lang` (default: `en-US`)
*   **Response**:
    ```json
    {
      "apps": [{ "value": "Sales" }, ...],
      "products": [{ "value": "Dynamics 365 Sales" }, ...],
      "statuses": [{ "value": "Planned" }, ...],
      "waves": [{ "value": "2024 release wave 1" }, ...]
    }
    ```

### 3.3 Get Single Item
`GET /api/releaseplans/:planId`

Retrieves full details for a specific release plan item.

*   **Use Case**: Detail view or modal.
*   **Response**: Single `NormalizedItem` object or 404.

### 3.4 Get Changes (Diffs)
`GET /api/releaseplans/changes`

Retrieves the history of changes for a feed or "What's New" view.

*   **Query Parameters**: `since` (Date string, required).
*   **Response**:
    ```json
    {
      "items": [
        { "change_type": "update", "diff": { ... }, "feature_name": "...", ... }
      ]
    }
    ```

---

## 4. Updates & Scheduling
*   **Azure Environment**: gli snapshot vengono aggiornati dalle **Azure Functions** e dai workflow GitHub Actions configurati. La pagina **Versione** espone il comando "Aggiorna tutte le fonti" e mostra l'esito separato di ogni sorgente.
*   **Local/Dev**: gli sviluppatori possono eseguire `npm run ingest:releaseplans` per l'ingestion SQLite oppure `npm run refresh:microsoft` per rigenerare lo snapshot JSON.
