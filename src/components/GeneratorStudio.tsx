import React, { useState } from 'react';
import { SmartGridNav, RouteType } from './SmartGridNav';
import { Play, RotateCcw, Sliders, Cpu, CheckCircle, Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react';
import confetti from 'canvas-confetti';
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

  const handleRun = () => {
    setIsSolving(true);
    setProgress(0);

    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(interval);
          return 100;
        }
        return p + 20;
      });
    }, 200);

    setTimeout(() => {
      clearInterval(interval);
      setIsSolving(false);
      setSolved(true);
      confetti({
        particleCount: 90,
        spread: 85,
        origin: { y: 0.6 },
        colors: ['#f27438', '#9c4126', '#3b1e4a', '#18794e', '#fbbf24']
      });
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-[#fbf8fc] text-[#1f1b20] font-sans antialiased">
      {!hideNav && (
        <SmartGridNav 
          activeRoute="generator" 
          onNavigate={onNavigate} 
          onOpenAuth={onOpenAuth}
          onSignOut={onSignOut}
          currentUser={currentUser}
        />
      )}

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Step Tracker & Header */}
        <section className="text-center space-y-3 p-8 bg-gradient-to-br from-[#fff7f2] via-white to-[#faf4fc] border border-[#ece6ed] rounded-2xl shadow-sm relative overflow-hidden">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#ece6ed] text-[10px] font-mono font-bold uppercase tracking-wider text-[#9c4126] shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-[#9c4126]" />
            Generator Studio // Step 02 of 04
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#1f1b20] tracking-tight">
            Multi-Objective Combinatorial Optimization
          </h1>
          <p className="text-xs text-[#655d69] max-w-lg mx-auto leading-relaxed">
            Fine-tune the mathematical scalar weights passed into the university timetable solver matrix.
          </p>
        </section>

        {/* Multi-Objective Constraint Scalars Card */}
        <section className="bg-white border border-[#ece6ed] rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-[#ece6ed] pb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[#1f1b20] flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#9c4126] to-[#f27438] text-white flex items-center justify-center shadow-xs">
                <Sliders className="w-4 h-4" />
              </div>
              Constraint Scalar Multipliers
            </span>
            <span className="text-[11px] font-mono text-[#7c747f] bg-[#fbf8fc] px-2.5 py-1 rounded-lg border border-[#ece6ed] font-semibold">
              NORM_RANGE: [0.0 - 1.0]
            </span>
          </div>

          {/* Slider 1 */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-[#fff7f2] via-white to-[#fff0eb] border border-[#ece6ed] space-y-2 card-lift">
            <div className="flex justify-between text-xs font-bold text-[#1f1b20]">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#9c4126]" />
                Commuter Transit Buffer Importance
              </span>
              <span className="font-mono text-[#9c4126] font-bold bg-white px-2 py-0.5 rounded shadow-xs border border-[#ece6ed]">
                {(transitWeight / 100).toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={transitWeight}
              onChange={e => setTransitWeight(Number(e.target.value))}
              className="w-full h-1.5"
            />
          </div>

          {/* Slider 2 */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-[#faf4fc] via-white to-[#f4eaf7] border border-[#ece6ed] space-y-2 card-lift">
            <div className="flex justify-between text-xs font-bold text-[#1f1b20]">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#3b1e4a]" />
                Circadian Energy & Wake Window Weighting
              </span>
              <span className="font-mono text-[#3b1e4a] font-bold bg-white px-2 py-0.5 rounded shadow-xs border border-[#ece6ed]">
                {(circadianWeight / 100).toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={circadianWeight}
              onChange={e => setCircadianWeight(Number(e.target.value))}
              className="w-full h-1.5"
            />
          </div>

          {/* Slider 3 */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-[#f1fbf5] via-white to-[#e8f7ee] border border-[#ece6ed] space-y-2 card-lift">
            <div className="flex justify-between text-xs font-bold text-[#1f1b20]">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#18794e]" />
                Room Compaction & Facility Conservation
              </span>
              <span className="font-mono text-[#18794e] font-bold bg-white px-2 py-0.5 rounded shadow-xs border border-[#ece6ed]">
                {(roomCompaction / 100).toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={roomCompaction}
              onChange={e => setRoomCompaction(Number(e.target.value))}
              className="w-full h-1.5"
            />
          </div>
        </section>

        {/* Real-Time Engine Telemetry */}
        <section className="bg-white border border-[#ece6ed] rounded-2xl p-6 sm:p-8 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-[#ece6ed] pb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[#1f1b20] flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#3b1e4a] to-[#7209b7] text-white flex items-center justify-center shadow-xs">
                <Cpu className="w-4 h-4" />
              </div>
              Real-Time Engine Telemetry
            </span>
            <span className="text-[11px] font-mono text-[#18794e] bg-[#eaf8f0] px-2.5 py-1 rounded-lg font-bold border border-[#ece6ed] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#18794e] animate-pulse" />
              PARITY_OK
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div className="p-4 bg-gradient-to-br from-[#faf4fc] via-white to-[#f4eaf7] rounded-xl border border-[#ece6ed] shadow-xs card-lift">
              <div className="text-2xl font-black font-mono text-[#3b1e4a]">4,120</div>
              <div className="text-[10px] font-mono uppercase text-[#7209b7] mt-1 font-bold">Active Chromosomes</div>
            </div>
            <div className="p-4 bg-gradient-to-br from-[#fff7f2] via-white to-[#fff0eb] rounded-xl border border-[#ece6ed] shadow-xs card-lift">
              <div className="text-2xl font-black font-mono text-[#9c4126]">1.24 ms</div>
              <div className="text-[10px] font-mono uppercase text-[#9c4126] mt-1 font-bold">Convergence Time</div>
            </div>
            <div className="p-4 bg-gradient-to-br from-[#f1fbf5] via-white to-[#e8f7ee] rounded-xl border border-[#ece6ed] shadow-xs card-lift">
              <div className="text-2xl font-black font-mono text-[#18794e]">99.88%</div>
              <div className="text-[10px] font-mono uppercase text-[#18794e] mt-1 font-bold">Pareto Optimality</div>
            </div>
          </div>

          {/* Progress bar when solving */}
          {isSolving && (
            <div className="pt-2 space-y-1.5">
              <div className="flex justify-between text-xs font-mono text-[#655d69]">
                <span>Resolving SAT constraints...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-[#ece6ed] h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-[#9c4126] via-[#f27438] to-[#18794e] h-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </section>

        {/* Success Banner */}
        <AnimatePresence>
          {solved && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="p-5 bg-gradient-to-r from-[#eefcf2] via-white to-[#f0fbf4] border border-[#18794e]/30 rounded-2xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-[#18794e] shrink-0" />
                <div>
                  <div className="text-xs font-bold text-[#0f5431]">
                    Equilibrium Solved! 0 Collisions Found
                  </div>
                  <div className="text-[11px] text-[#3c6b4e]">
                    1,420 sections allocated with 99.88% Pareto balance. Ready for inspection.
                  </div>
                </div>
              </div>
              <button
                onClick={() => onNavigate?.('timetable')}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#18794e] hover:bg-[#13613e] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-xs cursor-pointer whitespace-nowrap"
              >
                <span>View Timetable Matrix</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Execution Triggers */}
        <section className="flex items-center justify-end gap-3.5">
          <button
            onClick={() => { setTransitWeight(85); setCircadianWeight(90); setRoomCompaction(70); }}
            className="flex items-center gap-2 px-5 py-3 rounded-xl border border-[#ece6ed] hover:border-[#dcd9dd] text-[#3b1e4a] text-xs font-bold uppercase tracking-wider hover:bg-[#f6f2f7] transition-all cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            Reset Defaults
          </button>
          <button
            onClick={handleRun}
            disabled={isSolving}
            className="flex items-center gap-2 bg-gradient-to-r from-[#9c4126] to-[#b3401f] hover:from-[#83341d] hover:to-[#9c4126] text-white px-7 py-3 rounded-xl text-xs font-bold uppercase tracking-wider shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-75 cursor-pointer"
          >
            {isSolving ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Solving Combinatorics...
              </span>
            ) : solved ? (
              <>
                <CheckCircle className="w-4 h-4 text-[#fed8c8]" />
                Optimal Matrix Locked!
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                Dispatch Solver Matrix
              </>
            )}
          </button>
        </section>
      </main>
    </div>
  );
};
