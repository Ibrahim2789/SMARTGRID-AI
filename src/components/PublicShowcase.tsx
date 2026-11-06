import React from 'react';
import { ArrowRight, CheckCircle2, ShieldCheck, Zap, Activity } from 'lucide-react';
import { SmartGridNav, RouteType } from './SmartGridNav';

interface PublicShowcaseProps {
  onNavigate?: (route: RouteType) => void;
  onOpenAuth?: (mode?: 'signin' | 'signup') => void;
  onSignOut?: () => void;
  currentUser?: { name: string; role: string; institution?: string } | null;
}

export const PublicShowcase: React.FC<PublicShowcaseProps> = ({ 
  onNavigate,
  onOpenAuth,
  onSignOut,
  currentUser 
}) => {
  return (
    <div className="min-h-screen bg-[#fbf8fc] text-[#1f1b20] font-sans antialiased">
      <SmartGridNav 
        activeRoute="solutions" 
        onNavigate={onNavigate} 
        onOpenAuth={onOpenAuth}
        onSignOut={onSignOut}
        currentUser={currentUser}
      />

      <main className="max-w-7xl mx-auto px-6 lg:px-8 py-14 space-y-24">
        {/* Centered, Clean Minimal Hero Section */}
        <section className="text-center max-w-3xl mx-auto space-y-6 pt-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#f6f2f7] border border-[#ece6ed] text-[11px] font-mono font-semibold text-[#9c4126] uppercase tracking-wider">
            <Activity className="w-3.5 h-3.5 text-[#f27438]" />
            Algorithmic Equilibrium v4.8 • Deterministic Solver
          </div>

          <h1 className="text-4xl lg:text-5xl font-black text-[#1f1b20] tracking-tight leading-[1.15]">
            Algorithmic Harmony for Higher Education. Student-Centric Timetables in Minutes.
          </h1>

          <p className="text-base text-[#655d69] leading-relaxed max-w-2xl mx-auto">
            SmartGrid AI harmonizes faculty availability, campus room limits, and real-time student commute preferences into rigorously verified, conflict-free semester schedules.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-3">
            <button 
              onClick={() => currentUser ? onNavigate?.('generator') : onOpenAuth?.('signup')}
              className="flex items-center gap-2 bg-[#9c4126] hover:bg-[#83341d] text-white px-7 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md active:scale-95"
            >
              <Zap className="w-4 h-4 text-[#fbbd9c]" />
              Experience Live Generation
            </button>
            <button 
              onClick={() => onNavigate?.('adaptive-engine')}
              className="flex items-center gap-2 bg-white hover:bg-[#f6f2f7] text-[#3b1e4a] border border-[#ece6ed] px-7 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm"
            >
              Explore Methodology
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>

        {/* Validation Strip */}
        <section className="border-y border-[#ece6ed] py-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="text-[11px] font-mono uppercase tracking-wider text-[#7c747f]">Oxford Union Validated</div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-[#7c747f]">FERPA & Title IV Compliant</div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-[#7c747f]">100% Deterministic Guarantee</div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-[#7c747f]">Multi-Tier Cohort Synthesis</div>
        </section>

        {/* The Three Architectural Pillars (Consistent White Container Cards) */}
        <section className="space-y-8">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-widest text-[#9c4126]">Architectural Core</span>
            <h2 className="text-2xl font-bold text-[#1f1b20] mt-1">Designed for Campus Equilibrium</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div 
              onClick={() => onNavigate?.('student-voice')}
              className="bg-white border border-[#ece6ed] rounded-xl p-8 shadow-sm space-y-4 hover:border-[#dcd9dd] transition-all cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-xl bg-[#f6f2f7] flex items-center justify-center text-[#3b1e4a] group-hover:scale-105 transition-transform">
                <Activity className="w-5 h-5 text-[#f27438]" />
              </div>
              <h3 className="text-base font-bold text-[#1f1b20] group-hover:text-[#9c4126] transition-colors">
                Student Preference Weighting
              </h3>
              <p className="text-xs text-[#655d69] leading-relaxed">
                Integrates cohort feedback, commute transit buffers, and circadian learning peaks directly into solver matrices to slash drop rates.
              </p>
              <div className="pt-2 text-xs font-mono font-bold text-[#18794e]">92.8% Matrix Alignment</div>
            </div>

            <div 
              onClick={() => onNavigate?.('adaptive-engine')}
              className="bg-white border border-[#ece6ed] rounded-xl p-8 shadow-sm space-y-4 hover:border-[#dcd9dd] transition-all cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-xl bg-[#f6f2f7] flex items-center justify-center text-[#3b1e4a] group-hover:scale-105 transition-transform">
                <ShieldCheck className="w-5 h-5 text-[#f27438]" />
              </div>
              <h3 className="text-base font-bold text-[#1f1b20] group-hover:text-[#9c4126] transition-colors">
                Real-Time Conflict Arbitration
              </h3>
              <p className="text-xs text-[#655d69] leading-relaxed">
                100% collision-free room, instructor, and lab allocation via high-order polynomial constraint satisfaction across departmental curriculums.
              </p>
              <div className="pt-2 text-xs font-mono font-bold text-[#18794e]">0 Active Hard Collisions</div>
            </div>

            <div 
              onClick={() => currentUser ? onNavigate?.('timetable') : onOpenAuth?.('signin')}
              className="bg-white border border-[#ece6ed] rounded-xl p-8 shadow-sm space-y-4 hover:border-[#dcd9dd] transition-all cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-xl bg-[#f6f2f7] flex items-center justify-center text-[#3b1e4a] group-hover:scale-105 transition-transform">
                <Zap className="w-5 h-5 text-[#f27438]" />
              </div>
              <h3 className="text-base font-bold text-[#1f1b20] group-hover:text-[#9c4126] transition-colors">
                Dynamic Campus Analytics
              </h3>
              <p className="text-xs text-[#655d69] leading-relaxed">
                Calculates spatial utilization density, heating and cooling across dormant halls, and transit delays to reduce campus operating overhead.
              </p>
              <div className="pt-2 text-xs font-mono font-bold text-[#18794e]">-34.1 MWh Power Saved</div>
            </div>
          </div>
        </section>

        {/* Benchmarked Deployment Metrics */}
        <section className="bg-white border border-[#ece6ed] rounded-xl p-8 shadow-sm grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-6 space-y-4">
            <span className="text-[11px] font-mono uppercase tracking-widest text-[#9c4126]">Benchmarked Deployment</span>
            <h2 className="text-3xl font-extrabold text-[#1f1b20] leading-tight">
              34,000 Students. 12 Schools. Zero Unresolved Incompatibilities.
            </h2>
            <p className="text-xs text-[#655d69] leading-relaxed">
              Western Polytechnic Institute deployed SmartGrid AI to eliminate 312 recurring cross-department lecture clashes and optimize cohort walking steps.
            </p>
            <div className="pt-2">
              <button 
                onClick={() => onNavigate?.('case-studies')}
                className="text-xs font-bold uppercase tracking-wider text-[#9c4126] hover:underline flex items-center gap-1.5"
              >
                Read Full Institutional Study <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="lg:col-span-6 grid grid-cols-2 gap-4">
            <div className="p-5 bg-[#fbf8fc] border border-[#ece6ed] rounded-xl text-center">
              <div className="text-3xl font-black text-[#1f1b20] font-mono">94%</div>
              <div className="text-[10px] font-mono uppercase text-[#7c747f] mt-1">Admin Time Saved</div>
            </div>
            <div className="p-5 bg-[#fbf8fc] border border-[#ece6ed] rounded-xl text-center">
              <div className="text-3xl font-black text-[#18794e] font-mono">100%</div>
              <div className="text-[10px] font-mono uppercase text-[#7c747f] mt-1">Accreditation Match</div>
            </div>
            <div className="p-5 bg-[#fbf8fc] border border-[#ece6ed] rounded-xl text-center">
              <div className="text-3xl font-black text-[#1f1b20] font-mono">99.1%</div>
              <div className="text-[10px] font-mono uppercase text-[#7c747f] mt-1">Faculty Retention</div>
            </div>
            <div className="p-5 bg-[#fbf8fc] border border-[#ece6ed] rounded-xl text-center">
              <div className="text-3xl font-black text-[#c84c16] font-mono">8.4x</div>
              <div className="text-[10px] font-mono uppercase text-[#7c747f] mt-1">Permutation Depth</div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};
