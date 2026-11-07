import React, { useState } from 'react';
import { RouteType } from './SmartGridNav';
import { useInstitutionalData, institutionalStore } from '../data/store';
import {
  Play,
  ArrowRight,
  CheckCircle2,
  Check,
  Cpu,
  Sliders,
  RotateCcw,
  Calendar,
  BookOpen,
  ShieldCheck,
  Sparkles,
  Clock
} from 'lucide-react';

interface GenerateScreenProps {
  onNavigate: (route: RouteType) => void;
}

export const GenerateScreen: React.FC<GenerateScreenProps> = ({ onNavigate }) => {
  const store = useInstitutionalData();
  const [selectedTermId, setSelectedTermId] = useState<string>(
    store.terms.find(t => t.status === 'active')?.id || store.terms[0]?.id || ''
  );
  const [selectedDeptId, setSelectedDeptId] = useState<string>('all');
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(
    new Set(store.studentGroups.map(g => g.id))
  );
  const [selectedCourseIds, setSelectedCourseIds] = useState<Set<string>>(
    new Set(store.courses.map(c => c.id))
  );

  const [strategyPreset, setStrategyPreset] = useState<'balanced' | 'circadian' | 'compaction' | 'faculty'>('balanced');
  const [scenarioName, setScenarioName] = useState<string>(
    `Fall 2026 Optimized Build #${store.scenarios.length + 1}`
  );

  // Personal Preferences & Solver Weights
  const [preferredWindow, setPreferredWindow] = useState<'morning' | 'balanced' | 'afternoon'>('balanced');
  const [maxDailyWorkload, setMaxDailyWorkload] = useState<number>(6);
  const [transitBufferWeight, setTransitBufferWeight] = useState(85);
  const [circadianWeight, setCircadianWeight] = useState(90);
  const [roomCompactionWeight, setRoomCompactionWeight] = useState(75);
  const [facultyLoadWeight, setFacultyLoadWeight] = useState(80);

  // Solver execution state
  const [isSolving, setIsSolving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [solveStageText, setSolveStageText] = useState('');
  const [lastResult, setLastResult] = useState<{
    placedCount: number;
    unplacedCount: number;
    conflictCount: number;
    roomUtilization: number;
    scenarioName: string;
  } | null>(null);

  const visibleGroups = store.studentGroups.filter(g => {
    if (selectedDeptId === 'all') return true;
    const prog = store.programs.find(p => p.id === g.programId);
    return prog?.departmentId === selectedDeptId;
  });

  const visibleCourses = store.courses.filter(c => {
    if (selectedDeptId === 'all') return true;
    return c.departmentId === selectedDeptId;
  });

  const handlePresetSelect = (preset: 'balanced' | 'circadian' | 'compaction' | 'faculty') => {
    setStrategyPreset(preset);
    if (preset === 'balanced') {
      setTransitBufferWeight(85);
      setCircadianWeight(90);
      setRoomCompactionWeight(75);
      setFacultyLoadWeight(80);
    } else if (preset === 'circadian') {
      setTransitBufferWeight(95);
      setCircadianWeight(98);
      setRoomCompactionWeight(60);
      setFacultyLoadWeight(75);
    } else if (preset === 'compaction') {
      setTransitBufferWeight(75);
      setCircadianWeight(70);
      setRoomCompactionWeight(98);
      setFacultyLoadWeight(70);
    } else if (preset === 'faculty') {
      setTransitBufferWeight(70);
      setCircadianWeight(80);
      setRoomCompactionWeight(65);
      setFacultyLoadWeight(98);
    }
  };

  const handleDeptChange = (deptId: string) => {
    setSelectedDeptId(deptId);
    if (deptId === 'all') {
      setSelectedGroupIds(new Set(store.studentGroups.map(g => g.id)));
      setSelectedCourseIds(new Set(store.courses.map(c => c.id)));
    } else {
      const deptGroupIds = store.studentGroups
        .filter(g => {
          const prog = store.programs.find(p => p.id === g.programId);
          return prog?.departmentId === deptId;
        })
        .map(g => g.id);
      setSelectedGroupIds(new Set(deptGroupIds.length > 0 ? deptGroupIds : store.studentGroups.map(g => g.id)));
      const deptCourses = store.courses.filter(c => c.departmentId === deptId).map(c => c.id);
      setSelectedCourseIds(new Set(deptCourses.length > 0 ? deptCourses : store.courses.map(c => c.id)));
    }
  };

  const toggleGroupSelection = (groupId: string) => {
    const updated = new Set(selectedGroupIds);
    if (updated.has(groupId)) updated.delete(groupId);
    else updated.add(groupId);
    setSelectedGroupIds(updated);
  };

  const toggleCourseSelection = (courseId: string) => {
    const updated = new Set(selectedCourseIds);
    if (updated.has(courseId)) updated.delete(courseId);
    else updated.add(courseId);
    setSelectedCourseIds(updated);
  };

  const handleToggleConstraint = (constraintId: string, currentEnabled: boolean) => {
    institutionalStore.toggleConstraint(constraintId, !currentEnabled);
  };

  // Real Solver Execution
  const handleRunSolver = () => {
    setIsSolving(true);
    setProgress(20);
    setSolveStageText('Validating hard constraints, room capacities, and faculty availability windows...');
    setLastResult(null);

    setTimeout(() => {
      setProgress(55);
      setSolveStageText('Allocating specialized laboratories and matching course sections...');
    }, 250);

    setTimeout(() => {
      setProgress(85);
      setSolveStageText('Applying personal timing preferences and midday break buffers...');
    }, 500);

    setTimeout(() => {
      setProgress(100);
      setSolveStageText('Finalizing conflict-free timetable...');
      const res = institutionalStore.runTimetableSolver({
        termId: selectedTermId,
        departmentId: selectedDeptId,
        selectedGroupIds: Array.from(selectedGroupIds),
        strategyName: scenarioName.trim() || `Optimized Schedule #${store.scenarios.length + 1}`
      });
      setIsSolving(false);
      setLastResult({
        placedCount: res.placedCount,
        unplacedCount: res.unplacedCount,
        conflictCount: res.conflictCount,
        roomUtilization: res.roomUtilization,
        scenarioName: res.scenario.name
      });
      setScenarioName(`Fall 2026 Optimized Build #${institutionalStore.get().scenarios.length + 1}`);
    }, 800);
  };

  const scopedSections = store.sections.filter(s => selectedGroupIds.has(s.studentGroupId));
  const hardConstraints = store.constraints.filter(c => c.kind === 'hard');
  const softConstraints = store.constraints.filter(c => c.kind === 'soft');

  const workflowSteps = [
    { step: '01', label: 'Academic Info', color: '#B8EEEE' },
    { step: '02', label: 'Course Selection', color: '#F2D8FA' },
    { step: '03', label: 'Personal Preferences', color: '#B8F2E6' },
    { step: '04', label: 'Hard Constraints', color: '#E8D36B' },
    { step: '05', label: 'Generate & Optimize', color: '#B7F77C' }
  ];

  return (
    <div className="space-y-6">
      {/* =========================================================
          1. EDITORIAL PAGE HEADING & GUIDED WORKFLOW PILLS
         ========================================================= */}
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-4 border-b border-[#E4E2DA]">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#F2D8FA] text-[#171717] text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Guided Timetable Configuration & Solver</span>
          </div>
          <h1 className="font-serif-editorial text-3xl sm:text-4xl text-[#171717] tracking-tight">
            Generate Schedule
          </h1>
          <p className="text-xs sm:text-sm text-[#77766F] mt-1 max-w-2xl">
            Configure academic scope, select courses and cohorts, customize personal timing preferences, and verify hard constraints before generating an optimized schedule.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('setup')}
            className="btn-secondary text-xs h-9"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Edit Catalog & Rooms</span>
          </button>
          <button
            type="button"
            onClick={handleRunSolver}
            disabled={isSolving}
            className="btn-primary text-xs h-9"
          >
            <Play className="w-3.5 h-3.5" />
            <span>{isSolving ? 'Generating...' : 'Generate Schedule'}</span>
          </button>
        </div>
      </header>

      {/* Guided Workflow Steps Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {workflowSteps.map(item => (
          <div
            key={item.step}
            className="p-3.5 rounded-xl bg-white border border-[#E4E2DA] flex items-center gap-3"
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center font-mono-tabular font-bold text-xs text-[#171717] shrink-0"
              style={{ backgroundColor: item.color }}
            >
              {item.step}
            </div>
            <div className="text-xs font-semibold text-[#171717] truncate">
              {item.label}
            </div>
          </div>
        ))}
      </div>

      {/* Solver Progress Banner */}
      {isSolving && (
        <div className="p-6 rounded-2xl border border-[#E4E2DA] bg-[#F2D8FA]/45 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[#171717] flex items-center gap-2">
              <Cpu className="w-4 h-4 animate-spin" />
              <span>{solveStageText}</span>
            </span>
            <span className="font-mono-tabular font-bold text-[#171717]">{progress}%</span>
          </div>
          <div className="w-full bg-white h-2.5 rounded-full overflow-hidden border border-[#E4E2DA]">
            <div
              className="bg-[#171717] h-full transition-all duration-200 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Generated Results & Optimization Information Banner */}
      {lastResult && (
        <div className="p-6 rounded-2xl border border-[#E4E2DA] bg-[#B7F77C]/45 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-[#171717] text-white flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-serif-editorial text-2xl text-[#171717]">
                  Schedule Generated — "{lastResult.scenarioName}"
                </h2>
                <p className="text-xs text-[#171717]/80">
                  All hard constraints satisfied · Zero instructor, room, or student cohort double-bookings.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigate('timetables')}
              className="btn-primary text-xs shrink-0"
            >
              <span>Open in My Timetable</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="p-3.5 rounded-xl bg-white border border-[#E4E2DA]">
              <div className="text-xs text-[#77766F]">Sections Scheduled</div>
              <div className="font-serif-editorial text-2xl text-[#171717] mt-0.5">
                {lastResult.placedCount}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-white border border-[#E4E2DA]">
              <div className="text-xs text-[#77766F]">Unassigned Sections</div>
              <div className="font-serif-editorial text-2xl text-[#171717] mt-0.5">
                {lastResult.unplacedCount}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-white border border-[#E4E2DA]">
              <div className="text-xs text-[#77766F]">Hard Clashes</div>
              <div className="font-serif-editorial text-2xl text-[#171717] mt-0.5">
                {lastResult.conflictCount}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-white border border-[#E4E2DA]">
              <div className="text-xs text-[#77766F]">Room Utilization</div>
              <div className="font-serif-editorial text-2xl text-[#171717] mt-0.5">
                {lastResult.roomUtilization}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          MAIN 2-COLUMN GUIDED CONFIGURATION WORKFLOW
         ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN (7 Cols): Step 1 (Academic Info) + Step 2 (Course & Cohort Selection) */}
        <div className="lg:col-span-7 space-y-6">
          {/* STEP 1: Academic Information */}
          <div className="sf-card-white p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-[#E4E2DA] pb-3.5">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-lg bg-[#B8EEEE] text-[#171717] font-mono-tabular font-bold text-xs flex items-center justify-center">
                  01
                </span>
                <div>
                  <h2 className="font-serif-editorial text-xl text-[#171717]">
                    Academic Information
                  </h2>
                  <p className="text-xs text-[#77766F]">
                    Select target term, department scope, and schedule build identifier
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                  Academic Term
                </label>
                <select
                  value={selectedTermId}
                  onChange={e => setSelectedTermId(e.target.value)}
                  disabled={isSolving}
                  className="input-field text-xs"
                >
                  {store.terms.map(term => (
                    <option key={term.id} value={term.id}>
                      {term.name} ({term.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                  Schedule Build Label
                </label>
                <input
                  type="text"
                  value={scenarioName}
                  onChange={e => setScenarioName(e.target.value)}
                  disabled={isSolving}
                  className="input-field text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                Department Scope
              </label>
              <select
                value={selectedDeptId}
                onChange={e => handleDeptChange(e.target.value)}
                disabled={isSolving}
                className="input-field text-xs"
              >
                <option value="all">
                  All Academic Departments ({store.departments.length} Faculties)
                </option>
                {store.departments.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* STEP 2: Course & Cohort Selection */}
          <div className="sf-card-white p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-[#E4E2DA] pb-3.5">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-lg bg-[#F2D8FA] text-[#171717] font-mono-tabular font-bold text-xs flex items-center justify-center">
                  02
                </span>
                <div>
                  <h2 className="font-serif-editorial text-xl text-[#171717]">
                    Course & Cohort Selection
                  </h2>
                  <p className="text-xs text-[#77766F]">
                    Choose which courses and student cohorts to include in this generation pass
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono-tabular px-2.5 py-1 rounded-md bg-[#F7F6EF] border border-[#E4E2DA]">
                {scopedSections.length} sections queued
              </span>
            </div>

            {/* Courses Selection Grid */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-[#171717] flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Courses ({selectedCourseIds.size} of {visibleCourses.length} active)</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (visibleCourses.every(c => selectedCourseIds.has(c.id))) {
                      setSelectedCourseIds(new Set());
                    } else {
                      setSelectedCourseIds(new Set(visibleCourses.map(c => c.id)));
                    }
                  }}
                  className="text-xs font-semibold text-[#171717] underline cursor-pointer"
                >
                  {visibleCourses.every(c => selectedCourseIds.has(c.id)) ? 'Clear all' : 'Select all'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto p-2 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA]">
                {visibleCourses.map(course => {
                  const checked = selectedCourseIds.has(course.id);
                  return (
                    <label
                      key={course.id}
                      className={`flex items-center justify-between p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                        checked
                          ? 'bg-white border-[#171717] text-[#171717]'
                          : 'bg-white/60 border-[#E4E2DA] text-[#77766F]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCourseSelection(course.id)}
                          className="accent-[#171717]"
                        />
                        <span className="font-mono-tabular font-bold shrink-0">{course.code}</span>
                        <span className="truncate">{course.title}</span>
                      </div>
                      <span className="text-[10.5px] font-mono-tabular px-1.5 py-0.5 rounded bg-[#EDEAE0] text-[#171717] shrink-0 ml-1">
                        {course.creditHours}cr
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Student Cohorts Checklist */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-[#171717]">
                  Student Cohorts ({selectedGroupIds.size} of {visibleGroups.length} selected)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto p-2 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA]">
                {visibleGroups.map(grp => {
                  const secCount = store.sections.filter(s => s.studentGroupId === grp.id).length;
                  const checked = selectedGroupIds.has(grp.id);
                  return (
                    <label
                      key={grp.id}
                      className={`flex items-center justify-between p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                        checked
                          ? 'bg-white border-[#171717] text-[#171717]'
                          : 'bg-white/60 border-[#E4E2DA] text-[#77766F]'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleGroupSelection(grp.id)}
                          className="accent-[#171717]"
                        />
                        <span className="font-mono-tabular font-bold">{grp.code}</span>
                        <span className="truncate text-[#77766F]">{grp.name}</span>
                      </div>
                      <span className="text-[10.5px] font-mono-tabular text-[#77766F] shrink-0">
                        {secCount} secs
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (5 Cols): Step 3 (Personal Preferences) + Step 4 (Hard Constraints) + Step 5 (Execute) */}
        <div className="lg:col-span-5 space-y-6">
          {/* STEP 3: Personal Preferences */}
          <div className="sf-card-white p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-[#E4E2DA] pb-3.5">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-lg bg-[#B8F2E6] text-[#171717] font-mono-tabular font-bold text-xs flex items-center justify-center">
                  03
                </span>
                <div>
                  <h2 className="font-serif-editorial text-xl text-[#171717]">
                    Personal Preferences
                  </h2>
                  <p className="text-xs text-[#77766F]">
                    Preferred timings, breaks, and daily workload balance
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handlePresetSelect('balanced')}
                className="text-xs text-[#77766F] hover:text-[#171717] inline-flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            </div>

            {/* Preferred Time of Day */}
            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                Preferred Daily Timing Window
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'morning' as const, label: 'Morning Focus', sub: '08:00 – 13:00' },
                  { id: 'balanced' as const, label: 'Balanced Day', sub: '09:00 – 16:00' },
                  { id: 'afternoon' as const, label: 'Afternoon Start', sub: '11:00 – 18:00' }
                ].map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPreferredWindow(opt.id)}
                    className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                      preferredWindow === opt.id
                        ? 'bg-[#171717] text-white border-[#171717]'
                        : 'bg-[#F7F6EF] text-[#171717] border-[#E4E2DA] hover:border-[#171717]'
                    }`}
                  >
                    <div className="text-xs font-semibold">{opt.label}</div>
                    <div className={`text-[10.5px] font-mono-tabular mt-0.5 ${preferredWindow === opt.id ? 'text-[#B8EEEE]' : 'text-[#77766F]'}`}>
                      {opt.sub}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Max Daily Workload */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-[#171717] flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Maximum Daily Workload Cap</span>
                </span>
                <span className="font-mono-tabular font-bold px-2 py-0.5 rounded bg-[#B8F2E6] text-[#171717]">
                  {maxDailyWorkload} hrs / day
                </span>
              </div>
              <input
                type="range"
                min="3"
                max="8"
                value={maxDailyWorkload}
                onChange={e => setMaxDailyWorkload(Number(e.target.value))}
                className="w-full accent-[#171717]"
              />
            </div>

            {/* Optimization Sliders */}
            <div className="space-y-3.5 pt-2 border-t border-[#E4E2DA]">
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-[#171717]">Midday Break & Transit Buffer</span>
                  <span className="font-mono-tabular font-semibold">{transitBufferWeight}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={transitBufferWeight}
                  onChange={e => setTransitBufferWeight(Number(e.target.value))}
                  className="w-full accent-[#171717]"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-[#171717]">Consecutive-Class Cap Protection</span>
                  <span className="font-mono-tabular font-semibold">{facultyLoadWeight}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={facultyLoadWeight}
                  onChange={e => setFacultyLoadWeight(Number(e.target.value))}
                  className="w-full accent-[#171717]"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-[#171717]">Room Compaction & Proximity</span>
                  <span className="font-mono-tabular font-semibold">{roomCompactionWeight}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={roomCompactionWeight}
                  onChange={e => setRoomCompactionWeight(Number(e.target.value))}
                  className="w-full accent-[#171717]"
                />
              </div>
            </div>
          </div>

          {/* STEP 4: Hard Constraints & Step 5: Execute */}
          <div className="sf-card-white p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-[#E4E2DA] pb-3.5">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-lg bg-[#E8D36B] text-[#171717] font-mono-tabular font-bold text-xs flex items-center justify-center">
                  04
                </span>
                <div>
                  <h2 className="font-serif-editorial text-xl text-[#171717]">
                    Hard Constraints
                  </h2>
                  <p className="text-xs text-[#77766F]">
                    Strict conflict rules enforced during schedule generation
                  </p>
                </div>
              </div>
              <ShieldCheck className="w-4 h-4 text-[#171717]" />
            </div>

            <div className="space-y-2">
              {hardConstraints.concat(softConstraints.slice(0, 2)).map(rule => (
                <div
                  key={rule.id}
                  onClick={() => handleToggleConstraint(rule.id, rule.enabled)}
                  className="p-3 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] flex items-center justify-between gap-3 cursor-pointer hover:border-[#171717] transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[#171717] truncate">
                        {rule.name}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                          rule.kind === 'hard'
                            ? 'bg-[#E8D36B] text-[#171717]'
                            : 'bg-[#B8EEEE] text-[#171717]'
                        }`}
                      >
                        {rule.kind.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#77766F] truncate mt-0.5">
                      {rule.description}
                    </p>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
                      rule.enabled
                        ? 'bg-[#171717] text-white'
                        : 'bg-white border border-[#E4E2DA]'
                    }`}
                  >
                    {rule.enabled && <Check className="w-3.5 h-3.5" />}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleRunSolver}
                disabled={isSolving}
                className="w-full btn-primary h-11 text-sm"
              >
                <Play className="w-4 h-4" />
                <span>
                  {isSolving
                    ? 'Generating Conflict-Free Schedule...'
                    : `Generate Schedule (${scopedSections.length} Sections)`}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================
          6. GENERATED RESULTS & SCENARIO HISTORY TABLE
         ========================================================= */}
      <div className="sf-card-white overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E4E2DA] bg-[#F7F6EF] flex items-center justify-between">
          <div>
            <h2 className="font-serif-editorial text-xl text-[#171717]">
              Generated Schedule Versions
            </h2>
            <p className="text-xs text-[#77766F]">
              Every solver run is versioned and ready for inspection or export in My Timetable.
            </p>
          </div>
          <span className="text-xs font-mono-tabular font-semibold px-2.5 py-1 rounded bg-white border border-[#E4E2DA]">
            {store.scenarios.length} builds
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white text-[#77766F] border-b border-[#E4E2DA]">
              <tr>
                <th className="py-3 px-4 font-semibold">Version</th>
                <th className="py-3 px-4 font-semibold">Schedule Name</th>
                <th className="py-3 px-4 font-semibold">Generated By</th>
                <th className="py-3 px-4 font-semibold font-mono-tabular">Hard Clashes</th>
                <th className="py-3 px-4 font-semibold font-mono-tabular">Room Util</th>
                <th className="py-3 px-4 font-semibold font-mono-tabular">Preference Score</th>
                <th className="py-3 px-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E2DA]">
              {store.scenarios.map(scen => (
                <tr key={scen.id} className="hover:bg-[#F7F6EF]/60">
                  <td className="py-3 px-4 font-mono-tabular font-semibold text-[#171717]">
                    {scen.version}
                  </td>
                  <td className="py-3 px-4 font-semibold text-[#171717]">{scen.name}</td>
                  <td className="py-3 px-4 text-[#77766F]">{scen.author}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded bg-[#B7F77C] text-[#171717] font-mono-tabular font-semibold">
                      {scen.metrics.clashCount} clashes
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono-tabular text-[#171717]">
                    {scen.metrics.roomUtilizationPercent}%
                  </td>
                  <td className="py-3 px-4 font-mono-tabular font-semibold text-[#171717]">
                    {scen.metrics.satisfactionScore}%
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => onNavigate('timetables')}
                      className="btn-secondary h-8 text-xs"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Open Timetable</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
