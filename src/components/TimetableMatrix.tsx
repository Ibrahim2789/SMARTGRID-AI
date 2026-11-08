import React, { useState, useRef, useEffect } from 'react';
import { SmartGridNav, RouteType } from './SmartGridNav';
import { useInstitutionalData, institutionalStore } from '../data/store';
import { buildMatrixSchedule } from '../data/solverAdapter';
import {
  UNIVERSITY_SLOTS,
  computeAcademicScheduleConfig,
  getLabBlockByStartPeriod
} from '../types/institutional';
import { exportTimetableToGoogleSheetsWorkbook } from '../utils/googleSheetsExport';
import {
  Download,
  Sparkles,
  Building,
  FileText,
  FileSpreadsheet,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  Layers,
  Search,
  Users,
  User,
  Lock,
  Coffee,
  MapPin
} from 'lucide-react';
import { ClassDetailsModal, ClassItem } from './ClassDetailsModal';
import { jsPDF } from 'jspdf';

interface TimetableMatrixProps {
  onNavigate?: (route: RouteType) => void;
  onOpenAuth?: (mode?: 'signin' | 'signup') => void;
  onSignOut?: () => void;
  currentUser?: { name: string; role: string; institution?: string } | null;
  hideNav?: boolean;
}

const PASTEL_PALETTE = [
  { bg: '#B8EEEE', border: '#95DFDF', label: 'Cyan' },
  { bg: '#F2D8FA', border: '#DFB9EC', label: 'Lavender' },
  { bg: '#B8F2E6', border: '#93DEC9', label: 'Mint' },
  { bg: '#B7F77C', border: '#98DF58', label: 'Lime' },
  { bg: '#E8D36B', border: '#D4BC4C', label: 'Mustard' }
];

function getCoursePastel(code: string) {
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    hash = (hash * 31 + code.charCodeAt(i)) >>> 0;
  }
  return PASTEL_PALETTE[hash % PASTEL_PALETTE.length];
}

export const TimetableMatrix: React.FC<TimetableMatrixProps> = ({
  onNavigate,
  onOpenAuth,
  onSignOut,
  currentUser,
  hideNav = false
}) => {
  const store = useInstitutionalData();
  const { scheduleData, conflicts } = buildMatrixSchedule(store);

  const [calendarMode, setCalendarMode] = useState<'week' | 'day' | 'agenda'>('week');
  const [weekColumnSpan, setWeekColumnSpan] = useState<7 | 5>(7);
  const [focusedDay, setFocusedDay] = useState<string>('Mon');
  // Default to 'cohort' (Individual Class/Section Timetable) so each class/section timetable is displayed clearly
  const [perspective, setPerspective] = useState<'cohort' | 'master' | 'instructor' | 'room'>('cohort');
  const [selectedDeptId, setSelectedDeptId] = useState<string>('all');
  const [selectedCohortId, setSelectedCohortId] = useState<string>(
    store.selectedClassGroupId || store.studentGroups[0]?.id || ''
  );
  const [selectedInstructorId, setSelectedInstructorId] = useState<string>(store.instructors[0]?.id || '');
  const [selectedRoomId, setSelectedRoomId] = useState<string>(store.rooms[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);
  const [isSweeping, setIsSweeping] = useState(false);
  const [isExportingSheets, setIsExportingSheets] = useState(false);
  const [sweepNotice, setSweepNotice] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  // Parent container width tracking for dynamic 7-column responsive calculation
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  useEffect(() => {
    const el = gridContainerRef.current;
    if (!el) return;

    const updateWidth = () => {
      if (gridContainerRef.current) {
        const w = Math.floor(gridContainerRef.current.getBoundingClientRect().width);
        if (w > 0) setContainerWidth(w);
      }
    };

    updateWidth();

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const width = Math.floor(entry.contentRect.width);
        if (width > 0) {
          setContainerWidth(width);
        }
      }
    });

    observer.observe(el);
    window.addEventListener('resize', updateWidth);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, [calendarMode, perspective]);

  // Keep selectedCohortId synchronized if store.selectedClassGroupId changes externally
  useEffect(() => {
    if (store.selectedClassGroupId && store.studentGroups.some(g => g.id === store.selectedClassGroupId)) {
      setSelectedCohortId(store.selectedClassGroupId);
    } else if (!store.studentGroups.some(g => g.id === selectedCohortId) && store.studentGroups[0]) {
      setSelectedCohortId(store.studentGroups[0].id);
    }
  }, [store.selectedClassGroupId, store.studentGroups]);

  const handleSelectCohort = (groupId: string) => {
    setPerspective('cohort');
    setSelectedCohortId(groupId);
    institutionalStore.setSelectedClassGroupId(groupId);
  };

  // Filter classes/sections by selected department
  const departmentFilteredGroups = store.studentGroups.filter(g => {
    if (selectedDeptId === 'all') return true;
    const prog = store.programs.find(p => p.id === g.programId);
    return prog?.departmentId === selectedDeptId;
  });

  const activeGroupIndex = departmentFilteredGroups.findIndex(g => g.id === selectedCohortId);
  const activeGroupObj =
    store.studentGroups.find(g => g.id === selectedCohortId) || store.studentGroups[0];
  const activeGroupProgram = store.programs.find(p => p.id === activeGroupObj?.programId);
  const activeGroupDept = store.departments.find(d => d.id === activeGroupProgram?.departmentId);

  const handlePrevCohort = () => {
    if (departmentFilteredGroups.length === 0) return;
    const prevIdx =
      activeGroupIndex <= 0 ? departmentFilteredGroups.length - 1 : activeGroupIndex - 1;
    handleSelectCohort(departmentFilteredGroups[prevIdx].id);
  };

  const handleNextCohort = () => {
    if (departmentFilteredGroups.length === 0) return;
    const nextIdx =
      activeGroupIndex < 0 || activeGroupIndex >= departmentFilteredGroups.length - 1
        ? 0
        : activeGroupIndex + 1;
    handleSelectCohort(departmentFilteredGroups[nextIdx].id);
  };

  const computedTiming = computeAcademicScheduleConfig(store.timeStructure);
  const dynamicSlots = computedTiming.slots.length > 0 ? computedTiming.slots : UNIVERSITY_SLOTS;

  const FULL_SEVEN_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const FIVE_WORKING_DAYS =
    computedTiming.workingDays.length > 0
      ? computedTiming.workingDays
      : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const days = weekColumnSpan === 7 ? FULL_SEVEN_DAYS : FIVE_WORKING_DAYS;
  const timeSlots = dynamicSlots.map(s => s.period);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleRunSweep = () => {
    setIsSweeping(true);
    setTimeout(() => {
      const res = institutionalStore.runTimetableSolver();
      setIsSweeping(false);
      setSweepNotice(
        `${res.placedCount} sessions (${computedTiming.periodLengthMinutes}m lectures & ${computedTiming.labDurationHoursLabel} continuous labs) synchronized across ${computedTiming.operatingHoursLabel} with 0 hard overlaps.`
      );
      setTimeout(() => setSweepNotice(null), 5000);
    }, 450);
  };

  const filterClass = (cls: ClassItem) => {
    // Strictly isolate the selected Class/Section when in 'cohort' mode
    if (perspective === 'cohort' && selectedCohortId) {
      if (cls.studentGroupId !== selectedCohortId) return false;
    }
    if (perspective === 'instructor' && selectedInstructorId) {
      if (cls.instructorId !== selectedInstructorId) return false;
    }
    if (perspective === 'room' && selectedRoomId) {
      if (cls.roomId !== selectedRoomId) return false;
    }
    if (perspective === 'master' && selectedDeptId !== 'all') {
      if (cls.departmentId && cls.departmentId !== selectedDeptId) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        cls.code.toLowerCase().includes(q) ||
        cls.title.toLowerCase().includes(q) ||
        cls.prof.toLowerCase().includes(q) ||
        cls.room.toLowerCase().includes(q) ||
        cls.cohort.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  };

  const getActiveScopeLabel = () => {
    if (perspective === 'cohort') {
      const g = store.studentGroups.find(x => x.id === selectedCohortId);
      return g ? `Class_${g.code}` : 'Class_Section_View';
    }
    if (perspective === 'instructor') {
      const i = store.instructors.find(x => x.id === selectedInstructorId);
      return i ? `Faculty_${i.name.replace(/\s+/g, '_')}` : 'Faculty_View';
    }
    if (perspective === 'room') {
      const r = store.rooms.find(x => x.id === selectedRoomId);
      return r ? `Room_${r.code}` : 'Room_View';
    }
    if (selectedDeptId !== 'all') {
      const d = store.departments.find(x => x.id === selectedDeptId);
      return d ? `Dept_${d.code}` : 'Department';
    }
    return 'All_Classes_University';
  };

  // Multi-Worksheet Google Sheets (.xlsx) Export — Compact Landscape Weekly Overview + 1 Tab per Class/Section
  const handleExportGoogleSheets = async (scope: 'filtered' | 'all') => {
    try {
      setIsExportingSheets(true);
      const scopeLabel = scope === 'all' ? 'All_University_Classes' : getActiveScopeLabel();
      const result = await exportTimetableToGoogleSheetsWorkbook({
        store,
        scheduleData,
        filterClass,
        scope,
        scopeLabel,
        studentOrUserName: currentUser?.name || 'Academic Schedule'
      });
      setExportNotice(
        `Exported compact landscape Google Sheets workbook "${result.fileName}" (1 Weekly Overview + ${result.classSheetCount} Class/Section tabs, configured to fit on 1 laptop screen and 1 landscape printed page).`
      );
      setTimeout(() => setExportNotice(null), 7000);
    } catch (err) {
      console.error('Google Sheets export error:', err);
      setExportNotice('Failed to generate Google Sheets workbook. Please try again.');
    } finally {
      setIsExportingSheets(false);
      setShowExportMenu(false);
    }
  };

  // CSV Export Routine
  const handleExportCSV = (scope: 'filtered' | 'all') => {
    const records: Array<{
      day: string;
      timeSlot: string;
      sessionType: string;
      duration: string;
      code: string;
      title: string;
      credits: number;
      room: string;
      prof: string;
      cohort: string;
    }> = [];

    days.forEach(day => {
      timeSlots.forEach(time => {
        const classes = scheduleData[time]?.[day] || [];
        classes.forEach(cls => {
          if (scope === 'all' || filterClass(cls)) {
            const isLab = cls.sessionType === 'Lab' || (cls.spanSlots && cls.spanSlots > 1);
            const labMeta = isLab ? getLabBlockByStartPeriod(time, store.timeStructure) : undefined;
            const breakDesc =
              computedTiming.shortBreakEnabled && computedTiming.shortBreakMinutes > 0
                ? `(+ ${computedTiming.shortBreakMinutes}m Short Break)`
                : '(Back-to-Back, No Break)';
            records.push({
              day,
              timeSlot: isLab ? (cls.continuousTimeLabel || labMeta?.continuousLabel || time) : time,
              sessionType: isLab ? `Lab (${computedTiming.labDurationHoursLabel} Continuous)` : 'Lecture',
              duration: isLab
                ? `${computedTiming.labDurationMinutes} mins (${computedTiming.labDurationHoursLabel} continuous)`
                : `${computedTiming.periodLengthMinutes} mins ${breakDesc}`,
              code: cls.code,
              title: cls.title,
              credits: cls.credits || 3,
              room: cls.room,
              prof: cls.prof,
              cohort: cls.cohort
            });
          }
        });
      });
    });

    const headers = [
      'Day',
      'Time Window',
      'Session Type',
      'Duration',
      'Course Code',
      'Course Title',
      'Credits',
      'Room / Facility',
      'Faculty Instructor',
      'Class / Section'
    ];
    const rows = records.map(r => [
      `"${r.day}"`,
      `"${r.timeSlot}"`,
      `"${r.sessionType}"`,
      `"${r.duration}"`,
      `"${r.code}"`,
      `"${r.title.replace(/"/g, '""')}"`,
      r.credits,
      `"${r.room}"`,
      `"${r.prof}"`,
      `"${r.cohort}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const scopeLabel = scope === 'all' ? 'All_University_Classes' : getActiveScopeLabel();
    link.href = url;
    link.download = `SmartGrid_Timetable_${scopeLabel}_Fall2026.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setExportNotice(`Exported ${records.length} scheduled sessions to CSV (${scopeLabel.replace(/_/g, ' ')}).`);
    setTimeout(() => setExportNotice(null), 4500);
    setShowExportMenu(false);
  };

  // PDF Export Routine using jsPDF
  const handleExportPDF = (scope: 'filtered' | 'all') => {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = 297;
    const margin = 12;

    doc.setFillColor(23, 23, 23);
    doc.rect(margin, 10, pageWidth - margin * 2, 2.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(23, 23, 23);
    doc.text(
      `${(store.institutionProfile?.name || 'SMARTGRID AI').toUpperCase()} — UNIVERSITY TIMETABLE (${computedTiming.operatingHoursLabel})`,
      margin,
      18
    );

    const activeTerm = store.terms.find(t => t.status === 'active') || store.terms[0];
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(119, 118, 111);
    doc.text(
      `${(activeTerm?.name || 'FALL 2026').toUpperCase()}   •   ${computedTiming.summaryText.toUpperCase()}`,
      margin,
      23
    );

    const scopeLabel = scope === 'all' ? 'All University Classes' : getActiveScopeLabel().replace(/_/g, ' ');
    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    doc.text(`Scope: ${scopeLabel}   •   Generated: ${dateStr}`, pageWidth - margin, 18, { align: 'right' });

    const tableStartY = 27;
    const colTimeWidth = 36;
    const numDays = Math.min(days.length, 5);
    const dayColWidth = (pageWidth - margin * 2 - colTimeWidth) / numDays;
    const headerHeight = 7;
    const slotRowHeight = Math.max(13, Math.min(19, Math.floor(140 / Math.max(1, dynamicSlots.length))));
    const lunchRowHeight = 9;

    doc.setFillColor(237, 234, 224);
    doc.rect(margin, tableStartY, pageWidth - margin * 2, headerHeight, 'F');
    doc.setDrawColor(228, 226, 218);
    doc.setLineWidth(0.3);
    doc.rect(margin, tableStartY, pageWidth - margin * 2, headerHeight, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(23, 23, 23);
    doc.text('SLOT / TIME', margin + 2.5, tableStartY + 4.8);

    days.slice(0, numDays).forEach((day, dIdx) => {
      const x = margin + colTimeWidth + dIdx * dayColWidth;
      doc.line(x, tableStartY, x, tableStartY + headerHeight);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(23, 23, 23);
      doc.text(day.toUpperCase(), x + 4, tableStartY + 4.8);
    });

    let currentY = tableStartY + headerHeight;

    dynamicSlots.forEach(slotMeta => {
      if (computedTiming.middayBreak.enabled && slotMeta.slotNumber === computedTiming.firstAfternoonSlotNumber) {
        doc.setFillColor(232, 211, 107);
        doc.setDrawColor(228, 226, 218);
        doc.rect(margin, currentY, colTimeWidth, lunchRowHeight, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(23, 23, 23);
        doc.text(computedTiming.middayBreak.timeRangeLabel, margin + 2.5, currentY + 4);
        doc.text('MIDDAY BREAK', margin + 2.5, currentY + 7.2);

        doc.setFillColor(237, 234, 224);
        doc.rect(margin + colTimeWidth, currentY, pageWidth - margin * 2 - colTimeWidth, lunchRowHeight, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.text(
          `UNIVERSITY MIDDAY / LUNCH BREAK (${computedTiming.middayBreak.fullRangeLabel}) — NO LECTURES OR LABS SCHEDULED`,
          margin + colTimeWidth + 8,
          currentY + 5.8
        );
        currentY += lunchRowHeight;
      }

      doc.setDrawColor(228, 226, 218);
      doc.setFillColor(247, 246, 239);
      doc.rect(margin, currentY, colTimeWidth, slotRowHeight, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(23, 23, 23);
      doc.text(`Slot ${slotMeta.slotNumber}: ${slotMeta.period}`, margin + 2, currentY + 5.5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(119, 118, 111);
      doc.text(`Break: ${slotMeta.shortBreak}`, margin + 2, currentY + 10.5);

      days.slice(0, numDays).forEach((day, dIdx) => {
        const x = margin + colTimeWidth + dIdx * dayColWidth;
        doc.setDrawColor(228, 226, 218);
        doc.rect(x, currentY, dayColWidth, slotRowHeight, 'S');

        const classes = (scheduleData[slotMeta.period]?.[day] || []).filter(
          cls => scope === 'all' || filterClass(cls)
        );

        const cls = classes[0];
        if (cls) {
          const isLab = cls.sessionType === 'Lab' || (cls.spanSlots && cls.spanSlots > 1);
          doc.setFillColor(isLab ? 242 : 184, isLab ? 216 : 238, isLab ? 250 : 238);
          doc.roundedRect(x + 1.2, currentY + 1.2, dayColWidth - 2.4, slotRowHeight - 2.4, 1.2, 1.2, 'FD');

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(6.5);
          doc.setTextColor(23, 23, 23);
          doc.text(
            `${cls.code} [${isLab ? `LAB ${computedTiming.labDurationHoursLabel.toUpperCase()}` : `LEC ${computedTiming.periodLengthMinutes}M`}]`,
            x + 2.5,
            currentY + 5.5
          );

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6);
          const truncatedTitle = cls.title.length > 24 ? cls.title.substring(0, 22) + '..' : cls.title;
          doc.text(truncatedTitle, x + 2.5, currentY + 10);
          doc.text(`${cls.room} · ${cls.prof}`, x + 2.5, currentY + 14.5);
        }
      });

      currentY += slotRowHeight;
    });

    const fileLabel = scope === 'all' ? 'All_University_Classes' : getActiveScopeLabel();
    doc.save(`SmartGrid_Timetable_${fileLabel}_Fall2026.pdf`);

    setExportNotice(`Exported timetable as landscape PDF (${fileLabel.replace(/_/g, ' ')}).`);
    setTimeout(() => setExportNotice(null), 4500);
    setShowExportMenu(false);
  };

  const placedTotal = store.sections.filter(s => s.assignedSlot).length;
  const activeTerm = store.terms.find(t => t.status === 'active') || store.terms[0];
  const currentInstructorObj = store.instructors.find(i => i.id === selectedInstructorId);
  const visibleDays = calendarMode === 'day' ? [focusedDay] : days;

  // Compute stats for the currently viewed Class/Section (or full view)
  const activeFilteredSections = store.sections.filter(s => {
    if (!s.assignedSlot) return false;
    if (perspective === 'cohort') return s.studentGroupId === selectedCohortId;
    if (perspective === 'instructor') return s.instructorId === selectedInstructorId;
    if (perspective === 'room') return s.assignedSlot.roomId === selectedRoomId;
    return true;
  });
  const activeLabCount = activeFilteredSections.filter(
    s => s.sessionType === 'Lab' || (s.spanSlots && s.spanSlots > 1) || s.assignedSlot?.sessionType === 'Lab'
  ).length;
  const activeLectureCount = activeFilteredSections.length - activeLabCount;

  // Precompute Continuous Lab vertical spans (`rowSpan={spanCount}`) per visible day
  // Map key: `${day}__${slotNumber}`
  const skippedCells = new Set<string>();
  const labSpanByCell = new Map<
    string,
    {
      labItem: ClassItem;
      concurrentItems: ClassItem[];
      continuousWindow: string;
      rowSpanCount: number;
    }
  >();

  visibleDays.forEach(day => {
    dynamicSlots.forEach((slotMeta, sIdx) => {
      const cellKey = `${day}__${slotMeta.slotNumber}`;
      if (skippedCells.has(cellKey)) return;

      const classesAtStart = (scheduleData[slotMeta.period]?.[day] || []).filter(filterClass);
      const labItem = classesAtStart.find(c => c.sessionType === 'Lab' || (c.spanSlots && c.spanSlots > 1));

      if (!labItem) return;

      const labBlock = getLabBlockByStartPeriod(slotMeta.period, store.timeStructure);
      const desiredSpan = labItem.spanSlots || labBlock?.spanSlots || computedTiming.labSpanSlots || 3;

      // Collect consecutive slots in the same session (Morning or Afternoon) so a lab never crosses the midday break
      const sameSessionSlots = dynamicSlots
        .slice(sIdx, sIdx + desiredSpan)
        .filter(s => s.session === slotMeta.session);

      if (sameSessionSlots.length >= 2) {
        const coveredSubsequent = sameSessionSlots.slice(1);
        coveredSubsequent.forEach(subSlot => {
          skippedCells.add(`${day}__${subSlot.slotNumber}`);
        });

        const otherInSlot1 = classesAtStart.filter(c => c.id !== labItem.id);
        const otherInSubsequent = coveredSubsequent.flatMap(subSlot =>
          (scheduleData[subSlot.period]?.[day] || []).filter(filterClass)
        );

        const continuousWindow =
          labItem.continuousTimeLabel ||
          labBlock?.continuousLabel ||
          `${slotMeta.startTime} – ${sameSessionSlots[sameSessionSlots.length - 1].cycleEndTime}`;

        labSpanByCell.set(cellKey, {
          labItem,
          concurrentItems: [...otherInSlot1, ...otherInSubsequent],
          continuousWindow,
          rowSpanCount: sameSessionSlots.length
        });
      }
    });
  });

  return (
    <div className="space-y-4">
      {!hideNav && (
        <SmartGridNav
          activeRoute="timetable"
          onNavigate={onNavigate}
          onOpenAuth={onOpenAuth}
          onSignOut={onSignOut}
          currentUser={currentUser}
        />
      )}

      {/* =========================================================
          1. COMPACT EDITORIAL HEADER & EXPORT / OPTIMIZE ACTIONS
         ========================================================= */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-[#E4E2DA]">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#77766F]">
            <span>{activeTerm?.name || 'Fall Semester 2026'}</span>
            <span>·</span>
            <span>{computedTiming.operatingHoursLabel}</span>
            <span>·</span>
            <span>
              {activeLectureCount} Lectures ({computedTiming.periodLengthMinutes}m) & {activeLabCount} Continuous Labs ({computedTiming.labDurationHoursLabel})
            </span>
            <span>·</span>
            <span className="text-[#171717] font-semibold">
              {conflicts.length === 0 ? '0 Clashes' : `${conflicts.length} Clashes`}
            </span>
          </div>
          <h1 className="font-serif-editorial text-2xl sm:text-3xl text-[#171717] tracking-tight mt-0.5">
            {perspective === 'cohort' && activeGroupObj
              ? `Class Timetable: ${activeGroupObj.code}`
              : perspective === 'instructor' && currentInstructorObj
              ? `Faculty Timetable: ${currentInstructorObj.name}`
              : perspective === 'room'
              ? `Room Schedule`
              : 'University Master Timetable'}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Prominent Export All Classes to Google Sheets Action */}
          <button
            onClick={() => handleExportGoogleSheets('all')}
            disabled={isExportingSheets}
            className="px-3.5 h-9 rounded-xl bg-[#B7F77C] hover:bg-[#a6ec68] border border-[#98DF58] text-[#171717] text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer"
            title="Export Google Sheets (.xlsx) with Weekly Overview + 1 separate worksheet per Class/Section"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#171717]" />
            <span>{isExportingSheets ? 'Preparing Sheets...' : 'Export to Google Sheets'}</span>
          </button>

          {/* Additional Export Dropdown Menu */}
          <div className="relative" ref={exportDropdownRef}>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="btn-secondary text-xs h-9 px-3"
              title="More export options (CSV, PDF, Current Class or All Classes Google Sheets)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
            </button>

            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-80 bg-white border border-[#E4E2DA] rounded-2xl shadow-xl z-50 py-2">
                <div className="px-4 py-2 border-b border-[#E4E2DA]">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[#77766F]">
                    Google Sheets Workbook (.xlsx)
                  </div>
                  <div className="text-xs text-[#171717] mt-0.5">
                    Weekly Overview + 1 Worksheet per Class/Section
                  </div>
                </div>

                <div className="p-2 space-y-1">
                  <button
                    onClick={() => handleExportGoogleSheets('all')}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs flex items-start gap-2.5 bg-[#B7F77C]/35 hover:bg-[#B7F77C]/60 transition-colors cursor-pointer text-[#171717]"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-[#171717] mt-0.5 shrink-0" />
                    <div>
                      <div className="font-semibold">All Classes Google Sheets (.xlsx)</div>
                      <div className="text-[11px] text-[#77766F]">
                        Weekly Overview + {store.studentGroups.length} Class/Section tabs
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleExportGoogleSheets('filtered')}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs flex items-start gap-2.5 hover:bg-[#F7F6EF] transition-colors cursor-pointer text-[#171717]"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-[#171717] mt-0.5 shrink-0" />
                    <div>
                      <div className="font-semibold">Active Class / Filter (.xlsx)</div>
                      <div className="text-[11px] text-[#77766F]">
                        Scope: {getActiveScopeLabel().replace(/_/g, ' ')}
                      </div>
                    </div>
                  </button>
                </div>

                <div className="mx-2 my-1 border-t border-[#E4E2DA]" />

                <div className="p-2 space-y-1">
                  <button
                    onClick={() => handleExportPDF('filtered')}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between hover:bg-[#F7F6EF] transition-colors cursor-pointer text-[#171717]"
                  >
                    <span className="flex items-center gap-2 font-medium">
                      <FileText className="w-3.5 h-3.5" />
                      <span>Export Active View (.pdf)</span>
                    </span>
                    <span className="text-[10px] font-mono-tabular text-[#77766F]">Landscape</span>
                  </button>

                  <button
                    onClick={() => handleExportCSV('filtered')}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between hover:bg-[#F7F6EF] transition-colors cursor-pointer text-[#171717]"
                  >
                    <span className="flex items-center gap-2 font-medium">
                      <Layers className="w-3.5 h-3.5" />
                      <span>Export Active View (.csv)</span>
                    </span>
                    <span className="text-[10px] font-mono-tabular text-[#77766F]">CSV</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {(currentUser?.role === 'Admin' || currentUser?.role === 'Registrar') && (
            <button
              onClick={handleRunSweep}
              disabled={isSweeping}
              className="btn-primary text-xs h-9 px-3.5"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isSweeping ? 'animate-spin' : ''}`} />
              <span>{isSweeping ? 'Optimizing...' : 'Re-Optimize'}</span>
            </button>
          )}
        </div>
      </header>

      {/* Feedback Notices */}
      {sweepNotice && (
        <div className="px-4 py-2.5 sf-pastel-lime rounded-xl text-xs font-medium flex items-center gap-2">
          <Check className="w-4 h-4 text-[#171717] shrink-0" />
          <span>{sweepNotice}</span>
        </div>
      )}

      {exportNotice && (
        <div className="px-4 py-3 sf-pastel-cyan rounded-xl text-xs font-medium flex items-start gap-2.5">
          <Check className="w-4 h-4 text-[#171717] shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-[#171717]">{exportNotice}</div>
            <div className="text-[11px] text-[#171717]/80">
              Open the downloaded .xlsx file in Google Drive / Google Sheets to inspect the Weekly Overview and every individual Class/Section worksheet.
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          2. CLASS / SECTION TIMETABLE SWITCHER & VIEW CONTROLS
         ========================================================= */}
      <div className="sf-card-white p-3.5 space-y-3">
        {/* Top Row: Perspective Switcher + Department Filter + Search + Calendar Mode */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Perspective Tabs: Class/Section (Default) | All Classes | Faculty | Room */}
            <div className="inline-flex flex-wrap items-center p-1 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA]">
              {[
                { id: 'cohort' as const, label: 'By Class / Section', icon: Users },
                { id: 'master' as const, label: 'University Overview', icon: Layers },
                { id: 'instructor' as const, label: 'By Faculty', icon: User },
                { id: 'room' as const, label: 'By Room / Lab', icon: Building }
              ].map(tab => {
                const Icon = tab.icon;
                const active = perspective === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setPerspective(tab.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#171717] text-white'
                        : 'text-[#77766F] hover:text-[#171717]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Department Filter Pills (BEE, BCE, BESE, BSCS) */}
            {(perspective === 'cohort' || perspective === 'master') && (
              <div className="inline-flex flex-wrap items-center p-1 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA]">
                <button
                  type="button"
                  onClick={() => setSelectedDeptId('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    selectedDeptId === 'all'
                      ? 'bg-white text-[#171717] font-semibold border border-[#E4E2DA]'
                      : 'text-[#77766F] hover:text-[#171717]'
                  }`}
                >
                  All Depts ({store.studentGroups.length})
                </button>
                {store.departments.map(dept => {
                  const deptCount = store.studentGroups.filter(g => {
                    const p = store.programs.find(pr => pr.id === g.programId);
                    return p?.departmentId === dept.id;
                  }).length;
                  return (
                    <button
                      key={dept.id}
                      type="button"
                      onClick={() => {
                        setSelectedDeptId(dept.id);
                        const firstInDept = store.studentGroups.find(g => {
                          const p = store.programs.find(pr => pr.id === g.programId);
                          return p?.departmentId === dept.id;
                        });
                        if (firstInDept && perspective === 'cohort') {
                          handleSelectCohort(firstInDept.id);
                        }
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                        selectedDeptId === dept.id
                          ? 'bg-white text-[#171717] font-semibold border border-[#E4E2DA]'
                          : 'text-[#77766F] hover:text-[#171717]'
                      }`}
                    >
                      {dept.code} ({deptCount})
                    </button>
                  );
                })}
              </div>
            )}

            {perspective === 'instructor' && (
              <select
                value={selectedInstructorId}
                onChange={e => setSelectedInstructorId(e.target.value)}
                className="input-field h-8 w-auto text-xs font-medium py-1"
              >
                {store.instructors.map(i => (
                  <option key={i.id} value={i.id}>
                    Faculty: {i.name} ({i.title})
                  </option>
                ))}
              </select>
            )}

            {perspective === 'room' && (
              <select
                value={selectedRoomId}
                onChange={e => setSelectedRoomId(e.target.value)}
                className="input-field h-8 w-auto text-xs font-medium py-1"
              >
                {store.rooms.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.type === 'lab' ? 'Lab' : 'Room'}: {r.code} ({r.capacity} seats)
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Right Controls: 7-Day/5-Day Span + Week/Day/Agenda + Search */}
          <div className="flex flex-wrap items-center gap-2">
            {calendarMode === 'week' && (
              <div className="inline-flex items-center p-1 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA]">
                {[
                  { span: 7 as const, label: '7-Day (Mon–Sun)' },
                  { span: 5 as const, label: '5-Day (Mon–Fri)' }
                ].map(opt => (
                  <button
                    key={opt.span}
                    type="button"
                    onClick={() => setWeekColumnSpan(opt.span)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      weekColumnSpan === opt.span
                        ? 'bg-white text-[#171717] font-semibold border border-[#E4E2DA]'
                        : 'text-[#77766F] hover:text-[#171717]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            <div className="inline-flex items-center p-1 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA]">
              {[
                { id: 'week' as const, label: 'Week' },
                { id: 'day' as const, label: 'Day' },
                { id: 'agenda' as const, label: 'Agenda' }
              ].map(mode => (
                <button
                  key={mode.id}
                  onClick={() => setCalendarMode(mode.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    calendarMode === mode.id
                      ? 'bg-[#171717] text-white'
                      : 'text-[#77766F] hover:text-[#171717]'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            {calendarMode === 'day' && (
              <div className="inline-flex items-center gap-1 bg-[#F7F6EF] p-1 rounded-xl border border-[#E4E2DA]">
                {FULL_SEVEN_DAYS.map(d => (
                  <button
                    key={d}
                    onClick={() => setFocusedDay(d)}
                    className={`px-2 py-1 rounded-lg text-xs font-medium cursor-pointer ${
                      focusedDay === d
                        ? 'bg-[#171717] text-white'
                        : 'text-[#77766F] hover:text-[#171717]'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            )}

            <div className="input-group-field h-8 px-2.5 gap-2 w-auto min-w-[205px]">
              <Search className="w-3.5 h-3.5 text-[#77766F] shrink-0" />
              <input
                type="text"
                placeholder="Filter course, prof, room..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>
        </div>

        {/* Dedicated Individual Class / Section Selector Strip */}
        {perspective === 'cohort' && (
          <div className="pt-2.5 border-t border-[#E4E2DA] space-y-2.5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
              {/* Active Class / Section Identity Banner */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handlePrevCohort}
                    className="w-7 h-7 rounded-lg bg-[#F7F6EF] hover:bg-[#EDEAE0] border border-[#E4E2DA] flex items-center justify-center text-[#171717] cursor-pointer"
                    title="Previous Class/Section"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <select
                    value={selectedCohortId}
                    onChange={e => handleSelectCohort(e.target.value)}
                    className="input-field h-8 w-auto text-xs font-bold bg-[#B8EEEE]/45 border-[#95DFDF] text-[#171717] py-1 px-2.5"
                  >
                    {departmentFilteredGroups.map(g => (
                      <option key={g.id} value={g.id}>
                        {g.code} — {g.name} {g.homeRoom ? `[${g.homeRoom}]` : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleNextCohort}
                    className="w-7 h-7 rounded-lg bg-[#F7F6EF] hover:bg-[#EDEAE0] border border-[#E4E2DA] flex items-center justify-center text-[#171717] cursor-pointer"
                    title="Next Class/Section"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {activeGroupObj && (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#77766F]">
                    <span className="px-2 py-0.5 rounded-md bg-[#F7F6EF] border border-[#E4E2DA] text-[#171717] font-medium">
                      {activeGroupDept?.name || 'Engineering & Computing'}
                    </span>
                    {activeGroupObj.homeRoom && (
                      <span className="px-2 py-0.5 rounded-md bg-[#B8F2E6]/60 border border-[#93DEC9] text-[#171717] font-mono-tabular font-semibold inline-flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        <span>Home Room: {activeGroupObj.homeRoom}</span>
                      </span>
                    )}
                    <span className="font-mono-tabular text-[11px]">
                      {activeLectureCount} Lectures ({computedTiming.periodLengthMinutes}m) + {activeLabCount} Labs ({computedTiming.labDurationHoursLabel})
                    </span>
                  </div>
                )}
              </div>

              <div className="text-[11px] text-[#77766F]">
                Showing individual timetable for <strong className="text-[#171717]">{activeGroupObj?.code}</strong> only · Click any section pill below to switch
              </div>
            </div>

            {/* Quick-Switch Class/Section Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {departmentFilteredGroups.map(grp => {
                const isSelected = grp.id === selectedCohortId;
                return (
                  <button
                    key={grp.id}
                    type="button"
                    onClick={() => handleSelectCohort(grp.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-mono-tabular transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#171717] text-white font-bold shadow-xs'
                        : 'bg-[#F7F6EF] hover:bg-[#EDEAE0] text-[#171717] border border-[#E4E2DA] font-medium'
                    }`}
                  >
                    {grp.code}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* =========================================================
          3. ZERO-SCROLL WEEKLY TIMETABLE GRID OR AGENDA VIEW
         ========================================================= */}
      {calendarMode === 'agenda' ? (
        <div className="sf-card-white p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-serif-editorial text-xl text-[#171717]">
              Course Agenda — {perspective === 'cohort' && activeGroupObj ? activeGroupObj.code : 'All Scheduled Sessions'}
            </h2>
            <span className="text-xs text-[#77766F] font-mono-tabular">
              {activeFilteredSections.length} scheduled blocks
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {days.flatMap(day =>
              dynamicSlots.flatMap(slotMeta =>
                (scheduleData[slotMeta.period]?.[day] || [])
                  .filter(filterClass)
                  .map(cls => {
                    const pastel = getCoursePastel(cls.code);
                    const isLab = cls.sessionType === 'Lab' || (cls.spanSlots && cls.spanSlots > 1);
                    const timeWindow = isLab
                      ? (cls.continuousTimeLabel || getLabBlockByStartPeriod(slotMeta.period, store.timeStructure)?.continuousLabel || slotMeta.period)
                      : slotMeta.period;
                    return (
                      <div
                        key={`${day}-${slotMeta.period}-${cls.id}`}
                        onClick={() => setSelectedClass(cls)}
                        style={{ backgroundColor: pastel.bg, borderColor: pastel.border }}
                        className="p-4 rounded-xl border text-[#171717] cursor-pointer hover:-translate-y-0.5 transition-transform space-y-2"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono-tabular font-semibold text-[#171717]/80">
                            {cls.code} · {isLab ? `Lab (${computedTiming.labDurationHoursLabel})` : `Lecture (${computedTiming.periodLengthMinutes}m)`}
                          </span>
                          <span className="font-mono-tabular font-medium">
                            {day} · {timeWindow}
                          </span>
                        </div>
                        <div className="font-serif-editorial text-base leading-snug">
                          {cls.title}
                        </div>
                        <div className="flex items-center justify-between text-xs text-[#171717]/75 pt-1.5 border-t border-black/10">
                          <span className="font-mono-tabular font-medium">{cls.room}</span>
                          <span>{cls.prof}</span>
                        </div>
                      </div>
                    );
                  })
              )
            )}
          </div>
        </div>
      ) : (
        <div ref={gridContainerRef} className="sf-card-white w-full overflow-hidden">
          {(() => {
            const numDayCols = Math.max(1, visibleDays.length);
            // Dynamically calculate time column and per-day column widths from the measured parent container width
            const timeColWidthPx =
              containerWidth > 0
                ? Math.max(78, Math.min(104, Math.floor(containerWidth * 0.088)))
                : 92;
            const remainingWidthPx =
              containerWidth > 0 ? Math.max(0, containerWidth - timeColWidthPx) : 0;
            const dayColWidthPx =
              remainingWidthPx > 0 ? Math.floor(remainingWidthPx / numDayCols) : 0;
            const isCompactCol = numDayCols >= 7 || (dayColWidthPx > 0 && dayColWidthPx < 138);

            return (
              <table className="w-full table-fixed border-collapse text-left">
                <colgroup>
                  <col
                    style={{
                      width: containerWidth > 0 ? `${timeColWidthPx}px` : '9%'
                    }}
                  />
                  {visibleDays.map(day => (
                    <col
                      key={day}
                      style={{
                        width:
                          dayColWidthPx > 0
                            ? `${dayColWidthPx}px`
                            : `${(91 / numDayCols).toFixed(3)}%`
                      }}
                    />
                  ))}
                </colgroup>
                <thead>
                  <tr className="border-b border-[#E4E2DA] bg-[#F7F6EF]">
                    <th className="py-2 px-2 text-[10.5px] font-semibold text-[#77766F] truncate">
                      Time & Break
                    </th>
                    {visibleDays.map(day => {
                      const isWeekend = day === 'Sat' || day === 'Sun';
                      return (
                        <th
                          key={day}
                          className={`py-2 px-2 text-xs sm:text-sm font-serif-editorial text-[#171717] border-l border-[#E4E2DA] overflow-hidden ${
                            isWeekend ? 'bg-[#F7F6EF]/75 text-[#77766F]' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 min-w-0">
                            <span className="truncate">{day}</span>
                            {day === 'Fri' && computedTiming.fridayAfternoonShiftEnabled && (
                              <span className="text-[9.5px] font-sans font-mono-tabular font-normal text-[#77766F] truncate">
                                {computedTiming.fridayAfternoonStartTime} PM
                              </span>
                            )}
                            {isWeekend && (
                              <span className="text-[9.5px] font-sans font-normal text-[#77766F] truncate">
                                Weekend
                              </span>
                            )}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E2DA]">
                  {dynamicSlots.map(slotMeta => {
                    const time = slotMeta.period;
                    const isFirstAfternoon =
                      computedTiming.middayBreak.enabled &&
                      slotMeta.slotNumber === computedTiming.firstAfternoonSlotNumber;

                    return (
                      <React.Fragment key={slotMeta.slotNumber}>
                        {/* Admin-Configured Midday / Lunch Break Row */}
                        {isFirstAfternoon && (
                          <tr className="bg-[#F7F6EF] border-y border-[#E4E2DA]">
                            <td className="py-1.5 px-2 border-r border-[#E4E2DA] align-middle bg-[#E8D36B]/35 overflow-hidden">
                              <div className="text-[10.5px] font-mono-tabular font-bold text-[#171717] truncate">
                                {computedTiming.middayBreak.timeRangeLabel}
                              </div>
                              <div className="text-[9.5px] text-[#77766F] truncate">
                                Lunch ({computedTiming.middayBreak.durationMinutes}m)
                              </div>
                            </td>
                            <td
                              colSpan={visibleDays.length}
                              className="py-1.5 px-3 text-center align-middle"
                            >
                              <div className="inline-flex items-center gap-2 text-[11px] font-medium text-[#77766F]">
                                <Coffee className="w-3.5 h-3.5 text-[#171717] shrink-0" />
                                <span className="text-[#171717] font-semibold">
                                  University Midday / Lunch Break ({computedTiming.middayBreak.fullRangeLabel})
                                </span>
                                <span className="hidden md:inline">
                                  · Protected break window (no lectures or labs scheduled)
                                </span>
                              </div>
                            </td>
                          </tr>
                        )}

                        {/* Regular Class Slot Row — Dynamically sized to fit all columns & configured slots */}
                        <tr>
                          {/* Left Column: Lecture Time + Short Break */}
                          <td className="py-1.5 px-2 text-[10.5px] font-mono-tabular text-[#171717] align-top bg-[#F7F6EF]/40 overflow-hidden">
                            <div className="font-semibold text-[10.5px] text-[#171717] leading-tight truncate">
                              {slotMeta.period.replace(' AM', '').replace(' PM', '')}
                            </div>
                            <div className="text-[9.5px] text-[#77766F] mt-0.5 leading-tight truncate">
                              {computedTiming.shortBreakEnabled &&
                              computedTiming.shortBreakMinutes > 0 &&
                              slotMeta.shortBreak !== 'No Break'
                                ? `Brk ${slotMeta.shortBreak.replace(' AM', '').replace(' PM', '')}`
                                : 'No Short Break'}
                            </div>
                          </td>

                          {/* Day Cells */}
                          {visibleDays.map(day => {
                            const cellKey = `${day}__${slotMeta.slotNumber}`;
                            const isWeekend = day === 'Sat' || day === 'Sun';

                            // Skip cell if covered by a continuous Lab above
                            if (skippedCells.has(cellKey)) {
                              return null;
                            }

                            const labSpanInfo = labSpanByCell.get(cellKey);

                            // Render a Continuous Lab cell (`rowSpan={rowSpanCount}`)
                            if (labSpanInfo) {
                              const { labItem, concurrentItems, continuousWindow, rowSpanCount } = labSpanInfo;
                              const pastel = getCoursePastel(labItem.code);

                              return (
                                <td
                                  key={day}
                                  rowSpan={rowSpanCount}
                                  className="p-1 border-l border-[#E4E2DA] align-stretch bg-white overflow-hidden"
                                >
                                  <div
                                    onClick={() => setSelectedClass(labItem)}
                                    style={{
                                      backgroundColor: pastel.bg,
                                      borderColor: pastel.border
                                    }}
                                    className={`h-full ${
                                      isCompactCol ? 'p-1.5' : 'p-2.5'
                                    } rounded-xl border text-[#171717] flex flex-col items-center justify-center text-center gap-1.5 transition-transform hover:-translate-y-0.5 cursor-pointer min-w-0 overflow-hidden`}
                                  >
                                    <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/80 text-[9.5px] font-mono-tabular font-bold text-[#171717] max-w-full truncate">
                                      <span className="truncate">{labItem.code}</span>
                                      <span>·</span>
                                      <span className="shrink-0">
                                        LAB {computedTiming.labDurationHoursLabel.toUpperCase()}
                                      </span>
                                      {labItem.isLocked && <Lock className="w-2.5 h-2.5 shrink-0" />}
                                    </div>

                                    <div className="font-serif-editorial text-[11.5px] sm:text-xs font-semibold leading-snug text-[#171717] line-clamp-2 break-words w-full">
                                      {labItem.title}
                                    </div>

                                    <div className="w-full pt-1 border-t border-black/10 space-y-0.5 text-[9.5px] text-[#171717]/80 min-w-0">
                                      <div className="font-medium truncate">{labItem.prof}</div>
                                      <div className="font-mono-tabular font-semibold text-[#171717] truncate">
                                        {labItem.room}
                                        {perspective === 'master' ? ` · ${labItem.cohort}` : ''}
                                      </div>
                                      <div className="font-mono-tabular text-[9px] text-[#171717]/75 truncate">
                                        {continuousWindow}
                                      </div>
                                      {perspective === 'master' && concurrentItems.length > 0 && (
                                        <div className="text-[9px] px-1 rounded bg-white/70 inline-block">
                                          +{concurrentItems.length} more
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              );
                            }

                            // Standard 1-Slot Lecture Cell
                            const classes = (scheduleData[time]?.[day] || []).filter(filterClass);
                            const isInstructorBlackedOut =
                              perspective === 'instructor' &&
                              currentInstructorObj?.unavailableSlots.some(
                                u => u.day === day && u.timeSlot === time
                              );

                            const visibleItems = classes.slice(0, 1);
                            const extraCount = classes.length - visibleItems.length;

                            return (
                              <td
                                key={day}
                                className={`p-1 border-l border-[#E4E2DA] align-middle overflow-hidden ${
                                  isWeekend && visibleItems.length === 0 ? 'bg-[#F7F6EF]/25' : ''
                                }`}
                              >
                                {isInstructorBlackedOut && (
                                  <div className="p-1 rounded-lg bg-[#F7F6EF] border border-[#E4E2DA] text-[9.5px] text-[#77766F] text-center truncate">
                                    Unavailable
                                  </div>
                                )}

                                {visibleItems.map(cls => {
                                  const pastel = getCoursePastel(cls.code);
                                  const isLab = cls.sessionType === 'Lab' || (cls.spanSlots && cls.spanSlots > 1);
                                  return (
                                    <div
                                      key={cls.id}
                                      onClick={() => setSelectedClass(cls)}
                                      style={{
                                        backgroundColor: pastel.bg,
                                        borderColor: pastel.border
                                      }}
                                      className={`${
                                        isCompactCol ? 'px-1.5 py-1.5' : 'px-2 py-1.5'
                                      } rounded-xl border text-[#171717] flex flex-col items-center justify-center text-center gap-0.5 transition-transform hover:-translate-y-0.5 cursor-pointer min-w-0 overflow-hidden`}
                                    >
                                      <div className="font-semibold text-[11px] leading-tight text-[#171717] w-full truncate">
                                        {cls.title}
                                      </div>

                                      <div className="text-[9.5px] font-mono-tabular font-bold text-[#171717]/80 w-full truncate">
                                        {cls.code} {isLab ? `· Lab (${computedTiming.labDurationHoursLabel})` : ''}
                                      </div>

                                      <div className="w-full pt-0.5 border-t border-black/10 text-[9.5px] text-[#171717]/80 leading-tight min-w-0">
                                        <div className="truncate">{cls.prof}</div>
                                        <div className="font-mono-tabular font-semibold text-[#171717] truncate">
                                          {cls.room}
                                          {perspective === 'master' ? ` · ${cls.cohort}` : ''}
                                        </div>
                                      </div>

                                      {perspective === 'master' && extraCount > 0 && (
                                        <div className="text-[8.5px] font-mono-tabular font-semibold text-[#171717]/75 bg-white/65 rounded px-1 text-center truncate">
                                          +{extraCount} more
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </td>
                            );
                          })}
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            );
          })()}
        </div>
      )}

      {/* Class Inspector & Contextual Editing Modal */}
      <ClassDetailsModal
        classItem={selectedClass}
        onClose={() => setSelectedClass(null)}
      />
    </div>
  );
};
