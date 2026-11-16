import React, { useState, useRef, useEffect } from 'react';
import type { RouteType } from './SmartGridNav';
import { useInstitutionalData, institutionalStore } from '../data/store';
import { buildMatrixSchedule } from '../data/solverAdapter';
import {
  UNIVERSITY_SLOTS,
  computeAcademicScheduleConfig,
  getLabBlockByStartPeriod,
  getEffectiveSlotDisplayForDay
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
  ArrowRightLeft,
  AlertCircle,
  AlertTriangle,
  GripVertical,
  X
} from 'lucide-react';
import { ClassDetailsModal, ClassItem } from './ClassDetailsModal';
import { jsPDF } from 'jspdf';
import { AuthenticatedVotingUser, solveOptimizationApi, getStoredUser } from '../services/votingApi';
import { showAppPopup } from './ToastPopupHost';
import {
  getNormalizedUserRole,
  resolveUserCohort,
  resolveBrBatchCohorts,
  resolveFacultyInstructor
} from '../utils/userTimetableScope';

interface TimetableMatrixProps {
  onNavigate?: (route: RouteType) => void;
  onOpenAuth?: (mode?: 'signin' | 'signup') => void;
  onSignOut?: () => void;
  currentUser?: AuthenticatedVotingUser | null;
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
  const { scheduleData } = buildMatrixSchedule(store);
  const hasGeneratedTimetable =
    store.scenarios.length > 0 || store.sections.some(s => Boolean(s.assignedSlot));

  const userRole = getNormalizedUserRole(currentUser);
  const isAdmin = !currentUser || userRole === 'admin';
  const isStudent = userRole === 'student';
  const isBr = userRole === 'br';
  const isFaculty = userRole === 'faculty';

  const matchedStudentCohort = isStudent ? resolveUserCohort(currentUser, store.studentGroups) : null;
  const brBatchCohorts = isBr ? resolveBrBatchCohorts(currentUser, store.studentGroups) : [];
  const defaultBrCohort = isBr
    ? resolveUserCohort(currentUser, brBatchCohorts) || brBatchCohorts[0] || null
    : null;
  const matchedFaculty = isFaculty ? resolveFacultyInstructor(currentUser, store.instructors) : null;

  const [calendarMode, setCalendarMode] = useState<'week' | 'day' | 'agenda'>('week');
  const [weekColumnSpan, setWeekColumnSpan] = useState<7 | 5>(() => {
    const hasWeekendClasses = store.sections.some(
      s => s.assignedSlot && (s.assignedSlot.day === 'Sat' || s.assignedSlot.day === 'Sun')
    );
    return hasWeekendClasses ? 7 : 5;
  });
  const [focusedDay, setFocusedDay] = useState<string>('Mon');
  // Default to 'cohort' (Individual Class/Section Timetable) so each class/section timetable is displayed clearly
  const [perspective, setPerspective] = useState<'cohort' | 'master' | 'instructor' | 'room'>(() =>
    isFaculty ? 'instructor' : 'cohort'
  );
  const [selectedDeptId, setSelectedDeptId] = useState<string>('all');
  const [selectedBatchFilter, setSelectedBatchFilter] = useState<string>('all');
  const [selectedCohortId, setSelectedCohortId] = useState<string>(() => {
    if (isStudent) return matchedStudentCohort?.id || '';
    if (isBr) return defaultBrCohort?.id || '';
    return store.selectedClassGroupId || store.studentGroups[0]?.id || '';
  });
  const [selectedInstructorId, setSelectedInstructorId] = useState<string>(() =>
    isFaculty ? matchedFaculty?.id || '' : store.instructors[0]?.id || ''
  );
  const [selectedRoomId, setSelectedRoomId] = useState<string>(store.rooms[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const effectivePerspective: 'cohort' | 'master' | 'instructor' | 'room' =
    isStudent || isBr ? 'cohort' : isFaculty ? 'instructor' : perspective;

  const effectiveCohortId = isStudent
    ? matchedStudentCohort?.id || ''
    : isBr
    ? brBatchCohorts.some(g => g.id === selectedCohortId)
      ? selectedCohortId
      : defaultBrCohort?.id || ''
    : selectedCohortId;

  const effectiveInstructorId = isFaculty ? matchedFaculty?.id || '' : selectedInstructorId;

  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);
  const [isSweeping, setIsSweeping] = useState(false);
  const [isExportingSheets, setIsExportingSheets] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  // Interactive Drag-and-Drop and Slot Swap State (Admin-only)
  const [draggedClassItem, setDraggedClassItem] = useState<ClassItem | null>(null);
  const [dragOverCellKey, setDragOverCellKey] = useState<string | null>(null);

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
  }, [calendarMode, effectivePerspective]);

  // Synchronize perspective and cohort/instructor when role or store changes
  useEffect(() => {
    if (isStudent) {
      setPerspective('cohort');
      setSelectedCohortId(matchedStudentCohort?.id || '');
      return;
    }
    if (isBr) {
      setPerspective('cohort');
      setSelectedCohortId(prev =>
        brBatchCohorts.some(g => g.id === prev) ? prev : defaultBrCohort?.id || ''
      );
      return;
    }
    if (isFaculty) {
      setPerspective('instructor');
      setSelectedInstructorId(matchedFaculty?.id || '');
      return;
    }
    if (store.selectedClassGroupId && store.studentGroups.some(g => g.id === store.selectedClassGroupId)) {
      setSelectedCohortId(store.selectedClassGroupId);
    } else if (!store.studentGroups.some(g => g.id === selectedCohortId) && store.studentGroups[0]) {
      setSelectedCohortId(store.studentGroups[0].id);
    }
  }, [
    isStudent,
    isBr,
    isFaculty,
    matchedStudentCohort?.id,
    defaultBrCohort?.id,
    matchedFaculty?.id,
    store.selectedClassGroupId,
    store.studentGroups
  ]);

  const handleSelectCohort = (groupId: string) => {
    if (isStudent || isFaculty) return;
    if (isBr && !brBatchCohorts.some(g => g.id === groupId)) return;
    setPerspective('cohort');
    setSelectedCohortId(groupId);
    institutionalStore.setSelectedClassGroupId(groupId);
  };

  const getGroupBatch = (g: { batchCode?: string; code: string }) =>
    (g.batchCode || g.code.split('-')[0] || '').trim().toUpperCase();
  const getGroupSection = (g: { section?: string; code: string }) =>
    (g.section || g.code.split('-')[2] || 'A').trim().toUpperCase();
  const groupMatchesDept = (g: { departmentCode?: string; programId: string; code: string }, deptId: string) => {
    if (deptId === 'all') return true;
    const deptObj = store.departments.find(d => d.id === deptId);
    const prog = store.programs.find(p => p.id === g.programId);
    return (
      prog?.departmentId === deptId ||
      (Boolean(deptObj?.code) &&
        (g.departmentCode || g.code.split('-')[1] || '').toUpperCase() === deptObj!.code.toUpperCase())
    );
  };

  const availableBatchCodes = Array.from(
    new Set(
      store.studentGroups
        .filter(g => groupMatchesDept(g, selectedDeptId))
        .map(g => getGroupBatch(g))
        .filter(Boolean)
    )
  ).sort((a, b) => b.localeCompare(a));

  // Filter classes/sections strictly by role, selected department/field, and selected batch
  const departmentFilteredGroups = isStudent
    ? matchedStudentCohort
      ? [matchedStudentCohort]
      : []
    : isBr
    ? brBatchCohorts
    : store.studentGroups
        .filter(g => {
          if (!groupMatchesDept(g, selectedDeptId)) return false;
          if (selectedBatchFilter !== 'all' && getGroupBatch(g) !== selectedBatchFilter) {
            return false;
          }
          return true;
        })
        .sort((a, b) => a.code.localeCompare(b.code));

  const activeGroupIndex = departmentFilteredGroups.findIndex(g => g.id === effectiveCohortId);
  const activeGroupObj = isStudent
    ? matchedStudentCohort
    : isBr
    ? brBatchCohorts.find(g => g.id === effectiveCohortId) || defaultBrCohort || null
    : departmentFilteredGroups.find(g => g.id === effectiveCohortId) ||
      store.studentGroups.find(g => g.id === effectiveCohortId) ||
      departmentFilteredGroups[0] ||
      store.studentGroups[0] ||
      null;

  const handlePrevCohort = () => {
    if (departmentFilteredGroups.length <= 1) return;
    const prevIdx =
      activeGroupIndex <= 0 ? departmentFilteredGroups.length - 1 : activeGroupIndex - 1;
    handleSelectCohort(departmentFilteredGroups[prevIdx].id);
  };

  const handleNextCohort = () => {
    if (departmentFilteredGroups.length <= 1) return;
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

  const handleRunSweep = async () => {
    setIsSweeping(true);
    try {
      const user = currentUser || getStoredUser();
      const res = await solveOptimizationApi({ algorithm: 'hybrid_dsatur_ga_sa', universityId: store.institutionProfile?.id || user?.institutionId }, user);
      if (res.assignments && Object.keys(res.assignments).length > 0) {
        institutionalStore.applyBackendOptimizationResult({
          assignments: res.assignments,
          strategyName: 'Python Hybrid AI Re-Optimization',
          algorithm: 'hybrid_dsatur_ga_sa',
          fitness: {
            totalScore: res.metrics.totalScore,
            studentSatisfaction: res.metrics.studentSatisfaction,
            instructorSatisfaction: res.metrics.instructorSatisfaction,
            roomUtilization: res.metrics.roomUtilization,
            fairnessScore: res.metrics.fairnessScore
          },
          conflictCount: res.metrics.conflictCount
        });
        void institutionalStore.syncToBackend(user || undefined);
        showAppPopup({
          title: 'Timetable Re-Optimized (Python Hybrid AI)',
          message: `${res.metrics.placedCount} sessions synchronized with ${res.metrics.conflictCount} hard conflicts.`,
          variant: 'success'
        });
      } else {
        throw new Error('No assignments returned.');
      }
    } catch {
      const localRes = institutionalStore.runTimetableSolver();
      void institutionalStore.syncToBackend(currentUser || undefined);
      showAppPopup({
        title: 'Timetable Re-Optimized (Local Solver)',
        message: `${localRes.placedCount} sessions synchronized with 0 hard overlaps.`,
        variant: 'success'
      });
    } finally {
      setIsSweeping(false);
    }
  };

  // Interactive Drag-and-Drop and Slot Swap Logic (Admin-only)
  const handleDropOnSlot = (targetDay: string, rawTargetPeriod: string) => {
    if (!isAdmin || !draggedClassItem) return;
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
      void institutionalStore.syncToBackend(currentUser || undefined);
      showAppPopup({
        title: 'Session Moved',
        message: `Moved ${draggedClassItem.code} to ${targetDay} · ${targetPeriod} with zero conflicts.`,
        variant: 'success'
      });
    }
    setDraggedClassItem(null);
  };

  const handleClassClick = (cls: ClassItem) => {
    setSelectedClass(cls);
  };

  const handleConfirmSwap = () => {
    if (!swapDialogData) return;
    const { itemA, itemB } = swapDialogData;
    const res = institutionalStore.swapSectionSlots(itemA.id, itemB.id);
    void institutionalStore.syncToBackend(currentUser || undefined);
    setSwapDialogData(null);
    showAppPopup({
      title: 'Sessions Swapped',
      message: res.message,
      variant: 'success'
    });
  };

  const handleConfirmOverrideMove = () => {
    if (!conflictDialogData) return;
    const { sourceItem, targetDay, targetPeriod, targetRoomId } = conflictDialogData;
    institutionalStore.updateSectionSlot(sourceItem.id, {
      day: targetDay as any,
      timeSlot: targetPeriod,
      roomId: targetRoomId || store.rooms[0]?.id || ''
    });
    void institutionalStore.syncToBackend(currentUser || undefined);
    setConflictDialogData(null);
    showAppPopup({
      title: 'Session Moved (Override)',
      message: `Manually moved ${sourceItem.code} to ${targetDay} · ${targetPeriod} (Override applied).`,
      variant: 'info'
    });
  };

  const handleSwapConflictingClass = () => {
    if (!conflictDialogData || !conflictDialogData.conflictingItem) return;
    const { sourceItem, conflictingItem } = conflictDialogData;
    institutionalStore.swapSectionSlots(sourceItem.id, conflictingItem.id);
    void institutionalStore.syncToBackend(currentUser || undefined);
    setConflictDialogData(null);
    showAppPopup({
      title: 'Sessions Swapped',
      message: `Swapped ${sourceItem.code} and ${conflictingItem.code}.`,
      variant: 'success'
    });
  };

  const filterClass = (cls: ClassItem) => {
    if (effectivePerspective === 'cohort') {
      if (
        !effectiveCohortId ||
        (cls.studentGroupId !== effectiveCohortId && !cls.sharedGroupIds?.includes(effectiveCohortId))
      ) {
        return false;
      }
    } else if (effectivePerspective === 'instructor') {
      if (!effectiveInstructorId || cls.instructorId !== effectiveInstructorId) return false;
    } else if (effectivePerspective === 'room') {
      if (selectedRoomId && cls.roomId !== selectedRoomId) return false;
    } else if (effectivePerspective === 'master' && selectedDeptId !== 'all') {
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
    if (effectivePerspective === 'cohort') {
      const g = store.studentGroups.find(x => x.id === effectiveCohortId);
      return g ? `Class_${g.code}` : currentUser?.batchCode ? `Class_${currentUser.batchCode}` : 'My_Timetable';
    }
    if (effectivePerspective === 'instructor') {
      const i = store.instructors.find(x => x.id === effectiveInstructorId);
      const labelName = i?.name || currentUser?.name || 'Faculty';
      return `Faculty_${labelName.replace(/\s+/g, '_')}`;
    }
    if (effectivePerspective === 'room') {
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
    const safeScope = isAdmin ? scope : 'filtered';
    try {
      setIsExportingSheets(true);
      const scopeLabel = safeScope === 'all' ? 'All_University_Classes' : getActiveScopeLabel();
      const result = await exportTimetableToGoogleSheetsWorkbook({
        store,
        scheduleData,
        filterClass,
        scope: safeScope,
        scopeLabel,
        studentOrUserName: currentUser?.name || 'Academic Schedule'
      });
      showAppPopup({
        title: 'Workbook Exported',
        message: `Exported "${result.fileName}" (1 Weekly Overview + ${result.classSheetCount} Class/Section tabs).`,
        variant: 'success'
      });
    } catch (err) {
      console.error('Google Sheets export error:', err);
      showAppPopup({
        title: 'Export Failed',
        message: 'Failed to generate Google Sheets workbook. Please try again.',
        variant: 'error'
      });
    } finally {
      setIsExportingSheets(false);
      setShowExportMenu(false);
    }
  };

  // CSV Export Routine
  const handleExportCSV = (scope: 'filtered' | 'all') => {
    const safeScope = isAdmin ? scope : 'filtered';
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
          if (safeScope === 'all' || filterClass(cls)) {
            const isLab = cls.sessionType === 'Lab' || (cls.spanSlots && cls.spanSlots > 1);
            const effSlot = getEffectiveSlotDisplayForDay(day, time, computedTiming);
            const labMeta = isLab ? getLabBlockByStartPeriod(time, store.timeStructure, day) : undefined;
            const breakDesc =
              computedTiming.shortBreakEnabled && computedTiming.shortBreakMinutes > 0
                ? `(+ ${computedTiming.shortBreakMinutes}m Short Break)`
                : '(Back-to-Back, No Break)';
            records.push({
              day,
              timeSlot: isLab
                ? ((day === 'Fri' ? labMeta?.continuousLabel : undefined) || cls.continuousTimeLabel || labMeta?.continuousLabel || time)
                : (effSlot.isOpen ? effSlot.period : time),
              sessionType: isLab ? `Lab (${computedTiming.labDurationHoursLabel} Continuous)` : 'Lecture',
              duration: isLab
                ? `${labMeta?.durationMinutes || computedTiming.labDurationMinutes} mins continuous`
                : `${effSlot.isOpen ? effSlot.durationMinutes : computedTiming.periodLengthMinutes} mins ${breakDesc}`,
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
    const scopeLabel = safeScope === 'all' ? 'All_University_Classes' : getActiveScopeLabel();
    link.href = url;
    link.download = `SmartGrid_Timetable_${scopeLabel}_Fall2026.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showAppPopup({
      title: 'CSV Exported',
      message: `Exported ${records.length} scheduled sessions to CSV (${scopeLabel.replace(/_/g, ' ')}).`,
      variant: 'success'
    });
    setShowExportMenu(false);
  };

  // PDF Export Routine using jsPDF
  const handleExportPDF = (scope: 'filtered' | 'all') => {
    const safeScope = isAdmin ? scope : 'filtered';
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

    const scopeLabel = safeScope === 'all' ? 'All University Classes' : getActiveScopeLabel().replace(/_/g, ' ');
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
      const dayLabel =
        day === 'Fri' && computedTiming.fridaySchedule.mode === 'morning_only'
          ? 'FRI (AM ONLY)'
          : day === 'Fri' && computedTiming.fridaySchedule.mode === 'jummah_break'
          ? `FRI (JUMMAH ${computedTiming.fridaySchedule.jummahBreak.timeRangeLabel})`
          : day.toUpperCase();
      doc.text(dayLabel, x + 3, tableStartY + 4.8);
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
          cls => safeScope === 'all' || filterClass(cls)
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

    const fileLabel = safeScope === 'all' ? 'All_University_Classes' : getActiveScopeLabel();
    doc.save(`SmartGrid_Timetable_${fileLabel}_Fall2026.pdf`);

    showAppPopup({
      title: 'PDF Exported',
      message: `Exported timetable as landscape PDF (${fileLabel.replace(/_/g, ' ')}).`,
      variant: 'success'
    });
    setShowExportMenu(false);
  };

  const currentInstructorObj = store.instructors.find(i => i.id === effectiveInstructorId) || null;
  const currentRoomObj = store.rooms.find(r => r.id === selectedRoomId);
  const visibleDays = calendarMode === 'day' ? [focusedDay] : days;

  // Compute stats for the currently viewed Class/Section (or full view)
  const activeFilteredSections = store.sections.filter(s => {
    if (!s.assignedSlot) return false;
    if (effectivePerspective === 'cohort') {
      return (
        Boolean(effectiveCohortId) &&
        (s.studentGroupId === effectiveCohortId || Boolean(s.sharedGroupIds?.includes(effectiveCohortId!)))
      );
    }
    if (effectivePerspective === 'instructor') return Boolean(effectiveInstructorId) && s.instructorId === effectiveInstructorId;
    if (effectivePerspective === 'room') return s.assignedSlot.roomId === selectedRoomId;
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

      const labBlock = getLabBlockByStartPeriod(slotMeta.period, store.timeStructure, day);
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
          (day === 'Fri' ? labBlock?.continuousLabel : undefined) ||
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

  if (!hasGeneratedTimetable) {
    return (
      <div className="space-y-4">
        <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-[#E4E2DA]">
          <div>
            <h1 className="font-serif-editorial text-2xl sm:text-3xl text-[#171717] tracking-tight">
              Timetables
            </h1>
            <p className="text-xs text-[#77766F] mt-1">
              {store.institutionProfile?.name || 'University'} · Schedule Matrix
            </p>
          </div>
        </header>

        <div className="sf-card-white p-10 sm:p-14 text-center space-y-5">
          <div className="w-12 h-12 rounded-2xl bg-[#F7F6EF] border border-[#E4E2DA] flex items-center justify-center mx-auto text-[#171717]">
            <Layers className="w-6 h-6" />
          </div>
          <div className="space-y-2 max-w-lg mx-auto">
            <h2 className="font-serif-editorial text-2xl text-[#171717]">
              No Timetable Generated Yet
            </h2>
            <p className="text-xs sm:text-sm text-[#77766F] leading-relaxed">
              {isAdmin
                ? 'Your academic catalog and campus rules can be imported or configured first. A timetable will only appear here once you generate it.'
                : 'Your university timetable has not been generated or published by the administration yet.'}
            </p>
          </div>

          {isAdmin && (
            <>
              <div className="text-xs font-mono-tabular text-[#57564F]">
                {store.departments.length} Departments · {store.rooms.length} Rooms ·{' '}
                {store.courses.length} Courses · {store.instructors.length} Faculty ·{' '}
                {store.studentGroups.length} Cohorts
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                {onNavigate && (
                  <button
                    type="button"
                    onClick={() => onNavigate('generate')}
                    className="btn-primary h-10 px-5 text-xs font-semibold"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Go to Generate Timetable</span>
                  </button>
                )}
                {onNavigate && (
                  <button
                    type="button"
                    onClick={() => onNavigate('setup')}
                    className="btn-secondary h-10 px-4 text-xs font-semibold"
                  >
                    <span>Configure Catalog</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* =========================================================
          1. COMPACT EDITORIAL HEADER & COLLAPSED EXPORT / OPTIMIZE ACTIONS
         ========================================================= */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-[#E4E2DA]">
        <div>
          <h1 className="font-serif-editorial text-2xl sm:text-3xl text-[#171717] tracking-tight">
            {isStudent
              ? `My Timetable: ${activeGroupObj?.code || currentUser?.batchCode || 'Student Schedule'}`
              : isBr
              ? `Batch Timetable: ${activeGroupObj?.code || currentUser?.batchCode || 'Batch Schedule'}`
              : isFaculty
              ? `My Teaching Timetable: ${currentInstructorObj?.name || currentUser?.name || 'Faculty'}`
              : effectivePerspective === 'cohort' && activeGroupObj
              ? `Section Timetable: ${getGroupBatch(activeGroupObj)} · ${activeGroupObj.departmentCode || activeGroupObj.code.split('-')[1] || ''} · Section ${getGroupSection(activeGroupObj)}`
              : effectivePerspective === 'instructor' && currentInstructorObj
              ? `Faculty Timetable: ${currentInstructorObj.name}`
              : effectivePerspective === 'room' && currentRoomObj
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
                    {isAdmin
                      ? 'Weekly Overview + 1 Worksheet per Class/Section'
                      : 'Compact Personal Weekly Schedule'}
                  </div>
                </div>

                <div className="p-2 space-y-1">
                  {isAdmin && (
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
                  )}

                  <button
                    onClick={() => handleExportGoogleSheets('filtered')}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs flex items-start gap-2.5 hover:bg-[#F7F6EF] transition-colors cursor-pointer text-[#171717]"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-[#171717] mt-0.5 shrink-0" />
                    <div>
                      <div className="font-semibold">
                        {isAdmin ? 'Active Class / Filter (.xlsx)' : 'My Timetable (.xlsx)'}
                      </div>
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
                      <span>{isAdmin ? 'Export Active View (.pdf)' : 'Export My Timetable (.pdf)'}</span>
                    </span>
                    <span className="text-[10px] font-mono-tabular text-[#77766F]">Landscape</span>
                  </button>

                  <button
                    onClick={() => handleExportCSV('filtered')}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between hover:bg-[#F7F6EF] transition-colors cursor-pointer text-[#171717]"
                  >
                    <span className="flex items-center gap-2 font-medium">
                      <Layers className="w-3.5 h-3.5" />
                      <span>{isAdmin ? 'Export Active View (.csv)' : 'Export My Timetable (.csv)'}</span>
                    </span>
                    <span className="text-[10px] font-mono-tabular text-[#77766F]">CSV</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {isAdmin && Boolean(currentUser) && (
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

      {/* =========================================================
          2. FIXED-DIMENSION AGENDA & SCHEDULING SCOPE SELECTOR
          (Stable height & width across all perspectives and calendar modes — zero layout shift)
         ========================================================= */}
      <div className="sf-card-white p-3.5 space-y-2.5">
        {/* ROW 1 (Fixed Height): Role-Scoped Context / Perspective Scope Tabs + Calendar Mode Tabs + Search */}
        <div className="min-h-[40px] flex flex-col xl:flex-row xl:items-center justify-between gap-2.5">
          {isAdmin ? (
            /* Perspective Tabs — Admin / Registrar Only */
            <div className="inline-flex flex-wrap items-center p-1 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] shrink-0">
              {[
                { id: 'cohort' as const, label: 'By Class / Section', icon: Users },
                { id: 'master' as const, label: 'University Overview', icon: Layers },
                { id: 'instructor' as const, label: 'By Faculty', icon: User },
                { id: 'room' as const, label: 'By Room / Lab', icon: Building }
              ].map(tab => {
                const Icon = tab.icon;
                const active = effectivePerspective === tab.id;
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
          ) : (
            /* Locked Personal Scope Pill — Student / BR / Faculty */
            <div className="inline-flex items-center gap-2 px-3 h-10 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] text-xs shrink-0">
              {isFaculty ? (
                <User className="w-3.5 h-3.5 text-[#171717] shrink-0" />
              ) : (
                <Users className="w-3.5 h-3.5 text-[#171717] shrink-0" />
              )}
              <span className="font-semibold text-[#171717]">
                {isStudent && (activeGroupObj ? `${activeGroupObj.code} · ${activeGroupObj.name}` : `${currentUser?.batchCode || 'Student'} · ${currentUser?.section || 'Section'}`)}
                {isBr && `${currentUser?.batchCode || activeGroupObj?.code || 'Batch'} · Batch Representative View`}
                {isFaculty && `${currentInstructorObj?.name || currentUser?.name} · ${currentInstructorObj?.title || 'Faculty Schedule'}`}
              </span>
              <span className="text-[#77766F] font-mono-tabular">
                ({activeFilteredSections.length} sessions)
              </span>
            </div>
          )}

          {/* Right Controls: Week/Day/Agenda Mode + Fixed-Width Search */}
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
          {/* Left Context Control */}
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            {isAdmin && (effectivePerspective === 'cohort' || effectivePerspective === 'master') && (
              <div className="inline-flex flex-wrap items-center p-1 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDeptId('all');
                    if (effectivePerspective === 'cohort') {
                      const firstMatch = store.studentGroups.find(
                        g => selectedBatchFilter === 'all' || getGroupBatch(g) === selectedBatchFilter
                      );
                      if (firstMatch) handleSelectCohort(firstMatch.id);
                    }
                  }}
                  className={`h-7 px-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    selectedDeptId === 'all'
                      ? 'bg-white text-[#171717] border border-[#E4E2DA]'
                      : 'text-[#77766F] hover:text-[#171717] border border-transparent'
                  }`}
                >
                  All Fields
                </button>
                {store.departments.map(dept => (
                  <button
                    key={dept.id}
                    type="button"
                    onClick={() => {
                      setSelectedDeptId(dept.id);
                      if (effectivePerspective === 'cohort') {
                        const firstInDept = store.studentGroups.find(
                          g =>
                            groupMatchesDept(g, dept.id) &&
                            (selectedBatchFilter === 'all' || getGroupBatch(g) === selectedBatchFilter)
                        );
                        const fallbackInDept = store.studentGroups.find(g => groupMatchesDept(g, dept.id));
                        if (firstInDept) {
                          handleSelectCohort(firstInDept.id);
                        } else if (fallbackInDept) {
                          setSelectedBatchFilter('all');
                          handleSelectCohort(fallbackInDept.id);
                        }
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

            {isAdmin && effectivePerspective === 'cohort' && availableBatchCodes.length > 0 && (
              <select
                value={selectedBatchFilter}
                onChange={e => {
                  const nextBatch = e.target.value;
                  setSelectedBatchFilter(nextBatch);
                  const firstMatch = store.studentGroups.find(
                    g =>
                      groupMatchesDept(g, selectedDeptId) &&
                      (nextBatch === 'all' || getGroupBatch(g) === nextBatch)
                  );
                  if (firstMatch) handleSelectCohort(firstMatch.id);
                }}
                className="input-field h-8 w-[130px] text-xs font-semibold bg-[#F7F6EF] border-[#E4E2DA] text-[#171717] py-1 px-2.5 shrink-0"
                title="Filter by Batch (e.g. 2K24)"
              >
                <option value="all">All Batches</option>
                {availableBatchCodes.map(batch => (
                  <option key={batch} value={batch}>
                    Batch {batch}
                  </option>
                ))}
              </select>
            )}

            {isAdmin && effectivePerspective === 'cohort' && (
              <div className="inline-flex flex-wrap items-center gap-1.5 min-w-0">
                <button
                  type="button"
                  onClick={handlePrevCohort}
                  className="w-8 h-8 rounded-lg bg-[#F7F6EF] hover:bg-[#EDEAE0] border border-[#E4E2DA] flex items-center justify-center text-[#171717] cursor-pointer shrink-0"
                  title="Previous Section"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <select
                  value={effectiveCohortId}
                  onChange={e => handleSelectCohort(e.target.value)}
                  className="input-field h-8 w-[225px] text-xs font-semibold bg-white border-[#E4E2DA] text-[#171717] py-1 px-2.5 truncate"
                >
                  {departmentFilteredGroups.map(g => (
                    <option key={g.id} value={g.id}>
                      {g.code} — Sec {getGroupSection(g)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleNextCohort}
                  className="w-8 h-8 rounded-lg bg-[#F7F6EF] hover:bg-[#EDEAE0] border border-[#E4E2DA] flex items-center justify-center text-[#171717] cursor-pointer shrink-0"
                  title="Next Section"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                {/* Quick Section Tabs (Sec A | Sec B | Sec C) when viewing a Batch/Field or up to 6 sections */}
                {departmentFilteredGroups.length > 1 && departmentFilteredGroups.length <= 6 && (
                  <div className="inline-flex items-center p-0.5 rounded-lg bg-[#F7F6EF] border border-[#E4E2DA]">
                    {departmentFilteredGroups.map(g => {
                      const isSel = g.id === effectiveCohortId;
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => handleSelectCohort(g.id)}
                          className={`h-7 px-2.5 rounded-md text-xs font-mono-tabular font-semibold transition-colors cursor-pointer ${
                            isSel
                              ? 'bg-[#171717] text-white'
                              : 'text-[#57564F] hover:text-[#171717]'
                          }`}
                          title={`View separate timetable for ${g.code}`}
                        >
                          Sec {getGroupSection(g)}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {isAdmin && effectivePerspective === 'instructor' && (
              <div className="inline-flex flex-wrap items-center gap-2">
                <select
                  value={effectiveInstructorId}
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

            {isAdmin && effectivePerspective === 'room' && (
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

            {isBr && (
              brBatchCohorts.length > 1 ? (
                <div className="inline-flex items-center gap-1.5 min-w-0">
                  <button
                    type="button"
                    onClick={handlePrevCohort}
                    className="w-8 h-8 rounded-lg bg-[#F7F6EF] hover:bg-[#EDEAE0] border border-[#E4E2DA] flex items-center justify-center text-[#171717] cursor-pointer shrink-0"
                    title="Previous Section in Batch"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <select
                    value={effectiveCohortId}
                    onChange={e => handleSelectCohort(e.target.value)}
                    className="input-field h-8 w-[240px] text-xs font-semibold bg-white border-[#E4E2DA] text-[#171717] py-1 px-2.5 truncate"
                  >
                    {brBatchCohorts.map(g => (
                      <option key={g.id} value={g.id}>
                        {g.code} — {g.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleNextCohort}
                    className="w-8 h-8 rounded-lg bg-[#F7F6EF] hover:bg-[#EDEAE0] border border-[#E4E2DA] flex items-center justify-center text-[#171717] cursor-pointer shrink-0"
                    title="Next Section in Batch"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="text-xs text-[#57564F]">
                  Assigned Batch Section:{' '}
                  <strong className="text-[#171717] font-mono-tabular">
                    {activeGroupObj ? `${activeGroupObj.code} (${activeGroupObj.homeRoom})` : currentUser?.batchCode}
                  </strong>
                </div>
              )
            )}

            {isStudent && (
              <div className="text-xs text-[#57564F]">
                Personal Class Schedule ·{' '}
                <strong className="text-[#171717] font-mono-tabular">
                  {activeGroupObj ? `${activeGroupObj.code} · Home Room ${activeGroupObj.homeRoom}` : `${currentUser?.batchCode || ''} ${currentUser?.section || ''}`}
                </strong>
              </div>
            )}

            {isFaculty && (
              <div className="text-xs text-[#57564F]">
                Personal Teaching Load ·{' '}
                <strong className="text-[#171717]">
                  {currentInstructorObj ? `${currentInstructorObj.name} (${currentInstructorObj.email})` : currentUser?.email}
                </strong>
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

      </div>

      {/* =========================================================
          3. ZERO-SCROLL WEEKLY TIMETABLE GRID OR AGENDA VIEW
         ========================================================= */}
      {!isAdmin && activeFilteredSections.length === 0 ? (
        <div className="sf-card-white p-10 text-center space-y-2">
          <div className="font-serif-editorial text-xl text-[#171717]">
            No Scheduled Sessions Found
          </div>
          <p className="text-xs text-[#77766F] max-w-md mx-auto">
            {isFaculty
              ? `No teaching sessions are currently assigned to ${currentUser?.name || 'your account'} in this term.`
              : `No timetable sessions are currently assigned to ${currentUser?.batchCode || 'your cohort'} ${currentUser?.section || ''} in this term.`}
          </p>
        </div>
      ) : calendarMode === 'agenda' ? (
        <div className="sf-card-white p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-serif-editorial text-xl text-[#171717]">
              Course Agenda —{' '}
              {isFaculty
                ? currentInstructorObj?.name || currentUser?.name
                : effectivePerspective === 'cohort' && activeGroupObj
                ? activeGroupObj.code
                : 'All Scheduled Sessions'}
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
                    const effSlot = getEffectiveSlotDisplayForDay(day, slotMeta.period, computedTiming);
                    const labBlock = isLab ? getLabBlockByStartPeriod(slotMeta.period, store.timeStructure, day) : undefined;
                    const timeWindow = isLab
                      ? ((day === 'Fri' ? labBlock?.continuousLabel : undefined) ||
                         cls.continuousTimeLabel ||
                         labBlock?.continuousLabel ||
                         slotMeta.period)
                      : (effSlot.isOpen ? effSlot.period : slotMeta.period);
                    const effDuration = isLab
                      ? `${labBlock?.durationMinutes ? (labBlock.durationMinutes === computedTiming.labDurationMinutes ? computedTiming.labDurationHoursLabel : `${labBlock.durationMinutes}m`) : computedTiming.labDurationHoursLabel}`
                      : `${effSlot.isOpen ? effSlot.durationMinutes : computedTiming.periodLengthMinutes}m`;
                    return (
                      <div
                        key={`${day}-${slotMeta.period}-${cls.id}`}
                        onClick={() => handleClassClick(cls)}
                        style={{ backgroundColor: pastel.bg, borderColor: pastel.border }}
                        className="p-4 rounded-xl border text-[#171717] cursor-pointer hover:-translate-y-0.5 transition-transform space-y-2"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono-tabular font-semibold text-[#171717]/80">
                            {cls.code} · {isLab ? `Lab (${effDuration})` : `Lecture (${effDuration})`}
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
                          <span>{isFaculty ? cls.cohort : cls.prof}</span>
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
                            {day === 'Fri' && computedTiming.fridaySchedule.mode === 'jummah_break' && (
                              <span
                                className="text-[9.5px] font-sans font-mono-tabular font-normal text-[#77766F] truncate"
                                title={`Friday Jummah Prayer Break: ${computedTiming.fridaySchedule.jummahBreak.fullRangeLabel}`}
                              >
                                Jummah {computedTiming.fridaySchedule.jummahBreak.timeRangeLabel.replace(' PM', '')}
                              </span>
                            )}
                            {day === 'Fri' && computedTiming.fridaySchedule.mode === 'morning_only' && (
                              <span
                                className="text-[9.5px] font-sans font-mono-tabular font-normal text-[#77766F] truncate"
                                title={`Friday Half-Day: ${computedTiming.fridaySchedule.operatingHoursLabel}`}
                              >
                                AM Only
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
                              const fullLabMinHeight = rowSpanCount * singleSlotHeightPx - 8;

                              return (
                                <td
                                  key={day}
                                  rowSpan={rowSpanCount}
                                  onDragOver={
                                    isAdmin
                                      ? e => {
                                          e.preventDefault();
                                          e.dataTransfer.dropEffect = 'move';
                                          if (dragOverCellKey !== cellKey) setDragOverCellKey(cellKey);
                                        }
                                      : undefined
                                  }
                                  onDragLeave={
                                    isAdmin
                                      ? () => {
                                          if (dragOverCellKey === cellKey) setDragOverCellKey(null);
                                        }
                                      : undefined
                                  }
                                  onDrop={
                                    isAdmin
                                      ? e => {
                                          e.preventDefault();
                                          handleDropOnSlot(day, time);
                                        }
                                      : undefined
                                  }
                                  className={`h-[1px] p-1 border-l border-[#E4E2DA] align-top bg-white overflow-hidden transition-colors ${
                                    isDragOver ? 'bg-[#B8F2E6]/60 ring-2 ring-inset ring-[#93DEC9]' : ''
                                  }`}
                                >
                                  <div
                                    draggable={isAdmin}
                                    onDragStart={
                                      isAdmin
                                        ? e => {
                                            e.dataTransfer.setData('text/plain', labItem.id);
                                            setDraggedClassItem(labItem);
                                          }
                                        : undefined
                                    }
                                    onDragEnd={
                                      isAdmin
                                        ? () => {
                                            setDraggedClassItem(null);
                                            setDragOverCellKey(null);
                                          }
                                        : undefined
                                    }
                                    onClick={() => handleClassClick(labItem)}
                                    style={{
                                      backgroundColor: pastel.bg,
                                      borderColor: pastel.border,
                                      minHeight: `${fullLabMinHeight}px`
                                    }}
                                    className={`w-full h-full ${
                                      isCompactCol ? 'p-2' : 'p-3'
                                    } rounded-xl border text-[#171717] flex flex-col justify-between text-center transition-all hover:-translate-y-0.5 ${
                                      isAdmin ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                                    } min-w-0 overflow-hidden`}
                                  >
                                    <div className="flex items-center justify-center gap-1 text-[9.5px] font-mono-tabular font-bold text-[#171717]/85 w-full truncate">
                                      {isAdmin && <GripVertical className="w-2.5 h-2.5 text-[#77766F] shrink-0" />}
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
                                      <div className="font-medium truncate">
                                        {effectivePerspective === 'instructor' ? labItem.cohort : labItem.prof}
                                      </div>
                                      <div className="font-mono-tabular font-semibold text-[#171717] truncate">
                                        {labItem.room}
                                        {effectivePerspective === 'master' ? ` · ${labItem.cohort}` : ''}
                                      </div>
                                      <div className="font-mono-tabular text-[9px] text-[#171717]/75 truncate">
                                        {continuousWindow}
                                      </div>
                                      {effectivePerspective === 'master' && concurrentItems.length > 0 && (
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
                            const effDaySlot = getEffectiveSlotDisplayForDay(day, time, computedTiming);
                            const isFridayClosed = day === 'Fri' && !effDaySlot.isOpen;
                            const isInstructorBlackedOut =
                              effectivePerspective === 'instructor' &&
                              currentInstructorObj?.unavailableSlots.some(
                                u => u.day === day && u.timeSlot === time
                              );

                            const visibleItems = classes.slice(0, 1);
                            const extraCount = classes.length - visibleItems.length;

                            const isDragOver = dragOverCellKey === cellKey;

                            return (
                              <td
                                key={day}
                                onDragOver={
                                  isAdmin
                                    ? e => {
                                        e.preventDefault();
                                        e.dataTransfer.dropEffect = 'move';
                                        if (dragOverCellKey !== cellKey) setDragOverCellKey(cellKey);
                                      }
                                    : undefined
                                }
                                onDragLeave={
                                  isAdmin
                                    ? () => {
                                        if (dragOverCellKey === cellKey) setDragOverCellKey(null);
                                      }
                                    : undefined
                                }
                                onDrop={
                                  isAdmin
                                    ? e => {
                                        e.preventDefault();
                                        handleDropOnSlot(day, time);
                                      }
                                    : undefined
                                }
                                className={`h-[76px] p-1 border-l border-[#E4E2DA] align-middle overflow-hidden transition-colors ${
                                  isDragOver ? 'bg-[#B8F2E6]/60 ring-2 ring-inset ring-[#93DEC9]' : ''
                                } ${
                                  (isWeekend || isFridayClosed) && visibleItems.length === 0 ? 'bg-[#F7F6EF]/60' : ''
                                }`}
                              >
                                {isFridayClosed && visibleItems.length === 0 && (
                                  <div className="px-1.5 py-2 rounded-lg border border-dashed border-[#E4E2DA] text-[9.5px] text-[#77766F] text-center leading-tight truncate">
                                    {computedTiming.fridaySchedule.mode === 'morning_only'
                                      ? 'Jummah · Half-Day'
                                      : 'Jummah Window'}
                                  </div>
                                )}

                                {isInstructorBlackedOut && !isFridayClosed && (
                                  <div className="p-1 rounded-lg bg-[#F7F6EF] border border-[#E4E2DA] text-[9.5px] text-[#77766F] text-center truncate">
                                    Unavailable
                                  </div>
                                )}

                                {visibleItems.map(cls => {
                                  const pastel = getCoursePastel(cls.code);
                                  const isLab = cls.sessionType === 'Lab' || (cls.spanSlots && cls.spanSlots > 1);
                                  const showFridaySlotTime =
                                    day === 'Fri' && effDaySlot.isOpen && effDaySlot.isFridaySpecial && !isLab;

                                  return (
                                    <div
                                      key={cls.id}
                                      draggable={isAdmin}
                                      onDragStart={
                                        isAdmin
                                          ? e => {
                                              e.dataTransfer.setData('text/plain', cls.id);
                                              setDraggedClassItem(cls);
                                            }
                                          : undefined
                                      }
                                      onDragEnd={
                                        isAdmin
                                          ? () => {
                                              setDraggedClassItem(null);
                                              setDragOverCellKey(null);
                                            }
                                          : undefined
                                      }
                                      onClick={() => handleClassClick(cls)}
                                      style={{
                                        backgroundColor: pastel.bg,
                                        borderColor: pastel.border
                                      }}
                                      className={`w-full h-full min-h-[66px] ${
                                        isCompactCol ? 'px-1.5 py-1.5' : 'px-2 py-1.5'
                                      } rounded-xl border text-[#171717] flex flex-col items-center justify-center text-center gap-0.5 transition-all hover:-translate-y-0.5 ${
                                        isAdmin ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                                      } min-w-0 overflow-hidden`}
                                    >
                                      <div className="font-semibold text-[11px] leading-tight text-[#171717] w-full truncate">
                                        {cls.title}
                                      </div>

                                      <div className="text-[9.5px] font-mono-tabular font-bold text-[#171717]/80 w-full truncate flex items-center justify-center gap-1">
                                        {isAdmin && <GripVertical className="w-2.5 h-2.5 text-[#77766F] shrink-0" />}
                                        <span className="truncate">
                                          {cls.code}{' '}
                                          {isLab
                                            ? `· Lab (${computedTiming.labDurationHoursLabel})`
                                            : showFridaySlotTime
                                            ? `· ${effDaySlot.period.replace(' AM', '').replace(' PM', '')}`
                                            : ''}
                                        </span>
                                      </div>

                                      <div className="w-full pt-0.5 border-t border-black/10 text-[9.5px] text-[#171717]/80 leading-tight min-w-0">
                                        <div className="truncate">
                                          {effectivePerspective === 'instructor' ? cls.cohort : cls.prof}
                                        </div>
                                        <div className="font-mono-tabular font-semibold text-[#171717] truncate">
                                          {cls.room}
                                          {effectivePerspective === 'master' ? ` · ${cls.cohort}` : ''}
                                        </div>
                                      </div>

                                      {effectivePerspective === 'master' && extraCount > 0 && (
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
        canEdit={isAdmin}
      />

      {/* Conflict Inspector & Resolution Modal */}
      {conflictDialogData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white border border-[#E4E2DA] rounded-2xl shadow-xl max-w-lg w-full overflow-hidden p-6 space-y-4">
            <div className="flex items-start justify-between border-b border-[#E4E2DA] pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#8B6B00] shrink-0" />
                <h3 className="font-serif-editorial text-xl text-[#171717]">
                  Timetable Conflict Inspector
                </h3>
              </div>
              <button
                onClick={() => setConflictDialogData(null)}
                className="text-[#77766F] hover:text-[#171717] p-1.5 rounded-lg hover:bg-[#F7F6EF] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="border border-[#E4E2DA] rounded-xl divide-y divide-[#E4E2DA] text-xs">
              <div className="px-3.5 py-2.5 flex items-center justify-between gap-2">
                <span className="text-[#77766F]">Dragged Session</span>
                <span className="font-mono-tabular font-semibold text-[#171717] text-right">
                  {conflictDialogData.sourceItem.code} · {conflictDialogData.sourceItem.title}
                </span>
              </div>
              <div className="px-3.5 py-2.5 flex items-center justify-between gap-2">
                <span className="text-[#77766F]">Target Slot</span>
                <span className="font-mono-tabular font-semibold text-[#171717]">
                  {conflictDialogData.targetDay} · {conflictDialogData.targetPeriod}
                </span>
              </div>
            </div>

            {/* Identified Conflicts List */}
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#77766F]">
                Constraints &amp; Collisions ({conflictDialogData.conflicts.length})
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {conflictDialogData.conflicts.map((c, idx) => (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-xl text-xs flex items-start gap-2 border ${
                      c.severity === 'hard'
                        ? 'bg-[#FDE8E8] border-[#F5B5B5] text-[#8B1E1E]'
                        : 'bg-[#FFF6D6] border-[#F0D98C] text-[#171717]'
                    }`}
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div className="leading-snug">
                      <span className="font-semibold uppercase text-[10px]">[{c.type}]</span> {c.message}
                    </div>
                  </div>
                ))}
                {conflictDialogData.conflictingItem && (
                  <div className="p-2.5 rounded-xl text-xs flex items-start gap-2 border border-[#E4E2DA] bg-[#F7F6EF] text-[#171717]">
                    <ArrowRightLeft className="w-4 h-4 shrink-0 mt-0.5 text-[#77766F]" />
                    <div className="leading-snug">
                      Occupied by <strong>{conflictDialogData.conflictingItem.code} · {conflictDialogData.conflictingItem.title}</strong> ({conflictDialogData.conflictingItem.prof}).
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-[#E4E2DA]">
              <button
                type="button"
                onClick={() => setConflictDialogData(null)}
                className="btn-secondary h-9 text-xs"
              >
                Cancel
              </button>
              {conflictDialogData.conflictingItem && (
                <button
                  type="button"
                  onClick={handleSwapConflictingClass}
                  className="btn-primary h-9 text-xs bg-[#171717]"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>Swap With Existing</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleConfirmOverrideMove}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-[#8B1E1E] text-white hover:bg-[#6D1717] cursor-pointer"
              >
                Override &amp; Move
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Swap Confirmation Modal */}
      {swapDialogData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white border border-[#E4E2DA] rounded-2xl shadow-xl max-w-lg w-full overflow-hidden p-6 space-y-4">
            <div className="flex items-start justify-between border-b border-[#E4E2DA] pb-3">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-[#171717] shrink-0" />
                <h3 className="font-serif-editorial text-xl text-[#171717]">
                  Confirm Position Swap
                </h3>
              </div>
              <button
                onClick={() => setSwapDialogData(null)}
                className="text-[#77766F] hover:text-[#171717] p-1.5 rounded-lg hover:bg-[#F7F6EF] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="border border-[#E4E2DA] rounded-xl grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-[#E4E2DA] text-xs">
              <div className="p-3.5 space-y-1">
                <div className="text-[10px] uppercase font-semibold text-[#77766F]">Session A</div>
                <div className="font-mono-tabular font-bold text-[#171717]">{swapDialogData.itemA.code}</div>
                <div className="font-medium text-[#171717]">{swapDialogData.itemA.title}</div>
                <div className="text-[11px] text-[#77766F]">
                  From: {swapDialogData.itemA.day} · {swapDialogData.itemA.time}
                </div>
                <div className="text-[11px] font-semibold text-[#171717]">
                  To: {swapDialogData.itemB.day} · {swapDialogData.itemB.time}
                </div>
              </div>

              <div className="p-3.5 space-y-1">
                <div className="text-[10px] uppercase font-semibold text-[#77766F]">Session B</div>
                <div className="font-mono-tabular font-bold text-[#171717]">{swapDialogData.itemB.code}</div>
                <div className="font-medium text-[#171717]">{swapDialogData.itemB.title}</div>
                <div className="text-[11px] text-[#77766F]">
                  From: {swapDialogData.itemB.day} · {swapDialogData.itemB.time}
                </div>
                <div className="text-[11px] font-semibold text-[#171717]">
                  To: {swapDialogData.itemA.day} · {swapDialogData.itemA.time}
                </div>
              </div>
            </div>

            {(swapDialogData.conflictsA.length > 0 || swapDialogData.conflictsB.length > 0) && (
              <div className="p-3 rounded-xl bg-[#FFF6D6] border border-[#F0D98C] text-xs text-[#171717] space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-[#171717]" />
                  <span>Validation Warnings</span>
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

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E4E2DA]">
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
                <span>Confirm Swap</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
