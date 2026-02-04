# Chatbot attuale (UpdateLens)

Stato documento: 3 febbraio 2026  
Ambito: chatbot integrato nel frontend web di UpdateLens.

## 1) Obiettivo

Il chatbot supporta la consultazione rapida delle novita` (release items) tramite linguaggio naturale, applicando filtri alla dashboard senza modificare in modo permanente i filtri globali.

## 2) Architettura corrente

Il chatbot e` **client-side**:
- nessun modello LLM remoto;
- parsing intent + risposta generati in locale;
- dati caricati dagli snapshot gia` usati dalla dashboard.

Flusso principale:
1. apertura chat;
2. caricamento snapshot (`loadAllSnapshots`);
3. estrazione metadata filtri (`buildFilterMetadata`);
4. parsing query (`parseIntent`);
5. filtro items (`filterReleaseItems`);
6. risposta testuale + anteprima risultati (`generateResponse`);
7. eventuale applicazione filtri in dashboard.

## 3) Funzionalita` disponibili

- Filtri in linguaggio naturale su:
  - prodotto, fonte, periodo (ultimi N giorni), range date;
  - stato, disponibilita` (GA/Preview), wave, categoria.
- Query analitiche:
  - conteggi (`quanti elementi...`);
  - top prodotti/fonti;
  - confronto tra due target;
  - trend mensile (ultimi mesi).
- Ricerca testuale libera (`cerca ...`).
- Correzione typo (Levenshtein) su termini frequenti.
- Riferimento contestuale alla query precedente (`e per ...`, `anche per ...`).
- Modalita` di ricerca:
  - `Tutti` (dataset completo),
  - `Filtri attuali` (contesto filtri dashboard).
- Cronologia query (localStorage, massimo 10 voci).
- Pannello help con esempi cliccabili.

## 4) Integrazione con i filtri dashboard

- Il chatbot usa `chatFilters` come overlay temporaneo nello store filtri.
- `chatFilters`:
  - non viene persistito;
  - non sovrascrive i filtri globali salvati;
  - puo` essere rimosso manualmente dalla dashboard.
- Azione "Apri vista completa": chiude chat, naviga su dashboard e applica il patch dei filtri della risposta.

## 5) UX corrente

- Entry point: bottone floating in basso a destra.
- Finestra chat con 3 tab:
  - `Chat`,
  - `Cronologia`,
  - `Help`.
- Quick replies iniziali (default + query recenti).
- Indicatore di elaborazione durante il parsing/filtro.
- Anteprima compatta dei primi risultati con CTA per vista completa.

## 6) Stato tecnico e limiti noti

- Chat stateless lato server (nessuna memoria condivisa cross-device).
- Storia chat limitata al browser locale.
- Comprensione linguistica basata su regex/alias, non su ragionamento generativo.
- Alcuni testi mostrano caratteri mojibake (es. `Ã`, `â€¢`) da normalizzare in UTF-8.
- Le risposte analytics sono utili ma non equivalenti a metriche BI avanzate.

## 7) File principali

- Orchestrazione chat UI/logica: `src/app/components/chat/ChatPanel.tsx`
- UI chat: `src/app/components/chat/ChatWindow.tsx`
- Parser intent: `src/services/ChatIntentService.ts`
- Generazione risposte: `src/services/ChatResponseService.ts`
- Store chat (tabs, history, scope): `src/app/store/useChatStore.ts`
- Overlay filtri chat: `src/app/store/useFilterStore.ts`

## 8) Esempi supportati (attuali)

- `Fabric ultimi 30 giorni in GA`
- `Business Central in GA`
- `EOS wave 1 2025`
- `da gennaio a marzo 2024`
- `quanti elementi ci sono?`
- `confronta Fabric con EOS`
- `trend Microsoft`
- `mostra tutto`

## 9) Prossimi miglioramenti consigliati

1. Correzione encoding testi (UTF-8) in help/response.
2. Test automatici per parser intent e regressioni NLP.
3. Telemetria base (query type, tasso no-result, apply filter click).
4. Priorita` intent e disambiguazione piu` robusta su query ambigue.
5. Eventuale modalita` "copilot" con backend opzionale (feature flag).
