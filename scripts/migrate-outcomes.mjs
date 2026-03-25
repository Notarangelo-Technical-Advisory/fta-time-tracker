/**
 * One-time migration: copy outcomes from existing statusReports documents
 * into the new outcomes collection, using the Firestore REST API
 * (avoids gRPC TLS issues on this machine).
 *
 * Usage:
 *   cd /Users/jacknotarangelo/Documents/GitHub/fta-time-tracker
 *   NODE_TLS_REJECT_UNAUTHORIZED=0 node scripts/migrate-outcomes.mjs
 */

import { execSync } from 'node:child_process';

const PROJECT_ID = 'fta-invoice-tracking';
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// Get ADC access token via gcloud
function getAccessToken() {
  return execSync('gcloud auth application-default print-access-token', { encoding: 'utf8' }).trim();
}

async function firestoreGet(path, token) {
  const res = await fetch(`${BASE_URL}/${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function firestoreList(collection, token) {
  const res = await fetch(`${BASE_URL}/${collection}?pageSize=100`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`LIST ${collection} failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.documents ?? [];
}

async function firestoreCreate(collection, fields, token) {
  const res = await fetch(`${BASE_URL}/${collection}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fields })
  });
  if (!res.ok) throw new Error(`CREATE ${collection} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// Firestore REST value helpers
function getString(field) {
  return field?.stringValue ?? null;
}
function getArray(field) {
  return field?.arrayValue?.values ?? [];
}
function toStringField(val) {
  return { stringValue: val };
}
function toArrayField(values) {
  return { arrayValue: { values: values.map(v => ({ stringValue: v })) } };
}
function toTimestampField(date) {
  return { timestampValue: date.toISOString() };
}

async function migrate() {
  console.log(`\nReading statusReports from project: ${PROJECT_ID}\n`);

  const token = getAccessToken();

  const reportDocs = await firestoreList('statusReports', token);

  if (reportDocs.length === 0) {
    console.log('No status reports found. Nothing to migrate.');
    return;
  }

  console.log(`Found ${reportDocs.length} status report(s).\n`);

  // Sort oldest first so newest wins if same customer+project appears multiple times
  reportDocs.sort((a, b) => {
    const aTs = a.fields?.createdAt?.timestampValue ?? '';
    const bTs = b.fields?.createdAt?.timestampValue ?? '';
    return aTs.localeCompare(bTs);
  });

  // Map: "customerId|projectName" -> { customerId, projectName, outcomes[] }
  const outcomeMap = new Map();

  for (const doc of reportDocs) {
    const f = doc.fields ?? {};
    const docId = doc.name.split('/').pop();
    const customerId = getString(f.customerId);
    const customerName = getString(f.customerName);
    const periodStart = getString(f.periodStart);
    const periodEnd = getString(f.periodEnd);
    const sections = getArray(f.sections);

    console.log(`  Report ${docId} — ${customerName} (${periodStart} to ${periodEnd})`);

    if (sections.length === 0) {
      console.log('    No sections found, skipping.');
      continue;
    }

    for (const sectionVal of sections) {
      const sf = sectionVal.mapValue?.fields ?? {};
      const projectName = getString(sf.projectName);
      const outcomes = getArray(sf.outcomes).map(v => v.stringValue).filter(Boolean);

      if (!projectName || outcomes.length === 0) continue;

      const key = `${customerId}|${projectName}`;
      outcomeMap.set(key, { customerId, projectName, outcomes });

      console.log(`    Project: ${projectName} — ${outcomes.length} outcome(s)`);
      outcomes.forEach(o => console.log(`      ${o}`));
    }
  }

  console.log(`\nWriting ${outcomeMap.size} outcome record(s) to the outcomes collection...\n`);

  // Check existing outcomes docs
  const existingDocs = await firestoreList('outcomes', token);
  const existingKeys = new Set(
    existingDocs.map(d => {
      const f = d.fields ?? {};
      return `${getString(f.customerId)}|${getString(f.projectName)}`;
    })
  );

  const now = new Date();
  let written = 0;

  for (const record of outcomeMap.values()) {
    const key = `${record.customerId}|${record.projectName}`;
    if (existingKeys.has(key)) {
      console.log(`  SKIP (already exists): ${record.projectName}`);
      continue;
    }

    await firestoreCreate('outcomes', {
      customerId: toStringField(record.customerId),
      projectName: toStringField(record.projectName),
      outcomes: toArrayField(record.outcomes),
      updatedAt: toTimestampField(now)
    }, token);

    console.log(`  CREATED: ${record.projectName} (${record.outcomes.length} outcomes)`);
    written++;
  }

  console.log(`\nDone. ${written} outcome record(s) created.\n`);
}

migrate().catch(err => {
  console.error('\nMigration failed:', err.message);
  process.exit(1);
});
