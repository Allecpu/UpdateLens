# UpdateLens – Piano Unificato di Integrazione Chatbot AI
## Azure AI Foundry + Azure OpenAI (GPT-4o-mini)

**Documento di progetto ufficiale**  
_Allineato a Implementation Plan e Azure Migration_

---

## 1. Scopo del documento
Definire in modo completo, strutturato e non ambiguo l’integrazione di un **chatbot AI** all’interno della piattaforma **UpdateLens**, basato su **Azure AI Foundry** e **Azure OpenAI**, per supportare l’analisi e la consultazione delle news provenienti dalle fonti ufficiali della piattaforma.

Il documento è progettato per:
- guidare lo sviluppo tecnico,
- governare il comportamento del Language Model,
- fungere da riferimento unico per architettura, sicurezza e costi.

---

## 2. Contesto e obiettivi di business

### Obiettivo primario
Supportare l’utente nell’**analisi e interpretazione delle news** provenienti dalle varie fonti presenti in UpdateLens.

### Obiettivi secondari
- Fornire risposte coerenti, verificabili e contestualizzate.
- Ridurre il tempo di consultazione manuale delle fonti.
- Migliorare la comprensione dell’impatto delle novità per cliente.

### Vincoli
- Il chatbot **risponde soltanto** (nessuna decisione, nessuna automazione).
- Nessun utilizzo di fonti esterne alla piattaforma.
- Nessun browsing web.

---

## 3. Utenti e contesto di utilizzo

- Utenti abilitati: **utenti autenticati alla piattaforma**.
- Architettura: **multi-tenant**.
- Contesto cliente:
  - il chatbot funziona sia con cliente selezionato sia senza.
- Ruoli utente: **non rilevanti in fase 1**.

### Contesto filtri
- Gestito tramite **toggle UX** già presente:
  - modalità “considera filtri attivi”
  - modalità “vista completa”
- Il contesto filtri è **passivo**: aiuta la risposta ma non viene esposto esplicitamente se non richiesto.

---

## 4. Dati e fonti informative

- Fonti autorizzate: **solo le fonti interne a UpdateLens**.
- Fonti vietate: nessuna (oltre al perimetro piattaforma).
- Dati considerati aggiornati rispetto allo **snapshot corrente**.
- Aggiornamento dati: tramite azione esplicita di refresh.

### Regole
- È consentita la combinazione di più fonti nella stessa risposta.
- Le risposte **devono citare sempre le fonti**.

---

## 5. Knowledge Base e RAG (Retrieval Augmented Generation)

### Contenuti indicizzati
- Tutte le fonti dati presenti in piattaforma.

### Strategia di aggiornamento indice
- Aggiornamento automatico:
  - su refresh snapshot
  - con fallback su schedulazione periodica

### Vincoli RAG
- Il chatbot **non può rispondere** se l’informazione non è presente.
- In caso di assenza dati deve rispondere:
  > “Non dispongo dei dati necessari per rispondere a questa domanda.”

---

## 6. Comportamento del chatbot

- Tono: **consulenziale, esperto di ecosistema Microsoft**.
- Ammesse solo **affermazioni verificabili**.
- Nessuna supposizione o inferenza non supportata dai dati.
- Il chatbot può:
  - porre domande di chiarimento,
  - suggerire follow-up,
  - proporre prompt iniziali.

### Lunghezza risposte
- Media, con controllo lato UX.

---

## 7. Scelte infrastrutturali definitive

### Regione Azure
- **Primary:** Italy North  
- **Fallback:** West Europe → North Europe

### Piattaforma AI
- **Azure AI Foundry**

### Modello AI selezionato
- **Azure OpenAI – GPT-4o-mini**

#### Motivazione
- Miglior compromesso tra:
  - qualità delle risposte,
  - stabilità enterprise,
  - controllo dei costi.
- Ottimale per:
  - analisi news,
  - risposte RAG,
  - citazione fonti,
  - contesto Microsoft.

---

## 8. Tool e integrazioni applicative

- Il chatbot può interrogare servizi applicativi interni.
- Contesto automatico fornito:
  - utente loggato,
  - cliente selezionato (se presente).
- Tool ammessi:
  - sola lettura / interrogazione.
- Nessuna azione operativa in fase 1.
- Eventuale azione “aggiorna dati” valutabile in fase 2.

---

## 9. UX Chat

- Il chatbot esiste già: **aggiornamento dell’UX attuale**.
- Requisiti:
  - memoria conversazionale per sessione,
  - quick actions suggerite,
  - badge fonte con **link diretto alla fonte**,
  - toggle “considera filtri”.

---

## 10. Sicurezza e governance

- Prompt di sistema **bloccato**.
- Nessun dato sensibile previsto.
- Il chatbot conosce l’utente autenticato.
- Logging di utilizzo e metriche consentito.
- Governance avanzata (policy conversazionali) rimandata a fase successiva.

---

## 11. Monitoraggio e costi

- Metriche:
  - qualità delle risposte,
  - coerenza con le fonti,
  - latenza,
  - utilizzo complessivo.
- Latenza: **non critica**, priorità alla qualità.
- Costi: modello scelto ottimizzato per sostenibilità.

---

## 12. Fasi di implementazione operative

### Fase 1 – Preparazione
- Verifica workspace Azure AI Foundry.
- Verifica accessi e RBAC.
- Conferma regione e modello.

### Fase 2 – Setup Agent
- Creazione Agent in Foundry.
- Inserimento prompt di sistema.
- Collegamento modello GPT-4o-mini.

### Fase 3 – RAG
- Collegamento fonti dati.
- Indicizzazione semantica.
- Test retrieval e no-data behavior.

### Fase 4 – Backend
- Passaggio contesto utente/cliente.
- Isolamento multi-tenant.

### Fase 5 – UX
- Collegamento nuovo Agent alla UI.
- Inserimento badge fonti.
- Gestione toggle filtri.

### Fase 6 – Test
- Test funzionali.
- Test coerenza fonti.
- Test contesto cliente.

### Fase 7 – Go-live controllato
- Abilitazione utenti.
- Monitoraggio iniziale.
- Raccolta feedback.

---

## 13. Evoluzioni future (fase 2)

- Azioni guidate.
- Alert intelligenti.
- Analytics conversazionali.
- Multilingua.

---

## 14. Stato del piano

Il presente documento è:
- **completo**
- **coerente**
- **pronto per sviluppo**
- **utilizzabile come System Brief per LM**

Costituisce la base ufficiale per l’implementazione del chatbot AI di UpdateLens.
