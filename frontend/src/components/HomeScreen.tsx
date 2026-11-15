import React, { useState } from 'react';
import { RouteType } from './SmartGridNav';
import { useInstitutionalData, institutionalStore } from '../data/store';
import { computeAcademicScheduleConfig, isUserAdminRole } from '../types/institutional';
import { buildMatrixSchedule } from '../data/solverAdapter';
import {
  Sparkles,
  Calendar,
  Database,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  Users,
  BookOpen,
  DoorOpen,
  Sliders,
  Layers,
  GraduationCap,
  FlaskConical,
  Download
} from 'lucide-react';
import { exportTimetableToGoogleSheetsWorkbook } from '../utils/googleSheetsExport';

interface HomeScreenProps {
  onNavigate: (route: RouteType) => void;
  onOpenSetupStep: (stepIndex: number) => void;
  currentUser: { name: string; role: string; email: string; institution?: string };
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onNavigate,
  onOpenSetupStep,
  currentUser
}) => {
  const store = useInstitutionalData();
  const activeTiming = computeAcademicScheduleConfig(store.timeStructure);
  const isAdmin = isUserAdminRole(currentUser.role);
  const [isQuickSolving, setIsQuickSolving] = useState(false);

  const activeTerm = store.terms.find(t => t.status === 'active') || store.terms[0];
  const scheduledSections = store.sections.filter(s => s.assignedSlot);
  const unscheduledSections = store.sections.filter(s => !s.assignedSlot);
  const labSectionsCount = store.sections.filter(s => s.sessionType === 'Lab').length;
  const lectureSectionsCount = store.sections.filter(s => s.sessionType !== 'Lab').length;

  const completionPct =
    store.sections.length > 0
      ? Math.round((scheduledSections.length / store.sections.length) * 100)
      : 0;

  const labHoursLabel = (activeTiming.labDurationMinutes / 60).toFixed(
    activeTiming.labDurationMinutes % 60 === 0 ? 0 : 1
  );

  // Format greeting name cleanly without trailing dot collisions (never "Dr..")
  const displayGreetingName = currentUser.name
    .replace(/\s*\(.*\)$/, '')
    .trim()
    .replace(/\.$/, '');

  const handleQuickGenerate = () => {
    setIsQuickSolving(true);
    setTimeout(() => {
      institutionalStore.runTimetableSolver({
        departmentId: 'all',
        strategyName: `${activeTerm?.name || 'Fall 2026'} — Full University Schedule`,
        forceRescheduleAll: true
      });
      setIsQuickSolving(false);
      onNavigate('timetables');
    }, 550);
  };

  const handleQuickExportSheets = async () => {
    const { scheduleData } = buildMatrixSchedule(store);
    await exportTimetableToGoogleSheetsWorkbook({
      store,
      scheduleData,
      filterClass: () => true,
      scope: 'all',
      scopeLabel: activeTerm?.name || 'Full_University',
      studentOrUserName: currentUser.name
    });
  };

  return (
    <div className="space-y-8">
      {/* 1. HERO WORKSPACE PANEL */}
      <section className="sf-card-white bg-white border border-[#E4E2DA] rounded-2xl p-6 sm:p-8 relative overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-4">
            <h1 className="font-serif-editorial text-3xl sm:text-4xl leading-[1.12] text-[#171717] tracking-tight">
              Welcome back, {displayGreetingName}.
            </h1>

            <p className="text-[#57564F] text-sm max-w-xl leading-relaxed">
              {store.departments.length} departments · {store.studentGroups.length} sections · {activeTiming.operatingHoursLabel}
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                onClick={handleQuickGenerate}
                disabled={isQuickSolving}
                className="btn-primary h-10 px-5 text-xs sm:text-sm"
              >
                <Sparkles className="w-4 h-4" />
                <span>
                  {isQuickSolving ? 'Solving Timetable...' : 'Generate Full Timetable'}
                </span>
              </button>

              <button
                onClick={() => onNavigate('timetables')}
                className="btn-secondary h-10 px-4 text-xs sm:text-sm"
              >
                <Calendar className="w-4 h-4" />
                <span>View Weekly Matrix</span>
              </button>
            </div>
          </div>

          {/* Right: Hairline-Integrated Live Schedule Summary */}
          <div className="lg:col-span-5 lg:border-l border-t lg:border-t-0 border-[#E4E2DA] pt-6 lg:pt-0 lg:pl-8 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#77766F]">
                Active Schedule Status
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#171717]">
                {unscheduledSections.length === 0 ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#1B5E20]" />
                    <span>Conflict-Free</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3.5 h-3.5 text-[#8B1E1E]" />
                    <span>{unscheduledSections.length} Unassigned</span>
                  </>
                )}
              </span>
            </div>

            <div className="grid grid-cols-2 divide-x divide-[#E4E2DA] border border-[#E4E2DA] rounded-xl bg-[#F7F6EF]/40">
              <div className="p-3.5">
                <div className="text-[11px] font-medium text-[#77766F]">Sections Placed</div>
                <div className="font-serif-editorial text-2xl text-[#171717] mt-0.5 font-mono-tabular">
                  {scheduledSections.length}{' '}
                  <span className="text-xs font-sans text-[#77766F]">/ {store.sections.length}</span>
                </div>
              </div>
              <div className="p-3.5">
                <div className="text-[11px] font-medium text-[#77766F]">Sessions</div>
                <div className="font-serif-editorial text-2xl text-[#171717] mt-0.5 font-mono-tabular">
                  {lectureSectionsCount}L · {labSectionsCount}Lab
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-medium text-[#171717]">
                <span>Coverage</span>
                <span className="font-mono-tabular font-semibold">{completionPct}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#E4E2DA] overflow-hidden">
                <div
                  className="h-full bg-[#171717] transition-all duration-500"
                  style={{ width: `${completionPct}%` }}
                />
              </div>
            </div>

            <div className="pt-1 flex items-center justify-between text-[11.5px] text-[#77766F]">
              <span className="font-mono-tabular">
                {activeTiming.periodLengthMinutes}m lectures · {labHoursLabel}h labs
                {activeTiming.middayBreak.enabled
                  ? ` · ${activeTiming.middayBreak.timeRangeLabel} Break`
                  : ''}
              </span>
              {isAdmin ? (
                <button
                  onClick={() => onNavigate('academic-config')}
                  className="text-[#171717] font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>Timing Rules</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              ) : (
                <button
                  onClick={() => onNavigate('generate')}
                  className="text-[#171717] font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>Solver Options</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 2. CORE WORKFLOWS */}
      <section className="space-y-3">
        <h2 className="font-serif-editorial text-2xl text-[#171717]">Core Workflows</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div
            onClick={() => onNavigate('setup')}
            className="sf-pastel-cyan rounded-2xl p-5 flex flex-col justify-between cursor-pointer hover:shadow-md transition-all group"
          >
            <div className="space-y-3">
              <div className="w-9 h-9 rounded-xl bg-[#171717] text-white flex items-center justify-center">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-serif-editorial text-xl text-[#171717]">
                  Academic Data
                </h3>
                <p className="text-xs text-[#171717]/75 mt-1 font-mono-tabular">
                  {store.departments.length} depts · {store.rooms.length} rooms · {store.courses.length} courses
                </p>
              </div>
            </div>
            <div className="pt-3 mt-3 flex items-center justify-between text-xs font-semibold text-[#171717]">
              <span>Manage Records</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>

          <div
            onClick={() => onNavigate('academic-config')}
            className="sf-pastel-lavender rounded-2xl p-5 flex flex-col justify-between cursor-pointer hover:shadow-md transition-all group"
          >
            <div className="space-y-3">
              <div className="w-9 h-9 rounded-xl bg-[#171717] text-white flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-serif-editorial text-xl text-[#171717]">
                  Academic Config
                </h3>
                <p className="text-xs text-[#171717]/75 mt-1 font-mono-tabular">
                  {activeTiming.operatingHoursLabel} · {activeTiming.periodLengthMinutes}m slots
                </p>
              </div>
            </div>
            <div className="pt-3 mt-3 flex items-center justify-between text-xs font-semibold text-[#171717]">
              <span>Configure Timings</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>

          <div
            onClick={() => onNavigate('generate')}
            className="sf-pastel-mint rounded-2xl p-5 flex flex-col justify-between cursor-pointer hover:shadow-md transition-all group"
          >
            <div className="space-y-3">
              <div className="w-9 h-9 rounded-xl bg-[#171717] text-white flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-serif-editorial text-xl text-[#171717]">
                  Generate Schedule
                </h3>
                <p className="text-xs text-[#171717]/75 mt-1">
                  Department scope &amp; solver synthesis
                </p>
              </div>
            </div>
            <div className="pt-3 mt-3 flex items-center justify-between text-xs font-semibold text-[#171717]">
              <span>Configure &amp; Run</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>

          <div
            onClick={() => onNavigate('timetables')}
            className="sf-pastel-lime rounded-2xl p-5 flex flex-col justify-between cursor-pointer hover:shadow-md transition-all group"
          >
            <div className="space-y-3">
              <div className="w-9 h-9 rounded-xl bg-[#171717] text-white flex items-center justify-center">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-serif-editorial text-xl text-[#171717]">
                  Timetables &amp; Export
                </h3>
                <p className="text-xs text-[#171717]/75 mt-1">
                  Weekly matrix &amp; Google Sheets
                </p>
              </div>
            </div>
            <div className="pt-3 mt-3 flex items-center justify-between text-xs font-semibold text-[#171717]">
              <span>Open Grid</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        </div>
      </section>

      {/* 3. UNIVERSITY DATASET INVENTORY */}
      <section className="sf-card-white overflow-hidden">
        <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E4E2DA]">
          <h3 className="font-serif-editorial text-xl text-[#171717]">
            Dataset Inventory
          </h3>
          <button
            onClick={() => onNavigate('setup')}
            className="btn-secondary text-xs h-8 px-3.5 shrink-0"
          >
            Open Catalog Setup
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F7F6EF] border-b border-[#E4E2DA] text-[11px] font-semibold uppercase tracking-wider text-[#77766F]">
                <th className="py-2.5 px-6">Category</th>
                <th className="py-2.5 px-4">Records</th>
                <th className="py-2.5 px-4">Breakdown</th>
                <th className="py-2.5 px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E2DA] text-xs">
              {[
                {
                  label: 'Departments & Semesters',
                  count: store.departments.length,
                  unit: 'Departments',
                  sub: `${store.terms.filter(t => t.status === 'active').length} Active (${activeTerm?.name || 'Fall 2026'})`,
                  icon: Layers,
                  step: 0
                },
                {
                  label: 'Classrooms & Laboratories',
                  count: store.rooms.length,
                  unit: 'Facilities',
                  sub: `${store.rooms.filter(r => r.type === 'lecture').length} Lecture Rooms · ${store.rooms.filter(r => r.type === 'lab').length} Labs`,
                  icon: DoorOpen,
                  step: 1
                },
                {
                  label: 'Academic Courses',
                  count: store.courses.length,
                  unit: 'Courses',
                  sub: `${store.courses.filter(c => c.requiredRoomType === 'lab').length} Lab-Integrated · ${store.courses.filter(c => c.requiredRoomType !== 'lab').length} Theory`,
                  icon: BookOpen,
                  step: 2
                },
                {
                  label: 'Faculty & Instructors',
                  count: store.instructors.length,
                  unit: 'Instructors',
                  sub: `${store.departments.length} departments`,
                  icon: Users,
                  step: 3
                },
                {
                  label: 'Batches & Student Sections',
                  count: store.studentGroups.length,
                  unit: 'Sections',
                  sub: `${Array.from(new Set(store.studentGroups.map(g => g.batchCode || g.code.split('-')[0]))).length} Active Cohorts`,
                  icon: GraduationCap,
                  step: 4
                },
                {
                  label: 'Course Section Mappings',
                  count: store.sections.length,
                  unit: 'Sessions',
                  sub: `${lectureSectionsCount} Lectures (${activeTiming.periodLengthMinutes}m) · ${labSectionsCount} Labs (${labHoursLabel}h)`,
                  icon: FlaskConical,
                  step: 5
                }
              ].map(item => {
                const Icon = item.icon;
                return (
                  <tr
                    key={item.label}
                    onClick={() => onOpenSetupStep(item.step)}
                    className="hover:bg-[#F7F6EF]/70 transition-colors cursor-pointer group"
                  >
                    <td className="py-3 px-6">
                      <div className="flex items-center gap-2.5">
                        <Icon className="w-4 h-4 text-[#77766F] group-hover:text-[#171717] shrink-0" />
                        <span className="font-semibold text-[#171717] group-hover:underline">
                          {item.label}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono-tabular">
                      <span className="text-sm font-bold text-[#171717] mr-1.5">
                        {item.count}
                      </span>
                      <span className="text-[11px] text-[#77766F]">{item.unit}</span>
                    </td>
                    <td className="py-3 px-4 text-[#57564F]">{item.sub}</td>
                    <td className="py-3 px-6 text-right">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#171717] group-hover:translate-x-0.5 transition-transform">
                        <span>Manage</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
