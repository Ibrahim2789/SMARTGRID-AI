import React, { useState, useEffect, useMemo } from 'react';
import { SmartGridNav, RouteType } from './SmartGridNav';
import { useInstitutionalData, institutionalStore, InstitutionalDataStore } from '../data/store';
import { buildMatrixSchedule } from '../data/solverAdapter';
import {
  computeAcademicScheduleConfig,
  TimetableManagementPolicy,
  validateAcademicTimingConfig
} from '../types/institutional';
import { exportTimetableToGoogleSheetsWorkbook } from '../utils/googleSheetsExport';
import {
  AuthenticatedVotingUser,
  solveOptimizationApi,
  compareOptimizationAlgorithmsBackend,
  fetchInstitutionWorkspace,
  updateConstraintBackend,
  BackendAlgorithmBenchmarkItem
} from '../services/votingApi';
import { showAppPopup } from './ToastPopupHost';
import {
  Play,
  Sliders,
  Check,
  Sparkles,
  ArrowRight,
  Lock,
  Building2,
  Users,
  BookOpen,
  DoorOpen,
  Clock,
  Coffee,
  FlaskConical,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  Layers,
  Cpu,
  Calendar,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

interface GenerateScreenProps {
  onNavigate: (route: RouteType) => void;
  onOpenAuth?: (mode?: 'signin' | 'signup') => void;
  onSignOut?: () => void;
  currentUser?: AuthenticatedVotingUser | null;
  hideNav?: boolean;
}

type SchedulingScopeMode = 'whole_university' | 'department_wise' | 'custom_cohorts';

export const GenerateScreen: React.FC<GenerateScreenProps> = ({
  onNavigate,
  onOpenAuth,
  onSignOut,
  currentUser,
  hideNav = false
}) => {
  const store = useInstitutionalData();
  const computedTiming = computeAcademicScheduleConfig(store.timeStructure);
  const configuredPolicy: TimetableManagementPolicy =
    store.institutionProfile?.timetableManagementPolicy || 'whole_university';

  // 1. Multi-Semester Selection (defaults to all active semesters configured by the university)
  const [selectedTermIds, setSelectedTermIds] = useState<string[]>(() => {
    const activeIds = store.terms.filter(t => t.status === 'active').map(t => t.id);
    return activeIds.length > 0 ? activeIds : store.terms[0] ? [store.terms[0].id] : [];
  });

  useEffect(() => {
    const validIds = new Set(store.terms.map(t => t.id));
    setSelectedTermIds(prev => {
      const filtered = prev.filter(id => validIds.has(id));
      if (filtered.length > 0) return filtered;
      const activeIds = store.terms.filter(t => t.status === 'active').map(t => t.id);
      return activeIds.length > 0 ? activeIds : store.terms[0] ? [store.terms[0].id] : [];
    });
  }, [store.terms]);

  // 2. Scheduling Policy & Scope State (initialized from university's configured policy)
  const [scopeMode, setScopeMode] = useState<SchedulingScopeMode>(() =>
    configuredPolicy === 'department_wise' ? 'department_wise' : 'whole_university'
  );
  const [selectedDeptId, setSelectedDeptId] = useState<string>(
    store.departments[0]?.id || 'all'
  );
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>(() =>
    store.studentGroups.map(g => g.id)
  );

  useEffect(() => {
    setScopeMode(configuredPolicy === 'department_wise' ? 'department_wise' : 'whole_university');
  }, [configuredPolicy]);

  useEffect(() => {
    if (selectedDeptId === 'all' && store.departments[0]?.id) {
      setSelectedDeptId(store.departments[0].id);
    }
  }, [store.departments, selectedDeptId]);

  // 3. Progressive Disclosure Toggles
  const [showHierarchyDrawer, setShowHierarchyDrawer] = useState<boolean>(false);
  const [showAdvancedDrawer, setShowAdvancedDrawer] = useState<boolean>(false);

  // 4. Solver Engine & Execution State
  const [solverEngineMode] = useState<'backend_cpsat'>('backend_cpsat');
  const [backendStrategy, setBackendStrategy] = useState<
    'hybrid_dsatur_ga_sa' | 'dsatur_only' | 'ga_only' | 'ga_sa'
  >('hybrid_dsatur_ga_sa');
  const [scenarioName, setScenarioName] = useState<string>('');
  const [forceRescheduleAll, setForceRescheduleAll] = useState<boolean>(true);
  const [isComparingAlgos, setIsComparingAlgos] = useState(false);
  const [benchmarkResults, setBenchmarkResults] = useState<BackendAlgorithmBenchmarkItem[] | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [solverStepText, setSolverStepText] = useState('Initializing solver...');
  const [solverCompleted, setSolverCompleted] = useState(false);
  const [isExportingSheets, setIsExportingSheets] = useState(false);
  const [lastSolverStats, setLastSolverStats] = useState<{
    placedCount: number;
    unplacedCount: number;
    conflictCount: number;
    roomUtilization: number;
    scenarioName: string;
    engineLabel?: string;
    scheduledSemestersLabel?: string;
    policyLabel?: string;
    status?: 'published' | 'draft' | 'archived';
    studentGapMinutesAvg?: number;
    compactnessScore?: number;
    worstBatchSatisfaction?: number;
    warnings?: string[];
  } | null>(null);

  // Derive scoped academic hierarchy (Departments -> Semesters -> Batches -> Sections)
  const scopedDepartments = useMemo(() => {
    if (scopeMode === 'department_wise' && selectedDeptId && selectedDeptId !== 'all') {
      return store.departments.filter(d => d.id === selectedDeptId);
    }
    return store.departments;
  }, [store.departments, scopeMode, selectedDeptId]);

  const scopedGroups = useMemo(() => {
    if (scopeMode === 'whole_university') {
      return store.studentGroups;
    }
    if (scopeMode === 'department_wise') {
      return store.studentGroups.filter(g => {
        const prog = store.programs.find(p => p.id === g.programId);
        return prog?.departmentId === selectedDeptId;
      });
    }
    return store.studentGroups.filter(g => selectedGroupIds.includes(g.id));
  }, [store.studentGroups, store.programs, scopeMode, selectedDeptId, selectedGroupIds]);

  const scopedCourses = useMemo(() => {
    if (scopeMode === 'department_wise' && selectedDeptId && selectedDeptId !== 'all') {
      return store.courses.filter(c => c.departmentId === selectedDeptId);
    }
    return store.courses;
  }, [store.courses, scopeMode, selectedDeptId]);

  const scopedInstructors = useMemo(() => {
    if (scopeMode === 'department_wise' && selectedDeptId && selectedDeptId !== 'all') {
      return store.instructors.filter(i => i.departmentId === selectedDeptId);
    }
    return store.instructors;
  }, [store.instructors, scopeMode, selectedDeptId]);

  const scopedSections = useMemo(() => {
    const groupSet = new Set(scopedGroups.map(g => g.id));
    return store.sections.filter(
      s => groupSet.has(s.studentGroupId) || (s.sharedGroupIds || []).some(gid => groupSet.has(gid))
    );
  }, [store.sections, scopedGroups]);

  // Extract distinct academic semester numbers (1st, 2nd, 3rd...) and batch cohorts (2K22, 2K23...) from scoped groups
  const distinctAcademicSemesters = useMemo(() => {
    const sems = new Set<string>();
    scopedGroups.forEach(g => {
      if (g.semester) sems.add(`Semester ${g.semester}`);
      else if (g.year) sems.add(`Year ${g.year}`);
    });
    return Array.from(semmsSort(sems));
  }, [scopedGroups]);

  const distinctBatches = useMemo(() => {
    const batches = new Set<string>();
    scopedGroups.forEach(g => {
      if (g.batchCode) batches.add(g.batchCode);
      else if (g.academicYear) batches.add(String(g.academicYear));
      else {
        const prefix = g.code.split('-')[0];
        if (prefix) batches.add(prefix);
      }
    });
    return Array.from(batches);
  }, [scopedGroups]);

  const selectedTermsList = useMemo(
    () => store.terms.filter(t => selectedTermIds.includes(t.id)),
    [store.terms, selectedTermIds]
  );

  const selectedSemestersLabel =
    selectedTermsList.length > 0
      ? selectedTermsList.map(t => t.name).join(' + ')
      : store.terms[0]?.name || 'Configured Academic Period';

  const toggleTermSelection = (termId: string) => {
    setSelectedTermIds(prev => {
      if (prev.includes(termId)) {
        if (prev.length <= 1) return prev; // Keep at least one semester selected for generation
        return prev.filter(id => id !== termId);
      }
      return [...prev, termId];
    });
  };

  const toggleGroupSelection = (id: string) => {
    if (selectedGroupIds.includes(id)) {
      if (selectedGroupIds.length > 1) {
        setSelectedGroupIds(selectedGroupIds.filter(g => g !== id));
      }
    } else {
      setSelectedGroupIds([...selectedGroupIds, id]);
    }
  };

  const handleSelectDepartmentQuick = (deptId: string) => {
    setSelectedDeptId(deptId);
    const groupsInDept = store.studentGroups
      .filter(g => {
        const prog = store.programs.find(p => p.id === g.programId);
        return prog?.departmentId === deptId;
      })
      .map(g => g.id);
    if (groupsInDept.length > 0) {
      setSelectedGroupIds(groupsInDept);
    }
  };

  const buildFullBackendPayload = (
    targetStore: InstitutionalDataStore,
    targetGroups: typeof scopedGroups,
    targetCourses: typeof scopedCourses,
    targetSections: typeof scopedSections,
    versionTitle: string,
    algo: string
  ) => ({
    universityId: targetStore.institutionProfile?.id || institutionalStore.getCurrentInstitutionId(),
    versionName: versionTitle,
    algorithm: algo,
    timeStructure: targetStore.timeStructure,
    instructors: targetStore.instructors.map(i => ({
      id: i.id,
      name: i.name,
      email: i.email,
      departmentId: i.departmentId,
      subDepartment: i.subDepartment,
      staffRole: i.staffRole || 'faculty',
      qualifiedCourseIds: i.qualifiedCourseIds || [],
      maxWeeklyHours: i.maxWeeklyHours,
      maxConsecutiveHours: i.maxConsecutiveHours,
      preferredDays: i.preferredDays,
      unavailableSlots: i.unavailableSlots || []
    })),
    courses: targetCourses.map(c => {
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
        credit_hours: c.creditHours || 3,
        lectureCredits: c.lectureCredits ?? c.lectureHours ?? (courseType === 'lab' ? 0 : c.creditHours || 3),
        labCredits: c.labCredits ?? (c.labHours > 0 ? Math.max(1, Math.round(c.labHours / 3)) : courseType === 'lab' ? 1 : 0),
        lectureHours: c.lectureHours,
        labHours: c.labHours,
        departmentId: c.departmentId,
        assignedInstructorId: c.assignedInstructorId,
        assignedLabEngineerId: c.assignedLabEngineerId,
        assignedBatchId: c.assignedBatchId,
        semester: c.semester,
        labSessionMode: c.labSessionMode || (targetStore.timeStructure.labSplitAllowed ? 'split_allowed' : 'continuous'),
        isElective: Boolean(c.isElective),
        requiredRoomType: c.requiredRoomType,
        requiredEquipment: []
      };
    }),
    classrooms: targetStore.rooms.map(r => ({
      id: r.id,
      code: r.code,
      name: r.name,
      capacity: r.capacity,
      type: r.type,
      equipment: r.equipment,
      isAvailable: r.isAvailable,
      assignedLabEngineerId: r.assignedLabEngineerId
    })),
    studentGroups: targetGroups.map(g => ({
      id: g.id,
      code: g.code,
      name: g.name,
      size: g.size,
      batchCode: g.batchCode,
      departmentCode: g.departmentCode,
      semester: g.semester,
      section: g.section
    })),
    sections: targetSections.map(s => {
      const isLab = s.sessionType === 'Lab' || Boolean(s.spanSlots && s.spanSlots > 1) || s.componentType === 'lab';
      return {
        id: s.id,
        courseId: s.courseId,
        instructorId: s.instructorId,
        labEngineerId: s.labEngineerId,
        studentGroupId: s.studentGroupId,
        sharedGroupIds: s.sharedGroupIds || [],
        sectionCode: s.sectionNumber || 'A',
        sessionType: isLab ? 'Lab' : 'Theory',
        componentType: s.componentType || (isLab ? 'lab' : 'lecture'),
        isAtomicSession: s.isAtomicSession ?? true,
        spanSlots: s.spanSlots || (isLab ? 3 : 1),
        sessionsPerWeek: 1,
        enrollment: s.expectedEnrollment || 45,
        isLocked: Boolean(s.isLocked)
      };
    })
  });

  const handleStartGeneration = () => {
    institutionalStore.autoGenerateMissingSections();
    const freshStore = institutionalStore.get();
    const freshTiming = computeAcademicScheduleConfig(freshStore.timeStructure);
    const timingValidation = validateAcademicTimingConfig(freshStore.timeStructure);

    if (!timingValidation.valid) {
      showAppPopup({
        title: 'Invalid Academic Timing Configuration',
        message: timingValidation.errors.join(' '),
        variant: 'error'
      });
      return;
    }

    const freshGroups =
      scopeMode === 'whole_university'
        ? freshStore.studentGroups
        : scopeMode === 'department_wise'
        ? freshStore.studentGroups.filter(g => {
            const prog = freshStore.programs.find(p => p.id === g.programId);
            return prog?.departmentId === selectedDeptId;
          })
        : freshStore.studentGroups.filter(g => selectedGroupIds.includes(g.id));

    const freshCourses =
      scopeMode === 'department_wise' && selectedDeptId && selectedDeptId !== 'all'
        ? freshStore.courses.filter(c => c.departmentId === selectedDeptId)
        : freshStore.courses;

    const freshGroupSet = new Set(freshGroups.map(g => g.id));
    const freshSections = freshStore.sections.filter(
      s => freshGroupSet.has(s.studentGroupId) || (s.sharedGroupIds || []).some(gid => freshGroupSet.has(gid))
    );

    if (freshSections.length === 0) {
      showAppPopup({
        title: 'No Schedulable Sessions Found',
        message: 'Add courses, instructors, classrooms, and student batches/sections in Setup before generating a timetable.',
        variant: 'error'
      });
      return;
    }

    if (!currentUser?.token) {
      showAppPopup({
        title: 'Sign-In Required',
        message: 'Sign in with an institutional administrator session to generate and persist timetables in Supabase.',
        variant: 'error'
      });
      return;
    }

    setIsGenerating(true);
    setSolverCompleted(false);
    setProgress(12);
    setSolverStepText(
      `Loading university academic calendar (${selectedSemestersLabel}) & ${freshTiming.operatingHoursLabel} slot structure...`
    );

    const targetGroupIds = freshGroups.map(g => g.id);
    const defaultRunTitle =
      scenarioName.trim() ||
      (scopeMode === 'whole_university'
        ? `${selectedSemestersLabel} — Whole-University Schedule`
        : scopeMode === 'department_wise'
        ? `${selectedSemestersLabel} — ${
            freshStore.departments.find(d => d.id === selectedDeptId)?.code || 'Department'
          } Schedule`
        : `${selectedSemestersLabel} — Custom Cohort Schedule`);

    setTimeout(() => {
      setProgress(42);
      setSolverStepText(
        `Submitting ${freshSections.length} sessions across ${scopedDepartments.length} department(s) to Python ${backendStrategy.toUpperCase()} solver...`
      );
    }, 250);

    const targetInstId =
      freshStore.institutionProfile?.id ||
      currentUser.institutionId ||
      institutionalStore.getCurrentInstitutionId();

    solveOptimizationApi(
      buildFullBackendPayload(
        freshStore,
        freshGroups,
        freshCourses,
        freshSections,
        defaultRunTitle,
        backendStrategy
      ),
      currentUser
    )
      .then(async apiRes => {
        setProgress(82);
        setSolverStepText(
          `Applying ${apiRes.metrics.placedCount} session assignments (${apiRes.metrics.solverEngine}) & syncing Supabase...`
        );

        const hasEntriesOrAssignments =
          (apiRes.entries && apiRes.entries.length > 0) ||
          (apiRes.assignments && Object.keys(apiRes.assignments).length > 0);
        if (!hasEntriesOrAssignments) {
          throw new Error('Optimization engine returned zero session assignments.');
        }

        const res = institutionalStore.applyBackendOptimizationResult({
          assignments: apiRes.assignments || {},
          entries: apiRes.entries,
          strategyName: `${defaultRunTitle} (${backendStrategy})`,
          algorithm: backendStrategy,
          versionId: apiRes.timetableVersionId,
          termId: selectedTermsList[0]?.id,
          fitness: {
            totalScore: apiRes.metrics.totalScore,
            studentSatisfaction: apiRes.metrics.studentSatisfaction,
            instructorSatisfaction: apiRes.metrics.instructorSatisfaction,
            roomUtilization: apiRes.metrics.roomUtilization,
            compactnessScore: apiRes.metrics.compactnessScore,
            fairnessScore: apiRes.metrics.fairnessScore
          },
          conflictCount: apiRes.metrics.conflictCount,
          selectedGroupIds: targetGroupIds
        });

        const freshWorkspace = await fetchInstitutionWorkspace(currentUser, targetInstId);
        institutionalStore.hydrateFromWorkspacePayload(targetInstId, freshWorkspace, currentUser.id);

        const isFullyValid =
          res.conflictCount === 0 && res.unplacedCount === 0 && res.scenario.status === 'published';
        const warningsList = [
          ...(apiRes.preValidation?.errors || []),
          ...(apiRes.preValidation?.warnings || [])
        ];

        setTimeout(() => {
          setProgress(100);
          setIsGenerating(false);
          setSolverCompleted(true);
          setLastSolverStats({
            placedCount: res.placedCount,
            unplacedCount: res.unplacedCount,
            conflictCount: res.conflictCount,
            roomUtilization: res.roomUtilization,
            scenarioName: res.scenario.name,
            engineLabel: apiRes.metrics.solverEngine,
            scheduledSemestersLabel: selectedSemestersLabel,
            status: res.scenario.status,
            studentGapMinutesAvg: apiRes.metrics.studentGapMinutesAvg,
            compactnessScore:
              apiRes.metrics.compactnessScore ?? res.scenario.metrics.studentTransitScore,
            worstBatchSatisfaction: apiRes.metrics.worstBatchSatisfaction,
            warnings: warningsList,
            policyLabel:
              scopeMode === 'whole_university'
                ? 'Whole-University Integrated Policy'
                : scopeMode === 'department_wise'
                ? `Department-Wise Policy (${
                    freshStore.departments.find(d => d.id === selectedDeptId)?.name || 'Department'
                  })`
                : `Custom Scope (${freshGroups.length} Sections)`
          });
          showAppPopup({
            title: isFullyValid
              ? 'Hybrid AI Timetable Generated & Saved'
              : 'Timetable Saved as Draft in Supabase (Review Required)',
            message: isFullyValid
              ? `Placed ${res.placedCount} sessions across ${selectedSemestersLabel} (${res.roomUtilization}% utilization · 0 hard conflicts).`
              : `Placed ${res.placedCount} sessions (${res.unplacedCount} unplaced, ${res.conflictCount} hard conflicts). Saved as Draft until conflicts are resolved.`,
            variant: isFullyValid ? 'success' : 'error',
            actions: [
              {
                label: 'Inspect Timetables',
                onClick: () => onNavigate('timetables'),
                variant: 'primary'
              }
            ]
          });
        }, 220);
      })
      .catch(err => {
        setProgress(0);
        setIsGenerating(false);
        setSolverCompleted(false);
        showAppPopup({
          title: 'Optimization Run Failed',
          message:
            err instanceof Error
              ? err.message
              : 'Unable to run or persist timetable optimization in Supabase.',
          variant: 'error'
        });
      });
  };

  const handleRunAlgorithmBenchmark = async () => {
    if (!currentUser?.token) {
      showAppPopup({
        title: 'Sign-In Required',
        message: 'Sign in with an active institutional session to benchmark backend optimization algorithms.',
        variant: 'info'
      });
      return;
    }
    setIsComparingAlgos(true);
    try {
      institutionalStore.autoGenerateMissingSections();
      const freshStore = institutionalStore.get();
      const res = await compareOptimizationAlgorithmsBackend(
        currentUser,
        buildFullBackendPayload(
          freshStore,
          scopedGroups,
          scopedCourses,
          scopedSections,
          'Algorithm Benchmark',
          backendStrategy
        )
      );
      const list = Array.isArray(res.comparison) ? res.comparison : [];
      setBenchmarkResults(list);
      showAppPopup({
        title: 'Algorithm Benchmark Complete',
        message: `Compared ${list.length} optimization pipelines across ${scopedSections.length} sections.`,
        variant: 'success'
      });
    } catch (err) {
      showAppPopup({
        title: 'Benchmark Unavailable',
        message: err instanceof Error ? err.message : 'Unable to reach Python optimization benchmark endpoint.',
        variant: 'error'
      });
    } finally {
      setIsComparingAlgos(false);
    }
  };

  const handleQuickExportGoogleSheets = async () => {
    try {
      setIsExportingSheets(true);
      const { scheduleData } = buildMatrixSchedule(store);
      const result = await exportTimetableToGoogleSheetsWorkbook({
        store,
        scheduleData,
        filterClass: () => true,
        scope: 'all',
        scopeLabel: 'All_University_Classes',
        studentOrUserName: currentUser?.name || 'Academic Schedule'
      });
      showAppPopup({
        title: 'Workbook Exported',
        message: `Downloaded "${result.fileName}" with ${result.classSheetCount} class/section sheets.`,
        variant: 'success'
      });
    } finally {
      setIsExportingSheets(false);
    }
  };

  const totalScheduled = store.sections.filter(s => s.assignedSlot).length;
  const totalLabs = store.sections.filter(
    s =>
      s.sessionType === 'Lab' ||
      (s.spanSlots && s.spanSlots > 1) ||
      s.assignedSlot?.sessionType === 'Lab'
  ).length;
  const totalLectures = store.sections.length - totalLabs;
  const softConstraints = store.constraints.filter(c => c.kind === 'soft');

  return (
    <div className="space-y-6">
      {/* PAGE HEADER */}
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-[#E4E2DA]">
        <div>
          <h1 className="font-serif-editorial text-3xl sm:text-4xl text-[#171717] tracking-tight">
            Generate Timetable
          </h1>
          <p className="text-xs sm:text-sm text-[#77766F] mt-1">
            {scopedDepartments.length} departments · {scopedGroups.length} sections · {activeTimingSummary(computedTiming)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('academic-config')}
            className="btn-secondary text-xs h-9 px-3.5"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Calendar &amp; Policy</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('timetables')}
            className="btn-secondary text-xs h-9 px-3.5"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Inspect Timetables ({totalScheduled}/{store.sections.length})</span>
          </button>
        </div>
      </header>

      {/* 1. ACADEMIC SEMESTERS */}
      <section className="sf-card-white p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E4E2DA]">
          <div className="flex items-baseline gap-3">
            <h2 className="font-serif-editorial text-xl text-[#171717]">
              Academic Semesters
            </h2>
            <span className="text-xs font-mono-tabular text-[#77766F]">
              {selectedTermIds.length} of {store.terms.length} selected
            </span>
          </div>

          <button
            type="button"
            onClick={() => setSelectedTermIds(store.terms.map(t => t.id))}
            className="text-xs font-semibold text-[#171717] hover:underline cursor-pointer shrink-0"
          >
            Select All Configured
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 items-stretch">
          {store.terms.map(term => {
            const isSelected = selectedTermIds.includes(term.id);
            const isActiveStatus = term.status === 'active';
            return (
              <div
                key={term.id}
                onClick={() => toggleTermSelection(term.id)}
                className={`p-4 rounded-xl border transition-colors cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-[#171717] text-white border-[#171717]'
                    : 'bg-white text-[#171717] border-[#E4E2DA] hover:bg-[#F7F6EF]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <div
                      className={`text-[11px] font-mono-tabular ${
                        isSelected ? 'text-[#B8EEEE]' : 'text-[#77766F]'
                      }`}
                    >
                      {term.code}
                      {isActiveStatus ? ' · Active' : ''}
                    </div>
                    <h3
                      className={`font-serif-editorial text-base leading-snug truncate ${
                        isSelected ? 'text-white' : 'text-[#171717]'
                      }`}
                    >
                      {term.name}
                    </h3>
                  </div>

                  <div
                    className={`w-4.5 h-4.5 rounded flex items-center justify-center border shrink-0 mt-0.5 ${
                      isSelected
                        ? 'bg-[#B7F77C] border-[#B7F77C] text-[#171717]'
                        : 'bg-white border-[#D5D3CB]'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 stroke-[2.5]" />}
                  </div>
                </div>

                <div
                  className={`pt-2.5 mt-2.5 border-t text-[11px] font-mono-tabular ${
                    isSelected
                      ? 'border-white/15 text-white/75'
                      : 'border-[#E4E2DA] text-[#77766F]'
                  }`}
                >
                  {term.startDate} → {term.endDate}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 2. SCHEDULING SCOPE */}
      <section className="sf-card-white p-5 sm:p-6 space-y-4">
        <div className="pb-3 border-b border-[#E4E2DA]">
          <h2 className="font-serif-editorial text-xl text-[#171717]">
            Scheduling Scope
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            {
              id: 'whole_university' as const,
              title: 'Whole-University',
              desc: 'All departments and sections in one conflict-free run'
            },
            {
              id: 'department_wise' as const,
              title: 'Department-Wise',
              desc: 'Single department faculty, rooms, courses, and batches'
            },
            {
              id: 'custom_cohorts' as const,
              title: 'Custom Cohort Scope',
              desc: 'Selected sections while keeping other classes fixed'
            }
          ].map(opt => {
            const active = scopeMode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setScopeMode(opt.id)}
                className={`p-4 rounded-xl border text-left transition-colors cursor-pointer flex flex-col justify-between ${
                  active
                    ? 'bg-[#171717] text-white border-[#171717]'
                    : 'bg-white text-[#171717] border-[#E4E2DA] hover:bg-[#F7F6EF]'
                }`}
              >
                <span className="font-serif-editorial text-base font-medium block">
                  {opt.title}
                </span>
                <p
                  className={`text-xs mt-1 ${
                    active ? 'text-white/75' : 'text-[#77766F]'
                  }`}
                >
                  {opt.desc}
                </p>
              </button>
            );
          })}
        </div>

        {/* Context Selector Bar */}
        <div className="pt-3 border-t border-[#E4E2DA] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {scopeMode === 'whole_university' && (
            <>
              <div className="flex items-center gap-2 text-xs text-[#57564F] min-w-0">
                <Building2 className="w-4 h-4 text-[#171717] shrink-0" />
                <span className="truncate">
                  <strong className="text-[#171717]">{store.departments.length} Departments:</strong>{' '}
                  {store.departments.map(d => d.code).join(', ')}
                </span>
              </div>
              <span className="text-xs font-mono-tabular font-semibold text-[#171717] shrink-0">
                {store.studentGroups.length} Sections · {store.sections.length} Sessions
              </span>
            </>
          )}

          {scopeMode === 'department_wise' && (
            <>
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <span className="text-xs font-semibold text-[#171717] shrink-0">
                  Department:
                </span>
                <div className="inline-flex flex-wrap items-center gap-1.5">
                  {store.departments.map(dept => {
                    const isDeptSelected = selectedDeptId === dept.id;
                    const count = store.studentGroups.filter(g => {
                      const p = store.programs.find(pr => pr.id === g.programId);
                      return p?.departmentId === dept.id;
                    }).length;
                    return (
                      <button
                        key={dept.id}
                        type="button"
                        onClick={() => handleSelectDepartmentQuick(dept.id)}
                        className={`h-8 px-3 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                          isDeptSelected
                            ? 'bg-[#171717] text-white border-[#171717]'
                            : 'bg-white text-[#57564F] border-[#E4E2DA] hover:text-[#171717]'
                        }`}
                      >
                        {dept.code} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>
              <span className="text-xs font-mono-tabular font-semibold text-[#171717] shrink-0">
                {scopedGroups.length} Sections · {scopedSections.length} Sessions
              </span>
            </>
          )}

          {scopeMode === 'custom_cohorts' && (
            <div className="w-full space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#171717]">
                  Sections ({selectedGroupIds.length} of {store.studentGroups.length})
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedGroupIds(store.studentGroups.map(g => g.id))}
                  className="text-xs font-semibold text-[#171717] underline cursor-pointer"
                >
                  Select All
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                {store.studentGroups.map(group => {
                  const selected = selectedGroupIds.includes(group.id);
                  return (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => toggleGroupSelection(group.id)}
                      className={`h-7 px-2.5 rounded-lg text-xs font-mono-tabular border transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
                        selected
                          ? 'bg-[#171717] text-white border-[#171717] font-semibold'
                          : 'bg-white text-[#77766F] border-[#E4E2DA] hover:text-[#171717]'
                      }`}
                    >
                      <span>{group.code}</span>
                      {selected && <Check className="w-3 h-3 text-[#B7F77C]" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 3. RESOURCE SUMMARY STRIP */}
      <section className="sf-card-white p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E4E2DA]">
          <h2 className="font-serif-editorial text-xl text-[#171717]">
            Resource Scope
          </h2>

          <button
            type="button"
            onClick={() => setShowHierarchyDrawer(prev => !prev)}
            className="btn-secondary text-xs h-8 px-3 shrink-0"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{showHierarchyDrawer ? 'Hide Breakdown' : 'Inspect Breakdown'}</span>
            {showHierarchyDrawer ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* Flat Hairline-Divided Metric Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#E4E2DA] border border-[#E4E2DA] rounded-xl bg-[#F7F6EF]/40">
          <div className="p-4">
            <div className="text-[11px] font-medium text-[#77766F]">Departments</div>
            <div className="font-serif-editorial text-2xl text-[#171717] mt-0.5 font-mono-tabular">
              {scopedDepartments.length}
            </div>
            <div className="text-[11px] text-[#77766F] truncate mt-0.5">
              {scopedDepartments.map(d => d.code).join(', ') || 'All'}
            </div>
          </div>

          <div className="p-4">
            <div className="text-[11px] font-medium text-[#77766F]">Batches</div>
            <div className="font-serif-editorial text-2xl text-[#171717] mt-0.5 font-mono-tabular">
              {distinctBatches.length}
            </div>
            <div className="text-[11px] text-[#77766F] truncate mt-0.5">
              {distinctAcademicSemesters.length > 0
                ? distinctAcademicSemesters.join(', ')
                : distinctBatches.join(', ')}
            </div>
          </div>

          <div className="p-4">
            <div className="text-[11px] font-medium text-[#77766F]">Sections &amp; Courses</div>
            <div className="font-serif-editorial text-2xl text-[#171717] mt-0.5 font-mono-tabular">
              {scopedGroups.length}
            </div>
            <div className="text-[11px] text-[#77766F] truncate mt-0.5">
              {scopedCourses.length} Courses · {scopedSections.length} Sessions
            </div>
          </div>

          <div className="p-4">
            <div className="text-[11px] font-medium text-[#77766F]">Faculty &amp; Rooms</div>
            <div className="font-serif-editorial text-2xl text-[#171717] mt-0.5 font-mono-tabular">
              {scopedInstructors.length} · {store.rooms.length}
            </div>
            <div className="text-[11px] text-[#77766F] truncate mt-0.5">
              {store.rooms.filter(r => r.type === 'lecture').length} Lecture · {store.rooms.filter(r => r.type === 'lab').length} Labs
            </div>
          </div>
        </div>

        {/* Progressive Disclosure: Full Department -> Semester -> Batch -> Section Tree */}
        {showHierarchyDrawer && (
          <div className="pt-2 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#171717]">
                Department Hierarchy
              </span>
              <button
                type="button"
                onClick={() => onNavigate('setup')}
                className="text-xs font-semibold text-[#171717] underline cursor-pointer"
              >
                Edit Entities →
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-[#E4E2DA]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F7F6EF] border-b border-[#E4E2DA] text-[11px] font-semibold uppercase tracking-wider text-[#77766F]">
                    <th className="py-2.5 px-4">Department</th>
                    <th className="py-2.5 px-4">Programs</th>
                    <th className="py-2.5 px-4">Courses</th>
                    <th className="py-2.5 px-4">Faculty</th>
                    <th className="py-2.5 px-4">Batches &amp; Sections</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E2DA] bg-white text-xs">
                  {scopedDepartments.map(dept => {
                    const deptPrograms = store.programs.filter(p => p.departmentId === dept.id);
                    const progIds = new Set(deptPrograms.map(p => p.id));
                    const deptGroups = scopedGroups.filter(
                      g => progIds.has(g.programId) || g.departmentCode === dept.code
                    );
                    const deptCourses = store.courses.filter(c => c.departmentId === dept.id);
                    const deptFaculty = store.instructors.filter(i => i.departmentId === dept.id);

                    return (
                      <tr key={dept.id} className="hover:bg-[#F7F6EF]/60 transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-mono-tabular font-bold text-[#171717] mr-2">
                            {dept.code}
                          </span>
                          <span className="font-medium text-[#57564F]">{dept.name}</span>
                        </td>
                        <td className="py-3 px-4 font-mono-tabular text-[#57564F]">
                          {deptPrograms.length}
                        </td>
                        <td className="py-3 px-4 font-mono-tabular text-[#57564F]">
                          {deptCourses.length}
                        </td>
                        <td className="py-3 px-4 font-mono-tabular text-[#57564F]">
                          {deptFaculty.length}
                        </td>
                        <td className="py-3 px-4 font-mono-tabular text-[11px] text-[#57564F]">
                          {deptGroups.map(g => g.code).join(' · ') || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* 4. CONSTRAINTS & EXECUTION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 7 Cols: Rules & Preferences */}
        <section className="lg:col-span-7 sf-card-white p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E4E2DA]">
            <h2 className="font-serif-editorial text-xl text-[#171717]">
              Constraints &amp; Preferences
            </h2>

            <button
              type="button"
              onClick={() => setShowAdvancedDrawer(prev => !prev)}
              className="btn-secondary text-xs h-8 px-3 shrink-0"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>{showAdvancedDrawer ? 'Hide Advanced' : 'Advanced Weights'}</span>
              {showAdvancedDrawer ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          {/* Core Invariants — Clean Hairline Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 border border-[#E4E2DA] rounded-xl overflow-hidden text-xs">
            <div className="p-3.5 flex items-center gap-2.5 sm:border-r sm:border-b border-[#E4E2DA]">
              <CheckCircle2 className="w-4 h-4 text-[#1B5E20] shrink-0" />
              <span className="font-medium text-[#171717]">Zero Entity Overlaps</span>
            </div>

            <div className="p-3.5 flex items-center gap-2.5 sm:border-b border-[#E4E2DA]">
              <FlaskConical className="w-4 h-4 text-[#171717] shrink-0" />
              <span className="font-medium text-[#171717]">
                Continuous {computedTiming.labDurationHoursLabel} Labs
              </span>
            </div>

            <div className="p-3.5 flex items-center gap-2.5 sm:border-r border-[#E4E2DA]">
              <Coffee className="w-4 h-4 text-[#171717] shrink-0" />
              <span className="font-medium text-[#171717]">
                Midday Break ({computedTiming.middayBreak.timeRangeLabel})
              </span>
            </div>

            <div className="p-3.5 flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-[#171717] shrink-0" />
              <span className="font-medium text-[#171717]">
                {computedTiming.periodLengthMinutes}m Lecture Blocks
              </span>
            </div>
          </div>

          {/* Progressive Disclosure: Advanced Solver Engine & Soft Constraint Weights */}
          {showAdvancedDrawer && (
            <div className="pt-4 border-t border-[#E4E2DA] space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                    Scenario Label (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder={`${selectedSemestersLabel} Run`}
                    value={scenarioName}
                    onChange={e => setScenarioName(e.target.value)}
                    className="input-field h-9 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                    Existing Slot Locks
                  </label>
                  <button
                    type="button"
                    onClick={() => setForceRescheduleAll(!forceRescheduleAll)}
                    className="w-full h-9 px-3 rounded-xl bg-white border border-[#E4E2DA] flex items-center justify-between text-xs font-medium text-[#171717] cursor-pointer hover:bg-[#F7F6EF]"
                  >
                    <span className="truncate">
                      {forceRescheduleAll
                        ? 'Re-optimize all sections'
                        : 'Preserve manually locked slots'}
                    </span>
                    <Lock className="w-3.5 h-3.5 text-[#77766F] shrink-0" />
                  </button>
                </div>
              </div>

              {/* Solver Engine Mode */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#171717] flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5" />
                    <span>Optimization Engine</span>
                  </span>
                  <span className="text-[11px] font-mono-tabular text-[#77766F]">
                    Python {backendStrategy} · Supabase Persisted
                  </span>
                </div>

                {solverEngineMode === 'backend_cpsat' && (
                  <div className="pt-1 flex flex-col sm:flex-row sm:items-center gap-2">
                    <select
                      value={backendStrategy}
                      onChange={e =>
                        setBackendStrategy(
                          e.target.value as
                            | 'hybrid_dsatur_ga_sa'
                            | 'dsatur_only'
                            | 'ga_only'
                            | 'ga_sa'
                        )
                      }
                      className="input-field h-9 text-xs flex-1"
                    >
                      <option value="hybrid_dsatur_ga_sa">
                        Hybrid Pipeline (DSatur + Genetic Algorithm + Simulated Annealing)
                      </option>
                      <option value="dsatur_only">DSatur Graph Coloring Baseline</option>
                      <option value="ga_only">Genetic Algorithm Only</option>
                      <option value="ga_sa">Genetic Algorithm + Simulated Annealing</option>
                    </select>
                    <button
                      type="button"
                      onClick={handleRunAlgorithmBenchmark}
                      disabled={isComparingAlgos}
                      className="btn-secondary h-9 px-3 text-xs shrink-0"
                    >
                      {isComparingAlgos ? 'Benchmarking...' : 'Compare Algorithms'}
                    </button>
                  </div>
                )}

                {benchmarkResults && benchmarkResults.length > 0 && (
                  <div className="mt-2 overflow-x-auto rounded-xl border border-[#E4E2DA]">
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead>
                        <tr className="bg-[#F7F6EF] border-b border-[#E4E2DA] text-[#77766F] font-semibold">
                          <th className="py-2 px-3">Pipeline</th>
                          <th className="py-2 px-3">Fitness</th>
                          <th className="py-2 px-3">Violations</th>
                          <th className="py-2 px-3">Student</th>
                          <th className="py-2 px-3">Room Util</th>
                          <th className="py-2 px-3">Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E4E2DA] bg-white font-mono-tabular">
                        {benchmarkResults.map(row => (
                          <tr key={row.algorithm}>
                            <td className="py-2 px-3 font-sans font-semibold text-[#171717]">
                              {row.label || row.algorithm}
                            </td>
                            <td className="py-2 px-3 font-semibold text-[#171717]">
                              {Number(row.fitness?.totalScore ?? 0).toFixed(1)}
                            </td>
                            <td className="py-2 px-3">{row.hardConstraintViolations}</td>
                            <td className="py-2 px-3">
                              {Number(row.fitness?.studentSatisfaction ?? 0).toFixed(1)}%
                            </td>
                            <td className="py-2 px-3">
                              {Number(row.fitness?.roomUtilization ?? 0).toFixed(1)}%
                            </td>
                            <td className="py-2 px-3">{row.executionTimeMs}ms</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Soft Constraint Sliders */}
              <div className="divide-y divide-[#E4E2DA] border-t border-[#E4E2DA]">
                {softConstraints.map(rule => (
                  <div key={rule.id} className="py-3 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <label className="font-medium text-[#171717] flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          onChange={async e => {
                            const nextEnabled = e.target.checked;
                            institutionalStore.toggleConstraint(rule.id, nextEnabled);
                            if (currentUser?.token) {
                              try {
                                await updateConstraintBackend(currentUser, rule.id, {
                                  enabled: nextEnabled,
                                  isEnabled: nextEnabled
                                });
                              } catch (err) {
                                institutionalStore.toggleConstraint(rule.id, !nextEnabled);
                                showAppPopup({
                                  title: 'Constraint Save Failed',
                                  message:
                                    err instanceof Error
                                      ? err.message
                                      : 'Could not save constraint state to Supabase.',
                                  variant: 'error'
                                });
                              }
                            }
                          }}
                          className="rounded border-[#D5D3CB] text-[#171717]"
                        />
                        <span>{rule.name}</span>
                      </label>
                      <span className="font-mono-tabular font-semibold text-[#171717]">
                        {rule.weight}%
                      </span>
                    </div>
                    {rule.enabled && (
                      <input
                        type="range"
                        min={10}
                        max={100}
                        step={5}
                        value={rule.weight}
                        onChange={async e => {
                          const nextWeight = parseInt(e.target.value, 10);
                          institutionalStore.updateConstraintWeight(rule.id, nextWeight);
                          if (currentUser?.token) {
                            try {
                              await updateConstraintBackend(currentUser, rule.id, {
                                weight: nextWeight
                              });
                            } catch (err) {
                              showAppPopup({
                                title: 'Constraint Save Failed',
                                message:
                                  err instanceof Error
                                    ? err.message
                                    : 'Could not save constraint weight to Supabase.',
                                variant: 'error'
                              });
                            }
                          }
                        }}
                        className="w-full accent-[#171717] cursor-pointer"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Right 5 Cols: Execution & Conflict Analysis */}
        <section className="lg:col-span-5 sf-card-white p-5 sm:p-6 space-y-5">
          <div className="pb-3 border-b border-[#E4E2DA]">
            <h2 className="font-serif-editorial text-xl text-[#171717]">
              Run Solver
            </h2>
          </div>

          {/* Pre-Run Summary — Hairline Key-Value List */}
          <div className="divide-y divide-[#E4E2DA] border-y border-[#E4E2DA] text-xs">
            <div className="py-2.5 flex items-center justify-between gap-2">
              <span className="text-[#77766F]">Semesters</span>
              <span className="font-semibold text-[#171717] text-right truncate max-w-[220px]">
                {selectedSemestersLabel}
              </span>
            </div>
            <div className="py-2.5 flex items-center justify-between gap-2">
              <span className="text-[#77766F]">Scope</span>
              <span className="font-semibold text-[#171717]">
                {scopeMode === 'whole_university'
                  ? `Whole University (${store.departments.length} Depts)`
                  : scopeMode === 'department_wise'
                  ? `Dept: ${
                      store.departments.find(d => d.id === selectedDeptId)?.code || 'Selected'
                    }`
                  : `Custom (${scopedGroups.length} Sections)`}
              </span>
            </div>
            <div className="py-2.5 flex items-center justify-between gap-2">
              <span className="text-[#77766F]">Workload</span>
              <span className="font-mono-tabular font-semibold text-[#171717]">
                {scopedGroups.length} Sections · {scopedSections.length} Sessions
              </span>
            </div>
            <div className="py-2.5 flex items-center justify-between gap-2">
              <span className="text-[#77766F]">Hours</span>
              <span className="font-mono-tabular text-[#171717]">
                {computedTiming.operatingHoursLabel}
              </span>
            </div>
          </div>

          {isGenerating ? (
            <div className="space-y-2.5 py-2">
              <div className="flex items-center justify-between text-xs font-semibold text-[#171717]">
                <span className="flex items-center gap-2 truncate">
                  <Sparkles className="w-4 h-4 animate-spin shrink-0" />
                  <span className="truncate">{solverStepText}</span>
                </span>
                <span className="font-mono-tabular shrink-0 ml-2">{progress}%</span>
              </div>
              <div className="w-full h-2 bg-[#E4E2DA] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#171717] transition-all duration-300 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleStartGeneration}
              className="btn-primary w-full h-11 text-sm font-semibold justify-center cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>
                {scopeMode === 'whole_university'
                  ? `Generate Whole-University (${scopedGroups.length} Sections)`
                  : scopeMode === 'department_wise'
                  ? `Generate ${
                      store.departments.find(d => d.id === selectedDeptId)?.code || 'Department'
                    } (${scopedGroups.length} Sections)`
                  : `Generate Selected (${scopedGroups.length} Sections)`}
              </span>
            </button>
          )}

          {/* Conflict Analysis & Results */}
          {solverCompleted && lastSolverStats && (
            <div
              className={`p-4 rounded-xl space-y-3.5 border ${
                lastSolverStats.conflictCount > 0 || lastSolverStats.unplacedCount > 0 || lastSolverStats.status === 'draft'
                  ? 'bg-[#FFF6D6] border-[#E8D36B]'
                  : 'sf-pastel-lime border-transparent'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-full bg-[#171717] text-white flex items-center justify-center shrink-0">
                  {lastSolverStats.conflictCount > 0 || lastSolverStats.unplacedCount > 0 ? (
                    <AlertTriangle className="w-3.5 h-3.5 text-[#E8D36B]" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[#171717]">
                    {lastSolverStats.conflictCount > 0 || lastSolverStats.unplacedCount > 0 || lastSolverStats.status === 'draft'
                      ? 'Draft Saved (Needs Review)'
                      : 'Timetable Synthesized & Published'}
                  </div>
                  <div className="text-[11px] text-[#171717]/75 truncate">
                    {lastSolverStats.scheduledSemestersLabel} · {lastSolverStats.engineLabel || 'SmartGrid Solver'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 divide-x divide-black/10 border border-black/10 rounded-lg bg-white/60 text-center">
                <div className="py-2 px-1">
                  <div className="text-[10px] uppercase font-semibold text-[#57564F]">
                    Placed
                  </div>
                  <div className="font-serif-editorial text-lg font-bold text-[#171717] font-mono-tabular">
                    {lastSolverStats.placedCount}
                    {lastSolverStats.unplacedCount > 0 ? ` (${lastSolverStats.unplacedCount} unplaced)` : ''}
                  </div>
                </div>
                <div className="py-2 px-1">
                  <div className="text-[10px] uppercase font-semibold text-[#57564F]">
                    Clashes
                  </div>
                  <div className="font-serif-editorial text-lg font-bold text-[#171717] font-mono-tabular">
                    {lastSolverStats.conflictCount}
                  </div>
                </div>
                <div className="py-2 px-1">
                  <div className="text-[10px] uppercase font-semibold text-[#57564F]">
                    Utilization
                  </div>
                  <div className="font-serif-editorial text-lg font-bold text-[#171717] font-mono-tabular">
                    {lastSolverStats.roomUtilization}%
                  </div>
                </div>
              </div>

              {(lastSolverStats.compactnessScore !== undefined ||
                lastSolverStats.studentGapMinutesAvg !== undefined ||
                lastSolverStats.worstBatchSatisfaction !== undefined) && (
                <div className="grid grid-cols-3 divide-x divide-black/10 border border-black/10 rounded-lg bg-white/45 text-center text-[11px] font-mono-tabular">
                  <div className="py-1.5 px-1">
                    <span className="text-[#57564F] block text-[9.5px] uppercase font-sans font-semibold">Compactness</span>
                    <strong className="text-[#171717]">
                      {lastSolverStats.compactnessScore !== undefined ? `${Number(lastSolverStats.compactnessScore).toFixed(1)}%` : '—'}
                    </strong>
                  </div>
                  <div className="py-1.5 px-1">
                    <span className="text-[#57564F] block text-[9.5px] uppercase font-sans font-semibold">Avg Gap</span>
                    <strong className="text-[#171717]">
                      {lastSolverStats.studentGapMinutesAvg !== undefined ? `${Number(lastSolverStats.studentGapMinutesAvg).toFixed(1)}m` : '—'}
                    </strong>
                  </div>
                  <div className="py-1.5 px-1">
                    <span className="text-[#57564F] block text-[9.5px] uppercase font-sans font-semibold">Worst Batch</span>
                    <strong className="text-[#171717]">
                      {lastSolverStats.worstBatchSatisfaction !== undefined ? `${Number(lastSolverStats.worstBatchSatisfaction).toFixed(1)}%` : '—'}
                    </strong>
                  </div>
                </div>
              )}

              {lastSolverStats.warnings && lastSolverStats.warnings.length > 0 && (
                <div className="text-[11px] text-[#57564F] bg-white/70 rounded-lg p-2.5 border border-black/10 space-y-1">
                  {lastSolverStats.warnings.slice(0, 3).map((w, wIdx) => (
                    <div key={wIdx}>• {w}</div>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => onNavigate('timetables')}
                  className="w-full h-9 rounded-xl bg-[#171717] text-white text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-black transition-colors cursor-pointer"
                >
                  <span>Inspect Generated Timetables</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={handleQuickExportGoogleSheets}
                  disabled={isExportingSheets}
                  className="w-full h-9 rounded-xl bg-white hover:bg-[#F7F6EF] text-[#171717] border border-[#171717]/20 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-[#171717]" />
                  <span>
                    {isExportingSheets
                      ? 'Exporting (.xlsx)...'
                      : 'Download Google Sheets (.xlsx)'}
                  </span>
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

function activeTimingSummary(computedTiming: ReturnType<typeof computeAcademicScheduleConfig>) {
  return `${computedTiming.operatingHoursLabel} · ${computedTiming.periodLengthMinutes}m lectures · ${computedTiming.labDurationHoursLabel} labs`;
}

function semmsSort(sems: Set<string>): string[] {
  return Array.from(sems).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}
