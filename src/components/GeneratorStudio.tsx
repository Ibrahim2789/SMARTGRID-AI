import React, { useState } from 'react';
import { SmartGridNav, RouteType } from './SmartGridNav';
import { Play, RotateCcw, Sliders, Cpu, CheckCircle, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';

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

  const handleRun = () => {
    setIsSolving(true);
    setTimeout(() => {
      setIsSolving(false);
      setSolved(true);
      confetti({
        particleCount: 75,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#f27438', '#ff6b35', '#3b1e4a', '#18794e', '#fbbf24']
      });
      setTimeout(() => setSolved(false), 4500);
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
        {/* Step Tracker & Header (Atmospheric Terracotta / Plum Wash) */}
        <section className="text-center space-y-3 p-8 bg-gradient-to-br from-[#fff7f2] via-white to-[#faf4fc] border border-[#ece6ed] rounded-xl shadow-sm">
          <div className="text-[11px] font-mono uppercase tracking-widest text-[#9c4126] font-bold">
            Generator Studio // Step 02 of 04
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1f1b20]">
            Multi-Objective Combinatorial Optimization
          </h1>
          <p className="text-xs text-[#655d69] max-w-lg mx-auto leading-relaxed">
            Fine-tune the mathematical scalar weights passed into the university timetable solver matrix.
          </p>
        </section>

        {/* Multi-Objective Constraint Scalars Card - Neutral Border with Atmospheric Wash */}
        <section className="bg-white border border-[#ece6ed] rounded-xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-[#ece6ed] pb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[#1f1b20] flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#9c4126] to-[#f27438] text-white flex items-center justify-center shadow-xs">
                <Sliders className="w-4 h-4" />
              </div>
              Constraint Scalar Multipliers
            </span>
            <span className="text-[11px] font-mono text-[#7c747f] bg-[#fbf8fc] px-2 py-0.5 rounded">NORM_RANGE: [0.0 - 1.0]</span>
          </div>

          {/* Slider 1 */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-[#fff7f2] via-white to-[#fff0eb] border border-[#ece6ed] space-y-2">
            <div className="flex justify-between text-xs font-semibold text-[#1f1b20]">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#9c4126]" />
                Commuter Transit Buffer Importance
              </span>
              <span className="font-mono text-[#9c4126] font-bold bg-white px-2 py-0.5 rounded shadow-xs">{transitWeight / 100}</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={transitWeight}
              onChange={e => setTransitWeight(Number(e.target.value))}
              className="w-full h-2 bg-[#ece6ed] rounded-lg appearance-none cursor-pointer accent-[#9c4126]"
            />
          </div>

          {/* Slider 2 */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-[#faf4fc] via-white to-[#f4eaf7] border border-[#ece6ed] space-y-2">
            <div className="flex justify-between text-xs font-semibold text-[#1f1b20]">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#3b1e4a]" />
                Circadian Energy & Wake Window Weighting
              </span>
              <span className="font-mono text-[#3b1e4a] font-bold bg-white px-2 py-0.5 rounded shadow-xs">{circadianWeight / 100}</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={circadianWeight}
              onChange={e => setCircadianWeight(Number(e.target.value))}
              className="w-full h-2 bg-[#ece6ed] rounded-lg appearance-none cursor-pointer accent-[#3b1e4a]"
            />
          </div>

          {/* Slider 3 */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-[#f1fbf5] via-white to-[#e8f7ee] border border-[#ece6ed] space-y-2">
            <div className="flex justify-between text-xs font-semibold text-[#1f1b20]">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#18794e]" />
                Room Compaction & Facility Conservation
              </span>
              <span className="font-mono text-[#18794e] font-bold bg-white px-2 py-0.5 rounded shadow-xs">{roomCompaction / 100}</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={roomCompaction}
              onChange={e => setRoomCompaction(Number(e.target.value))}
              className="w-full h-2 bg-[#ece6ed] rounded-lg appearance-none cursor-pointer accent-[#18794e]"
            />
          </div>
        </section>

        {/* Solver Telemetry Card - Neutral Borders & Atmospheric Tonal Gradient Washes */}
        <section className="bg-white border border-[#ece6ed] rounded-xl p-6 sm:p-8 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-[#ece6ed] pb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[#1f1b20] flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#3b1e4a] to-[#7209b7] text-white flex items-center justify-center shadow-xs">
                <Cpu className="w-4 h-4" />
              </div>
              Real-Time Engine Telemetry
            </span>
            <span className="text-[11px] font-mono text-[#18794e] bg-[#eaf8f0] px-2 py-0.5 rounded font-semibold">PARITY_OK</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            {/* Metric 1 */}
            <div className="p-4 bg-gradient-to-br from-[#faf4fc] via-white to-[#f4eaf7] rounded-xl border border-[#ece6ed] hover:border-[#dcd9dd] shadow-xs transition-colors">
              <div className="text-2xl font-black font-mono text-[#3b1e4a]">4,120</div>
              <div className="text-[10px] font-mono uppercase text-[#7209b7] mt-1 font-semibold">Active Chromosomes</div>
            </div>
            {/* Metric 2 */}
            <div className="p-4 bg-gradient-to-br from-[#fff7f2] via-white to-[#fff0eb] rounded-xl border border-[#ece6ed] hover:border-[#dcd9dd] shadow-xs transition-colors">
              <div className="text-2xl font-black font-mono text-[#9c4126]">1.24 ms</div>
              <div className="text-[10px] font-mono uppercase text-[#9c4126] mt-1 font-semibold">Convergence Time</div>
            </div>
            {/* Metric 3 */}
            <div className="p-4 bg-gradient-to-br from-[#f1fbf5] via-white to-[#e8f7ee] rounded-xl border border-[#ece6ed] hover:border-[#dcd9dd] shadow-xs transition-colors">
              <div className="text-2xl font-black font-mono text-[#18794e]">99.88%</div>
              <div className="text-[10px] font-mono uppercase text-[#18794e] mt-1 font-semibold">Pareto Optimality</div>
            </div>
          </div>
        </section>

        {/* Execution Triggers */}
        <section className="flex items-center justify-end gap-4">
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
            className="flex items-center gap-2 bg-gradient-to-r from-[#9c4126] to-[#f27438] hover:from-[#83341d] hover:to-[#ea580c] text-white px-7 py-3 rounded-xl text-xs font-bold uppercase tracking-wider shadow-md transition-all active:scale-95 disabled:opacity-75 cursor-pointer"
          >
            {isSolving ? (
              <>Solving Combinatorics...</>
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
