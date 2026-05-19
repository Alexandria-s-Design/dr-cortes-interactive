/**
 * Data Integrity Validation for Dr. Cortés Timeline
 * Validates timeline-data.json against authoritative chronology
 */

const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'docs', 'assets', 'data', 'timeline-data.json');

// Blacklisted terms — items that were removed as fabricated/unconfirmed
const BLACKLIST = [
  'Diversity Graduation Requirement',
  '48 states',
  'Discovery Channel',
  'Philadelphia',
  'Creating America',
  'Cruise Ship',
  'Knowledge Construction and Popular Culture',
  // 'How the Media Teach' excluded — appears legitimately in book title "The Children Are Watching: How the Media Teach about Diversity"
  'Major Studio Consulting',
  'Intercultural Humor',
  'Civic Engagement as Multicultural',
  '90th Birthday',
  'UCR Special Collections',
  'Teaching Diversity Workshop',
  'Chicanas and Chicanos in Contemporary Society',
  'Teaching for Diversity and Social Justice',
  'PBS Diversity Programming Consultant',
  'National Diversity Training Program',
  'National Diversity Consulting Practice',
  'Hispanics in the United States: An Anthology',
  'Understanding You and Them',
];

// Expected entry counts per decade
const EXPECTED_COUNTS = {
  '1950s': 7,
  '1960s': 6,
  '1970s': 12,
  '1980s': 12,
  '1990s': 12,
  '2000s': 12,
  '2010s': 12,
  '2020s': 13,
};

// Date corrections that must be verified
const DATE_CHECKS = [
  { search: 'Panunzio', expectedYear: '2021' },
  { search: 'Cheech', expectedYear: '2021' },
  { search: 'Puss in Boots', expectedYear: '2024' },
  { search: "Scouts' Honor", expectedYear: '2025' },
  { search: 'Why in the World', expectedDecade: '1980s' },
  { search: 'Media & Values', expectedDecade: '1980s' },
  { search: 'Houghton Mifflin', expectedDecade: '2000s' },
  // "Conversation with Alana" correctly appears in 2000s (first performance) AND 2020s (published book)
  { search: 'American Diversity Report', expectedDecade: '2010s' },
];

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  PASS: ${message}`);
  } else {
    failed++;
    failures.push(message);
    console.log(`  FAIL: ${message}`);
  }
}

function run() {
  console.log('=== Dr. Cortés Timeline Data Validation ===\n');

  // 1. Load and parse JSON
  console.log('1. JSON Schema Validation');
  let data;
  try {
    const raw = fs.readFileSync(DATA_PATH, 'utf-8');
    data = JSON.parse(raw);
    assert(true, 'JSON parses successfully');
  } catch (e) {
    assert(false, `JSON parse failed: ${e.message}`);
    process.exit(1);
  }

  assert(data.biography !== undefined, 'biography section exists');
  assert(data.decades !== undefined, 'decades section exists');
  assert(Object.keys(data.decades).length === 8, `8 decades present (got ${Object.keys(data.decades).length})`);

  // 2. Entry count verification
  console.log('\n2. Entry Count Verification');
  let totalEntries = 0;
  for (const [decade, expected] of Object.entries(EXPECTED_COUNTS)) {
    const decadeData = data.decades[decade];
    assert(decadeData !== undefined, `${decade} decade exists`);
    if (decadeData) {
      const count = decadeData.entries ? decadeData.entries.length : 0;
      totalEntries += count;
      assert(count === expected, `${decade} has ${expected} entries (got ${count})`);
    }
  }
  assert(totalEntries === 86, `Total entries = 86 (got ${totalEntries})`);

  // 3. Zero fabrication check (blacklist)
  console.log('\n3. Zero Fabrication Check (Blacklist)');
  const jsonStr = JSON.stringify(data);
  for (const term of BLACKLIST) {
    const found = jsonStr.includes(term);
    assert(!found, `No mention of "${term}"`);
  }

  // 4. Date accuracy assertions
  console.log('\n4. Date Accuracy Checks');
  const allEntries = [];
  for (const [decade, decadeData] of Object.entries(data.decades)) {
    if (decadeData.entries) {
      for (const entry of decadeData.entries) {
        allEntries.push({ ...entry, decade });
      }
    }
  }

  for (const check of DATE_CHECKS) {
    const matching = allEntries.filter(e => e.title.includes(check.search) || (e.description || '').includes(check.search));
    if (matching.length === 0) {
      assert(false, `Entry containing "${check.search}" not found`);
      continue;
    }
    for (const entry of matching) {
      if (check.expectedYear) {
        assert(entry.year.toString().includes(check.expectedYear),
          `"${check.search}" year contains ${check.expectedYear} (got ${entry.year})`);
      }
      if (check.expectedDecade) {
        assert(entry.decade === check.expectedDecade,
          `"${check.search}" in ${check.expectedDecade} (found in ${entry.decade})`);
      }
    }
  }

  // 5. Description quality check
  console.log('\n5. Description Quality Check');
  for (const entry of allEntries) {
    assert(entry.description && entry.description.length > 0,
      `"${entry.title}" has non-empty description`);

    // Check description not too long (< 500 chars)
    assert((entry.description || '').length <= 500,
      `"${entry.title}" description <= 500 chars (got ${entry.description.length})`);
  }

  // 6. No duplicate titles within a decade
  console.log('\n6. Duplicate Check');
  for (const [decade, decadeData] of Object.entries(data.decades)) {
    if (decadeData.entries) {
      const titles = decadeData.entries.map(e => e.title);
      const uniqueTitles = new Set(titles);
      assert(titles.length === uniqueTitles.size,
        `${decade}: no duplicate titles`);
    }
  }

  // 7. Year format validation
  console.log('\n7. Year Format Validation');
  for (const entry of allEntries) {
    const yearStr = entry.year.toString();
    const validFormat = /^\d{4}(-\d{4})?$/.test(yearStr);
    assert(validFormat, `"${entry.title}" year format valid: "${yearStr}"`);
  }

  // 8. Biography checks
  console.log('\n8. Biography Validation');
  const bio = data.biography;
  assert(bio.birthYear === 1934, 'Birth year is 1934');
  assert(bio.careerStart === 1955, 'Career start is 1955');

  // Check Panunzio year in awards
  const panunzio = bio.awards.find(a => a.award.includes('Panunzio'));
  assert(panunzio && panunzio.year === 2021, 'Panunzio award year is 2021');

  // Check no "from Philadelphia" in bio
  assert(!bio.bio.includes('Philadelphia'), 'Bio does not mention Philadelphia');
  assert(!bio.personal_background.includes('Philadelphia'), 'Personal background does not mention Philadelphia');

  // Check no "90th birthday" in highlights
  const has90th = bio.timeline_highlights.some(h => h.event.includes('90th birthday'));
  assert(!has90th, 'No "90th birthday" in timeline highlights');

  // Check no "drafted first diversity requirement" in highlights
  const hasDraftDiv = bio.timeline_highlights.some(h => h.event.includes('diversity requirement') || h.event.includes('diversity graduation'));
  assert(!hasDraftDiv, 'No "diversity requirement" in timeline highlights');

  // Summary
  console.log('\n=== RESULTS ===');
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  if (failures.length > 0) {
    console.log('\nFailures:');
    failures.forEach(f => console.log(`  - ${f}`));
  }
  console.log(`\nTotal: ${passed + failed} checks, ${failed === 0 ? '100% PASS' : `${failed} FAILURES`}`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
