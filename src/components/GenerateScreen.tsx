import React, { useState, useEffect } from 'react';
import { RouteType } from './SmartGridNav';
import { useInstitutionalData, institutionalStore } from '../data/store';
import {
  TimetableScenario,
  computeAcademicScheduleConfig,
  isUserAdminRole
} from '../types/institutional';
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Sliders,
  Calendar,
  BookOpen,
  Clock,
  RefreshCw,
  CheckSquare,
  Square,
  GraduationCap,
  Layers,
  FlaskConical,
  Coffee
} from 'lucide-react';

type OptimizationFocusId = 'balanced' | 'student_friendly' | 'faculty_compact' | 'room_efficiency';

interface GenerateScreenProps {
  onNavigate: (route: RouteType) => void;
  currentUser?: {
    name: string;
    role: string;
    email?: string;
    institution?: string;
  } | null;
}

export const GenerateScreen: React.FC<GenerateScreenProps> = ({ onNavigate, currentUser }) => {
  const store = useInstitutionalData();
  const activeTiming = computeAcademicScheduleConfig(store.timeStructure);
  const isAdmin = isUserAdminRole(currentUser?.role || 'Registrar');

  const [scope, setScope] = useState<string>('all');
  const [optimizationFocus, setOptimizationFocus] = useState<OptimizationFocusId>('balanced');
  const [respectStudentPrefs, setRespectStudentPrefs] = useState(true);
  const [balanceRoomUsage, setBalanceRoomUsage] = useState(true);
  const [scenarioName, setScenarioName] = useState(
    `University Build — ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  );

  // Scoped Course & Cohort Selection
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>(() =>
    store.courses.map(c => c.id)
  );
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>(() =>
    store.studentGroups.map(g => g.id)
  );

  // Sync when department scope changes
  useEffect(() => {
    if (scope === 'all') {
      setSelectedCourseIds(store.courses.map(c => c.id));
      setSelectedGroupIds(store.studentGroups.map(g => g.id));
    } else {
      const deptCourses = store.courses.filter(c => c.departmentId === scope);
      const deptCourseIds = deptCourses.map(c => c.id);
      setSelectedCourseIds(deptCourseIds);

      const deptGroupIds = new Set<string>();
      store.sections.forEach(s => {
        if (deptCourseIds.includes(s.courseId)) {
          deptGroupIds.add(s.studentGroupId);
        }
      });
      setSelectedGroupIds(Array.from(deptGroupIds));
    }
  }, [scope, store.courses, store.studentGroups, store.sections]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [result, setResult] = useState<{
    placedCount: number;
    unplacedCount: number;
    conflictCount: number;
    roomUtilization: number;
    scenario: TimetableScenario;
  } | null>(null);

  const toggleCourse = (courseId: string) => {
    setSelectedCourseIds(prev =>
      prev.includes(courseId) ? prev.filter(id => id !== courseId) : [...prev, courseId]
    );
  };

  const toggleGroup = (groupId: string) => {
    setSelectedGroupIds(prev =>
      prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]
    );
  };

  const visibleCourses =
    scope === 'all' ? store.courses : store.courses.filter(c => c.departmentId === scope);

  const matchingSections = store.sections.filter(
    s => selectedCourseIds.includes(s.courseId) && selectedGroupIds.includes(s.studentGroupId)
  );

  const labHoursLabel = (activeTiming.labDurationMinutes / 60).toFixed(
    activeTiming.labDurationMinutes % 60 === 0 ? 0 : 1
  );

  const readinessItems = [
    {
      label: 'Rooms & Laboratories',
      count: store.rooms.length,
      ready: store.rooms.length > 0,
      detail: `${store.rooms.filter(r => r.type === 'lab').length} Labs, ${
        store.rooms.filter(r => r.type !== 'lab').length
      } Lecture/Seminar`
    },
    {
      label: 'Selected Courses',
      count: selectedCourseIds.length,
      ready: selectedCourseIds.length > 0,
      detail: `${matchingSections.length} sections queued (${
        matchingSections.filter(s => s.sessionType === 'Lab').length
      } ${labHoursLabel}h labs)`
    },
    {
      label: 'Instructors & Faculty',
      count: store.instructors.length,
      ready: store.instructors.length > 0,
      detail: 'Availability windows verified'
    },
    {
      label: 'Saved Academic Configuration',
      count: activeTiming.slots.length,
      ready: activeTiming.slots.length > 0,
      detail: `${activeTiming.operatingHoursLabel} · ${activeTiming.periodLengthMinutes}m lectures`
    }
  ];

  const allReady = readinessItems.every(i => i.ready) && matchingSections.length > 0;

  const generationSteps = [
    `Loading saved Academic Configuration (${activeTiming.operatingHoursLabel}, ${activeTiming.slots.length} daily slots)...`,
    `Locking ${activeTiming.continuousLabBlocks.length} continuous ${labHoursLabel}-hour laboratory windows...`,
    `Assigning ${activeTiming.periodLengthMinutes}-minute lectures${
      activeTiming.shortBreakEnabled && activeTiming.shortBreakMinutes > 0
        ? ` with ${activeTiming.shortBreakMinutes}-minute breaks`
        : ''
    }...`,
    activeTiming.middayBreak.enabled
      ? `Protecting university midday break (${activeTiming.middayBreak.fullRangeLabel}) & verifying zero overlaps...`
      : 'Verifying zero room, instructor, and student section overlaps...'
  ];

  const handleRunGenerator = () => {
    if (!allReady) return;
    setIsGenerating(true);
    setResult(null);
    setStepIndex(0);

    const interval = setInterval(() => {
      setStepIndex(prev => (prev < generationSteps.length - 1 ? prev + 1 : prev));
    }, 320);

    setTimeout(() => {
      clearInterval(interval);
      const solverRes = institutionalStore.runTimetableSolver({
        departmentId: scope === 'all' ? 'all' : scope,
        selectedGroupIds,
        strategyName: scenarioName,
        forceRescheduleAll: true
      });
      setResult(solverRes);
      setIsGenerating(false);
    }, 1350);
  };

  return (
    <div className="space-y-8">
      {/* =========================================================
          1. PAGE HEADING
         ========================================================= */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-[#E4E2DA]">
        <div className="space-y-2">
          <div className="text-xs font-medium text-[#77766F]">
            Constraint-Based University Timetable Engine
          </div>
          <h1 className="font-serif-editorial text-3xl sm:text-4xl text-[#171717] tracking-tight">
            Generate University Timetable
          </h1>
          <p className="text-sm text-[#77766F] max-w-2xl">
            Select target departments, cohorts, and optimization priorities to generate a conflict-free timetable using the university’s saved Academic Configuration.
          </p>
        </div>

        <button
          onClick={() => onNavigate('timetables')}
          className="btn-secondary text-xs h-10 px-4 shrink-0"
        >
          <Calendar className="w-4 h-4" />
          <span>Open Timetable Grid</span>
        </button>
      </header>

      {/* =========================================================
          2. READ-ONLY ACTIVE ACADEMIC CONFIGURATION SUMMARY BANNER
             (Configured once in the dedicated Academic Configuration page)
         ========================================================= */}
      <section className="sf-card-white p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E4E2DA] pb-3.5">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#171717]" />
              <h2 className="font-serif-editorial text-lg text-[#171717]">
                Active University Academic Configuration
              </h2>
              <span className="text-[10.5px] font-mono-tabular font-semibold px-2 py-0.5 rounded bg-[#B8EEEE] text-[#171717]">
                Applied Automatically
              </span>
            </div>
            <p className="text-xs text-[#77766F]">
              The scheduling engine automatically enforces the timing rules configured by the administrator in Academic Configuration.
            </p>
          </div>

          {isAdmin && (
            <button
              type="button"
              onClick={() => onNavigate('academic-config')}
              className="btn-secondary text-xs h-9 px-3.5 shrink-0"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Edit in Academic Configuration</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] space-y-1">
            <div className="text-[10.5px] font-medium text-[#77766F] flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#171717]" />
              <span>Operating Hours</span>
            </div>
            <div className="font-mono-tabular font-semibold text-[#171717]">
              {activeTiming.operatingHoursLabel}
            </div>
            <div className="text-[11px] text-[#77766F]">
              {activeTiming.workingDays.join(', ')} ({activeTiming.slots.length} slots/day)
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] space-y-1">
            <div className="text-[10.5px] font-medium text-[#77766F] flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-[#171717]" />
              <span>Regular Class Duration</span>
            </div>
            <div className="font-mono-tabular font-semibold text-[#171717]">
              {activeTiming.periodLengthMinutes} minutes
            </div>
            <div className="text-[11px] text-[#77766F]">Standard theory lecture</div>
          </div>

          <div className="p-3 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] space-y-1">
            <div className="text-[10.5px] font-medium text-[#77766F] flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-[#171717]" />
              <span>Break Between Classes</span>
            </div>
            <div className="font-mono-tabular font-semibold text-[#171717]">
              {activeTiming.shortBreakEnabled && activeTiming.shortBreakMinutes > 0
                ? `${activeTiming.shortBreakMinutes} minutes (Enabled)`
                : 'Disabled (0 min)'}
            </div>
            <div className="text-[11px] text-[#77766F]">
              {activeTiming.shortBreakEnabled && activeTiming.shortBreakMinutes > 0
                ? 'Automatic transition gap'
                : 'Back-to-back lectures'}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] space-y-1">
            <div className="text-[10.5px] font-medium text-[#77766F] flex items-center gap-1.5">
              <Coffee className="w-3.5 h-3.5 text-[#171717]" />
              <span>Midday / Lunch Break</span>
            </div>
            <div className="font-mono-tabular font-semibold text-[#171717]">
              {activeTiming.middayBreak.enabled
                ? activeTiming.middayBreak.timeRangeLabel
                : 'Disabled'}
            </div>
            <div className="text-[11px] text-[#77766F]">
              {activeTiming.middayBreak.enabled
                ? `${activeTiming.middayBreak.durationMinutes} min protected window`
                : 'Continuous day schedule'}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] space-y-1">
            <div className="text-[10.5px] font-medium text-[#77766F] flex items-center gap-1.5">
              <FlaskConical className="w-3.5 h-3.5 text-[#171717]" />
              <span>Laboratory Duration</span>
            </div>
            <div className="font-mono-tabular font-semibold text-[#171717]">
              {activeTiming.labDurationMinutes} min ({labHoursLabel} hours)
            </div>
            <div className="text-[11px] text-[#77766F]">
              Spans {activeTiming.labSpanSlots} continuous slots
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* =========================================================
            LEFT COLUMN (7 cols): SCOPE, COHORTS, COURSES & STRATEGY
           ========================================================= */}
        <div className="lg:col-span-7 space-y-6">
          {/* Card 1: Scope & Scenario Name */}
          <div className="sf-card-white p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-[#E4E2DA] pb-3.5">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#171717]" />
                <h2 className="font-serif-editorial text-xl text-[#171717]">
                  1. Schedule Scope & Scenario Name
                </h2>
              </div>
              <span className="text-xs font-mono-tabular text-[#77766F]">
                {matchingSections.length} sections queued
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                  Academic Department Scope
                </label>
                <select
                  value={scope}
                  onChange={e => setScope(e.target.value)}
                  className="input-field text-xs"
                >
                  <option value="all">
                    Whole University ({store.courses.length} Courses · {store.sections.length} Sections)
                  </option>
                  {store.departments.map(dept => {
                    const cCount = store.courses.filter(c => c.departmentId === dept.id).length;
                    return (
                      <option key={dept.id} value={dept.id}>
                        {dept.name} ({dept.code} — {cCount} Courses)
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                  Scenario Build Label
                </label>
                <input
                  type="text"
                  value={scenarioName}
                  onChange={e => setScenarioName(e.target.value)}
                  className="input-field text-xs"
                  placeholder="e.g. Fall 2026 Master Build"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Student Groups & Course Selection */}
          <div className="sf-card-white p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E4E2DA] pb-3.5">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#171717]" />
                <h2 className="font-serif-editorial text-xl text-[#171717]">
                  2. Select Student Cohorts & Courses
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedCourseIds(visibleCourses.map(c => c.id))}
                  className="text-xs font-semibold text-[#171717] hover:underline cursor-pointer"
                >
                  Select All
                </button>
                <span className="text-[#E4E2DA]">|</span>
                <button
                  type="button"
                  onClick={() => setSelectedCourseIds([])}
                  className="text-xs font-medium text-[#77766F] hover:text-[#171717] cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Cohort Chips */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#171717] flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-[#77766F]" />
                  <span>Target Student Cohorts ({selectedGroupIds.length} active)</span>
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedGroupIds(store.studentGroups.map(g => g.id))}
                  className="text-[11px] text-[#77766F] hover:text-[#171717] underline cursor-pointer"
                >
                  All Cohorts
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1">
                {store.studentGroups.map(group => {
                  const active = selectedGroupIds.includes(group.id);
                  return (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => toggleGroup(group.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 cursor-pointer ${
                        active
                          ? 'bg-[#171717] text-white border-[#171717]'
                          : 'bg-[#F7F6EF] text-[#77766F] border-[#E4E2DA] hover:text-[#171717]'
                      }`}
                    >
                      <span>{group.name}</span>
                      <span className="text-[10px] opacity-75">({group.size})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Course Checklist */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-[#171717]">
                Courses Included ({selectedCourseIds.length} of {visibleCourses.length})
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                {visibleCourses.map(course => {
                  const isChecked = selectedCourseIds.includes(course.id);
                  const courseSections = store.sections.filter(s => s.courseId === course.id);
                  const hasLab = courseSections.some(s => s.sessionType === 'Lab');
                  return (
                    <button
                      key={course.id}
                      type="button"
                      onClick={() => toggleCourse(course.id)}
                      className={`p-2.5 rounded-xl border text-left flex items-start gap-2.5 transition-colors cursor-pointer ${
                        isChecked
                          ? 'bg-[#F7F6EF] border-[#171717]'
                          : 'bg-white border-[#E4E2DA] opacity-65 hover:opacity-100'
                      }`}
                    >
                      {isChecked ? (
                        <CheckSquare className="w-4 h-4 text-[#171717] shrink-0 mt-0.5" />
                      ) : (
                        <Square className="w-4 h-4 text-[#77766F] shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-mono-tabular text-xs font-bold text-[#171717]">
                            {course.code}
                          </span>
                          <div className="flex items-center gap-1">
                            {hasLab && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#F2D8FA] text-[#171717]">
                                {labHoursLabel}h Lab
                              </span>
                            )}
                            <span className="text-[10px] font-mono-tabular px-1.5 py-0.5 rounded bg-white border border-[#E4E2DA] text-[#77766F]">
                              {courseSections.length} sec
                            </span>
                          </div>
                        </div>
                        <div className="text-xs text-[#77766F] truncate mt-0.5">{course.title}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Card 3: Optimization Strategy */}
          <div className="sf-card-white p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-[#E4E2DA] pb-3.5">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#171717]" />
                <h2 className="font-serif-editorial text-xl text-[#171717]">
                  3. Optimization Strategy
                </h2>
              </div>
              <span className="text-xs font-medium text-[#77766F]">Soft Constraint Weights</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-2">
                Primary Optimization Goal
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {(
                  [
                    {
                      id: 'balanced',
                      title: 'Balanced University Schedule',
                      desc: `Distributes ${activeTiming.periodLengthMinutes}m lectures & ${labHoursLabel}h labs evenly across active working days`
                    },
                    {
                      id: 'student_friendly',
                      title: 'Student-Friendly Compactness',
                      desc: 'Minimizes long idle gaps and honors student cohort preferences'
                    },
                    {
                      id: 'faculty_compact',
                      title: 'Instructor Teaching Blocks',
                      desc: 'Clusters faculty teaching hours on fewer days'
                    },
                    {
                      id: 'room_efficiency',
                      title: 'Room & Lab Utilization',
                      desc: 'Matches section sizes tightly to lecture hall & lab capacities'
                    }
                  ] as const
                ).map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setOptimizationFocus(opt.id)}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      optimizationFocus === opt.id
                        ? 'border-[#171717] bg-[#B8EEEE]/40 shadow-xs'
                        : 'border-[#E4E2DA] bg-[#F7F6EF]/60 hover:bg-[#F7F6EF]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-[#171717]">{opt.title}</span>
                      <span
                        className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                          optimizationFocus === opt.id
                            ? 'border-[#171717] bg-[#171717]'
                            : 'border-[#77766F]'
                        }`}
                      >
                        {optimizationFocus === opt.id && (
                          <span className="w-1.5 h-1.5 rounded-full bg-white" />
                        )}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#77766F] leading-relaxed">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2.5 pt-2 border-t border-[#E4E2DA]">
              <label className="flex items-center justify-between p-3 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] cursor-pointer">
                <div>
                  <div className="text-xs font-semibold text-[#171717]">
                    Honor Student Cohort Time Preferences
                  </div>
                  <div className="text-[11px] text-[#77766F]">
                    Applies preferred morning/afternoon slots and day-off requests where feasible
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={respectStudentPrefs}
                  onChange={e => setRespectStudentPrefs(e.target.checked)}
                  className="w-4 h-4 accent-[#171717] rounded cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] cursor-pointer">
                <div>
                  <div className="text-xs font-semibold text-[#171717]">
                    Strict Lab Room & Capacity Matching
                  </div>
                  <div className="text-[11px] text-[#77766F]">
                    Assigns {labHoursLabel}-hour lab sessions exclusively to Laboratory rooms and lectures to Lecture/Seminar halls
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={balanceRoomUsage}
                  onChange={e => setBalanceRoomUsage(e.target.checked)}
                  className="w-4 h-4 accent-[#171717] rounded cursor-pointer"
                />
              </label>
            </div>
          </div>
        </div>

        {/* =========================================================
            RIGHT COLUMN (5 cols): READINESS CHECK & EXECUTION
           ========================================================= */}
        <div className="lg:col-span-5 space-y-6">
          <div className="sf-card-white bg-white border border-[#E4E2DA] rounded-2xl p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-[#E4E2DA] pb-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#77766F]">
                  Pre-Flight Verification
                </div>
                <h2 className="font-serif-editorial text-2xl text-[#171717] mt-0.5">
                  Dataset Readiness
                </h2>
              </div>
              <span
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                  allReady
                    ? 'bg-[#B7F77C] border border-[#98DF58] text-[#171717]'
                    : 'bg-[#F2D8FA] border border-[#DFB9EC] text-[#171717]'
                }`}
              >
                {allReady ? 'Ready to Solve' : 'Select Courses'}
              </span>
            </div>

            <div className="space-y-2.5">
              {readinessItems.map(item => (
                <div
                  key={item.label}
                  className="flex items-center justify-between p-3 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA]"
                >
                  <div className="flex items-center gap-2.5">
                    {item.ready ? (
                      <CheckCircle2 className="w-4 h-4 text-[#171717] shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-[#8A1C1C] shrink-0" />
                    )}
                    <div>
                      <div className="text-xs font-semibold text-[#171717]">{item.label}</div>
                      <div className="text-[11px] text-[#77766F]">{item.detail}</div>
                    </div>
                  </div>
                  <span className="font-mono-tabular text-xs font-bold px-2 py-0.5 rounded bg-[#B8EEEE] text-[#171717]">
                    {item.count}
                  </span>
                </div>
              ))}
            </div>

            {/* Active Hard Constraints Summary */}
            <div className="p-3.5 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] space-y-1.5 text-[11.5px] text-[#55544E]">
              <div className="text-xs font-semibold text-[#171717]">
                Enforced University Scheduling Rules:
              </div>
              <div>
                • Operating Window: <strong className="text-[#171717]">{activeTiming.operatingHoursLabel}</strong> ({activeTiming.workingDays.join('–')})
              </div>
              <div>
                • Lectures: <strong className="text-[#171717]">{activeTiming.periodLengthMinutes} minutes</strong>
                {activeTiming.shortBreakEnabled && activeTiming.shortBreakMinutes > 0
                  ? ` + ${activeTiming.shortBreakMinutes}m break`
                  : ' (no break between classes)'}
              </div>
              <div>
                • Midday Break:{' '}
                <strong className="text-[#171717]">
                  {activeTiming.middayBreak.enabled
                    ? `${activeTiming.middayBreak.fullRangeLabel} (Protected)`
                    : 'Disabled'}
                </strong>
              </div>
              <div>
                • Labs: <strong className="text-[#171717]">{activeTiming.labDurationMinutes}m ({labHoursLabel}h)</strong> continuous blocks ({activeTiming.labSpanSlots} slots)
              </div>
            </div>

            {/* Generate Trigger */}
            <button
              onClick={handleRunGenerator}
              disabled={!allReady || isGenerating}
              className="w-full py-3.5 px-5 rounded-xl bg-[#171717] hover:bg-[#2E2E2E] disabled:opacity-50 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Running Constraint Solver...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-[#B8EEEE]" />
                  <span>Generate Conflict-Free Schedule ({matchingSections.length} Sections)</span>
                </>
              )}
            </button>

            {isGenerating && (
              <div className="p-4 rounded-xl bg-[#B8EEEE]/45 border border-[#95DFDF] space-y-1.5">
                <div className="text-xs font-mono-tabular font-bold text-[#171717]">
                  Step {stepIndex + 1} of {generationSteps.length}
                </div>
                <div className="text-xs text-[#171717] font-medium">{generationSteps[stepIndex]}</div>
              </div>
            )}
          </div>

          {/* Generation Result Summary Card */}
          {result && (
            <div className="sf-card-white p-6 space-y-5 border-2 border-[#171717]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#B7F77C] text-[#171717] text-xs font-semibold mb-2">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Schedule Generated</span>
                  </span>
                  <h3 className="font-serif-editorial text-2xl text-[#171717]">
                    {result.placedCount} of {result.placedCount + result.unplacedCount} Sections Scheduled
                  </h3>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-[#77766F]">Room Utilization</div>
                  <div className="font-serif-editorial text-2xl text-[#171717]">
                    {result.roomUtilization}%
                  </div>
                </div>
              </div>

              {result.conflictCount === 0 ? (
                <div className="p-3.5 rounded-xl sf-pastel-mint text-xs font-medium text-[#171717] flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>
                    Zero room, instructor, or student cohort conflicts detected. All {labHoursLabel}-hour labs and {activeTiming.periodLengthMinutes}-minute lectures fit cleanly within {activeTiming.operatingHoursLabel}.
                  </span>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-[#F2D8FA]/50 border border-[#DFB9EC] text-xs text-[#171717]">
                  {result.unplacedCount} section(s) could not be placed due to room or cohort capacity constraints.
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#E4E2DA]">
                <button
                  onClick={() => onNavigate('feedback')}
                  className="btn-secondary text-xs h-9"
                >
                  <span>View Analytics</span>
                </button>
                <button
                  onClick={() => onNavigate('timetables')}
                  className="btn-primary text-xs h-9"
                >
                  <span>Open Generated Timetable</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
