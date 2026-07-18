# UAT Update Lens – Checklist di esecuzione (manuale)

> Checklist operativa da compilare durante l'esecuzione. Fa da companion al piano `UAT_UPDATE_LENS.md`.
> Per ogni test: esegui i passi (spunta `[ ]`), confronta con il **Risultato atteso**, poi compila **Esito** e **Note**.
> **Non dare per scontata la segnalazione**: registra ciò che osservi realmente. Se il comportamento coincide con la regola "selezione vuota = mostra tutto", potrebbe essere corretto → segna `⚠️ Da confermare con PO`.

## Come compilare l'Esito
- ✅ **Pass** – comportamento = risultato atteso
- ❌ **Fail** – comportamento ≠ risultato atteso (difetto)
- ⚠️ **Da confermare con PO** – comportamento ambiguo, dipende dall'intenzione di design
- ⛔ **Blocked** – non eseguibile (precondizione mancante, errore bloccante)

---

## Ambiente di esecuzione

| Voce | Valore |
|---|---|
| URL portale | `http://localhost:5173` (locale, server già avviati) |
| API | `http://localhost:4000` |
| Versione / commit | _______________ |
| Browser + versione | _______________ |
| Data / ora | _______________ |
| Tester | _______________ |

**Precondizioni** (spunta prima di iniziare):
- [ ] Login effettuato / portale raggiungibile
- [ ] Disponibile un cliente di test con clienti/app associati
- [ ] Presenti news della **2026 Wave 1** (per TC-08)
- [ ] Stato filtri pulito (o annotato lo stato di partenza)

---

## TC-01 · Deselezione prodotti (Filtri Globali) ⚠️
- [ ] Apri Filtri Globali → sezione Prodotti
- [ ] Deseleziona tutti i prodotti tranne uno (es. Power Pages)
- [ ] Deseleziona anche l'ultimo rimasto
- [ ] Osserva lo stato delle checkbox

**Atteso:** deselezionare una voce cambia **solo** quella. Il comportamento a selezione vuota (tutte ri-selezionate?) va confermato col PO.
**Segnalazione da verificare:** deselezionando l'ultimo si ri-selezionano tutti i prodotti.

**Esito:** ______  **Screenshot:** ______  **Note:** ______________________

---

## TC-02 · Deselezione app (Filtri Globali) ⚠️
- [ ] Apri Filtri Globali → sezione App
- [ ] Deseleziona tutte le app tranne una
- [ ] Deseleziona anche l'ultima rimasta
- [ ] Osserva lo stato delle checkbox

**Atteso:** deselezione della singola voce stabile; comportamento a selezione vuota da confermare col PO.
**Segnalazione da verificare:** deselezionando l'ultima app si ri-selezionano tutte.

**Esito:** ______  **Screenshot:** ______  **Note:** ______________________

---

## TC-03 · Voci duplicate / con percorso nell'elenco app
- [ ] Apri l'elenco App nei Filtri Globali
- [ ] Scorri tutte le voci

**Atteso:** ogni app compare una sola volta, etichetta pulita, senza percorso duplicato.
**Segnalazione da verificare:** compaiono due voci uguali, una con un percorso.

**Esito:** ______  **Screenshot:** ______  **Note:** ______________________

---

## TC-04 · Filtro clienti mostra solo i clienti attesi ⚠️
- [ ] Seleziona "i miei clienti" (o un sottoinsieme)
- [ ] Applica il filtro
- [ ] Verifica l'elenco/risultati mostrati

**Atteso:** con clienti specifici selezionati vengono mostrati **solo** quelli pertinenti (se nessuno è selezionato, mostrarli tutti è corretto).
**Segnalazione da verificare:** dopo la selezione mostra comunque tutti i clienti.

**Esito:** ______  **Screenshot:** ______  **Note:** ______________________

---

## TC-05 · Filtro Globali → si applica alla Dashboard
- [ ] Nei Filtri Globali seleziona cliente + sottoinsieme prodotti/app
- [ ] Clicca **Applica**
- [ ] Torna alla Dashboard e verifica le news

**Atteso:** la Dashboard mostra news coerenti col filtro; i criteri non vengono alterati nel passaggio.
**Segnalazione da verificare:** i filtri prodotti risultano reimpostati prima di tornare alla Dashboard.

**Esito:** ______  **Screenshot:** ______  **Note:** ______________________

---

## TC-06 · Filtro Dashboard → si riflette nei Filtri Globali
- [ ] Imposta un filtro nella Dashboard
- [ ] Apri i Filtri Globali
- [ ] Confronta i criteri con quelli impostati

**Atteso:** il filtro Dashboard è riportato coerentemente anche nei Filtri Globali.
**Segnalazione da verificare:** sembra funzionare / riportato come globale (osservazione positiva → conferma coerenza).

**Esito:** ______  **Screenshot:** ______  **Note:** ______________________

---

## TC-07 · Il filtro non si resetta tornando alla Dashboard
- [ ] Imposta e applica un filtro (da Globali o Dashboard)
- [ ] Naviga avanti/indietro tra Dashboard e Filtri Globali
- [ ] A ogni passaggio controlla prodotti/app/cliente/origine

**Atteso:** il filtro resta stabile; niente reset automatico.
**Segnalazione da verificare:** al ritorno in Dashboard il filtro si resetta; nei Globali risultano ri-selezionati tutti i prodotti/app.

**Esito:** ______  **Screenshot:** ______  **Note:** ______________________

---

## TC-08 · Filtro "ultima wave" e conteggio (BC 2026 Wave 1 = 4)
- [ ] Reimposta il filtro cliente dalla Dashboard
- [ ] Passa ai Filtri Globali
- [ ] Aggiungi il filtro **ultima wave**
- [ ] Verifica il totale news (atteso 4 per BC 2026 Wave 1)
- [ ] Torna alla Dashboard e verifica che il filtro wave sia mantenuto

**Atteso:** conteggio coerente (4 news); filtro wave mantenuto anche in Dashboard.
**Segnalazione da verificare:** totale corretto ma al ritorno in Dashboard il filtro si resetta (collegato a TC-07).

**Esito:** ______  **Conteggio osservato:** ______  **Screenshot:** ______  **Note:** ______

---

## TC-09 · Persistenza filtro per cliente dopo riavvio portale
- [ ] Seleziona un cliente e imposta un filtro (prodotti, origine, wave…)
- [ ] Applica/salva il filtro in capo al cliente
- [ ] **Chiudi e rilancia** il portale (ricarica la pagina / riapri il browser)
- [ ] Riseleziona lo stesso cliente e controlla lo stato del filtro

**Atteso:** al riavvio il filtro associato al cliente viene ripristinato (incluse le spunte prodotti).
**Segnalazione da verificare:** non memorizza il filtro; tiene cliente e origine ma reimposta le spunte prodotti.

**Esito:** ______  **Screenshot:** ______  **Note:** ______________________

---

## Riepilogo esiti (compila alla fine)

| TC | Sintesi | Esito | Note sintetiche |
|---|---|---|---|
| TC-01 | Deselezione prodotti | ____ | |
| TC-02 | Deselezione app | ____ | |
| TC-03 | Voci app duplicate | ____ | |
| TC-04 | Filtro clienti | ____ | |
| TC-05 | Globali → Dashboard | ____ | |
| TC-06 | Dashboard → Globali | ____ | |
| TC-07 | No reset in navigazione | ____ | |
| TC-08 | Ultima wave + conteggio | ____ | |
| TC-09 | Persistenza per cliente | ____ | |

**Difetti confermati (Fail):** _______________________________________________
**Da confermare con PO:** __________________________________________________

---

_Al termine, riportami questa tabella compilata (anche solo Esito + note): aggiorno gli **Esiti** nel piano `UAT_UPDATE_LENS.md` di conseguenza._
