# UpdateLens – Integrazione Microsoft Learn (Soluzione A)

**Versione:** 1.0
**Stato:** Design approvato
**Owner:** UpdateLens team

---

## 1. Obiettivo

Arricchire le **card degli aggiornamenti** di UpdateLens con collegamenti mirati ai contenuti **Microsoft Learn** (learning path, moduli, corsi, certificazioni), in modo da consentire all’utente di:

* comprendere meglio l’impatto funzionale di una release;
* accedere rapidamente a contenuti formativi ufficiali;
* collegare aggiornamenti di prodotto e percorso di apprendimento.

L’integrazione segue un approccio **server-side (enrichment)** durante il refresh dei dati.

---

## 2. Scopo della Soluzione A (Enrichment server-side)

La **Soluzione A** prevede:

* interrogazione del **Microsoft Learn Catalog API** durante il refresh dei dati;
* normalizzazione e caching dei contenuti Learn;
* associazione deterministica tra release UpdateLens e risorse Learn;
* esposizione in UI di un pulsante **“Learn”** solo quando esiste una corrispondenza valida.

Nessuna chiamata diretta alle API Learn viene effettuata dal browser.

---

## 3. Architettura logica

### 3.1 Componenti coinvolti

* **Azure Function / Refresh Worker**
  Responsabile dell’aggiornamento delle fonti (Microsoft, EOS, Fabric, ecc.), esteso con modulo `learn-enrichment`.

* **Microsoft Learn Catalog API**
  Sorgente ufficiale dei contenuti formativi.

* **Storage / Cache**
  Blob Storage o equivalente per file JSON di mapping e cache.

* **Frontend UpdateLens**
  Consuma esclusivamente dati già arricchiti.

---

## 4. Flusso di elaborazione

### 4.1 Refresh dati (pipeline)

1. Avvio refresh (manuale o schedulato)
2. Recupero release da fonti primarie (Microsoft, EOS, Fabric)
3. **Learn enrichment step**:

   * identificazione del prodotto principale della release;
   * query al Learn Catalog API;
   * ranking dei risultati;
   * selezione della risorsa Learn più rilevante.
4. Persistenza del dato arricchito
5. Esposizione via API UpdateLens

---

## 5. Microsoft Learn Catalog API

### 5.1 Endpoint

```
https://learn.microsoft.com/api/catalog/
```

### 5.2 Parametri utilizzati

* `product`
* `type` (learningPath, module, course)
* `level` (beginner, intermediate, advanced)
* `locale` (it-it / en-us)

### 5.3 Output rilevante (estratto)

```json
{
  "uid": "learning-path-id",
  "title": "Data Factory in Microsoft Fabric",
  "url": "https://learn.microsoft.com/...",
  "type": "learningPath",
  "level": "intermediate",
  "products": ["fabric", "data-factory"]
}
```

---

## 6. Strategia di matching

### 6.1 Livello 1 – Prodotto

Mapping statico iniziale:

```json
{
  "Data Factory": "data-factory",
  "Microsoft Fabric": "fabric",
  "Dynamics 365 Business Central": "business-central",
  "Microsoft 365": "microsoft-365"
}
```

### 6.2 Livello 2 – Ranking locale

Per ogni release:

* +3 punti se il titolo Learn contiene parole chiave del titolo release;
* +2 punti se `type = learningPath`;
* +1 punto se `level = intermediate`;
* −1 punto se contenuto troppo generico.

La risorsa con punteggio più alto viene selezionata come primaria.

---

## 7. Modello dati UpdateLens

### 7.1 Estensione `ReleaseItem`

```ts
interface ReleaseItem {
  id: string;
  title: string;
  product: string;
  source: string;
  releaseDate: string;

  learnUrl?: string;
  learnMeta?: {
    title: string;
    type: "learningPath" | "module" | "course";
    level?: string;
  };
}
```

`learnUrl` è **opzionale** e valorizzato solo se esiste un match affidabile.

---

## 8. Cache Learn

### 8.1 Struttura

File: `learn_catalog_cache.json`

```json
{
  "data-factory": [ { /* risorse Learn */ } ],
  "fabric": [ { /* risorse Learn */ } ]
}
```

### 8.2 Politica di aggiornamento

* refresh completo: 1 volta al giorno;
* invalidazione manuale possibile;
* fallback su cache se API non disponibile.

---

## 9. UX – Dashboard (card aggiornamenti)

* pulsante secondario: **Learn**;
* visibile solo se `learnUrl` esiste;
* apertura in nuova tab.

**Regola di idempotenza**

* se `learnUrl` è già presente → **nessuna azione**;
* l’enrichment agisce solo sugli item privi di `learnUrl`.

---

## 10. Gestione errori

* Nessun match → nessun pulsante Learn;
* Learn API non disponibile → uso cache;
* Timeout → skip enrichment (non blocca il refresh).

---

## 11. Benefici

* Nessun impatto prestazionale lato UI;
* approccio deterministico e controllabile;
* coerenza con architettura offline-first;
* base solida per estensioni future (ruoli, certificazioni, percorsi EOS).

---

## 12. Pagina **Learn** (per prodotto)

### 12.1 Obiettivo UX

Separare chiaramente **aggiornamenti** (Dashboard) e **formazione** (Learn), offrendo una consultazione rapida, filtrabile e orientata all’azione.

### 12.2 Navigazione

* voce di menu: **Learn**;
* posizione: **subito dopo “Filtri globali”**;
* routing:

  * `/learn` (overview);
  * `/learn/:productKey` (vista prodotto).

### 12.3 Layout

Layout a **due colonne**:

* sinistra: filtri (sticky);
* centro: lista card Learn.

### 12.4 Filtri

* Prodotto (obbligatorio);
* Tipo contenuto (learning path, module, course, certification);
* Livello (beginner, intermediate, advanced);
* Fonte (Microsoft Learn; futuro EOS Academy);
* Ricerca testuale;
* Reset filtri.

### 12.5 Card Learn

Ogni card mostra:

* titolo;
* badge tipo e livello;
* breve descrizione;
* CTA **Apri su Learn**.

### 12.6 Ordinamento default

1. Learning Path
2. Module
3. Course / Certification

All’interno: Intermediate → Beginner → Advanced.

### 12.7 Stati UI

* Loading (skeleton);
* Empty state con suggerimento;
* Error state.

### 12.8 Relazione con Dashboard

* card Dashboard → link singolo (`learnUrl`);
* pagina Learn → vista completa per prodotto.

---

## 13. Checklist di sviluppo FE / BE

### 13.1 Backend / Data pipeline

* [ ] Mapping `productName → learnProductKey`.
* [ ] Client server-side Learn Catalog API.
* [ ] Idempotenza: se `learnUrl` esiste → skip.
* [ ] Ranking deterministico e selezione primaria.
* [ ] Cache Learn + fallback.
* [ ] Logging e metriche.
* [ ] API per Dashboard e pagina Learn.

### 13.2 Frontend – Dashboard

* [ ] Pulsante Learn solo se `learnUrl` presente.
* [ ] Apertura nuova tab.

### 13.3 Frontend – Pagina Learn

* [ ] Voce menu Learn (dopo Filtri globali).
* [ ] Routing `/learn/:productKey`.
* [ ] Layout 2 colonne.
* [ ] Filtri completi.
* [ ] Card Learn con CTA.
* [ ] Stati UI (loading, empty, error).

### 13.4 Stato e preferenze utente

* [ ] Persistenza prodotto selezionato.
* [ ] Persistenza filtri per sessione.

### 13.5 Qualità e test

* [ ] Test enrichment (match / no match).
* [ ] Test idempotenza.
* [ ] Test UI Learn e Dashboard.

### 13.6 Go-live

* [ ] Feature flag Learn.
* [ ] Validazione su 2–3 prodotti pilota.
* [ ] Monitoraggio utilizzo link Learn.

---

## 14. Estensioni future

* personalizzazione per ruolo utente;
* suggerimenti Learn assistiti da AI;
* tracking avanzato utilizzo contenuti;
* integrazione percorsi formativi EOS.

---

**Documento unico di riferimento per sviluppo FE/BE e pianificazione operativa.**

---

## 15. Stato implementazione (aggiornato al 2026-02-04)

### 15.1 Implementato

- Enrichment server-side Microsoft Learn durante i refresh dati.
- Modulo condiviso: `tools/learnEnrichment.ts`.
- Cache catalogo Learn con file locale e pubblico:
  - `src/data/cache/learn_catalog_cache.json`
  - `public/data/learn_catalog_cache.json`
- Mapping prodotto -> `learnProductKey` con regole deterministiche.
- Ranking locale implementato (keyword/tipo/livello/penalita generici + match prodotto).
- Idempotenza implementata: se `learnUrl` e gia presente, item saltato.
- Fallback su cache se API Learn non disponibile.
- Estensione modello `ReleaseItem` con:
  - `learnUrl`
  - `learnMeta` (`title`, `type`, `level`, `uid`, `productKey`, `score`)

### 15.2 Pipeline backend/dati aggiornata

Enrichment Learn integrato nei refresh:

- `tools/refreshMicrosoft.ts`
- `tools/refreshFabric.ts`
- `tools/refreshM365Roadmap.ts`
- `tools/refreshEos.ts`

Ogni refresh ora:

1. Estrae gli item della sorgente.
2. Esegue enrichment Learn (idempotente).
3. Salva snapshot arricchita.
4. Logga metriche (`matched`, `skipped`, `missingMapping`).

### 15.3 Frontend Dashboard

- CTA secondaria card aggiornamenti rinominata da **Doc** a **Learn**.
- CTA visibile solo se `learnUrl` valido (comportamento gia coerente con requisito).
- Apertura in nuova tab confermata.

### 15.4 Nuova pagina Learn

Implementata nuova pagina dedicata:

- Route:
  - `/learn`
  - `/learn/:productKey`
- Voce menu **Learn** aggiunta subito dopo **Filtri globali**.
- Layout a due colonne:
  - sinistra: filtri sticky
  - centro: lista card Learn
- Filtri implementati:
  - prodotto (obbligatorio)
  - tipo contenuto
  - livello
  - fonte
  - ricerca testuale
  - reset filtri
- Ordinamento implementato:
  - Learning Path -> Module -> Course -> Certification -> Documentation
  - livello: Intermediate -> Beginner -> Advanced -> Unknown
- Stati UI implementati:
  - loading (skeleton)
  - empty state
  - error state
- Persistenza filtri/prodotto in sessione:
  - `sessionStorage` key: `updatelens.learn.filters.v1`

### 15.5 File introdotti/modificati

Nuovi file:

- `tools/learnEnrichment.ts`
- `src/utils/learn.ts`
- `src/app/pages/LearnPage.tsx`

File aggiornati:

- `tools/refreshMicrosoft.ts`
- `tools/refreshFabric.ts`
- `tools/refreshM365Roadmap.ts`
- `tools/refreshEos.ts`
- `src/models/ReleaseItem.ts`
- `src/App.tsx`
- `src/app/pages/DashboardPage.tsx`

### 15.6 Checklist aggiornata

#### Backend / Data pipeline

- [x] Mapping `productName -> learnProductKey`.
- [x] Client server-side Learn Catalog API.
- [x] Idempotenza: se `learnUrl` esiste -> skip.
- [x] Ranking deterministico e selezione primaria.
- [x] Cache Learn + fallback.
- [x] Logging e metriche.
- [ ] API dedicate per pagina Learn (attualmente la pagina usa snapshot gia caricati lato FE).

#### Frontend - Dashboard

- [x] Pulsante Learn solo se `learnUrl` presente.
- [x] Apertura nuova tab.

#### Frontend - Pagina Learn

- [x] Voce menu Learn (dopo Filtri globali).
- [x] Routing `/learn/:productKey`.
- [x] Layout 2 colonne.
- [x] Filtri completi.
- [x] Card Learn con CTA.
- [x] Stati UI (loading, empty, error).

#### Stato e preferenze utente

- [x] Persistenza prodotto selezionato.
- [x] Persistenza filtri per sessione.

#### Qualita e test

- [x] Typecheck (`npm run typecheck`).
- [ ] Test enrichment automatizzati (match / no match).
- [ ] Test idempotenza automatizzati.
- [ ] Test UI Learn e Dashboard automatizzati.
