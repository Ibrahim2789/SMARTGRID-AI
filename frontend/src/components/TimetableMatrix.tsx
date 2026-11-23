import React, { useState, useRef, useEffect, useMemo } from 'react';
import type { RouteType } from './SmartGridNav';
import {
  useInstitutionalData,
  institutionalStore,
  doesGroupMatchDepartment,
  doesCourseMatchDepartment
} from '../data/store';
import { buildMatrixSchedule } from '../data/solverAdapter';
import {
  UNIVERSITY_SLOTS,
  DayOfWeek,
  computeAcademicScheduleConfig,
  getLabBlockByStartPeriod,
  getEffectiveSlotDisplayForDay,
  orderWorkingDaysFridayRightmost,
  parseTime24ToMinutes,
  minutesToTime24
} from '../types/institutional';
import {
  exportTimetableToGoogleSheetsWorkbook,
  buildCanonicalExportModel,
  CanonicalExportModel,
  CanonicalTimetableExportEntry
} from '../utils/googleSheetsExport';
import {
  Download,
  Sparkles,
  Building,
  FileText,
  FileSpreadsheet,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
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
  Printer,
  Clock,
  X
} from 'lucide-react';
import { ClassDetailsModal, ClassItem } from './ClassDetailsModal';
import { jsPDF } from 'jspdf';
import {
  AuthenticatedVotingUser,
  solveOptimizationApi,
  getStoredUser,
  fetchInstitutionWorkspace,
  updateSectionSlotBackend,
  swapSectionsBackend,
  patchTimetableEntriesBackend,
  publishTimetableBackend,
  loadSampleInstitutionCatalogBackend
} from '../services/votingApi';
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
  { bg: '#B8EEEE', border: '#95DFDF', fillRgb: [184, 238, 238] as const, label: 'Cyan' },
  { bg: '#F2D8FA', border: '#DFB9EC', fillRgb: [242, 216, 250] as const, label: 'Lavender' },
  { bg: '#B8F2E6', border: '#93DEC9', fillRgb: [184, 242, 230] as const, label: 'Mint' },
  { bg: '#B7F77C', border: '#98DF58', fillRgb: [183, 247, 124] as const, label: 'Lime' },
  { bg: '#E8D36B', border: '#D4BC4C', fillRgb: [232, 211, 107] as const, label: 'Mustard' }
];

function getCoursePastel(code: string) {
  const clean = code.replace(/-L$/i, '');
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = (hash * 31 + clean.charCodeAt(i)) >>> 0;
  }
  return PASTEL_PALETTE[hash % PASTEL_PALETTE.length];
}

interface PositionedDaySession {
  cls: ClassItem;
  startMinutes: number;
  endMinutes: number;
  durationMinutes: number;
  startTime24: string;
  endTime24: string;
  laneIndex: number;
  laneCount: number;
}

/**
 * Connected-component sweep-line interval lane assignment so concurrent sessions
 * always render cleanly side-by-side without hiding or overlapping one another.
 */
function assignOverlapLanes(
  items: Array<{
    cls: ClassItem;
    startMinutes: number;
    endMinutes: number;
    durationMinutes: number;
    startTime24: string;
    endTime24: string;
  }>
): PositionedDaySession[] {
  if (items.length === 0) return [];
  const sorted = [...items].sort((a, b) => {
    if (a.startMinutes !== b.startMinutes) return a.startMinutes - b.startMinutes;
    if (b.durationMinutes !== a.durationMinutes) return b.durationMinutes - a.durationMinutes;
    return a.cls.code.localeCompare(b.cls.code);
  });

  // Partition into overlap clusters
  const clusters: Array<typeof sorted> = [];
  let currentCluster: typeof sorted = [];
  let clusterMaxEnd = -1;

  sorted.forEach(item => {
    if (currentCluster.length === 0 || item.startMinutes < clusterMaxEnd) {
      currentCluster.push(item);
      clusterMaxEnd = Math.max(clusterMaxEnd, item.endMinutes);
    } else {
      clusters.push(currentCluster);
      currentCluster = [item];
      clusterMaxEnd = item.endMinutes;
    }
  });
  if (currentCluster.length > 0) clusters.push(currentCluster);

  const result: PositionedDaySession[] = [];
  clusters.forEach(cluster => {
    const laneEnds: number[] = [];
    const assigned = cluster.map(item => {
      let laneIdx = laneEnds.findIndex(endMin => endMin <= item.startMinutes);
      if (laneIdx === -1) {
        laneIdx = laneEnds.length;
        laneEnds.push(item.endMinutes);
      } else {
        laneEnds[laneIdx] = item.endMinutes;
      }
      return { ...item, laneIndex: laneIdx };
    });
    const laneCount = Math.max(1, laneEnds.length);
    assigned.forEach(a => {
      result.push({
        cls: a.cls,
        startMinutes: a.startMinutes,
        endMinutes: a.endMinutes,
        durationMinutes: a.durationMinutes,
        startTime24: a.startTime24,
        endTime24: a.endTime24,
        laneIndex: a.laneIndex,
        laneCount
      });
    });
  });

  return result;
}

export const TimetableMatrix: React.FC<TimetableMatrixProps> = ({
  onNavigate,
  currentUser
}) => {
  const store = useInstitutionalData();
  const { scheduleData, conflicts } = useMemo(() => buildMatrixSchedule(store), [store]);
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
  const groupMatchesDept = (
    g: { departmentCode?: string; departmentId?: string; programId: string; code: string },
    deptId: string
  ) => {
    return doesGroupMatchDepartment(g, deptId, store.programs, store.departments);
  };

  const availableBatchCodes = Array.from(
    new Set(
      store.studentGroups
        .filter(g => groupMatchesDept(g, selectedDeptId))
        .map(g => getGroupBatch(g))
        .filter(Boolean)
    )
  ).sort((a, b) => b.localeCompare(a));

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

  const computedTiming = useMemo(() => computeAcademicScheduleConfig(store.timeStructure), [store.timeStructure]);
  const dynamicSlots = computedTiming.slots.length > 0 ? computedTiming.slots : UNIVERSITY_SLOTS;
  const fridayEnabled = store.timeStructure.fridayEnabled !== false;

  // Canonical day ordering: Friday is ALWAYS rightmost among standard weekdays (Mon..Thu..Fri),
  // omitted completely when fridayEnabled is false, and Sat/Sun follow after Friday if active.
  const fiveDayWorkingList = orderWorkingDaysFridayRightmost(
    computedTiming.workingDays.length > 0 ? computedTiming.workingDays : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    fridayEnabled
  );
  const sevenDayList = orderWorkingDaysFridayRightmost(
    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    fridayEnabled
  );
  const days: DayOfWeek[] = weekColumnSpan === 7 ? sevenDayList : fiveDayWorkingList;
  const activeFocusDay = (sevenDayList.includes(focusedDay as DayOfWeek) ? focusedDay : sevenDayList[0] || 'Mon') as DayOfWeek;

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
      institutionalStore.autoGenerateMissingSections();
      const fresh = institutionalStore.get();
      const payload = {
        universityId: fresh.institutionProfile?.id || user?.institutionId || institutionalStore.getCurrentInstitutionId(),
        algorithm: 'hybrid_dsatur_ga_sa',
        timeStructure: fresh.timeStructure,
        instructors: fresh.instructors.map(i => ({
          id: i.id,
          name: i.name,
          email: i.email,
          staffCode: i.staffCode,
          isActive: i.isActive !== false,
          departmentId: i.departmentId,
          subDepartment: i.subDepartment,
          staffRole: i.staffRole || 'faculty',
          qualifiedCourseIds: i.qualifiedCourseIds || [],
          maxWeeklyHours: i.maxWeeklyHours,
          maxConsecutiveHours: i.maxConsecutiveHours,
          preferredDays: i.preferredDays,
          unavailableSlots: i.unavailableSlots || []
        })),
        courses: fresh.courses.map(c => {
          const courseType =
            c.courseType ||
            (c.requiredRoomType === 'lab' && c.lectureHours === 0
              ? 'lab'
              : c.labHours > 0
              ? 'lecture_lab'
              : 'lecture');
          return {
            id: c.id,
            code: c.code,
            title: c.title,
            courseType,
            type: courseType === 'lab' ? 'Lab' : 'Theory',
            credits: c.creditHours || 3,
            lectureCredits: c.lectureCredits ?? c.lectureHours ?? (courseType === 'lab' ? 0 : c.creditHours || 3),
            labCredits: c.labCredits ?? (c.labHours > 0 ? Math.max(1, Math.round(c.labHours / 3)) : courseType === 'lab' ? 1 : 0),
            lectureHours: c.lectureHours,
            labHours: c.labHours,
            departmentId: c.departmentId,
            assignedInstructorId: c.assignedInstructorId,
            assignedLabEngineerId: c.assignedLabEngineerId,
            assignedBatchId: c.assignedBatchId,
            semester: c.semester,
            labSessionMode: c.labSessionMode || (fresh.timeStructure.labSplitAllowed ? 'split_allowed' : 'continuous'),
            isElective: Boolean(c.isElective),
            requiredRoomType: c.requiredRoomType,
            requiredEquipment: []
          };
        }),
        classrooms: fresh.rooms.map(r => ({
          id: r.id,
          code: r.code,
          name: r.name,
          capacity: r.capacity,
          type: r.type,
          equipment: r.equipment,
          isAvailable: r.isAvailable,
          assignedLabEngineerId: r.assignedLabEngineerId
        })),
        studentGroups: fresh.studentGroups.map(g => ({
          id: g.id,
          code: g.code,
          name: g.name,
          size: g.size,
          batchCode: g.batchCode,
          departmentCode: g.departmentCode,
          semester: g.semester,
          section: g.section
        })),
        sections: fresh.sections.map(s => {
          const isLab = s.sessionType === 'Lab' || Boolean(s.spanSlots && s.spanSlots > 1) || s.componentType === 'lab';
          return {
            id: s.id,
            courseId: s.courseId,
            programId: s.programId,
            instructorId: s.instructorId,
            labEngineerId: s.labEngineerId,
            assignedLabId: s.assignedLabId,
            studentGroupId: s.studentGroupId,
            sharedGroupIds: s.sharedGroupIds || [],
            sectionCode: s.sectionNumber || 'A',
            sessionType: isLab ? 'Lab' : 'Theory',
            componentType: s.componentType || (isLab ? 'lab' : 'lecture'),
            isAtomicSession: s.isAtomicSession ?? true,
            spanSlots: s.spanSlots || (isLab ? 3 : 1),
            sessionsPerWeek: s.isAtomicSession ? 1 : s.sessionsPerWeek,
            enrollment: s.expectedEnrollment || 45,
            isLocked: Boolean(s.isLocked)
          };
        })
      };

      const res = await solveOptimizationApi(payload, user);
      if ((res.entries && res.entries.length > 0) || (res.assignments && Object.keys(res.assignments).length > 0)) {
        institutionalStore.applyBackendOptimizationResult({
          assignments: res.assignments || {},
          entries: res.entries,
          strategyName: 'Python Hybrid AI Re-Optimization',
          algorithm: 'hybrid_dsatur_ga_sa',
          versionId: res.timetableVersionId,
          fitness: {
            totalScore: res.metrics.totalScore,
            studentSatisfaction: res.metrics.studentSatisfaction,
            instructorSatisfaction: res.metrics.instructorSatisfaction,
            roomUtilization: res.metrics.roomUtilization,
            fairnessScore: res.metrics.fairnessScore,
            studentGapMinutesAvg: res.metrics.studentGapMinutesAvg,
            compactnessScore: res.metrics.compactnessScore,
            worstBatchSatisfaction: res.metrics.worstBatchSatisfaction
          },
          conflictCount: res.metrics.conflictCount
        });
        if (user?.token) {
          const instId =
            fresh.institutionProfile?.id ||
            user.institutionId ||
            institutionalStore.getCurrentInstitutionId();
          const workspace = await fetchInstitutionWorkspace(user, instId);
          institutionalStore.hydrateFromWorkspacePayload(instId, workspace, user.id);
        }
        showAppPopup({
          title: res.metrics.conflictCount === 0 ? 'Timetable Re-Optimized & Saved' : 'Re-Optimized Draft Saved in Supabase',
          message: `${res.metrics.placedCount} sessions synchronized (${res.metrics.conflictCount} hard conflicts, compactness ${Math.round(res.metrics.compactnessScore ?? res.metrics.studentSatisfaction ?? 0)}%).`,
          variant: res.metrics.conflictCount === 0 ? 'success' : 'info'
        });
      } else {
        throw new Error('Optimization engine returned zero session assignments.');
      }
    } catch (err) {
      showAppPopup({
        title: 'Re-Optimization Failed',
        message:
          err instanceof Error
            ? err.message
            : 'Unable to re-optimize and persist timetable to Supabase.',
        variant: 'error'
      });
    } finally {
      setIsSweeping(false);
    }
  };

  const persistMovedSectionToSupabase = async (
    sectionId: string,
    slot: { day: DayOfWeek; timeSlot: string; roomId: string }
  ) => {
    const user = currentUser || getStoredUser();
    if (!user?.token) {
      throw new Error('Sign in as an administrator to persist slot edits to Supabase.');
    }
    await updateSectionSlotBackend(user, sectionId, slot);
    const activeVersionId = store.scenarios[0]?.id;
    if (activeVersionId) {
      await patchTimetableEntriesBackend(user, activeVersionId, {
        updates: [
          {
            sectionId,
            day: slot.day,
            startTime: slot.timeSlot,
            roomId: slot.roomId
          }
        ]
      });
    }
  };

  // Interactive Drag-and-Drop and Slot Swap Logic (Admin-only)
  const handleDropOnSlot = async (targetDay: string, rawTargetPeriod: string) => {
    if (!isAdmin || !draggedClassItem) return;
    setDragOverCellKey(null);

    const isDraggedLab =
      draggedClassItem.sessionType === 'Lab' ||
      (draggedClassItem.spanSlots && draggedClassItem.spanSlots > 1);
    let targetPeriod = rawTargetPeriod;

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

    if (draggedClassItem.day === targetDay && draggedClassItem.time === targetPeriod) {
      setDraggedClassItem(null);
      return;
    }

    const existingClasses = (scheduleData[targetPeriod]?.[targetDay] || []).filter(filterClass);
    const conflictingItem = existingClasses[0] || null;

    const validation = institutionalStore.validateSlotMoveOrSwap(
      draggedClassItem.id,
      targetDay as DayOfWeek,
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
      const nextSlot = {
        day: targetDay as DayOfWeek,
        timeSlot: targetPeriod,
        roomId: draggedClassItem.roomId || store.rooms[0]?.id || ''
      };
      try {
        await persistMovedSectionToSupabase(draggedClassItem.id, nextSlot);
        institutionalStore.updateSectionSlot(draggedClassItem.id, nextSlot);
        showAppPopup({
          title: 'Session Moved',
          message: `Moved ${draggedClassItem.code} to ${targetDay} · ${targetPeriod} and saved to Supabase.`,
          variant: 'success'
        });
      } catch (err) {
        showAppPopup({
          title: 'Move Failed',
          message:
            err instanceof Error ? err.message : 'Unable to persist moved session to Supabase.',
          variant: 'error'
        });
      }
    }
    setDraggedClassItem(null);
  };

  const handleClassClick = (cls: ClassItem) => {
    setSelectedClass(cls);
  };

  const handleConfirmSwap = async () => {
    if (!swapDialogData) return;
    const { itemA, itemB } = swapDialogData;
    const user = currentUser || getStoredUser();
    if (!user?.token) {
      showAppPopup({
        title: 'Sign-In Required',
        message: 'Sign in as an administrator to swap sessions in Supabase.',
        variant: 'error'
      });
      return;
    }
    try {
      await swapSectionsBackend(user, itemA.id, itemB.id);
      const res = institutionalStore.swapSectionSlots(itemA.id, itemB.id);
      setSwapDialogData(null);
      showAppPopup({ title: 'Sessions Swapped', message: res.message, variant: 'success' });
    } catch (err) {
      showAppPopup({
        title: 'Swap Failed',
        message: err instanceof Error ? err.message : 'Unable to save slot swap to Supabase.',
        variant: 'error'
      });
    }
  };

  const handleConfirmOverrideMove = async () => {
    if (!conflictDialogData) return;
    const { sourceItem, targetDay, targetPeriod, targetRoomId } = conflictDialogData;
    const nextSlot = {
      day: targetDay as DayOfWeek,
      timeSlot: targetPeriod,
      roomId: targetRoomId || store.rooms[0]?.id || ''
    };
    try {
      await persistMovedSectionToSupabase(sourceItem.id, nextSlot);
      institutionalStore.updateSectionSlot(sourceItem.id, nextSlot);
      setConflictDialogData(null);
      showAppPopup({
        title: 'Session Moved (Override)',
        message: `Manually moved ${sourceItem.code} to ${targetDay} · ${targetPeriod} and saved to Supabase.`,
        variant: 'info'
      });
    } catch (err) {
      showAppPopup({
        title: 'Override Move Failed',
        message: err instanceof Error ? err.message : 'Unable to save slot move to Supabase.',
        variant: 'error'
      });
    }
  };

  const handleSwapConflictingClass = async () => {
    if (!conflictDialogData || !conflictDialogData.conflictingItem) return;
    const { sourceItem, conflictingItem } = conflictDialogData;
    const user = currentUser || getStoredUser();
    if (!user?.token) {
      showAppPopup({
        title: 'Sign-In Required',
        message: 'Sign in as an administrator to swap sessions in Supabase.',
        variant: 'error'
      });
      return;
    }
    try {
      await swapSectionsBackend(user, sourceItem.id, conflictingItem.id);
      institutionalStore.swapSectionSlots(sourceItem.id, conflictingItem.id);
      setConflictDialogData(null);
      showAppPopup({
        title: 'Sessions Swapped',
        message: `Swapped ${sourceItem.code} and ${conflictingItem.code} in Supabase.`,
        variant: 'success'
      });
    } catch (err) {
      showAppPopup({
        title: 'Swap Failed',
        message: err instanceof Error ? err.message : 'Unable to persist swap to Supabase.',
        variant: 'error'
      });
    }
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
      if (
        !effectiveInstructorId ||
        (cls.instructorId !== effectiveInstructorId && cls.labEngineerId !== effectiveInstructorId)
      ) {
        return false;
      }
    } else if (effectivePerspective === 'room') {
      if (selectedRoomId && cls.roomId !== selectedRoomId) return false;
    } else if (effectivePerspective === 'master' && selectedDeptId !== 'all') {
      const grp = store.studentGroups.find(g => g.id === cls.studentGroupId);
      const grpMatch = grp ? doesGroupMatchDepartment(grp, selectedDeptId, store.programs, store.departments) : false;
      const crsMatch = cls.departmentId === selectedDeptId;
      if (!grpMatch && !crsMatch) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        cls.code.toLowerCase().includes(q) ||
        cls.title.toLowerCase().includes(q) ||
        cls.prof.toLowerCase().includes(q) ||
        (cls.labEngineerName || '').toLowerCase().includes(q) ||
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
        message: `Exported "${result.fileName}" (1 Weekly Overview + ${result.classSheetCount} Class/Section tabs · ${result.totalSessionsCount} sessions).`,
        variant: 'success'
      });
    } catch (err) {
      console.error('Google Sheets export error:', err);
      showAppPopup({
        title: 'Export Failed',
        message: 'Failed to generate Excel workbook. Please try again.',
        variant: 'error'
      });
    } finally {
      setIsExportingSheets(false);
      setShowExportMenu(false);
    }
  };

  // Canonical CSV Export
  const handleExportCSV = (scope: 'filtered' | 'all') => {
    const safeScope = isAdmin ? scope : 'filtered';
    const model = buildCanonicalExportModel({
      store,
      scheduleData,
      filterClass,
      scope: safeScope,
      daysOverride: days
    });

    const headers = [
      'Day',
      'Start Time (24h)',
      'End Time (24h)',
      'Duration (min)',
      'Time Window',
      'Session Type',
      'Slot Source',
      'Course Code',
      'Course Title',
      'Credits',
      'Course Instructor',
      'Lab Engineer',
      'Room / Facility',
      'Batch / Section',
      'Status'
    ];

    const escapeCsv = (val: string | number | undefined) =>
      `"${String(val ?? '').replace(/"/g, '""')}"`;

    const rows = model.entries.map(e => [
      escapeCsv(e.day),
      escapeCsv(e.startTime24),
      escapeCsv(e.endTime24),
      e.durationMinutes,
      escapeCsv(e.timeDisplay),
      escapeCsv(e.sessionType === 'Lab' ? (e.isSplitLab ? 'Split Lab' : 'Continuous Lab') : 'Lecture'),
      escapeCsv(e.slotSource),
      escapeCsv(e.courseCode),
      escapeCsv(e.courseTitle),
      e.credits,
      escapeCsv(e.instructorName),
      escapeCsv(e.labEngineerName || (e.sessionType === 'Lab' ? e.instructorName : '—')),
      escapeCsv(e.roomCode),
      escapeCsv(e.cohortCode),
      escapeCsv(e.hasConflict ? 'Conflict' : 'Valid')
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const scopeLabel = safeScope === 'all' ? 'All_University_Classes' : getActiveScopeLabel();
    link.href = url;
    link.download = `SmartGrid_Timetable_${scopeLabel}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showAppPopup({
      title: 'CSV Exported',
      message: `Exported ${model.entries.length} canonical sessions to CSV (${scopeLabel.replace(/_/g, ' ')}).`,
      variant: 'success'
    });
    setShowExportMenu(false);
  };

  // Canonical Proportional PDF Export via jsPDF
  const drawProportionalPdfPage = (
    doc: jsPDF,
    model: CanonicalExportModel,
    pageEntries: CanonicalTimetableExportEntry[],
    headerTitle: string,
    headerSubtitle: string,
    scopeRightLabel: string
  ) => {
    const pageWidth = 297;
    const margin = 10;
    const contentWidth = pageWidth - margin * 2;

    doc.setFillColor(23, 23, 23);
    doc.rect(margin, 8, contentWidth, 2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(23, 23, 23);
    doc.text(headerTitle, margin, 15.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(87, 86, 79);
    doc.text(headerSubtitle, margin, 20);

    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    doc.text(`${scopeRightLabel}  •  ${dateStr}`, pageWidth - margin, 15.5, { align: 'right' });

    const headerY = 23.5;
    const headerH = 7;
    const timeColW = 24;
    const numDays = Math.max(1, model.days.length);
    const dayColW = (contentWidth - timeColW) / numDays;

    const gridTopY = headerY + headerH;
    const gridBottomY = 199;
    const gridHeight = gridBottomY - gridTopY;
    const spanMins = Math.max(60, model.timelineEndMinutes - model.timelineStartMinutes);
    const mmPerMin = gridHeight / spanMins;

    // Header row background
    doc.setFillColor(237, 234, 224);
    doc.setDrawColor(214, 211, 201);
    doc.setLineWidth(0.25);
    doc.rect(margin, headerY, contentWidth, headerH, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(23, 23, 23);
    doc.text('TIME (24H)', margin + 2, headerY + 4.7);

    model.days.forEach((day, dIdx) => {
      const colX = margin + timeColW + dIdx * dayColW;
      doc.line(colX, headerY, colX, gridBottomY);
      const fri = model.computedTiming.fridaySchedule;
      const dayTitle =
        day === 'Fri' && fri.mode === 'morning_only'
          ? `FRI (AM · ${fri.closingTime24})`
          : day === 'Fri' && fri.mode === 'jummah_break'
          ? `FRI (JUMMAH ${fri.jummahBreak.startTime24}–${fri.jummahBreak.endTime24})`
          : day.toUpperCase();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(23, 23, 23);
      doc.text(dayTitle, colX + 2.5, headerY + 4.7);
    });

    // Outer frame + Left time gutter background
    doc.setFillColor(247, 246, 239);
    doc.rect(margin, gridTopY, timeColW, gridHeight, 'F');
    doc.setDrawColor(214, 211, 201);
    doc.rect(margin, gridTopY, contentWidth, gridHeight, 'S');
    doc.line(margin + timeColW, gridTopY, margin + timeColW, gridBottomY);

    // Hour horizontal lines and labels
    for (let m = model.timelineStartMinutes; m <= model.timelineEndMinutes; m += 60) {
      const y = gridTopY + (m - model.timelineStartMinutes) * mmPerMin;
      doc.setDrawColor(228, 226, 218);
      doc.line(margin, y, margin + contentWidth, y);
      if (m < model.timelineEndMinutes) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.8);
        doc.setTextColor(87, 86, 79);
        doc.text(minutesToTime24(m), margin + 2.2, y + 4);
      }
    }

    // Official break bands (Midday & Jummah / Friday closed)
    model.breaks.forEach(brk => {
      const brkY = gridTopY + (brk.startMinutes - model.timelineStartMinutes) * mmPerMin;
      const brkH = Math.max(4, brk.durationMinutes * mmPerMin);
      model.days.forEach((day, dIdx) => {
        if (!brk.appliesToDays.includes(day)) return;
        const colX = margin + timeColW + dIdx * dayColW;
        doc.setFillColor(240, 237, 226);
        doc.rect(colX + 0.3, brkY, dayColW - 0.6, brkH, 'F');
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(5.8);
        doc.setTextColor(119, 118, 111);
        const brkText = doc.splitTextToSize(`${brk.label} (${brk.startTime24}–${brk.endTime24})`, dayColW - 3);
        doc.text(brkText[0] || brk.label, colX + 1.8, brkY + Math.min(brkH - 1.5, 4.2));
      });
    });

    // Session cards positioned by exact clock coordinates + overlap lanes
    model.days.forEach((day, dIdx) => {
      const colX = margin + timeColW + dIdx * dayColW;
      const dayItems = pageEntries
        .filter(e => e.day === day)
        .map(e => ({
          cls: e.classItem,
          startMinutes: e.startMinutes,
          endMinutes: e.endMinutes,
          durationMinutes: e.durationMinutes,
          startTime24: e.startTime24,
          endTime24: e.endTime24
        }));
      const positioned = assignOverlapLanes(dayItems);

      positioned.forEach(item => {
        const y = gridTopY + (item.startMinutes - model.timelineStartMinutes) * mmPerMin + 0.5;
        const h = Math.max(7, (item.endMinutes - item.startMinutes) * mmPerMin - 1);
        const laneW = (dayColW - 1.4) / item.laneCount;
        const x = colX + 0.7 + item.laneIndex * laneW;
        const w = Math.max(6, laneW - 0.5);

        const pastel = getCoursePastel(item.cls.code);
        doc.setFillColor(pastel.fillRgb[0], pastel.fillRgb[1], pastel.fillRgb[2]);
        doc.setDrawColor(item.cls.hasConflict ? 198 : 160, item.cls.hasConflict ? 40 : 158, item.cls.hasConflict ? 40 : 148);
        doc.roundedRect(x, y, w, h, 1, 1, 'FD');

        const isLab = item.cls.sessionType === 'Lab' || item.cls.componentType === 'lab';
        const headerStr = `${item.cls.code} · ${item.startTime24}–${item.endTime24}`;
        const staffStr = isLab && item.cls.labEngineerName
          ? `${item.cls.prof} / Eng: ${item.cls.labEngineerName}`
          : item.cls.prof;
        const locStr = `${item.cls.room} · ${item.cls.cohort}`;

        const innerW = Math.max(5, w - 2.2);
        const fontSize = item.laneCount >= 3 ? 4.8 : item.laneCount === 2 ? 5.3 : 6;
        doc.setFontSize(fontSize);

        let textY = y + 3.2;
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(23, 23, 23);
        const headerLines = doc.splitTextToSize(headerStr, innerW);
        doc.text(headerLines[0] || headerStr, x + 1.1, textY);
        textY += 2.6;

        if (h > 10) {
          doc.setFont('helvetica', 'normal');
          const titleLines = doc.splitTextToSize(item.cls.title, innerW);
          const maxTitleLines = h >= 28 ? 3 : 2;
          titleLines.slice(0, maxTitleLines).forEach((ln: string) => {
            if (textY < y + h - 2.2) {
              doc.text(ln, x + 1.1, textY);
              textY += 2.4;
            }
          });
        }

        if (h > 13 && textY < y + h - 1.2) {
          doc.setFontSize(Math.max(4.5, fontSize - 0.6));
          doc.setTextColor(68, 68, 64);
          const metaLines = doc.splitTextToSize(`${staffStr} | ${locStr}`, innerW);
          metaLines.slice(0, h >= 24 ? 2 : 1).forEach((ln: string) => {
            if (textY < y + h - 0.8) {
              doc.text(ln, x + 1.1, textY);
              textY += 2.2;
            }
          });
        }
      });
    });
  };

  const handleExportPDF = (scope: 'filtered' | 'all') => {
    const safeScope = isAdmin ? scope : 'filtered';
    const model = buildCanonicalExportModel({
      store,
      scheduleData,
      filterClass,
      scope: safeScope,
      daysOverride: days
    });

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const scopeLabel = safeScope === 'all' ? 'All University Classes' : getActiveScopeLabel().replace(/_/g, ' ');

    if (safeScope === 'all') {
      drawProportionalPdfPage(
        doc,
        model,
        model.entries,
        `${model.institutionName.toUpperCase()} — UNIVERSITY TIMETABLE OVERVIEW`,
        `${model.termName.toUpperCase()}  •  ${model.computedTiming.summaryText}`,
        `${model.entries.length} Sessions`
      );

      const activeGroups = store.studentGroups.filter(g =>
        model.entries.some(e => e.studentGroupId === g.id || e.classItem.sharedGroupIds?.includes(g.id))
      );
      activeGroups.forEach(grp => {
        doc.addPage('a4', 'landscape');
        const grpEntries = model.entries.filter(
          e => e.studentGroupId === grp.id || e.classItem.sharedGroupIds?.includes(grp.id)
        );
        drawProportionalPdfPage(
          doc,
          model,
          grpEntries,
          `${model.institutionName.toUpperCase()} — SECTION TIMETABLE: ${grp.code}`,
          `${grp.name}  •  ${model.termName}  •  ${model.computedTiming.operatingHoursLabel}`,
          `${grpEntries.length} Sessions`
        );
      });
    } else {
      drawProportionalPdfPage(
        doc,
        model,
        model.entries,
        `${model.institutionName.toUpperCase()} — ${scopeLabel.toUpperCase()}`,
        `${model.termName.toUpperCase()}  •  ${model.computedTiming.summaryText}`,
        `${model.entries.length} Sessions`
      );
    }

    const fileLabel = safeScope === 'all' ? 'All_University_Classes' : getActiveScopeLabel();
    doc.save(`SmartGrid_Timetable_${fileLabel}.pdf`);

    showAppPopup({
      title: 'PDF Exported',
      message: `Exported canonical landscape PDF (${fileLabel.replace(/_/g, ' ')} · ${model.entries.length} sessions).`,
      variant: 'success'
    });
    setShowExportMenu(false);
  };

  const currentInstructorObj = store.instructors.find(i => i.id === effectiveInstructorId) || null;
  const currentRoomObj = store.rooms.find(r => r.id === selectedRoomId);
  const visibleDays: DayOfWeek[] = calendarMode === 'day' ? [activeFocusDay] : days;

  const activeFilteredSections = store.sections.filter(s => {
    if (!s.assignedSlot) return false;
    if (effectivePerspective === 'cohort') {
      return (
        Boolean(effectiveCohortId) &&
        (s.studentGroupId === effectiveCohortId || Boolean(s.sharedGroupIds?.includes(effectiveCohortId!)))
      );
    }
    if (effectivePerspective === 'instructor') {
      return (
        Boolean(effectiveInstructorId) &&
        (s.instructorId === effectiveInstructorId || s.labEngineerId === effectiveInstructorId)
      );
    }
    if (effectivePerspective === 'room') return s.assignedSlot.roomId === selectedRoomId;
    if (selectedDeptId !== 'all') {
      const grp = store.studentGroups.find(g => g.id === s.studentGroupId);
      if (grp && doesGroupMatchDepartment(grp, selectedDeptId, store.programs, store.departments)) {
        return true;
      }
      const crs = store.courses.find(c => c.id === s.courseId);
      return crs ? doesCourseMatchDepartment(crs, selectedDeptId, store.departments) : false;
    }
    return true;
  });

  // Collect deduplicated filtered ClassItems per visible day & compute proportional timeline bounds + Student Idle Gap metric
  const {
    visibleItemsByDay,
    timelineStartMins,
    timelineEndMins,
    cohortGapStats
  } = useMemo(() => {
    const byDay = new Map<DayOfWeek, ClassItem[]>();
    visibleDays.forEach(d => byDay.set(d, []));

    const seenByDay = new Map<string, Set<string>>();
    visibleDays.forEach(d => seenByDay.set(d, new Set<string>()));

    let minStart = dynamicSlots[0]?.startMinutes ?? parseTime24ToMinutes(computedTiming.dayStartTime, 540);
    let maxEnd = dynamicSlots[dynamicSlots.length - 1]?.cycleEndMinutes ?? parseTime24ToMinutes(computedTiming.dayEndTime, 1020);

    Object.entries(scheduleData).forEach(([_period, dayMap]) => {
      Object.entries(dayMap).forEach(([rawDay, items]) => {
        const dNorm = visibleDays.find(vd => vd.toLowerCase() === rawDay.toLowerCase());
        if (!dNorm) return;
        const daySeen = seenByDay.get(dNorm)!;
        const list = byDay.get(dNorm)!;

        items.forEach(cls => {
          if (!filterClass(cls)) return;
          if (daySeen.has(cls.id)) return;
          daySeen.add(cls.id);
          list.push(cls);

          const st = cls.startMinutes ?? minStart;
          const en = cls.endMinutes ?? st + (cls.durationMinutes || computedTiming.periodLengthMinutes || 50);
          if (st < minStart) minStart = st;
          if (en > maxEnd) maxEnd = en;
        });
      });
    });

    // Compute daily unnecessary student idle gaps (excluding short transition buffer <= shortBreakMinutes and official breaks)
    let totalIdleMins = 0;
    let activeStudyDays = 0;
    if (effectivePerspective === 'cohort') {
      byDay.forEach((items, day) => {
        if (items.length === 0) return;
        activeStudyDays += 1;
        const sorted = [...items].sort((a, b) => (a.startMinutes ?? 540) - (b.startMinutes ?? 540));
        const brkStart =
          day === 'Fri' && computedTiming.fridaySchedule.jummahBreak.enabled
            ? computedTiming.fridaySchedule.jummahBreak.startMinutes
            : computedTiming.middayBreak.enabled
            ? computedTiming.middayBreak.startMinutes
            : -1;
        const brkEnd =
          day === 'Fri' && computedTiming.fridaySchedule.jummahBreak.enabled
            ? computedTiming.fridaySchedule.jummahBreak.endMinutes
            : computedTiming.middayBreak.enabled
            ? computedTiming.middayBreak.endMinutes
            : -1;
        const shortBuf = computedTiming.shortBreakEnabled ? computedTiming.shortBreakMinutes : 0;

        for (let i = 0; i < sorted.length - 1; i++) {
          const curEnd = sorted[i].endMinutes ?? (sorted[i].startMinutes ?? 540) + (sorted[i].durationMinutes ?? 50);
          const nextStart = sorted[i + 1].startMinutes ?? curEnd;
          if (nextStart <= curEnd) continue;
          let rawGap = nextStart - curEnd;
          if (brkStart >= 0 && brkEnd > brkStart) {
            const ov = Math.max(0, Math.min(nextStart, brkEnd) - Math.max(curEnd, brkStart));
            rawGap = Math.max(0, rawGap - ov);
          }
          if (rawGap > shortBuf) {
            totalIdleMins += rawGap - shortBuf;
          }
        }
      });
    }

    return {
      visibleItemsByDay: byDay,
      timelineStartMins: Math.floor(minStart / 60) * 60,
      timelineEndMins: Math.ceil(maxEnd / 60) * 60,
      cohortGapStats: {
        totalIdleMins,
        activeStudyDays,
        avgDailyIdleMins: activeStudyDays > 0 ? Math.round(totalIdleMins / activeStudyDays) : 0
      }
    };
  }, [scheduleData, visibleDays, dynamicSlots, computedTiming, effectivePerspective, effectiveCohortId, effectiveInstructorId, selectedRoomId, selectedDeptId, searchQuery]);

  const latestScenario = store.scenarios[0];
  const isDraftOrConflicted = conflicts.length > 0 || latestScenario?.status === 'draft';

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
                <button
                  type="button"
                  onClick={async () => {
                    const user = currentUser || getStoredUser();
                    if (!user?.token) {
                      showAppPopup({
                        title: 'Sign-In Required',
                        message: 'Sign in as an administrator to load sample university data into Supabase.',
                        variant: 'error'
                      });
                      return;
                    }
                    try {
                      const instId =
                        store.institutionProfile?.id ||
                        user.institutionId ||
                        institutionalStore.getCurrentInstitutionId();
                      const res = await loadSampleInstitutionCatalogBackend(user, instId);
                      institutionalStore.hydrateFromWorkspacePayload(instId, res.workspace, user.id);
                      showAppPopup({
                        title: 'Sample University Catalog Loaded',
                        message: 'Loaded sample university departments, courses, faculty, classrooms, and sections into Supabase. Click Re-Optimize or Generate Timetable to solve.',
                        variant: 'success'
                      });
                    } catch (err) {
                      showAppPopup({
                        title: 'Sample Load Failed',
                        message:
                          err instanceof Error
                            ? err.message
                            : 'Unable to load sample catalog into Supabase.',
                        variant: 'error'
                      });
                    }
                  }}
                  className="btn-primary h-10 px-5 text-xs font-semibold bg-[#E8D36B] text-[#171717] hover:bg-[#D4BC4C] border border-[#D4BC4C]"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Load Sample University Data &amp; Generate</span>
                </button>
                {onNavigate && (
                  <button
                    type="button"
                    onClick={() => onNavigate('generate')}
                    className="btn-secondary h-10 px-4 text-xs font-semibold"
                  >
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

  const PX_PER_MIN = 1.55;
  const timelineSpanMins = Math.max(120, timelineEndMins - timelineStartMins);
  const timelineHeightPx = Math.round(timelineSpanMins * PX_PER_MIN);
  const hourTicks: number[] = [];
  for (let m = timelineStartMins; m <= timelineEndMins; m += 60) {
    hourTicks.push(m);
  }

  return (
    <div className="space-y-4">
      {/* =========================================================
          1. COMPACT EDITORIAL HEADER & EXPORT / PRINT / OPTIMIZE
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
          <p className="text-[11px] text-[#77766F] font-mono-tabular mt-0.5">
            {computedTiming.operatingHoursLabel} · {computedTiming.fridaySchedule.summaryText}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0 no-print">
          <button
            type="button"
            onClick={() => window.print()}
            className="btn-secondary text-xs h-9 px-3.5"
            title="Print landscape timetable"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>

          <div className="relative" ref={exportDropdownRef}>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={isExportingSheets}
              className="btn-secondary text-xs h-9 px-3.5"
              title="Export timetable to Excel (.xlsx), PDF, or CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExportingSheets ? 'Exporting...' : 'Export'}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
            </button>

            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-80 bg-white border border-[#E4E2DA] rounded-2xl shadow-xl z-50 py-2">
                <div className="px-4 py-2 border-b border-[#E4E2DA]">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[#77766F]">
                    Excel Workbook (.xlsx)
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
                        <div className="font-semibold">All Classes Workbook (.xlsx)</div>
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
                  {isAdmin && (
                    <button
                      onClick={() => handleExportPDF('all')}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between hover:bg-[#F7F6EF] transition-colors cursor-pointer text-[#171717]"
                    >
                      <span className="flex items-center gap-2 font-medium">
                        <FileText className="w-3.5 h-3.5" />
                        <span>All Sections Pack (.pdf)</span>
                      </span>
                      <span className="text-[10px] font-mono-tabular text-[#77766F]">Multi-Page</span>
                    </button>
                  )}

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

      {/* Draft / Conflict Notice Banner */}
      {isDraftOrConflicted && (
        <div
          className={`px-4 py-2.5 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-2 ${
            conflicts.length > 0
              ? 'bg-[#FDE8E8] border-[#F5B5B5] text-[#8B1E1E]'
              : 'bg-[#FFF6D6] border-[#F0D98C] text-[#171717]'
          }`}
        >
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              {conflicts.length > 0
                ? `${conflicts.length} hard clash${conflicts.length > 1 ? 'es' : ''} detected (${conflicts[0]?.description}). Publishing is blocked until resolved.`
                : 'Active timetable is currently saved as a Draft awaiting publication.'}
            </span>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2 no-print">
              {conflicts.length === 0 && latestScenario?.status === 'draft' && (
                <button
                  type="button"
                  onClick={async () => {
                    const user = currentUser || getStoredUser();
                    if (!user?.token) {
                      showAppPopup({
                        title: 'Sign-In Required',
                        message: 'Sign in as an administrator to publish timetables in Supabase.',
                        variant: 'error'
                      });
                      return;
                    }
                    try {
                      const instId =
                        store.institutionProfile?.id ||
                        user.institutionId ||
                        institutionalStore.getCurrentInstitutionId();
                      await publishTimetableBackend(user, latestScenario.id);
                      const freshWorkspace = await fetchInstitutionWorkspace(user, instId);
                      institutionalStore.hydrateFromWorkspacePayload(instId, freshWorkspace, user.id);
                      showAppPopup({
                        title: 'Timetable Published',
                        message: `"${latestScenario.name}" is now published in Supabase.`,
                        variant: 'success'
                      });
                    } catch (err) {
                      showAppPopup({
                        title: 'Publish Blocked',
                        message:
                          err instanceof Error
                            ? err.message
                            : 'Unable to publish timetable draft in Supabase.',
                        variant: 'error'
                      });
                    }
                  }}
                  className="px-2.5 py-1 rounded-lg bg-[#16A34A] text-white text-[11px] font-semibold cursor-pointer"
                >
                  Publish Draft
                </button>
              )}
              {conflicts.length > 0 && (
                <button
                  type="button"
                  onClick={handleRunSweep}
                  disabled={isSweeping}
                  className="px-2.5 py-1 rounded-lg bg-[#171717] text-white text-[11px] font-semibold cursor-pointer"
                >
                  Auto-Resolve Conflicts
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* =========================================================
          2. FIXED-DIMENSION SCOPE & VIEW SELECTOR
         ========================================================= */}
      <div className="sf-card-white p-3.5 space-y-2.5 no-print">
        <div className="min-h-[40px] flex flex-col xl:flex-row xl:items-center justify-between gap-2.5">
          {isAdmin ? (
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

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {effectivePerspective === 'cohort' && (
              <div
                className="inline-flex items-center gap-1.5 px-2.5 h-9 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] text-[11px] font-mono-tabular text-[#171717]"
                title="Student idle time between consecutive sessions excluding short buffers and midday/Jummah breaks"
              >
                <Clock className="w-3.5 h-3.5 text-[#77766F]" />
                <span>
                  Gap: <strong>{cohortGapStats.avgDailyIdleMins}m/day</strong> · {cohortGapStats.activeStudyDays}d
                </span>
              </div>
            )}

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

        {/* ROW 2 */}
        <div className="min-h-[44px] pt-2.5 border-t border-[#E4E2DA] flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
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
                      {i.name} ({i.staffRole === 'lab_engineer' ? 'Lab Engineer' : i.title})
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

          <div className="flex items-center gap-2 shrink-0">
            {calendarMode === 'week' && (
              <div className="inline-flex items-center p-1 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] h-9">
                {[
                  { span: 7 as const, label: fridayEnabled ? '7-Day (Mon–Sun)' : '6-Day (No Fri)' },
                  {
                    span: 5 as const,
                    label: fridayEnabled ? '5-Day (Mon–Fri)' : '4-Day (Mon–Thu)'
                  }
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
                {sevenDayList.map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setFocusedDay(d)}
                    className={`h-7 w-10 rounded-lg text-xs font-semibold cursor-pointer inline-flex items-center justify-center ${
                      activeFocusDay === d
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
          3. EXACT PROPORTIONAL TIME-AXIS TIMETABLE GRID OR AGENDA
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
            {visibleDays.flatMap(day => {
              const dayItems = [...(visibleItemsByDay.get(day) || [])].sort(
                (a, b) => (a.startMinutes ?? 540) - (b.startMinutes ?? 540)
              );
              return dayItems.map(cls => {
                const pastel = getCoursePastel(cls.code);
                const isLab = cls.sessionType === 'Lab' || Boolean(cls.spanSlots && cls.spanSlots > 1) || cls.componentType === 'lab';
                const start24 = cls.startTime24 || minutesToTime24(cls.startMinutes ?? 540);
                const end24 = cls.endTime24 || minutesToTime24((cls.startMinutes ?? 540) + (cls.durationMinutes ?? 50));
                const durMins = cls.durationMinutes || computedTiming.periodLengthMinutes;
                return (
                  <div
                    key={`${day}-${cls.id}`}
                    onClick={() => handleClassClick(cls)}
                    style={{ backgroundColor: pastel.bg, borderColor: cls.hasConflict ? '#C62828' : pastel.border }}
                    className={`p-4 rounded-xl border text-[#171717] cursor-pointer hover:-translate-y-0.5 transition-transform space-y-2 ${
                      cls.hasConflict ? 'ring-2 ring-[#C62828]/40' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono-tabular font-semibold text-[#171717]/80">
                        {cls.code} · {isLab ? (cls.isSplitLab ? `Split Lab (${durMins}m)` : `Lab (${durMins}m)`) : `Lecture (${durMins}m)`}
                      </span>
                      <span className="font-mono-tabular font-medium">
                        {day} · {start24}–{end24}
                      </span>
                    </div>
                    <div className="font-serif-editorial text-base leading-snug">
                      {cls.title}
                    </div>
                    <div className="text-xs text-[#171717]/80 pt-1.5 border-t border-black/10 space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="font-mono-tabular font-semibold">{cls.room}</span>
                        <span>{isFaculty ? cls.cohort : cls.prof}</span>
                      </div>
                      {isLab && cls.labEngineerName && (
                        <div className="text-[11px] text-[#171717]/75">
                          Lab Engineer: <strong className="font-semibold">{cls.labEngineerName}</strong>
                        </div>
                      )}
                    </div>
                  </div>
                );
              });
            })}
          </div>
        </div>
      ) : (
        <div className="sf-card-white w-full overflow-hidden">
          {/* Day Header Bar */}
          <div className="flex border-b border-[#E4E2DA] bg-[#F7F6EF]">
            <div className="w-[78px] sm:w-[90px] shrink-0 py-2.5 px-2.5 text-[10.5px] font-semibold text-[#77766F] border-r border-[#E4E2DA] flex items-center">
              Time (24h)
            </div>
            <div
              className="flex-1 grid min-w-0"
              style={{ gridTemplateColumns: `repeat(${Math.max(1, visibleDays.length)}, minmax(0, 1fr))` }}
            >
              {visibleDays.map((day, idx) => {
                const isWeekend = day === 'Sat' || day === 'Sun';
                const fri = computedTiming.fridaySchedule;
                return (
                  <div
                    key={day}
                    className={`py-2 px-2.5 text-xs sm:text-sm font-serif-editorial text-[#171717] overflow-hidden ${
                      idx > 0 ? 'border-l border-[#E4E2DA]' : ''
                    } ${isWeekend ? 'bg-[#F7F6EF]/75 text-[#77766F]' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-1.5 min-w-0">
                      <span className="truncate font-semibold">{day}</span>
                      {day === 'Fri' && fri.mode === 'jummah_break' && (
                        <span
                          className="text-[10px] font-sans font-mono-tabular font-normal text-[#77766F] truncate shrink"
                          title={`Friday Jummah Break: ${fri.jummahBreak.fullRangeLabel}`}
                        >
                          {fri.jummahBreak.startTime24}–{fri.jummahBreak.endTime24}
                        </span>
                      )}
                      {day === 'Fri' && fri.mode === 'morning_only' && (
                        <span
                          className="text-[10px] font-sans font-mono-tabular font-normal text-[#77766F] truncate shrink"
                          title={`Friday Half-Day: ${fri.operatingHoursLabel}`}
                        >
                          AM · {fri.closingTime24}
                        </span>
                      )}
                      {isWeekend && (
                        <span className="text-[10px] font-sans font-normal text-[#77766F] truncate">
                          Off
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Continuous Proportional Time-Axis Body */}
          <div className="flex relative bg-white" style={{ height: `${timelineHeightPx}px` }}>
            {/* Left Vertical Clock Gutter */}
            <div className="w-[78px] sm:w-[90px] shrink-0 relative bg-[#F7F6EF]/45 border-r border-[#E4E2DA] select-none">
              {hourTicks.map((m, idx) => {
                const topPx = (m - timelineStartMins) * PX_PER_MIN;
                const isLast = idx === hourTicks.length - 1;
                return (
                  <div
                    key={m}
                    style={{ top: `${isLast ? Math.max(0, topPx - 16) : topPx}px` }}
                    className="absolute inset-x-0 px-2 pt-1 flex flex-col"
                  >
                    <span className="font-mono-tabular text-[10.5px] font-bold text-[#171717] leading-none">
                      {minutesToTime24(m)}
                    </span>
                    {!isLast && (
                      <span className="font-mono-tabular text-[9px] text-[#77766F] mt-0.5 leading-none">
                        {m >= 720 ? (m === 720 ? '12 PM' : `${(m / 60) - 12} PM`) : `${m / 60} AM`}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Day Columns Grid */}
            <div
              className="flex-1 grid relative min-w-0"
              style={{ gridTemplateColumns: `repeat(${Math.max(1, visibleDays.length)}, minmax(0, 1fr))` }}
            >
              {visibleDays.map((day, dIdx) => {
                const dayItems = visibleItemsByDay.get(day) || [];
                const positionedItems = assignOverlapLanes(
                  dayItems.map(cls => {
                    const st = cls.startMinutes ?? parseTime24ToMinutes(cls.startTime24 || '09:00', 540);
                    const dur = cls.durationMinutes || computedTiming.periodLengthMinutes || 50;
                    const en = cls.endMinutes ?? st + dur;
                    return {
                      cls,
                      startMinutes: st,
                      endMinutes: en,
                      durationMinutes: Math.max(20, en - st),
                      startTime24: cls.startTime24 || minutesToTime24(st),
                      endTime24: cls.endTime24 || minutesToTime24(en)
                    };
                  })
                );

                const middayApplies =
                  computedTiming.middayBreak.enabled &&
                  computedTiming.middayBreak.durationMinutes > 0 &&
                  (day !== 'Fri' || computedTiming.fridaySchedule.mode === 'standard');

                const fri = computedTiming.fridaySchedule;
                const showJummahBand =
                  day === 'Fri' && fri.mode === 'jummah_break' && fri.jummahBreak.durationMinutes > 0;
                const showFridayClosedBand =
                  day === 'Fri' && fri.mode === 'morning_only' && timelineEndMins > fri.jummahBreak.startMinutes;

                return (
                  <div
                    key={day}
                    className={`relative h-full overflow-hidden ${
                      dIdx > 0 ? 'border-l border-[#E4E2DA]' : ''
                    } ${day === 'Sat' || day === 'Sun' ? 'bg-[#F7F6EF]/35' : ''}`}
                  >
                    {/* Hourly Guide Lines */}
                    {hourTicks.map(m => {
                      const topPx = (m - timelineStartMins) * PX_PER_MIN;
                      return (
                        <div
                          key={`line-${day}-${m}`}
                          style={{ top: `${topPx}px` }}
                          className="absolute inset-x-0 border-t border-[#E4E2DA]/80 pointer-events-none"
                        />
                      );
                    })}

                    {/* Interactive Slot Drop Targets (visible/active during admin drag) */}
                    {isAdmin &&
                      draggedClassItem &&
                      dynamicSlots.map(slotMeta => {
                        const effSlot = getEffectiveSlotDisplayForDay(day, slotMeta.period, computedTiming);
                        if (day === 'Fri' && !effSlot.isOpen) return null;
                        const sStart = effSlot.slot?.startMinutes ?? slotMeta.startMinutes ?? 540;
                        const sEnd = effSlot.slot?.lectureEndMinutes ?? slotMeta.lectureEndMinutes ?? sStart + 50;
                        const topPx = (sStart - timelineStartMins) * PX_PER_MIN;
                        const hPx = Math.max(28, (sEnd - sStart) * PX_PER_MIN);
                        const cellKey = `${day}__${slotMeta.slotNumber}`;
                        const isOver = dragOverCellKey === cellKey;
                        return (
                          <div
                            key={`drop-${cellKey}`}
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
                              handleDropOnSlot(day, slotMeta.period);
                            }}
                            style={{ top: `${topPx}px`, height: `${hPx}px` }}
                            className={`absolute inset-x-1 z-30 rounded-lg border-2 border-dashed transition-colors flex items-center justify-center text-[10px] font-mono-tabular font-semibold ${
                              isOver
                                ? 'bg-[#B8F2E6]/75 border-[#171717] text-[#171717]'
                                : 'bg-[#F7F6EF]/45 border-[#CFCBC0] text-[#77766F]'
                            }`}
                          >
                            Drop {day} · {minutesToTime24(sStart)}
                          </div>
                        );
                      })}

                    {/* Protected Midday Break Band */}
                    {middayApplies && (
                      <div
                        style={{
                          top: `${(computedTiming.middayBreak.startMinutes - timelineStartMins) * PX_PER_MIN}px`,
                          height: `${computedTiming.middayBreak.durationMinutes * PX_PER_MIN}px`
                        }}
                        className="absolute inset-x-0 z-10 bg-[#EDEAE0]/85 border-y border-[#D4D1C7] flex flex-col items-center justify-center text-center px-2 pointer-events-none"
                      >
                        <div className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-[#57564F]">
                          <Coffee className="w-3 h-3 text-[#171717] shrink-0" />
                          <span className="truncate">Midday Break</span>
                        </div>
                        <span className="text-[9.5px] font-mono-tabular text-[#77766F] truncate">
                          {computedTiming.middayBreak.startTime24}–{computedTiming.middayBreak.endTime24}
                        </span>
                      </div>
                    )}

                    {/* Friday Jummah Break Band */}
                    {showJummahBand && (
                      <div
                        style={{
                          top: `${(fri.jummahBreak.startMinutes - timelineStartMins) * PX_PER_MIN}px`,
                          height: `${fri.jummahBreak.durationMinutes * PX_PER_MIN}px`
                        }}
                        className="absolute inset-x-0 z-10 bg-[#E8D36B]/20 border-y border-[#D4BC4C] flex flex-col items-center justify-center text-center px-2 pointer-events-none overflow-hidden"
                      >
                        <div className="w-full inline-flex items-center justify-center gap-1 text-[10.5px] font-semibold text-[#57564F]">
                          <Coffee className="w-3 h-3 text-[#171717] shrink-0" />
                          <span className="truncate">Jummah Break</span>
                        </div>
                        <span className="w-full text-[9.5px] font-mono-tabular text-[#77766F] truncate">
                          {fri.jummahBreak.startTime24}–{fri.jummahBreak.endTime24}
                        </span>
                      </div>
                    )}

                    {/* Friday Half-Day Closed Band */}
                    {showFridayClosedBand && (
                      <div
                        style={{
                          top: `${(fri.jummahBreak.startMinutes - timelineStartMins) * PX_PER_MIN}px`,
                          height: `${(timelineEndMins - fri.jummahBreak.startMinutes) * PX_PER_MIN}px`
                        }}
                        className="absolute inset-x-0 z-10 bg-[#F7F6EF]/90 border-t border-dashed border-[#D4D1C7] flex flex-col items-center justify-center text-center px-2 pointer-events-none overflow-hidden"
                      >
                        <span className="w-full text-[10.5px] font-semibold text-[#77766F] truncate">
                          Closed (Jummah)
                        </span>
                        <span className="w-full text-[9.5px] font-mono-tabular text-[#9E9D96] truncate">
                          From {fri.closingTime24}
                        </span>
                      </div>
                    )}

                    {/* Instructor Unavailable Overlays */}
                    {effectivePerspective === 'instructor' &&
                      currentInstructorObj?.unavailableSlots
                        .filter(u => u.day === day)
                        .map((u, uIdx) => {
                          const matchedSlot = dynamicSlots.find(s => s.period === u.timeSlot);
                          const uStart = matchedSlot?.startMinutes ?? 540;
                          const uEnd = matchedSlot?.lectureEndMinutes ?? uStart + 50;
                          return (
                            <div
                              key={`unavail-${day}-${uIdx}`}
                              style={{
                                top: `${(uStart - timelineStartMins) * PX_PER_MIN}px`,
                                height: `${Math.max(24, (uEnd - uStart) * PX_PER_MIN)}px`
                              }}
                              className="absolute inset-x-1 z-10 rounded-lg bg-[#F7F6EF] border border-dashed border-[#CFCBC0] flex items-center justify-center text-[9.5px] text-[#77766F] pointer-events-none"
                            >
                              Unavailable
                            </div>
                          );
                        })}

                    {/* Exact Time-Scaled Session Cards with Side-by-Side Overlap Lanes */}
                    {positionedItems.map(item => {
                      const { cls, laneIndex, laneCount, startMinutes, endMinutes, durationMinutes, startTime24, endTime24 } = item;
                      const pastel = getCoursePastel(cls.code);
                      const isLab = cls.sessionType === 'Lab' || Boolean(cls.spanSlots && cls.spanSlots > 1) || cls.componentType === 'lab';
                      const topPx = (startMinutes - timelineStartMins) * PX_PER_MIN + 1;
                      const heightPx = Math.max(46, (endMinutes - startMinutes) * PX_PER_MIN - 2);
                      const isTallBlock = heightPx >= 120;
                      const isNarrowLane = laneCount >= 2 || visibleDays.length >= 7;

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
                            top: `${topPx}px`,
                            height: `${heightPx}px`,
                            left: `calc(${(laneIndex / laneCount) * 100}% + 3px)`,
                            width: `calc(${100 / laneCount}% - 6px)`,
                            backgroundColor: pastel.bg,
                            borderColor: cls.hasConflict ? '#C62828' : pastel.border
                          }}
                          className={`absolute z-20 rounded-xl border text-[#171717] flex flex-col justify-between transition-all hover:z-30 hover:-translate-y-0.5 hover:shadow-md overflow-hidden ${
                            isNarrowLane ? 'px-1.5 py-1' : 'px-2.5 py-1.5'
                          } ${cls.hasConflict ? 'ring-2 ring-[#C62828]' : ''} ${
                            isAdmin ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                          }`}
                          title={`${cls.code} — ${cls.title} (${startTime24}–${endTime24}, ${durationMinutes}m)\nInstructor: ${cls.prof}${
                            isLab && cls.labEngineerName ? `\nLab Engineer: ${cls.labEngineerName}` : ''
                          }\nRoom: ${cls.room} · ${cls.cohort}`}
                        >
                          {/* Header Meta */}
                          <div className="flex items-center justify-between gap-1 text-[9.5px] font-mono-tabular font-bold text-[#171717]/85 min-w-0">
                            <span className="inline-flex items-center gap-0.5 truncate">
                              {isAdmin && !isNarrowLane && (
                                <GripVertical className="w-2.5 h-2.5 text-[#77766F] shrink-0" />
                              )}
                              <span className="truncate">{cls.code}</span>
                              {!isNarrowLane && (
                                <span className="shrink-0">
                                  · {isLab ? (cls.isSplitLab ? `LAB ${durationMinutes}m` : `LAB`) : `${durationMinutes}m`}
                                </span>
                              )}
                            </span>
                            <span className="inline-flex items-center gap-0.5 shrink-0">
                              {cls.hasConflict && (
                                <AlertCircle className="w-2.5 h-2.5 text-[#C62828] shrink-0" />
                              )}
                              {cls.isLocked && <Lock className="w-2.5 h-2.5 shrink-0" />}
                            </span>
                          </div>

                          {/* Course Title */}
                          <div
                            className={`${
                              isTallBlock
                                ? 'font-serif-editorial text-xs sm:text-[13px] font-semibold line-clamp-3 my-auto py-1'
                                : 'font-semibold text-[10.5px] leading-tight line-clamp-2'
                            } text-[#171717] break-words`}
                          >
                            {cls.title}
                          </div>

                          {/* Footer: Staff (Instructor + Lab Engineer) + Room + Exact Time */}
                          <div className="pt-1 border-t border-black/10 text-[9px] text-[#171717]/85 leading-tight space-y-0.5 min-w-0">
                            <div className="truncate font-medium">
                              {effectivePerspective === 'instructor' ? cls.cohort : cls.prof}
                            </div>
                            {isLab && cls.labEngineerName && (isTallBlock || heightPx >= 72) && (
                              <div className="truncate text-[#171717]/80">
                                Eng: <strong className="font-semibold">{cls.labEngineerName}</strong>
                              </div>
                            )}
                            <div className="flex items-center justify-between gap-1 font-mono-tabular font-semibold text-[#171717] min-w-0">
                              <span className="truncate">
                                {cls.room}
                                {effectivePerspective === 'master' ? ` · ${cls.cohort}` : ''}
                              </span>
                              {!isNarrowLane && (
                                <span className="shrink-0 text-[8.5px] text-[#171717]/75">
                                  {startTime24}–{endTime24}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs no-print">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs no-print">
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
