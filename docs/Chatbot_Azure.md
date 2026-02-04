# Piano di implementazione Chatbot Azure (basato su chatbot attuale)

Stato documento: 3 febbraio 2026  
Input di riferimento: `docs/CHATBOT_ATTUALE.md`

## 1) Obiettivo

Portare il chatbot da logica solo client-side a una versione **Azure-enabled** con:
- comprensione linguistica piu` robusta;
- memoria conversazionale opzionale lato server;
- telemetria e osservabilita`;
- fallback sicuro alla logica attuale locale.

## 2) Principi di migrazione

- **Incrementale, senza regressioni**: il parser locale resta disponibile come fallback.
- **Feature flag**: attivazione graduale per ambiente/tenant.
- **Compatibilita` UX**: stessa UI (`ChatPanel` / `ChatWindow`) nella prima fase.
- **Sicurezza by default**: nessun segreto lato browser.

## 3) Gap tra stato attuale e target Azure

- Attuale: intent regex/alias in `ChatIntentService` + `ChatResponseService` locale.
- Target: orchestrazione server-side su Azure (API chat dedicata) + telemetria + policy.
- Attuale: cronologia locale in `localStorage`.
- Target: cronologia opzionale persistita server-side (per utente/tenant).

## 4) Architettura target (MVP Azure)

- Frontend:
  - mantiene componenti chat correnti;
  - invia richieste a `/api/chat/query` con contesto filtri/scope.
- Backend (Express su Azure Web App o Azure Functions):
  - endpoint `POST /api/chat/query`;
  - orchestratore con due strategie:
    1) `local-engine` (riuso parse/filter/response attuale),
    2) `azure-engine` (LLM + tool/filter execution).
- Servizi Azure consigliati:
  - Azure OpenAI (intent + risposta),
  - Application Insights (telemetria),
  - Key Vault (segreti),
  - opzionale Cosmos DB / Table Storage (history conversazioni).

## 5) Roadmap a fasi

### Fase 0 - Hardening baseline (1 sprint)
- Normalizzare encoding UTF-8 nei testi chatbot.
- Aggiungere test unit su parser e risposte attuali.
- Definire metriche baseline (no-result rate, apply-filter rate, latency client).

### Fase 1 - Backend chat senza LLM (1 sprint)
- Introdurre `/api/chat/query` usando motore locale riusato lato server.
- Adattare frontend con feature flag `VITE_CHAT_BACKEND_ENABLED`.
- Mantenere output compatibile con `ChatMessage` attuale.
- Obiettivo: spostare il "control plane" lato server senza cambiare comportamento.

### Fase 2 - Azure LLM opzionale (1-2 sprint)
- Integrare Azure OpenAI dietro `azure-engine`.
- Implementare prompt + schema output strutturato (intent, filterPatch, confidence).
- Se confidence bassa: fallback automatico a `local-engine`.
- Feature flag dedicato: `VITE_CHAT_AZURE_LLM_ENABLED`.

### Fase 3 - Memoria e personalizzazione (1 sprint)
- Persistenza conversazioni opzionale lato server (utente + tenant + TTL).
- Supporto "contesto sessione" oltre a `lastIntent` locale.
- Endpoint cronologia: list/delete/clear allineati alla UI corrente.

### Fase 4 - Osservabilita` e rollout progressivo (continuo)
- Dashboard App Insights: latency p50/p95, error rate, fallback rate.
- Rollout canary (dev -> staging -> subset prod -> full prod).
- SLO iniziale: p95 < 2.5s, errori < 1%, fallback < 20% dopo tuning.

## 6) Modifiche tecniche previste (codice)

- Frontend:
  - `src/app/components/chat/ChatPanel.tsx`: branch su backend/locale.
  - `src/app/store/useChatStore.ts`: supporto metadata messaggi server (traceId, model).
- Backend:
  - Nuovo modulo `server/chat/`:
    - `ChatController.ts`
    - `ChatOrchestrator.ts`
    - `engines/LocalChatEngine.ts`
    - `engines/AzureChatEngine.ts`
    - `ChatSchemas.ts` (Zod contract request/response).
- Config:
  - `.env`: `AZURE_OPENAI_*`, `CHAT_ENGINE`, `CHAT_HISTORY_ENABLED`.

## 7) API contract (proposta MVP)

- Request:
  - `message`, `searchScope`, `baseFilters`, `chatContext`, `topK`.
- Response:
  - `message`, `items`, `showPreview`, `canApplyFilters`, `filterPatch`,
  - `engine` (`local|azure`), `fallbackUsed`, `traceId`.

## 8) Sicurezza e compliance

- Token e chiavi solo server-side (Key Vault + managed identity).
- Sanitizzazione input utente e limiti lunghezza prompt.
- Logging senza PII nei payload chat.
- Rate limiting endpoint chat per IP/utente.

## 9) Test e criteri di accettazione

- Test unit:
  - mapping intent -> filterPatch;
  - fallback azure->local;
  - compatibilita` response con UI.
- Test integrazione:
  - `POST /api/chat/query` con scenari reali (esempi docs attuali).
- UAT:
  - nessuna regressione su "mostra tutto", confronti, trend, apply filtri.

Done criteria MVP Azure:
- UI invariata per utente finale;
- feature flag funzionanti;
- fallback affidabile;
- metriche App Insights disponibili in staging/prod.

## 10) Sequenza operativa raccomandata

1. Fase 0 completa + test parser.
2. Implementare Fase 1 e deploy in staging.
3. Validare parita` funzionale con chatbot attuale.
4. Abilitare Fase 2 solo su utenti pilota.
5. Misurare fallback/latency, poi estendere rollout.

## 11) Checklist operativa sprint-by-sprint (con stime)

Assunzioni:
- sprint da 2 settimane;
- stima in giorni/uomo (g/u);
- team tipico: 1 FE + 1 BE + supporto DevOps part-time.

### Sprint 1 - Baseline e hardening (Fase 0)
- [ ] Fix encoding UTF-8 testi chat/help/response (FE) - 1 g/u
- [ ] Test unit parser intent principali (BE/FE shared) - 2 g/u
- [ ] Test unit response generator + snapshot regressioni - 1.5 g/u
- [ ] Definizione metriche baseline + eventi client - 1 g/u
- [ ] Smoke test manuale end-to-end - 0.5 g/u
- **Totale stimato:** 6 g/u

### Sprint 2 - API chat server-side locale (Fase 1)
- [ ] Creazione `server/chat/ChatSchemas.ts` + validazione Zod - 1 g/u
- [ ] Implementazione `LocalChatEngine` e orchestratore - 2 g/u
- [ ] Endpoint `POST /api/chat/query` + gestione errori - 1.5 g/u
- [ ] Feature flag `VITE_CHAT_BACKEND_ENABLED` in `ChatPanel` - 1.5 g/u
- [ ] Test integrazione API + parita` output UI - 1.5 g/u
- [ ] Deploy staging + verifica log base - 0.5 g/u
- **Totale stimato:** 8 g/u

### Sprint 3 - Azure OpenAI opzionale (Fase 2)
- [ ] Integrazione Azure OpenAI (`AzureChatEngine`) - 2.5 g/u
- [ ] Prompting + schema output strutturato - 1.5 g/u
- [ ] Logica confidence e fallback automatico a local-engine - 1.5 g/u
- [ ] Feature flag `VITE_CHAT_AZURE_LLM_ENABLED` - 0.5 g/u
- [ ] Test casi ambigui + regressione intent core - 1.5 g/u
- [ ] Hardening sicurezza segreti (Key Vault/env) - 1 g/u
- **Totale stimato:** 8.5 g/u

### Sprint 4 - Memoria conversazionale e history server (Fase 3)
- [ ] Schema storage history (Cosmos/Table) con TTL - 1.5 g/u
- [ ] Endpoint history (list/delete/clear) - 2 g/u
- [ ] Integrazione UI tab Cronologia con backend (feature flag) - 1.5 g/u
- [ ] Gestione contesto sessione lato orchestratore - 1.5 g/u
- [ ] Test integrazione + fallback a localStorage - 1 g/u
- **Totale stimato:** 7.5 g/u

### Sprint 5 - Osservabilita` e rollout (Fase 4)
- [ ] Telemetria App Insights (latency, fallback, errori, no-result) - 1.5 g/u
- [ ] Dashboard operativa + alert minimi - 1 g/u
- [ ] Canary release (dev/staging/prod subset) - 1 g/u
- [ ] UAT business + tuning prompt/fallback threshold - 2 g/u
- [ ] Go-live checklist e runbook - 1 g/u
- **Totale stimato:** 6.5 g/u

### Stima complessiva
- **Totale:** ~36.5 g/u  
- **Durata calendario indicativa:** 5 sprint (10 settimane) con team minimo sopra.

## 12) Dipendenze e rischi principali

- Dipendenze:
  - provisioning Azure OpenAI + Key Vault + App Insights;
  - allineamento contract API con FE.
- Rischi:
  - latency LLM superiore a SLO;
  - mismatch output LLM vs filtro atteso;
  - regressioni UX se non preservata la compatibilita` del payload.
- Mitigazioni:
  - fallback locale obbligatorio;
  - rollout con feature flag e canary;
  - suite test su query reali del chatbot attuale.
