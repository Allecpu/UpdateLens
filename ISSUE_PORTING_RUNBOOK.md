ho mefatto# Runbook Operativo - Porting Issue da Source a Target

Questo documento e un template operativo per portare un'issue da un progetto `source` a un progetto `target` in modo tracciabile e ripetibile.

Usalo dall'alto verso il basso: compila il contesto, mappa i gap funzionali/tecnici, esegui il piano implementativo, valida con test e QA, e chiudi con deliverable PR-ready.

Obiettivo: ridurre omissioni su requisiti, compatibilita, sicurezza, quality gates e rollout/rollback.

## 1) Contesto operativo (compilare prima di iniziare)

### Source project
- [ ] Nome progetto: `<SOURCE_PROJECT_NAME>`
- [ ] Repo: `<SOURCE_REPO_URL>`
- [ ] Branch di riferimento: `<SOURCE_BRANCH>`
- [ ] Stack tecnico: `<SOURCE_STACK>`
- [ ] URL ambiente (dev/stage/prod): `<SOURCE_ENV_URLS>`

### Target project
- [ ] Nome progetto: `<TARGET_PROJECT_NAME>`
- [ ] Repo: `<TARGET_REPO_URL>`
- [ ] Branch di lavoro: `<TARGET_BRANCH>`
- [ ] Stack tecnico: `<TARGET_STACK>`
- [ ] URL ambiente (dev/stage/prod): `<TARGET_ENV_URLS>`

### Issue da portare
- [ ] Titolo: `<ISSUE_TITLE>`
- [ ] ID/Link: `<ISSUE_ID_OR_URL>`
- [ ] Descrizione funzionale sintetica: `<ISSUE_DESCRIPTION>`
- [ ] Criteri di accettazione (copiare testualmente):  
  - [ ] `<AC_1>`
  - [ ] `<AC_2>`
  - [ ] `<AC_3>`

### Vincoli non negoziabili
- [ ] Browser supportati: `<BROWSERS_MATRIX>`
- [ ] Performance budget: `<PERF_BUDGET>`
- [ ] Accessibilita: `<A11Y_STANDARD>`
- [ ] SEO: `<SEO_CONSTRAINTS>`
- [ ] Analytics obbligatoria: `<ANALYTICS_REQUIREMENTS>`
- [ ] Feature flag policy: `<FEATURE_FLAG_POLICY>`
- [ ] Sicurezza/policy: `<SECURITY_POLICIES>`

### Ambienti, variabili, segreti, pipeline
- [ ] Dev: `<DEV_DETAILS>`
- [ ] Stage: `<STAGE_DETAILS>`
- [ ] Prod: `<PROD_DETAILS>`
- [ ] Variabili runtime/build: `<ENV_VARS>`
- [ ] Secrets richiesti: `<SECRETS_LIST>`
- [ ] CI/CD pipeline coinvolte: `<CICD_PIPELINES>`

---

## 2) Requisiti funzionali (checklist operativa)

Compilare una riga per requisito.

### RF-01 - `<REQUIREMENT_NAME>`
- [ ] Input: `<INPUT_CONTRACT>`
- [ ] Output: `<OUTPUT_CONTRACT>`
- [ ] Edge case: `<EDGE_CASES>`
- [ ] Messaggi errore utente: `<ERROR_COPY>`
- [ ] Stato vuoto: `<EMPTY_STATE_COPY>`
- [ ] Stato loading: `<LOADING_BEHAVIOR>`
- [ ] Stato success: `<SUCCESS_BEHAVIOR>`
- [ ] Mappatura atteso (source) vs attuale (target):
  - [ ] Atteso: `<EXPECTED_BEHAVIOR_FROM_SOURCE>`
  - [ ] Attuale: `<CURRENT_BEHAVIOR_IN_TARGET>`
  - [ ] Gap da colmare: `<GAP_DESCRIPTION>`

### RF-02 - `<REQUIREMENT_NAME>`
- [ ] Input: `<INPUT_CONTRACT>`
- [ ] Output: `<OUTPUT_CONTRACT>`
- [ ] Edge case: `<EDGE_CASES>`
- [ ] Messaggi errore utente: `<ERROR_COPY>`
- [ ] Stato vuoto: `<EMPTY_STATE_COPY>`
- [ ] Stato loading: `<LOADING_BEHAVIOR>`
- [ ] Stato success: `<SUCCESS_BEHAVIOR>`
- [ ] Mappatura atteso (source) vs attuale (target):
  - [ ] Atteso: `<EXPECTED_BEHAVIOR_FROM_SOURCE>`
  - [ ] Attuale: `<CURRENT_BEHAVIOR_IN_TARGET>`
  - [ ] Gap da colmare: `<GAP_DESCRIPTION>`

> Duplicare il blocco per tutti i requisiti.

---

## 3) Analisi differenze Source vs Target

### Architettura
- [ ] Routing:
  - Source: `<SOURCE_ROUTING>`
  - Target: `<TARGET_ROUTING>`
  - Azione: `<ROUTING_PORTING_STRATEGY>`
- [ ] State management:
  - Source: `<SOURCE_STATE>`
  - Target: `<TARGET_STATE>`
  - Azione: `<STATE_PORTING_STRATEGY>`
- [ ] Auth/permessi:
  - Source: `<SOURCE_AUTH>`
  - Target: `<TARGET_AUTH>`
  - Azione: `<AUTH_PORTING_STRATEGY>`
- [ ] API layer:
  - Source: `<SOURCE_API_LAYER>`
  - Target: `<TARGET_API_LAYER>`
  - Azione: `<API_LAYER_STRATEGY>`

### UI e design system
- [ ] Libreria componenti source: `<SOURCE_UI_LIB>`
- [ ] Libreria componenti target: `<TARGET_UI_LIB>`
- [ ] Token/design constraints target: `<TARGET_DESIGN_RULES>`
- [ ] Strategia di adattamento UX/UI: `<UI_PORTING_STRATEGY>`

### Modelli dati e naming
- [ ] Entita source: `<SOURCE_MODELS>`
- [ ] Entita target: `<TARGET_MODELS>`
- [ ] Mapping nomi/campi: `<FIELD_MAPPING_TABLE_REFERENCE>`
- [ ] Trasformazioni necessarie: `<TRANSFORM_STRATEGY>`

### Mancanze nel target
- [ ] Funzionalita non esistente: `<MISSING_PART>`
- [ ] Strategia scelta:
  - [ ] Polyfill: `<YES_NO_AND_DETAILS>`
  - [ ] Re-implementazione: `<YES_NO_AND_DETAILS>`
  - [ ] Fallback degradato: `<YES_NO_AND_DETAILS>`

---

## 4) Piano implementativo step-by-step

### 1. Setup locale
1. Clonare repository target e checkout branch:
```bash
git clone <TARGET_REPO_URL>
cd <TARGET_REPO_FOLDER>
git checkout -b <TARGET_BRANCH>
```
2. Allineare versioni runtime:
```bash
node -v   # atteso: <NODE_VERSION>
npm -v    # atteso: <NPM_VERSION>
```
3. Installare dipendenze e avvio:
```bash
npm ci
npm run dev
```

### 2. Modifiche file specifici (obbligatorio: percorso + change)
- [ ] `<path/to/fileA>`: `<CHANGE_DESCRIPTION>`
- [ ] `<path/to/fileB>`: `<CHANGE_DESCRIPTION>`
- [ ] `<path/to/fileC>`: `<CHANGE_DESCRIPTION>`

### 3. Nuove entita
- [ ] Componenti: `<NEW_COMPONENTS_WITH_PATH>`
- [ ] Hook/composables: `<NEW_HOOKS_WITH_PATH>`
- [ ] Servizi/API client: `<NEW_SERVICES_WITH_PATH>`
- [ ] Endpoint backend: `<NEW_ENDPOINTS_WITH_PATH>`
- [ ] Migrazioni DB: `<MIGRATION_FILES_AND_ORDER>`

### 4. Integrazione
- [ ] Routing: `<ROUTE_REGISTRATION_STEPS>`
- [ ] Feature flag: `<FLAG_NAME + DEFAULT + TARGET_ENV>`
- [ ] Permessi/ruoli: `<RBAC_UPDATES>`
- [ ] Traduzioni i18n: `<LOCALES_AND_KEYS>`

### 5. Gestione errori
- [ ] Timeout client: `<TIMEOUT_POLICY>`
- [ ] Retry policy: `<RETRY_POLICY>`
- [ ] Error logging: `<LOGGER + CONTEXT_FIELDS>`
- [ ] User feedback: `<TOAST/BANNER/INLINE_ERRORS>`

### 6. Compatibilita
- [ ] Responsive breakpoints: `<BREAKPOINT_CHECKLIST>`
- [ ] Accessibilita (aria/focus/keyboard): `<A11Y_ACTIONS>`
- [ ] i18n/plural/date-number format: `<I18N_ACTIONS>`

### 7. Pulizia
- [ ] Refactor minimo necessario: `<REFACTOR_SCOPE>`
- [ ] Rimozione dead code: `<FILES_OR_SYMBOLS_TO_REMOVE>`
- [ ] Aggiornamento documentazione tecnica: `<DOC_PATHS>`

---

## 5) Specifiche tecniche dettagliate

### API contract

#### Endpoint 1 - `<METHOD> <PATH>`
- [ ] Scopo: `<PURPOSE>`
- [ ] Headers richiesti:
  - [ ] `Authorization: Bearer <token>`
  - [ ] `Content-Type: application/json`
  - [ ] `<OTHER_HEADERS>`
- [ ] Auth: `<AUTH_MECHANISM>`
- [ ] Request example:
```http
<METHOD> <PATH> HTTP/1.1
Host: <API_HOST>
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "fieldA": "value",
  "fieldB": 123
}
```
- [ ] Response example (200):
```json
{
  "data": {
    "id": "abc123",
    "status": "ok"
  },
  "meta": {
    "requestId": "req_001"
  }
}
```
- [ ] Codici errore gestiti:
  - [ ] `400` `<VALIDATION_ERROR_HANDLING>`
  - [ ] `401` `<AUTH_ERROR_HANDLING>`
  - [ ] `403` `<PERMISSION_ERROR_HANDLING>`
  - [ ] `404` `<NOT_FOUND_HANDLING>`
  - [ ] `409` `<CONFLICT_HANDLING>`
  - [ ] `429` `<RATE_LIMIT_HANDLING>`
  - [ ] `500` `<SERVER_ERROR_HANDLING>`

### Data model
- [ ] Schema logico: `<ENTITY_RELATIONS>`
- [ ] Tipi/DTO:
```ts
// path: <path/to/types.ts>
export interface <EntityName> {
  id: string;
  // ...
}
```
- [ ] Mapping source -> target:
  - [ ] `<sourceField>` -> `<targetField>` (`<transform_rule>`)
- [ ] Migrazione DB (se presente):
  - [ ] File: `<migration_file>`
  - [ ] Up: `<up_steps>`
  - [ ] Down: `<rollback_steps>`

### UI/UX implementativa
- [ ] Wireflow testuale:
  1. `<ENTRY_POINT>`
  2. `<USER_ACTION>`
  3. `<SYSTEM_RESPONSE>`
  4. `<NEXT_ACTION>`
- [ ] Stati UI:
  - [ ] Loading: `<SKELETON/SPINNER + TIMEOUT>`
  - [ ] Empty: `<EMPTY_STATE_TEXT + CTA>`
  - [ ] Error: `<ERROR_TEXT + RETRY_ACTION>`
  - [ ] Success: `<SUCCESS_TEXT + FOLLOW_UP_ACTION>`
- [ ] Microcopy approvata:
  - [ ] `<KEY>`: "`<TEXT>`"

### Security
- [ ] Input validation client/server: `<SCHEMA_AND_LOCATION>`
- [ ] Sanitizzazione output/input: `<SANITIZATION_LIBRARY_OR_METHOD>`
- [ ] CSRF/CORS: `<POLICY_AND_CONFIG_FILES>`
- [ ] Rate limit (se applicabile): `<LIMIT_POLICY>`

---

## 6) Test plan

### Unit test
- [ ] File test da creare/modificare:
  - [ ] `<path/to/unitA.test.ts>`
  - [ ] `<path/to/unitB.test.ts>`
- [ ] Casi chiave:
  - [ ] `<CASE_1>`
  - [ ] `<CASE_2>`
  - [ ] `<CASE_3>`
- [ ] Mock richiesti:
  - [ ] `<API_MOCKS>`
  - [ ] `<AUTH_MOCKS>`
  - [ ] `<TIME_MOCKS>`

### Integration / E2E
- [ ] Prerequisiti dataset: `<FIXTURES_OR_SEED>`
- [ ] Scenari utente:
  1. `<E2E_SCENARIO_1>`
  2. `<E2E_SCENARIO_2>`
  3. `<E2E_SCENARIO_3>`
- [ ] Comandi:
```bash
npm run test
npm run test:e2e
```

### Manual QA checklist
- [ ] Browser: `<CHROME_VERSION>`, `<FIREFOX_VERSION>`, `<SAFARI_VERSION>`, `<EDGE_VERSION>`
- [ ] Device: `<DESKTOP>`, `<TABLET>`, `<MOBILE>`
- [ ] Verifiche rapide:
  - [ ] Flusso felice completo
  - [ ] Gestione errore API
  - [ ] Stato vuoto
  - [ ] Navigazione keyboard-only
  - [ ] Tracking analytics emesso

---

## 7) Observability e quality gates

### Logging
- [ ] Eventi applicativi da loggare: `<EVENT_LIST>`
- [ ] Livelli: `info`, `warn`, `error`
- [ ] Destinazione: `<LOG_PLATFORM>`
- [ ] Correlation fields: `requestId`, `userId`, `featureFlag`, `environment`

### Analytics
- [ ] Event name: `<EVENT_NAME>`
- [ ] Trigger: `<WHEN_FIRED>`
- [ ] Properties:
  - [ ] `<PROPERTY_1>`
  - [ ] `<PROPERTY_2>`
  - [ ] `<PROPERTY_3>`

### Performance
- [ ] Budget: `<TTI/LCP/CLS/INP/BUNDLE_KB>`
- [ ] Verifica locale:
```bash
npm run build
npm run preview
```
- [ ] Verifica CI (Lighthouse/bundle analyzer): `<CI_JOB_NAME>`

---

## 8) Deliverables PR-ready

### File aggiunti/modificati
- [ ] Added: `<new/file/path>`
- [ ] Modified: `<existing/file/path>`
- [ ] Deleted (se necessario): `<removed/file/path>`

### PR checklist
- [ ] `npm run lint` OK
- [ ] `npm run format` OK
- [ ] `npm run typecheck` OK
- [ ] `npm run test` OK
- [ ] `npm run build` OK
- [ ] Screenshot/GIF allegati (UI changes)
- [ ] Link issue e AC verificati

### Note di rilascio / changelog
- [ ] Entry changelog:
```md
## <VERSION_OR_DATE>
- Ported `<ISSUE_ID_OR_URL>` from `<SOURCE_PROJECT_NAME>` to `<TARGET_PROJECT_NAME>`.
- Added `<KEY_FEATURES>`.
- Fixed `<BUGFIXES>`.
```

### Rollout / rollback
- [ ] Rollout strategy:
  - [ ] Canary `%`: `<CANARY_PERCENT>`
  - [ ] Feature flag gradual enable: `<FLAG_ROLLOUT_PLAN>`
- [ ] Rollback strategy:
  - [ ] Disable flag `<FLAG_NAME>`
  - [ ] Revert commit `<COMMIT_SHA_PLACEHOLDER>`
  - [ ] DB rollback migration `<MIGRATION_DOWN_COMMAND>`

---

## 9) Implementation checklist (finale, spuntabile)

- [ ] Contesto source/target compilato al 100%
- [ ] Requisiti funzionali mappati con gap analysis
- [ ] Differenze architetturali risolte con strategia esplicita
- [ ] Tutte le modifiche file implementate
- [ ] API/data model allineati e testati
- [ ] UI stati loading/empty/error/success implementati
- [ ] Security checks applicati
- [ ] Test unit/integration/E2E verdi
- [ ] QA manuale completata su browser/device richiesti
- [ ] Logging + analytics verificati
- [ ] Performance budget rispettato
- [ ] PR aperta con checklist completa
- [ ] Changelog e piano rollout/rollback pronti

## 10) Open questions / assumptions

- [ ] Q1: `<OPEN_QUESTION_1>`
  - Assunzione temporanea: `<ASSUMPTION_1>`
- [ ] Q2: `<OPEN_QUESTION_2>`
  - Assunzione temporanea: `<ASSUMPTION_2>`
- [ ] Q3: `<OPEN_QUESTION_3>`
  - Assunzione temporanea: `<ASSUMPTION_3>`

## 11) Risks & mitigations

- [ ] Rischio: `<RISK_1>`
  - Mitigazione: `<MITIGATION_1>`
  - Trigger monitoraggio: `<ALERT_OR_METRIC_1>`
- [ ] Rischio: `<RISK_2>`
  - Mitigazione: `<MITIGATION_2>`
  - Trigger monitoraggio: `<ALERT_OR_METRIC_2>`
- [ ] Rischio: `<RISK_3>`
  - Mitigazione: `<MITIGATION_3>`
  - Trigger monitoraggio: `<ALERT_OR_METRIC_3>`

## 12) Definition of Done

- [ ] Tutti gli acceptance criteria dell'issue sono soddisfatti e dimostrabili.
- [ ] Comportamento target allineato al source dove richiesto, con differenze documentate.
- [ ] Test automatici e QA manuale completati con evidenze.
- [ ] Nessuna regressione critica su flussi adiacenti.
- [ ] PR approvabile senza azioni bloccanti residue.
