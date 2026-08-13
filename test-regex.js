// Quick test del regex markdown parser
const testText = `| **BC Spagna**                                 | Attività completata: "è fatta", partita e chiusa.                                                                                                                                                       | **Chiuso**                                              | Stefano                          |
| **Migrazione / aggiornamento BC AEB Italia**  | In corso la predisposizione di numeri, stime, tempi e possibili deadline autunnali. Stefano inoltrerà i numeri quando disponibili.                                               | **In progress**                                         | Stefano                          |
| **Continuous Update Nordica**                 | Non riguarda il go-live già avvenuto, ma l'aggiornamento release/continuous update. Da pianificare entro il periodo di scadenza, con data definitiva indicata da Adriano/Zanini. | **In progress / da pianificare**                        | Stefano / Adriano / Zanini       |`;

const tableRowPattern = /\|\s*\*?\*?([^|*]+?)\*?\*?\s*\|\s*([^|]+?)\s*\|\s*\*?\*?([^|*]+?)\*?\*?\s*\|\s*([^|]*?)\s*\|/;

console.log('Testing regex on markdown table rows:\n');

const lines = testText.split('\n');
let count = 0;

for (const line of lines) {
  if (line.startsWith('|') && line.endsWith('|')) {
    console.log(`Line: ${line.slice(0, 60)}...`);
    const match = tableRowPattern.exec(line);
    if (match) {
      count++;
      console.log(`  ✓ MATCH`);
      console.log(`    Task: "${match[1].trim()}"`);
      console.log(`    Update: "${match[2].trim().slice(0, 50)}..."`);
      console.log(`    Status: "${match[3].trim()}"`);
      console.log(`    Owner: "${match[4].trim()}"`);
    } else {
      console.log(`  ✗ NO MATCH`);
    }
    console.log();
  }
}

console.log(`\nTotal matches: ${count}`);
