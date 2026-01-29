# Checklist Test Funzionalità Preset Filtri Globali

## Test Implementazione

### ✅ Step 1: Data Model & Types
- [x] FilterPreset type aggiunto in [src/models/Filters.ts](src/models/Filters.ts:29-36)
- [x] Tipo compatibile con FilterState esistente
- [x] Build TypeScript passa senza errori

### ✅ Step 2: Preset Store
- [x] File [src/app/store/usePresetStore.ts](src/app/store/usePresetStore.ts) creato
- [x] Tutte le azioni implementate:
  - [x] loadPresets
  - [x] createPreset
  - [x] updatePreset
  - [x] renamePreset
  - [x] duplicatePreset
  - [x] deletePreset (con blocco ultimo preset)
  - [x] setAsDefault
  - [x] setActivePreset
  - [x] applyPresetToFilters
- [x] Logica Always-Active implementata
- [x] Persistenza localStorage configurata

### ✅ Step 3: Bootstrap Hook
- [x] File [src/hooks/useBootstrapPresets.ts](src/hooks/useBootstrapPresets.ts) creato
- [x] Creazione preset iniziale se nessuno exists
- [x] Integrato in GlobalFiltersPage

### ✅ Step 4: UI Components
- [x] File [src/app/components/filters/PresetSelector.tsx](src/app/components/filters/PresetSelector.tsx) creato
- [x] Features implementate:
  - [x] Dropdown con lista preset
  - [x] Badge Default indicator (stella ⭐)
  - [x] Bottoni azioni: Salva, Salva come nuovo, Rinomina, Duplica, Elimina
  - [x] Checkbox "Imposta come Default"
  - [x] Modali per rinomina e nuovo preset
  - [x] Conferma eliminazione

### ✅ Step 5: GlobalFiltersPage Integration
- [x] Import usePresetStore e useBootstrapPresets aggiunti
- [x] useEffect per load Default preset on mount
- [x] PresetSelector inserito nella UI
- [x] handlePresetChange implementato
- [x] Preset si applicano sempre a cssFilters (mai a customerFilters)

### ✅ Step 6: Dashboard Integration
- [x] Import usePresetStore aggiunto
- [x] Session state sessionPresetId aggiunto
- [x] Dropdown preset implementato
- [x] Visibilità condizionale: solo quando !activeCustomerId
- [x] Handler che chiama applyPresetToFilters + azzera tempFilters
- [x] Nessuna persistenza (solo session)

### ✅ Step 7: Build & Type Checking
- [x] Build completato con successo
- [x] TypeScript type checking passa senza errori
- [x] Nessun warning critico

---

## Test Funzionali da Eseguire (Manuale)

### Test Base
1. [ ] **Primo avvio**: Verificare che venga creato preset "Default" automaticamente
2. [ ] **Creare nuovo preset**: Usare "Salva come nuovo" per creare un secondo preset
3. [ ] **Selezionare preset**: Cambiare preset attivo dal dropdown
4. [ ] **Salvare modifiche**: Modificare filtri e salvare su preset esistente
5. [ ] **Rinominare preset**: Usare bottone "Rinomina"
6. [ ] **Duplicare preset**: Usare bottone "Duplica"
7. [ ] **Imposta Default**: Marcare preset come Default con checkbox

### Test Protezioni
8. [ ] **Blocco eliminazione ultimo preset**: Tentare di eliminare l'unico preset → deve essere bloccato
9. [ ] **Eliminazione preset attivo**: Eliminare preset attivo → deve auto-selezionare un altro
10. [ ] **Conferma eliminazione**: Verificare che appaia conferma prima di eliminare

### Test GlobalFiltersPage
11. [ ] **Load Default on mount**: Chiudere e riaprire GlobalFiltersPage → deve caricare preset Default
12. [ ] **Preset con customer scope**: Selezionare cliente, cambiare preset → deve modificare solo cssFilters
13. [ ] **Modifiche manuali**: Modificare filtri manualmente → preset non viene auto-aggiornato
14. [ ] **Salva aggiorna preset**: Dopo modifiche manuali, "Salva" deve aggiornare il preset

### Test Dashboard
15. [ ] **Preset selector visibile senza cliente**: Aprire Dashboard senza cliente → preset selector visibile
16. [ ] **Preset selector nascosto con cliente**: Selezionare cliente → preset selector scompare
17. [ ] **Cambio preset aggiorna KPI**: Cambiare preset → KPI si aggiornano
18. [ ] **Cambio preset azzera tempFilters**: Verificare che tempFilters vengano azzerati
19. [ ] **Session-only**: Chiudere e riaprire Dashboard → preset NON persiste

### Test Regressione
20. [ ] **Ripristina button**: Verificare che funzioni ancora in GlobalFiltersPage
21. [ ] **Applica button**: Verificare "Applica ai clienti inclusi"
22. [ ] **Applica tutto**: Verificare funzionalità esistenti
23. [ ] **Customer scope inheritance**: Verificare mode 'inherit' vs 'custom'
24. [ ] **Normalizzazione**: Verificare che filtri obsoleti vengano puliti
25. [ ] **Customer groups**: Verificare che continuino a funzionare
26. [ ] **Filter export/import**: Verificare funzionalità esistenti

### Test Edge Cases
27. [ ] **Preset con filtri obsoleti**: Caricare preset con prodotti rimossi → deve normalizzare
28. [ ] **Preset + Chat filters**: Verificare che chat filters abbiano precedenza
29. [ ] **Preset + Temp filters**: In Dashboard, modificare filtri dopo preset → deve fare merge
30. [ ] **Multiple Default**: Tentare di impostare più Default → solo uno deve essere marcato

---

## Verifica Requisiti Iniziali

### ✅ Gestione preset
- [x] Salvare più preset di Filtri Globali
- [x] Azioni: Crea nuovo, Salva, Rinomina, Duplica, Elimina

### ✅ Default
- [x] Possibilità di marcare un solo preset come Default
- [x] All'apertura GlobalFiltersPage carica preset Default

### ✅ Preset attivo sempre presente
- [x] Deve esserci sempre un preset attivo
- [x] Non possibile eliminare ultimo preset
- [x] Eliminazione preset attivo auto-seleziona altro

### ✅ Comportamento in Dashboard
- [x] Preset selezionato si applica trasversalmente
- [x] Dashboard aggiorna KPI e risultati esistenti
- [x] Preset selector visibile solo senza cliente selezionato
- [x] Cambio preset riflette filtri in Dashboard

### ✅ Persistenza
- [x] Selezione preset in Dashboard solo di sessione
- [x] Gestione/persistenza preset in GlobalFiltersPage invariata
- [x] Default preset caricato on mount

### ✅ Vincoli tecnici
- [x] Nessuna modifica a: API, modello dati FilterState, FilterService, FilterNormalization
- [x] Storage preset addittivo e isolato (updatelens.presets.v1)
- [x] Nessuna interferenza con persistenza attuale

---

## File Creati

1. [src/models/Filters.ts](src/models/Filters.ts) - Aggiunto tipo FilterPreset
2. [src/app/store/usePresetStore.ts](src/app/store/usePresetStore.ts) - Store Zustand per preset
3. [src/app/components/filters/PresetSelector.tsx](src/app/components/filters/PresetSelector.tsx) - UI component
4. [src/hooks/useBootstrapPresets.ts](src/hooks/useBootstrapPresets.ts) - Bootstrap hook

## File Modificati

1. [src/app/pages/GlobalFiltersPage.tsx](src/app/pages/GlobalFiltersPage.tsx) - Integrazione PresetSelector
2. [src/app/pages/DashboardPage.tsx](src/app/pages/DashboardPage.tsx) - Dropdown preset session-only

## File NON Modificati (come richiesto)

- [src/app/store/useFilterStore.ts](src/app/store/useFilterStore.ts)
- [src/services/FilterService.ts](src/services/FilterService.ts)
- [src/services/FilterNormalization.ts](src/services/FilterNormalization.ts)
- Tutte le API e backend

---

## Note per il Testing Manuale

1. **Avviare l'applicazione**:
   ```bash
   npm run dev
   ```

2. **Navigare a GlobalFiltersPage** (`/filtri-globali`)
   - Verificare presenza PresetSelector sopra la sezione filtri
   - Testare tutte le azioni preset

3. **Navigare a Dashboard** (`/`)
   - Verificare preset dropdown quando nessun cliente è selezionato
   - Testare cambio preset e aggiornamento KPI

4. **Testare scenari edge case** elencati sopra

5. **Verificare non-regressione** delle funzionalità esistenti

---

**Status**: ✅ Implementazione completata
**Build**: ✅ Passa senza errori
**TypeCheck**: ✅ Passa senza errori
**Next Step**: Testing manuale delle funzionalità
