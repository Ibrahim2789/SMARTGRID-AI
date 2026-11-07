import React from 'react';
import { ArrowRight, ShieldCheck, Zap, Activity } from 'lucide-react';
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
    <div className="min-h-screen bg-app text-primary antialiased">
      <SmartGridNav 
        activeRoute="solutions" 
        onNavigate={onNavigate} 
        onOpenAuth={onOpenAuth}
        onSignOut={onSignOut}
        currentUser={currentUser}
      />

      <main className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-16">
        {/* Centered Minimal Hero Section */}
        <section className="text-center max-w-3xl mx-auto space-y-4 pt-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-subtle border border-border text-[13px] text-secondary">
            <span>Deterministic solver</span>
            <span className="text-tertiary">•</span>
            <span className="text-primary font-medium">Higher ed timetabling</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-semibold text-primary tracking-tight leading-tight">
            University timetable scheduling for registrars and academic operations
          </h1>

          <p className="text-[15px] text-secondary leading-relaxed max-w-2xl mx-auto">
            SmartGrid harmonizes faculty availability, campus room limits, and real-time student commute preferences into rigorously verified, conflict-free semester schedules.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button 
              onClick={() => currentUser ? onNavigate?.('generator') : onOpenAuth?.('signup')}
              className="h-[38px] px-4 rounded-md bg-brand hover:bg-brand-hover text-white text-[14px] font-medium flex items-center gap-2 transition-colors shadow-xs cursor-pointer"
            >
              <span>Launch workspace</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button 
              onClick={() => onNavigate?.('adaptive-engine')}
              className="h-[38px] px-4 rounded-md bg-surface border border-border hover:bg-subtle text-primary text-[14px] font-medium transition-colors cursor-pointer"
            >
              View methodology
            </button>
          </div>
        </section>

        {/* Validation Strip */}
        <section className="border-y border-border py-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-center text-[14px] text-secondary font-medium">
          <div>Oxford Union validated</div>
          <div>FERPA & Title IV compliant</div>
          <div>Deterministic guarantee</div>
          <div>Multi-tier cohort synthesis</div>
        </section>

        {/* The Three Pillars */}
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-primary">Designed for campus equilibrium</h2>
            <p className="text-[14px] text-secondary mt-0.5">Mathematical constraint satisfaction across three dimensions</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div 
              onClick={() => onNavigate?.('student-voice')}
              className="p-5 rounded-lg border border-border bg-surface hover:bg-subtle transition-colors cursor-pointer group flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Activity className="w-5 h-5 text-secondary group-hover:text-brand" />
                  <span className="text-[13px] text-success font-medium">92.8% alignment</span>
                </div>
                <h3 className="text-base font-semibold text-primary">Student preference weighting</h3>
                <p className="text-[14px] text-secondary leading-relaxed">
                  Integrates cohort feedback, commute transit buffers, and circadian learning peaks directly into solver matrices.
                </p>
              </div>
              <span className="text-[14px] text-brand font-medium mt-4">Configure preferences →</span>
            </div>

            <div 
              onClick={() => onNavigate?.('adaptive-engine')}
              className="p-5 rounded-lg border border-border bg-surface hover:bg-subtle transition-colors cursor-pointer group flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <ShieldCheck className="w-5 h-5 text-secondary group-hover:text-brand" />
                  <span className="text-[13px] text-success font-medium">0 collisions</span>
                </div>
                <h3 className="text-base font-semibold text-primary">Conflict arbitration</h3>
                <p className="text-[14px] text-secondary leading-relaxed">
                  100% collision-free room, instructor, and lab allocation via high-order polynomial constraint satisfaction.
                </p>
              </div>
              <span className="text-[14px] text-brand font-medium mt-4">Test arbitration →</span>
            </div>

            <div 
              onClick={() => currentUser ? onNavigate?.('timetable') : onOpenAuth?.('signin')}
              className="p-5 rounded-lg border border-border bg-surface hover:bg-subtle transition-colors cursor-pointer group flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Zap className="w-5 h-5 text-secondary group-hover:text-brand" />
                  <span className="text-[13px] text-secondary font-medium">98.4% util</span>
                </div>
                <h3 className="text-base font-semibold text-primary">Campus analytics</h3>
                <p className="text-[14px] text-secondary leading-relaxed">
                  Calculates spatial utilization density, heating and cooling across dormant halls, and transit delays.
                </p>
              </div>
              <span className="text-[14px] text-brand font-medium mt-4">View matrix →</span>
            </div>
          </div>
        </section>

        {/* Benchmarked Deployment Metrics */}
        <section className="bg-surface border border-border rounded-lg p-6 sm:p-7 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-6 space-y-2">
            <h2 className="text-xl font-semibold text-primary">
              34,000 students. 12 schools. Zero unresolved clashes.
            </h2>
            <p className="text-[15px] text-secondary leading-relaxed">
              Western Polytechnic Institute deployed SmartGrid to eliminate 312 recurring cross-department lecture clashes and optimize cohort walking steps.
            </p>
            <div className="pt-2">
              <button 
                onClick={() => onNavigate?.('case-studies')}
                className="text-[14px] font-medium text-brand hover:underline flex items-center gap-1.5 cursor-pointer"
              >
                <span>Read institutional case study</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="lg:col-span-6 grid grid-cols-2 gap-3.5">
            <div className="p-4 bg-subtle border border-border rounded-md text-center">
              <div className="text-[32px] font-semibold text-primary font-mono tabular-nums">94%</div>
              <div className="text-[13px] text-secondary mt-0.5">Admin time saved</div>
            </div>
            <div className="p-4 bg-subtle border border-border rounded-md text-center">
              <div className="text-[32px] font-semibold text-success font-mono tabular-nums">100%</div>
              <div className="text-[13px] text-secondary mt-0.5">Accreditation match</div>
            </div>
            <div className="p-4 bg-subtle border border-border rounded-md text-center">
              <div className="text-[32px] font-semibold text-primary font-mono tabular-nums">99.1%</div>
              <div className="text-[13px] text-secondary mt-0.5">Faculty retention</div>
            </div>
            <div className="p-4 bg-subtle border border-border rounded-md text-center">
              <div className="text-[32px] font-semibold text-primary font-mono tabular-nums">8.4x</div>
              <div className="text-[13px] text-secondary mt-0.5">Permutation depth</div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};
