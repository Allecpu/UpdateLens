import { NavLink } from 'react-router-dom';
import { appVersion } from '../../version';

type ManualSection = {
  id: string;
  title: string;
  purpose: string;
  whenToUse: string;
  steps: string[];
  note?: string;
  route: string;
  action: string;
};

const SECTIONS: ManualSection[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    purpose:
      'Raccoglie aggiornamenti, roadmap e novita da Microsoft Release Plans, EOS, Fabric e Microsoft 365 Roadmap.',
    whenToUse:
      'Usala per preparare un aggiornamento cliente, controllare le prossime release o costruire una selezione da esportare.',
    steps: [
      'Applica il perimetro clienti direttamente dalle impostazioni clienti/filtro in CSS.',
      'Seleziona un preset e, se necessario, modifica i filtri laterali per questa analisi.',
      'Apri una scheda per leggere dettaglio, stato, data, prodotti e collegamenti alla fonte.',
      'Aggiungi ai segnalibri gli elementi da conservare oppure limita la vista ai soli segnalibri.',
      'Esporta i risultati visibili in Markdown o PowerPoint.'
    ],
    note:
      'I filtri modificati nella Dashboard sono temporanei e prevalgono sui Filtri globali finche non vengono ripristinati.',
    route: '/',
    action: 'Apri Dashboard'
  },
  {
    id: 'css',
    title: 'CSS - Attivita e clienti',
    purpose:
      'Traccia le attivita di Customer Success per ogni cliente: stato, owner, priorita, scadenze e note, con import automatico da meeting report.',
    whenToUse:
      'Usala per gestire il ciclo di vita delle attivita CSS, validare le proposte generate dall\'IA a partire dai documenti caricati e mantenere aggiornata l\'anagrafica clienti.',
    steps: [
      'Crea o modifica un\'attivita dalla griglia, oppure aggiornane un campo rapidamente con un click sulle colonne a scelta.',
      'Carica un meeting report (DOCX/PDF) e avvia l\'analisi per generare proposte di nuove attivita o aggiornamenti.',
      'Valida le proposte: risolvi i clienti non riconosciuti, scegli il target per le proposte ambigue, poi applica il batch.',
      'Usa Viste, filtri avanzati e raggruppamento per isolare il sottoinsieme di attivita da trattare.',
      'Esporta le attivita filtrate in CSV, Excel, JSON o HTML/PDF per condividerle o archiviarle.',
      'Gestisci l\'anagrafica clienti: crea, disattiva o unisci clienti duplicati dal pannello dedicato.'
    ],
    note:
      'L\'Import/Export JSON riguarda le Viste salvate (per backup o condivisione), non l\'anagrafica clienti: quest\'ultima si aggiorna con creazione, merge e migrazione dei clienti legacy.',
    route: '/css',
    action: 'Apri CSS'
  },
  {
    id: 'filtri',
    title: 'Filtri globali e preset',
    purpose:
      'Definisce il perimetro persistente della Dashboard: destinatari, fonti, prodotti, stato e finestra temporale.',
    whenToUse:
      'Usali per standardizzare viste ricorrenti, ad esempio un report mensile o il monitoraggio di una linea prodotto.',
    steps: [
      'Scegli il target tramite Owner CSS, clienti o gruppi.',
      'Seleziona fonti e prodotti, quindi restringi stato, categoria e periodo.',
      'Controlla i KPI per verificare che il perimetro ottenuto sia plausibile.',
      'Salva la configurazione in un nuovo preset con un nome riconoscibile.',
      'Imposta il preset Default se deve diventare la vista iniziale.'
    ],
    note:
      'L\'auto-save e disponibile solo sul preset Default. Per gli altri preset usa il comando di salvataggio esplicito.',
    route: '/filtri-globali',
    action: 'Apri Filtri globali'
  },
  {
    id: 'learn',
    title: 'Learn',
    purpose:
      'Organizza risorse formative Microsoft collegate ai prodotti monitorati in UpdateLens.',
    whenToUse:
      'Usala per affiancare materiale formativo a una novita o costruire un percorso di aggiornamento per il cliente.',
    steps: [
      'Cerca per parola chiave o apri Learn da un prodotto presente nella Dashboard.',
      'Filtra per prodotto, tipo di risorsa, livello, durata e lingua.',
      'Ordina i contenuti in base a rilevanza, aggiornamento o durata.',
      'Apri la risorsa originale per consultare il contenuto Microsoft.',
      'Salva i filtri Learn come preset personale per riutilizzarli.'
    ],
    route: '/learn',
    action: 'Apri Learn'
  },
  {
    id: 'esportazioni',
    title: 'Segnalibri ed esportazioni',
    purpose:
      'Trasforma la selezione corrente della Dashboard in materiale pronto da condividere.',
    whenToUse:
      'Usali dopo aver completato filtri e revisione, quando il set visibile rappresenta il contenuto finale.',
    steps: [
      'Aggiungi un segnalibro alle schede che meritano attenzione.',
      'Attiva "Solo segnalibri" per verificare la selezione finale.',
      'Scegli Markdown per testo modificabile e condivisione rapida.',
      'Scegli PowerPoint per una presentazione strutturata e brandizzata.',
      'Controlla sempre il file generato prima dell\'invio al cliente.'
    ],
    note:
      'L\'esportazione usa i risultati attualmente filtrati: verifica cliente, preset e intervallo temporale prima di avviarla.',
    route: '/',
    action: 'Vai alle esportazioni'
  },
  {
    id: 'condivisioni',
    title: 'Condivisione preset',
    purpose:
      'Distribuisce configurazioni di filtro tra utenti senza doverle ricostruire manualmente.',
    whenToUse:
      'Condividi un preset quando un collega deve lavorare sullo stesso perimetro o replicare un report.',
    steps: [
      'Apri il preset nei Filtri globali e scegli il comando di condivisione.',
      'Seleziona tutti gli utenti oppure destinatari specifici.',
      'Controlla i preset inviati nella scheda "Condivisi da me".',
      'Consulta quelli ricevuti nella scheda "Condivisi con me".',
      'Duplica un preset ricevuto prima di personalizzarlo.'
    ],
    note:
      'La duplicazione crea una copia personale: le modifiche non alterano il preset condiviso originale.',
    route: '/condivisioni',
    action: 'Apri Condivisioni'
  },
  {
    id: 'segnalazioni',
    title: 'Segnalazioni',
    purpose:
      'Centralizza bug, richieste e miglioramenti tramite GitHub Issues.',
    whenToUse:
      'Apri una segnalazione quando il comportamento e riproducibile o quando una richiesta ha obiettivo e benefici chiari.',
    steps: [
      'Cerca tra le issue esistenti per evitare duplicati.',
      'Configura il GitHub token se la pagina lo richiede e il server non lo fornisce.',
      'Scegli un titolo breve che descriva il problema o il risultato desiderato.',
      'Indica passaggi, risultato atteso, risultato osservato e ambiente.',
      'Allega un\'immagine quando il problema riguarda layout o stato visivo.'
    ],
    route: '/issues',
    action: 'Apri Segnalazioni'
  },
  {
    id: 'versione',
    title: 'Versione e fonti dati',
    purpose:
      'Mostra versione, build, commit e note di rilascio, oltre allo stato degli aggiornamenti dati.',
    whenToUse:
      'Consultala per verificare cosa e installato o per aggiornare tutte le fonti disponibili.',
    steps: [
      'Controlla versione, ambiente e commit prima di segnalare un problema.',
      'Leggi le note dell\'ultimo aggiornamento per conoscere le modifiche introdotte.',
      'Avvia "Aggiorna tutte le fonti" solo quando serve acquisire dati recenti.',
      'Attendi il completamento senza ricaricare la pagina.',
      'Verifica l\'esito separato di Microsoft, EOS, Fabric e M365 Roadmap.'
    ],
    note:
      'Un aggiornamento parziale non equivale a un successo completo: controlla il messaggio della fonte fallita prima di riprovare.',
    route: '/versione',
    action: 'Apri Versione'
  }
];

const scrollToSection = (sectionId: string): void => {
  document.getElementById(sectionId)?.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 'auto'
      : 'smooth',
    block: 'start'
  });
};

const MiniDashboard = () => (
  <div className="border border-border bg-background p-4" aria-label="Esempio Dashboard">
    <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
      <div>
        <div className="text-xs uppercase text-muted-foreground">Cliente</div>
        <div className="mt-1 text-sm font-semibold">Contoso S.p.A.</div>
      </div>
      <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
        24 risultati
      </span>
    </div>
    <div className="mt-3 grid gap-2 sm:grid-cols-[110px_1fr]">
      <div className="border border-border bg-muted/40 p-3 text-xs">
        <div className="font-semibold">Filtri</div>
        <div className="mt-2 text-muted-foreground">Business Central</div>
        <div className="mt-1 text-muted-foreground">Prossimi 6 mesi</div>
      </div>
      <div className="border border-border p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-primary">Microsoft</span>
          <span className="text-xs text-muted-foreground">Q3 2026</span>
        </div>
        <div className="mt-2 text-sm font-semibold">Titolo aggiornamento</div>
        <div className="mt-1 h-2 w-4/5 bg-muted" />
        <div className="mt-2 h-2 w-3/5 bg-muted" />
      </div>
    </div>
  </div>
);

const MiniUpdateStatus = () => (
  <div className="border border-border bg-background p-4" aria-label="Esempio stato fonti">
    <div className="text-sm font-semibold">Risultati aggiornamento</div>
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      {['Microsoft', 'EOS', 'Fabric', 'M365 Roadmap'].map((source) => (
        <div
          key={source}
          className="flex items-center justify-between border border-emerald-500/30 bg-emerald-500/5 px-3 py-2"
        >
          <span className="text-sm">{source}</span>
          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
            Aggiornata
          </span>
        </div>
      ))}
    </div>
  </div>
);

const ManualPage = () => (
  <div className="space-y-10">
    <header className="border-b border-border pb-8">
      <p className="text-xs font-semibold uppercase text-primary">Guida operativa</p>
      <h1 className="mt-2 text-3xl font-semibold">Manuale UpdateLens</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
        Dalla configurazione del cliente alla presentazione finale: procedure,
        concetti e controlli per usare UpdateLens in modo coerente.
      </p>
      <div className="mt-5 flex flex-wrap gap-2 text-xs">
        <span className="border border-primary/30 bg-primary/5 px-3 py-2 text-primary">
          Manuale per UpdateLens {appVersion}
        </span>
        <span className="border border-border bg-muted/40 px-3 py-2">8 aree funzionali</span>
        <span className="border border-border bg-muted/40 px-3 py-2">4 flussi guidati</span>
        <span className="border border-border bg-muted/40 px-3 py-2">Glossario e checklist</span>
      </div>
    </header>

    <section id="orientamento" className="scroll-mt-6" aria-labelledby="orientamento-title">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase text-muted-foreground">Orientamento</p>
        <h2 id="orientamento-title" className="mt-2 text-2xl font-semibold">
          Come funziona UpdateLens
        </h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Il risultato mostrato nasce dalla combinazione di tre livelli. Capire questa
          priorita evita quasi tutti i dubbi sui risultati della Dashboard.
        </p>
      </div>
      <div className="mt-6 grid gap-px overflow-hidden border border-border bg-border md:grid-cols-3">
        {[
          ['1', 'Cliente', 'Definisce prodotti e perimetro commerciale selezionato.'],
          ['2', 'Filtri globali', 'Applicano preset e regole persistenti alla vista.'],
          ['3', 'Filtri Dashboard', 'Rifiniscono temporaneamente l\'analisi corrente.']
        ].map(([number, title, text]) => (
          <div key={number} className="bg-card p-5">
            <span className="text-xs font-semibold text-primary">LIVELLO {number}</span>
            <h3 className="mt-2 font-semibold">{title}</h3>
            <p className="mt-2 text-sm leading-5 text-muted-foreground">{text}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <caption className="pb-3 text-left text-xs font-semibold uppercase text-muted-foreground">
            Esempio di composizione dei filtri
          </caption>
          <thead>
            <tr className="border-y border-border">
              <th className="px-3 py-3 font-semibold">Livello</th>
              <th className="px-3 py-3 font-semibold">Impostazione</th>
              <th className="px-3 py-3 font-semibold">Effetto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            <tr>
              <td className="px-3 py-3">Cliente</td>
              <td className="px-3 py-3">Contoso, prodotti BC e Power Platform</td>
              <td className="px-3 py-3 text-muted-foreground">Esclude i prodotti non assegnati</td>
            </tr>
            <tr>
              <td className="px-3 py-3">Preset globale</td>
              <td className="px-3 py-3">Prossimi 12 mesi, fonti Microsoft ed EOS</td>
              <td className="px-3 py-3 text-muted-foreground">Definisce il perimetro di partenza</td>
            </tr>
            <tr>
              <td className="px-3 py-3">Dashboard</td>
              <td className="px-3 py-3">Solo Business Central, prossimi 6 mesi</td>
              <td className="px-3 py-3 text-muted-foreground">Restringe temporaneamente la vista</td>
            </tr>
            <tr className="bg-primary/5">
              <td className="px-3 py-3 font-semibold">Risultato</td>
              <td className="px-3 py-3" colSpan={2}>
                Aggiornamenti Business Central per Contoso, da Microsoft ed EOS,
                previsti nei prossimi 6 mesi.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section id="glossario" className="scroll-mt-6 border-y border-border py-8">
      <p className="text-xs font-semibold uppercase text-muted-foreground">Riferimento</p>
      <h2 className="mt-2 text-2xl font-semibold">Glossario essenziale</h2>
      <dl className="mt-6 grid gap-x-8 gap-y-5 md:grid-cols-2">
        {[
          ['Cliente', 'Anagrafica con prodotti, Owner CSS e stato che definisce un perimetro specifico.'],
          ['Gruppo', 'Insieme riutilizzabile di clienti da selezionare come unico target.'],
          ['Owner CSS', 'Responsabile associato ai clienti, utilizzabile come criterio di targeting.'],
          ['Preset', 'Configurazione nominata e riutilizzabile dei Filtri globali.'],
          ['Filtro temporaneo', 'Modifica applicata in Dashboard o dalla chat senza cambiare il preset salvato.'],
          ['Segnalibro', 'Indicatore personale usato per conservare o isolare un aggiornamento.'],
          ['Snapshot', 'Copia dei dati acquisiti da una fonte in una determinata data.'],
          ['Fonte', 'Sistema di origine: Microsoft Release Plans, EOS, Fabric o M365 Roadmap.'],
          ['Vista (CSS)', 'Configurazione salvata di colonne, filtri e ordinamento nella pagina CSS.'],
          ['Proposta (CSS)', 'Attivita o aggiornamento suggerito dall\'IA a partire da un documento caricato, in attesa di validazione.'],
          ['Batch di estrazione', 'Insieme delle proposte generate da un\'unica analisi di un documento CSS.']
        ].map(([term, definition]) => (
          <div key={term} className="border-l-2 border-primary/50 pl-4">
            <dt className="text-sm font-semibold">{term}</dt>
            <dd className="mt-1 text-sm leading-5 text-muted-foreground">{definition}</dd>
          </div>
        ))}
      </dl>
    </section>

    <section id="flussi" className="scroll-mt-6 border-y border-border py-8">
      <p className="text-xs font-semibold uppercase text-muted-foreground">Flussi guidati</p>
      <h2 className="mt-2 text-2xl font-semibold">Le operazioni piu comuni</h2>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {[
          {
            title: 'Preparare un incontro cliente',
            steps: ['Seleziona il cliente', 'Applica il preset', 'Rivedi e salva', 'Esporta PPTX']
          },
          {
            title: 'Monitorare una linea prodotto',
            steps: ['Apri Filtri globali', 'Scegli prodotti e periodo', 'Salva il preset', 'Controlla i KPI']
          },
          {
            title: 'Segnalare un problema',
            steps: ['Verifica la Versione', 'Cerca issue simili', 'Descrivi i passaggi', 'Allega uno screenshot']
          },
          {
            title: 'Validare un meeting report in CSS',
            steps: ['Carica il documento', 'Avvia l\'analisi', 'Risolvi le proposte ambigue', 'Applica il batch']
          }
        ].map((flow) => (
          <div key={flow.title}>
            <h3 className="font-semibold">{flow.title}</h3>
            <ol className="mt-3 space-y-2 border-l border-border pl-4">
              {flow.steps.map((step, index) => (
                <li key={step} className="text-sm">
                  <span className="mr-2 text-xs font-semibold text-primary">{index + 1}.</span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </section>

    <div className="grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="text-xs font-semibold uppercase text-muted-foreground">
          In questa pagina
        </div>
        <nav className="mt-3 border-l border-border" aria-label="Indice del manuale">
          <button
            type="button"
            onClick={() => scrollToSection('orientamento')}
            className="block min-h-11 w-full border-l-2 border-transparent px-4 py-2 text-left text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground focus-visible:border-primary focus-visible:outline-none"
          >
            Come funziona
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('glossario')}
            className="block min-h-11 w-full border-l-2 border-transparent px-4 py-2 text-left text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground focus-visible:border-primary focus-visible:outline-none"
          >
            Glossario
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('flussi')}
            className="block min-h-11 w-full border-l-2 border-transparent px-4 py-2 text-left text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground focus-visible:border-primary focus-visible:outline-none"
          >
            Flussi guidati
          </button>
          {SECTIONS.map((section) => (
            <button
              type="button"
              key={section.id}
              onClick={() => scrollToSection(section.id)}
              className="block min-h-11 w-full border-l-2 border-transparent px-4 py-2 text-left text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground focus-visible:border-primary focus-visible:outline-none"
            >
              {section.title}
            </button>
          ))}
          <button
            type="button"
            onClick={() => scrollToSection('preset-guide')}
            className="block min-h-11 w-full border-l-2 border-transparent px-4 py-2 text-left text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground focus-visible:border-primary focus-visible:outline-none"
          >
            Tipi di preset
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('css-moduli')}
            className="block min-h-11 w-full border-l-2 border-transparent px-4 py-2 text-left text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground focus-visible:border-primary focus-visible:outline-none"
          >
            Moduli CSS
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('checklist-export')}
            className="block min-h-11 w-full border-l-2 border-transparent px-4 py-2 text-left text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground focus-visible:border-primary focus-visible:outline-none"
          >
            Checklist export
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('ruoli')}
            className="block min-h-11 w-full border-l-2 border-transparent px-4 py-2 text-left text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground focus-visible:border-primary focus-visible:outline-none"
          >
            Ruoli e permessi
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('sicurezza')}
            className="block min-h-11 w-full border-l-2 border-transparent px-4 py-2 text-left text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground focus-visible:border-primary focus-visible:outline-none"
          >
            Sicurezza e dati
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('assistente')}
            className="block min-h-11 w-full border-l-2 border-transparent px-4 py-2 text-left text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground focus-visible:border-primary focus-visible:outline-none"
          >
            Assistente chat
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('problemi')}
            className="block min-h-11 w-full border-l-2 border-transparent px-4 py-2 text-left text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground focus-visible:border-primary focus-visible:outline-none"
          >
            Problemi comuni
          </button>
        </nav>
      </aside>

      <main className="min-w-0 divide-y divide-border">
        {SECTIONS.map((section) => (
          <section
            key={section.id}
            id={section.id}
            className="scroll-mt-6 py-9 first:pt-0"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-2xl">
                <h2 className="text-2xl font-semibold">{section.title}</h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {section.purpose}
                </p>
              </div>
              <NavLink to={section.route} className="ul-button shrink-0 self-start">
                {section.action}
              </NavLink>
            </div>

            <div className="mt-5 border-l-4 border-primary bg-primary/5 px-4 py-3">
              <div className="text-xs font-semibold uppercase text-primary">
                Quando usarla
              </div>
              <p className="mt-1 text-sm leading-5">{section.whenToUse}</p>
            </div>

            <h3 className="mt-6 text-sm font-semibold uppercase text-muted-foreground">
              Procedura
            </h3>
            <ol className="mt-4 space-y-4">
              {section.steps.map((step, index) => (
                <li key={step} className="flex gap-4 text-sm leading-6">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/5 text-xs font-semibold text-primary">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>

            {section.id === 'dashboard' && <div className="mt-6"><MiniDashboard /></div>}
            {section.id === 'versione' && <div className="mt-6"><MiniUpdateStatus /></div>}

            {section.note && (
              <p className="mt-5 border-t border-border pt-4 text-sm leading-6 text-muted-foreground">
                <span className="font-semibold text-foreground">Da ricordare: </span>
                {section.note}
              </p>
            )}
          </section>
        ))}

        <section id="preset-guide" className="scroll-mt-6 py-9">
          <h2 className="text-2xl font-semibold">Tipi di preset</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            I preset possono sembrare equivalenti nel selettore, ma proprieta e
            comportamento cambiano in base alla loro origine.
          </p>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[620px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-y border-border">
                  <th className="px-3 py-3 font-semibold">Tipo</th>
                  <th className="px-3 py-3 font-semibold">Modificabile</th>
                  <th className="px-3 py-3 font-semibold">Comportamento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="px-3 py-3 font-medium">Default</td>
                  <td className="px-3 py-3">Si</td>
                  <td className="px-3 py-3 text-muted-foreground">
                    Viene applicato all'avvio e supporta l'auto-save.
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-3 font-medium">Personale</td>
                  <td className="px-3 py-3">Si</td>
                  <td className="px-3 py-3 text-muted-foreground">
                    Va salvato esplicitamente dopo una modifica.
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-3 font-medium">Condiviso</td>
                  <td className="px-3 py-3">No</td>
                  <td className="px-3 py-3 text-muted-foreground">
                    Mantiene proprietario e configurazione originali.
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-3 font-medium">Duplicato</td>
                  <td className="px-3 py-3">Si</td>
                  <td className="px-3 py-3 text-muted-foreground">
                    E una copia personale indipendente dall'originale.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section id="css-moduli" className="scroll-mt-6 py-9">
          <h2 className="text-2xl font-semibold">Moduli CSS</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            La pagina CSS raggruppa piu moduli distinti: griglia attivita, viste e
            filtri, import documenti, validazione proposte, esportazione e gestione
            clienti.
          </p>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-y border-border">
                  <th className="px-3 py-3 font-semibold">Modulo</th>
                  <th className="px-3 py-3 font-semibold">Cosa offre</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[
                  [
                    'Griglia attivita',
                    'Colonne configurabili, editing inline e rapido, editor colonna con colori personalizzati, ordinamento, raggruppamento, selezione multipla e azioni bulk.'
                  ],
                  [
                    'Viste e filtri',
                    'Viste di sistema e personali con auto-save, filtri rapidi, filtri avanzati con regole AND/OR, colonne personalizzate per vista.'
                  ],
                  [
                    'Import documenti',
                    'Caricamento di meeting report (DOCX/PDF), analisi con IA (o motore euristico) per estrarre proposte, storico delle analisi per documento.'
                  ],
                  [
                    'Validazione proposte',
                    'Revisione delle proposte nuove, di aggiornamento o ambigue, risoluzione dei clienti non riconosciuti (alias o nuovo cliente), applicazione del batch.'
                  ],
                  [
                    'Esportazione',
                    'Export in CSV, Excel, JSON o HTML/PDF con selezione delle colonne e log di audit.'
                  ],
                  [
                    'Gestione clienti',
                    'Crea, modifica nome/alias, attiva o disattiva, unisce clienti duplicati e migra i clienti legacy salvati in locale.'
                  ]
                ].map(([modulo, testo]) => (
                  <tr key={modulo}>
                    <td className="px-3 py-3 font-medium">{modulo}</td>
                    <td className="px-3 py-3 text-muted-foreground">{testo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="checklist-export" className="scroll-mt-6 py-9">
          <h2 className="text-2xl font-semibold">Checklist prima dell'esportazione</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Esegui questi controlli nell'ordine indicato prima di generare Markdown o
            PowerPoint.
          </p>
          <ol className="mt-6 grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2">
            {[
              ['Cliente', 'Il cliente corretto e selezionato nell\'intestazione.'],
              ['Preset', 'Il preset attivo rappresenta il report da produrre.'],
              ['Periodo', 'Intervallo storico e orizzonte futuro sono corretti.'],
              ['Prodotti e fonti', 'Non sono presenti sorgenti o prodotti fuori perimetro.'],
              ['Filtri temporanei', 'Filtri Dashboard e chat sono intenzionali.'],
              ['Segnalibri', 'La modalita "Solo segnalibri" e coerente con l\'export.'],
              ['Conteggio', 'Il numero di risultati e plausibile per il contesto.'],
              ['Revisione', 'Titoli, date e link sono stati controllati prima dell\'invio.']
            ].map(([title, text], index) => (
              <li key={title} className="flex gap-3 bg-card p-4">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center border border-primary/40 text-xs font-semibold text-primary">
                  {index + 1}
                </span>
                <div>
                  <div className="text-sm font-semibold">{title}</div>
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section id="ruoli" className="scroll-mt-6 py-9">
          <h2 className="text-2xl font-semibold">Ruoli e permessi</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Tutti gli utenti abilitati possono usare le normali funzioni di
            consultazione. I ruoli regolano soprattutto la gestione degli utenti.
          </p>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-y border-border">
                  <th className="px-3 py-3 font-semibold">Ruolo</th>
                  <th className="px-3 py-3 font-semibold">Uso applicazione</th>
                  <th className="px-3 py-3 font-semibold">Gestione utenti</th>
                  <th className="px-3 py-3 font-semibold">Assegna Admin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="px-3 py-3 font-medium">Viewer</td>
                  <td className="px-3 py-3">Si</td>
                  <td className="px-3 py-3">No</td>
                  <td className="px-3 py-3">No</td>
                </tr>
                <tr>
                  <td className="px-3 py-3 font-medium">Manager</td>
                  <td className="px-3 py-3">Si</td>
                  <td className="px-3 py-3">Utenti non Admin</td>
                  <td className="px-3 py-3">No</td>
                </tr>
                <tr>
                  <td className="px-3 py-3 font-medium">Admin</td>
                  <td className="px-3 py-3">Si</td>
                  <td className="px-3 py-3">Completa</td>
                  <td className="px-3 py-3">Si</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Un utente non puo modificare il proprio ruolo. Solo un Admin puo creare,
            modificare o disabilitare un altro Admin.
          </p>
        </section>

        <section id="sicurezza" className="scroll-mt-6 py-9">
          <h2 className="text-2xl font-semibold">Sicurezza e qualita dei dati</h2>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div className="border-l-4 border-amber-500 bg-amber-500/5 px-4 py-4">
              <h3 className="text-sm font-semibold">GitHub token</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Se inserito manualmente, il PAT viene conservato nel browser locale.
                Non condividerlo, non inserirlo in issue o screenshot e rimuovilo dalla
                pagina Segnalazioni quando non serve piu.
              </p>
            </div>
            <div className="border-l-4 border-primary bg-primary/5 px-4 py-4">
              <h3 className="text-sm font-semibold">Dati cliente</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Prima di esportare o allegare schermate verifica che clienti, Owner CSS
                e filtri visibili siano appropriati per i destinatari.
              </p>
            </div>
          </div>
          <h3 className="mt-7 text-sm font-semibold uppercase text-muted-foreground">
            Come leggere i dati
          </h3>
          <ul className="mt-4 space-y-3 text-sm leading-6">
            <li>
              <span className="font-semibold">Data fonte:</span>{' '}
              indica la pianificazione dichiarata dal sistema di origine e puo cambiare.
            </li>
            <li>
              <span className="font-semibold">Snapshot:</span>{' '}
              rappresenta l'acquisizione disponibile in UpdateLens, non una lettura in tempo reale.
            </li>
            <li>
              <span className="font-semibold">Aggiornamento parziale:</span>{' '}
              alcune fonti sono recenti e altre possono essere rimaste allo snapshot precedente.
            </li>
            <li>
              <span className="font-semibold">Collegamento originale:</span>{' '}
              e il riferimento da consultare quando serve confermare una data o un dettaglio.
            </li>
          </ul>
        </section>

        <section id="assistente" className="scroll-mt-6 py-9">
          <h2 className="text-2xl font-semibold">Assistente chat</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Il pulsante in basso a destra apre l'assistente. Le richieste possono
            combinare prodotto, fonte, periodo e cliente; i filtri generati vengono
            applicati temporaneamente alla Dashboard.
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {[
              'Mostra gli aggiornamenti Business Central dei prossimi sei mesi.',
              'Quali novita Fabric sono state modificate di recente?',
              'Trova le release EOS rilevanti per il cliente selezionato.',
              'Azzera i filtri della chat e torna alla vista precedente.'
            ].map((prompt) => (
              <div key={prompt} className="border border-border bg-muted/30 px-4 py-3 text-sm">
                "{prompt}"
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Per rimuovere il risultato della chat usa il comando dedicato mostrato
            nella Dashboard accanto all'avviso "Filtri da chat attivi".
          </p>
        </section>

        <section id="problemi" className="scroll-mt-6 py-9">
          <h2 className="text-2xl font-semibold">Problemi comuni</h2>
          <div className="mt-5 space-y-3">
            {[
              [
                'La Dashboard non mostra i risultati attesi',
                'Controlla cliente selezionato, preset attivo, filtri temporanei della Dashboard e filtri applicati dalla chat. Ripristina prima i filtri temporanei.'
              ],
              [
                'Un preset ricevuto non e modificabile',
                'I preset condivisi mantengono la proprieta dell\'autore. Duplicalo dalla pagina Condivisioni per ottenere una copia personale.'
              ],
              [
                'L\'aggiornamento delle fonti e parziale',
                'Apri Versione e leggi il risultato della singola fonte. Non rilanciare tutto senza aver controllato il messaggio di errore.'
              ],
              [
                'Il PowerPoint non contiene gli elementi desiderati',
                'L\'export usa il set filtrato corrente. Torna in Dashboard, verifica "Solo segnalibri", cliente e periodo, quindi genera nuovamente il file.'
              ],
              [
                'Un cliente non compare nel selettore',
                'Verifica che il cliente sia attivo e incluso dal target dei Filtri globali. Un filtro per Owner CSS o gruppo puo ridurre l\'elenco disponibile.'
              ],
              [
                'Il token GitHub non viene accettato',
                'Rimuovi il token salvato, genera un PAT con accesso al repository corretto e ripeti il test dalla pagina Segnalazioni. Non pubblicare mai il token nel testo dell\'issue.'
              ]
            ].map(([question, answer]) => (
              <details key={question} className="ul-surface">
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">
                  {question}
                </summary>
                <p className="border-t border-border px-4 py-3 text-sm leading-6 text-muted-foreground">
                  {answer}
                </p>
              </details>
            ))}
          </div>
        </section>
      </main>
    </div>
  </div>
);

export default ManualPage;
