import express from 'express';
import { getDb, initializeDatabase } from '../src/db/database';
import apiRouter from '../src/routes/api';
import { encryptField, decryptField, encryptRecord, decryptRecord } from '../src/utils/crypto';
import { generatePdfReport } from '../src/reports/pdf';
import { calculateFragmentationScore, logEnergyTransaction, getEnergyAccountingSummary } from '../src/analytics/energy';
import { getOnThisDayCapsule, analyzePeakPeriods } from '../src/analytics/archaeology';
import { askPersonalAI } from '../src/ai/agent';
import { getAllStreaks } from '../src/analytics/streaks';
import { calculatePersonalSLA } from '../src/analytics/sla';
import http from 'http';

interface TestResult {
  suite: string;
  test: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, suite: string, test: string, details = '') {
  results.push({
    suite,
    test,
    passed: condition,
    details: condition ? 'PASSED' : `FAILED: ${details}`
  });
  if (condition) {
    console.log(`  ✅ [${suite}] ${test}`);
  } else {
    console.error(`  ❌ [${suite}] ${test} — ${details}`);
  }
}

async function runMasterQCAudit() {
  console.log('\n======================================================');
  console.log('🧬 PERSONAL API — MASTER SYSTEM-WIDE QUALITY CONTROL');
  console.log('======================================================\n');

  // --- 1. Database & Schema Verification ---
  console.log('📦 1. Database & Storage Schema Audit');
  const db = getDb();
  initializeDatabase();

  const requiredTables = [
    'data_sources',
    'raw_events',
    'life_commits',
    'manual_entries',
    'streaks',
    'goals',
    'insights',
    'energy_transactions',
    'health_metrics',
    'github_commits',
    'spotify_recent_tracks'
  ];

  for (const table of requiredTables) {
    const tableInfo = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(table);
    assert(!!tableInfo, 'Database Schema', `Table '${table}' exists`);
  }

  // --- 2. Cryptographic Security & AES-256 Engine ---
  console.log('\n🔒 2. Security & AES-256-GCM Encryption Audit');
  const plainText = 'confidential_medical_diagnosis_adhd';
  const ciphertext = encryptField(plainText);
  const decrypted = decryptField(ciphertext);
  assert(decrypted === plainText, 'Cryptography', 'AES-256-GCM encryption/decryption roundtrip');
  assert(ciphertext !== plainText && ciphertext.includes(':'), 'Cryptography', 'Ciphertext IV:AuthTag:Payload structure verified');

  const record = { mood: 8, notes: 'Patient feeling calm', sensitive_flag: true };
  const encryptedRec = encryptRecord(record, ['notes']);
  assert(encryptedRec.notes !== record.notes, 'Cryptography', 'Selective field encryption works');
  const decryptedRec = decryptRecord(encryptedRec, ['notes']);
  assert(decryptedRec.notes === record.notes, 'Cryptography', 'Selective field decryption restores plaintext');

  // --- 3. Phase 1-3 Core Analytics & AI Engines ---
  console.log('\n🧠 3. Analytics, Intelligence & AI Agent Audit');
  const streaks = getAllStreaks();
  assert(Array.isArray(streaks) && streaks.length > 0, 'Analytics', 'Habit Streaks computed');

  const sla = calculatePersonalSLA(30);
  assert(typeof sla.overallUptime === 'number' && sla.slas.length > 0, 'Analytics', 'Personal SLA computed');

  const aiResponse = await askPersonalAI('What is my average mood and top productive habit?');
  assert(typeof aiResponse.answer === 'string' && aiResponse.answer.length > 20, 'AI Engine', 'RAG AI question answering works');

  // --- 4. Phase 5 Advanced Dimensions: Fragmentation, Energy & Archaeology ---
  console.log('\n⚡ 4. Phase 5 Advanced Dimensions Engine Audit');
  const fragmentation = calculateFragmentationScore();
  assert(typeof fragmentation.fragmentationIndex === 'number', 'Phase 5: Energy', 'Fragmentation index computed');
  assert(typeof fragmentation.focusState === 'string', 'Phase 5: Energy', `Focus state computed (${fragmentation.focusState})`);
  assert(typeof fragmentation.cognitivePenaltyPercent === 'number', 'Phase 5: Energy', 'Cognitive tax penalty calculated');

  const txn = logEnergyTransaction({
    activity: 'QC Master Audit Verification',
    impact: 4,
    category: 'Engineering',
    tags: ['audit', 'release']
  });
  assert(typeof txn?.id === 'string' && txn.id.length > 0, 'Phase 5: Energy', 'Energy transaction logged');

  const energyAccounting = getEnergyAccountingSummary(14);
  assert(typeof energyAccounting.netBalance === 'number', 'Phase 5: Energy', `Energy balance summary computed (Net: ${energyAccounting.netBalance})`);
  assert(Array.isArray(energyAccounting.topFillers), 'Phase 5: Energy', 'Top energy fillers derived');

  const onThisDay = getOnThisDayCapsule();
  assert(Array.isArray(onThisDay), 'Phase 5: Archaeology', 'On This Day time capsule generated');

  const peakPatterns = analyzePeakPeriods('mood');
  assert(Array.isArray(peakPatterns.peakDays) && typeof peakPatterns.optimalDayRecipe === 'string', 'Phase 5: Archaeology', 'Peak performance pattern miner generated recipe');

  // --- 5. Phase 4 Reporting & PDF Life Wrapped Generator ---
  console.log('\n📄 5. PDF Executive Report Generation Audit');
  const pdfBuffer = await generatePdfReport('week');
  assert(Buffer.isBuffer(pdfBuffer) && pdfBuffer.length > 1000, 'PDF Generator', `PDF generated successfully (${pdfBuffer.length} bytes)`);

  // --- 6. Full Express REST API Integration Test ---
  console.log('\n🌐 6. Full REST API Contract Verification');
  const app = express();
  app.use(express.json());
  app.get('/health', (req, res) => res.json({ status: 'ok', version: '1.0.0' }));
  app.use('/api/v1', apiRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(3399, resolve));

  async function apiGet(path: string): Promise<{ status: number; body: any }> {
    return new Promise((resolve, reject) => {
      http.get(`http://localhost:3399${path}`, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode || 0, body: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode || 0, body: data });
          }
        });
      }).on('error', reject);
    });
  }

  try {
    const health = await apiGet('/health');
    assert(health.status === 200 && health.body.status === 'ok', 'API Contract', 'GET /health responds 200');

    const me = await apiGet('/api/v1/me');
    assert(me.status === 200 && !!me.body.today, 'API Contract', 'GET /api/v1/me returns comprehensive snapshot');

    const fragApi = await apiGet('/api/v1/analytics/fragmentation');
    assert(fragApi.status === 200 && typeof fragApi.body.fragmentationIndex === 'number', 'API Contract', 'GET /api/v1/analytics/fragmentation responds 200');

    const energyApi = await apiGet('/api/v1/analytics/energy-accounting');
    assert(energyApi.status === 200 && typeof energyApi.body.netBalance === 'number', 'API Contract', 'GET /api/v1/analytics/energy-accounting responds 200');

    const memoryApi = await apiGet('/api/v1/archaeology/on-this-day');
    assert(memoryApi.status === 200 && Array.isArray(memoryApi.body.memories), 'API Contract', 'GET /api/v1/archaeology/on-this-day responds 200');

    const peaksApi = await apiGet('/api/v1/archaeology/peaks?metric=mood');
    assert(peaksApi.status === 200 && typeof peaksApi.body.optimalDayRecipe === 'string', 'API Contract', 'GET /api/v1/archaeology/peaks responds 200');

    const slaApi = await apiGet('/api/v1/analytics/sla?days=30');
    assert(slaApi.status === 200 && typeof slaApi.body.overallUptime === 'number', 'API Contract', 'GET /api/v1/analytics/sla responds 200');

    const commitsApi = await apiGet('/api/v1/life-commits?limit=5');
    assert(commitsApi.status === 200 && Array.isArray(commitsApi.body.commits), 'API Contract', 'GET /api/v1/life-commits responds 200');
  } finally {
    server.close();
  }

  // --- Summary ---
  console.log('\n======================================================');
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  console.log(`QC AUDIT SUMMARY: ${passed} / ${total} Checks Passed (${Math.round(passed / total * 100)}%)`);
  console.log('======================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runMasterQCAudit().catch(err => {
  console.error('Master QC Audit Fatal Error:', err);
  process.exit(1);
});
