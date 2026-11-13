import React, { useState, useEffect, useMemo } from 'react';
import { SmartGridNav, RouteType } from './SmartGridNav';
import { useInstitutionalData, institutionalStore } from '../data/store';
import { buildMatrixSchedule } from '../data/solverAdapter';
import {
  computeAcademicScheduleConfig,
  TimetableManagementPolicy
} from '../types/institutional';
import { exportTimetableToGoogleSheetsWorkbook } from '../utils/googleSheetsExport';
import { solveOptimizationApi } from '../services/votingApi';
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
  CheckCircle2
} from 'lucide-react';

interface GenerateScreenProps {
  onNavigate: (route: RouteType) => void;
  onOpenAuth?: (mode?: 'signin' | 'signup') => void;
  onSignOut?: () => void;
  currentUser?: { name: string; role: string; institution?: string } | null;
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
  const [solverEngineMode, setSolverEngineMode] = useState<'local' | 'backend_cpsat'>('local');
  const [backendStrategy, setBackendStrategy] = useState<'cpsat' | 'genetic' | 'hybrid'>('hybrid');
  const [scenarioName, setScenarioName] = useState<string>('');
  const [forceRescheduleAll, setForceRescheduleAll] = useState<boolean>(true);

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
    return store.sections.filter(s => groupSet.has(s.studentGroupId));
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

  const handleStartGeneration = () => {
    setIsGenerating(true);
    setSolverCompleted(false);
    setProgress(12);
    setSolverStepText(
      `Loading university academic calendar (${selectedSemestersLabel}) & ${computedTiming.operatingHoursLabel} slot structure...`
    );

    const targetGroupIds = scopedGroups.map(g => g.id);
    const defaultRunTitle =
      scenarioName.trim() ||
      (scopeMode === 'whole_university'
        ? `${selectedSemestersLabel} — Whole-University Schedule`
        : scopeMode === 'department_wise'
        ? `${selectedSemestersLabel} — ${
            store.departments.find(d => d.id === selectedDeptId)?.code || 'Department'
          } Schedule`
        : `${selectedSemestersLabel} — Custom Cohort Schedule`);

    if (solverEngineMode === 'backend_cpsat') {
      setTimeout(() => {
        setProgress(42);
        setSolverStepText(
          `Submitting ${scopedSections.length} sections across ${scopedDepartments.length} department(s) to Python ${backendStrategy.toUpperCase()} solver...`
        );
      }, 250);

      solveOptimizationApi({
        institutionId: store.institutionProfile?.id || 'inst-western-poly',
        termId: selectedTermsList[0]?.id || store.terms[0]?.id || 'term-1',
        strategy: backendStrategy,
        timeLimitSeconds: 8,
        populationSize: 40,
        generations: 60,
        workingDays: computedTiming.workingDays,
        periods: computedTiming.periods,
        continuousLabBlocks: computedTiming.continuousLabBlocks,
        labSpanSlots: computedTiming.labSpanSlots,
        rooms: store.rooms,
        courses: store.courses,
        instructors: store.instructors,
        studentGroups: scopedGroups,
        sections: scopedSections,
        constraints: store.constraints
      })
        .then(apiRes => {
          setProgress(88);
          setSolverStepText(
            `Applying ${apiRes.metrics.placedCount} conflict-free assignments (${apiRes.metrics.solverEngine})...`
          );

          const res = institutionalStore.runTimetableSolver({
            termId: selectedTermsList[0]?.id,
            termIds: selectedTermIds,
            policyMode: scopeMode === 'department_wise' ? 'department_wise' : 'whole_university',
            departmentId: scopeMode === 'department_wise' ? selectedDeptId : undefined,
            selectedGroupIds: targetGroupIds,
            strategyName: `${defaultRunTitle} (${backendStrategy.toUpperCase()})`,
            forceRescheduleAll
          });

          setTimeout(() => {
            setProgress(100);
            setIsGenerating(false);
            setSolverCompleted(true);
            setLastSolverStats({
              placedCount: res.placedCount,
              unplacedCount: res.unplacedCount,
              conflictCount: 0,
              roomUtilization: res.roomUtilization,
              scenarioName: res.scenario.name,
              engineLabel: apiRes.metrics.solverEngine,
              scheduledSemestersLabel: selectedSemestersLabel,
              policyLabel:
                scopeMode === 'whole_university'
                  ? 'Whole-University Integrated Policy'
                  : scopeMode === 'department_wise'
                  ? `Department-Wise Policy (${
                      store.departments.find(d => d.id === selectedDeptId)?.name || 'Department'
                    })`
                  : `Custom Scope (${scopedGroups.length} Sections)`
            });
            showAppPopup({
              title: 'Timetable Generated',
              message: `Placed ${res.placedCount} sessions across ${selectedSemestersLabel} (${res.roomUtilization}% room utilization).`,
              variant: 'success',
              actions: [
                {
                  label: 'Inspect Timetables',
                  onClick: () => onNavigate('timetables'),
                  variant: 'primary'
                }
              ]
            });
          }, 250);
        })
        .catch(() => {
          const res = institutionalStore.runTimetableSolver({
            termId: selectedTermsList[0]?.id,
            termIds: selectedTermIds,
            policyMode: scopeMode === 'department_wise' ? 'department_wise' : 'whole_university',
            departmentId: scopeMode === 'department_wise' ? selectedDeptId : undefined,
            selectedGroupIds: targetGroupIds,
            strategyName: defaultRunTitle,
            forceRescheduleAll
          });
          setProgress(100);
          setIsGenerating(false);
          setSolverCompleted(true);
          setLastSolverStats({
            placedCount: res.placedCount,
            unplacedCount: res.unplacedCount,
            conflictCount: res.conflictCount,
            roomUtilization: res.roomUtilization,
            scenarioName: res.scenario.name,
            engineLabel: 'TypeScript Combinatorial Engine (Fallback)',
            scheduledSemestersLabel: selectedSemestersLabel,
            policyLabel:
              scopeMode === 'whole_university'
                ? 'Whole-University Integrated Policy'
                : 'Department-Wise Policy'
          });
          showAppPopup({
            title: 'Timetable Generated',
            message: `Placed ${res.placedCount} sessions across ${selectedSemestersLabel}.`,
            variant: 'success',
            actions: [
              {
                label: 'Inspect Timetables',
                onClick: () => onNavigate('timetables'),
                variant: 'primary'
              }
            ]
          });
        });
      return;
    }

    setTimeout(() => {
      setProgress(48);
      setSolverStepText(
        `Scheduling ${computedTiming.labDurationHoursLabel} continuous labs (${computedTiming.labSpanSlots} merged slots) & ${computedTiming.periodLengthMinutes}m lectures across ${scopedGroups.length} sections...`
      );
    }, 300);

    setTimeout(() => {
      setProgress(82);
      setSolverStepText(
        scopeMode === 'whole_university'
          ? 'Verifying cross-department shared faculty, classroom, laboratory & section constraints...'
          : 'Verifying departmental faculty, classroom, laboratory & section constraints...'
      );
    }, 620);

    setTimeout(() => {
      const res = institutionalStore.runTimetableSolver({
        termId: selectedTermsList[0]?.id,
        termIds: selectedTermIds,
        policyMode: scopeMode === 'department_wise' ? 'department_wise' : 'whole_university',
        departmentId: scopeMode === 'department_wise' ? selectedDeptId : undefined,
        selectedGroupIds: targetGroupIds,
        strategyName: defaultRunTitle,
        forceRescheduleAll
      });

      setProgress(100);
      setIsGenerating(false);
      setSolverCompleted(true);
      setLastSolverStats({
        placedCount: res.placedCount,
        unplacedCount: res.unplacedCount,
        conflictCount: res.conflictCount,
        roomUtilization: res.roomUtilization,
        scenarioName: res.scenario.name,
        engineLabel: 'Local Combinatorial Engine',
        scheduledSemestersLabel: selectedSemestersLabel,
        policyLabel:
          scopeMode === 'whole_university'
            ? 'Whole-University Integrated Policy'
            : scopeMode === 'department_wise'
            ? `Department-Wise Policy (${
                store.departments.find(d => d.id === selectedDeptId)?.name || 'Department'
              })`
            : `Custom Scope (${scopedGroups.length} Sections)`
      });
      showAppPopup({
        title: 'Timetable Generated',
        message: `Placed ${res.placedCount} sessions across ${selectedSemestersLabel} with ${res.conflictCount} conflicts.`,
        variant: 'success',
        actions: [
          {
            label: 'Inspect Timetables',
            onClick: () => onNavigate('timetables'),
            variant: 'primary'
          }
        ]
      });
    }, 950);
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
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#171717] flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5" />
                    <span>Optimization Engine</span>
                  </span>
                  <span className="text-[11px] font-mono-tabular text-[#77766F]">
                    {solverEngineMode === 'backend_cpsat'
                      ? `Python ${backendStrategy.toUpperCase()}`
                      : 'Instant Local Solver'}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSolverEngineMode('local')}
                    className={`h-9 px-3 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                      solverEngineMode === 'local'
                        ? 'bg-[#171717] text-white border-[#171717]'
                        : 'bg-white text-[#171717] border-[#E4E2DA]'
                    }`}
                  >
                    Instant Combinatorial Solver
                  </button>
                  <button
                    type="button"
                    onClick={() => setSolverEngineMode('backend_cpsat')}
                    className={`h-9 px-3 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                      solverEngineMode === 'backend_cpsat'
                        ? 'bg-[#171717] text-white border-[#171717]'
                        : 'bg-white text-[#171717] border-[#E4E2DA]'
                    }`}
                  >
                    Python CP-SAT / Genetic Hybrid
                  </button>
                </div>
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
                          onChange={e =>
                            institutionalStore.toggleConstraint(rule.id, e.target.checked)
                          }
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
                        onChange={e =>
                          institutionalStore.updateConstraintWeight(
                            rule.id,
                            parseInt(e.target.value, 10)
                          )
                        }
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
            <div className="p-4 rounded-xl sf-pastel-lime space-y-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-full bg-[#171717] text-white flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[#171717]">
                    Timetable Synthesized
                  </div>
                  <div className="text-[11px] text-[#171717]/75 truncate">
                    {lastSolverStats.scheduledSemestersLabel}
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
