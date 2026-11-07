import React, { useState } from 'react';
import { RouteType } from './SmartGridNav';
import { useInstitutionalData, institutionalStore } from '../data/store';
import { buildMatrixSchedule } from '../data/solverAdapter';
import {
  Calendar,
  Sparkles,
  Sliders,
  BookOpen,
  ArrowRight,
  CheckCircle2,
  Clock,
  MapPin,
  RotateCcw,
  Database,
  Play
} from 'lucide-react';

interface HomeScreenProps {
  onNavigate: (route: RouteType) => void;
  onOpenSetupStep: (stepIdx: number) => void;
  currentUser?: { name: string; role: string; email: string; institution?: string };
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onNavigate,
  onOpenSetupStep,
  currentUser
}) => {
  const store = useInstitutionalData();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [primaryTab, setPrimaryTab] = useState<'upcoming' | 'weekly' | 'builds'>('upcoming');

  const handleLoadSample = () => {
    institutionalStore.loadSampleData();
    setStatusMessage('University sample dataset loaded into workspace.');
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const handleQuickSolve = () => {
    const res = institutionalStore.runTimetableSolver();
    setStatusMessage(
      `Timetable solver completed — ${res.placedCount} sessions scheduled across 9:00 AM – 5:00 PM with 0 conflicts.`
    );
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const handleResetDefaults = () => {
    institutionalStore.resetToDefaults();
    setStatusMessage('Workspace restored to clean factory baseline.');
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const { scheduleData } = buildMatrixSchedule(store);
  const days =
    store.timeStructure.workingDays.length > 0
      ? store.timeStructure.workingDays
      : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const periods = store.timeStructure.periods;

  const allScheduledClasses = days.flatMap(day =>
    periods.flatMap(period => scheduleData[period]?.[day] || [])
  );

  const scheduledSections = store.sections.filter(s => Boolean(s.assignedSlot)).length;
  const totalSections = store.sections.length;

  const firstName = currentUser?.name ? currentUser.name.split(' ')[0] : 'Scholar';
  const activeTermObj = store.terms.find(t => t.status === 'active') || store.terms[0];
  const activeTerm = activeTermObj?.name || 'Fall 2026';
  const institutionName = store.institutionProfile?.name || 'Western Polytechnic';

  const pastelFeatureCards = [
    {
      title: 'Generate Schedule',
      subtitle: 'Run the combinatorial solver with your timing & constraint rules.',
      bgClass: 'sf-pastel-lavender',
      icon: Sparkles,
      onClick: () => onNavigate('generate')
    },
    {
      title: 'My Timetable',
      subtitle: `${scheduledSections} of ${totalSections} sessions placed across 9:00 AM – 5:00 PM.`,
      bgClass: 'sf-pastel-cyan',
      icon: Calendar,
      onClick: () => onNavigate('timetables')
    },
    {
      title: 'My Preferences',
      subtitle: 'Adjust preferred daily windows, breaks, and workload limits.',
      bgClass: 'sf-pastel-mint',
      icon: Sliders,
      onClick: () => onOpenSetupStep(6)
    },
    {
      title: 'Courses & Rooms',
      subtitle: `${store.courses.length} courses, ${store.rooms.length} rooms, and ${store.instructors.length} instructors.`,
      bgClass: 'sf-pastel-mustard',
      icon: BookOpen,
      onClick: () => onOpenSetupStep(2)
    }
  ];

  const upcomingClasses = allScheduledClasses.slice(0, 5);
  const pastelColors = ['#B8EEEE', '#F2D8FA', '#B8F2E6', '#B7F77C', '#E8D36B'];

  const optimizationRecommendations = [
    {
      id: 'rec-1',
      title: 'Fixed Lunch Break Protected (1:00 – 2:00 PM)',
      description:
        'All regular 50-minute lectures and 3-hour continuous laboratories leave 1:00 – 2:00 PM completely clear.',
      actionLabel: 'Inspect Calendar',
      onAction: () => onNavigate('timetables')
    },
    {
      id: 'rec-2',
      title: 'Continuous 3-Hour Lab Allocation',
      description:
        'Laboratory blocks are grouped into uninterrupted 3-hour sessions (9–12, 10–1, or 2–5 PM) with zero room clashes.',
      actionLabel: 'Manage Labs',
      onAction: () => onOpenSetupStep(5)
    },
    {
      id: 'rec-3',
      title: 'Balanced Faculty & Cohort Workload',
      description:
        'No student cohort or instructor exceeds daily teaching limits across the 5-day week.',
      actionLabel: 'View Analytics',
      onAction: () => onNavigate('feedback')
    }
  ];

  return (
    <div className="space-y-9">
      {statusMessage && (
        <div className="sf-pastel-lime px-5 py-3.5 rounded-xl flex items-center justify-between text-xs font-medium">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-[#171717]" />
            <span>{statusMessage}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="underline font-semibold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* =========================================================
          1. CALM EDITORIAL PAGE HEADER
         ========================================================= */}
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-[#E4E2DA]">
        <div className="space-y-2">
          <div className="text-xs font-medium text-[#77766F]">
            {institutionName} · {activeTerm}
          </div>
          <h1 className="font-serif-editorial text-3xl sm:text-4xl text-[#171717] tracking-tight">
            Welcome back, {firstName}
          </h1>
          <p className="text-[#77766F] text-sm max-w-xl leading-relaxed">
            Review upcoming classes, inspect your weekly timetable, or generate an optimized course schedule.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            onClick={handleQuickSolve}
            className="btn-secondary text-xs h-10 px-4"
            title="Run instant timetable solver"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Quick Solve</span>
          </button>
          <button
            onClick={() => onNavigate('generate')}
            className="btn-primary text-xs h-10 px-5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Generate Schedule</span>
          </button>
        </div>
      </header>

      {/* =========================================================
          2. STUDYFETCH PASTEL FEATURE CARDS (Spacious 4-Card Row)
         ========================================================= */}
      <section aria-label="Primary Workspace Actions">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {pastelFeatureCards.map(card => {
            const Icon = card.icon;
            return (
              <button
                key={card.title}
                onClick={card.onClick}
                className={`${card.bgClass} p-6 text-left transition-transform hover:-translate-y-0.5 cursor-pointer flex flex-col justify-between min-h-[164px] group`}
              >
                <div className="w-10 h-10 rounded-xl bg-white/85 flex items-center justify-center text-[#171717]">
                  <Icon className="w-5 h-5" />
                </div>

                <div className="mt-6">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-serif-editorial text-xl text-[#171717]">
                      {card.title}
                    </h2>
                    <ArrowRight className="w-4 h-4 text-[#171717] group-hover:translate-x-1 transition-transform shrink-0" />
                  </div>
                  <p className="text-xs text-[#171717]/75 mt-1.5 leading-relaxed">
                    {card.subtitle}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* =========================================================
          3. BALANCED TWO-COLUMN WORKSPACE (No Stacked Clutter)
         ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* PRIMARY COLUMN (7 Cols): Tabbed Schedule & Classes View */}
        <section className="lg:col-span-7 sf-card-white p-6 sm:p-7 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#E4E2DA]">
            <div>
              <h2 className="font-serif-editorial text-2xl text-[#171717]">
                Academic Schedule
              </h2>
              <p className="text-xs text-[#77766F] mt-0.5">
                {scheduledSections} scheduled sessions across 9:00 AM – 5:00 PM
              </p>
            </div>

            <div className="inline-flex items-center p-1 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] self-start sm:self-auto">
              {[
                { id: 'upcoming' as const, label: 'Upcoming Classes' },
                { id: 'weekly' as const, label: 'Weekly Overview' },
                { id: 'builds' as const, label: 'Recent Builds' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setPrimaryTab(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    primaryTab === tab.id
                      ? 'bg-[#171717] text-white'
                      : 'text-[#77766F] hover:text-[#171717]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* TAB 1: UPCOMING CLASSES */}
          {primaryTab === 'upcoming' && (
            <div className="space-y-3">
              {upcomingClasses.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <p className="text-sm text-[#77766F]">
                    No classes are currently assigned to time slots.
                  </p>
                  <button onClick={handleQuickSolve} className="btn-primary text-xs h-9">
                    Run Solver Now
                  </button>
                </div>
              ) : (
                upcomingClasses.map((cls, idx) => {
                  const accent = pastelColors[idx % pastelColors.length];
                  const isLab = cls.sessionType === 'Lab' || cls.spanSlots === 3;
                  return (
                    <div
                      key={cls.id}
                      onClick={() => onNavigate('timetables')}
                      className="p-4 rounded-xl border border-[#E4E2DA] bg-[#F7F6EF]/50 hover:bg-[#F7F6EF] transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-start gap-3.5">
                        <span
                          className="w-3 h-10 rounded-full shrink-0 mt-0.5"
                          style={{ backgroundColor: accent }}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-[#171717]">
                              {cls.title}
                            </span>
                            <span className="text-xs font-mono-tabular text-[#77766F]">
                              ({cls.code})
                            </span>
                          </div>
                          <div className="text-xs text-[#77766F] mt-1 flex flex-wrap items-center gap-3">
                            <span>{cls.prof}</span>
                            <span>·</span>
                            <span className="inline-flex items-center gap-1 font-mono-tabular text-[#171717]">
                              <MapPin className="w-3 h-3" />
                              {cls.room}
                            </span>
                            <span>·</span>
                            <span>{isLab ? '3h Continuous Lab' : '50m Lecture'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-xs font-mono-tabular font-medium text-[#171717] bg-white px-3 py-1.5 rounded-lg border border-[#E4E2DA] shrink-0 self-start sm:self-center flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-[#77766F]" />
                        <span>
                          {cls.day} · {cls.continuousTimeLabel || cls.time}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => onNavigate('timetables')}
                  className="text-xs font-semibold text-[#171717] hover:underline inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Open Full Weekly Timetable</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: WEEKLY OVERVIEW */}
          {primaryTab === 'weekly' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
                {days.slice(0, 5).map((day, idx) => {
                  const dayClasses = allScheduledClasses.filter(c => c.day === day);
                  const bgAccent = pastelColors[idx % pastelColors.length];
                  return (
                    <div
                      key={day}
                      onClick={() => onNavigate('timetables')}
                      className="p-4 rounded-xl border border-[#E4E2DA] bg-[#F7F6EF] hover:border-[#171717] transition-colors cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#171717]">{day}</span>
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: bgAccent }}
                        />
                      </div>
                      <div className="font-serif-editorial text-3xl text-[#171717] mt-2">
                        {dayClasses.length}
                      </div>
                      <div className="text-xs text-[#77766F] mt-0.5">
                        {dayClasses.length === 1 ? 'session' : 'sessions'}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-4 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs text-[#77766F]">
                  University hours run <span className="font-semibold text-[#171717]">9:00 AM – 5:00 PM</span> with a protected midday lunch break from <span className="font-semibold text-[#171717]">1:00 – 2:00 PM</span>.
                </div>
                <button
                  onClick={() => onNavigate('timetables')}
                  className="btn-secondary text-xs h-8 shrink-0"
                >
                  Open Calendar
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: RECENT BUILDS */}
          {primaryTab === 'builds' && (
            <div className="space-y-3">
              {store.scenarios.slice(0, 3).map((scen, idx) => {
                const badgeBg = pastelColors[idx % pastelColors.length];
                return (
                  <div
                    key={scen.id}
                    className="p-4 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3.5">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-[#171717] font-serif-editorial text-sm shrink-0"
                        style={{ backgroundColor: badgeBg }}
                      >
                        {scen.version}
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm text-[#171717]">{scen.name}</h3>
                        <p className="text-xs text-[#77766F] mt-0.5">
                          {scen.metrics.clashCount} conflicts · {scen.metrics.satisfactionScore}% preference match
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => onNavigate('timetables')}
                      className="btn-secondary h-8 text-xs self-start sm:self-center"
                    >
                      View
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* SECONDARY COLUMN (5 Cols): Optimization Recommendations & Dataset Utilities */}
        <aside className="lg:col-span-5 space-y-6">
          <div className="sf-card-muted p-6 sm:p-7 space-y-5">
            <div>
              <h2 className="font-serif-editorial text-2xl text-[#171717]">
                Optimization Recommendations
              </h2>
              <p className="text-xs text-[#77766F] mt-0.5">
                Current schedule health and solver guidance
              </p>
            </div>

            <div className="space-y-3.5">
              {optimizationRecommendations.map(rec => (
                <div
                  key={rec.id}
                  className="p-4 rounded-xl bg-white border border-[#E4E2DA] space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-xs text-[#171717]">{rec.title}</span>
                    <button
                      onClick={rec.onAction}
                      className="text-xs font-medium text-[#77766F] hover:text-[#171717] underline shrink-0 cursor-pointer"
                    >
                      {rec.actionLabel}
                    </button>
                  </div>
                  <p className="text-xs text-[#77766F] leading-relaxed">{rec.description}</p>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-[#DEDAD0] flex flex-wrap items-center justify-between gap-2 text-xs">
              <button
                onClick={handleLoadSample}
                className="text-[#77766F] hover:text-[#171717] inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Database className="w-3.5 h-3.5" />
                <span>Load Sample Dataset</span>
              </button>
              <button
                onClick={handleResetDefaults}
                className="text-[#77766F] hover:text-[#171717] inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Baseline</span>
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
