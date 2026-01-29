# Guida Risoluzione Preset Duplicati

## Problema Risolto

Il bootstrap dei preset creava record duplicati "Default" ogni volta che il componente veniva ri-renderizzato. Questo è stato **completamente risolto** con l'aggiunta di un flag persistente in localStorage.

## Come Funziona Ora

Il sistema usa **due livelli di protezione**:

1. **`useRef`** - Previene esecuzioni multiple nello stesso ciclo di vita del componente
2. **localStorage flag** (`updatelens.presets.bootstrapped`) - Previene creazione duplicati anche dopo ricariche

### Flusso Logico

```
1. Componente monta
2. useEffect verifica useRef → se già eseguito, STOP
3. Verifica flag localStorage → se già bootstrapped, CARICA solo preset esistenti
4. Se non bootstrapped E nessun preset esiste → CREA preset "Default"
5. Imposta flag localStorage = 'true'
```

## Pulire i Duplicati Esistenti

### Opzione 1: Strumento HTML (Raccomandato)

1. Apri `clear-duplicate-presets.html` nel browser
2. Clicca **"Mostra Preset"** per vedere la situazione attuale
3. Clicca **"Pulisci Duplicati"** per rimuovere i duplicati mantenendo un solo "Default"
4. Ricarica l'applicazione UpdateLens

### Opzione 2: Console Browser (Manuale)

Apri la Developer Console (F12) e incolla:

```javascript
// Rimuovi tutti i preset e il flag
localStorage.removeItem('updatelens.presets.v1');
localStorage.removeItem('updatelens.presets.active');
localStorage.removeItem('updatelens.presets.bootstrapped');

console.log('✓ Preset puliti. Ricarica la pagina per creare un nuovo preset Default.');
```

Poi ricarica la pagina (F5).

### Opzione 3: Pulizia Manuale con Conservazione

Se vuoi mantenere preset personalizzati:

```javascript
// 1. Leggi i preset attuali
const presetsRaw = localStorage.getItem('updatelens.presets.v1');
const presets = JSON.parse(presetsRaw);

// 2. Mostra tutti i preset
console.table(presets.map(p => ({ name: p.name, id: p.id, isDefault: p.isDefault })));

// 3. Filtra mantenendo solo preset unici per nome
const uniquePresets = [];
const seenNames = new Set();

presets.forEach(preset => {
  if (!seenNames.has(preset.name)) {
    seenNames.add(preset.name);
    uniquePresets.push(preset);
  } else if (preset.name === 'Default' && preset.isDefault) {
    // Mantieni il Default marcato come isDefault
    const index = uniquePresets.findIndex(p => p.name === 'Default');
    if (index >= 0) {
      uniquePresets[index] = preset;
    }
  }
});

// 4. Salva preset puliti
localStorage.setItem('updatelens.presets.v1', JSON.stringify(uniquePresets));
localStorage.setItem('updatelens.presets.bootstrapped', 'true');

console.log(`✓ Ridotti da ${presets.length} a ${uniquePresets.length} preset`);
console.table(uniquePresets.map(p => ({ name: p.name, id: p.id, isDefault: p.isDefault })));

// 5. Ricarica
location.reload();
```

## Verifica Risoluzione

Dopo la pulizia:

1. ✅ Ricarica l'applicazione più volte
2. ✅ Naviga tra le pagine (Dashboard → Filtri Globali → Dashboard)
3. ✅ Verifica che esista **un solo preset "Default"**
4. ✅ Crea nuovi preset - devono essere salvati correttamente

### Controllo localStorage

Apri Developer Tools → Application/Storage → Local Storage:

- `updatelens.presets.v1` → deve contenere un array di preset unici
- `updatelens.presets.bootstrapped` → deve essere `"true"`
- `updatelens.presets.active` → deve contenere l'ID del preset attivo

## File Modificati

| File | Modifica |
|------|----------|
| [useBootstrapPresets.ts](src/hooks/useBootstrapPresets.ts) | Aggiunto flag localStorage persistente |
| [clear-duplicate-presets.html](clear-duplicate-presets.html) | Aggiornato per gestire flag bootstrap |

## Note Tecniche

### Perché Questo Fix Funziona

**Problema originale:**
- `useEffect` con dipendenza `cssFilters` veniva rieseguito ad ogni cambio filtri
- `useRef` veniva resettato ad ogni smontaggio componente
- Nessun controllo sui preset esistenti in localStorage

**Soluzione:**
```typescript
// 1. useEffect senza dipendenze (run once)
useEffect(() => { ... }, []);

// 2. Flag persistente in localStorage
const alreadyBootstrapped = localStorage.getItem(BOOTSTRAP_FLAG_KEY);

// 3. Controllo immediato preset esistenti
if (presets.length === 0) { /* crea */ }
```

### Comportamento Atteso

- **Prima apertura app**: Crea preset "Default", imposta flag
- **Ricarica/navigazione**: Vede flag, carica preset esistenti, NON crea duplicati
- **Dopo pulizia manuale**: Se flag rimosso, ricrea preset "Default" una volta

### Debug

Per verificare il comportamento:

```javascript
// Controlla flag bootstrap
console.log('Bootstrapped:', localStorage.getItem('updatelens.presets.bootstrapped'));

// Controlla preset
const presets = JSON.parse(localStorage.getItem('updatelens.presets.v1') || '[]');
console.log('Preset count:', presets.length);
console.table(presets.map(p => ({ name: p.name, isDefault: p.isDefault })));
```

## FAQ

**Q: Posso rimuovere manualmente il flag bootstrap?**
A: Sì, ma verrà ricreato un preset "Default" al prossimo caricamento se non esistono preset.

**Q: Cosa succede se elimino tutti i preset ma NON il flag?**
A: L'app non creerà automaticamente un preset "Default". Devi rimuovere anche il flag o crearne uno manualmente.

**Q: Il fix influenza le performance?**
A: No, aggiunge solo un controllo localStorage minimo all'avvio.

**Q: I preset esistenti verranno persi?**
A: No, il fix non tocca i preset esistenti. Usa lo strumento di pulizia solo per rimuovere i duplicati.

---

**Status:** ✅ Problema risolto definitivamente
**Build:** ✅ Testato e funzionante
**Compatibilità:** ✅ Retrocompatibile con preset esistenti
