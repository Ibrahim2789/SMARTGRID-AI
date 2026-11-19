import test from 'node:test';
import assert from 'node:assert/strict';

// Minimal storage stub so votingApi helpers never throw in Node
const memStorage = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => memStorage.get(k) ?? null,
  setItem: (k: string, v: string) => {
    memStorage.set(k, String(v));
  },
  removeItem: (k: string) => {
    memStorage.delete(k);
  },
  clear: () => memStorage.clear(),
  key: (i: number) => Array.from(memStorage.keys())[i] ?? null,
  get length() {
    return memStorage.size;
  }
};

import {
  buildErrorReportCsv,
  buildStorePayloadFromValidatedRows,
  CsvFormatError,
  detectImportColumnMappings,
  generateTemplateCsv,
  parseCsvTextStrict,
  validateImportPreviewLocal,
  ExistingStoreSnapshot
} from '../src/utils/csvImport';
import { institutionalStore } from '../src/data/store';

function makeSnapshot(): ExistingStoreSnapshot {
  return {
    departments: [
      { id: 'dept-cs', code: 'CS', name: 'Computer Science', school: 'Computing', colorHex: '#1E3A8A' }
    ],
    rooms: [
      {
        id: 'room-h101',
        buildingId: 'bld-1',
        code: 'HALL-101',
        name: 'Turing Hall',
        capacity: 60,
        type: 'lecture',
        equipment: ['Projector'],
        isAccessible: true,
        isAvailable: true
      },
      {
        id: 'lab-201',
        buildingId: 'bld-1',
        code: 'LAB-201',
        name: 'Computing Lab 1',
        capacity: 40,
        type: 'lab',
        equipment: ['Workstations'],
        isAccessible: true,
        isAvailable: true
      }
    ],
    courses: [
      {
        id: 'crs-cs101',
        departmentId: 'dept-cs',
        code: 'CS-101',
        title: 'Programming Fundamentals',
        creditHours: 4,
        lectureCredits: 3,
        labCredits: 1,
        lectureHours: 3,
        labHours: 3,
        weeklyContactHours: 6,
        requiredRoomType: 'lecture'
      }
    ],
    instructors: [
      {
        id: 'inst-sarah',
        departmentId: 'dept-cs',
        name: 'Dr. Sarah Chen',
        email: 'sarah.chen@uni.edu',
        title: 'Associate Professor',
        staffRole: 'faculty',
        maxWeeklyHours: 14,
        maxConsecutiveHours: 3,
        preferredDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        unavailableSlots: []
      }
    ],
    studentGroups: [
      {
        id: 'grp-24a',
        programId: 'prog-cs',
        code: '2K24-CS-A',
        name: '2K24 CS A',
        year: 2,
        semester: 3,
        size: 45,
        sharedCourseIds: []
      }
    ],
    sections: []
  };
}

test('template generator produces valid parseable CSV for every category', () => {
  const categories = [
    'departments',
    'rooms',
    'laboratories',
    'instructors',
    'courses',
    'cohorts',
    'enrollments',
    'course_assignments',
    'all'
  ] as const;

  for (const cat of categories) {
    const csvText = generateTemplateCsv(cat);
    const parsed = parseCsvTextStrict(csvText);
    assert.ok(parsed.headers.length >= 3, `${cat} template should have >= 3 columns`);
    assert.ok(parsed.rows.length >= 1, `${cat} template should have sample rows`);
  }
});

test('strict CSV parser rejects empty, header-only, binary, and unclosed-quote files', () => {
  assert.throws(() => parseCsvTextStrict('   \n '), CsvFormatError);
  assert.throws(() => parseCsvTextStrict('code,title\n'), CsvFormatError);
  assert.throws(() => parseCsvTextStrict('code,title\nCS-1\u0000,Intro\n'), CsvFormatError);
  assert.throws(() => parseCsvTextStrict('code,title\nCS-1,"Broken quote\n'), CsvFormatError);
});

test('column detection maps unfamiliar synonyms and blocks conflicting or missing required mappings', () => {
  const syn = detectImportColumnMappings(
    ['Subject Code', 'Subject Name', 'Dept', 'Teacher Name'],
    'courses'
  );
  assert.equal(syn.mapping['Subject Code'], 'code');
  assert.equal(syn.mapping['Subject Name'], 'title');
  assert.equal(syn.mapping['Dept'], 'departmentCode');
  assert.equal(syn.missingRequiredFields.length, 0);

  const conflictReport = validateImportPreviewLocal({
    category: 'courses',
    duplicateMode: 'skip',
    headers: ['Col A', 'Col B', 'Col C'],
    rows: [['CS-201', 'Algorithms', 'CS']],
    columnMappings: { 'Col A': 'code', 'Col B': 'code', 'Col C': 'departmentCode' },
    storeSnapshot: makeSnapshot()
  });
  assert.equal(conflictReport.canProceed, false);
  assert.ok(conflictReport.blockingReason?.includes('Conflicting mappings'));
});

test('validation handles skip, update (with diffs), stop modes, types, FKs, and preserves headers in Error CSV', () => {
  const csv = [
    'Course Key,Course Label,Department,Credits,Active Flag',
    'CS-101,Prog Fundamentals Updated,CS,3,yes',
    'CS-202,Algorithms,MISSING_DEPT,0,maybe',
    'CS-303,Operating Systems,CS,3,yes'
  ].join('\n');

  const parsed = parseCsvTextStrict(csv);
  const manual = {
    'Course Key': 'code',
    'Course Label': 'title',
    Department: 'departmentCode',
    Credits: 'creditHours',
    'Active Flag': 'isElective'
  };

  // Update mode builds diffs and detects errors cleanly
  const updateReport = validateImportPreviewLocal({
    category: 'courses',
    duplicateMode: 'update',
    headers: parsed.headers,
    rows: parsed.rows,
    columnMappings: manual,
    storeSnapshot: makeSnapshot()
  });
  assert.equal(updateReport.summary.updateCount, 1);
  assert.equal(updateReport.summary.createCount, 1);
  assert.equal(updateReport.summary.errorRows, 1);
  assert.equal(updateReport.fieldDiffs.length, 1);
  assert.equal(updateReport.fieldDiffs[0].identifier, 'CS-101');

  // Stop mode blocks entire import
  const stopReport = validateImportPreviewLocal({
    category: 'courses',
    duplicateMode: 'stop',
    headers: parsed.headers,
    rows: parsed.rows,
    columnMappings: manual,
    storeSnapshot: makeSnapshot()
  });
  assert.equal(stopReport.canProceed, false);

  // Error CSV preserves original CSV column headers
  const errCsv = buildErrorReportCsv(updateReport.headers, updateReport.rows);
  const errParsed = parseCsvTextStrict(errCsv);
  assert.deepEqual(errParsed.headers, [
    'row_number',
    'status',
    'error_columns',
    'problem',
    'suggested_correction',
    'Course Key',
    'Course Label',
    'Department',
    'Credits',
    'Active Flag'
  ]);
  assert.equal(errParsed.rows.length, 1);
  assert.equal(errParsed.rows[0][5], 'CS-202');
});

test('institutionalStore.importBulkCatalogData applies skip/update modes, email instructor matching & history', () => {
  institutionalStore.importBulkCatalogData({
    departments: [{ code: 'CS', name: 'Computer Science', school: 'Computing' }],
    duplicateMode: 'skip',
    skipSync: true
  });
  const snap = institutionalStore.get();
  const beforeCount = snap.instructors.length;
  const deptCode = 'CS';
  const csv = `name,email,department_code,staff_role,max_weekly_hours\nDr. Ada Lovelace,ada@smartgrid.edu,${deptCode},faculty,12\n`;
  const parsed = parseCsvTextStrict(csv);
  const detected = detectImportColumnMappings(parsed.headers, 'instructors');
  const report = validateImportPreviewLocal({
    category: 'instructors',
    duplicateMode: 'skip',
    headers: parsed.headers,
    rows: parsed.rows,
    columnMappings: detected.mapping,
    storeSnapshot: {
      departments: snap.departments,
      rooms: snap.rooms,
      courses: snap.courses,
      instructors: snap.instructors,
      studentGroups: snap.studentGroups,
      sections: snap.sections
    }
  });
  assert.equal(report.canProceed, true, JSON.stringify(report.rows[0]?.errors));
  const payload = buildStorePayloadFromValidatedRows(report);
  const res = institutionalStore.importBulkCatalogData({
    ...payload,
    duplicateMode: 'skip',
    skipSync: true
  });
  assert.equal(res.created, 1);
  assert.equal(institutionalStore.get().instructors.length, beforeCount + 1);

  // Skip mode second run does not duplicate by email
  const resSkip = institutionalStore.importBulkCatalogData({
    ...payload,
    duplicateMode: 'skip',
    skipSync: true
  });
  assert.equal(resSkip.skipped, 1);
  assert.equal(institutionalStore.get().instructors.length, beforeCount + 1);

  const hist = institutionalStore.recordImportHistory({
    userName: 'QA Admin',
    userEmail: 'admin@smartgrid.edu',
    category: 'instructors',
    fileName: 'instructors.csv',
    duplicateMode: 'skip',
    status: 'completed',
    totalRows: 1,
    createdCount: 1,
    updatedCount: 0,
    skippedCount: 0,
    failedCount: 0,
    durationMs: 12
  });
  assert.equal(hist.fileName, 'instructors.csv');
  assert.ok((institutionalStore.get().importHistory || []).some(h => h.id === hist.id));
});

test('ExcelJS .xlsx workbook passes through exact same column mapping and validation pipeline', async () => {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Courses');
  ws.addRow(['Subject Code', 'Subject Name', 'Department Code', 'Lecture Credits', 'Lab Credits']);
  ws.addRow(['CS-450', 'Compiler Construction', 'CS', 3, 1]);
  ws.addRow(['CS-451', 'Bad Dept Course', 'MISSING_DEPT', 3, 0]);
  const buf = await wb.xlsx.writeBuffer();

  const wbRead = new ExcelJS.Workbook();
  await wbRead.xlsx.load(buf);
  const sheet = wbRead.getWorksheet('Courses')!;
  const matrix: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, row => {
    const vals = row.values;
    if (Array.isArray(vals)) {
      matrix.push(vals.slice(1).map(v => String(v ?? '').trim()));
    }
  });
  const headers = matrix[0];
  const rows = matrix.slice(1);

  const detected = detectImportColumnMappings(headers, 'courses');
  assert.equal(detected.mapping['Subject Code'], 'code');
  assert.equal(detected.mapping['Subject Name'], 'title');

  const report = validateImportPreviewLocal({
    category: 'courses',
    duplicateMode: 'skip',
    headers,
    rows,
    columnMappings: detected.mapping,
    storeSnapshot: makeSnapshot()
  });
  assert.equal(report.summary.totalRows, 2);
  assert.equal(report.summary.validRows, 1);
  assert.equal(report.summary.errorRows, 1);
  assert.equal(report.summary.invalidFkCount, 1);
});

test('DataImportWizard React component renders five-stage UI without runtime errors', async () => {
  const React = (await import('react')).default;
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { DataImportWizard } = await import('../src/components/DataImportWizard');

  const html = renderToStaticMarkup(
    React.createElement(DataImportWizard, { defaultCategory: 'courses' })
  );
  assert.ok(html.includes('Academic CSV Data Import'));
  assert.ok(html.includes('Choose Academic Data Category'));
  assert.ok(html.includes('Import History'));
  assert.ok(html.includes('Course Assignments'));
});

