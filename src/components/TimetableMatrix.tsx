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
  MapPin,
  ArrowRightLeft,
  AlertCircle,
  AlertTriangle,
  GripVertical,
  X
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
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  // Interactive Drag-and-Drop and Slot Swap State
  const [draggedClassItem, setDraggedClassItem] = useState<ClassItem | null>(null);
  const [dragOverCellKey, setDragOverCellKey] = useState<string | null>(null);
  const [isSwapMode, setIsSwapMode] = useState<boolean>(false);
  const [swapSourceItem, setSwapSourceItem] = useState<ClassItem | null>(null);

  // Interactive Conflict Inspector and Swap Confirmation Dialog States
  const [conflictDialogData, setConflictDialogData] = useState<{
    sourceItem: ClassItem;
    targetDay: string;
    targetPeriod: string;
    targetRoomId?: string;
    conflicts: Array<{ type: string; message: string; severity: 'hard' | 'warning' }>;
    conflictingItem?: ClassItem | null;
  } | null>(null);

  const [swapDialogData, setSwapDialogData] = useState<{
    itemA: ClassItem;
    itemB: ClassItem;
    conflictsA: Array<{ type: string; message: string; severity: 'hard' | 'warning' }>;
    conflictsB: Array<{ type: string; message: string; severity: 'hard' | 'warning' }>;
  } | null>(null);

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

  // Interactive Drag-and-Drop and Slot Swap Logic
  const handleDropOnSlot = (targetDay: string, rawTargetPeriod: string) => {
    if (!draggedClassItem) return;
    setDragOverCellKey(null);

    const isDraggedLab =
      draggedClassItem.sessionType === 'Lab' ||
      (draggedClassItem.spanSlots && draggedClassItem.spanSlots > 1);
    let targetPeriod = rawTargetPeriod;

    // If dragging a continuous Lab, ensure targetPeriod has enough consecutive slots in the same session to span its full duration
    if (isDraggedLab) {
      const desiredSpan = Math.max(
        2,
        draggedClassItem.spanSlots || computedTiming.labSpanSlots || 3
      );
      const targetSlotIdx = dynamicSlots.findIndex(s => s.period === rawTargetPeriod);
      if (targetSlotIdx >= 0) {
        const targetSession = dynamicSlots[targetSlotIdx].session;
        const sessionSlots = dynamicSlots.filter(s => s.session === targetSession);
        const posInSession = sessionSlots.findIndex(s => s.period === rawTargetPeriod);
        if (posInSession >= 0 && posInSession + desiredSpan > sessionSlots.length) {
          const clampedIndex = Math.max(0, sessionSlots.length - desiredSpan);
          targetPeriod = sessionSlots[clampedIndex]?.period || rawTargetPeriod;
        }
      }
    }

    // If dropped on the same slot, do nothing
    if (draggedClassItem.day === targetDay && draggedClassItem.time === targetPeriod) {
      setDraggedClassItem(null);
      return;
    }

    // Find any existing class at this target day and period
    const existingClasses = (scheduleData[targetPeriod]?.[targetDay] || []).filter(filterClass);
    const conflictingItem = existingClasses[0] || null;

    // Run real-time constraint validation
    const validation = institutionalStore.validateSlotMoveOrSwap(
      draggedClassItem.id,
      targetDay as any,
      targetPeriod,
      draggedClassItem.roomId,
      conflictingItem ? conflictingItem.id : undefined
    );

    if (validation.hasConflicts || conflictingItem) {
      setConflictDialogData({
        sourceItem: draggedClassItem,
        targetDay,
        targetPeriod,
        targetRoomId: draggedClassItem.roomId,
        conflicts: validation.conflicts,
        conflictingItem
      });
    } else {
      institutionalStore.updateSectionSlot(draggedClassItem.id, {
        day: targetDay as any,
        timeSlot: targetPeriod,
        roomId: draggedClassItem.roomId || store.rooms[0]?.id || ''
      });
      setSweepNotice(`Moved ${draggedClassItem.code} to ${targetDay} · ${targetPeriod} with zero conflicts.`);
      setTimeout(() => setSweepNotice(null), 4000);
    }
    setDraggedClassItem(null);
  };

  const handleClassClick = (cls: ClassItem) => {
    if (isSwapMode) {
      if (!swapSourceItem) {
        setSwapSourceItem(cls);
        setSweepNotice(`Selected ${cls.code} (${cls.day} ${cls.time}). Now click another class session to swap.`);
      } else if (swapSourceItem.id === cls.id) {
        setSwapSourceItem(null);
        setSweepNotice('Swap selection cancelled.');
      } else {
        // Validate swap in both directions
        const valA = institutionalStore.validateSlotMoveOrSwap(
          swapSourceItem.id,
          cls.day as any,
          cls.time || '',
          cls.roomId,
          cls.id
        );
        const valB = institutionalStore.validateSlotMoveOrSwap(
          cls.id,
          swapSourceItem.day as any,
          swapSourceItem.time || '',
          swapSourceItem.roomId,
          swapSourceItem.id
        );

        setSwapDialogData({
          itemA: swapSourceItem,
          itemB: cls,
          conflictsA: valA.conflicts,
          conflictsB: valB.conflicts
        });
      }
      return;
    }
    setSelectedClass(cls);
  };

  const handleConfirmSwap = () => {
    if (!swapDialogData) return;
    const { itemA, itemB } = swapDialogData;
    const res = institutionalStore.swapSectionSlots(itemA.id, itemB.id);
    setSwapDialogData(null);
    setSwapSourceItem(null);
    setIsSwapMode(false);
    setSweepNotice(res.message);
    setTimeout(() => setSweepNotice(null), 4000);
  };

  const handleConfirmOverrideMove = () => {
    if (!conflictDialogData) return;
    const { sourceItem, targetDay, targetPeriod, targetRoomId } = conflictDialogData;
    institutionalStore.updateSectionSlot(sourceItem.id, {
      day: targetDay as any,
      timeSlot: targetPeriod,
      roomId: targetRoomId || store.rooms[0]?.id || ''
    });
    setConflictDialogData(null);
    setSweepNotice(`Manually moved ${sourceItem.code} to ${targetDay} · ${targetPeriod} (Override applied).`);
    setTimeout(() => setSweepNotice(null), 4000);
  };

  const handleSwapConflictingClass = () => {
    if (!conflictDialogData || !conflictDialogData.conflictingItem) return;
    const { sourceItem, conflictingItem } = conflictDialogData;
    institutionalStore.swapSectionSlots(sourceItem.id, conflictingItem.id);
    setConflictDialogData(null);
    setSweepNotice(`Swapped ${sourceItem.code} and ${conflictingItem.code}.`);
    setTimeout(() => setSweepNotice(null), 4000);
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

  const currentInstructorObj = store.instructors.find(i => i.id === selectedInstructorId);
  const currentRoomObj = store.rooms.find(r => r.id === selectedRoomId);
  const visibleDays = calendarMode === 'day' ? [focusedDay] : days;

  // Compute stats for the currently viewed Class/Section (or full view)
  const activeFilteredSections = store.sections.filter(s => {
    if (!s.assignedSlot) return false;
    if (perspective === 'cohort') return s.studentGroupId === selectedCohortId;
    if (perspective === 'instructor') return s.instructorId === selectedInstructorId;
    if (perspective === 'room') return s.assignedSlot.roomId === selectedRoomId;
    if (selectedDeptId !== 'all') {
      const grp = store.studentGroups.find(g => g.id === s.studentGroupId);
      const prog = store.programs.find(p => p.id === grp?.programId);
      return prog?.departmentId === selectedDeptId;
    }
    return true;
  });

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
      const labItem = classesAtStart.find(
        c => c.sessionType === 'Lab' || (c.spanSlots && c.spanSlots > 1)
      );

      if (!labItem) return;

      const labBlock = getLabBlockByStartPeriod(slotMeta.period, store.timeStructure);
      const desiredSpan = Math.max(
        2,
        labItem.spanSlots || labBlock?.spanSlots || computedTiming.labSpanSlots || 3
      );

      // Collect consecutive slots in the same session, or fallback to remaining consecutive slots so the Lab always spans its full configured duration
      let spannedSlots = dynamicSlots
        .slice(sIdx, sIdx + desiredSpan)
        .filter(s => s.session === slotMeta.session);

      if (spannedSlots.length < desiredSpan) {
        spannedSlots = dynamicSlots.slice(sIdx, Math.min(dynamicSlots.length, sIdx + desiredSpan));
      }

      if (spannedSlots.length >= 2) {
        const coveredSubsequent = spannedSlots.slice(1);
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
          `${slotMeta.startTime} – ${spannedSlots[spannedSlots.length - 1].cycleEndTime}`;

        labSpanByCell.set(cellKey, {
          labItem,
          concurrentItems: [...otherInSlot1, ...otherInSubsequent],
          continuousWindow,
          rowSpanCount: spannedSlots.length
        });
      }
    });
  });

  return (
    <div className="space-y-4">

      {/* =========================================================
          1. COMPACT EDITORIAL HEADER & COLLAPSED EXPORT / OPTIMIZE ACTIONS
         ========================================================= */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-[#E4E2DA]">
        <div>
          <h1 className="font-serif-editorial text-2xl sm:text-3xl text-[#171717] tracking-tight">
            {perspective === 'cohort' && activeGroupObj
              ? `Class Timetable: ${activeGroupObj.code}`
              : perspective === 'instructor' && currentInstructorObj
              ? `Faculty Timetable: ${currentInstructorObj.name}`
              : perspective === 'room' && currentRoomObj
              ? `Facility Schedule: ${currentRoomObj.code}`
              : selectedDeptId !== 'all'
              ? `Department Timetable: ${
                  store.departments.find(d => d.id === selectedDeptId)?.name || 'Department'
                }`
              : 'University Master Timetable'}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Collapsed Export Dropdown Menu (Includes Google Sheets, PDF, and CSV) */}
          <div className="relative" ref={exportDropdownRef}>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={isExportingSheets}
              className="btn-secondary text-xs h-9 px-3.5"
              title="Export timetable to Google Sheets (.xlsx), PDF, or CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExportingSheets ? 'Exporting...' : 'Export'}</span>
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
                    className="w-full text-left px-3 py-2 rounded-xl text-xs flex items-start gap-2.5 hover:bg-[#F7F6EF] transition-colors cursor-pointer text-[#171717]"
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
          2. FIXED-DIMENSION AGENDA & SCHEDULING SCOPE SELECTOR
          (Stable height & width across all perspectives and calendar modes — zero layout shift)
         ========================================================= */}
      <div className="sf-card-white p-3.5 space-y-2.5">
        {/* ROW 1 (Fixed Height): Perspective Scope Tabs + Calendar Mode Tabs + Swap + Search */}
        <div className="min-h-[40px] flex flex-col xl:flex-row xl:items-center justify-between gap-2.5">
          {/* Perspective Tabs — Uniform height (h-8), fixed padding, non-shifting font weight */}
          <div className="inline-flex flex-wrap items-center p-1 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] shrink-0">
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
                  className={`h-8 px-3 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#171717] text-white'
                      : 'text-[#77766F] hover:text-[#171717]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Right Controls: Week/Day/Agenda Mode + Swap Mode + Fixed-Width Search */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Fixed-width Calendar / Agenda Mode Switcher */}
            <div className="inline-flex items-center p-1 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] shrink-0">
              {[
                { id: 'week' as const, label: 'Week' },
                { id: 'day' as const, label: 'Day' },
                { id: 'agenda' as const, label: 'Agenda' }
              ].map(mode => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setCalendarMode(mode.id)}
                  className={`h-8 w-[68px] rounded-lg text-xs font-semibold inline-flex items-center justify-center transition-colors cursor-pointer ${
                    calendarMode === mode.id
                      ? 'bg-[#171717] text-white'
                      : 'text-[#77766F] hover:text-[#171717]'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            {/* Fixed-width Interactive Slot Swap Mode Button */}
            <button
              type="button"
              onClick={() => {
                setIsSwapMode(prev => !prev);
                setSwapSourceItem(null);
              }}
              className={`h-10 px-3 w-[136px] rounded-xl text-xs font-semibold transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5 border shrink-0 ${
                isSwapMode
                  ? 'bg-[#E8D36B] text-[#171717] border-[#D4BC4C]'
                  : 'bg-[#F7F6EF] text-[#57564F] border-[#E4E2DA] hover:text-[#171717]'
              }`}
              title="Click to toggle Swap Mode: Select any two sessions to swap their positions"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{isSwapMode ? 'Swap: Active' : 'Swap Mode'}</span>
            </button>

            {/* Fixed-width Search Field */}
            <div className="input-group-field h-10 px-3 gap-2 w-[215px] shrink-0">
              <Search className="w-3.5 h-3.5 text-[#77766F] shrink-0" />
              <input
                type="text"
                placeholder="Filter course, prof, room..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="text-xs w-full"
              />
            </div>
          </div>
        </div>

        {/* ROW 2 (Fixed Height `min-h-[44px]` across all perspectives and calendar modes so layout never shifts) */}
        <div className="min-h-[44px] pt-2.5 border-t border-[#E4E2DA] flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          {/* Left Context Control (Clean selectors only — no extra colored info boxes) */}
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            {(perspective === 'cohort' || perspective === 'master') && (
              <div className="inline-flex flex-wrap items-center p-1 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedDeptId('all')}
                  className={`h-7 px-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    selectedDeptId === 'all'
                      ? 'bg-white text-[#171717] border border-[#E4E2DA]'
                      : 'text-[#77766F] hover:text-[#171717] border border-transparent'
                  }`}
                >
                  All Depts
                </button>
                {store.departments.map(dept => (
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
                    className={`h-7 px-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      selectedDeptId === dept.id
                        ? 'bg-white text-[#171717] border border-[#E4E2DA]'
                        : 'text-[#77766F] hover:text-[#171717] border border-transparent'
                    }`}
                  >
                    {dept.code}
                  </button>
                ))}
              </div>
            )}

            {perspective === 'cohort' && (
              <div className="inline-flex items-center gap-1.5 min-w-0">
                <button
                  type="button"
                  onClick={handlePrevCohort}
                  className="w-8 h-8 rounded-lg bg-[#F7F6EF] hover:bg-[#EDEAE0] border border-[#E4E2DA] flex items-center justify-center text-[#171717] cursor-pointer shrink-0"
                  title="Previous Class/Section"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <select
                  value={selectedCohortId}
                  onChange={e => handleSelectCohort(e.target.value)}
                  className="input-field h-8 w-[240px] text-xs font-semibold bg-white border-[#E4E2DA] text-[#171717] py-1 px-2.5 truncate"
                >
                  {departmentFilteredGroups.map(g => (
                    <option key={g.id} value={g.id}>
                      {g.code} — {g.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleNextCohort}
                  className="w-8 h-8 rounded-lg bg-[#F7F6EF] hover:bg-[#EDEAE0] border border-[#E4E2DA] flex items-center justify-center text-[#171717] cursor-pointer shrink-0"
                  title="Next Class/Section"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {perspective === 'instructor' && (
              <div className="inline-flex flex-wrap items-center gap-2">
                <select
                  value={selectedInstructorId}
                  onChange={e => setSelectedInstructorId(e.target.value)}
                  className="input-field h-8 w-[280px] text-xs font-semibold py-1 px-2.5"
                >
                  {store.instructors.map(i => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.title})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {perspective === 'room' && (
              <div className="inline-flex flex-wrap items-center gap-2">
                <select
                  value={selectedRoomId}
                  onChange={e => setSelectedRoomId(e.target.value)}
                  className="input-field h-8 w-[280px] text-xs font-semibold py-1 px-2.5"
                >
                  {store.rooms.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.type === 'lab' ? 'Lab' : 'Classroom'}: {r.code} ({r.capacity} seats)
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Right Sub-Mode Control (Always occupies h-8 so switching Week / Day / Agenda causes zero layout shift) */}
          <div className="flex items-center gap-2 shrink-0">
            {calendarMode === 'week' && (
              <div className="inline-flex items-center p-1 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] h-9">
                {[
                  { span: 7 as const, label: '7-Day (Mon–Sun)' },
                  { span: 5 as const, label: '5-Day (Mon–Fri)' }
                ].map(opt => (
                  <button
                    key={opt.span}
                    type="button"
                    onClick={() => setWeekColumnSpan(opt.span)}
                    className={`h-7 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      weekColumnSpan === opt.span
                        ? 'bg-white text-[#171717] border border-[#E4E2DA]'
                        : 'text-[#77766F] hover:text-[#171717] border border-transparent'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            {calendarMode === 'day' && (
              <div className="inline-flex items-center gap-1 bg-[#F7F6EF] p-1 rounded-xl border border-[#E4E2DA] h-9">
                {FULL_SEVEN_DAYS.map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setFocusedDay(d)}
                    className={`h-7 w-10 rounded-lg text-xs font-semibold cursor-pointer inline-flex items-center justify-center ${
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
          </div>
        </div>

        {/* Interactive Swap Mode Notification & Status Bar */}
        {isSwapMode && (
          <div className="p-3 rounded-xl bg-[#E8D36B]/35 border border-[#D4BC4C] flex items-center justify-between text-xs text-[#171717] transition-all">
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-[#171717] shrink-0" />
              <span>
                {swapSourceItem
                  ? `First session selected: ${swapSourceItem.code} (${swapSourceItem.day} ${swapSourceItem.time}). Now click another class session or slot to preview conflict check and swap.`
                  : 'Swap Mode Active: Click any class or lab session to select it, then click another session to swap them.'}
              </span>
            </div>
            {swapSourceItem && (
              <button
                type="button"
                onClick={() => setSwapSourceItem(null)}
                className="text-[11px] font-semibold underline text-[#171717] hover:text-black cursor-pointer shrink-0 ml-2"
              >
                Cancel Selection
              </button>
            )}
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
                        onClick={() => handleClassClick(cls)}
                        style={{ backgroundColor: pastel.bg, borderColor: pastel.border }}
                        className={`p-4 rounded-xl border text-[#171717] cursor-pointer hover:-translate-y-0.5 transition-transform space-y-2 ${
                          swapSourceItem?.id === cls.id ? 'ring-2 ring-[#171717] ring-offset-2' : ''
                        }`}
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
            const singleSlotHeightPx = 76;

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
                              </div>
                            </td>
                          </tr>
                        )}

                        {/* Regular Class Slot Row — Uniform height so spanned Lab blocks occupy full 3-hour height */}
                        <tr className="h-[76px]">
                          {/* Left Column: Lecture Time + Short Break Buffer */}
                          <td className="h-[76px] py-1.5 px-2 text-[10.5px] font-mono-tabular text-[#171717] align-middle bg-[#F7F6EF]/40 overflow-hidden">
                            <div className="font-semibold text-[10.5px] text-[#171717] leading-tight truncate">
                              {slotMeta.period.replace(' AM', '').replace(' PM', '')}
                            </div>
                            {computedTiming.shortBreakEnabled &&
                              computedTiming.shortBreakMinutes > 0 &&
                              slotMeta.shortBreak !== 'No Break' && (
                                <div className="text-[9.5px] text-[#77766F] mt-0.5 leading-tight truncate">
                                  {computedTiming.shortBreakMinutes}m buffer
                                </div>
                              )}
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

                            // Render a Continuous Lab cell (`rowSpan={rowSpanCount}`) stretching across 100% of the spanned rows
                            if (labSpanInfo) {
                              const { labItem, concurrentItems, continuousWindow, rowSpanCount } = labSpanInfo;
                              const pastel = getCoursePastel(labItem.code);
                              const isDragOver = dragOverCellKey === cellKey;
                              const isSwapSource = swapSourceItem?.id === labItem.id;
                              const fullLabMinHeight = rowSpanCount * singleSlotHeightPx - 8;

                              return (
                                <td
                                  key={day}
                                  rowSpan={rowSpanCount}
                                  onDragOver={e => {
                                    e.preventDefault();
                                    e.dataTransfer.dropEffect = 'move';
                                    if (dragOverCellKey !== cellKey) setDragOverCellKey(cellKey);
                                  }}
                                  onDragLeave={() => {
                                    if (dragOverCellKey === cellKey) setDragOverCellKey(null);
                                  }}
                                  onDrop={e => {
                                    e.preventDefault();
                                    handleDropOnSlot(day, time);
                                  }}
                                  className={`h-[1px] p-1 border-l border-[#E4E2DA] align-top bg-white overflow-hidden transition-colors ${
                                    isDragOver ? 'bg-[#B8F2E6]/60 ring-2 ring-inset ring-[#93DEC9]' : ''
                                  }`}
                                >
                                  <div
                                    draggable={true}
                                    onDragStart={e => {
                                      e.dataTransfer.setData('text/plain', labItem.id);
                                      setDraggedClassItem(labItem);
                                    }}
                                    onDragEnd={() => {
                                      setDraggedClassItem(null);
                                      setDragOverCellKey(null);
                                    }}
                                    onClick={() => handleClassClick(labItem)}
                                    style={{
                                      backgroundColor: pastel.bg,
                                      borderColor: pastel.border,
                                      minHeight: `${fullLabMinHeight}px`
                                    }}
                                    className={`w-full h-full ${
                                      isCompactCol ? 'p-2' : 'p-3'
                                    } rounded-xl border text-[#171717] flex flex-col justify-between text-center transition-all hover:-translate-y-0.5 cursor-grab active:cursor-grabbing min-w-0 overflow-hidden ${
                                      isSwapSource ? 'ring-2 ring-[#171717] ring-offset-2 shadow-md' : ''
                                    }`}
                                  >
                                    <div className="flex items-center justify-center gap-1 text-[9.5px] font-mono-tabular font-bold text-[#171717]/85 w-full truncate">
                                      <GripVertical className="w-2.5 h-2.5 text-[#77766F] shrink-0" />
                                      <span className="truncate">{labItem.code}</span>
                                      <span>·</span>
                                      <span className="shrink-0">
                                        LAB ({computedTiming.labDurationHoursLabel})
                                      </span>
                                      {labItem.isLocked && <Lock className="w-2.5 h-2.5 shrink-0" />}
                                    </div>

                                    <div className="my-auto py-1 font-serif-editorial text-xs sm:text-[13px] font-semibold leading-snug text-[#171717] line-clamp-3 break-words w-full">
                                      {labItem.title}
                                    </div>

                                    <div className="w-full pt-1.5 border-t border-black/10 space-y-0.5 text-[9.5px] text-[#171717]/80 min-w-0">
                                      <div className="font-medium truncate">{labItem.prof}</div>
                                      <div className="font-mono-tabular font-semibold text-[#171717] truncate">
                                        {labItem.room}
                                        {perspective === 'master' ? ` · ${labItem.cohort}` : ''}
                                      </div>
                                      <div className="font-mono-tabular text-[9px] text-[#171717]/75 truncate">
                                        {continuousWindow}
                                      </div>
                                      {perspective === 'master' && concurrentItems.length > 0 && (
                                        <div className="text-[9px] font-mono-tabular font-semibold text-[#171717]/75 truncate">
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

                            const isDragOver = dragOverCellKey === cellKey;

                            return (
                              <td
                                key={day}
                                onDragOver={e => {
                                  e.preventDefault();
                                  e.dataTransfer.dropEffect = 'move';
                                  if (dragOverCellKey !== cellKey) setDragOverCellKey(cellKey);
                                }}
                                onDragLeave={() => {
                                  if (dragOverCellKey === cellKey) setDragOverCellKey(null);
                                }}
                                onDrop={e => {
                                  e.preventDefault();
                                  handleDropOnSlot(day, time);
                                }}
                                className={`h-[76px] p-1 border-l border-[#E4E2DA] align-middle overflow-hidden transition-colors ${
                                  isDragOver ? 'bg-[#B8F2E6]/60 ring-2 ring-inset ring-[#93DEC9]' : ''
                                } ${
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
                                  const isSwapSource = swapSourceItem?.id === cls.id;

                                  return (
                                    <div
                                      key={cls.id}
                                      draggable={true}
                                      onDragStart={e => {
                                        e.dataTransfer.setData('text/plain', cls.id);
                                        setDraggedClassItem(cls);
                                      }}
                                      onDragEnd={() => {
                                        setDraggedClassItem(null);
                                        setDragOverCellKey(null);
                                      }}
                                      onClick={() => handleClassClick(cls)}
                                      style={{
                                        backgroundColor: pastel.bg,
                                        borderColor: pastel.border
                                      }}
                                      className={`w-full h-full min-h-[66px] ${
                                        isCompactCol ? 'px-1.5 py-1.5' : 'px-2 py-1.5'
                                      } rounded-xl border text-[#171717] flex flex-col items-center justify-center text-center gap-0.5 transition-all hover:-translate-y-0.5 cursor-grab active:cursor-grabbing min-w-0 overflow-hidden ${
                                        isSwapSource ? 'ring-2 ring-[#171717] ring-offset-2 shadow-md' : ''
                                      }`}
                                    >
                                      <div className="font-semibold text-[11px] leading-tight text-[#171717] w-full truncate">
                                        {cls.title}
                                      </div>

                                      <div className="text-[9.5px] font-mono-tabular font-bold text-[#171717]/80 w-full truncate flex items-center justify-center gap-1">
                                        <GripVertical className="w-2.5 h-2.5 text-[#77766F] shrink-0" />
                                        <span className="truncate">{cls.code} {isLab ? `· Lab (${computedTiming.labDurationHoursLabel})` : ''}</span>
                                      </div>

                                      <div className="w-full pt-0.5 border-t border-black/10 text-[9.5px] text-[#171717]/80 leading-tight min-w-0">
                                        <div className="truncate">{cls.prof}</div>
                                        <div className="font-mono-tabular font-semibold text-[#171717] truncate">
                                          {cls.room}
                                          {perspective === 'master' ? ` · ${cls.cohort}` : ''}
                                        </div>
                                      </div>

                                      {perspective === 'master' && extraCount > 0 && (
                                        <div className="text-[8.5px] font-mono-tabular font-semibold text-[#171717]/75 text-center truncate">
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

      {/* Conflict Inspector & Resolution Modal */}
      {conflictDialogData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white border border-[#E4E2DA] rounded-2xl shadow-xl max-w-lg w-full overflow-hidden p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-[#E8D36B]/40 text-[#171717]">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif-editorial text-xl text-[#171717]">
                    Timetable Conflict Inspector
                  </h3>
                  <p className="text-xs text-[#77766F]">
                    Constraint check detected collisions at target slot.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setConflictDialogData(null)}
                className="text-[#77766F] hover:text-[#171717] p-1.5 rounded-lg hover:bg-[#EDEAE0] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#77766F]">Dragged Session:</span>
                <span className="font-mono-tabular font-bold text-[#171717]">
                  {conflictDialogData.sourceItem.code} · {conflictDialogData.sourceItem.title}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#77766F]">Target Destination:</span>
                <span className="font-mono-tabular font-semibold text-[#171717]">
                  {conflictDialogData.targetDay} · {conflictDialogData.targetPeriod}
                </span>
              </div>
            </div>

            {/* Identified Conflicts List */}
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#77766F]">
                Identified Constraints & Collisions ({conflictDialogData.conflicts.length})
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {conflictDialogData.conflicts.map((c, idx) => (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-xl text-xs flex items-start gap-2 border ${
                      c.severity === 'hard'
                        ? 'bg-[#FDE8E8] border-[#F5B5B5] text-[#8B1E1E]'
                        : 'bg-[#E8D36B]/25 border-[#D4BC4C] text-[#171717]'
                    }`}
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div className="leading-snug">
                      <span className="font-semibold uppercase text-[10px]">[{c.type}]</span> {c.message}
                    </div>
                  </div>
                ))}
                {conflictDialogData.conflictingItem && (
                  <div className="p-2.5 rounded-xl text-xs flex items-start gap-2 border bg-[#B8EEEE]/35 border-[#95DFDF] text-[#171717]">
                    <ArrowRightLeft className="w-4 h-4 shrink-0 mt-0.5" />
                    <div className="leading-snug">
                      Slot currently reserved for: <strong>{conflictDialogData.conflictingItem.code} · {conflictDialogData.conflictingItem.title}</strong> ({conflictDialogData.conflictingItem.prof}).
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-[#E4E2DA]">
              <button
                type="button"
                onClick={() => setConflictDialogData(null)}
                className="btn-secondary h-9 text-xs"
              >
                Cancel Move
              </button>
              {conflictDialogData.conflictingItem && (
                <button
                  type="button"
                  onClick={handleSwapConflictingClass}
                  className="btn-primary h-9 text-xs bg-[#171717]"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>Swap Positions With Existing Class</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleConfirmOverrideMove}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-[#8B1E1E] text-white hover:bg-[#6D1717] cursor-pointer"
              >
                Override & Move Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Swap Confirmation Modal */}
      {swapDialogData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white border border-[#E4E2DA] rounded-2xl shadow-xl max-w-lg w-full overflow-hidden p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-[#B8EEEE]/60 text-[#171717]">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif-editorial text-xl text-[#171717]">
                    Confirm Timetable Position Swap
                  </h3>
                  <p className="text-xs text-[#77766F]">
                    Exchange scheduled slots between the two chosen sessions.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSwapDialogData(null)}
                className="text-[#77766F] hover:text-[#171717] p-1.5 rounded-lg hover:bg-[#EDEAE0] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] space-y-1.5">
                <div className="text-[10px] uppercase font-semibold text-[#77766F]">Session A</div>
                <div className="font-mono-tabular font-bold text-[#171717]">{swapDialogData.itemA.code}</div>
                <div className="font-medium text-[#171717]">{swapDialogData.itemA.title}</div>
                <div className="text-[11px] text-[#57564F]">
                  Current: {swapDialogData.itemA.day} · {swapDialogData.itemA.time}
                </div>
                <div className="text-[11px] font-semibold text-[#171717] pt-1 border-t border-[#E4E2DA]">
                  New Slot: {swapDialogData.itemB.day} · {swapDialogData.itemB.time}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] space-y-1.5">
                <div className="text-[10px] uppercase font-semibold text-[#77766F]">Session B</div>
                <div className="font-mono-tabular font-bold text-[#171717]">{swapDialogData.itemB.code}</div>
                <div className="font-medium text-[#171717]">{swapDialogData.itemB.title}</div>
                <div className="text-[11px] text-[#57564F]">
                  Current: {swapDialogData.itemB.day} · {swapDialogData.itemB.time}
                </div>
                <div className="text-[11px] font-semibold text-[#171717] pt-1 border-t border-[#E4E2DA]">
                  New Slot: {swapDialogData.itemA.day} · {swapDialogData.itemA.time}
                </div>
              </div>
            </div>

            {(swapDialogData.conflictsA.length > 0 || swapDialogData.conflictsB.length > 0) && (
              <div className="p-3 rounded-xl bg-[#E8D36B]/25 border border-[#D4BC4C] text-xs text-[#171717] space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-[#171717]" />
                  <span>Validation Invariants:</span>
                </div>
                <ul className="list-disc list-inside text-[11px] text-[#57564F] space-y-0.5">
                  {swapDialogData.conflictsA.map((c, i) => (
                    <li key={`a-${i}`}>[Session A] {c.message}</li>
                  ))}
                  {swapDialogData.conflictsB.map((c, i) => (
                    <li key={`b-${i}`}>[Session B] {c.message}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E4E2DA]">
              <button
                type="button"
                onClick={() => setSwapDialogData(null)}
                className="btn-secondary h-9 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSwap}
                className="btn-primary h-9 text-xs"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>Confirm & Execute Swap</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
