// Script una tantum per importare le tabelle CSS dal DB locale al DB di produzione
// (Azure App Service updatelens-api). Da eseguire manualmente:
//
//   node scripts/import-css-to-prod.cjs check     -> mostra conteggi righe CSS locali e remoti
//   node scripts/import-css-to-prod.cjs import     -> importa le righe CSS locali nel backup scaricato
//
// Prerequisiti:
//   1. az login (fatto) e sottoscrizione corretta selezionata
//   2. Aver scaricato il backup di produzione in scripts/prod-db-backup/ con:
//      az rest --method get --url "https://updatelens-api.scm.azurewebsites.net/api/vfs/data/releaseplans.db" --resource "https://management.azure.com" --output-file scripts/prod-db-backup/releaseplans.db
//      az rest --method get --url "https://updatelens-api.scm.azurewebsites.net/api/vfs/data/releaseplans.db-wal" --resource "https://management.azure.com" --output-file scripts/prod-db-backup/releaseplans.db-wal
//      az rest --method get --url "https://updatelens-api.scm.azurewebsites.net/api/vfs/data/releaseplans.db-shm" --resource "https://management.azure.com" --output-file scripts/prod-db-backup/releaseplans.db-shm

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const LOCAL_DB = path.resolve(__dirname, '..', 'data', 'releaseplans.db');
const PROD_BACKUP_DB = path.resolve(__dirname, 'prod-db-backup', 'releaseplans.db');

const CSS_TABLES = [
  'css_customers',
  'css_activities',
  'css_meeting_documents',
  'css_validation_batches',
  'css_activity_proposals'
];

function checkpointAndCount(dbPath, label) {
  if (!fs.existsSync(dbPath)) {
    console.log(`[${label}] file non trovato: ${dbPath}`);
    return null;
  }
  const db = new Database(dbPath);
  db.pragma('wal_checkpoint(TRUNCATE)');
  console.log(`\n[${label}] ${dbPath}`);
  for (const t of CSS_TABLES) {
    try {
      const row = db.prepare(`SELECT COUNT(*) as c FROM "${t}"`).get();
      console.log(`  ${t}: ${row.c} righe`);
    } catch (e) {
      console.log(`  ${t}: tabella non trovata (${e.message})`);
    }
  }
  db.close();
  return db;
}

function doCheck() {
  checkpointAndCount(LOCAL_DB, 'LOCALE');
  checkpointAndCount(PROD_BACKUP_DB, 'PRODUZIONE (backup scaricato)');
}

function doImport() {
  if (!fs.existsSync(PROD_BACKUP_DB)) {
    console.error('Backup di produzione non trovato. Scaricalo prima con az rest (vedi istruzioni in testa al file).');
    process.exit(1);
  }

  const prodDb = new Database(PROD_BACKUP_DB);
  prodDb.pragma('wal_checkpoint(TRUNCATE)');

  // Sicurezza: non sovrascrivere se in produzione ci sono gia dati CSS reali
  for (const t of CSS_TABLES) {
    const row = prodDb.prepare(`SELECT COUNT(*) as c FROM "${t}"`).get();
    if (row.c > 0) {
      console.error(`ATTENZIONE: la tabella "${t}" in produzione ha gia ${row.c} righe. Import annullato per sicurezza.`);
      console.error('Se vuoi comunque procedere (merge/sovrascrittura), modifica questo script consapevolmente.');
      prodDb.close();
      process.exit(1);
    }
  }

  prodDb.exec(`ATTACH DATABASE '${LOCAL_DB.replace(/'/g, "''")}' AS local_db`);

  const insertOrder = [
    'css_customers',
    'css_meeting_documents',
    'css_validation_batches',
    'css_activities',
    'css_activity_proposals'
  ];

  const txn = prodDb.transaction(() => {
    for (const t of insertOrder) {
      const cols = prodDb.prepare(`PRAGMA table_info("${t}")`).all().map((c) => c.name);
      const colList = cols.map((c) => `"${c}"`).join(', ');
      const sql = `INSERT INTO "${t}" (${colList}) SELECT ${colList} FROM local_db."${t}"`;
      const info = prodDb.prepare(sql).run();
      console.log(`${t}: inserite ${info.changes} righe`);
    }
  });
  txn();

  prodDb.pragma('wal_checkpoint(TRUNCATE)');
  prodDb.close();

  console.log('\nImport completato nel file di backup locale.');
  console.log('Prossimo passo: carica il file aggiornato su Azure con:');
  console.log('  az rest --method put --url "https://updatelens-api.scm.azurewebsites.net/api/vfs/data/releaseplans.db" --resource "https://management.azure.com" --headers "Content-Type=application/octet-stream" --body @scripts/prod-db-backup/releaseplans.db');
  console.log('poi elimina i file -wal/-shm residui su Azure e riavvia l\'App Service:');
  console.log('  az rest --method delete --url "https://updatelens-api.scm.azurewebsites.net/api/vfs/data/releaseplans.db-wal" --resource "https://management.azure.com"');
  console.log('  az rest --method delete --url "https://updatelens-api.scm.azurewebsites.net/api/vfs/data/releaseplans.db-shm" --resource "https://management.azure.com"');
  console.log('  az webapp restart --name updatelens-api --resource-group rg-updatelens-runtime');
}

const cmd = process.argv[2];
if (cmd === 'check') {
  doCheck();
} else if (cmd === 'import') {
  doImport();
} else {
  console.log('Uso: node scripts/import-css-to-prod.cjs check|import');
  process.exit(1);
}
