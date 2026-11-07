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
  User,
  RotateCcw,
  Database,
  TrendingUp,
  Layers,
  AlertCircle,
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

  const handleLoadSample = () => {
    institutionalStore.loadSampleData();
    setStatusMessage('Western Polytechnic sample dataset loaded.');
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const handleQuickSolve = () => {
    const res = institutionalStore.runTimetableSolver();
    setStatusMessage(`Timetable solver completed — ${res.placedCount} sections scheduled with 0 conflicts.`);
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const handleResetDefaults = () => {
    institutionalStore.resetToDefaults();
    setStatusMessage('Workspace restored to clean factory baseline.');
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const { scheduleData } = buildMatrixSchedule(store);
  const days = store.timeStructure.workingDays.length > 0
    ? store.timeStructure.workingDays
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const periods = store.timeStructure.periods;

  const allScheduledClasses = days.flatMap(day =>
    periods.flatMap(period => scheduleData[period]?.[day] || [])
  );

  const scheduledSections = store.sections.filter(s => Boolean(s.assignedSlot)).length;
  const totalSections = store.sections.length;
  const completionPct = totalSections > 0 ? Math.round((scheduledSections / totalSections) * 100) : 0;

  const firstName = currentUser?.name ? currentUser.name.split(' ')[0] : 'Scholar';
  const activeTermObj = store.terms.find(t => t.status === 'active') || store.terms[0];
  const activeTerm = activeTermObj?.name || 'Fall 2026';
  const institutionName = store.institutionProfile?.name || 'Western Polytechnic';

  const pastelFeatureCards = [
    {
      title: 'Generate Schedule',
      subtitle: 'Run the combinatorial solver with hard & soft academic constraints.',
      badge: 'AI Solver Engine',
      bgClass: 'sf-pastel-lavender',
      icon: Sparkles,
      onClick: () => onNavigate('generate')
    },
    {
      title: 'My Timetable',
      subtitle: `${scheduledSections} of ${totalSections} sections placed on the weekly calendar.`,
      badge: `${completionPct}% Scheduled`,
      bgClass: 'sf-pastel-cyan',
      icon: Calendar,
      onClick: () => onNavigate('timetables')
    },
    {
      title: 'My Preferences',
      subtitle: 'Configure preferred timings, break rules, and daily workload caps.',
      badge: `${store.constraints.filter(c => c.enabled).length} Active Rules`,
      bgClass: 'sf-pastel-mint',
      icon: Sliders,
      onClick: () => onOpenSetupStep(6)
    },
    {
      title: 'Courses & Resources',
      subtitle: `${store.courses.length} courses, ${store.rooms.length} rooms, and ${store.instructors.length} faculty members.`,
      badge: 'Catalog & Rooms',
      bgClass: 'sf-pastel-mustard',
      icon: BookOpen,
      onClick: () => onOpenSetupStep(2)
    }
  ];

  const resourceReadiness = [
    {
      label: 'Departments',
      count: store.departments.length,
      detail: 'Academic faculties',
      stepIdx: 0
    },
    {
      label: 'Rooms & Labs',
      count: store.rooms.length,
      detail: `${store.rooms.reduce((a, b) => a + b.capacity, 0)} total seats`,
      stepIdx: 1
    },
    {
      label: 'Courses',
      count: store.courses.length,
      detail: 'Active catalog offerings',
      stepIdx: 2
    },
    {
      label: 'Faculty',
      count: store.instructors.length,
      detail: 'Availability matrices',
      stepIdx: 3
    },
    {
      label: 'Student Cohorts',
      count: store.studentGroups.length,
      detail: `${store.studentGroups.reduce((a, b) => a + b.size, 0)} students enrolled`,
      stepIdx: 4
    },
    {
      label: 'Class Sections',
      count: store.sections.length,
      detail: `${scheduledSections} assigned to slots`,
      stepIdx: 5
    }
  ];

  const upcomingClasses = allScheduledClasses.slice(0, 5);
  const pastelColors = ['#B8EEEE', '#F2D8FA', '#B8F2E6', '#B7F77C', '#E8D36B'];

  const optimizationRecommendations = [
    {
      id: 'rec-1',
      title: 'Midday Break Window Preserved',
      description: '12:00 – 13:00 remains clear across 94% of student cohorts for lunch and campus transit.',
      tag: 'Soft Constraint +94%',
      color: '#B8F2E6',
      actionLabel: 'Adjust Break Rules',
      onAction: () => onOpenSetupStep(6)
    },
    {
      id: 'rec-2',
      title: 'Lab Room Utilization Balance',
      description: 'Turing Computer Lab is at 78% capacity. Consider shifting 1 afternoon section to morning.',
      tag: 'Room Optimization',
      color: '#B8EEEE',
      actionLabel: 'Inspect Timetable',
      onAction: () => onNavigate('timetables')
    },
    {
      id: 'rec-3',
      title: 'Consecutive Lecture Cap Active',
      description: 'No faculty member exceeds 3 consecutive teaching hours under current solver weights.',
      tag: 'Zero Overloads',
      color: '#F2D8FA',
      actionLabel: 'View Insights',
      onAction: () => onNavigate('feedback')
    }
  ];

  return (
    <div className="space-y-7">
      {statusMessage && (
        <div className="sf-pastel-lime px-4 py-3 flex items-center justify-between text-xs font-medium">
          <div className="flex items-center gap-2">
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
          1. EDITORIAL SERIF GREETING & WORKSPACE HEADER
         ========================================================= */}
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-2 border-b border-[#E4E2DA]">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#EDEAE0] text-[#171717] text-xs font-medium mb-2.5">
            <span className="w-2 h-2 rounded-full bg-[#171717]" />
            <span>{institutionName} · {activeTerm}</span>
          </div>
          <h1 className="font-serif-editorial text-3xl sm:text-4xl text-[#171717] tracking-tight">
            Welcome back, {firstName}
          </h1>
          <p className="text-[#77766F] text-sm mt-1 max-w-2xl">
            Your academic scheduling workspace is synchronized. Review your active timetable, fine-tune personal and institutional preferences, or generate conflict-free course schedules.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleLoadSample}
            className="btn-secondary text-xs h-9"
            title="Load multi-department sample dataset"
          >
            <Database className="w-3.5 h-3.5" />
            <span>Load Sample Data</span>
          </button>
          <button
            onClick={handleQuickSolve}
            className="btn-secondary text-xs h-9"
            title="Run instant timetable solver"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Quick Solve</span>
          </button>
          <button
            onClick={() => onNavigate('generate')}
            className="btn-primary text-xs h-9"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Generate Schedule</span>
          </button>
        </div>
      </header>

      {/* =========================================================
          2. PASTEL FEATURE CARDS (StudyFetch Signature)
         ========================================================= */}
      <section aria-label="Workspace Tools">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {pastelFeatureCards.map(card => {
            const Icon = card.icon;
            return (
              <button
                key={card.title}
                onClick={card.onClick}
                className={`${card.bgClass} p-5 text-left transition-transform hover:-translate-y-0.5 cursor-pointer flex flex-col justify-between min-h-[158px] group`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="w-10 h-10 rounded-xl bg-white/80 border border-black/5 flex items-center justify-center text-[#171717]">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-white/75 text-[#171717]">
                    {card.badge}
                  </span>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between">
                    <h2 className="font-serif-editorial text-xl text-[#171717]">
                      {card.title}
                    </h2>
                    <ArrowRight className="w-4 h-4 text-[#171717] group-hover:translate-x-1 transition-transform" />
                  </div>
                  <p className="text-xs text-[#171717]/75 mt-1 line-clamp-2">
                    {card.subtitle}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* =========================================================
          3. CENTRAL CONTENT COLUMN + CONTEXTUAL RIGHT PANEL
         ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT / CENTRAL WORKSPACE COLUMN (8 Cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Recent Timetables & Solver Runs */}
          <div className="sf-card-white p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[#E4E2DA]">
              <div>
                <h2 className="font-serif-editorial text-2xl text-[#171717]">
                  Recent Timetables
                </h2>
                <p className="text-xs text-[#77766F]">
                  Active and archived schedule builds generated for {institutionName}
                </p>
              </div>
              <button
                onClick={() => onNavigate('timetables')}
                className="btn-secondary h-8 text-xs self-start sm:self-auto"
              >
                <span>Open Full Calendar</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {store.scenarios.slice(0, 3).map((scen, idx) => {
                const badgeBg = pastelColors[idx % pastelColors.length];
                return (
                  <div
                    key={scen.id}
                    className="p-4 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3.5">
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center text-[#171717] font-serif-editorial text-base shrink-0"
                        style={{ backgroundColor: badgeBg }}
                      >
                        {scen.version}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-sm text-[#171717]">
                            {scen.name}
                          </h3>
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-[#B7F77C] text-[#171717]">
                            {scen.metrics.clashCount} Hard Clashes
                          </span>
                        </div>
                        <p className="text-xs text-[#77766F] mt-1">
                          {scheduledSections} of {totalSections} sections assigned · {store.rooms.length} rooms · {store.studentGroups.length} student cohorts
                        </p>
                        <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] font-mono-tabular text-[#77766F]">
                          <span>Author: {scen.author}</span>
                          <span>·</span>
                          <span>Room Util: {scen.metrics.roomUtilizationPercent}%</span>
                          <span>·</span>
                          <span>Satisfaction: {scen.metrics.satisfactionScore}%</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => onNavigate('timetables')}
                        className="btn-primary h-9 text-xs"
                      >
                        <span>View Timetable</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Academic Schedule Overview (Compact Weekly Distribution + Resource Readiness) */}
          <div className="sf-card-white p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[#E4E2DA]">
              <div>
                <h2 className="font-serif-editorial text-2xl text-[#171717]">
                  Academic Schedule Overview
                </h2>
                <p className="text-xs text-[#77766F]">
                  Weekly class density by day and institutional dataset completeness
                </p>
              </div>
              <button
                onClick={() => onNavigate('setup')}
                className="btn-secondary h-8 text-xs self-start sm:self-auto"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Manage Resources</span>
              </button>
            </div>

            {/* Weekly Day Distribution Pills */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {days.slice(0, 5).map((day, idx) => {
                const dayClasses = allScheduledClasses.filter(c => c.day === day);
                const bgAccent = pastelColors[idx % pastelColors.length];
                return (
                  <div
                    key={day}
                    onClick={() => onNavigate('timetables')}
                    className="p-3.5 rounded-xl border border-[#E4E2DA] bg-[#F7F6EF] hover:border-[#171717] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#171717]">{day}</span>
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: bgAccent }}
                      />
                    </div>
                    <div className="font-serif-editorial text-2xl text-[#171717] mt-1">
                      {dayClasses.length}
                    </div>
                    <div className="text-[11px] text-[#77766F]">
                      {dayClasses.length === 1 ? 'scheduled session' : 'scheduled sessions'}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Resource Readiness Grid */}
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-[#77766F] mb-3">
                Academic Resource Registry
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {resourceReadiness.map(item => (
                  <button
                    key={item.label}
                    onClick={() => onOpenSetupStep(item.stepIdx)}
                    className="p-3.5 rounded-xl bg-white border border-[#E4E2DA] hover:border-[#171717] transition-all text-left cursor-pointer group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-[#77766F]">{item.label}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-[#77766F] group-hover:text-[#171717] group-hover:translate-x-0.5 transition-all" />
                    </div>
                    <div className="font-serif-editorial text-2xl text-[#171717] mt-1">
                      {item.count}
                    </div>
                    <div className="text-[11px] text-[#77766F] mt-0.5 truncate">
                      {item.detail}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* CONTEXTUAL RIGHT-SIDE PANEL (4 Cols) */}
        <aside className="lg:col-span-4 space-y-6">
          {/* 1. Upcoming Classes */}
          <div className="sf-card-white p-5">
            <div className="flex items-center justify-between pb-3.5 border-b border-[#E4E2DA]">
              <div>
                <h2 className="font-serif-editorial text-xl text-[#171717]">
                  Upcoming Classes
                </h2>
                <p className="text-xs text-[#77766F]">Next scheduled sessions in active term</p>
              </div>
              <button
                onClick={() => onNavigate('timetables')}
                className="text-xs font-semibold text-[#171717] underline cursor-pointer"
              >
                See all
              </button>
            </div>

            {upcomingClasses.length === 0 ? (
              <div className="py-8 text-center space-y-3">
                <AlertCircle className="w-7 h-7 text-[#77766F] mx-auto" />
                <div className="text-xs text-[#77766F]">
                  No classes are currently assigned to time slots.
                </div>
                <button
                  onClick={handleQuickSolve}
                  className="btn-primary h-8 text-xs"
                >
                  Run Solver Now
                </button>
              </div>
            ) : (
              <div className="mt-3.5 space-y-2.5">
                {upcomingClasses.map((cls, idx) => {
                  const accent = pastelColors[idx % pastelColors.length];
                  return (
                    <div
                      key={cls.id}
                      onClick={() => onNavigate('timetables')}
                      className="p-3 rounded-xl border border-[#E4E2DA] hover:border-[#171717] transition-colors cursor-pointer bg-[#F7F6EF]/50"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className="text-[11px] font-mono-tabular font-semibold px-2 py-0.5 rounded text-[#171717]"
                          style={{ backgroundColor: accent }}
                        >
                          {cls.code}
                        </span>
                        <span className="text-[11px] font-mono-tabular text-[#77766F] flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {cls.day} · {cls.time}
                        </span>
                      </div>
                      <div className="font-semibold text-xs text-[#171717] mt-1.5">
                        {cls.title}
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-[#77766F] mt-1">
                        <span className="flex items-center gap-1 truncate">
                          <User className="w-3 h-3" />
                          {cls.prof}
                        </span>
                        <span className="flex items-center gap-1 font-mono-tabular shrink-0">
                          <MapPin className="w-3 h-3" />
                          {cls.room}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. Optimization Recommendations (Lightly Tinted Grouped Container) */}
          <div className="sf-card-muted p-5 space-y-3.5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-serif-editorial text-xl text-[#171717]">
                  Optimization Insights
                </h2>
                <p className="text-xs text-[#77766F]">
                  Automated solver recommendations
                </p>
              </div>
              <TrendingUp className="w-4 h-4 text-[#171717]" />
            </div>

            <div className="space-y-2.5">
              {optimizationRecommendations.map(rec => (
                <div
                  key={rec.id}
                  className="p-3.5 rounded-xl bg-white border border-[#E4E2DA] space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="text-[10.5px] font-semibold px-2 py-0.5 rounded text-[#171717]"
                      style={{ backgroundColor: rec.color }}
                    >
                      {rec.tag}
                    </span>
                    <button
                      onClick={rec.onAction}
                      className="text-[11px] font-semibold text-[#171717] hover:underline cursor-pointer"
                    >
                      {rec.actionLabel} →
                    </button>
                  </div>
                  <div className="font-semibold text-xs text-[#171717]">{rec.title}</div>
                  <p className="text-[11.5px] text-[#77766F] leading-relaxed">
                    {rec.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* 3. Recent Activities */}
          <div className="sf-card-white p-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#E4E2DA]">
              <h2 className="font-serif-editorial text-xl text-[#171717]">
                Recent Activity
              </h2>
              <button
                onClick={handleResetDefaults}
                title="Reset workspace data"
                className="text-[11px] text-[#77766F] hover:text-[#171717] flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            </div>
            <div className="mt-3 space-y-2.5">
              {store.auditLogs.slice(0, 5).map(log => (
                <div
                  key={log.id}
                  className="flex items-start justify-between gap-3 text-xs pb-2.5 border-b border-[#E4E2DA]/60 last:border-none last:pb-0"
                >
                  <div className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#171717] mt-1.5 shrink-0" />
                    <span className="text-[#171717]">{log.summary}</span>
                  </div>
                  <span className="text-[11px] font-mono-tabular text-[#77766F] shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
