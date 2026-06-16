const fs = require('fs');

let data;
try {
  data = JSON.parse(fs.readFileSync('C:/Users/91626/.claude/projects/c--Users-91626-Desktop-KnightBridge/a1cca64e-0105-4a16-bdd2-a8028a14673b/tool-results/bkfesli56.txt', 'utf8'));
} catch (e) {
  console.error('Could not read extracted data:', e.message);
  process.exit(1);
}

// ── Sub-service detection ──
// These names are breakdowns of a parent ad budget line. They are display-only
// and excluded from monthly total, commission, and invoice calculations.

const DISPLAY_SUBS = new Set([
  'Custom Audience', 'In Market', 'In-Market', 'Customer Match',
  'Affinity Targeting', 'Affinity Audience', 'Customer Audience',
  'Remarketing', 'Demand Gen', 'Demand Gen / Customer Match',
  'Display, General', 'Display:', 'Display: ZoomInfo',
  'Responsive Display', 'Responsive Display (Windfall)',
]);

const SOCIAL_SUBS = new Set([
  'Social / Advertising', 'Social / Promoted Posts',
  'Social / Evergreen Campaign', 'Social / Website Traffic',
  'Social / Lead Gen',
  'Social:', 'Social: Meta ZoomInfo', 'Social: LinkedIn ZoomInfo',
  'Social Media, Meta Advertising', 'Social Media, LinkedIn',
  'Social Media, Promoted Posts',
  'Social, LinkedIn', 'Social, Meta', 'Social, Promoted Posts',
]);

// "Performance Max" (without "Digital Advertising," prefix) is a sub of Search.
// "Digital Advertising, Performance Max" is a standalone ad line.
const SEARCH_SUBS = new Set(['Performance Max']);

function getSubCategory(name) {
  if (DISPLAY_SUBS.has(name)) return 'display';
  if (SOCIAL_SUBS.has(name)) return 'social';
  if (SEARCH_SUBS.has(name)) return 'search';
  return null;
}

function findParentIndex(services, category) {
  const needle = category === 'display' ? 'Display Ad Budget'
    : category === 'social' ? 'Social Media Ad Budget'
    : 'Search Ad Budget';
  return services.findIndex(s => s.name.includes(needle) && !getSubCategory(s.name));
}

// ── CC normalization ──
function normalizeCC(cc) {
  if (!cc || cc.trim() === '') return '';
  if (cc === 'Client Card') return 'Client Card';
  if (cc === 'KB Card') return 'KB Card';
  if (cc.includes('KB Card')) return 'KB Card';
  return '';
}

// ── Service type fix ──
// Any service with a CC is an ad spend line, not fee.
function fixServiceType(svc, isSubService) {
  if (isSubService) return 'fee';
  const cc = normalizeCC(svc.cc);
  if (cc === 'Client Card' || cc === 'KB Card') return 'ad';
  return svc.svcType;
}

// ── Helpers ──
function normMonth(m) { return m.replace('JUNE', 'JUN'); }
function clientUuid(i) { return 'a0000' + String(i + 1).padStart(3, '0') + '-0000-0000-0000-000000000001'; }
function svcUuid(ci, si) { return 'b' + String(ci + 1).padStart(3, '0') + '0' + String(si + 1).padStart(3, '0') + '-0000-0000-0000-000000000001'; }
function esc(s) { return s.replace(/'/g, "''"); }

function getParentGroup(name) {
  if (name.includes('ALGIN') || name.includes('( ALGIN )')) return 'Algin Management';
  if (['555TEN', 'BROOKLYN POINT  ( SALES )', 'CENTRAL PARK TOWER', 'EVGB',
    'ONE MANHATTAN SQUARE  ( SALES )', 'ONE MANHATTAN SQUARE  ( RENTALS )', 'THE KENT'].includes(name)) return 'Extell';
  if (name.startsWith('TWO TREES')) return 'Two Trees';
  if (name.startsWith('OPTIMA')) return 'Optima McDowell Mountain';
  if (name.startsWith('PARK ELM')) return 'Park Elm';
  if (name.startsWith('MANDARIN ORIENTAL')) return 'Mandarin Oriental';
  if (name.startsWith('520 FIFTH')) return '520 Fifth Avenue';
  return null;
}

function getRegion(sheetName) {
  const m = {
    'NEW YORK & NEW JERSEY': 'New York',
    'TEXAS': 'Texas',
    'FLORIDA': 'Florida',
    'CALIFORNIA': 'California',
    'OTHER DOMESTIC': 'Other Domestic',
    'INTERNATIONAL': 'International',
    'CREATIVE SERVICES': 'Creative Services',
  };
  return m[sheetName] || sheetName;
}

function getBillingPattern(c, fixedServices) {
  const hasKbAd = fixedServices.some(s => s.ccNorm === 'KB Card' && s.typeFixed === 'ad');
  if (hasKbAd) return 'B';
  const hasClientAd = fixedServices.some(s => s.ccNorm === 'Client Card' && s.typeFixed === 'ad');
  if (hasClientAd && c.hasCommission && c.commRate > 0) return 'A';
  return 'C';
}

// ── Pre-process: fix each client's services ──
const processed = data.map(c => {
  const fixed = c.services.map((svc, si) => {
    const subCat = getSubCategory(svc.name);
    const isSubService = !!subCat;
    const parentIdx = isSubService ? findParentIndex(c.services, subCat) : -1;
    const ccNorm = normalizeCC(svc.cc);
    const typeFixed = fixServiceType(svc, isSubService);
    return { ...svc, subCat, isSubService, parentIdx, ccNorm, typeFixed, origIdx: si };
  });
  return { ...c, fixedServices: fixed };
});

// ── Validation: verify known totals ──
function validateClient(name, expectedMonthly, expectedComm, expectedInvoice, month) {
  const c = processed.find(p => p.name === name);
  if (!c) { console.warn('WARN: ' + name + ' not found'); return; }
  const topLevel = c.fixedServices.filter(s => !s.isSubService);
  const total = topLevel.reduce((sum, s) => sum + (s.amounts[month] || 0), 0);
  const clientCardAd = topLevel.filter(s => s.typeFixed === 'ad' && s.ccNorm === 'Client Card')
    .reduce((sum, s) => sum + (s.amounts[month] || 0), 0);
  const kbCardAd = topLevel.filter(s => s.typeFixed === 'ad' && s.ccNorm === 'KB Card')
    .reduce((sum, s) => sum + (s.amounts[month] || 0), 0);
  const fee = topLevel.filter(s => s.typeFixed !== 'ad')
    .reduce((sum, s) => sum + (s.amounts[month] || 0), 0);
  const rate = c.commRate || 0;
  const comm = clientCardAd * rate;
  const pattern = getBillingPattern(c, c.fixedServices);
  let invoice;
  if (pattern === 'A') invoice = fee + comm;
  else if (pattern === 'B') invoice = fee + kbCardAd;
  else invoice = fee;

  const ok = total === expectedMonthly && Math.abs(comm - expectedComm) < 1 && Math.abs(invoice - expectedInvoice) < 1;
  console.log((ok ? '✓' : '✗') + ' ' + name + ' (' + month + '): monthly=' + total + '/' + expectedMonthly +
    ' comm=' + comm.toFixed(2) + '/' + expectedComm + ' invoice=' + invoice.toFixed(2) + '/' + expectedInvoice +
    ' pattern=' + pattern);
}

validateClient('ONE WALL STREET', 29000, 3225, 10725, 'DEC 2025');
validateClient('ALGIN MANAGEMENT ( PORTFOLIO )', 10750, 0, 8000, 'DEC 2025');
validateClient('555TEN', 4250, 375, 1625, 'DEC 2025');

// ── Count fixes applied ──
let subLinked = 0, typeFixed = 0, ccFixed = 0;
processed.forEach(c => {
  c.fixedServices.forEach(s => {
    if (s.isSubService && s.parentIdx >= 0) subLinked++;
    if (s.typeFixed !== s.svcType) typeFixed++;
    if (normalizeCC(s.cc) !== (s.cc || '')) ccFixed++;
  });
});
console.log('\nFixes: ' + subLinked + ' sub-services linked, ' + typeFixed + ' types fixed, ' + ccFixed + ' CCs normalized');

// ── Generate SQL ──
const sql = [];
sql.push('-- ================================================================');
sql.push('-- KBCBP Seed Data: All 69 clients from 2026 Budget Tracker Excel');
sql.push('-- Generated by scripts/generate-seed.js');
sql.push('-- Fixes applied: sub-service parent links, service types, CC values');
sql.push('-- ================================================================');
sql.push('');
sql.push('-- Step 1: Clear ALL existing data (order matters for FK constraints)');
sql.push('DELETE FROM budget_entries;');
sql.push('DELETE FROM client_services;');
sql.push('DELETE FROM invoices;');
sql.push('DELETE FROM clients;');
sql.push('');
sql.push('-- Step 2: Drop old constraints');
sql.push("ALTER TABLE client_services DROP CONSTRAINT IF EXISTS client_services_credit_card_check;");
sql.push('');

// Clients
sql.push('-- Step 3: Insert all clients (' + processed.length + ' total)');
sql.push('INSERT INTO clients (id, name, project_name, parent_group, region, tags, team, commission_rate, billing_pattern, notes, sort_order) VALUES');

const clientRows = [];
processed.forEach((c, i) => {
  const pg = getParentGroup(c.name);
  const region = getRegion(c.region);
  const pattern = getBillingPattern(c, c.fixedServices);
  const rate = c.hasCommission ? Math.round(c.commRate * 1000) / 10 : 0;

  let notesVal = 'NULL';
  if (c.notes && c.notes.length > 0) {
    const noteStrs = c.notes.map(n => '"' + esc(n).replace(/"/g, '\\"') + '"').join(',');
    notesVal = "'{" + noteStrs + "}'";
  }

  clientRows.push(
    "  ('" + clientUuid(i) + "', '" + esc(c.name) + "', " +
    "NULL, " +
    (pg ? "'" + esc(pg) + "'" : 'NULL') + ", " +
    "'" + esc(region) + "', NULL, " +
    "'" + esc(c.team || 'Unassigned') + "', " +
    rate + ", '" + pattern + "', " +
    notesVal + ", " + (i + 1) + ")"
  );
});
sql.push(clientRows.join(',\n') + ';');
sql.push('');

// Services
sql.push('-- Step 4: Insert all services (with fixed parent links, types, CC values)');
let totalServices = 0;
processed.forEach((c, ci) => {
  if (c.fixedServices.length === 0) return;
  sql.push('-- ' + c.name);
  sql.push('INSERT INTO client_services (id, client_id, service_name, service_type, credit_card, parent_service_id, sort_order) VALUES');

  const svcRows = [];
  c.fixedServices.forEach((svc, si) => {
    const uuid = svcUuid(ci, si);
    const cc = svc.ccNorm || '';

    let parentId = 'NULL';
    if (svc.isSubService && svc.parentIdx >= 0) {
      parentId = "'" + svcUuid(ci, svc.parentIdx) + "'";
    }

    svcRows.push(
      "  ('" + uuid + "', '" + clientUuid(ci) + "', '" + esc(svc.name) + "', " +
      "'" + svc.typeFixed + "', '" + cc + "', " + parentId + ", " + (si + 1) + ")"
    );
    totalServices++;
  });
  sql.push(svcRows.join(',\n') + ';');
});
sql.push('');

// Budget entries in batches
sql.push('-- Step 5: Insert all budget entries');
const MONTHS = ['DEC 2025', 'JAN 2026', 'FEB 2026', 'MAR 2026', 'APR 2026', 'MAY 2026', 'JUNE 2026'];

let entryBatch = [];
let batchCount = 0;
const BATCH_SIZE = 200;

function flushBatch() {
  if (entryBatch.length === 0) return;
  sql.push('INSERT INTO budget_entries (client_id, service_id, billing_month, amount) VALUES');
  sql.push(entryBatch.join(',\n') + ';');
  entryBatch = [];
}

processed.forEach((c, ci) => {
  c.fixedServices.forEach((svc, si) => {
    for (const m of MONTHS) {
      const amt = svc.amounts[m];
      if (amt !== undefined && amt !== null) {
        entryBatch.push(
          "  ('" + clientUuid(ci) + "', '" + svcUuid(ci, si) + "', '" + normMonth(m) + "', " + amt + ")"
        );
        batchCount++;
        if (entryBatch.length >= BATCH_SIZE) flushBatch();
      }
    }
  });
});
flushBatch();

const output = sql.join('\n');
fs.writeFileSync('./supabase/migrations/004_seed_all_clients.sql', output);
console.log('\nGenerated SQL: ' + processed.length + ' clients, ' + totalServices + ' services, ' + batchCount + ' budget entries');
console.log('File: supabase/migrations/004_seed_all_clients.sql');
