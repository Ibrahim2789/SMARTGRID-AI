import ExcelJS from 'exceljs';
import { InstitutionalDataStore } from '../data/store';
import { ClassItem } from '../components/ClassDetailsModal';
import {
  UNIVERSITY_SLOTS,
  StudentGroup,
  ComputedAcademicScheduleConfig,
  computeAcademicScheduleConfig,
  getLabBlockByStartPeriod
} from '../types/institutional';

/**
 * StudyFetch-aligned soft pastel course palette optimized for both
 * laptop screen legibility and landscape print contrast.
 */
const PASTEL_EXPORT_PALETTE = [
  { argb: 'FFDDF7F7', borderArgb: 'FF88D4D4', badgeArgb: 'FFB8EEEE', name: 'Cyan' },
  { argb: 'FFF7EAFC', borderArgb: 'FFD5B2E3', badgeArgb: 'FFF2D8FA', name: 'Lavender' },
  { argb: 'FFDDF9F2', borderArgb: 'FF8BD6C5', badgeArgb: 'FFB8F2E6', name: 'Mint' },
  { argb: 'FFE6FCC8', borderArgb: 'FF92DB52', badgeArgb: 'FFB7F77C', name: 'Lime' },
  { argb: 'FFF7EEB8', borderArgb: 'FFCDB548', badgeArgb: 'FFE8D36B', name: 'Mustard' }
];

function getCourseArgb(code: string) {
  const cleanCode = code.replace(/-L$/i, '');
  let hash = 0;
  for (let i = 0; i < cleanCode.length; i++) {
    hash = (hash * 31 + cleanCode.charCodeAt(i)) >>> 0;
  }
  return PASTEL_EXPORT_PALETTE[hash % PASTEL_EXPORT_PALETTE.length];
}

function sanitizeWorksheetName(rawName: string, usedNames: Set<string>): string {
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

function getExcelColumnLetter(colNumber: number): string {
  let num = colNumber;
  let letters = '';
  while (num > 0) {
    const mod = (num - 1) % 26;
    letters = String.fromCharCode(65 + mod) + letters;
    num = Math.floor((num - mod) / 26);
  }
  return letters || 'A';
}

function compactText(text: string, maxLength: number): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength - 1).trim()}…`;
}

function cleanCourseTitle(title: string, maxLength: number): string {
  const stripped = title.replace(/\s*\(Lab\)\s*$/i, '').trim();
  return compactText(stripped, maxLength);
}

const DAY_FULL_LABELS: Record<string, string> = {
  Mon: 'MONDAY',
  Tue: 'TUESDAY',
  Wed: 'WEDNESDAY',
  Thu: 'THURSDAY',
  Fri: 'FRIDAY',
  Sat: 'SATURDAY',
  Sun: 'SUNDAY'
};

export interface GoogleSheetsExportResult {
  fileName: string;
  classSheetCount: number;
  totalSessionsCount: number;
}

/**
 * Configures worksheet page setup, print margins, centering, repeat header rows,
 * and exact print area so every sheet fits on 1 landscape page and 1 laptop screen.
 */
function configureCompactLandscapeWorksheet(
  worksheet: ExcelJS.Worksheet,
  days: string[],
  lastGridRow: number
) {
  const totalCols = days.length + 1;
  const lastColLetter = getExcelColumnLetter(totalCols);

  // Calculate balanced column widths so total width is ~127 chars (fits standard laptop screen without horizontal scrolling)
  const timeColWidth = 17;
  const availableDayChars = 112;
  const dayColWidth = Math.max(16, Math.min(23, Math.floor(availableDayChars / days.length)));

  worksheet.columns = [
    { key: 'slotCol', width: timeColWidth },
    ...days.map((d, idx) => ({ key: `day_${idx}`, width: dayColWidth }))
  ];

  worksheet.pageSetup = {
    paperSize: 9, // A4
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    horizontalCentered: true,
    verticalCentered: false,
    printTitlesRow: '1:3',
    printArea: `A1:${lastColLetter}${lastGridRow}`,
    margins: {
      left: 0.28,
      right: 0.28,
      top: 0.32,
      bottom: 0.32,
      header: 0.18,
      footer: 0.18
    }
  };
}

/**
 * Adds a compact 2-row header block (Title + Subtitle) and 1-row Day header,
 * followed by the dynamic time slots + compact Midday Break row.
 */
function populateCompactLandscapeTimetable(params: {
  worksheet: ExcelJS.Worksheet;
  titleLeft: string;
  titleRight: string;
  subtitleText: string;
  days: string[];
  scheduleData: Record<string, Record<string, ClassItem[]>>;
  itemPredicate: (cls: ClassItem) => boolean;
  isSingleClassSheet: boolean;
  computedTiming: ComputedAcademicScheduleConfig;
  store: InstitutionalDataStore;
}) {
  const {
    worksheet,
    titleLeft,
    titleRight,
    subtitleText,
    days,
    scheduleData,
    itemPredicate,
    isSingleClassSheet,
    computedTiming,
    store
  } = params;

  const dynamicSlots = computedTiming.slots.length > 0 ? computedTiming.slots : UNIVERSITY_SLOTS;
  const totalCols = days.length + 1;

  // ---------------------------------------------------------------------------
  // ROW 1: Compact Title & Class/Section Identification Bar (Height: 22pt)
  // ---------------------------------------------------------------------------
  const titleRow = worksheet.addRow(['']);
  worksheet.mergeCells(1, 1, 1, totalCols);
  titleRow.height = 22;

  const titleCell = titleRow.getCell(1);
  titleCell.value = {
    richText: [
      {
        font: { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } },
        text: `  ${titleLeft}`
      },
      {
        font: { name: 'Calibri', size: 9.5, bold: false, color: { argb: 'FFD4D1C7' } },
        text: `   —   ${titleRight}`
      }
    ]
  };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF171717' }
  };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };

  // ---------------------------------------------------------------------------
  // ROW 2: Compact Metadata & Operating Hours Bar (Height: 16pt)
  // ---------------------------------------------------------------------------
  const subRow = worksheet.addRow([`  ${subtitleText}`]);
  worksheet.mergeCells(2, 1, 2, totalCols);
  subRow.height = 16;

  const subCell = subRow.getCell(1);
  subCell.font = {
    name: 'Calibri',
    size: 8.5,
    bold: false,
    color: { argb: 'FF333330' }
  };
  subCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFEDEAE0' }
  };
  subCell.alignment = { vertical: 'middle', horizontal: 'left' };
  subCell.border = {
    bottom: { style: 'thin', color: { argb: 'FFD6D3C9' } }
  };

  // ---------------------------------------------------------------------------
  // ROW 3: Compact Day Column Headers (Height: 21pt)
  // ---------------------------------------------------------------------------
  const headerValues = [
    'TIME SLOT',
    ...days.map(d => {
      const label = DAY_FULL_LABELS[d] || d.toUpperCase();
      return d === 'Fri' && computedTiming.fridayAfternoonShiftEnabled
        ? `FRIDAY (PM ${computedTiming.fridayAfternoonStartTime})`
        : label;
    })
  ];
  const headerRow = worksheet.addRow(headerValues);
  headerRow.height = 21;
  headerRow.eachCell((cell, colNumber) => {
    cell.font = {
      name: 'Calibri',
      size: 9,
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
      horizontal: 'center'
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF171717' } },
      bottom: { style: 'medium', color: { argb: 'FF171717' } },
      left: { style: 'thin', color: { argb: 'FF3E3E3E' } },
      right: { style: 'thin', color: { argb: 'FF3E3E3E' } }
    };
    if (colNumber === 1) {
      cell.border = {
        ...cell.border,
        right: { style: 'medium', color: { argb: 'FF171717' } }
      };
    }
  });

  // Track cells covered by a Continuous Lab vertical merge
  const coveredByMerge = new Set<string>();
  const pendingLabMerges: Array<{
    startRowNumber: number;
    endRowNumber: number;
    colNumber: number;
    cls: ClassItem;
  }> = [];

  const slotRowHeight = isSingleClassSheet ? 42 : 45;

  const renderSlotRow = (slotMeta: (typeof dynamicSlots)[number], slotIdx: number) => {
    const breakNote =
      computedTiming.shortBreakEnabled &&
      computedTiming.shortBreakMinutes > 0 &&
      slotMeta.shortBreak !== 'No Break'
        ? `Break ${slotMeta.shortBreak.replace(' AM', '').replace(' PM', '')}`
        : 'No Break (0m)';

    const row = worksheet.addRow(['']);
    const currentRowNum = row.number;
    row.height = slotRowHeight;

    // Column 1: Consistent, compact Time Label with prominent time and subtle break note
    const timeCell = row.getCell(1);
    timeCell.value = {
      richText: [
        {
          font: { name: 'Calibri', size: 8.5, bold: true, color: { argb: 'FF171717' } },
          text: `${slotMeta.period.replace(' AM', '').replace(' PM', '')}\n`
        },
        {
          font: { name: 'Calibri', size: 7.5, bold: false, color: { argb: 'FF77766F' } },
          text: `Slot ${slotMeta.slotNumber} • ${breakNote}`
        }
      ]
    };
    timeCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF7F6EF' }
    };
    timeCell.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: true
    };
    timeCell.border = {
      top: { style: 'thin', color: { argb: 'FFE4E2DA' } },
      bottom: { style: 'thin', color: { argb: 'FFE4E2DA' } },
      left: { style: 'thin', color: { argb: 'FFD6D3C9' } },
      right: { style: 'medium', color: { argb: 'FFD4D1C7' } }
    };

    // Day Columns (Cols 2..N)
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
      cell.alignment = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: true
      };

      if (coveredByMerge.has(`${slotMeta.slotNumber}_${dIdx}`)) {
        return;
      }

      const cellClasses = (scheduleData[slotMeta.period]?.[day] || []).filter(itemPredicate);

      if (cellClasses.length === 0) {
        cell.value = '';
        return;
      }

      // Check if a continuous Lab starts in this slot
      const labItem = cellClasses.find(c => c.sessionType === 'Lab' || (c.spanSlots && c.spanSlots > 1));
      const labBlock = labItem ? getLabBlockByStartPeriod(slotMeta.period, store.timeStructure) : undefined;
      const desiredSpan = labItem?.spanSlots || labBlock?.spanSlots || computedTiming.labSpanSlots || 3;
      const sameSessionSlots = dynamicSlots
        .slice(slotIdx, slotIdx + desiredSpan)
        .filter(s => s.session === slotMeta.session);

      if (labItem && sameSessionSlots.length >= 2) {
        const coveredSubsequent = sameSessionSlots.slice(1);
        coveredSubsequent.forEach(subSlot => {
          coveredByMerge.add(`${subSlot.slotNumber}_${dIdx}`);
        });

        const continuousWindow =
          labItem.continuousTimeLabel ||
          labBlock?.continuousLabel ||
          `${slotMeta.startTime} – ${sameSessionSlots[sameSessionSlots.length - 1].cycleEndTime}`;

        const otherCount = cellClasses.length - 1;
        const cleanTitle = cleanCourseTitle(labItem.title, 28);
        const cleanProf = compactText(labItem.prof, 22);

        const richParts: ExcelJS.RichText[] = [
          {
            font: { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF171717' } },
            text: `${cleanTitle} (${labItem.code})\n`
          },
          {
            font: { name: 'Calibri', size: 8, bold: true, color: { argb: 'FF292929' } },
            text: `[LAB • ${computedTiming.labDurationHoursLabel.toUpperCase()} CONTINUOUS] ${continuousWindow}\n`
          },
          {
            font: { name: 'Calibri', size: 8, bold: false, color: { argb: 'FF333330' } },
            text: isSingleClassSheet
              ? `${cleanProf}  •  ${labItem.room}`
              : `${cleanProf}  •  ${labItem.room} (${labItem.cohort})`
          }
        ];

        if (!isSingleClassSheet && otherCount > 0) {
          richParts.push({
            font: { name: 'Calibri', size: 7.5, italic: true, color: { argb: 'FF57564F' } },
            text: `\n+${otherCount} concurrent section${otherCount > 1 ? 's' : ''}`
          });
        }

        cell.value = { richText: richParts };

        const pastel = getCourseArgb(labItem.code);
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: pastel.argb }
        };
        cell.alignment = {
          vertical: 'middle',
          horizontal: 'center',
          wrapText: true
        };

        pendingLabMerges.push({
          startRowNumber: currentRowNum,
          endRowNumber: currentRowNum + sameSessionSlots.length - 1,
          colNumber: colNum,
          cls: labItem
        });
      } else {
        // Regular Lecture cell
        const primary = cellClasses[0];
        const pastel = getCourseArgb(primary.code);

        if (isSingleClassSheet || cellClasses.length === 1) {
          const cleanTitle = cleanCourseTitle(primary.title, 24);
          const cleanProf = compactText(primary.prof, 18);
          const cohortSuffix = isSingleClassSheet ? '' : ` [${primary.cohort}]`;

          cell.value = {
            richText: [
              {
                font: { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF171717' } },
                text: `${cleanTitle} (${primary.code})\n`
              },
              {
                font: { name: 'Calibri', size: 7.5, bold: false, color: { argb: 'FF444440' } },
                text: `${cleanProf} • ${primary.room}${cohortSuffix}`
              }
            ]
          };
        } else {
          // Master Weekly Overview cell with multiple concurrent sections
          const first = cellClasses[0];
          const second = cellClasses[1];
          const extraCount = cellClasses.length - 2;

          const richParts: ExcelJS.RichText[] = [
            {
              font: { name: 'Calibri', size: 8, bold: true, color: { argb: 'FF171717' } },
              text: `${first.cohort}: ${compactText(first.title, 15)} (${first.code})\n`
            },
            {
              font: { name: 'Calibri', size: 7, bold: false, color: { argb: 'FF444440' } },
              text: `${compactText(first.prof, 14)} • ${first.room}\n`
            },
            {
              font: { name: 'Calibri', size: 8, bold: true, color: { argb: 'FF171717' } },
              text: `${second.cohort}: ${compactText(second.title, 15)} (${second.code})`
            }
          ];

          if (extraCount > 0) {
            richParts.push({
              font: { name: 'Calibri', size: 7, italic: true, color: { argb: 'FF57564F' } },
              text: `\n(+${extraCount} more in class tabs)`
            });
          } else {
            richParts.push({
              font: { name: 'Calibri', size: 7, bold: false, color: { argb: 'FF444440' } },
              text: `\n${compactText(second.prof, 14)} • ${second.room}`
            });
          }

          cell.value = { richText: richParts };
        }

        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: pastel.argb }
        };
        cell.alignment = {
          vertical: 'middle',
          horizontal: 'center',
          wrapText: true
        };
        cell.border = {
          top: { style: 'thin', color: { argb: pastel.borderArgb } },
          bottom: { style: 'thin', color: { argb: pastel.borderArgb } },
          left: { style: 'thin', color: { argb: pastel.borderArgb } },
          right: { style: 'thin', color: { argb: pastel.borderArgb } }
        };
      }
    });
  };

  dynamicSlots.forEach((slotMeta, sIdx) => {
    // Insert Midday Break row right before the first Afternoon slot if midday break is enabled
    if (
      computedTiming.middayBreak.enabled &&
      slotMeta.slotNumber === computedTiming.firstAfternoonSlotNumber
    ) {
      const lunchRow = worksheet.addRow([
        computedTiming.middayBreak.timeRangeLabel,
        `MIDDAY / LUNCH BREAK (${computedTiming.middayBreak.fullRangeLabel})  •  Protected University Break — No Lectures or Labs Scheduled`
      ]);
      const lunchRowNum = lunchRow.number;
      worksheet.mergeCells(lunchRowNum, 2, lunchRowNum, totalCols);
      lunchRow.height = 19;

      const lunchTimeCell = lunchRow.getCell(1);
      lunchTimeCell.font = {
        name: 'Calibri',
        size: 8,
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
        horizontal: 'center'
      };
      lunchTimeCell.border = {
        top: { style: 'thin', color: { argb: 'FFB59F3B' } },
        bottom: { style: 'thin', color: { argb: 'FFB59F3B' } },
        left: { style: 'thin', color: { argb: 'FFB59F3B' } },
        right: { style: 'medium', color: { argb: 'FFB59F3B' } }
      };

      for (let c = 2; c <= totalCols; c++) {
        const cell = lunchRow.getCell(c);
        cell.font = {
          name: 'Calibri',
          size: 8.5,
          bold: true,
          color: { argb: 'FF333330' }
        };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFEDEAE0' }
        };
        cell.alignment = {
          vertical: 'middle',
          horizontal: 'center'
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFC7C3B6' } },
          bottom: { style: 'thin', color: { argb: 'FFC7C3B6' } },
          left: { style: 'thin', color: { argb: 'FFD6D3C9' } },
          right: { style: 'thin', color: { argb: 'FFD6D3C9' } }
        };
      }
    }

    renderSlotRow(slotMeta, sIdx);
  });

  // Execute vertical merges for Continuous Labs
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
        top: r === mergeItem.startRowNumber ? { style: 'medium', color: { argb: pastel.borderArgb } } : undefined,
        bottom: r === mergeItem.endRowNumber ? { style: 'medium', color: { argb: pastel.borderArgb } } : undefined,
        left: { style: 'medium', color: { argb: pastel.borderArgb } },
        right: { style: 'medium', color: { argb: pastel.borderArgb } }
      };
    }
  });

  const lastGridRow = worksheet.rowCount;
  configureCompactLandscapeWorksheet(worksheet, days, lastGridRow);
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

  const computedTiming = computeAcademicScheduleConfig(store.timeStructure);
  const dynamicSlots = computedTiming.slots.length > 0 ? computedTiming.slots : UNIVERSITY_SLOTS;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SmartGrid AI — University Scheduling Platform';
  workbook.created = new Date();
  workbook.modified = new Date();

  const activeTerm = store.terms.find(t => t.status === 'active') || store.terms[0];
  const termName = activeTerm?.name || 'Fall Semester 2026';
  const institutionName = store.institutionProfile?.name || 'University of Engineering & Computing';

  const baseWorkingDays =
    computedTiming.workingDays.length > 0
      ? computedTiming.workingDays
      : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

  const weekendDaysWithClasses = (['Sat', 'Sun'] as const).filter(
    d =>
      !baseWorkingDays.includes(d) &&
      dynamicSlots.some(s => (scheduleData[s.period]?.[d] || []).length > 0)
  );
  const days = [...baseWorkingDays, ...weekendDaysWithClasses];

  const usedSheetNames = new Set<string>();

  // Collect all scheduled items in scope
  const allScheduledItems: ClassItem[] = [];
  days.forEach(day => {
    dynamicSlots.forEach(slotMeta => {
      const cellItems = (scheduleData[slotMeta.period]?.[day] || []).filter(
        cls => scope === 'all' || filterClass(cls)
      );
      cellItems.forEach(item => {
        allScheduledItems.push(item);
      });
    });
  });

  // Determine which classes/sections to include as individual tabs
  const groupsToExport: StudentGroup[] = store.studentGroups.filter(grp => {
    const hasSessionsInScope = allScheduledItems.some(item => item.studentGroupId === grp.id);
    if (scope === 'all') {
      const hasAnySessions = store.sections.some(s => s.studentGroupId === grp.id && s.assignedSlot);
      return hasAnySessions || hasSessionsInScope;
    }
    return hasSessionsInScope;
  });

  const finalGroups =
    groupsToExport.length > 0
      ? groupsToExport
      : store.studentGroups.filter(grp => store.sections.some(s => s.studentGroupId === grp.id && s.assignedSlot));

  // ============================================================================
  // WORKSHEET 1: WEEKLY OVERVIEW (COMPACT LANDSCAPE MASTER TIMETABLE)
  // ============================================================================
  const overviewTitle = sanitizeWorksheetName('Weekly Overview', usedSheetNames);
  const overviewSheet = workbook.addWorksheet(overviewTitle, {
    views: [{ state: 'frozen', xSplit: 1, ySplit: 3, showGridLines: true }]
  });

  populateCompactLandscapeTimetable({
    worksheet: overviewSheet,
    titleLeft: `${institutionName.toUpperCase()} — WEEKLY TIMETABLE OVERVIEW`,
    titleRight: `${termName}  •  ${finalGroups.length} Class Sections`,
    subtitleText: `Scope: ${scopeLabel.replace(/_/g, ' ')}   |   ${computedTiming.summaryText}`,
    days,
    scheduleData,
    itemPredicate: cls => scope === 'all' || filterClass(cls),
    isSingleClassSheet: false,
    computedTiming,
    store
  });

  // ============================================================================
  // WORKSHEETS 2..N: ONE COMPACT LANDSCAPE WORKSHEET PER CLASS / SECTION
  // ============================================================================
  finalGroups.forEach(group => {
    const prog = store.programs.find(p => p.id === group.programId);
    const dept = store.departments.find(d => d.id === prog?.departmentId);

    const sheetName = sanitizeWorksheetName(group.code, usedSheetNames);
    const classSheet = workbook.addWorksheet(sheetName, {
      views: [{ state: 'frozen', xSplit: 1, ySplit: 3, showGridLines: true }]
    });

    const deptLabel = dept?.name || prog?.name || 'Engineering & Computing';
    const semLabel = group.semester ? `Semester ${group.semester}` : `Year ${group.year}`;
    const secLabel = group.section ? `Section ${group.section}` : group.code;
    const roomLabel = group.homeRoom || 'Assigned Lecture Hall';

    populateCompactLandscapeTimetable({
      worksheet: classSheet,
      titleLeft: `CLASS TIMETABLE: ${group.code}`,
      titleRight: `${group.name} (${semLabel} • ${secLabel})`,
      subtitleText: `Department: ${deptLabel}   |   Home Room: ${roomLabel}   |   Term: ${termName}   |   ${computedTiming.summaryText}`,
      days,
      scheduleData,
      itemPredicate: cls => cls.studentGroupId === group.id,
      isSingleClassSheet: true,
      computedTiming,
      store
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
