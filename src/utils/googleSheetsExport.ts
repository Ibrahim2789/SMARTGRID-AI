import ExcelJS from 'exceljs';
import { InstitutionalDataStore } from '../data/store';
import { ClassItem } from '../components/ClassDetailsModal';
import {
  UNIVERSITY_SLOTS,
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
  const cleaned = rawName.replace(/[\\/?*:[\]]/g, '').trim() || 'Course';
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
  Sat: 'Saturday'
};

export interface GoogleSheetsExportResult {
  fileName: string;
  courseSheetCount: number;
  totalSessionsCount: number;
}

export async function exportTimetableToGoogleSheetsWorkbook(params: {
  store: InstitutionalDataStore;
  scheduleData: Record<string, Record<string, ClassItem[]>>;
  filterClass: (cls: ClassItem) => boolean;
  scope: 'filtered' | 'all';
  scopeLabel: string;
  studentOrUserName?: string;
}): Promise<GoogleSheetsExportResult> {
  const { store, scheduleData, filterClass, scope, scopeLabel, studentOrUserName } = params;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SmartGrid AI — University Scheduling Platform';
  workbook.created = new Date();
  workbook.modified = new Date();

  const activeTerm = store.terms.find(t => t.status === 'active') || store.terms[0];
  const termName = activeTerm?.name || 'Spring 2026';
  const institutionName = store.institutionProfile?.name || 'Western Polytechnic Institute';
  const days = store.timeStructure.workingDays.length > 0
    ? store.timeStructure.workingDays
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

  const usedSheetNames = new Set<string>();

  // Collect all scheduled items in scope
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
  // WORKSHEET 1: WEEKLY OVERVIEW
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

  // Configure Column Widths
  overviewSheet.columns = [
    { key: 'slotCol', width: 30 },
    ...days.map((d, idx) => ({ key: `day_${idx}`, width: 32 }))
  ];

  const totalCols = days.length + 1;

  // Row 1: Main Title Banner
  const titleRow = overviewSheet.addRow([
    `${institutionName.toUpperCase()} — SMARTGRID AI WEEKLY TIMETABLE`
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

  // Row 2: Subtitle / Student & Academic Metadata
  const metaRow = overviewSheet.addRow([
    `Semester: ${termName}   |   Scope: ${scopeLabel.replace(/_/g, ' ')}   |   Prepared For: ${
      studentOrUserName || 'Academic Cohort Schedule'
    }   |   Operating Hours: 9:00 AM – 5:00 PM (Fixed Lunch: 1:00 PM – 2:00 PM)`
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
    'University Scheduling Rules:  • Regular Lecture = 50 mins + 10m Short Break   • Laboratory Session = 3 Hours Continuous (3 consecutive hourly cycles, no internal breaks)   • Fixed Lunch Break = 1:00 PM – 2:00 PM'
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

  // Row 4: Spacer Row
  const spacerRow = overviewSheet.addRow([]);
  spacerRow.height = 8;

  // Row 5: Table Header Row (Time / Slot + Days)
  const headerValues = ['TIME SLOT & SESSION', ...days.map(d => (DAY_FULL_LABELS[d] || d).toUpperCase())];
  const headerRow = overviewSheet.addRow(headerValues);
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
  // Map key: `${slotNumber}_${dIdx}`
  const coveredByMerge = new Set<string>();
  const pendingLabMerges: Array<{
    startRowNumber: number;
    endRowNumber: number;
    colNumber: number;
    cls: ClassItem;
  }> = [];

  // Map slotNumber (1..7) to its Excel row number so we can merge 3 consecutive lecture rows accurately
  const slotToExcelRow = new Map<number, number>();

  const renderSlotRow = (slotMeta: (typeof UNIVERSITY_SLOTS)[number]) => {
    const rowLabel = `Slot ${slotMeta.slotNumber} (${slotMeta.session})\n${slotMeta.period}\nShort Break: ${slotMeta.shortBreak}`;
    const row = overviewSheet.addRow([rowLabel]);
    const currentRowNum = row.number;
    slotToExcelRow.set(slotMeta.slotNumber, currentRowNum);
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

      // Default border & background for empty slot
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
        // This cell will be merged with the starting Lab row above
        return;
      }

      const cellClasses = (scheduleData[slotMeta.period]?.[day] || []).filter(
        cls => scope === 'all' || filterClass(cls)
      );

      if (cellClasses.length === 0) {
        cell.value = '';
        return;
      }

      // Prioritize a 3-hour continuous Lab if one starts in this slot
      const labItem = cellClasses.find(c => c.sessionType === 'Lab' || c.spanSlots === 3);
      if (labItem && slotMeta.slotNumber <= 5) {
        // Mark the next 2 slots in the same session as covered by this 3-hour lab
        coveredByMerge.add(`${slotMeta.slotNumber + 1}_${dIdx}`);
        coveredByMerge.add(`${slotMeta.slotNumber + 2}_${dIdx}`);

        const labBlock = getLabBlockByStartPeriod(slotMeta.period);
        const continuousWindow =
          labItem.continuousTimeLabel || labBlock?.continuousLabel || '3 Hours Continuous';

        const otherLecturesCount = cellClasses.length - 1;
        const extraNote = otherLecturesCount > 0 ? `\n(+${otherLecturesCount} other section)` : '';

        cell.value = `${labItem.code} — ${labItem.title}\n[LAB · 3 HOURS CONTINUOUS]\n${continuousWindow} (No Internal Breaks)\nInstructor: ${labItem.prof}\nLab Room: ${labItem.room} · Cohort: ${labItem.cohort}${extraNote}`;

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

        // Record vertical merge across 3 consecutive slot rows (currentRowNum .. currentRowNum + 2)
        pendingLabMerges.push({
          startRowNumber: currentRowNum,
          endRowNumber: currentRowNum + 2,
          colNumber: colNum,
          cls: labItem
        });
      } else {
        // Regular 50-minute Lecture(s)
        const primary = cellClasses[0];
        const pastel = getCourseArgb(primary.code);

        if (cellClasses.length === 1) {
          cell.value = `${primary.code} — ${primary.title}\n[LECTURE · 50 MINS] ${slotMeta.period}\nInstructor: ${primary.prof}\nRoom: ${primary.room} · Cohort: ${primary.cohort}`;
        } else {
          const summaryLines = cellClasses.slice(0, 2).map(
            c => `${c.code} (${c.sessionType || 'Lecture'}) — ${c.title}\n${c.prof} · ${c.room} [${c.cohort}]`
          );
          if (cellClasses.length > 2) {
            summaryLines.push(`+${cellClasses.length - 2} additional scheduled sections`);
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
          bold: false,
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

  // Render Prominent Fixed University Lunch Break Row (1:00 PM – 2:00 PM)
  const lunchRow = overviewSheet.addRow([
    '1:00 PM – 2:00 PM\nFIXED LUNCH BREAK',
    'UNIVERSITY-WIDE FIXED LUNCH BREAK (1:00 PM – 2:00 PM) — NO LECTURES OR LABS SCHEDULED'
  ]);
  const lunchRowNum = lunchRow.number;
  overviewSheet.mergeCells(lunchRowNum, 2, lunchRowNum, totalCols);
  lunchRow.height = 38;

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

  // Execute all vertical merges for 3-hour Continuous Labs now that rows exist
  pendingLabMerges.forEach(mergeItem => {
    overviewSheet.mergeCells(
      mergeItem.startRowNumber,
      mergeItem.colNumber,
      mergeItem.endRowNumber,
      mergeItem.colNumber
    );
    const pastel = getCourseArgb(mergeItem.cls.code);
    for (let r = mergeItem.startRowNumber; r <= mergeItem.endRowNumber; r++) {
      const mergedCell = overviewSheet.getRow(r).getCell(mergeItem.colNumber);
      mergedCell.border = {
        top: { style: 'medium', color: { argb: pastel.borderArgb } },
        bottom: { style: 'medium', color: { argb: pastel.borderArgb } },
        left: { style: 'medium', color: { argb: pastel.borderArgb } },
        right: { style: 'medium', color: { argb: pastel.borderArgb } }
      };
    }
  });

  // Add Footer Legend on Weekly Overview
  overviewSheet.addRow([]);
  const footerLegendRow = overviewSheet.addRow([
    'SESSION LEGEND:   [LECTURE · 50 MINS] occupies 1 hourly slot followed by a 10-minute short break.   [LAB · 3 HOURS CONTINUOUS] spans 3 vertically merged hourly slots (9:00 AM–12:00 PM, 10:00 AM–1:00 PM, or 2:00 PM–5:00 PM) with no internal break.'
  ]);
  overviewSheet.mergeCells(footerLegendRow.number, 1, footerLegendRow.number, totalCols);
  footerLegendRow.height = 22;
  footerLegendRow.getCell(1).font = {
    name: 'Arial',
    size: 9,
    bold: true,
    color: { argb: 'FF171717' }
  };
  footerLegendRow.getCell(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF7F6EF' }
  };
  footerLegendRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

  // ============================================================================
  // WORKSHEETS 2..N: ONE SEPARATE WORKSHEET FOR EVERY INDIVIDUAL COURSE
  // ============================================================================
  // Group scheduled sessions by course code
  const sessionsByCourse = new Map<
    string,
    {
      code: string;
      title: string;
      departmentName: string;
      credits: number;
      sessions: ClassItem[];
    }
  >();

  allScheduledItems.forEach(item => {
    const existing = sessionsByCourse.get(item.code);
    if (existing) {
      existing.sessions.push(item);
    } else {
      sessionsByCourse.set(item.code, {
        code: item.code,
        title: item.title,
        departmentName: item.departmentName || 'Academic Department',
        credits: item.credits || 4,
        sessions: [item]
      });
    }
  });

  const dayOrder: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  sessionsByCourse.forEach(courseEntry => {
    // Use course title (or Code - Title) for worksheet tab name, sanitized & unique <= 31 chars
    const desiredTabName = `${courseEntry.title} (${courseEntry.code})`;
    const sheetName = sanitizeWorksheetName(desiredTabName, usedSheetNames);
    const courseSheet = workbook.addWorksheet(sheetName, {
      views: [{ state: 'frozen', xSplit: 0, ySplit: 9 }],
      pageSetup: {
        paperSize: 9,
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 1
      }
    });

    courseSheet.columns = [
      { key: 'day', width: 16 },
      { key: 'sessionType', width: 22 },
      { key: 'startTime', width: 16 },
      { key: 'endTime', width: 16 },
      { key: 'duration', width: 28 },
      { key: 'instructor', width: 26 },
      { key: 'room', width: 24 }
    ];

    const pastel = getCourseArgb(courseEntry.code);
    const instructorsList = Array.from(new Set(courseEntry.sessions.map(s => s.prof))).join(', ');
    const cohortsList = Array.from(new Set(courseEntry.sessions.map(s => s.cohort))).join(', ');
    const hasLecture = courseEntry.sessions.some(s => s.sessionType !== 'Lab' && s.spanSlots !== 3);
    const hasLab = courseEntry.sessions.some(s => s.sessionType === 'Lab' || s.spanSlots === 3);
    const courseTypeSummary =
      hasLecture && hasLab
        ? 'Combined Regular Lectures (50m) + 3-Hour Continuous Lab'
        : hasLab
        ? '3-Hour Continuous Laboratory / Studio'
        : 'Regular Academic Lecture (50m)';

    // Course Header Banner
    const cBanner = courseSheet.addRow([`${courseEntry.code} — ${courseEntry.title.toUpperCase()}`]);
    courseSheet.mergeCells(1, 1, 1, 7);
    cBanner.height = 30;
    cBanner.getCell(1).font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FF171717' } };
    cBanner.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: pastel.argb } };
    cBanner.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

    // Course Metadata Grid (Rows 2..6)
    const metaRowsData: Array<[string, string, string, string]> = [
      ['Course Name:', courseEntry.title, 'Course Code:', courseEntry.code],
      ['Instructor(s):', instructorsList, 'Semester:', termName],
      ['Section / Cohort:', cohortsList, 'Credits:', `${courseEntry.credits} Credit Hours`],
      ['Course Type:', courseTypeSummary, 'Department:', courseEntry.departmentName]
    ];

    metaRowsData.forEach(pair => {
      const r = courseSheet.addRow([pair[0], pair[1], '', pair[2], pair[3], '', '']);
      courseSheet.mergeCells(r.number, 2, r.number, 3);
      courseSheet.mergeCells(r.number, 5, r.number, 7);
      r.height = 20;

      [1, 4].forEach(colIdx => {
        const lblCell = r.getCell(colIdx);
        lblCell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF57564F' } };
        lblCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F6EF' } };
        lblCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      });

      [2, 5].forEach(colIdx => {
        const valCell = r.getCell(colIdx);
        valCell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF171717' } };
        valCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
        valCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      });
    });

    courseSheet.addRow([]); // Row 6 spacer

    const sectionTitleRow = courseSheet.addRow([
      'WEEKLY COURSE SCHEDULE (LECTURES & CONTINUOUS 3-HOUR LABS)'
    ]);
    courseSheet.mergeCells(sectionTitleRow.number, 1, sectionTitleRow.number, 7);
    sectionTitleRow.height = 22;
    sectionTitleRow.getCell(1).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF171717' } };
    sectionTitleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDEAE0' } };
    sectionTitleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

    // Table Column Headers (Row 9)
    const tableHeader = courseSheet.addRow([
      'Day',
      'Session Type',
      'Start Time',
      'End Time',
      'Duration',
      'Instructor',
      'Room'
    ]);
    tableHeader.height = 26;
    tableHeader.eachCell(cell => {
      cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF171717' } };
      cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF171717' } },
        bottom: { style: 'medium', color: { argb: 'FF171717' } },
        left: { style: 'thin', color: { argb: 'FF363636' } },
        right: { style: 'thin', color: { argb: 'FF363636' } }
      };
    });

    // Sort course sessions by Day then Slot
    const sortedSessions = [...courseEntry.sessions].sort((a, b) => {
      const dA = dayOrder[a.day || 'Mon'] || 99;
      const dB = dayOrder[b.day || 'Mon'] || 99;
      if (dA !== dB) return dA - dB;
      const sA = UNIVERSITY_SLOTS.findIndex(s => s.period === a.time);
      const sB = UNIVERSITY_SLOTS.findIndex(s => s.period === b.time);
      return sA - sB;
    });

    sortedSessions.forEach(sess => {
      const isLab = sess.sessionType === 'Lab' || sess.spanSlots === 3;
      const slotMeta = UNIVERSITY_SLOTS.find(s => s.period === sess.time);
      const labBlock = isLab ? getLabBlockByStartPeriod(sess.time || '') : undefined;

      const startTime = isLab
        ? (labBlock?.startTime || slotMeta?.startTime || '9:00 AM')
        : (slotMeta?.startTime || '9:00 AM');
      const endTime = isLab
        ? (labBlock?.endTime || '12:00 PM')
        : (slotMeta?.lectureEndTime || '9:50 AM');
      const durationText = isLab
        ? '3 Hours Continuous (180 mins · No Internal Breaks)'
        : '50 mins (+ 10m Short Break)';

      const dataRow = courseSheet.addRow([
        DAY_FULL_LABELS[sess.day || 'Mon'] || sess.day || 'Monday',
        isLab ? 'Lab (Continuous)' : 'Lecture',
        startTime,
        endTime,
        durationText,
        sess.prof,
        `${sess.room} (${sess.cohort})`
      ]);
      dataRow.height = 24;

      dataRow.eachCell((cell, colNumber) => {
        cell.font = {
          name: 'Arial',
          size: 9.5,
          bold: colNumber === 1 || colNumber === 2,
          color: { argb: 'FF171717' }
        };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: {
            argb: colNumber === 2 && isLab ? pastel.argb : 'FFFFFFFF'
          }
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
  const fileName = `SmartGrid_GoogleSheets_Timetable_${cleanScope}.xlsx`;
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return {
    fileName,
    courseSheetCount: sessionsByCourse.size,
    totalSessionsCount: allScheduledItems.length
  };
}
