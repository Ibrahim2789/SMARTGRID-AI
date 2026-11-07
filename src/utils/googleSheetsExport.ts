import ExcelJS from 'exceljs';
import { InstitutionalDataStore } from '../data/store';
import { ClassItem } from '../components/ClassDetailsModal';
import {
  UNIVERSITY_SLOTS,
  StudentGroup,
  getLabBlockByStartPeriod
} from '../types/institutional';

const PASTEL_EXPORT_PALETTE = [
  { argb: 'FFB8EEEE', borderArgb: 'FF88D4D4', name: 'Cyan' },
  { argb: 'FFF2D8FA', borderArgb: 'FFD5B2E3', name: 'Lavender' },
  { argb: 'FFB8F2E6', borderArgb: 'FF8BD6C5', name: 'Mint' },
  { argb: 'FFB7F77C', borderArgb: 'FF92DB52', name: 'Lime' },
  { argb: 'FFE8D36B', borderArgb: 'FFCDB548', name: 'Mustard' }
];

function getCourseArgb(code: string) {
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    hash = (hash * 31 + code.charCodeAt(i)) >>> 0;
  }
  return PASTEL_EXPORT_PALETTE[hash % PASTEL_EXPORT_PALETTE.length];
}

function sanitizeWorksheetName(rawName: string, usedNames: Set<string>): string {
  // Remove invalid Excel/Google Sheets characters: \ / ? * : [ ]
  const cleaned = rawName.replace(/[\\/?*:[\]]/g, '').trim() || 'Class Section';
  let candidate = cleaned.slice(0, 31);
  let counter = 2;
  while (usedNames.has(candidate.toLowerCase())) {
    const suffix = ` (${counter})`;
    candidate = `${cleaned.slice(0, 31 - suffix.length)}${suffix}`;
    counter++;
  }
  usedNames.add(candidate.toLowerCase());
  return candidate;
}

const DAY_FULL_LABELS: Record<string, string> = {
  Mon: 'Monday',
  Tue: 'Tuesday',
  Wed: 'Wednesday',
  Thu: 'Thursday',
  Fri: 'Friday',
  Sat: 'Saturday',
  Sun: 'Sunday'
};

export interface GoogleSheetsExportResult {
  fileName: string;
  classSheetCount: number;
  totalSessionsCount: number;
}

function populateWeeklyGridOnWorksheet(params: {
  worksheet: ExcelJS.Worksheet;
  days: string[];
  scheduleData: Record<string, Record<string, ClassItem[]>>;
  itemPredicate: (cls: ClassItem) => boolean;
  isSingleClassSheet: boolean;
}) {
  const { worksheet, days, scheduleData, itemPredicate, isSingleClassSheet } = params;
  const totalCols = days.length + 1;

  // Table Header Row (Time / Slot + Days)
  const headerValues = [
    'TIME SLOT & SESSION',
    ...days.map(d => {
      const base = (DAY_FULL_LABELS[d] || d).toUpperCase();
      return d === 'Fri' ? `${base} (FRI SHIFT 14:30)` : base;
    })
  ];
  const headerRow = worksheet.addRow(headerValues);
  headerRow.height = 28;
  headerRow.eachCell((cell, colNumber) => {
    cell.font = {
      name: 'Arial',
      size: 10,
      bold: true,
      color: { argb: 'FFFFFFFF' }
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF292929' }
    };
    cell.alignment = {
      vertical: 'middle',
      horizontal: colNumber === 1 ? 'left' : 'center',
      indent: colNumber === 1 ? 1 : 0
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF171717' } },
      bottom: { style: 'medium', color: { argb: 'FF171717' } },
      left: { style: 'thin', color: { argb: 'FF3E3E3E' } },
      right: { style: 'thin', color: { argb: 'FF3E3E3E' } }
    };
  });

  // Track which (slotNumber, dayIndex) cells are covered by a 3-hour Lab vertical merge
  const coveredByMerge = new Set<string>();
  const pendingLabMerges: Array<{
    startRowNumber: number;
    endRowNumber: number;
    colNumber: number;
    cls: ClassItem;
  }> = [];

  const renderSlotRow = (slotMeta: (typeof UNIVERSITY_SLOTS)[number]) => {
    const friNote =
      slotMeta.slotNumber === 5
        ? '\n(Fri: 2:30 – 3:15 PM)'
        : slotMeta.slotNumber === 6
        ? '\n(Fri: 3:20 – 4:05 PM)'
        : slotMeta.slotNumber === 7
        ? '\n(Fri: 4:10 – 4:55 PM)'
        : '';
    const rowLabel = `Slot ${slotMeta.slotNumber} (${slotMeta.session})\n${slotMeta.period}${friNote}\nShort Break: ${slotMeta.shortBreak}`;
    const row = worksheet.addRow([rowLabel]);
    const currentRowNum = row.number;
    row.height = 68;

    // Style Time Column (Col 1)
    const timeCell = row.getCell(1);
    timeCell.font = {
      name: 'Arial',
      size: 9.5,
      bold: true,
      color: { argb: 'FF171717' }
    };
    timeCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF7F6EF' }
    };
    timeCell.alignment = {
      vertical: 'middle',
      horizontal: 'left',
      wrapText: true,
      indent: 1
    };
    timeCell.border = {
      top: { style: 'thin', color: { argb: 'FFE4E2DA' } },
      bottom: { style: 'thin', color: { argb: 'FFE4E2DA' } },
      left: { style: 'thin', color: { argb: 'FFE4E2DA' } },
      right: { style: 'medium', color: { argb: 'FFD4D1C7' } }
    };

    // Populate Day Columns
    days.forEach((day, dIdx) => {
      const colNum = dIdx + 2;
      const cell = row.getCell(colNum);

      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE4E2DA' } },
        bottom: { style: 'thin', color: { argb: 'FFE4E2DA' } },
        left: { style: 'thin', color: { argb: 'FFE4E2DA' } },
        right: { style: 'thin', color: { argb: 'FFE4E2DA' } }
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFFFFF' }
      };

      if (coveredByMerge.has(`${slotMeta.slotNumber}_${dIdx}`)) {
        return;
      }

      const cellClasses = (scheduleData[slotMeta.period]?.[day] || []).filter(itemPredicate);

      if (cellClasses.length === 0) {
        cell.value = '';
        return;
      }

      // Prioritize a 3-hour continuous Lab if one starts in this slot
      const labItem = cellClasses.find(c => c.sessionType === 'Lab' || c.spanSlots === 3);
      if (labItem && slotMeta.slotNumber <= 5) {
        coveredByMerge.add(`${slotMeta.slotNumber + 1}_${dIdx}`);
        coveredByMerge.add(`${slotMeta.slotNumber + 2}_${dIdx}`);

        const labBlock = getLabBlockByStartPeriod(slotMeta.period);
        const continuousWindow =
          labItem.continuousTimeLabel ||
          labBlock?.continuousLabel ||
          (day === 'Fri' && slotMeta.slotNumber === 5 ? '2:30 PM – 4:55 PM' : '3 Hours Continuous');

        const otherLecturesCount = cellClasses.length - 1;
        const extraNote = !isSingleClassSheet && otherLecturesCount > 0 ? `\n(+${otherLecturesCount} other section)` : '';
        const cohortTag = isSingleClassSheet ? '' : ` · Class: ${labItem.cohort}`;

        cell.value = `${labItem.title} (${labItem.code})\n[LAB · 3 HOURS CONTINUOUS]\n${continuousWindow} (180 mins · No Internal Breaks)\nInstructor: ${labItem.prof}\nLaboratory: ${labItem.room}${cohortTag}${extraNote}`;

        const pastel = getCourseArgb(labItem.code);
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: pastel.argb }
        };
        cell.font = {
          name: 'Arial',
          size: 9.5,
          bold: true,
          color: { argb: 'FF171717' }
        };
        cell.alignment = {
          vertical: 'middle',
          horizontal: 'center',
          wrapText: true
        };

        pendingLabMerges.push({
          startRowNumber: currentRowNum,
          endRowNumber: currentRowNum + 2,
          colNumber: colNum,
          cls: labItem
        });
      } else {
        const primary = cellClasses[0];
        const pastel = getCourseArgb(primary.code);
        const timeText =
          day === 'Fri' && slotMeta.slotNumber === 5
            ? '2:30 – 3:15 PM'
            : day === 'Fri' && slotMeta.slotNumber === 6
            ? '3:20 – 4:05 PM'
            : day === 'Fri' && slotMeta.slotNumber === 7
            ? '4:10 – 4:55 PM'
            : slotMeta.period;

        if (isSingleClassSheet || cellClasses.length === 1) {
          const cohortSuffix = isSingleClassSheet ? '' : ` · Class: ${primary.cohort}`;
          cell.value = `${primary.title} (${primary.code})\n[LECTURE · 50 MINS] ${timeText}\nInstructor: ${primary.prof}\nRoom: ${primary.room}${cohortSuffix}`;
        } else {
          const summaryLines = cellClasses.slice(0, 3).map(
            c => `[${c.cohort}] ${c.title} (${c.code})\n${c.prof} · ${c.room}`
          );
          if (cellClasses.length > 3) {
            summaryLines.push(`+${cellClasses.length - 3} more class sections`);
          }
          cell.value = summaryLines.join('\n────────────\n');
        }

        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: pastel.argb }
        };
        cell.font = {
          name: 'Arial',
          size: 9,
          bold: isSingleClassSheet,
          color: { argb: 'FF171717' }
        };
        cell.alignment = {
          vertical: 'middle',
          horizontal: 'left',
          wrapText: true,
          indent: 1
        };
      }
    });
  };

  // Render Morning Session (Slots 1..4: 9:00 AM – 1:00 PM)
  UNIVERSITY_SLOTS.filter(s => s.session === 'Morning').forEach(slotMeta => {
    renderSlotRow(slotMeta);
  });

  // Render Prominent Fixed University Lunch & Prayer Break Row (1:00 PM – 2:00 PM)
  const lunchRow = worksheet.addRow([
    '1:00 PM – 2:00 PM\nLUNCH & PRAYER BREAK',
    'FIXED UNIVERSITY LUNCH & PRAYER BREAK (1:00 PM – 2:00 PM) — NO LECTURES OR LABS SCHEDULED'
  ]);
  const lunchRowNum = lunchRow.number;
  worksheet.mergeCells(lunchRowNum, 2, lunchRowNum, totalCols);
  lunchRow.height = 36;

  const lunchTimeCell = lunchRow.getCell(1);
  lunchTimeCell.font = {
    name: 'Arial',
    size: 9.5,
    bold: true,
    color: { argb: 'FF171717' }
  };
  lunchTimeCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE8D36B' }
  };
  lunchTimeCell.alignment = {
    vertical: 'middle',
    horizontal: 'left',
    wrapText: true,
    indent: 1
  };
  lunchTimeCell.border = {
    top: { style: 'medium', color: { argb: 'FF171717' } },
    bottom: { style: 'medium', color: { argb: 'FF171717' } },
    left: { style: 'thin', color: { argb: 'FF171717' } },
    right: { style: 'medium', color: { argb: 'FF171717' } }
  };

  for (let c = 2; c <= totalCols; c++) {
    const cell = lunchRow.getCell(c);
    cell.font = {
      name: 'Arial',
      size: 10,
      bold: true,
      color: { argb: 'FF171717' }
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFEDEAE0' }
    };
    cell.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: true
    };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF171717' } },
      bottom: { style: 'medium', color: { argb: 'FF171717' } },
      left: { style: 'thin', color: { argb: 'FFD4D1C7' } },
      right: { style: 'thin', color: { argb: 'FFD4D1C7' } }
    };
  }

  // Render Afternoon Session (Slots 5..7: 2:00 PM – 5:00 PM)
  UNIVERSITY_SLOTS.filter(s => s.session === 'Afternoon').forEach(slotMeta => {
    renderSlotRow(slotMeta);
  });

  // Execute all vertical merges for 3-hour Continuous Labs
  pendingLabMerges.forEach(mergeItem => {
    worksheet.mergeCells(
      mergeItem.startRowNumber,
      mergeItem.colNumber,
      mergeItem.endRowNumber,
      mergeItem.colNumber
    );
    const pastel = getCourseArgb(mergeItem.cls.code);
    for (let r = mergeItem.startRowNumber; r <= mergeItem.endRowNumber; r++) {
      const mergedCell = worksheet.getRow(r).getCell(mergeItem.colNumber);
      mergedCell.border = {
        top: { style: 'medium', color: { argb: pastel.borderArgb } },
        bottom: { style: 'medium', color: { argb: pastel.borderArgb } },
        left: { style: 'medium', color: { argb: pastel.borderArgb } },
        right: { style: 'medium', color: { argb: pastel.borderArgb } }
      };
    }
  });
}

export async function exportTimetableToGoogleSheetsWorkbook(params: {
  store: InstitutionalDataStore;
  scheduleData: Record<string, Record<string, ClassItem[]>>;
  filterClass: (cls: ClassItem) => boolean;
  scope: 'filtered' | 'all';
  scopeLabel: string;
  studentOrUserName?: string;
}): Promise<GoogleSheetsExportResult> {
  const { store, scheduleData, filterClass, scope, scopeLabel } = params;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SmartGrid AI — University Scheduling Platform';
  workbook.created = new Date();
  workbook.modified = new Date();

  const activeTerm = store.terms.find(t => t.status === 'active') || store.terms[0];
  const termName = activeTerm?.name || 'Fall Semester 2026';
  const institutionName = store.institutionProfile?.name || 'University of Engineering & Computing';
  const days = store.timeStructure.workingDays.length > 0
    ? store.timeStructure.workingDays
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

  const usedSheetNames = new Set<string>();

  // Collect all scheduled items
  const allScheduledItems: ClassItem[] = [];
  days.forEach(day => {
    UNIVERSITY_SLOTS.forEach(slotMeta => {
      const cellItems = (scheduleData[slotMeta.period]?.[day] || []).filter(
        cls => scope === 'all' || filterClass(cls)
      );
      cellItems.forEach(item => {
        allScheduledItems.push(item);
      });
    });
  });

  // ============================================================================
  // WORKSHEET 1: WEEKLY OVERVIEW (MASTER UNIVERSITY TIMETABLE)
  // ============================================================================
  const overviewTitle = sanitizeWorksheetName('Weekly Overview', usedSheetNames);
  const overviewSheet = workbook.addWorksheet(overviewTitle, {
    views: [{ state: 'frozen', xSplit: 1, ySplit: 5 }],
    pageSetup: {
      paperSize: 9,
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1
    }
  });

  overviewSheet.columns = [
    { key: 'slotCol', width: 30 },
    ...days.map((d, idx) => ({ key: `day_${idx}`, width: 34 }))
  ];

  const totalCols = days.length + 1;

  // Row 1: Main Title Banner
  const titleRow = overviewSheet.addRow([
    `${institutionName.toUpperCase()} — WEEKLY UNIVERSITY TIMETABLE OVERVIEW`
  ]);
  overviewSheet.mergeCells(1, 1, 1, totalCols);
  titleRow.height = 32;
  titleRow.getCell(1).font = {
    name: 'Arial',
    size: 14,
    bold: true,
    color: { argb: 'FFFFFFFF' }
  };
  titleRow.getCell(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF171717' }
  };
  titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

  // Row 2: Subtitle / Academic Metadata
  const metaRow = overviewSheet.addRow([
    `Semester: ${termName}   |   Scope: ${scopeLabel.replace(/_/g, ' ')}   |   University Hours: 9:00 AM – 5:00 PM (Lunch & Prayer Break: 1:00 PM – 2:00 PM)`
  ]);
  overviewSheet.mergeCells(2, 1, 2, totalCols);
  metaRow.height = 22;
  metaRow.getCell(1).font = {
    name: 'Arial',
    size: 10,
    bold: false,
    color: { argb: 'FF171717' }
  };
  metaRow.getCell(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFEDEAE0' }
  };
  metaRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

  // Row 3: Session Rules Legend Bar
  const rulesRow = overviewSheet.addRow([
    'University Rules:  • Regular Lecture = 50 mins + 10m Short Break   • Laboratory = 3 Hours Continuous (vertically merged across 3 slots)   • Individual Class/Section Timetables follow in separate worksheets'
  ]);
  overviewSheet.mergeCells(3, 1, 3, totalCols);
  rulesRow.height = 20;
  rulesRow.getCell(1).font = {
    name: 'Arial',
    size: 9,
    italic: true,
    color: { argb: 'FF57564F' }
  };
  rulesRow.getCell(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF7F6EF' }
  };
  rulesRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

  // Row 4: Spacer
  const spacerRow = overviewSheet.addRow([]);
  spacerRow.height = 8;

  // Populate Weekly Grid on Worksheet 1
  populateWeeklyGridOnWorksheet({
    worksheet: overviewSheet,
    days,
    scheduleData,
    itemPredicate: cls => scope === 'all' || filterClass(cls),
    isSingleClassSheet: false
  });

  // ============================================================================
  // WORKSHEETS 2..N: ONE SEPARATE WORKSHEET FOR EACH CLASS / SECTION (StudentGroup)
  // ============================================================================
  // Determine which classes/sections to include:
  // Always include every StudentGroup that has at least 1 scheduled session in scope (or all studentGroups if scope === 'all')
  const groupsToExport: StudentGroup[] = store.studentGroups.filter(grp => {
    const hasSessionsInScope = allScheduledItems.some(item => item.studentGroupId === grp.id);
    if (scope === 'all') {
      const hasAnySessions = store.sections.some(s => s.studentGroupId === grp.id && s.assignedSlot);
      return hasAnySessions || hasSessionsInScope;
    }
    return hasSessionsInScope;
  });

  // Fallback: if filtering narrowed to 0 groups, export all groups with scheduled sessions
  const finalGroups =
    groupsToExport.length > 0
      ? groupsToExport
      : store.studentGroups.filter(grp => store.sections.some(s => s.studentGroupId === grp.id && s.assignedSlot));

  finalGroups.forEach(group => {
    const prog = store.programs.find(p => p.id === group.programId);
    const dept = store.departments.find(d => d.id === prog?.departmentId);

    // Tab Name: e.g. "2K24-BEE-A" or "BSCS - Section A" (<= 31 chars)
    const sheetName = sanitizeWorksheetName(group.code, usedSheetNames);
    const classSheet = workbook.addWorksheet(sheetName, {
      views: [{ state: 'frozen', xSplit: 1, ySplit: 5 }],
      pageSetup: {
        paperSize: 9,
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 1
      }
    });

    classSheet.columns = [
      { key: 'slotCol', width: 30 },
      ...days.map((d, idx) => ({ key: `day_${idx}`, width: 34 }))
    ];

    // Row 1: Class / Section Banner
    const classBanner = classSheet.addRow([
      `CLASS / SECTION TIMETABLE: ${group.code} — ${group.name.toUpperCase()}`
    ]);
    classSheet.mergeCells(1, 1, 1, totalCols);
    classBanner.height = 30;
    classBanner.getCell(1).font = {
      name: 'Arial',
      size: 13,
      bold: true,
      color: { argb: 'FFFFFFFF' }
    };
    classBanner.getCell(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF171717' }
    };
    classBanner.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

    // Row 2: Class / Section Metadata Bar
    const classMeta = classSheet.addRow([
      `Department: ${dept?.name || 'Engineering & Computing'} (${dept?.code || prog?.code || ''})   |   Semester: ${
        group.semester ? `Semester ${group.semester}` : `Year ${group.year}`
      }   |   Section: ${group.section || group.code}   |   Home Room: ${
        group.homeRoom || 'Designated Classroom'
      }   |   Term: ${termName}`
    ]);
    classSheet.mergeCells(2, 1, 2, totalCols);
    classMeta.height = 22;
    classMeta.getCell(1).font = {
      name: 'Arial',
      size: 10,
      bold: true,
      color: { argb: 'FF171717' }
    };
    classMeta.getCell(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFB8EEEE' }
    };
    classMeta.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

    // Row 3: Operating Hours & Lab Rule Note
    const classRules = classSheet.addRow([
      'Morning Session: 9:00 AM – 1:00 PM (Slots 1–4)   •   Fixed Lunch & Prayer Break: 1:00 PM – 2:00 PM   •   Afternoon Session: 2:00 PM – 5:00 PM (Fri Afternoon: 2:30 PM – 4:55 PM)   •   3-Hour Labs Merged Vertically'
    ]);
    classSheet.mergeCells(3, 1, 3, totalCols);
    classRules.height = 19;
    classRules.getCell(1).font = {
      name: 'Arial',
      size: 9,
      italic: true,
      color: { argb: 'FF57564F' }
    };
    classRules.getCell(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF7F6EF' }
    };
    classRules.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

    // Row 4: Spacer
    const classSpacer = classSheet.addRow([]);
    classSpacer.height = 8;

    // Populate this Class/Section's complete Weekly Timetable Grid (with vertically merged 3-hour labs!)
    populateWeeklyGridOnWorksheet({
      worksheet: classSheet,
      days,
      scheduleData,
      itemPredicate: cls => cls.studentGroupId === group.id,
      isSingleClassSheet: true
    });

    // Add a clean Course & Faculty Summary Table below the weekly grid for this Class/Section
    classSheet.addRow([]);
    const summaryHeaderBanner = classSheet.addRow([
      `ASSIGNED COURSES, INSTRUCTORS & LABORATORIES FOR ${group.code}`
    ]);
    classSheet.mergeCells(summaryHeaderBanner.number, 1, summaryHeaderBanner.number, totalCols);
    summaryHeaderBanner.height = 24;
    summaryHeaderBanner.getCell(1).font = {
      name: 'Arial',
      size: 10,
      bold: true,
      color: { argb: 'FF171717' }
    };
    summaryHeaderBanner.getCell(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFEDEAE0' }
    };
    summaryHeaderBanner.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

    const summaryColRow = classSheet.addRow([
      'Course Code',
      'Course Name',
      'Session Type & Duration',
      'Day & Time Window',
      'Instructor Name',
      'Room / Laboratory'
    ]);
    summaryColRow.height = 24;
    summaryColRow.eachCell(cell => {
      cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF292929' } };
      cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    });

    const classItems: ClassItem[] = [];
    days.forEach(d => {
      UNIVERSITY_SLOTS.forEach(s => {
        const matches = (scheduleData[s.period]?.[d] || []).filter(c => c.studentGroupId === group.id);
        matches.forEach(m => classItems.push(m));
      });
    });

    classItems.forEach(item => {
      const isLab = item.sessionType === 'Lab' || item.spanSlots === 3;
      const labBlock = isLab ? getLabBlockByStartPeriod(item.time || '') : undefined;
      const timeWindow = isLab
        ? (item.continuousTimeLabel || labBlock?.continuousLabel || item.time || '')
        : (item.time || '');
      const durationLabel = isLab
        ? 'Lab · 3 Hours Continuous (180 mins)'
        : 'Lecture · 50 mins (+ 10m Break)';

      const r = classSheet.addRow([
        item.code,
        item.title,
        durationLabel,
        `${DAY_FULL_LABELS[item.day || 'Mon'] || item.day} · ${timeWindow}`,
        item.prof,
        item.room
      ]);
      r.height = 22;
      const pastel = getCourseArgb(item.code);
      r.eachCell((cell, colNumber) => {
        cell.font = {
          name: 'Arial',
          size: 9,
          bold: colNumber === 1 || (colNumber === 3 && isLab),
          color: { argb: 'FF171717' }
        };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: colNumber === 1 || (colNumber === 3 && isLab) ? pastel.argb : 'FFFFFFFF' }
        };
        cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE4E2DA' } },
          bottom: { style: 'thin', color: { argb: 'FFE4E2DA' } },
          left: { style: 'thin', color: { argb: 'FFE4E2DA' } },
          right: { style: 'thin', color: { argb: 'FFE4E2DA' } }
        };
      });
    });
  });

  // Generate & trigger download of the Google Sheets-ready .xlsx workbook
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const cleanScope = scopeLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `SmartGrid_ClassTimetables_${cleanScope}.xlsx`;
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return {
    fileName,
    classSheetCount: finalGroups.length,
    totalSessionsCount: allScheduledItems.length
  };
}
