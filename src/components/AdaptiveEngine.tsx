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
    let interval: NodeJS.Timeout;
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
      `[0.12ms] Flagged: Hard collision detected in sub-matrix D-4`,
      `[0.45ms] Evaluating 1,280 adjacent chromosome permutations...`
    ]);

    setTimeout(() => {
      setResolutionLog(prev => [
        ...prev,
        `[0.88ms] Found Pareto-optimal slot swap: Hall B3 -> Annex 102`,
        `[1.14ms] Validated zero cascade violations across 18 enrolled students`,
        `[1.32ms] EQUILIBRIUM_RESTORED: 100% collision-free guarantee reinstated.`
      ]);
      setResolvingConflict(false);
    }, 900);
  };

  const resetConflict = () => {
    setConflictScenario('none');
    setResolutionLog([]);
  };

  return (
    <div className="min-h-screen bg-[#fbf8fc] text-[#1f1b20] font-sans antialiased">
      {!hideNav && (
        <SmartGridNav 
          activeRoute="adaptive-engine" 
          onNavigate={onNavigate} 
          onOpenAuth={onOpenAuth}
          onSignOut={onSignOut}
          currentUser={currentUser}
        />
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
        {/* Header Hero with Atmospheric Terracotta/Plum Wash */}
        <section className="p-8 bg-gradient-to-br from-[#fff7f2] via-white to-[#faf4fc] border border-[#ece6ed] rounded-xl shadow-sm space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#f6f2f7] text-[11px] font-mono font-semibold text-[#9c4126] uppercase tracking-wider">
            <Cpu className="w-3.5 h-3.5 text-[#f27438]" />
            Deterministic Solver Core • Mathematical Architecture
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#1f1b20] tracking-tight leading-tight">
            High-Order Polynomial Constraint Satisfaction Engine
          </h1>
          <p className="text-xs sm:text-sm text-[#655d69] leading-relaxed max-w-3xl">
            SmartGrid AI replaces heuristic trial-and-error with a hybrid deterministic SAT-solver and genetic algorithm. It evaluates trillions of timetable permutations across campus buildings, student commute graphs, and faculty contracts in under two seconds.
          </p>
        </section>

        {/* Live System Architecture Diagram & Pipeline - Strictly Neutral Card Borders with Rich Atmospheric Fills */}
        <section className="bg-white border border-[#ece6ed] rounded-xl p-6 lg:p-8 shadow-sm space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#ece6ed] pb-4">
            <div>
              <span className="text-[11px] font-mono uppercase tracking-widest text-[#9c4126] font-bold">End-to-End Pipeline</span>
              <h2 className="text-xl font-bold text-[#1f1b20] mt-0.5">Constraint Propagation Flow</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#eefcf2] text-xs font-mono font-bold text-[#18794e]">
                <ShieldCheck className="w-3.5 h-3.5 text-[#18794e]" />
                DETERMINISTIC_PARITY_ACTIVE
              </span>
            </div>
          </div>

          {/* 4-Stage Flow Pipeline with Atmospheric Washes & Neutral Borders */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Stage 1: Lavender Plum */}
            <div className="bg-gradient-to-br from-[#faf4fc] via-white to-[#f4eaf7] border border-[#ece6ed] hover:border-[#dcd9dd] rounded-xl p-6 space-y-3 transition-all duration-300 shadow-xs hover:shadow-md">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#3b1e4a] to-[#7209b7] text-white flex items-center justify-center font-mono text-xs font-bold shadow-xs">
                01
              </div>
              <h3 className="text-base font-bold text-[#1f1b20]">Hard SAT Boundaries</h3>
              <p className="text-xs text-[#655d69] leading-relaxed">
                Zero-tolerance bounding: Instructor non-overlap, room physical occupancy caps, laboratory specialized equipment prerequisites.
              </p>
              <div className="text-xs font-mono text-[#7209b7] font-bold bg-[#f4ecf8] px-2.5 py-1 rounded w-fit">Zero-Tolerance Pass</div>
            </div>

            {/* Stage 2: Peach Terracotta */}
            <div className="bg-gradient-to-br from-[#fff7f2] via-white to-[#fff0eb] border border-[#ece6ed] hover:border-[#dcd9dd] rounded-xl p-6 space-y-3 transition-all duration-300 shadow-xs hover:shadow-md">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#f27438] to-[#ea580c] text-white flex items-center justify-center font-mono text-xs font-bold shadow-xs">
                02
              </div>
              <h3 className="text-base font-bold text-[#1f1b20]">Circadian Chrono-Map</h3>
              <p className="text-xs text-[#655d69] leading-relaxed">
                Weighting cognitive load curves against cohort chronotypes and transit buffer steps to prevent 8:00 AM rush hour exhaustion.
              </p>
              <div className="text-xs font-mono text-[#ea580c] font-bold bg-[#fff7ed] px-2.5 py-1 rounded w-fit">Weighted Pareto Cost</div>
            </div>

            {/* Stage 3: Warm Ember */}
            <div className="bg-gradient-to-br from-[#fff5f0] via-white to-[#ffede5] border border-[#ece6ed] hover:border-[#dcd9dd] rounded-xl p-6 space-y-3 transition-all duration-300 shadow-xs hover:shadow-md">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#9c4126] to-[#c84c16] text-white flex items-center justify-center font-mono text-xs font-bold shadow-xs">
                03
              </div>
              <h3 className="text-base font-bold text-[#1f1b20]">Genetic Permutations</h3>
              <p className="text-xs text-[#655d69] leading-relaxed">
                Multi-threaded chromosome crossover and adaptive mutations converging across 4,000+ candidate semester representations.
              </p>
              <div className="text-xs font-mono text-[#9c4126] font-bold bg-[#ffebe2] px-2.5 py-1 rounded w-fit">1.24ms Convergence</div>
            </div>

            {/* Stage 4: Fresh Sage Mint */}
            <div className="bg-gradient-to-br from-[#f1fbf5] via-white to-[#e8f7ee] border border-[#ece6ed] hover:border-[#dcd9dd] rounded-xl p-6 space-y-3 transition-all duration-300 shadow-xs hover:shadow-md">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#18794e] to-[#25a26c] text-white flex items-center justify-center font-mono text-xs font-bold shadow-xs">
                04
              </div>
              <h3 className="text-base font-bold text-[#1f1b20]">Equilibrium Matrix</h3>
              <p className="text-xs text-[#655d69] leading-relaxed">
                Final master timetable lock, room thermal heating conservation pass, and instant iCal / SIS SIS sync.
              </p>
              <div className="text-xs font-mono text-[#18794e] font-bold bg-[#e6f9ed] px-2.5 py-1 rounded w-fit">Ready for Deployment</div>
            </div>
          </div>
        </section>

        {/* Live Genetic Solver Sandbox */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 bg-white border border-[#ece6ed] rounded-xl p-6 lg:p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-[#ece6ed] pb-3">
              <div>
                <span className="text-[11px] font-mono uppercase tracking-widest text-[#9c4126] font-bold">Interactive Sandbox</span>
                <h3 className="text-base font-bold text-[#1f1b20] mt-0.5">Genetic Algorithm Convergence Simulator</h3>
              </div>
              <button 
                onClick={() => setIsRunningSim(!isRunningSim)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm cursor-pointer ${
                  isRunningSim 
                    ? 'bg-gradient-to-r from-[#18794e] to-[#25a26c] text-white' 
                    : 'bg-gradient-to-r from-[#9c4126] to-[#f27438] text-white'
                }`}
              >
                {isRunningSim ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                    Simulating...
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-white" />
                    Start Convergence
                  </>
                )}
              </button>
            </div>

            {/* Telemetry Metric Cards with Atmospheric Washes & Neutral Borders */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-gradient-to-br from-[#faf4fc] via-white to-[#f4eaf7] rounded-xl border border-[#ece6ed] hover:border-[#dcd9dd] text-center shadow-xs">
                <div className="text-2xl font-black font-mono text-[#3b1e4a]">{generation}</div>
                <div className="text-[10px] font-mono uppercase text-[#7209b7] mt-1 font-semibold">Generation Epoch</div>
              </div>
              <div className="p-4 bg-gradient-to-br from-[#f1fbf5] via-white to-[#e8f7ee] rounded-xl border border-[#ece6ed] hover:border-[#dcd9dd] text-center shadow-xs">
                <div className="text-2xl font-black font-mono text-[#18794e]">{fitnessScore}%</div>
                <div className="text-[10px] font-mono uppercase text-[#18794e] mt-1 font-semibold">Fitness Quotient</div>
              </div>
              <div className="p-4 bg-gradient-to-br from-[#fff7f2] via-white to-[#fff0eb] rounded-xl border border-[#ece6ed] hover:border-[#dcd9dd] text-center shadow-xs">
                <div className="text-2xl font-black font-mono text-[#9c4126]">{activeChromosomes}</div>
                <div className="text-[10px] font-mono uppercase text-[#9c4126] mt-1 font-semibold">Candidate Pool</div>
              </div>
            </div>

            {/* Visual Convergence Waveform */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold text-[#1f1b20]">
                <span>Pareto Surface Convergence Curve</span>
                <span className="font-mono text-[#18794e] bg-[#eaf8f0] px-2 py-0.5 rounded font-bold">Delta: 0.00012 ε</span>
              </div>
              <div className="h-24 bg-gradient-to-b from-[#fdfbfd] to-[#fbf8fc] border border-[#ece6ed] rounded-xl p-3 flex items-end gap-1.5 overflow-hidden">
                {[68, 72, 75, 78, 82, 85, 87, 90, 91, 93, 94, 96, 97, 98, 98.4, 99.1, 99.4, 99.8, fitnessScore].map((val, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                    <div 
                      className={`w-full rounded-t-sm transition-all duration-300 ${
                        idx === 18 ? 'bg-gradient-to-t from-[#9c4126] to-[#f27438]' : 'bg-[#3b1e4a]/75 hover:bg-[#3b1e4a]'
                      }`}
                      style={{ height: `${(val / 100) * 100}%` }}
                      title={`Epoch ${generation - (18 - idx)}: ${val}%`}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-[10px] font-mono text-[#7c747f]">
                <span>Initial Seed (T-0)</span>
                <span>Epoch {generation} (Current Local Optimal)</span>
              </div>
            </div>

            {/* Slider Parameters */}
            <div className="space-y-3 pt-2">
              <div>
                <div className="flex justify-between text-xs font-semibold text-[#1f1b20] mb-1">
                  <span>Mutation Probability:</span>
                  <span className="font-mono text-[#9c4126] font-bold">{(mutationRate * 100).toFixed(1)}%</span>
                </div>
                <input 
                  type="range" 
                  min="1" 
                  max="15" 
                  value={mutationRate * 100}
                  onChange={e => setMutationRate(Number(e.target.value) / 100)}
                  className="w-full h-1.5 bg-[#ece6ed] rounded-lg appearance-none cursor-pointer accent-[#9c4126]"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-[#1f1b20] mb-1">
                  <span>Crossover Uniformity (Blend Alpha):</span>
                  <span className="font-mono text-[#9c4126] font-bold">{(crossoverRate * 100).toFixed(0)}%</span>
                </div>
                <input 
                  type="range" 
                  min="50" 
                  max="98" 
                  value={crossoverRate * 100}
                  onChange={e => setCrossoverRate(Number(e.target.value) / 100)}
                  className="w-full h-1.5 bg-[#ece6ed] rounded-lg appearance-none cursor-pointer accent-[#9c4126]"
                />
              </div>
            </div>
          </div>

          {/* Conflict Arbitration Test Bench - Neutral Card Border */}
          <div className="lg:col-span-5 bg-white border border-[#ece6ed] rounded-xl p-6 lg:p-8 shadow-sm space-y-6">
            <div className="border-b border-[#ece6ed] pb-3">
              <span className="text-[11px] font-mono uppercase tracking-widest text-[#9c4126] font-bold">Stress Test Bench</span>
              <h3 className="text-base font-bold text-[#1f1b20] mt-0.5">Real-Time Conflict Arbitration</h3>
              <p className="text-xs text-[#655d69] mt-1">
                Inject realistic campus scheduling faults and witness the deterministic auto-arbitration engine solve them.
              </p>
            </div>

            <div className="space-y-2.5">
              <button 
                onClick={() => handleResolveConflict('prof_overlap')}
                disabled={resolvingConflict}
                className="w-full text-left p-3.5 rounded-xl border border-[#ece6ed] hover:border-[#dcd9dd] bg-gradient-to-r from-white to-[#fffaf8] hover:bg-[#fff5f0] transition-all flex items-center justify-between group cursor-pointer"
              >
                <div>
                  <div className="text-xs font-bold text-[#1f1b20] group-hover:text-[#9c4126]">
                    Fault 01: Faculty Double-Book
                  </div>
                  <div className="text-[11px] text-[#7c747f]">
                    Dr. Evans assigned to Hall B3 and Lab 2 at 10:00 AM
                  </div>
                </div>
                <Zap className="w-4 h-4 text-[#9c4126] shrink-0" />
              </button>

              <button 
                onClick={() => handleResolveConflict('room_surge')}
                disabled={resolvingConflict}
                className="w-full text-left p-3.5 rounded-xl border border-[#ece6ed] hover:border-[#dcd9dd] bg-gradient-to-r from-white to-[#fffaf8] hover:bg-[#fff5f0] transition-all flex items-center justify-between group cursor-pointer"
              >
                <div>
                  <div className="text-xs font-bold text-[#1f1b20] group-hover:text-[#9c4126]">
                    Fault 02: Sudden Capacity Overflow
                  </div>
                  <div className="text-[11px] text-[#7c747f]">
                    Bio-Year1 enrolment exceeds Lab 4 fire safety by 18 seats
                  </div>
                </div>
                <Zap className="w-4 h-4 text-[#9c4126] shrink-0" />
              </button>

              <button 
                onClick={() => handleResolveConflict('lab_hazard')}
                disabled={resolvingConflict}
                className="w-full text-left p-3.5 rounded-xl border border-[#ece6ed] hover:border-[#dcd9dd] bg-gradient-to-r from-white to-[#fffaf8] hover:bg-[#fff5f0] transition-all flex items-center justify-between group cursor-pointer"
              >
                <div>
                  <div className="text-xs font-bold text-[#1f1b20] group-hover:text-[#9c4126]">
                    Fault 03: Transit Buffer Collapse
                  </div>
                  <div className="text-[11px] text-[#7c747f]">
                    Quad A to Chem Lab B walking time exceeds 10-minute margin
                  </div>
                </div>
                <Zap className="w-4 h-4 text-[#9c4126] shrink-0" />
              </button>
            </div>

            {/* Real-time Arbitration Terminal */}
            <div className="bg-[#1f1b20] text-[#fbf8fc] rounded-xl p-4 font-mono text-[11px] space-y-1.5 h-44 overflow-y-auto border border-[#3b1e4a]">
              <div className="text-[#f27438] font-bold pb-1 border-b border-[#3b1e4a]">
                // SMARTGRID_ARBITRATION_CONSOLE
              </div>
              {resolutionLog.length === 0 ? (
                <div className="text-[#7c747f] pt-4 text-center">
                  Select a fault scenario above to trigger the topological conflict propagator.
                </div>
              ) : (
                resolutionLog.map((log, i) => (
                  <div key={i} className={`${log.includes('EQUILIBRIUM') ? 'text-[#18794e] font-bold' : log.includes('Flagged') ? 'text-[#f27438]' : 'text-[#ece6ed]'}`}>
                    {log}
                  </div>
                ))
              )}
            </div>

            {conflictScenario !== 'none' && (
              <div className="flex justify-end">
                <button 
                  onClick={resetConflict}
                  className="text-xs font-bold uppercase tracking-wider text-[#9c4126] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Clear Test Bench
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Spatial & Thermal Campus Footprint Card - Atmospheric Washes & Neutral Borders */}
        <section className="bg-white border border-[#ece6ed] rounded-xl p-6 lg:p-8 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-mono uppercase tracking-widest text-[#9c4126] font-bold">Resource Optimization</span>
              <h2 className="text-xl sm:text-2xl font-bold text-[#1f1b20]">Campus Thermal & Spatial Compaction</h2>
              <p className="text-xs text-[#655d69] mt-0.5">
                The Adaptive Engine groups consecutive courses into unified building wings, allowing dormant structures to power down HVAC systems.
              </p>
            </div>
            <div className="text-left md:text-right">
              <div className="text-2xl font-black font-mono text-[#18794e]">-34.1 MWh</div>
              <div className="text-[10px] font-mono uppercase text-[#7c747f]">Weekly Energy Conserved</div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {/* Building 1: Mint */}
            <div className="p-4 rounded-xl border border-[#ece6ed] hover:border-[#dcd9dd] bg-gradient-to-br from-[#f1fbf5] via-white to-[#e8f7ee] shadow-xs">
              <div className="text-xs font-bold text-[#1f1b20]">Science Quad Wing C</div>
              <div className="text-[11px] text-[#7c747f] mt-1">Utilization: 96.4%</div>
              <div className="w-full bg-[#ece6ed] rounded-full h-1.5 mt-2 overflow-hidden">
                <div className="bg-[#18794e] h-1.5 rounded-full" style={{ width: '96.4%' }}></div>
              </div>
            </div>
            {/* Building 2: Sage */}
            <div className="p-4 rounded-xl border border-[#ece6ed] hover:border-[#dcd9dd] bg-gradient-to-br from-[#f1fbf5] via-white to-[#e8f7ee] shadow-xs">
              <div className="text-xs font-bold text-[#1f1b20]">Engineering Hall 1</div>
              <div className="text-[11px] text-[#7c747f] mt-1">Utilization: 92.1%</div>
              <div className="w-full bg-[#ece6ed] rounded-full h-1.5 mt-2 overflow-hidden">
                <div className="bg-[#18794e] h-1.5 rounded-full" style={{ width: '92.1%' }}></div>
              </div>
            </div>
            {/* Building 3: Peach */}
            <div className="p-4 rounded-xl border border-[#ece6ed] hover:border-[#dcd9dd] bg-gradient-to-br from-[#fff7f2] via-white to-[#fff0eb] shadow-xs">
              <div className="text-xs font-bold text-[#1f1b20]">Humanities Annex B</div>
              <div className="text-[11px] text-[#7c747f] mt-1">Dormant Mode: 14:00 - 18:00</div>
              <div className="w-full bg-[#ece6ed] rounded-full h-1.5 mt-2 overflow-hidden">
                <div className="bg-[#9c4126] h-1.5 rounded-full" style={{ width: '40%' }}></div>
              </div>
            </div>
            {/* Building 4: Plum */}
            <div className="p-4 rounded-xl border border-[#ece6ed] hover:border-[#dcd9dd] bg-gradient-to-br from-[#faf4fc] via-white to-[#f4eaf7] shadow-xs">
              <div className="text-xs font-bold text-[#1f1b20]">Biomedical Cleanroom Lab</div>
              <div className="text-[11px] text-[#7c747f] mt-1">Filtered Cycles Optimized</div>
              <div className="w-full bg-[#ece6ed] rounded-full h-1.5 mt-2 overflow-hidden">
                <div className="bg-[#3b1e4a] h-1.5 rounded-full" style={{ width: '88%' }}></div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};
