import React, { useState } from 'react';
import { SmartGridNav, RouteType } from './SmartGridNav';
import { Play, RotateCcw, Sliders, Cpu, CheckCircle, Sparkles, ArrowRight, CheckCircle2, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface GeneratorStudioProps {
  onNavigate?: (route: RouteType) => void;
  onOpenAuth?: (mode?: 'signin' | 'signup') => void;
  onSignOut?: () => void;
  currentUser?: { name: string; role: string; institution?: string } | null;
  hideNav?: boolean;
}

export const GeneratorStudio: React.FC<GeneratorStudioProps> = ({
  onNavigate,
  onOpenAuth,
  onSignOut,
  currentUser,
  hideNav = false
}) => {
  const [transitWeight, setTransitWeight] = useState(85);
  const [circadianWeight, setCircadianWeight] = useState(90);
  const [roomCompaction, setRoomCompaction] = useState(70);
  const [isSolving, setIsSolving] = useState(false);
  const [solved, setSolved] = useState(false);
  const [progress, setProgress] = useState(0);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [facultyWorkloadCap, setFacultyWorkloadCap] = useState(80);
  const [labDeconMargin, setLabDeconMargin] = useState(45);

  const handleRun = () => {
    setIsSolving(true);
    setProgress(0);

    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(interval);
          return 100;
        }
        return p + 25;
      });
    }, 200);

    setTimeout(() => {
      clearInterval(interval);
      setIsSolving(false);
      setSolved(true);
    }, 1000);
  };

  const handleCancel = () => {
    setIsSolving(false);
    setProgress(0);
  };

  return (
    <div className="min-h-screen bg-app text-primary antialiased">
      {!hideNav && (
        <SmartGridNav 
          activeRoute="generator" 
          onNavigate={onNavigate} 
          onOpenAuth={onOpenAuth}
          onSignOut={onSignOut}
          currentUser={currentUser}
        />
      )}

      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Page Title & Subtitle + Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
          <div>
            <h1 className="text-2xl sm:text-[30px] font-semibold text-primary tracking-tight">Auto-scheduler</h1>
            <p className="text-[15px] text-secondary mt-1">
              Multi-objective combinatorial timetable solver and constraint tuning
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => { setTransitWeight(85); setCircadianWeight(90); setRoomCompaction(70); }}
              className="h-[38px] px-3.5 rounded-md border border-border bg-surface hover:bg-subtle text-primary text-[14px] font-medium flex items-center gap-2 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 text-secondary" />
              <span>Reset defaults</span>
            </button>
            <button
              onClick={handleRun}
              disabled={isSolving}
              className="h-[38px] px-4 rounded-md bg-brand hover:bg-brand-hover text-white text-[14px] font-medium flex items-center gap-2 transition-colors shadow-xs disabled:opacity-60 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>{isSolving ? 'Solving...' : 'Run solver'}</span>
            </button>
          </div>
        </div>

        {/* SAT Equilibrium Box (Moved from Sidebar) */}
        <div className="p-5 rounded-lg border border-border bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="text-[15px] font-semibold text-primary">SAT equilibrium status</span>
              <span className="px-2 py-0.5 rounded text-[13px] font-mono text-success bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 font-medium">
                99.98% optimal
              </span>
            </div>
            <div className="text-[13px] text-secondary">
              Deterministic SAT solver • 0 hard clashes • 1.24ms mean search time
            </div>
          </div>
          <div className="w-full sm:w-56 space-y-1.5">
            <div className="flex justify-between text-[13px] font-mono text-secondary">
              <span>Convergence</span>
              <span className="text-success font-medium">99.98%</span>
            </div>
            <div className="w-full bg-subtle rounded-full h-2 overflow-hidden">
              <div className="bg-success h-2 rounded-full" style={{ width: '99.98%' }} />
            </div>
          </div>
        </div>

        {/* Constraint Scalars Section */}
        <section className="bg-surface border border-border rounded-lg p-6 space-y-6">
          <div className="border-b border-border pb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-primary">Objective scalar weights</h2>
              <p className="text-[13px] text-secondary mt-0.5">Set relative priorities across student transit, circadian alertness, and room compaction</p>
            </div>
            <span className="text-[13px] font-mono text-secondary">Range [0.0 - 1.0]</span>
          </div>

          <div className="space-y-5">
            {/* Slider 1 */}
            <div className="space-y-2">
              <div className="flex justify-between text-[14px]">
                <label className="font-medium text-primary">
                  Commuter transit buffer weight
                </label>
                <span className="font-mono text-primary font-medium">
                  {(transitWeight / 100).toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={transitWeight}
                onChange={e => setTransitWeight(Number(e.target.value))}
                className="w-full h-2 cursor-pointer"
              />
              <p className="text-[13px] text-secondary leading-relaxed">
                Guarantees at least 15 minutes of buffer time between non-adjacent buildings for off-campus commuter cohorts.
              </p>
            </div>

            {/* Slider 2 */}
            <div className="space-y-2">
              <div className="flex justify-between text-[14px]">
                <label className="font-medium text-primary">
                  Circadian alertness curve alignment
                </label>
                <span className="font-mono text-primary font-medium">
                  {(circadianWeight / 100).toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={circadianWeight}
                onChange={e => setCircadianWeight(Number(e.target.value))}
                className="w-full h-2 cursor-pointer"
              />
              <p className="text-[13px] text-secondary leading-relaxed">
                Positions heavy STEM lectures and 4-credit courses during cohort peak alertness windows (10:00 - 14:00).
              </p>
            </div>

            {/* Slider 3 */}
            <div className="space-y-2">
              <div className="flex justify-between text-[14px]">
                <label className="font-medium text-primary">
                  Facility compaction & energy conservation
                </label>
                <span className="font-mono text-primary font-medium">
                  {(roomCompaction / 100).toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={roomCompaction}
                onChange={e => setRoomCompaction(Number(e.target.value))}
                className="w-full h-2 cursor-pointer"
              />
              <p className="text-[13px] text-secondary leading-relaxed">
                Clusters classroom allocations into core campus wings to power down secondary facilities by late afternoon.
              </p>
            </div>
          </div>

          {/* Progressive Disclosure: Advanced Constraints */}
          <div className="pt-3 border-t border-border">
            <button
              onClick={() => setAdvancedOpen(!advancedOpen)}
              className="flex items-center gap-2 text-[14px] text-secondary hover:text-primary font-medium transition-colors cursor-pointer"
            >
              <ChevronDown className={`w-4 h-4 transition-transform duration-150 ${advancedOpen ? 'rotate-180' : ''}`} />
              <span>Advanced solver constraints</span>
            </button>

            {advancedOpen && (
              <div className="pt-4 space-y-5">
                <div className="space-y-2">
                  <div className="flex justify-between text-[14px]">
                    <label className="font-medium text-primary">
                      Faculty consecutive teaching limit
                    </label>
                    <span className="font-mono text-primary font-medium">
                      {(facultyWorkloadCap / 20).toFixed(1)} hrs
                    </span>
                  </div>
                  <input
                    type="range"
                    min="40"
                    max="100"
                    value={facultyWorkloadCap}
                    onChange={e => setFacultyWorkloadCap(Number(e.target.value))}
                    className="w-full h-2 cursor-pointer"
                  />
                  <p className="text-[13px] text-secondary leading-relaxed">
                    Enforces contractual break periods after 3 consecutive hours of lecture or lab instruction.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-[14px]">
                    <label className="font-medium text-primary">
                      Lab decontamination margin
                    </label>
                    <span className="font-mono text-primary font-medium">
                      {labDeconMargin} mins
                    </span>
                  </div>
                  <input
                    type="range"
                    min="15"
                    max="60"
                    value={labDeconMargin}
                    onChange={e => setLabDeconMargin(Number(e.target.value))}
                    className="w-full h-2 cursor-pointer"
                  />
                  <p className="text-[13px] text-secondary leading-relaxed">
                    Required equipment reset buffer between biological and chemical engineering cohorts.
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Real-Time Telemetry Strip with Comparison vs Last Term */}
        <section className="bg-surface border border-border rounded-lg grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">
          <div className="p-5 text-left space-y-0.5">
            <div className="text-[14px] font-medium text-primary">Active Candidate Pool</div>
            <div className="text-[32px] font-semibold font-mono tracking-tight text-primary tabular-nums">
              4,120
            </div>
            <div className="text-[13px] text-secondary">
              +310 vs baseline iteration • 4 threads active
            </div>
          </div>
          <div className="p-5 text-left space-y-0.5">
            <div className="text-[14px] font-medium text-primary">Mean Search Latency</div>
            <div className="text-[32px] font-semibold font-mono tracking-tight text-primary tabular-nums">
              1.24 ms
            </div>
            <div className="text-[13px] text-secondary">
              -0.42ms faster than SAT-4 • Heuristic pruning
            </div>
          </div>
          <div className="p-5 text-left space-y-0.5">
            <div className="text-[14px] font-medium text-primary">Pareto Optimality</div>
            <div className="text-[32px] font-semibold font-mono tracking-tight text-success tabular-nums">
              99.88%
            </div>
            <div className="text-[13px] text-success font-medium">
              0 hard constraint violations • Stable state
            </div>
          </div>
        </section>

        {/* Progress Bar when Solving */}
        {isSolving && (
          <div className="p-5 rounded-lg border border-border bg-surface space-y-2.5">
            <div className="flex items-center justify-between text-[14px]">
              <span className="text-secondary">Evaluating 1,280 adjacent chromosome permutations...</span>
              <div className="flex items-center gap-3">
                <span className="font-mono text-primary font-medium">{progress}%</span>
                <button
                  onClick={handleCancel}
                  className="text-[13px] text-error hover:underline cursor-pointer font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
            <div className="w-full bg-subtle h-2.5 rounded-full overflow-hidden">
              <div 
                className="bg-brand h-full transition-all duration-200 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Solved Success Banner */}
        <AnimatePresence>
          {solved && (
            <motion.div 
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="p-5 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
                <div className="space-y-0.5">
                  <div className="text-[14px] font-medium text-emerald-900 dark:text-emerald-200">
                    Solve run complete — 0 hard clashes found
                  </div>
                  <div className="text-[13px] text-emerald-800/90 dark:text-emerald-300/90">
                    1,420 sections allocated with 99.88% Pareto equilibrium across 42 facilities.
                  </div>
                </div>
              </div>
              <button
                onClick={() => onNavigate?.('timetable')}
                className="h-[38px] px-4 rounded-md bg-brand hover:bg-brand-hover text-white text-[14px] font-medium flex items-center gap-2 transition-colors shadow-xs cursor-pointer whitespace-nowrap"
              >
                <span>View timetable</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Execution Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            onClick={() => { setTransitWeight(85); setCircadianWeight(90); setRoomCompaction(70); }}
            className="h-[38px] px-4 rounded-md border border-border bg-surface hover:bg-subtle text-primary text-[14px] font-medium transition-colors cursor-pointer"
          >
            Reset defaults
          </button>
          <button
            onClick={handleRun}
            disabled={isSolving}
            className="h-[38px] px-4 rounded-md bg-brand hover:bg-brand-hover text-white text-[14px] font-medium transition-colors shadow-xs disabled:opacity-60 flex items-center gap-2 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>{isSolving ? 'Solving...' : 'Run solver'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
