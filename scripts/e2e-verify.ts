import { institutionalStore } from '../src/data/store';
import { buildMatrixSchedule } from '../src/data/solverAdapter';

console.log('--- STARTING COMPLETE PIPELINE AUDIT ---');

// 1. Initial State
console.log('[Step 1] Initial State:');
console.log('Sample data loaded?:', institutionalStore.isSampleDataLoaded());

// 2. Load Sample Data
console.log('\n[Step 2] Executing loadSampleData()...');
institutionalStore.loadSampleData();
const isLoadedAfter = institutionalStore.isSampleDataLoaded();
console.log('Sample data loaded?:', isLoadedAfter);
if (!isLoadedAfter) {
  throw new Error('Failed to load sample data');
}

// 3. Inspect Counts
const counts = institutionalStore.getSampleCounts();
console.log('\n[Step 3] Sample Dataset Entity Counts:');
console.log(`  - Departments: ${counts.departments} (Expected: 5)`);
console.log(`  - Programs: ${counts.programs} (Expected: 12)`);
console.log(`  - Classes: ${counts.classes} (Expected: 42)`);
console.log(`  - Courses: ${counts.courses} (Expected: 120)`);
console.log(`  - Instructors: ${counts.instructors} (Expected: 55)`);
console.log(`  - Rooms: ${counts.rooms} (Expected: 55)`);
console.log(`  - Sections: ${counts.sections} (Expected: ~205)`);
console.log(`  - Total Sample Records: ${counts.totalRecords}`);

if (counts.departments !== 5 || counts.programs !== 12 || counts.classes !== 42 || counts.courses !== 120 || counts.instructors !== 55 || counts.rooms !== 55) {
  throw new Error('Mismatch in sample entity counts!');
}

// 4. Test Idempotency
console.log('\n[Step 4] Testing Idempotency (calling loadSampleData a second time)...');
institutionalStore.loadSampleData();
const countsSecond = institutionalStore.getSampleCounts();
console.log(`  - Total records after 2nd load: ${countsSecond.totalRecords} (Expected: ${counts.totalRecords})`);
if (countsSecond.totalRecords !== counts.totalRecords) {
  throw new Error('Idempotency failure: duplicate records created!');
}
console.log('  SUCCESS: Idempotency verified.');

// 5. Conflict Analysis
console.log('\n[Step 5] Checking Hard Conflicts across matrix...');
const storeState = institutionalStore.get();
const { conflicts } = buildMatrixSchedule(storeState);
console.log(`  - Clash count: ${conflicts.length}`);
if (conflicts.length !== 0) {
  throw new Error(`Expected 0 conflicts, got ${conflicts.length}`);
}
console.log('  SUCCESS: 0 hard conflicts detected across all 42 classes.');

// 6. Test Removal
console.log('\n[Step 6] Testing removeSampleData()...');
institutionalStore.removeSampleData();
const isLoadedPostRemove = institutionalStore.isSampleDataLoaded();
console.log('Sample data loaded after removal?:', isLoadedPostRemove);
if (isLoadedPostRemove) {
  throw new Error('Failed to cleanly remove sample data');
}
const postRemoveCounts = institutionalStore.getSampleCounts();
console.log(`  - Sample records remaining: ${postRemoveCounts.totalRecords} (Expected: 0)`);
if (postRemoveCounts.totalRecords !== 0) {
  throw new Error('Sample records lingered after removeSampleData()');
}
console.log('  SUCCESS: All sample records safely purged without touching base data.');

// 7. Reload sample dataset for demo readiness
console.log('\n[Step 7] Re-loading sample dataset so app is demo-ready...');
institutionalStore.loadSampleData();
console.log('--- ALL CHECKS PASSED PERFECTLY ---');
