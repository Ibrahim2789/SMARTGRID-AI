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
      {/* =========================================================
          1. HERO WORKSPACE PANEL (Crisp White Editorial Surface + High-Contrast Text)
         ========================================================= */}
      <section className="sf-card-white bg-white border border-[#E4E2DA] rounded-2xl p-6 sm:p-8 lg:p-10 relative overflow-hidden">
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-5">
            <h1 className="font-serif-editorial text-3xl sm:text-4xl lg:text-[42px] leading-[1.12] text-[#171717] tracking-tight">
              Welcome back, {displayGreetingName}. Your university timetable workspace is ready.
            </h1>

            <p className="text-[#55544E] text-sm sm:text-base max-w-2xl leading-relaxed">
              Manage {store.departments.length} departments ({store.studentGroups.length} sections), generate conflict-free class and laboratory schedules, and export directly to Google Sheets.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                onClick={handleQuickGenerate}
                disabled={isQuickSolving}
                className="btn-primary h-10 px-5 text-xs sm:text-sm"
              >
                <Sparkles className="w-4 h-4" />
                <span>
                  {isQuickSolving ? 'Solving University Timetable...' : 'Generate Full Timetable'}
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

          {/* Right: Live Timetable Status Card */}
          <div className="lg:col-span-5 bg-[#F7F6EF] border border-[#E4E2DA] rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#171717]">Active Schedule Status</span>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#171717]">
                {unscheduledSections.length === 0 ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Conflict-Free</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{unscheduledSections.length} Unassigned</span>
                  </>
                )}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-white border border-[#E4E2DA]">
                <div className="text-xs font-medium text-[#77766F]">Sections Placed</div>
                <div className="font-serif-editorial text-2xl sm:text-3xl text-[#171717] mt-0.5">
                  {scheduledSections.length}{' '}
                  <span className="text-sm font-sans text-[#77766F]">/ {store.sections.length}</span>
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-white border border-[#E4E2DA]">
                <div className="text-xs font-medium text-[#77766F]">Lectures & Labs</div>
                <div className="font-serif-editorial text-2xl sm:text-3xl text-[#171717] mt-0.5">
                  {lectureSectionsCount}L · {labSectionsCount}Lab
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-medium text-[#171717]">
                <span>Timetable Coverage ({activeTiming.operatingHoursLabel})</span>
                <span className="font-mono-tabular font-semibold">{completionPct}%</span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-[#E4E2DA] overflow-hidden">
                <div
                  className="h-full bg-[#171717] transition-all duration-500"
                  style={{ width: `${completionPct}%` }}
                />
              </div>
            </div>

            <div className="pt-1 flex items-center justify-between text-[11.5px] text-[#77766F]">
              <span>
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

      {/* =========================================================
          2. FOUR CORE WORKFLOW MODULES
         ========================================================= */}
      <section className="space-y-3">
        <h2 className="font-serif-editorial text-2xl text-[#171717]">Core Workflows</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Module 1: Data & Setup */}
          <div
            onClick={() => onNavigate('setup')}
            className="sf-pastel-cyan rounded-2xl p-5 flex flex-col justify-between cursor-pointer hover:shadow-md transition-all group"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#171717] text-white flex items-center justify-center">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif-editorial text-xl text-[#171717]">
                  Academic Data &amp; Setup
                </h3>
                <p className="text-xs text-[#171717]/80 mt-1 leading-relaxed">
                  {store.departments.length} departments, {store.rooms.length} facilities, {store.courses.length} courses, {store.studentGroups.length} sections.
                </p>
              </div>
            </div>
            <div className="pt-3 mt-3 flex items-center justify-between text-xs font-semibold text-[#171717]">
              <span>Manage Records</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>

          {/* Module 2: Academic Configuration */}
          <div
            onClick={() => onNavigate('academic-config')}
            className="sf-pastel-lavender rounded-2xl p-5 flex flex-col justify-between cursor-pointer hover:shadow-md transition-all group"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#171717] text-white flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif-editorial text-xl text-[#171717]">
                  Academic Configuration
                </h3>
                <p className="text-xs text-[#171717]/80 mt-1 leading-relaxed">
                  Operating hours ({activeTiming.operatingHoursLabel}), lecture &amp; lab durations, and midday break window.
                </p>
              </div>
            </div>
            <div className="pt-3 mt-3 flex items-center justify-between text-xs font-semibold text-[#171717]">
              <span>Configure Timings</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>

          {/* Module 3: Generate Schedule */}
          <div
            onClick={() => onNavigate('generate')}
            className="sf-pastel-mint rounded-2xl p-5 flex flex-col justify-between cursor-pointer hover:shadow-md transition-all group"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#171717] text-white flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif-editorial text-xl text-[#171717]">
                  Generate Schedule
                </h3>
                <p className="text-xs text-[#171717]/80 mt-1 leading-relaxed">
                  Scope selection, calendar terms, and constraint synthesis across all academic cohorts.
                </p>
              </div>
            </div>
            <div className="pt-3 mt-3 flex items-center justify-between text-xs font-semibold text-[#171717]">
              <span>Configure &amp; Run</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>

          {/* Module 4: Timetables & Google Sheets Export */}
          <div
            onClick={() => onNavigate('timetables')}
            className="sf-pastel-lime rounded-2xl p-5 flex flex-col justify-between cursor-pointer hover:shadow-md transition-all group"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#171717] text-white flex items-center justify-center">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif-editorial text-xl text-[#171717]">
                  Timetables &amp; Sheets
                </h3>
                <p className="text-xs text-[#171717]/80 mt-1 leading-relaxed">
                  Weekly matrix view across classes, faculty, and rooms with multi-tab Google Sheets export.
                </p>
              </div>
            </div>
            <div className="pt-3 mt-3 flex items-center justify-between text-xs font-semibold text-[#171717]">
              <span>Open Grid</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          3. INSTITUTIONAL DATASET INVENTORY (Clean Table without Redundant Badges)
         ========================================================= */}
      <section className="sf-card-white overflow-hidden">
        <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E4E2DA]">
          <h3 className="font-serif-editorial text-xl text-[#171717]">
            University Dataset Inventory
          </h3>
          <button
            onClick={() => onNavigate('setup')}
            className="btn-secondary text-xs py-1.5 px-3.5 shrink-0"
          >
            Open Full Catalog Setup
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F7F6EF] border-b border-[#E4E2DA] text-[11px] font-semibold uppercase tracking-wider text-[#77766F]">
                <th className="py-3 px-5">Catalog Category</th>
                <th className="py-3 px-4">Active Records</th>
                <th className="py-3 px-4">Institutional Breakdown</th>
                <th className="py-3 px-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E2DA] text-xs">
              {[
                {
                  label: 'Departments & Semesters',
                  count: store.departments.length,
                  unit: 'Departments',
                  sub: `${store.terms.filter(t => t.status === 'active').length} Active Semesters (${activeTerm?.name || 'Fall 2026'})`,
                  icon: Layers,
                  step: 0
                },
                {
                  label: 'Classrooms & Laboratories',
                  count: store.rooms.length,
                  unit: 'Facilities',
                  sub: `${store.rooms.filter(r => r.type === 'lecture').length} Lecture Rooms · ${store.rooms.filter(r => r.type === 'lab').length} Specialized Labs`,
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
                  sub: `Across ${store.departments.length} academic departments`,
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
                  sub: `${lectureSectionsCount} Lectures (${activeTiming.periodLengthMinutes}m) · ${labSectionsCount} Labs (${labHoursLabel}h continuous)`,
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
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#F7F6EF] border border-[#E4E2DA] flex items-center justify-center text-[#171717] shrink-0">
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="font-semibold text-[#171717] group-hover:underline">
                          {item.label}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-serif-editorial text-lg font-bold text-[#171717] mr-1.5">
                        {item.count}
                      </span>
                      <span className="text-[11px] text-[#77766F]">{item.unit}</span>
                    </td>
                    <td className="py-3.5 px-4 text-[#57564F]">{item.sub}</td>
                    <td className="py-3.5 px-5 text-right">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#171717] group-hover:translate-x-0.5 transition-transform">
                        <span>Manage Rows</span>
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
