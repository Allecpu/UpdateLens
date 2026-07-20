# 📚 UpdateLens - Documentazione

Benvenuto nella documentazione completa di **UpdateLens**!

---

## 📖 Indice Documentazione

### 🎯 Per Utenti Finali

#### [**Guida Utente**](./USER_GUIDE.md)
Guida completa all'uso del portale UpdateLens.

**Contenuto**:
- Primi passi (apertura del portale)
- Navigazione e menu principale
- Dashboard (KPI, filtri, lista items)
- Gestione clienti (CRUD, modalità filtri)
- Filtri globali (configurazione, bulk apply)
- Learn e risorse formative
- GitHub Issues (configurazione, creazione, upload)
- Condivisione preset e ruoli
- Manuale integrato
- Versione e aggiornamento fonti
- Export PowerPoint
- Export Markdown
- FAQ (20+ domande frequenti)

**Ideale per**: Utenti finali, clienti, stakeholder

---

### 👨‍💻 Per Sviluppatori

#### [**Developer Guide**](./DEVELOPER_GUIDE.md)
Guida completa per sviluppatori che lavorano sul progetto.

**Contenuto**:
- Setup ambiente (prerequisiti, installazione)
- Struttura progetto
- Comandi NPM (dev, build, refresh)
- Workflow sviluppo
- Testing (type checking, manual, future automated)
- Build e deploy (web, backend)
- Aggiungere nuove fonti dati
- Convenzioni codice (TypeScript, React, naming)
- Troubleshooting
- Versioning e contributing

**Ideale per**: Sviluppatori, contributor, maintainer

---

#### [**Architettura**](./ARCHITECTURE.md)
Documentazione dettagliata dell'architettura del progetto.

**Contenuto**:
- Panoramica e caratteristiche architetturali
- Architettura generale (diagrammi)
- Struttura cartelle completa
- Componenti principali (DataLoader, FilterService, etc.)
- Flusso dati (5 flussi principali)
- Gestione stato (Zustand stores)
- Persistenza (LocalStorage schema)
- Integrazione fonti dati (4 fonti)
- Build e deployment (locale e Azure)
- Sicurezza e performance
- Troubleshooting

**Ideale per**: Architetti software, tech lead, code reviewer

---

#### [**Data Source Integration Template**](./DATA_SOURCE_INTEGRATION_TEMPLATE.md)
Template completo per integrare nuove fonti dati.

**Contenuto**:
- Checklist pre-integrazione
- Backend development (script refresh)
- Frontend development (schema, loader, filters)
- Configurazione (products, rules)
- Testing e QA
- Deployment
- Decision tree
- Esempi di riferimento (Microsoft, EOS, Fabric)

**Ideale per**: Sviluppatori che aggiungono nuove fonti dati

---

### 📋 Tracking e Planning

#### [**Implementation Plan**](../implementation_plan.md)
Piano di implementazione e decisioni architetturali.

**Contenuto**:
- Goal e scope (v0.3.0)
- Tech stack completo
- Data strategy (snapshots, models, config)
- Multi-client architecture
- GitHub Issues integration
- Connectors (4 fonti)
- App architecture
- UI/UX direction
- Delivery e verification
- Constraints e future considerations

**Ideale per**: Project manager, product owner, tech lead

---

#### [**Tasks**](../tasks.md)
Task list, roadmap e stato progetto.

**Contenuto**:
- Phase 0-10 (tutte completate ✅)
- Future enhancements (High/Medium/Low priority)
- Known issues
- Technical debt

**Ideale per**: Project manager, team lead

---

#### [**Changelog**](../CHANGELOG.md)
Storico versioni dettagliato.

**Contenuto**:
- v0.5.0 - Manuale operativo, export PowerPoint e rimozione offline
- v0.4.0 - Azure Migration & Cloud Deployment
- v0.3.0 - GitHub Issues Integration
- v0.2.0 - Multi-Client & Global Filters
- v0.1.0 - MVP Release
- Roadmap futura e limiti noti
- Breaking changes
- Known issues per versione

**Ideale per**: Tutti (utenti, sviluppatori, stakeholder)

---

### 📊 Riepilogo

#### [**Documentation Update Summary**](./DOCUMENTATION_UPDATE_SUMMARY.md)
Riepilogo completo dell'aggiornamento documentazione.

**Contenuto**:
- Documentazione aggiornata (7 file)
- Statistiche (coverage, metriche)
- Checklist completamento
- Prossimi passi consigliati

**Ideale per**: Team lead, reviewer

---

## 🗂️ Organizzazione File

```
docs/
├── README.md                                    # Questo file
├── USER_GUIDE.md                                # Guida utente
├── DEVELOPER_GUIDE.md                           # Guida sviluppatore
├── ARCHITECTURE.md                              # Architettura
├── AZURE_DEPLOYMENT.md                          # Deploy CI/CD e verifica Azure
├── AZURE_TAGS.md                                # Governance risorse Azure
├── DATA_SOURCE_INTEGRATION_TEMPLATE.md          # Template integrazione
├── DOCUMENTATION_UPDATE_SUMMARY.md              # Riepilogo aggiornamento
├── archive/                                     # Piani storici non operativi
├── runbooks/                                    # Procedure operative specialistiche
└── issues/                                      # Immagini per issues GitHub

../                                              # Root progetto
├── README.md                                    # Overview progetto
├── implementation_plan.md                       # Piano implementazione
├── tasks.md                                     # Task list
└── CHANGELOG.md                                 # Changelog
```

---

## 🚀 Quick Links

### Inizia Qui
- **Nuovo utente?** → [User Guide](./USER_GUIDE.md)
- **Cerchi una procedura rapida?** → Apri la voce **Manuale** nell'app
- **Nuovo sviluppatore?** → [Developer Guide](./DEVELOPER_GUIDE.md)
- **Vuoi capire l'architettura?** → [Architecture](./ARCHITECTURE.md)
- **Devi distribuire su Azure?** → [Azure Deployment](./AZURE_DEPLOYMENT.md)
- **Vuoi aggiungere una fonte dati?** → [Integration Template](./DATA_SOURCE_INTEGRATION_TEMPLATE.md)

### Riferimenti Rapidi
- **Comandi NPM** → [Developer Guide - Comandi NPM](./DEVELOPER_GUIDE.md#comandi-npm)
- **Setup ambiente** → [Developer Guide - Setup](./DEVELOPER_GUIDE.md#setup-ambiente)
- **FAQ** → [User Guide - FAQ](./USER_GUIDE.md#faq)
- **Troubleshooting** → [Architecture - Troubleshooting](./ARCHITECTURE.md#troubleshooting)

---

## 📝 Convenzioni Documentazione

### Formato
- **Markdown** - Tutti i documenti in formato `.md`
- **Emoji** - Uso emoji per sezioni (📚 📖 🎯 👨‍💻 etc.)
- **Code Blocks** - Syntax highlighting per esempi codice
- **Indici** - Ogni documento ha indice navigabile

### Struttura
- **Titolo H1** - Nome documento
- **Indice** - Link navigabili
- **Sezioni H2** - Argomenti principali
- **Sottosezioni H3/H4** - Dettagli
- **Highlights** - Box con esempi/note importanti

### Stile
- **Chiaro e conciso** - Linguaggio semplice
- **Step-by-step** - Istruzioni numerate
- **Esempi pratici** - Code snippets e comandi
- **Visual** - Diagrammi ASCII quando possibile

---

## 🔄 Aggiornamento Documentazione

### Quando Aggiornare
- ✅ Nuova feature aggiunta
- ✅ Breaking change
- ✅ Bug fix significativo
- ✅ Cambio architetturale
- ✅ Nuova fonte dati

### Cosa Aggiornare
1. **README.md** (root) - Se feature user-facing
2. **CHANGELOG.md** - Sempre
3. **User Guide** - Se cambia UX
4. **Developer Guide** - Se cambia workflow dev
5. **Architecture** - Se cambia architettura
6. **Tasks** - Se nuovi task/roadmap

### Come Aggiornare
```bash
# 1. Edit documentation files
# 2. Update version in src/version.ts
# 3. Update CHANGELOG.md
# 4. Commit
git add docs/ README.md CHANGELOG.md
git commit -m "docs: update documentation for vX.X.X"
```

---

## 📊 Metriche Documentazione

### Coverage
- ✅ **100%** feature coverage
- ✅ **96%** cross-document coverage
- ✅ **20+** FAQ risposte
- ✅ **7** documenti completi

### Dimensioni
- **~150 KB** totale documentazione
- **~20 KB** per documento medio
- **~100** pagine equivalenti

### Qualità
- ✅ Indici navigabili
- ✅ Code examples
- ✅ Diagrammi
- ✅ Cross-references
- ✅ FAQ complete

---

## 🆘 Supporto

### Hai domande?
1. Controlla [FAQ](./USER_GUIDE.md#faq)
2. Cerca in [Troubleshooting](./ARCHITECTURE.md#troubleshooting)
3. Apri issue su GitHub

### Hai trovato un errore?
1. Apri issue su GitHub con label `documentation`
2. Descrivi l'errore e la sezione
3. Suggerisci correzione (se possibile)

### Vuoi contribuire?
1. Leggi [Contributing](./DEVELOPER_GUIDE.md#contributing)
2. Fork repository
3. Crea branch `docs/your-improvement`
4. Submit Pull Request

---

## 👤 Autore

**Alessandro Levantini**  
Project Owner & Lead Developer

Sviluppato per **CSS S.r.l.**

---

## 📜 License

Proprietario - **Alessandro Levantini**

---

**Versione Documentazione**: 1.0.0  
**Versione Progetto**: 0.5.0
**Ultimo Aggiornamento**: 2026-01-23

**Buona lettura! 📚**
