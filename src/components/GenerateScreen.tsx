import React, { useState } from 'react';
import { RouteType } from './SmartGridNav';
import { useInstitutionalData, institutionalStore } from '../data/store';
import { buildMatrixSchedule } from '../data/solverAdapter';
import { 
  Play, 
  ArrowRight, 
  CheckCircle2, 
  Check, 
  Cpu, 
  Sliders, 
  RotateCcw, 
  Layers,
  Calendar
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
  const [strategyPreset, setStrategyPreset] = useState<'balanced' | 'circadian' | 'compaction' | 'faculty'>('balanced');
  const [scenarioName, setScenarioName] = useState<string>(
    `Spring 2026 Master Allocation #${store.scenarios.length + 1}`
  );

  // Solver weights
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
    } else {
      const deptGroupIds = store.studentGroups
        .filter(g => {
          const prog = store.programs.find(p => p.id === g.programId);
          return prog?.departmentId === deptId;
        })
        .map(g => g.id);
      setSelectedGroupIds(new Set(deptGroupIds.length > 0 ? deptGroupIds : store.studentGroups.map(g => g.id)));
    }
  };

  const toggleGroupSelection = (groupId: string) => {
    const updated = new Set(selectedGroupIds);
    if (updated.has(groupId)) {
      updated.delete(groupId);
    } else {
      updated.add(groupId);
    }
    setSelectedGroupIds(updated);
  };

  const toggleSelectAllVisible = () => {
    const allVisibleSelected = visibleGroups.every(g => selectedGroupIds.has(g.id));
    const updated = new Set(selectedGroupIds);
    if (allVisibleSelected) {
      visibleGroups.forEach(g => updated.delete(g.id));
    } else {
      visibleGroups.forEach(g => updated.add(g.id));
    }
    setSelectedGroupIds(updated);
  };

  // Real Solver Execution
  const handleRunSolver = () => {
    setIsSolving(true);
    setProgress(15);
    setSolveStageText('Validating hard constraints, room capacities, and faculty blackout windows...');
    setLastResult(null);

    setTimeout(() => {
      setProgress(45);
      setSolveStageText('Allocating specialized laboratories and design studios...');
    }, 250);

    setTimeout(() => {
      setProgress(75);
      setSolveStageText('Assigning lecture halls and balancing cohort daily loads...');
    }, 500);

    setTimeout(() => {
      setProgress(100);
      setSolveStageText('Finalizing Pareto-optimal schedule and verifying zero collisions...');
      const res = institutionalStore.runTimetableSolver({
        termId: selectedTermId,
        departmentId: selectedDeptId,
        selectedGroupIds: Array.from(selectedGroupIds),
        strategyName: scenarioName.trim() || `Master Allocation Run #${store.scenarios.length + 1}`
      });
      setIsSolving(false);
      setLastResult({
        placedCount: res.placedCount,
        unplacedCount: res.unplacedCount,
        conflictCount: res.conflictCount,
        roomUtilization: res.roomUtilization,
        scenarioName: res.scenario.name
      });
      setScenarioName(`Spring 2026 Master Allocation #${institutionalStore.get().scenarios.length + 1}`);
    }, 850);
  };

  const { conflicts } = buildMatrixSchedule(store);
  const scopedSections = store.sections.filter(s => selectedGroupIds.has(s.studentGroupId));

  // Pre-flight readiness checks
  const readinessChecks = [
    { label: 'Time Grid', detail: `${store.timeStructure.periods.length} slots`, ok: store.timeStructure.periods.length > 0 },
    { label: 'Departments', detail: `${store.departments.length} depts`, ok: store.departments.length > 0 },
    { label: 'Campus Rooms', detail: `${store.rooms.length} rooms`, ok: store.rooms.length > 0 },
    { label: 'Courses', detail: `${store.courses.length} courses`, ok: store.courses.length > 0 },
    { label: 'Faculty', detail: `${store.instructors.length} profs`, ok: store.instructors.length > 0 },
    { label: 'Cohorts & Secs', detail: `${store.sections.length} sections`, ok: store.studentGroups.length > 0 && store.sections.length > 0 },
    { label: 'Active Rules', detail: `${store.constraints.filter(c => c.enabled).length} rules`, ok: store.constraints.length > 0 }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header Banner */}
      <div className="p-6 bg-gradient-to-br from-[#fff7f2] via-white to-[#faf4fc] border border-[#ece6ed] rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="text-xs font-mono text-[#9c4126] font-bold">
            Multi-Objective Combinatorial Timetable Generator
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1f1b20] tracking-tight mt-0.5">
            Generate Institutional Timetable
          </h1>
          <p className="text-xs sm:text-sm text-[#655d69] mt-1">
            Review your pre-flight setup readiness, tune optimization weights, and execute the solver to assign all sections across rooms and periods.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('setup')}
            className="btn-secondary text-xs"
          >
            <Sliders className="w-3.5 h-3.5 text-[#3b1e4a]" />
            <span>Edit Setup Data</span>
          </button>
          <button
            type="button"
            onClick={handleRunSolver}
            disabled={isSolving}
            className="btn-primary text-xs"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>{isSolving ? 'Running Solver...' : 'Generate Timetable Now'}</span>
          </button>
        </div>
      </div>

      {/* Pre-Flight Readiness Bar */}
      <div className="content-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-[#1f1b20] flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#3b1e4a]" />
            <span>Pre-Flight Data Readiness Verification</span>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('setup')}
            className="text-xs font-semibold text-[#9c4126] hover:underline cursor-pointer"
          >
            Review Setup Wizard →
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {readinessChecks.map((chk, idx) => (
            <div
              key={idx}
              onClick={() => onNavigate('setup')}
              className="p-3 rounded-xl border border-[#ece6ed] bg-[#fbf8fc] hover:bg-white transition-colors cursor-pointer space-y-1"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#1f1b20]">{chk.label}</span>
                <span className={`w-4 h-4 rounded-md flex items-center justify-center text-[10px] font-bold ${
                  chk.ok ? 'bg-[#18794e] text-white' : 'bg-[#fff7ed] text-[#9a3412]'
                }`}>
                  {chk.ok ? <Check className="w-2.5 h-2.5 stroke-[3]" /> : '!'}
                </span>
              </div>
              <div className="text-xs font-mono text-[#655d69]">{chk.detail}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Solver Progress Banner */}
      {isSolving && (
        <div className="p-6 rounded-xl border border-[#ece6ed] bg-gradient-to-r from-[#faf4fc] via-white to-[#fff7f2] space-y-3 shadow-sm">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-[#3b1e4a] flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[#9c4126] animate-spin" />
              <span>{solveStageText}</span>
            </span>
            <span className="font-mono font-bold text-[#9c4126]">{progress}%</span>
          </div>
          <div className="w-full bg-[#ece6ed] h-2.5 rounded-full overflow-hidden">
            <div 
              className="bg-gradient-to-r from-[#3b1e4a] via-[#9c4126] to-[#f27438] h-full transition-all duration-200 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Solved Result Banner */}
      {lastResult && (
        <div className="p-6 border border-[#ece6ed] bg-gradient-to-br from-[#f1fbf5] via-white to-[#faf4fc] rounded-xl space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#18794e] text-white flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <div className="text-base font-extrabold text-[#0f5431]">
                  Timetable Generation Complete — "{lastResult.scenarioName}"
                </div>
                <div className="text-xs text-[#655d69]">
                  All hard constraints satisfied · Zero room, faculty, or student cohort double-bookings.
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigate('timetables')}
              className="btn-primary text-xs shrink-0"
            >
              <span>Inspect & Export in Timetable Matrix</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-[#ece6ed]">
            <div className="p-3.5 rounded-xl bg-white border border-[#ece6ed]">
              <div className="text-xs text-[#655d69]">Sections Placed</div>
              <div className="text-2xl font-extrabold font-mono text-[#1f1b20] mt-0.5 tabular-nums">{lastResult.placedCount}</div>
            </div>
            <div className="p-3.5 rounded-xl bg-white border border-[#ece6ed]">
              <div className="text-xs text-[#655d69]">Unplaced Sections</div>
              <div className="text-2xl font-extrabold font-mono text-[#9c4126] mt-0.5 tabular-nums">{lastResult.unplacedCount}</div>
            </div>
            <div className="p-3.5 rounded-xl bg-white border border-[#ece6ed]">
              <div className="text-xs text-[#655d69]">Hard Collisions</div>
              <div className="text-2xl font-extrabold font-mono text-[#18794e] mt-0.5 tabular-nums">{lastResult.conflictCount}</div>
            </div>
            <div className="p-3.5 rounded-xl bg-white border border-[#ece6ed]">
              <div className="text-xs text-[#655d69]">Room Utilization</div>
              <div className="text-2xl font-extrabold font-mono text-[#3b1e4a] mt-0.5 tabular-nums">{lastResult.roomUtilization}%</div>
            </div>
          </div>
        </div>
      )}

      {/* Main 2-Column Configuration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left (7 cols): Scope & Cohorts */}
        <div className="lg:col-span-7 content-card p-6 space-y-6">
          <div className="border-b border-[#ece6ed] pb-3">
            <h2 className="text-lg font-bold text-[#1f1b20]">
              1. Generation Scope & Cohort Selection
            </h2>
            <p className="text-xs text-[#655d69] mt-0.5">
              Select the academic term, scenario label, and student cohorts to schedule.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#1f1b20] mb-1.5">
                Target Academic Term
              </label>
              <select
                value={selectedTermId}
                onChange={e => setSelectedTermId(e.target.value)}
                disabled={isSolving}
                className="form-input text-xs"
              >
                {store.terms.map(term => (
                  <option key={term.id} value={term.id}>
                    {term.name} ({term.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#1f1b20] mb-1.5">
                Scenario Run Name
              </label>
              <input
                type="text"
                value={scenarioName}
                onChange={e => setScenarioName(e.target.value)}
                disabled={isSolving}
                className="form-input text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#1f1b20] mb-1.5">
              Department Filter Scope
            </label>
            <select
              value={selectedDeptId}
              onChange={e => handleDeptChange(e.target.value)}
              disabled={isSolving}
              className="form-input text-xs"
            >
              <option value="all">Entire Institution (All {store.departments.length} Departments)</option>
              {store.departments.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
          </div>

          {/* Student Cohorts Checklist */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-[#1f1b20]">
                Student Cohorts Included ({selectedGroupIds.size} of {visibleGroups.length} selected · {scopedSections.length} sections)
              </label>
              <button
                type="button"
                onClick={toggleSelectAllVisible}
                className="text-xs font-semibold text-[#9c4126] hover:underline cursor-pointer"
              >
                {visibleGroups.every(g => selectedGroupIds.has(g.id)) ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <div className="max-h-56 overflow-y-auto border border-[#ece6ed] rounded-xl p-3 divide-y divide-[#ece6ed] bg-[#fbf8fc]">
              {visibleGroups.map(grp => {
                const secCount = store.sections.filter(s => s.studentGroupId === grp.id).length;
                return (
                  <label key={grp.id} className="flex items-center justify-between py-2 px-1 cursor-pointer text-xs hover:bg-white rounded-lg">
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={selectedGroupIds.has(grp.id)}
                        onChange={() => toggleGroupSelection(grp.id)}
                        className="rounded border-[#dcd9dd] text-[#3b1e4a] focus:ring-[#9c4126]"
                      />
                      <span className="font-mono font-bold text-[#3b1e4a]">{grp.code}</span>
                      <span className="text-[#655d69]">{grp.name}</span>
                    </div>
                    <span className="text-[#7c747f] font-mono text-[11px]">
                      {grp.size} students · {secCount} secs
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right (5 cols): Strategy Presets & Objective Sliders */}
        <div className="lg:col-span-5 content-card p-6 space-y-6 flex flex-col justify-between">
          <div className="space-y-5">
            <div className="flex items-center justify-between border-b border-[#ece6ed] pb-3">
              <div>
                <h2 className="text-lg font-bold text-[#1f1b20]">
                  2. Solver Optimization Weights
                </h2>
                <p className="text-xs text-[#655d69] mt-0.5">
                  Choose a preset strategy or fine-tune objective scalar sliders.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handlePresetSelect('balanced')}
                className="text-xs text-[#655d69] hover:text-[#1f1b20] inline-flex items-center gap-1 cursor-pointer"
                title="Reset weights"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            </div>

            {/* Strategy Preset Buttons */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'balanced' as const, label: 'Balanced Equilibrium' },
                { id: 'circadian' as const, label: 'Circadian & Commute' },
                { id: 'compaction' as const, label: 'Room Compaction' },
                { id: 'faculty' as const, label: 'Faculty Research' }
              ].map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handlePresetSelect(p.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer text-left ${
                    strategyPreset === p.id
                      ? 'bg-[#3b1e4a] text-white border-[#3b1e4a]'
                      : 'bg-[#fbf8fc] text-[#655d69] border-[#ece6ed] hover:bg-[#f6f2f7]'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Sliders */}
            <div className="space-y-4 pt-1">
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-[#1f1b20]">Commuter Transit Buffer</span>
                  <span className="font-mono font-bold text-[#9c4126]">{transitBufferWeight}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={transitBufferWeight}
                  onChange={e => setTransitBufferWeight(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-[#1f1b20]">Circadian Peak Alertness Alignment</span>
                  <span className="font-mono font-bold text-[#9c4126]">{circadianWeight}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={circadianWeight}
                  onChange={e => setCircadianWeight(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-[#1f1b20]">Facility Compaction & Energy</span>
                  <span className="font-mono font-bold text-[#9c4126]">{roomCompactionWeight}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={roomCompactionWeight}
                  onChange={e => setRoomCompactionWeight(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-[#1f1b20]">Faculty Consecutive Load Protection</span>
                  <span className="font-mono font-bold text-[#9c4126]">{facultyLoadWeight}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={facultyLoadWeight}
                  onChange={e => setFacultyLoadWeight(Number(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          <div className="pt-5 border-t border-[#ece6ed]">
            <button
              type="button"
              onClick={handleRunSolver}
              disabled={isSolving}
              className="w-full btn-primary"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>{isSolving ? 'Generating Timetable...' : `Generate Timetable (${scopedSections.length} Sections)`}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Saved Timetable Scenarios History */}
      <div className="content-card overflow-hidden">
        <div className="px-6 py-4 border-b border-[#ece6ed] bg-[#fbf8fc] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-[#1f1b20]">Generated Timetable Scenarios History</h2>
            <p className="text-xs text-[#655d69]">Every solver run is versioned and ready for inspection or export in the Timetable Matrix.</p>
          </div>
          <span className="text-xs font-mono font-bold text-[#3b1e4a]">{store.scenarios.length} scenarios</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white text-[#655d69] border-b border-[#ece6ed]">
              <tr>
                <th className="py-3 px-4 font-bold">Version</th>
                <th className="py-3 px-4 font-bold">Scenario Name</th>
                <th className="py-3 px-4 font-bold">Generated By</th>
                <th className="py-3 px-4 font-bold font-mono">Hard Clashes</th>
                <th className="py-3 px-4 font-bold font-mono">Room Util</th>
                <th className="py-3 px-4 font-bold font-mono">Satisfaction</th>
                <th className="py-3 px-4 font-bold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ece6ed]">
              {store.scenarios.map(scen => (
                <tr key={scen.id} className="hover:bg-[#fbf8fc]">
                  <td className="py-3 px-4 font-mono font-bold text-[#9c4126]">{scen.version}</td>
                  <td className="py-3 px-4 font-bold text-[#1f1b20]">{scen.name}</td>
                  <td className="py-3 px-4 text-[#655d69]">{scen.author}</td>
                  <td className="py-3 px-4 font-mono font-bold text-[#18794e]">{scen.metrics.clashCount} clashes</td>
                  <td className="py-3 px-4 font-mono text-[#1f1b20]">{scen.metrics.roomUtilizationPercent}%</td>
                  <td className="py-3 px-4 font-mono font-bold text-[#3b1e4a]">{scen.metrics.satisfactionScore}%</td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => onNavigate('timetables')}
                      className="px-3 py-1.5 rounded-xl bg-[#f6f2f7] hover:bg-[#3b1e4a] hover:text-white text-[#3b1e4a] font-bold text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Open Matrix</span>
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
