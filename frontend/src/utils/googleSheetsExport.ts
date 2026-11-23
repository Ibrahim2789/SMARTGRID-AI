import ExcelJS from 'exceljs';
import { InstitutionalDataStore } from '../data/store';
import { ClassItem } from '../components/ClassDetailsModal';
import {
  UNIVERSITY_SLOTS,
  DayOfWeek,
  StudentGroup,
  ComputedAcademicScheduleConfig,
  computeAcademicScheduleConfig,
  getLabBlockByStartPeriod,
  getEffectiveSlotDisplayForDay,
  orderWorkingDaysFridayRightmost,
  minutesToTime24
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

function cleanCourseTitle(title: string): string {
  return title.replace(/\s*\(Lab\)\s*$/i, '').replace(/\s+/g, ' ').trim();
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

export interface CanonicalTimetableExportEntry {
  id: string;
  day: DayOfWeek;
  dayOrder: number;
  startMinutes: number;
  endMinutes: number;
  durationMinutes: number;
  startTime24: string;
  endTime24: string;
  timeDisplay: string;
  slotKey: string;
  courseCode: string;
  courseTitle: string;
  credits: number;
  sessionType: 'Lecture' | 'Lab';
  componentType: 'lecture' | 'lab';
  isSplitLab: boolean;
  slotSource: 'regular' | 'friday_regular' | 'friday_compressed';
  instructorName: string;
  labEngineerName?: string;
  roomCode: string;
  cohortCode: string;
  studentGroupId?: string;
  departmentName?: string;
  hasConflict: boolean;
  classItem: ClassItem;
}

export interface CanonicalExportBreakBand {
  kind: 'midday' | 'jummah' | 'friday_closed';
  label: string;
  startMinutes: number;
  endMinutes: number;
  durationMinutes: number;
  startTime24: string;
  endTime24: string;
  timeRangeLabel: string;
  appliesToDays: DayOfWeek[];
}

export interface CanonicalExportModel {
  days: DayOfWeek[];
  entries: CanonicalTimetableExportEntry[];
  breaks: CanonicalExportBreakBand[];
  computedTiming: ComputedAcademicScheduleConfig;
  institutionName: string;
  termName: string;
  timelineStartMinutes: number;
  timelineEndMinutes: number;
}

/**
 * Single canonical sorted timetable representation shared by Excel, PDF, CSV, and Print views.
 * Guarantees Friday is always rightmost among Mon..Fri, omitted if disabled, and retains exact timings
 * plus both Course Instructor and Lab Engineer names with zero dropped concurrent sessions.
 */
export function buildCanonicalExportModel(params: {
  store: InstitutionalDataStore;
  scheduleData: Record<string, Record<string, ClassItem[]>>;
  filterClass: (cls: ClassItem) => boolean;
  scope: 'filtered' | 'all';
  daysOverride?: DayOfWeek[];
}): CanonicalExportModel {
  const { store, scheduleData, filterClass, scope, daysOverride } = params;
  const computedTiming = computeAcademicScheduleConfig(store.timeStructure);
  const dynamicSlots = computedTiming.slots.length > 0 ? computedTiming.slots : UNIVERSITY_SLOTS;
  const fridayEnabled = store.timeStructure.fridayEnabled !== false;

  const activeTerm = store.terms.find(t => t.status === 'active') || store.terms[0];
  const termName = activeTerm?.name || 'Fall Semester 2026';
  const institutionName = store.institutionProfile?.name || 'SmartGrid University';

  // Gather any days present in scheduleData or requested by UI
  const discoveredDays = new Set<string>(daysOverride || computedTiming.workingDays);
  Object.values(scheduleData).forEach(byDay => {
    Object.entries(byDay).forEach(([d, items]) => {
      if (items.some(cls => scope === 'all' || filterClass(cls))) {
        discoveredDays.add(d);
      }
    });
  });

  const days = orderWorkingDaysFridayRightmost(
    Array.from(discoveredDays),
    fridayEnabled
  );
  const dayRank = new Map<DayOfWeek, number>(days.map((d, idx) => [d, idx]));

  const seenIds = new Set<string>();
  const entries: CanonicalTimetableExportEntry[] = [];

  Object.entries(scheduleData).forEach(([slotPeriod, byDay]) => {
    Object.entries(byDay).forEach(([rawDay, items]) => {
      const dayNorm = orderWorkingDaysFridayRightmost([rawDay], fridayEnabled)[0];
      if (!dayNorm || !dayRank.has(dayNorm)) return;

      items.forEach(cls => {
        if (scope !== 'all' && !filterClass(cls)) return;
        if (seenIds.has(cls.id)) return;
        seenIds.add(cls.id);

        const isLab = cls.sessionType === 'Lab' || Boolean(cls.spanSlots && cls.spanSlots > 1) || cls.componentType === 'lab';
        const baseSlot = dynamicSlots.find(s => s.period === (cls.time || slotPeriod));
        const effSlot = getEffectiveSlotDisplayForDay(dayNorm, cls.time || slotPeriod, computedTiming);
        const labMeta = isLab ? getLabBlockByStartPeriod(cls.time || slotPeriod, store.timeStructure, dayNorm) : undefined;

        const durationMinutes =
          cls.durationMinutes ||
          (isLab
            ? labMeta?.durationMinutes || computedTiming.labDurationMinutes || 180
            : effSlot.isOpen
            ? effSlot.durationMinutes
            : computedTiming.periodLengthMinutes || 50);

        const startMinutes =
          cls.startMinutes ??
          effSlot.slot?.startMinutes ??
          baseSlot?.startMinutes ??
          540;
        const endMinutes = cls.endMinutes ?? startMinutes + durationMinutes;
        const startTime24 = cls.startTime24 || minutesToTime24(startMinutes);
        const endTime24 = cls.endTime24 || minutesToTime24(endMinutes);

        const timeDisplay = isLab
          ? cls.continuousTimeLabel ||
            (dayNorm === 'Fri' ? labMeta?.continuousLabel : undefined) ||
            labMeta?.continuousLabel ||
            `${startTime24} – ${endTime24}`
          : cls.effectiveTime || (effSlot.isOpen ? effSlot.period : `${startTime24} – ${endTime24}`);

        const slotSource =
          cls.slotSource ||
          (dayNorm === 'Fri'
            ? effSlot.isFridaySpecial
              ? 'friday_compressed'
              : 'friday_regular'
            : 'regular');

        entries.push({
          id: cls.id,
          day: dayNorm,
          dayOrder: dayRank.get(dayNorm) ?? 99,
          startMinutes,
          endMinutes,
          durationMinutes,
          startTime24,
          endTime24,
          timeDisplay,
          slotKey: cls.time || slotPeriod,
          courseCode: cls.code,
          courseTitle: cleanCourseTitle(cls.title),
          credits: cls.credits || (isLab ? 1 : 3),
          sessionType: isLab ? 'Lab' : 'Lecture',
          componentType: isLab ? 'lab' : 'lecture',
          isSplitLab: Boolean(cls.isSplitLab),
          slotSource,
          instructorName: cls.prof || 'Unassigned Instructor',
          labEngineerName: isLab ? cls.labEngineerName : cls.labEngineerName,
          roomCode: cls.room,
          cohortCode: cls.cohort,
          studentGroupId: cls.studentGroupId,
          departmentName: cls.departmentName,
          hasConflict: Boolean(cls.hasConflict),
          classItem: cls
        });
      });
    });
  });

  entries.sort((a, b) => {
    if (a.dayOrder !== b.dayOrder) return a.dayOrder - b.dayOrder;
    if (a.startMinutes !== b.startMinutes) return a.startMinutes - b.startMinutes;
    if (a.endMinutes !== b.endMinutes) return a.endMinutes - b.endMinutes;
    const codeCmp = a.courseCode.localeCompare(b.courseCode);
    if (codeCmp !== 0) return codeCmp;
    return a.cohortCode.localeCompare(b.cohortCode);
  });

  const breaks: CanonicalExportBreakBand[] = [];
  if (computedTiming.middayBreak.enabled && computedTiming.middayBreak.durationMinutes > 0) {
    const middayDays = days.filter(
      d => d !== 'Fri' || computedTiming.fridaySchedule.mode === 'standard'
    );
    if (middayDays.length > 0) {
      breaks.push({
        kind: 'midday',
        label: 'Midday / Lunch Break',
        startMinutes: computedTiming.middayBreak.startMinutes,
        endMinutes: computedTiming.middayBreak.endMinutes,
        durationMinutes: computedTiming.middayBreak.durationMinutes,
        startTime24: computedTiming.middayBreak.startTime24,
        endTime24: computedTiming.middayBreak.endTime24,
        timeRangeLabel: computedTiming.middayBreak.fullRangeLabel,
        appliesToDays: middayDays
      });
    }
  }

  if (days.includes('Fri') && computedTiming.fridaySchedule.isFridayWorkingDay) {
    const fri = computedTiming.fridaySchedule;
    if (fri.mode === 'jummah_break' && fri.jummahBreak.durationMinutes > 0) {
      breaks.push({
        kind: 'jummah',
        label: 'Friday Jummah Prayer Break',
        startMinutes: fri.jummahBreak.startMinutes,
        endMinutes: fri.jummahBreak.endMinutes,
        durationMinutes: fri.jummahBreak.durationMinutes,
        startTime24: fri.jummahBreak.startTime24,
        endTime24: fri.jummahBreak.endTime24,
        timeRangeLabel: fri.jummahBreak.fullRangeLabel,
        appliesToDays: ['Fri']
      });
    } else if (fri.mode === 'morning_only') {
      const closeMins = fri.jummahBreak.startMinutes;
      const dayEndMins =
        dynamicSlots[dynamicSlots.length - 1]?.cycleEndMinutes ||
        Math.max(closeMins + 60, 1020);
      if (dayEndMins > closeMins) {
        breaks.push({
          kind: 'friday_closed',
          label: `Friday Half-Day Closed (${fri.closingTime24} Close)`,
          startMinutes: closeMins,
          endMinutes: dayEndMins,
          durationMinutes: dayEndMins - closeMins,
          startTime24: minutesToTime24(closeMins),
          endTime24: minutesToTime24(dayEndMins),
          timeRangeLabel: `${minutesToTime24(closeMins)} – ${minutesToTime24(dayEndMins)}`,
          appliesToDays: ['Fri']
        });
      }
    }
  }

  const slotStartMin = dynamicSlots[0]?.startMinutes ?? 540;
  const slotEndMin = dynamicSlots[dynamicSlots.length - 1]?.cycleEndMinutes ?? 1020;
  const minEntryStart = entries.reduce((acc, e) => Math.min(acc, e.startMinutes), slotStartMin);
  const maxEntryEnd = entries.reduce((acc, e) => Math.max(acc, e.endMinutes), slotEndMin);

  return {
    days,
    entries,
    breaks,
    computedTiming,
    institutionName,
    termName,
    timelineStartMinutes: Math.floor(minEntryStart / 60) * 60,
    timelineEndMinutes: Math.ceil(maxEntryEnd / 60) * 60
  };
}

export interface GoogleSheetsExportResult {
  fileName: string;
  classSheetCount: number;
  totalSessionsCount: number;
}

function configureCompactLandscapeWorksheet(
  worksheet: ExcelJS.Worksheet,
  days: DayOfWeek[],
  lastGridRow: number
) {
  const totalCols = days.length + 1;
  const lastColLetter = getExcelColumnLetter(totalCols);

  const timeColWidth = 20;
  const availableDayChars = 122;
  const dayColWidth = Math.max(20, Math.min(27, Math.floor(availableDayChars / Math.max(1, days.length))));

  worksheet.columns = [
    { key: 'slotCol', width: timeColWidth },
    ...days.map((_d, idx) => ({ key: `day_${idx}`, width: dayColWidth }))
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
      left: 0.25,
      right: 0.25,
      top: 0.3,
      bottom: 0.3,
      header: 0.15,
      footer: 0.15
    }
  };
}

function populateCompactLandscapeTimetable(params: {
  worksheet: ExcelJS.Worksheet;
  titleLeft: string;
  titleRight: string;
  subtitleText: string;
  model: CanonicalExportModel;
  entriesForSheet: CanonicalTimetableExportEntry[];
  isSingleClassSheet: boolean;
  store: InstitutionalDataStore;
}) {
  const {
    worksheet,
    titleLeft,
    titleRight,
    subtitleText,
    model,
    entriesForSheet,
    isSingleClassSheet,
    store
  } = params;

  const { days, computedTiming } = model;
  const dynamicSlots = computedTiming.slots.length > 0 ? computedTiming.slots : UNIVERSITY_SLOTS;
  const totalCols = days.length + 1;

  // Map entries by [slotKey][day] using either slotKey match or closest startMinutes match
  const entriesBySlotAndDay = new Map<string, CanonicalTimetableExportEntry[]>();
  entriesForSheet.forEach(entry => {
    let targetSlot = dynamicSlots.find(s => s.period === entry.slotKey);
    if (!targetSlot) {
      targetSlot = dynamicSlots.reduce((best, cur) => {
        const curDiff = Math.abs((cur.startMinutes ?? 540) - entry.startMinutes);
        const bestDiff = Math.abs((best.startMinutes ?? 540) - entry.startMinutes);
        return curDiff < bestDiff ? cur : best;
      }, dynamicSlots[0]);
    }
    const key = `${targetSlot?.period || entry.slotKey}__${entry.day}`;
    const list = entriesBySlotAndDay.get(key) || [];
    list.push(entry);
    entriesBySlotAndDay.set(key, list);
  });

  // ROW 1: Compact Title Bar
  const titleRow = worksheet.addRow(['']);
  worksheet.mergeCells(1, 1, 1, totalCols);
  titleRow.height = 24;
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
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF171717' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };

  // ROW 2: Metadata Bar
  const subRow = worksheet.addRow([`  ${subtitleText}`]);
  worksheet.mergeCells(2, 1, 2, totalCols);
  subRow.height = 17;
  const subCell = subRow.getCell(1);
  subCell.font = { name: 'Calibri', size: 8.5, bold: false, color: { argb: 'FF333330' } };
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDEAE0' } };
  subCell.alignment = { vertical: 'middle', horizontal: 'left' };
  subCell.border = { bottom: { style: 'thin', color: { argb: 'FFD6D3C9' } } };

  // ROW 3: Day Column Headers (Friday always rightmost among standard weekdays)
  const headerValues = [
    'TIME SLOT (24H)',
    ...days.map(d => {
      const label = DAY_FULL_LABELS[d] || d.toUpperCase();
      if (d !== 'Fri') return label;
      const fri = computedTiming.fridaySchedule;
      if (fri.mode === 'morning_only') {
        return `FRIDAY (AM ONLY · ${fri.closingTime24} CLOSE)`;
      }
      if (fri.mode === 'jummah_break') {
        return `FRIDAY (JUMMAH ${fri.jummahBreak.startTime24}–${fri.jummahBreak.endTime24})`;
      }
      return label;
    })
  ];
  const headerRow = worksheet.addRow(headerValues);
  headerRow.height = 22;
  headerRow.eachCell((cell, colNumber) => {
    cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF292929' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF171717' } },
      bottom: { style: 'medium', color: { argb: 'FF171717' } },
      left: { style: 'thin', color: { argb: 'FF3E3E3E' } },
      right: colNumber === 1 ? { style: 'medium', color: { argb: 'FF171717' } } : { style: 'thin', color: { argb: 'FF3E3E3E' } }
    };
  });

  const coveredByMerge = new Set<string>();
  const pendingLabMerges: Array<{
    startRowNumber: number;
    endRowNumber: number;
    colNumber: number;
    entry: CanonicalTimetableExportEntry;
  }> = [];

  dynamicSlots.forEach((slotMeta, slotIdx) => {
    if (
      computedTiming.middayBreak.enabled &&
      slotMeta.slotNumber === computedTiming.firstAfternoonSlotNumber
    ) {
      const lunchRow = worksheet.addRow([
        `${computedTiming.middayBreak.startTime24} – ${computedTiming.middayBreak.endTime24}`,
        `MIDDAY / LUNCH BREAK (${computedTiming.middayBreak.fullRangeLabel})  •  Protected University Break`
      ]);
      const lunchRowNum = lunchRow.number;
      worksheet.mergeCells(lunchRowNum, 2, lunchRowNum, totalCols);
      lunchRow.height = 20;

      const lunchTimeCell = lunchRow.getCell(1);
      lunchTimeCell.font = { name: 'Calibri', size: 8, bold: true, color: { argb: 'FF171717' } };
      lunchTimeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8D36B' } };
      lunchTimeCell.alignment = { vertical: 'middle', horizontal: 'center' };
      lunchTimeCell.border = {
        top: { style: 'thin', color: { argb: 'FFB59F3B' } },
        bottom: { style: 'thin', color: { argb: 'FFB59F3B' } },
        left: { style: 'thin', color: { argb: 'FFB59F3B' } },
        right: { style: 'medium', color: { argb: 'FFB59F3B' } }
      };

      for (let c = 2; c <= totalCols; c++) {
        const cell = lunchRow.getCell(c);
        cell.font = { name: 'Calibri', size: 8.5, bold: true, color: { argb: 'FF333330' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDEAE0' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFC7C3B6' } },
          bottom: { style: 'thin', color: { argb: 'FFC7C3B6' } },
          left: { style: 'thin', color: { argb: 'FFD6D3C9' } },
          right: { style: 'thin', color: { argb: 'FFD6D3C9' } }
        };
      }
    }

    const row = worksheet.addRow(['']);
    const currentRowNum = row.number;
    let maxEntriesInRow = 1;

    const slotStart24 = minutesToTime24(slotMeta.startMinutes ?? 540);
    const slotEnd24 = minutesToTime24(slotMeta.lectureEndMinutes ?? 590);

    const timeCell = row.getCell(1);
    timeCell.value = {
      richText: [
        {
          font: { name: 'Calibri', size: 8.5, bold: true, color: { argb: 'FF171717' } },
          text: `${slotStart24} – ${slotEnd24}\n`
        },
        {
          font: { name: 'Calibri', size: 7.5, bold: false, color: { argb: 'FF57564F' } },
          text: `${slotMeta.period.replace(' AM', '').replace(' PM', '')}\nSlot ${slotMeta.slotNumber}`
        }
      ]
    };
    timeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F6EF' } };
    timeCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    timeCell.border = {
      top: { style: 'thin', color: { argb: 'FFE4E2DA' } },
      bottom: { style: 'thin', color: { argb: 'FFE4E2DA' } },
      left: { style: 'thin', color: { argb: 'FFD6D3C9' } },
      right: { style: 'medium', color: { argb: 'FFD4D1C7' } }
    };

    days.forEach((day, dIdx) => {
      const colNum = dIdx + 2;
      const cell = row.getCell(colNum);

      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE4E2DA' } },
        bottom: { style: 'thin', color: { argb: 'FFE4E2DA' } },
        left: { style: 'thin', color: { argb: 'FFE4E2DA' } },
        right: { style: 'thin', color: { argb: 'FFE4E2DA' } }
      };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

      if (coveredByMerge.has(`${slotMeta.slotNumber}_${dIdx}`)) {
        return;
      }

      const effSlot = getEffectiveSlotDisplayForDay(day, slotMeta.period, computedTiming);
      const cellEntries = entriesBySlotAndDay.get(`${slotMeta.period}__${day}`) || [];
      maxEntriesInRow = Math.max(maxEntriesInRow, cellEntries.length);

      if (cellEntries.length === 0) {
        if (day === 'Fri' && !effSlot.isOpen) {
          cell.value =
            computedTiming.fridaySchedule.mode === 'morning_only'
              ? 'Friday Half-Day Closed'
              : 'Jummah Prayer Break';
          cell.font = { name: 'Calibri', size: 7.5, italic: true, color: { argb: 'FF8C8B84' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F6EF' } };
        } else {
          cell.value = '';
        }
        return;
      }

      const continuousLab = cellEntries.find(
        e => e.sessionType === 'Lab' && !e.isSplitLab && e.durationMinutes >= 140
      );
      const labBlock = continuousLab
        ? getLabBlockByStartPeriod(slotMeta.period, store.timeStructure, day)
        : undefined;
      const desiredSpan = continuousLab?.classItem.spanSlots || labBlock?.spanSlots || computedTiming.labSpanSlots || 3;
      const sameSessionSlots = dynamicSlots
        .slice(slotIdx, slotIdx + desiredSpan)
        .filter(s => s.session === slotMeta.session);

      if (continuousLab && cellEntries.length === 1 && sameSessionSlots.length >= 2) {
        sameSessionSlots.slice(1).forEach(subSlot => {
          coveredByMerge.add(`${subSlot.slotNumber}_${dIdx}`);
        });

        const staffLine = continuousLab.labEngineerName
          ? `Instructor: ${continuousLab.instructorName}\nLab Eng: ${continuousLab.labEngineerName}`
          : `Instructor: ${continuousLab.instructorName}`;

        cell.value = {
          richText: [
            {
              font: { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF171717' } },
              text: `${continuousLab.courseCode} — ${continuousLab.courseTitle}\n`
            },
            {
              font: { name: 'Calibri', size: 8, bold: true, color: { argb: 'FF292929' } },
              text: `[LAB • ${continuousLab.startTime24}–${continuousLab.endTime24} (${continuousLab.durationMinutes}m)]\n`
            },
            {
              font: { name: 'Calibri', size: 8, bold: false, color: { argb: 'FF333330' } },
              text: `${staffLine}\n${continuousLab.roomCode}${isSingleClassSheet ? '' : ` · ${continuousLab.cohortCode}`}`
            }
          ]
        };

        const pastel = getCourseArgb(continuousLab.courseCode);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: pastel.argb } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

        pendingLabMerges.push({
          startRowNumber: currentRowNum,
          endRowNumber: currentRowNum + sameSessionSlots.length - 1,
          colNumber: colNum,
          entry: continuousLab
        });
      } else {
        // Render ALL entries in the cell cleanly (never drop concurrent sections)
        const richParts: ExcelJS.RichText[] = [];
        cellEntries.forEach((entry, idx) => {
          if (idx > 0) {
            richParts.push({
              font: { name: 'Calibri', size: 7, color: { argb: 'FF77766F' } },
              text: '\n────────────\n'
            });
          }
          const badge = entry.sessionType === 'Lab'
            ? entry.isSplitLab
              ? `SPLIT LAB ${entry.durationMinutes}m`
              : `LAB ${entry.durationMinutes}m`
            : `LEC ${entry.durationMinutes}m`;
          const friTag = entry.slotSource === 'friday_compressed' ? ' · FRI' : '';
          const staffStr =
            entry.sessionType === 'Lab' && entry.labEngineerName
              ? `${entry.instructorName} / Lab Eng: ${entry.labEngineerName}`
              : entry.instructorName;

          richParts.push(
            {
              font: { name: 'Calibri', size: cellEntries.length > 1 ? 8 : 9, bold: true, color: { argb: 'FF171717' } },
              text: `${entry.courseCode}: ${entry.courseTitle}\n`
            },
            {
              font: { name: 'Calibri', size: 7.5, bold: true, color: { argb: 'FF292929' } },
              text: `[${badge}${friTag}] ${entry.startTime24}–${entry.endTime24}\n`
            },
            {
              font: { name: 'Calibri', size: 7.5, bold: false, color: { argb: 'FF444440' } },
              text: `${staffStr} • ${entry.roomCode}${isSingleClassSheet ? '' : ` [${entry.cohortCode}]`}`
            }
          );
        });

        cell.value = { richText: richParts };
        const pastel = getCourseArgb(cellEntries[0].courseCode);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: pastel.argb } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = {
          top: { style: 'thin', color: { argb: pastel.borderArgb } },
          bottom: { style: 'thin', color: { argb: pastel.borderArgb } },
          left: { style: 'thin', color: { argb: pastel.borderArgb } },
          right: { style: 'thin', color: { argb: pastel.borderArgb } }
        };
      }
    });

    const baseRowH = isSingleClassSheet ? 48 : 50;
    row.height = maxEntriesInRow > 1 ? Math.min(180, baseRowH + (maxEntriesInRow - 1) * 34) : baseRowH;
  });

  pendingLabMerges.forEach(mergeItem => {
    worksheet.mergeCells(
      mergeItem.startRowNumber,
      mergeItem.colNumber,
      mergeItem.endRowNumber,
      mergeItem.colNumber
    );
    const pastel = getCourseArgb(mergeItem.entry.courseCode);
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

  const model = buildCanonicalExportModel({
    store,
    scheduleData,
    filterClass,
    scope
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SmartGrid AI — University Scheduling Platform';
  workbook.created = new Date();
  workbook.modified = new Date();

  const usedSheetNames = new Set<string>();

  const groupsToExport: StudentGroup[] = store.studentGroups.filter(grp => {
    const hasSessionsInScope = model.entries.some(
      e => e.studentGroupId === grp.id || e.classItem.sharedGroupIds?.includes(grp.id)
    );
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

  // WORKSHEET 1: WEEKLY OVERVIEW
  const overviewTitle = sanitizeWorksheetName('Weekly Overview', usedSheetNames);
  const overviewSheet = workbook.addWorksheet(overviewTitle, {
    views: [{ state: 'frozen', xSplit: 1, ySplit: 3, showGridLines: true }]
  });

  populateCompactLandscapeTimetable({
    worksheet: overviewSheet,
    titleLeft: `${model.institutionName.toUpperCase()} — WEEKLY TIMETABLE OVERVIEW`,
    titleRight: `${model.termName}  •  ${model.entries.length} Sessions (${finalGroups.length} Sections)`,
    subtitleText: `Scope: ${scopeLabel.replace(/_/g, ' ')}   |   Days: ${model.days.join(', ')}   |   ${model.computedTiming.summaryText}`,
    model,
    entriesForSheet: model.entries,
    isSingleClassSheet: false,
    store
  });

  // WORKSHEETS 2..N: ONE TAB PER CLASS / SECTION
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

    const groupEntries = model.entries.filter(
      e => e.studentGroupId === group.id || e.classItem.sharedGroupIds?.includes(group.id)
    );

    populateCompactLandscapeTimetable({
      worksheet: classSheet,
      titleLeft: `CLASS TIMETABLE: ${group.code}`,
      titleRight: `${group.name} (${semLabel} • ${secLabel})`,
      subtitleText: `Department: ${deptLabel}   |   Home Room: ${roomLabel}   |   Term: ${model.termName}   |   ${model.computedTiming.summaryText}`,
      model,
      entriesForSheet: groupEntries,
      isSingleClassSheet: true,
      store
    });
  });

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
    totalSessionsCount: model.entries.length
  };
}
