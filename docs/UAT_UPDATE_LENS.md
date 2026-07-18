# UAT – Update Lens · Filtri Globali e Persistenza Filtri

> **Natura del documento.** Questo è un piano di **User Acceptance Testing (UAT) da eseguire**, non un elenco di bug confermati.
> I test case nascono dalle osservazioni raccolte durante una sessione di prova dell'utente (`docs/TEST UPDATE LENS.docx`), ma **le segnalazioni non sono date per certe**: ognuna è riportata come *ipotesi da verificare* e va confermata (o smentita) da un tester eseguendo i passi indicati.
> Per ogni test case il **Risultato atteso** descrive il comportamento *corretto/intenzionale*, indipendente dalla segnalazione; il campo **Esito** è da compilare in fase di esecuzione.

---

## 1. Obiettivo

Verificare il corretto funzionamento della gestione filtri del portale Update Lens, in particolare:

- deselezione dei prodotti e delle app nei **Filtri Globali**;
- coerenza tra filtro clienti impostato e news mostrate;
- persistenza dei filtri nella navigazione **Dashboard ⇄ Filtri Globali**;
- persistenza dei filtri **per cliente** dopo chiusura e riavvio del portale;
- correttezza delle voci elencate nel filtro app (eventuali duplicati/percorsi);
- filtro **ultima wave** e relativo conteggio news.

## 2. Ambiente e versione

| Voce | Valore |
|---|---|
| Ambiente | Locale (build portata in locale) · _da specificare se STG/PRD_ |
| Versione / commit | _da compilare_ |
| Browser | _da compilare_ |
| Data esecuzione | _da compilare_ |
| Tester | _da compilare_ |

## 3. Precondizioni

- Utente autenticato al portale.
- Disponibile almeno un **cliente di test** con clienti/app associati.
- Dataset con news riferite alla **2026 Wave 1** (necessario per il TC sul conteggio wave).
- Nessun preset/filtro residuo da sessioni precedenti (partire da stato pulito o annotare lo stato iniziale).

## 4. Nota semantica importante (da confermare con il Product Owner)

Nel comportamento atteso di molti filtri vale la regola **"selezione vuota = filtro non attivo = mostra tutto"**: una sezione (prodotti, app, clienti, ecc.) senza alcuna voce selezionata **non applica alcun vincolo** e quindi mostra tutti gli elementi.

Di conseguenza **alcune** osservazioni dell'utente (es. "deseleziono tutto e ricompaiono tutti i prodotti", "mostra comunque tutti i clienti") **potrebbero essere il comportamento previsto** e non un difetto. I test case che dipendono da questa ambiguità sono marcati **⚠️ da confermare con il PO**: prima di dichiararli `Fail`, va chiarita l'intenzione di design.

---

## 5. Riepilogo test case

| TC-ID | Area | Sintesi | Stato |
|---|---|---|---|
| TC-01 | Filtri Globali · Prodotti | Deselezione dei prodotti (compreso l'ultimo rimasto) | ✅ Pass |
| TC-02 | Filtri Globali · App | Deselezione delle app (compresa l'ultima rimasta) | ✅ Pass |
| TC-03 | Filtri Globali · App | Voci duplicate / con percorso nell'elenco app | ✅ Risolto |
| TC-04 | Filtri · Clienti | Il filtro "i miei clienti" mostra solo i clienti attesi | ✅ Pass |
| TC-05 | Filtri Globali → Dashboard | Il filtro impostato nei Filtri Globali si applica alla Dashboard | ✅ Pass (con riserva post-fix) |
| TC-06 | Dashboard → Filtri Globali | Il filtro impostato in Dashboard si riflette nei Filtri Globali | ⚠️ Da confermare con PO |
| TC-07 | Navigazione | Il filtro non viene resettato tornando alla Dashboard | 🔧 **Corretto e verificato** |
| TC-08 | Filtri Globali · Wave | Filtro "ultima wave" e conteggio news (BC 2026 Wave 1) | ✅ Pass (dato aggiornato) |
| TC-09 | Persistenza dopo riavvio | Il filtro sopravvive al riavvio del portale | 🔧 **Corretto e verificato** (filtro Dashboard) |

Legenda **Esito**: `Pass` / `Fail` / `Blocked` / `⚠️ Da confermare con PO`.

> **Esiti registrati il 2026-07-17** — vedi sezione **[6-bis. Esiti esecuzione](#6-bis-esiti-esecuzione-2026-07-17)** per il dettaglio, le evidenze e il root cause. Esecuzione su ambiente **locale** (`http://localhost:5173`, commit `868050f`), build corrente del portale.

---

## 6. Test case dettagliati

### TC-01 · Deselezione dei prodotti nei Filtri Globali ⚠️ da confermare con il PO

**Area:** Pagina *Filtri Globali* → sezione *Prodotti*.

**Passi:**
1. Aprire i Filtri Globali.
2. Deselezionare manualmente tutti i prodotti tranne uno (es. *Power Pages*).
3. Deselezionare anche l'ultimo prodotto rimasto.
4. Osservare lo stato delle checkbox.

**Risultato atteso:**
- La deselezione delle singole voci deve essere stabile: deselezionando una voce **solo quella** cambia stato.
- Da chiarire con il PO il comportamento quando la selezione diventa vuota:
  - se "vuoto = mostra tutto", le checkbox possono ripresentarsi tutte selezionate **per design** (in tal caso `Pass`);
  - se è previsto uno stato "nessun prodotto selezionato" distinto, la ri-selezione automatica è un difetto.

**Segnalazione utente (da verificare):** deselezionando l'ultimo prodotto (Power Pages) si **ri-selezionano automaticamente tutti** i prodotti; stesso effetto deselezionando la prima voce dopo aver già svuotato la selezione.

**Riferimenti visivi:**

![TC-01 – sezione prodotti](assets/uat-update-lens/image2.png)
![TC-01 – deselezione prodotti](assets/uat-update-lens/image3.png)
![TC-01 – ultimo prodotto (Power Pages)](assets/uat-update-lens/image4.png)

**Esito:** ______  **Note:** ______

---

### TC-02 · Deselezione delle app nei Filtri Globali ⚠️ da confermare con il PO

**Area:** Pagina *Filtri Globali* → sezione *App*.

**Passi:**
1. Aprire i Filtri Globali.
2. Deselezionare manualmente tutte le app tranne una.
3. Deselezionare anche l'ultima app rimasta.
4. Osservare lo stato delle checkbox.

**Risultato atteso:** stesso criterio di TC-01 applicato alla sezione App: la deselezione della singola voce deve essere stabile; il comportamento a selezione vuota va confermato con il PO (regola "vuoto = mostra tutto").

**Segnalazione utente (da verificare):** come per i prodotti, deselezionando l'ultima app si **ri-selezionano tutte** le app.

**Riferimenti visivi:**

![TC-02 – deselezione app](assets/uat-update-lens/image5.png)

**Esito:** ______  **Note:** ______

---

### TC-03 · Voci duplicate / con percorso nell'elenco app

**Area:** Pagina *Filtri Globali* → sezione *App*.

**Passi:**
1. Aprire l'elenco delle app nei Filtri Globali.
2. Scorrere le voci disponibili.

**Risultato atteso:** ogni app compare **una sola volta**, con etichetta pulita e senza percorso/prefisso tecnico duplicato.

**Segnalazione utente (da verificare):** nel filtro app compaiono **due voci uguali**, una delle quali con un percorso.

**Riferimenti visivi:**

![TC-03 – voci app duplicate](assets/uat-update-lens/image6.png)

**Esito:** ______  **Note:** ______

---

### TC-04 · Il filtro clienti mostra solo i clienti attesi ⚠️ da confermare con il PO

**Area:** Filtro *Clienti* (dashboard/filtri).

**Passi:**
1. Selezionare "i miei clienti" (o un sottoinsieme specifico di clienti).
2. Applicare il filtro.
3. Verificare l'elenco/i risultati mostrati.

**Risultato atteso:** una volta selezionati clienti specifici, devono essere mostrati **solo** i clienti/news pertinenti alla selezione. (Se nessun cliente è selezionato, per la regola "vuoto = mostra tutto" è corretto vederli tutti.)

**Segnalazione utente (da verificare):** dopo aver selezionato i propri clienti, il filtro mostra **comunque tutti** i clienti.

**Riferimenti visivi:**

![TC-04 – selezione clienti](assets/uat-update-lens/image7.png)
![TC-04 – risultato filtro clienti](assets/uat-update-lens/image8.png)
![TC-04 – scelta cliente](assets/uat-update-lens/image9.png)

**Esito:** ______  **Note:** ______

---

### TC-05 · Il filtro dei Filtri Globali si applica alla Dashboard

**Area:** *Filtri Globali* → *Dashboard*.

**Passi:**
1. Nei Filtri Globali selezionare un cliente e un sottoinsieme di prodotti/app.
2. Cliccare per **applicare** il filtro.
3. Tornare alla Dashboard e verificare le news mostrate.

**Risultato atteso:** la Dashboard mostra le news **coerenti con il filtro** appena applicato; i criteri impostati nei Filtri Globali non vengono alterati durante il passaggio alla Dashboard.

**Segnalazione utente (da verificare):** applicando dai Filtri Globali il filtro **non sembra applicarsi**: prima di tornare alla Dashboard i filtri prodotti risultano **reimpostati**.

**Riferimenti visivi:**

![TC-05 – applica filtro](assets/uat-update-lens/image10.png)
![TC-05 – ritorno dashboard 1](assets/uat-update-lens/image11.png)
![TC-05 – ritorno dashboard 2](assets/uat-update-lens/image12.png)
![TC-05 – ritorno dashboard 3](assets/uat-update-lens/image13.png)
![TC-05 – verifica news 1](assets/uat-update-lens/image14.png)
![TC-05 – verifica news 2](assets/uat-update-lens/image15.png)
![TC-05 – verifica news 3](assets/uat-update-lens/image16.png)
![TC-05 – verifica news 4](assets/uat-update-lens/image17.png)
![TC-05 – verifica news 5](assets/uat-update-lens/image18.png)

**Esito:** ______  **Note:** ______

---

### TC-06 · Il filtro impostato in Dashboard si riflette nei Filtri Globali

**Area:** *Dashboard* → *Filtri Globali*.

**Passi:**
1. Impostare un filtro direttamente nella Dashboard.
2. Aprire i Filtri Globali.
3. Confrontare i criteri mostrati con quelli impostati in Dashboard.

**Risultato atteso:** il filtro impostato in Dashboard viene **riportato coerentemente** anche nei Filtri Globali (stessa selezione in entrambe le viste).

**Segnalazione utente (da verificare):** impostando il filtro nella Dashboard **sembra funzionare** e il filtro viene riportato anche come filtro globale. *(Osservazione tendenzialmente positiva: va confermata la coerenza in entrambe le direzioni.)*

**Riferimenti visivi:**

![TC-06 – filtro da dashboard](assets/uat-update-lens/image26.png)
![TC-06 – riportato come filtro globale](assets/uat-update-lens/image27.png)

**Esito:** ______  **Note:** ______

---

### TC-07 · Il filtro non viene resettato tornando alla Dashboard

**Area:** Navigazione tra viste.

**Passi:**
1. Impostare e applicare un filtro (da Filtri Globali o da Dashboard).
2. Navigare avanti e indietro tra Dashboard e Filtri Globali.
3. Verificare a ogni passaggio lo stato dei filtri (prodotti, app, cliente, origine).

**Risultato atteso:** il filtro applicato **rimane stabile** durante la navigazione; nessuna selezione viene azzerata o ripristinata automaticamente al ritorno in Dashboard.

**Segnalazione utente (da verificare):**
- applicando e tornando alla Dashboard il filtro viene **resettato**;
- tornando ai Filtri Globali risultano **ri-selezionati tutti** i prodotti e le app.

**Riferimenti visivi:**

![TC-07 – ritorno filtri globali 1](assets/uat-update-lens/image19.png)
![TC-07 – ritorno filtri globali 2](assets/uat-update-lens/image20.png)
![TC-07 – ritorno filtri globali 3](assets/uat-update-lens/image21.png)
![TC-07 – ritorno filtri globali 4](assets/uat-update-lens/image22.png)
![TC-07 – nuovo tentativo 1](assets/uat-update-lens/image23.png)
![TC-07 – nuovo tentativo 2](assets/uat-update-lens/image24.png)
![TC-07 – sembra non filtrare](assets/uat-update-lens/image25.png)
![TC-07 – reset al ritorno dashboard](assets/uat-update-lens/image28.png)

**Esito:** ______  **Note:** ______

---

### TC-08 · Filtro "ultima wave" e conteggio news (BC 2026 Wave 1)

**Area:** *Filtri Globali* → filtro *Wave / orizzonte temporale*.

**Passi:**
1. Reimpostare il filtro cliente dalla Dashboard.
2. Passare ai Filtri Globali.
3. Aggiungere il filtro **ultima wave**.
4. Verificare il **totale news** aggiornato.
5. Tornare alla Dashboard e verificare che il filtro wave sia mantenuto.

**Risultato atteso:**
- il conteggio totale si aggiorna coerentemente: per BC **2026 Wave 1** sono attese **4** news;
- il filtro wave resta applicato anche tornando alla Dashboard (collegato a TC-07).

**Segnalazione utente (da verificare):**
- il totale si aggiorna correttamente (4 news per BC 2026 Wave 1) → *da confermare*;
- tornando alla Dashboard il filtro viene **reimpostato/resettato** → *difetto candidato, collegato a TC-07*.

**Riferimenti visivi:**

![TC-08 – reimposta filtro dashboard](assets/uat-update-lens/image29.png)
![TC-08 – passaggio ai filtri globali](assets/uat-update-lens/image30.png)
![TC-08 – aggiunta filtro ultima wave 1](assets/uat-update-lens/image31.png)
![TC-08 – aggiunta filtro ultima wave 2](assets/uat-update-lens/image32.png)
![TC-08 – totale aggiornato / dashboard](assets/uat-update-lens/image33.png)
![TC-08 – filtro reimpostato](assets/uat-update-lens/image34.png)

**Esito:** ______  **Note:** ______

---

### TC-09 · Persistenza del filtro associato al cliente dopo riavvio del portale

**Area:** Persistenza per cliente.

**Passi:**
1. Selezionare un cliente e impostare un filtro (prodotti, origine, wave, ecc.).
2. Applicare/salvare il filtro in capo al cliente.
3. **Chiudere e rilanciare** il portale.
4. Riselezionare lo stesso cliente e verificare lo stato del filtro.

**Risultato atteso:** al riavvio, selezionando il cliente, il portale **ripristina il filtro precedentemente associato** a quel cliente (incluse le spunte sui prodotti).

**Segnalazione utente (da verificare):**
- dopo chiusura e riavvio il filtro **non risulta memorizzato** per il cliente;
- vengono mantenuti **cliente e origine**, ma le **spunte sui prodotti sono reimpostate**;
- anche in questo flusso "non funziona il deseleziona" (collegato a TC-01/TC-02).

**Riferimenti visivi:**

![TC-09 – deseleziona non funziona](assets/uat-update-lens/image35.png)
![TC-09 – reimposto filtro 1](assets/uat-update-lens/image36.png)
![TC-09 – reimposto filtro 2](assets/uat-update-lens/image37.png)
![TC-09 – reimposto filtro 3](assets/uat-update-lens/image38.png)
![TC-09 – dopo riavvio 1](assets/uat-update-lens/image39.png)
![TC-09 – dopo riavvio 2](assets/uat-update-lens/image40.png)
![TC-09 – dopo riavvio 3](assets/uat-update-lens/image41.png)

**Esito:** ______  **Note:** ______

---

## 6-bis. Esiti esecuzione (2026-07-17)

**Ambiente:** locale · portale `http://localhost:5173` · API `http://localhost:4000` · commit `868050f` · esecuzione assistita via browser automation.
**Cliente/preset:** preset *Default*, "Tutti i clienti" salvo dove indicato.

### Sintesi

Le anomalie **puntuali** segnalate dall'utente (report del 22/01/2025) **non si riproducono** sulla build corrente: deselezione prodotti/app e voce app malformata risultano **risolte** (verificate su entrambe le superfici, Filtri Globali e sidebar Dashboard). **Si riproduce invece** l'osservazione centrale — "il filtro si resetta al ritorno in Dashboard / al riavvio" — che risulta un **difetto reale di persistenza dei filtri impostati nella sidebar della Dashboard** (TC-07, TC-09). La causa non è la deselezione, come ipotizzato nel report, ma il diverso comportamento delle due superfici filtro.

### Scoperta chiave – comportamento osservato (le due superfici filtro)

**Comportamento osservato** (verifica black-box, non confermata sul codice sorgente):

- I **Filtri Globali** sono i *default di sistema* (auto-salvati nel preset). I filtri impostati qui **si propagano alla Dashboard e persistono** a navigazione e a ricarica (F5). ✅
- I filtri impostati **ad-hoc nella sidebar della Dashboard** sono **transitori**: vengono **scartati** sia cambiando pagina (Dashboard → Filtri Globali → Dashboard) sia al **reload (F5)**, tornando ai default globali. ❌
- Sincronizzazione osservata **a senso unico**: `Filtri Globali → Dashboard` sì; `Dashboard → Filtri Globali` no.

**Meccanismo probabile** (da confermare nel codice / con il PO): compatibile con una **ri-eredità dei default globali** ad ogni mount della Dashboard, che sovrascrive le modifiche locali di sessione.

Questo spiega esattamente ciò che l'utente ha vissuto come "il filtro si resetta / ri-seleziona tutto": impostava i filtri **nella Dashboard**, che vengono persi al cambio pagina e al riavvio. **Prova discriminante:** impostato "solo Business Central" nella sidebar Dashboard (KPI MICROSOFT 308) → F5 → KPI torna a 1288 (tutti i prodotti). Lo stesso filtro impostato nei **Globali** invece sopravvive a F5.

### Dettaglio per test case

| TC | Esito | Evidenza osservata |
|---|---|---|
| **TC-01** Deselezione prodotti | ✅ **Pass** | Verificato **su entrambe le superfici** (Filtri Globali e sidebar Dashboard). "Deseleziona tutti" deseleziona tutte le voci e **restano** deselezionate; deselezionando manualmente fino all'ultima voce (Ai Builder) **non** si ri-selezionano. Il filtro è applicato (STATO da "TUTTE LE FONTI" a "EOS APPS + FABRIC + M365", Launched 2924→1819). **Non riproduce.** |
| **TC-02** Deselezione app | ✅ **Pass** | Stesso comportamento corretto sulle App (EOS), su entrambe le superfici, sia via "Deseleziona tutti" sia deselezionando l'ultima voce. **Non riproduce.** |
| **TC-03** Voci app duplicate | ✅ **Risolto** | Scansione DOM dell'intera sezione App (50 voci): nessun duplicato, nessuna etichetta con URL/percorso. "Product Quality Assurance" ora è **voce unica e pulita (12)**. Le due voci malformate `[Product Quality Assurance](url)` della segnalazione **non esistono più**. |
| **TC-04** Filtro clienti | ✅ **Pass** | Selezionando Owner CSS "Alessandro Levantini (8)" i CLIENTI INCLUSI passano 32→**8** e il selettore clienti in alto diventa "Clienti filtrati (8)". Il filtro clienti funziona (coerente anche con la schermata originale image7, che mostrava 9 clienti). |
| **TC-05** Globali → Dashboard | ✅ **Pass** / ⚠️ **riserva post-fix** | Impostato in Globali "solo Business Central" (media prodotti/cliente 4934→3954). Sulla Dashboard: KPI **MICROSOFT = 308** (= conteggio BC), TOTALE 4934→3954, sidebar mostra **solo BC**. Propagazione corretta. **Nota (conseguenza del fix di persistenza):** la propagazione Globali→Dashboard vale ora solo per i campi **non ancora modificati** nella Dashboard. Verifica: BC-only in Dashboard (override) → in Globali cambio prodotti a Commerce → torno alla Dashboard: mostra ancora **BC 308** (l'override vince), **non** Commerce. Per far ri-propagare i Globali su quel campo serve "Ripristina filtri globali" o cambio preset. Vedi raccomandazione 1-bis. |
| **TC-06** Dashboard → Globali | ⚠️ **Da confermare con PO** | Aggiunta "Ai Builder" + wave dalla **Dashboard** → nei Filtri Globali **non** compaiono (restano solo BC, wave vuote). Sincronizzazione **a senso unico**. Da chiarire se è il design voluto (Dashboard = filtri di lavoro, Globali = default). Nota: la schermata utente image27 ("riportato come filtro globale") **non si riproduce**. |
| **TC-07** Reset in navigazione | ⚠️ **Da confermare con PO / difetto UX** | Filtri impostati **nei Globali**: **persistono** in navigazione (BC resta, KPI 308 stabile). Filtri impostati **nella Dashboard** (Ai Builder + wave): dopo Dashboard→Globali→Dashboard **vengono azzerati** (KPI 11→308, Ai Builder deselezionato). **Riproduce l'osservazione dell'utente.** Da confermare con il PO se il reset dei filtri di sessione della Dashboard è intenzionale; dal punto di vista utente è percepito come difetto. |
| **TC-08** Ultima wave + conteggio | ✅ **Pass (dato aggiornato)** | Il filtro "2026 release wave 1" funziona e aggiorna i totali: con BC selezionato → KPI **MICROSOFT = 11**, TOTALE 3657. Il valore atteso dall'utente (**4**) è cambiato per effetto del **refresh mensile dei dati** (commit "monthly data refresh 2026-03"): differenza di dato, non difetto. Nota: se impostata dalla Dashboard, la wave è transitoria come da TC-07. |
| **TC-09** Persistenza dopo riavvio | ❌ **Riproduce** (Dashboard) / ✅ **Pass** (Globali) | **Prova discriminante:** filtro "solo Business Central" impostato **nella sidebar Dashboard** (KPI MICROSOFT 308) → **F5** → KPI torna a **1288** (tutti i prodotti): **il filtro non è persistito**. Riproduce la segnalazione "rilancio il portale e reimposta le spunte sui prodotti". Al contrario, lo stesso filtro impostato **nei Filtri Globali** (auto-save preset) **sopravvive a F5** (KPI resta 308). La memoria **specifica per singolo cliente** non è stata verificata in modo esaustivo (la selezione del singolo cliente dal selettore in alto non è rimasta impostata nel test) → **da confermare con PO** la semantica per-cliente. |

### Raccomandazioni

1. **Persistenza filtri Dashboard (TC-07/TC-09) — priorità alta.** I filtri impostati nella sidebar della Dashboard non sopravvivono né alla navigazione né al reload. Decidere con il PO il comportamento voluto e implementarlo:
   - **Opzione A:** rendere persistenti i filtri di sessione della Dashboard (localStorage/preset), così sopravvivono a navigazione e riavvio;
   - **Opzione B:** se il reset è intenzionale (Dashboard = filtri temporanei, Globali = default), aggiungere un segnale UX chiaro (es. "filtri temporanei — salvali nei Globali per renderli persistenti") per eliminare la percezione di bug.
1-bis. **Precedenza override Dashboard vs propagazione Globali (TC-05, post-fix):** con la persistenza attiva, l'override Dashboard prevale sui Globali per i campi già toccati. Decidere se accettabile o se aggiungere un pulsante Dashboard "Torna ai filtri globali" e/o propagazione per-campo (vedi sezione Fix applicati).
2. **Sincronizzazione a senso unico (TC-06):** confermare se `Dashboard → Filtri Globali` debba propagare; la schermata utente image27 lasciava intendere di sì.
3. **TC-08:** aggiornare l'aspettativa numerica del test (BC 2026 Wave 1) al dato corrente o parametrizzarla, dato il refresh mensile.
4. **TC-09 per-cliente:** definire e testare esplicitamente la semantica di persistenza filtro per singolo cliente (nel test la selezione del singolo cliente dal selettore in alto non è rimasta impostata: verificare anche questo).

### Fix applicati (2026-07-17)

Scelta di design confermata: **i filtri della sidebar Dashboard devono persistere** (navigazione + reload), per scope globale e per cliente.

**Causa nel codice:** le modifiche della sidebar Dashboard erano tenute in `tempFilters` (state locale di `DashboardPage`), non persistito e perso allo smontaggio del componente → al ritorno/reload si ri-ereditavano i default globali (`cssFilters`).

**Modifiche:**

- `src/app/store/useFilterStore.ts` — nuovo stato **`dashboardOverrides: Record<scopeKey, Partial<FilterState>>`** persistito in localStorage (`updatelens.filters.dashboard.overrides.v1`), con azioni `setDashboardOverride` / `clearDashboardOverride`. `resetAllFilters` azzera anche gli override.
- `src/app/pages/DashboardPage.tsx` — `tempFilters` non è più state locale ma è derivato dallo store per scope (`global` / `customer:<id>`); `updateFilters` scrive l'override persistito; il cambio preset e il cambio cliente non "svuotano" più a mano (lo scope carica automaticamente gli override giusti).
- `src/app/pages/GlobalFiltersPage.tsx` — "Ripristina filtri globali", "Reset prodotti cliente" e il cambio preset azzerano il relativo override Dashboard, così il reset/preset mostra lo stato pulito.
- `src/app/pages/DashboardPage.tsx` (rifinitura) — pulsante **"Torna ai filtri globali"** nella sidebar, visibile solo quando esiste un override per lo scope corrente: lo azzera con un clic e riallinea la Dashboard ai Filtri Globali senza cambiare pagina. Risolve la mancanza di "escape hatch" del trade-off TC-05 (vedi sotto).

**Verifiche eseguite (browser, scope globale):**

| Scenario | Prima | Dopo il fix |
|---|---|---|
| BC-only in Dashboard → **F5** | KPI 308 → **1288** (perso) | KPI **308** (persiste) ✅ |
| BC-only → Dashboard→Globali→Dashboard | 308 → **azzerato** | **308** (persiste) ✅ |
| "Ripristina filtri globali" → Dashboard | (n/a) | KPI torna a **1288** (override azzerato) ✅ |

`npm run typecheck` verde. Scope **per-cliente**: stessa logica keyed del globale; verifica end-to-end del singolo cliente limitata da un comportamento separato del selettore cliente in alto (la selezione del singolo cliente non è rimasta impostata nel test) — vedi raccomandazione 4.

**Trade-off introdotto dal fix (da valutare — racc. 1-bis).** Poiché l'override della Dashboard ha la precedenza sui filtri globali nel merge (`{...base, ...override}`), una volta modificato un campo nella Dashboard le successive modifiche dei **Filtri Globali su quello stesso campo non si propagano più** alla Dashboard (finché non si esegue "Ripristina filtri globali" o si cambia preset). È la diretta conseguenza della scelta "Persistere": i filtri Dashboard diventano persistenti *e prevalenti*.

**Mitigazione implementata:** aggiunto il pulsante **"Torna ai filtri globali"** nella sidebar Dashboard (chiama `clearDashboardOverride(scopeKey)`), visibile solo quando esiste un override, che riallinea la Dashboard ai Globali con un clic. Verificato: appare quando si modifica un filtro nella Dashboard e al clic azzera l'override riportando i KPI ai default globali (1288 / 4934).

Ulteriore rifinitura possibile (non implementata): invalidare selettivamente l'override sul singolo campo quando quel campo viene cambiato nei Globali (propagazione per-campo), per preservare persistenza *e* propagazione contemporaneamente.

---

## 7. Punti aperti da chiarire prima/durante l'esecuzione

1. **Semantica "selezione vuota"** (TC-01, TC-02, TC-04): "vuoto = mostra tutto" è il comportamento voluto? Serve uno stato distinto "nessuna voce selezionata"?
2. **Persistenza filtri per cliente** (TC-09): dove devono essere salvati (preset lato utente, storage locale, backend)? Qual è lo scope atteso della persistenza dopo riavvio?
3. **Voce duplicata app con percorso** (TC-03): è un problema di dato sorgente o di rendering dell'etichetta?

---

_Documento generato a partire dalle osservazioni in `docs/TEST UPDATE LENS.docx`. Le immagini di riferimento sono in `docs/assets/uat-update-lens/` (nomi originali `image1.png … image41.png`)._
