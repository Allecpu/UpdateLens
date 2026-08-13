import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'data', 'css.db');
const reportPath = path.join(__dirname, '..', 'tmp', 'extraction-comparison.json');

interface ExtractionResult {
  method: 'heuristic' | 'azure';
  proposalCount: number;
  proposals: Array<{
    customerName: string;
    issue: string;
    issueStatus: string;
    confidence: number;
  }>;
  executionTimeMs: number;
  notes?: string;
}

interface ComparisonReport {
  timestamp: string;
  documentId: string;
  filename: string;
  results: {
    heuristic: ExtractionResult | null;
    azure: ExtractionResult | null;
  };
  comparison: {
    heuristicCount: number;
    azureCount: number;
    commonCount: number;
    heuristicOnly: number;
    azureOnly: number;
    coverage: number;
  };
  recommendation: string;
}

async function runComparison() {
  const db = new Database(dbPath);

  try {
    // Fetch latest document
    const doc = db.prepare(`
      SELECT document_id, filename, extracted_text
      FROM css_meeting_documents
      WHERE extraction_status = 'processed'
      AND extracted_text IS NOT NULL
      ORDER BY processed_at DESC
      LIMIT 1
    `).get() as {
      document_id: string;
      filename: string;
      extracted_text: string;
    } | undefined;

    if (!doc || !doc.extracted_text) {
      console.error('No processed document found with extracted text');
      process.exit(1);
    }

    console.log(`\n📄 Document: ${doc.filename}\n`);

    // Extract with heuristic
    console.log('🔍 Extracting with heuristic...');
    const heuristicStart = Date.now();
    const heuristicProposals = await extractWithHeuristicLocal(doc.extracted_text);
    const heuristicTime = Date.now() - heuristicStart;

    console.log(`   ✓ Found ${heuristicProposals.length} proposals in ${heuristicTime}ms`);
    heuristicProposals.slice(0, 3).forEach((p, i) => {
      console.log(`     ${i + 1}. [${p.issueStatus}] ${p.customerName} - ${p.issue.slice(0, 40)}`);
    });

    // Extract with Azure if available
    let azureProposals: Array<any> = [];
    let azureTime = 0;
    let azureError: string | null = null;

    if (process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_ENDPOINT) {
      console.log('\n🤖 Extracting with Azure OpenAI...');
      const azureStart = Date.now();
      try {
        azureProposals = await extractWithAzureLocal(doc.extracted_text);
        azureTime = Date.now() - azureStart;
        console.log(`   ✓ Found ${azureProposals.length} proposals in ${azureTime}ms`);
        azureProposals.slice(0, 3).forEach((p, i) => {
          console.log(`     ${i + 1}. [${p.issueStatus}] ${p.customerName} - ${p.issue.slice(0, 40)}`);
        });
      } catch (err) {
        azureError = err instanceof Error ? err.message : String(err);
        console.log(`   ⚠ Error: ${azureError}`);
      }
    } else {
      console.log('\n⚠️  Azure OpenAI not configured, skipping AI extraction');
    }

    // Compare
    const common = computeCommon(heuristicProposals, azureProposals);
    const comparison = {
      heuristicCount: heuristicProposals.length,
      azureCount: azureProposals.length,
      commonCount: common,
      heuristicOnly: heuristicProposals.length - common,
      azureOnly: azureProposals.length - common,
      coverage: heuristicProposals.length > 0 ? Math.round((common / Math.max(heuristicProposals.length, azureProposals.length)) * 100) : 0
    };

    let recommendation = '';
    if (azureProposals.length === 0) {
      recommendation = 'Azure not configured; using heuristic only';
    } else if (azureProposals.length > heuristicProposals.length * 1.5) {
      recommendation = '🚀 Azure significantly better; consider AI-first strategy';
    } else if (heuristicProposals.length >= azureProposals.length * 0.8) {
      recommendation = '✅ Heuristic performs well; maintain current hybrid approach';
    } else {
      recommendation = '⚖️ Mixed results; consider voting/fusion strategy';
    }

    // Prepare report
    const report: ComparisonReport = {
      timestamp: new Date().toISOString(),
      documentId: doc.document_id,
      filename: doc.filename,
      results: {
        heuristic: {
          method: 'heuristic',
          proposalCount: heuristicProposals.length,
          proposals: heuristicProposals.map((p) => ({
            customerName: p.customerName,
            issue: p.issue,
            issueStatus: p.issueStatus,
            confidence: p.confidence
          })),
          executionTimeMs: heuristicTime
        },
        azure: azureError
          ? null
          : {
              method: 'azure',
              proposalCount: azureProposals.length,
              proposals: azureProposals.map((p) => ({
                customerName: p.customerName,
                issue: p.issue,
                issueStatus: p.issueStatus,
                confidence: 0.85
              })),
              executionTimeMs: azureTime,
              notes: azureError || undefined
            }
      },
      comparison,
      recommendation
    };

    // Save report
    if (!fs.existsSync(path.dirname(reportPath))) {
      fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    }
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Print summary
    console.log('\n📊 Comparison Summary:');
    console.log(`   Heuristic: ${comparison.heuristicCount} proposals`);
    console.log(`   Azure:     ${comparison.azureCount} proposals`);
    console.log(`   Common:    ${comparison.commonCount} (${comparison.coverage}% overlap)`);
    console.log(`   Heuristic-only: ${comparison.heuristicOnly}`);
    console.log(`   Azure-only:     ${comparison.azureOnly}`);
    console.log(`\n💡 Recommendation: ${recommendation}`);
    console.log(`\n📁 Report saved to: ${reportPath}`);
  } finally {
    db.close();
  }
}

async function extractWithHeuristicLocal(text: string): Promise<Array<any>> {
  const proposals = [];
  const lines = text.split(/\r?\n/);
  const tableRowPattern = /\|\s*\*?\*?([^|*]+?)\*?\*?\s*\|\s*([^|]+?)\s*\|\s*\*?\*?([^|*]+?)\*?\*?\s*\|\s*([^|]*?)\s*\|/;

  for (const line of lines) {
    if (line.startsWith('|') && line.endsWith('|') && !line.includes('---')) {
      const match = tableRowPattern.exec(line);
      if (match) {
        const task = match[1].trim();
        const update = match[2].trim();
        const status = match[3].trim();
        const owner = match[4]?.trim() || '';

        if (task.length >= 5 && update.length >= 10) {
          proposals.push({
            customerName: 'AEB SPA',
            issue: task,
            issueStatus: status || 'Action required',
            details: update,
            cssOwner: owner || null,
            confidence: 0.72
          });
        }
      }
    }
  }

  return proposals;
}

async function extractWithAzureLocal(text: string): Promise<Array<any>> {
  // Placeholder: actual Azure call would go here
  // For now, return empty to show the pattern
  return [];
}

function computeCommon(heuristic: Array<any>, azure: Array<any>): number {
  if (heuristic.length === 0 || azure.length === 0) return 0;
  const heuristicKeys = new Set(heuristic.map((p) => `${p.customerName}::${p.issue.toLowerCase()}`));
  let common = 0;
  for (const p of azure) {
    if (heuristicKeys.has(`${p.customerName}::${p.issue.toLowerCase()}`)) {
      common += 1;
    }
  }
  return common;
}

runComparison().catch((err) => {
  console.error('Comparison error:', err);
  process.exit(1);
});
