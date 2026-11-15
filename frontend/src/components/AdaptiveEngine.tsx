import React, { useState, useEffect } from 'react';
import { SmartGridNav, RouteType } from './SmartGridNav';
import { 
  Activity, 
  Cpu, 
  Zap, 
  ShieldCheck, 
  Play, 
  RotateCcw, 
  RefreshCw,
  Sliders,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AdaptiveEngineProps {
  onNavigate?: (route: RouteType) => void;
  onOpenAuth?: (mode?: 'signin' | 'signup') => void;
  onSignOut?: () => void;
  currentUser?: { name: string; role: string; institution?: string } | null;
  hideNav?: boolean;
}

export const AdaptiveEngine: React.FC<AdaptiveEngineProps> = ({ 
  onNavigate,
  onOpenAuth,
  onSignOut,
  currentUser,
  hideNav = false
}) => {
  // Live Genetic Algorithm Simulation State
  const [isRunningSim, setIsRunningSim] = useState(false);
  const [generation, setGeneration] = useState(142);
  const [fitnessScore, setFitnessScore] = useState(99.88);
  const [activeChromosomes, setActiveChromosomes] = useState(4120);
  const [mutationRate, setMutationRate] = useState(0.04);
  const [crossoverRate, setCrossoverRate] = useState(0.85);

  // Live Conflict Test Bench
  const [conflictScenario, setConflictScenario] = useState<'none' | 'prof_overlap' | 'room_surge' | 'lab_hazard'>('none');
  const [resolvingConflict, setResolvingConflict] = useState(false);
  const [resolutionLog, setResolutionLog] = useState<string[]>([]);

  // Simulation generation tick
  useEffect(() => {
    let interval: any;
    if (isRunningSim) {
      interval = setInterval(() => {
        setGeneration(prev => prev + 1);
        setActiveChromosomes(prev => Math.floor(4000 + Math.random() * 250));
        setFitnessScore(prev => {
          const next = prev + (Math.random() * 0.04 - 0.015);
          return Math.min(99.99, Math.max(97.5, Number(next.toFixed(2))));
        });
      }, 350);
    }
    return () => clearInterval(interval);
  }, [isRunningSim]);

  const handleResolveConflict = (type: 'prof_overlap' | 'room_surge' | 'lab_hazard') => {
    setConflictScenario(type);
    setResolvingConflict(true);
    setResolutionLog([
      `[0.00ms] Injected: ${type.toUpperCase()} into constraint pipeline`,
      `[0.12ms] Hard collision detected in sub-matrix D-4`,
      `[0.45ms] Evaluating 1,280 adjacent chromosome permutations...`
    ]);

    setTimeout(() => {
      setResolutionLog(prev => [
        ...prev,
        `[0.88ms] Found Pareto-optimal slot swap: Hall B3 -> Annex 102`,
        `[1.14ms] Validated zero cascade violations across 18 enrolled cohorts`,
        `[1.32ms] Equilibrium restored: 100% collision-free guarantee reinstated.`
      ]);
      setResolvingConflict(false);
    }, 700);
  };

  const resetConflict = () => {
    setConflictScenario('none');
    setResolutionLog([]);
  };

  return (
    <div className="min-h-screen bg-app text-primary antialiased">
      {!hideNav && (
        <SmartGridNav 
          activeRoute="adaptive-engine" 
          onNavigate={onNavigate} 
          onOpenAuth={onOpenAuth}
          onSignOut={onSignOut}
          currentUser={currentUser}
        />
      )}

      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Page Title & Subtitle */}
        <div className="pb-4 border-b border-border">
          <h1 className="text-2xl sm:text-[30px] font-semibold text-primary tracking-tight">Optimization</h1>
          <p className="text-[15px] text-secondary mt-1">
            Polynomial constraint satisfaction engine and convergence architecture
          </p>
        </div>

        {/* 4-Stage Pipeline Flow in ONE Bordered Container */}
        <section className="bg-surface border border-border rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-primary">Constraint propagation flow</h2>
              <p className="text-[13px] text-secondary mt-0.5">Four-stage heuristic and deterministic constraint resolution</p>
            </div>
            <span className="text-[13px] font-mono text-success flex items-center gap-2 font-medium">
              <ShieldCheck className="w-4 h-4" />
              <span>PARITY_ACTIVE</span>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-border">
            <div className="p-5 sm:p-6 space-y-2">
              <div className="text-[14px] font-mono font-medium text-brand">01</div>
              <h3 className="text-[15px] font-semibold text-primary">Hard SAT boundaries</h3>
              <p className="text-[14px] text-secondary leading-relaxed">
                Zero-tolerance bounding: instructor non-overlap, room physical occupancy caps, and required lab equipment.
              </p>
              <div className="text-[13px] font-mono text-secondary pt-1">Zero-tolerance pass</div>
            </div>

            <div className="p-5 sm:p-6 space-y-2">
              <div className="text-[14px] font-mono font-medium text-brand">02</div>
              <h3 className="text-[15px] font-semibold text-primary">Circadian chrono-map</h3>
              <p className="text-[14px] text-secondary leading-relaxed">
                Weighting cognitive load curves against cohort chronotypes and transit buffer steps to prevent early rush fatigue.
              </p>
              <div className="text-[13px] font-mono text-secondary pt-1">Weighted Pareto cost</div>
            </div>

            <div className="p-5 sm:p-6 space-y-2">
              <div className="text-[14px] font-mono font-medium text-brand">03</div>
              <h3 className="text-[15px] font-semibold text-primary">Genetic permutations</h3>
              <p className="text-[14px] text-secondary leading-relaxed">
                Multi-threaded chromosome crossover and adaptive mutations converging across 4,000+ candidate semester models.
              </p>
              <div className="text-[13px] font-mono text-secondary pt-1">1.24ms convergence</div>
            </div>

            <div className="p-5 sm:p-6 space-y-2">
              <div className="text-[14px] font-mono font-medium text-brand">04</div>
              <h3 className="text-[15px] font-semibold text-primary">Equilibrium matrix</h3>
              <p className="text-[14px] text-secondary leading-relaxed">
                Final master timetable lock, room thermal heating conservation pass, and instant iCal / SIS synchronization.
              </p>
              <div className="text-[13px] font-mono text-success font-medium pt-1">Deployed</div>
            </div>
          </div>
        </section>

        {/* 2-Column: Live Solver Sandbox & Fault Arbitration */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Genetic Algorithm Sandbox */}
          <section className="lg:col-span-7 bg-surface border border-border rounded-lg p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h3 className="text-base font-semibold text-primary">Genetic convergence simulator</h3>
                <p className="text-[13px] text-secondary mt-0.5">Simulate live generational epochs and fitness quotient</p>
              </div>
              <button 
                onClick={() => setIsRunningSim(!isRunningSim)}
                className={`h-[38px] px-3.5 rounded-md text-[14px] font-medium transition-colors shadow-xs flex items-center gap-2 cursor-pointer ${
                  isRunningSim 
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                    : 'bg-brand hover:bg-brand-hover text-white'
                }`}
              >
                {isRunningSim ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Simulating...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white" />
                    <span>Run simulation</span>
                  </>
                )}
              </button>
            </div>

            {/* Telemetry Stat Strip */}
            <div className="grid grid-cols-3 divide-x divide-border border border-border rounded-lg bg-surface text-center">
              <div className="p-4">
                <div className="text-[32px] font-semibold font-mono tracking-tight text-primary tabular-nums">{generation}</div>
                <div className="text-[13px] text-secondary mt-0.5">Generation epoch</div>
              </div>
              <div className="p-4">
                <div className="text-[32px] font-semibold font-mono tracking-tight text-success tabular-nums">{fitnessScore}%</div>
                <div className="text-[13px] text-secondary mt-0.5">Fitness quotient</div>
              </div>
              <div className="p-4">
                <div className="text-[32px] font-semibold font-mono tracking-tight text-primary tabular-nums">{activeChromosomes}</div>
                <div className="text-[13px] text-secondary mt-0.5">Candidate pool</div>
              </div>
            </div>

            {/* Convergence Chart */}
            <div className="space-y-2">
              <div className="flex justify-between text-[14px]">
                <span className="font-medium text-primary">Pareto convergence history</span>
                <span className="font-mono text-[13px] text-success font-medium">Δ 0.00012 ε</span>
              </div>
              <div className="h-24 bg-subtle border border-border rounded-md p-2.5 flex items-end gap-1.5 overflow-hidden">
                {[68, 72, 75, 78, 82, 85, 87, 90, 91, 93, 94, 96, 97, 98, 98.4, 99.1, 99.4, 99.8, fitnessScore].map((val, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full">
                    <div 
                      className={`w-full rounded-xs transition-all duration-200 ${
                        idx === 18 ? 'bg-brand' : 'bg-slate-300 dark:bg-slate-600'
                      }`}
                      style={{ height: `${(val / 100) * 100}%` }}
                      title={`Epoch ${generation - (18 - idx)}: ${val}%`}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-[13px] font-mono text-secondary">
                <span>Seed (T-0)</span>
                <span>Epoch {generation} (Current optimal)</span>
              </div>
            </div>

            {/* Parameters */}
            <div className="space-y-4 pt-2 border-t border-border">
              <div className="space-y-2">
                <div className="flex justify-between text-[14px]">
                  <span className="text-primary font-medium">Mutation probability:</span>
                  <span className="font-mono text-primary font-medium">{(mutationRate * 100).toFixed(1)}%</span>
                </div>
                <input 
                  type="range" 
                  min="1" 
                  max="15" 
                  value={mutationRate * 100}
                  onChange={e => setMutationRate(Number(e.target.value) / 100)}
                  className="w-full h-2 cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-[14px]">
                  <span className="text-primary font-medium">Crossover uniformity (blend alpha):</span>
                  <span className="font-mono text-primary font-medium">{(crossoverRate * 100).toFixed(0)}%</span>
                </div>
                <input 
                  type="range" 
                  min="50" 
                  max="98" 
                  value={crossoverRate * 100}
                  onChange={e => setCrossoverRate(Number(e.target.value) / 100)}
                  className="w-full h-2 cursor-pointer"
                />
              </div>
            </div>
          </section>

          {/* Conflict Arbitration Test Bench */}
          <section className="lg:col-span-5 bg-surface border border-border rounded-lg p-6 space-y-5">
            <div className="border-b border-border pb-4">
              <h3 className="text-base font-semibold text-primary">Conflict arbitration test bench</h3>
              <p className="text-[13px] text-secondary mt-0.5">
                Inject scheduling collisions to verify automatic sub-second resolution
              </p>
            </div>

            <div className="space-y-2.5">
              <button 
                onClick={() => handleResolveConflict('prof_overlap')}
                disabled={resolvingConflict}
                className="w-full text-left p-3.5 rounded-md border border-border hover:bg-subtle transition-colors flex items-center justify-between cursor-pointer group text-[14px]"
              >
                <div>
                  <div className="font-medium text-primary group-hover:text-brand">
                    Inject: Faculty double-book
                  </div>
                  <div className="text-[13px] text-secondary mt-0.5">
                    Force 2 conflicting sections into same instructor slot
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-secondary group-hover:text-primary shrink-0" />
              </button>

              <button 
                onClick={() => handleResolveConflict('room_surge')}
                disabled={resolvingConflict}
                className="w-full text-left p-3.5 rounded-md border border-border hover:bg-subtle transition-colors flex items-center justify-between cursor-pointer group text-[14px]"
              >
                <div>
                  <div className="font-medium text-primary group-hover:text-brand">
                    Inject: Facility surge (overcapacity)
                  </div>
                  <div className="text-[13px] text-secondary mt-0.5">
                    Exceed Hall B3 seating cap by 34 students
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-secondary group-hover:text-primary shrink-0" />
              </button>

              <button 
                onClick={() => handleResolveConflict('lab_hazard')}
                disabled={resolvingConflict}
                className="w-full text-left p-3.5 rounded-md border border-border hover:bg-subtle transition-colors flex items-center justify-between cursor-pointer group text-[14px]"
              >
                <div>
                  <div className="font-medium text-primary group-hover:text-brand">
                    Inject: Cleanroom emergency shutdown
                  </div>
                  <div className="text-[13px] text-secondary mt-0.5">
                    Simulate unexpected 48-hour lab maintenance
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-secondary group-hover:text-primary shrink-0" />
              </button>
            </div>

            {/* Arbitration Terminal Log */}
            {resolutionLog.length > 0 && (
              <div className="space-y-2.5 pt-2 border-t border-border">
                <div className="flex items-center justify-between text-[13px] text-secondary">
                  <span>Solver telemetry trace</span>
                  <button 
                    onClick={resetConflict}
                    className="hover:underline cursor-pointer font-medium"
                  >
                    Clear trace
                  </button>
                </div>
                <div className="bg-subtle rounded-md p-3.5 font-mono text-[13px] text-primary space-y-1.5 border border-border max-h-44 overflow-y-auto leading-relaxed">
                  {resolutionLog.map((log, i) => (
                    <div key={i}>
                      {log}
                    </div>
                  ))}
                  {resolvingConflict && (
                    <div className="text-secondary animate-pulse">
                      &gt; Computing Pareto swap...
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
