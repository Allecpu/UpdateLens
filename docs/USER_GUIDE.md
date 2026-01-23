# UpdateLens - Guida Utente

## Indice

1. [Introduzione](#introduzione)
2. [Primi Passi](#primi-passi)
3. [Navigazione](#navigazione)
4. [Dashboard](#dashboard)
5. [Gestione Clienti](#gestione-clienti)
6. [Filtri Globali](#filtri-globali)
7. [GitHub Issues](#github-issues)
8. [Export Markdown](#export-markdown)
9. [FAQ](#faq)

---

## Introduzione

**UpdateLens** è un portale per visualizzare e filtrare gli aggiornamenti da:
- Microsoft Release Plans (Dynamics 365, Power Platform)
- EOS Apps (Business Central)
- Microsoft Fabric Roadmap
- Microsoft 365 Roadmap

### Caratteristiche Principali

✅ **Funziona Offline** - Nessuna connessione internet richiesta  
✅ **Multi-Cliente** - Configurazioni personalizzate per ogni cliente  
✅ **Filtri Avanzati** - Filtra per fonte, stato, prodotto, date  
✅ **Export Markdown** - Genera report personalizzati  
✅ **GitHub Issues** - Segnala bug e richieste direttamente dal portale

---

## Primi Passi

### Apertura del Portale

#### Modalità Offline (File)
1. Estrai il file ZIP ricevuto
2. Apri la cartella estratta
3. Fai doppio click su `index.html`
4. Il portale si aprirà nel tuo browser predefinito

#### Modalità Web (Server)
1. Apri il browser
2. Vai all'URL fornito (es. `https://updatelens.example.com`)
3. Il portale si caricherà automaticamente

### Prima Configurazione

Al primo avvio:
1. Il portale mostrerà **"Tutti i clienti"** come selezione predefinita
2. Tutti i filtri saranno impostati sui valori globali di default
3. Vedrai gli aggiornamenti di tutte e 4 le fonti dati

---

## Navigazione

### Menu Principale

Il menu di navigazione si trova nella barra laterale sinistra:

- **📊 Dashboard** - Vista principale con KPI e lista aggiornamenti
- **👥 Clienti** - Gestione clienti e configurazioni
- **🔧 Filtri Globali** - Definizione regole di filtro globali
- **🐛 Issues** - Segnalazioni GitHub (bug, richieste)
- **ℹ️ Versione** - Informazioni versione e changelog

### Selettore Cliente

In alto a destra trovi il **selettore cliente**:
- Dropdown per cambiare cliente attivo
- Default: "Tutti i clienti"
- Cambiando cliente, i filtri si aggiornano automaticamente

---

## Dashboard

### Vista Principale

La Dashboard è composta da:

#### 1. KPI Cards (in alto)
Quattro card colorate che mostrano il numero di aggiornamenti per fonte:
- **Blu** - Microsoft Release Plans
- **Ambra** - EOS Apps
- **Teal** - Microsoft Fabric
- **Viola** - Microsoft 365 Roadmap

**Interazione**: Clicca su una card per filtrare solo quella fonte.

#### 2. Sidebar Filtri (sinistra)
Pannello con tutti i filtri disponibili:
- **Fonti** - Seleziona quali fonti visualizzare
- **Stati** - Planned, Rolling out, Try now, Launched
- **Prodotti** - Lista prodotti disponibili
- **Date** - Range temporale (mesi passati/futuri)
- **Ricerca** - Cerca per testo libero

#### 3. Lista Aggiornamenti (centro)
Card per ogni aggiornamento con:
- **Titolo** e descrizione
- **Prodotto** (badge colorato)
- **Stato** (badge)
- **Data disponibilità**
- **Link** alla fonte originale

#### 4. Pulsante Export (in alto a destra)
Genera report Markdown degli aggiornamenti filtrati.

### Workflow Tipico

1. **Seleziona cliente** (se necessario)
2. **Applica filtri** dalla sidebar
3. **Visualizza risultati** nella lista
4. **Click su card** per drill-down per fonte
5. **Export** se vuoi salvare il report

---

## Gestione Clienti

### Creazione Nuovo Cliente

1. Vai su **Clienti** dal menu
2. Click su **"Aggiungi Cliente"**
3. Compila il form:
   - **Nome**: Nome del cliente
   - **Stato**: Attivo/Inattivo
   - **Modalità Filtri**: Global/Custom/Disabled
4. Click **"Salva"**

### Modalità Filtri

#### Global (Eredita Globali)
- Il cliente usa i **filtri globali** definiti in "Filtri Globali"
- Modifiche ai filtri globali si riflettono automaticamente
- **Usa quando**: Il cliente non ha esigenze particolari

#### Custom (Override)
- Il cliente ha **filtri personalizzati** che sovrascrivono i globali
- Modifiche ai filtri globali **non** influenzano questo cliente
- **Usa quando**: Il cliente ha esigenze specifiche (es. solo Microsoft, solo Planned)

#### Disabled (Escluso)
- Il cliente è **escluso** da tutti i filtri
- Non vedrà alcun aggiornamento
- **Usa quando**: Cliente inattivo o in pausa

### Modifica Cliente

1. Vai su **Clienti**
2. Trova il cliente nella lista
3. Click su **"Modifica"** (icona matita)
4. Modifica i campi desiderati
5. Click **"Salva"**

### Configurazione Filtri Cliente

Per clienti in modalità **Custom**:

1. Vai su **Clienti**
2. Click su **"Configura Filtri"** (icona ingranaggio)
3. Imposta i filtri desiderati:
   - Fonti (quali fonti mostrare)
   - Stati (quali stati mostrare)
   - Prodotti (quali prodotti mostrare)
   - Orizzonti temporali (mesi passati/futuri)
4. Click **"Salva Filtri"**

### Eliminazione Cliente

1. Vai su **Clienti**
2. Trova il cliente nella lista
3. Click su **"Elimina"** (icona cestino)
4. Conferma l'eliminazione

⚠️ **Attenzione**: L'eliminazione è permanente e cancella anche i filtri personalizzati.

---

## Filtri Globali

### Cosa Sono

I **Filtri Globali** sono le regole di default applicate a:
- Tutti i clienti in modalità **Global**
- La vista "Tutti i clienti"
- Nuovi clienti (fino a configurazione custom)

### Configurazione

1. Vai su **Filtri Globali** dal menu
2. Imposta i filtri desiderati:
   - **Fonti**: Quali fonti includere di default
   - **Stati**: Quali stati mostrare (es. solo Planned e Rolling out)
   - **Orizzonti Temporali**:
     - **Mesi Passati** (History): Quanti mesi indietro mostrare
     - **Mesi Futuri** (Horizon): Quanti mesi avanti mostrare
   - **Prodotti**: Quali prodotti includere
   - **Altri filtri** specifici per fonte (wave, geography, etc.)
3. **Anteprima**: Vedi quanti clienti saranno influenzati
4. Click **"Salva Filtri Globali"**

### Applicazione Bulk

Puoi applicare i filtri globali a **clienti specifici**:

1. Configura i filtri globali
2. Nella sezione **"Applica ai clienti inclusi"**:
   - Seleziona i clienti target
   - Click **"Applica ai clienti selezionati"**
3. I clienti selezionati passeranno a modalità **Custom** con i filtri applicati

⚠️ **Nota**: Questa operazione **sovrascrive** i filtri custom esistenti dei clienti selezionati.

### Sicurezza Cliente

Quando sei in **modalità cliente** (hai selezionato un cliente specifico):
- Il pulsante **"Applica ai clienti"** è **nascosto**
- Le modifiche influenzano **solo il cliente attivo**
- Questo previene modifiche accidentali bulk

---

## GitHub Issues

### Configurazione Iniziale

#### Modalità Locale (Offline)

1. Vai su **Issues** dal menu
2. Click su **"Configura Token"**
3. Vai su GitHub → Settings → Developer settings → Personal Access Tokens
4. Crea un nuovo **Fine-grained token** con permessi:
   - **Issues**: Read & Write
   - **Metadata**: Read-only
5. Copia il token generato
6. Incollalo nel campo "GitHub Token"
7. Click **"Test Token"** per verificare
8. Se il test ha successo, click **"Salva"**

Il token viene salvato nel tuo browser (localStorage) e **non** viene mai inviato a server esterni.

#### Modalità Web (Server)

Se stai usando la versione Web, il token è già configurato lato server.  
Non devi fare nulla! 🎉

### Visualizzazione Issues

1. Vai su **Issues**
2. Vedi due tab:
   - **Open** - Issues aperte
   - **Closed** - Issues chiuse
3. Usa la **barra di ricerca** per filtrare per testo
4. Click su un'issue per aprirla su GitHub

### Creazione Nuova Issue

1. Vai su **Issues**
2. Click su **"Nuova Issue"**
3. Compila il form:
   - **Titolo**: Titolo breve e descrittivo
   - **Descrizione**: Descrizione dettagliata (supporta Markdown)
   - **Labels**: Seleziona label (bug, enhancement, etc.)
   - **Immagini** (solo Web mode): Allega screenshot
4. Click **"Crea Issue"**
5. L'issue viene creata su GitHub
6. Ricevi il link all'issue creata

### Markdown Support

La descrizione supporta **Markdown**:

```markdown
## Titolo

**Grassetto** e *corsivo*

- Lista
- Puntata

1. Lista
2. Numerata

[Link](https://example.com)

`codice inline`

\`\`\`
blocco di codice
\`\`\`
```

### Upload Immagini (Solo Web Mode)

1. Nel form "Nuova Issue"
2. Click su **"Allega Immagine"**
3. Seleziona file (max 1MB)
4. L'immagine viene caricata su GitHub
5. Il link viene inserito automaticamente nella descrizione

⚠️ **Nota**: Upload immagini **non disponibile** in modalità offline (limitazioni CORS).

---

## Export Markdown

### Generazione Report

1. Applica i filtri desiderati nella Dashboard
2. Click su **"Esporta Markdown"** (in alto a destra)
3. Si apre un'anteprima del report
4. Verifica il contenuto
5. Click **"Scarica Markdown"**
6. Il file `.md` viene scaricato nel tuo browser

### Struttura Report

Il report generato include:

```markdown
# UpdateLens - Report Aggiornamenti

**Data**: 2026-01-23
**Cliente**: Cliente A
**Filtri Applicati**:
- Fonti: Microsoft, EOS
- Stati: Planned, Rolling out
- Periodo: 2024-01 → 2026-12

---

## Microsoft Release Plans

### Dynamics 365 Sales

#### New AI-powered insights
- **Stato**: Planned
- **Disponibilità**: 2024-04
- **Descrizione**: Get AI-powered insights...
- **Link**: https://...

---

## EOS Apps

### EOS Advanced Warehouse

#### Nuovo modulo picking
- **Stato**: Launched
- **Disponibilità**: 2024-03
- **Versione BC**: 24.0+
- **Descrizione**: Modulo avanzato...
- **Link**: https://...
```

### Personalizzazione

Il report riflette:
- ✅ Filtri applicati
- ✅ Cliente selezionato
- ✅ Data generazione
- ✅ Raggruppamento per fonte e prodotto

---

## FAQ

### Domande Generali

**Q: UpdateLens funziona senza internet?**  
A: Sì! La versione offline funziona completamente senza connessione (eccetto GitHub Issues in modalità locale).

**Q: I miei dati sono al sicuro?**  
A: Sì. Tutti i dati (clienti, filtri) sono salvati **solo nel tuo browser** (localStorage). Nessun dato viene inviato a server esterni.

**Q: Posso usare UpdateLens su più dispositivi?**  
A: I dati sono locali al browser. Per sincronizzare tra dispositivi, usa la versione Web con backend.

**Q: Quanto spesso vengono aggiornati i dati?**  
A: I dati vengono aggiornati manualmente dagli amministratori. Controlla la pagina "Versione" per l'ultima data di aggiornamento.

### Clienti

**Q: Cosa succede se elimino un cliente?**  
A: Il cliente e i suoi filtri personalizzati vengono eliminati permanentemente. Non è possibile recuperarli.

**Q: Posso avere più clienti con lo stesso nome?**  
A: Sì, ma è sconsigliato. Usa nomi univoci per evitare confusione.

**Q: Cosa significa "Modalità Global"?**  
A: Il cliente eredita i filtri globali. Modifiche ai filtri globali si riflettono automaticamente.

### Filtri

**Q: Perché non vedo alcuni filtri?**  
A: Alcuni filtri sono specifici per fonte. Es. "Wave" è solo per Microsoft, "BC Version" solo per EOS.

**Q: Come resetto i filtri?**  
A: Click su "Reset Filtri" nella sidebar della Dashboard.

**Q: I filtri vengono salvati?**  
A: I filtri globali e per-cliente sono salvati. I filtri temporanei della Dashboard no.

### GitHub Issues

**Q: Il mio token GitHub è sicuro?**  
A: In modalità locale, il token è salvato nel tuo browser (localStorage). Nessuno può accedervi tranne te. In modalità Web, il token è sul server e mai esposto al client.

**Q: Posso usare GitHub Issues offline?**  
A: Sì, ma devi configurare un token. Le chiamate API vengono fatte direttamente dal browser a GitHub.

**Q: Perché non posso caricare immagini?**  
A: Upload immagini è disponibile solo in modalità Web (limitazioni CORS del browser).

### Export

**Q: Posso esportare in PDF?**  
A: Al momento solo Markdown. Puoi convertire il Markdown in PDF con strumenti esterni (es. Pandoc, Typora).

**Q: L'export include tutti gli aggiornamenti?**  
A: L'export include solo gli aggiornamenti **filtrati** visibili nella Dashboard.

**Q: Posso personalizzare il formato export?**  
A: Al momento no. Il formato è fisso (Markdown con struttura standard).

### Problemi Comuni

**Q: La Dashboard è vuota**  
A: Controlla che:
- I filtri non siano troppo restrittivi
- Le fonti dati siano selezionate
- I file snapshot siano presenti (modalità offline)

**Q: I filtri non si salvano**  
A: Verifica che il browser abbia localStorage abilitato. Controlla le impostazioni privacy.

**Q: GitHub Issues non funziona**  
A: Verifica che:
- Il token sia valido e non scaduto
- Il token abbia i permessi corretti (Issues: Read & Write)
- Il repository sia accessibile

**Q: L'app è lenta**  
A: Con molti aggiornamenti (>10k), l'app può rallentare. Usa filtri più restrittivi per migliorare le performance.

---

## Supporto

Per assistenza o segnalazioni:
1. Vai su **Issues** nel portale
2. Crea una nuova issue con:
   - **Label**: `question` o `bug`
   - **Descrizione**: Dettagli del problema
   - **Screenshot**: Se possibile

Oppure contatta:
- **Alessandro Levantini** - Project Owner
- **Team CSS** - Supporto tecnico

---

**Versione**: 0.3.0  
**Ultimo Aggiornamento**: 2026-01-23

**Buon lavoro con UpdateLens! 🚀**
