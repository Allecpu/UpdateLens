# Tracker implementazione Chatbot Azure

Ultimo aggiornamento: 3 febbraio 2026
Riferimento piano: `docs/Chatbot_Azure.md`

## Log avanzamenti

- 2026-02-03:
  - creato contract chat server-side (`server/chat/ChatSchemas.ts`);
  - aggiunto local chat engine (`server/chat/LocalChatEngine.ts`);
  - esposto endpoint `POST /api/chat/query` (`server/chat/ChatController.ts`, `server/api.ts`);
  - integrata feature flag frontend `VITE_CHAT_BACKEND_ENABLED` con fallback locale (`src/app/components/chat/ChatPanel.tsx`);
  - aggiunto client API chat (`src/services/ChatBackendService.ts`);
  - aggiunto test integrazione chat API (`tools/testChatApi.ts`, script `npm run test:chat-api`);
  - aggiunta orchestrazione multi-engine (`server/chat/ChatOrchestrator.ts`);
  - aggiunto `AzureChatEngine` opzionale con output strutturato (`server/chat/AzureChatEngine.ts`);
  - implementato fallback automatico azure -> local engine su errore o confidence bassa;
  - aggiunta feature flag frontend `VITE_CHAT_AZURE_LLM_ENABLED` (`src/app/components/chat/ChatPanel.tsx`);
  - esteso contract chat con `preferAzure`, `confidence`, `model` (`server/chat/ChatSchemas.ts`);
  - esteso test integrazione per verificare fallback azure (`tools/testChatApi.ts`);
  - aggiunti test unit parser intent (`tools/testChatIntent.ts`) e response generator (`tools/testChatResponse.ts`);
  - aggiunti script npm: `test:chat-intent`, `test:chat-response`, `test:chat-unit`;
  - introdotta baseline metriche chatbot (`src/services/ChatTelemetryService.ts`, `docs/CHATBOT_METRICS_BASELINE.md`);
  - integrato tracking eventi base in `ChatPanel` (query, response, errori, apply filtri);
  - confermato audit encoding chat core senza anomalie residue;
  - implementati servizi Azure runtime (`server/chat/AzureServices.ts`);
  - aggiunto health endpoint servizi Azure (`GET /api/chat/health`);
  - implementata telemetry server-side verso Application Insights (`server/chat/AzureTelemetry.ts`);
  - orchestratore aggiornato con eventi telemetry (engine, fallback, confidence, latency);
  - aggiunto template configurazione `.env.example` con variabili Azure chat;
  - validazione completata: `npm run typecheck`, `npm run build:server`, `npm run test:chat-unit`, `npm run test:chat-api` OK.

## Sprint 1 - Baseline e hardening

- [x] Creare tracker operativo con stato avanzamento
- [x] Audit encoding chatbot (nessun mojibake rilevato nei file sorgente chat core)
- [x] Fix encoding UTF-8 dove necessario
- [x] Test unit parser intent principali
- [x] Test unit response generator
- [x] Definizione metriche baseline chatbot

## Sprint 2 - API chat server-side locale

- [x] Definire contract request/response chat (`ChatSchemas`)
- [x] Creare endpoint server `POST /api/chat/query` (local engine)
- [x] Integrare feature flag frontend `VITE_CHAT_BACKEND_ENABLED`
- [x] Aggiungere fallback automatico a motore locale frontend
- [x] Test integrazione API chat

## Sprint 3 - Azure OpenAI opzionale

- [x] Integrare `AzureChatEngine`
- [x] Prompt strutturato + confidence
- [x] Fallback automatico azure -> local engine
- [x] Feature flag `VITE_CHAT_AZURE_LLM_ENABLED`

## Sprint 4 - Memoria conversazionale

- [ ] Persistenza history server-side (opzionale)
- [ ] Endpoint history list/delete/clear
- [ ] Integrazione tab cronologia con backend

## Sprint 5 - Osservabilita` e rollout

- [x] Telemetria App Insights
- [ ] Dashboard + alert minimi
- [ ] Canary rollout
- [ ] Go-live checklist
