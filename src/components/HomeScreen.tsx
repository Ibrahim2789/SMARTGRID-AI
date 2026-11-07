import React, { useState } from 'react';
import { RouteType } from './SmartGridNav';
import { useInstitutionalData, institutionalStore } from '../data/store';
import { buildMatrixSchedule } from '../data/solverAdapter';
import { 
  Check, 
  AlertCircle, 
  Building2, 
  BookOpen, 
  Users, 
  GraduationCap, 
  ArrowRight, 
  Cpu, 
  Calendar, 
  Sliders,
  Database,
  MessageSquare,
  Settings
} from 'lucide-react';

interface HomeScreenProps {
  onNavigate: (route: RouteType) => void;
  onOpenSetupStep?: (stepIndex: number) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ 
  onNavigate,
  onOpenSetupStep 
}) => {
  const store = useInstitutionalData();
  const [viewTableMode, setViewTableMode] = useState(false);
  const [hoveredBar, setHoveredBar] = useState<string | null>(null);
  const [sampleNotice, setSampleNotice] = useState<string | null>(null);

  // 1. Data computation for the 7 setup steps
  const activeTerm = store.terms.find(t => t.status === 'active') || store.terms[0];
  const step1Ready = !!(activeTerm && store.timeStructure.periods.length > 0);
  const step1Text = activeTerm 
    ? `${activeTerm.name} · ${store.timeStructure.workingDays.join(', ')} · ${store.timeStructure.periods.length} daily periods`
    : 'Needs term dates and hours configuration';

  const step2Ready = store.departments.length > 0;
  const step2Text = step2Ready
    ? `${store.departments.length} academic departments · ${store.programs.length} degree programs`
    : 'No departments configured';

  const lectureRooms = store.rooms.filter(r => r.type === 'lecture');
  const labRooms = store.rooms.filter(r => r.type === 'lab');
  const seminarRooms = store.rooms.filter(r => r.type === 'seminar' || r.type === 'studio');
  const totalSeats = store.rooms.reduce((acc, r) => acc + (r.capacity || 0), 0);
  const step3Ready = store.rooms.length > 0;
  const step3Text = step3Ready 
    ? `${store.rooms.length} rooms (${lectureRooms.length} lecture, ${labRooms.length} labs, ${seminarRooms.length} studios) · ${totalSeats.toLocaleString()} seats`
    : 'No rooms configured';

  const uniqueDepartments = new Set(store.courses.map(c => c.departmentId)).size;
  const totalWeeklyHours = store.courses.reduce((acc, c) => acc + (c.weeklyContactHours || 0), 0);
  const step4Ready = store.courses.length > 0;
  const step4Text = step4Ready
    ? `${store.courses.length} catalog courses across ${uniqueDepartments || store.departments.length} depts · ${totalWeeklyHours} weekly hrs`
    : 'No courses configured';

  const totalInstructorLoad = store.instructors.reduce((acc, i) => acc + (i.maxWeeklyHours || 0), 0);
  const avgInstructorLoad = store.instructors.length > 0 ? Math.round(totalInstructorLoad / store.instructors.length) : 0;
  const step5Ready = store.instructors.length > 0;
  const step5Text = step5Ready
    ? `${store.instructors.length} faculty members · avg max load ${avgInstructorLoad} hrs/wk`
    : 'No instructors configured';

  const totalStudents = store.studentGroups.reduce((acc, g) => acc + (g.size || 0), 0);
  const step6Ready = store.studentGroups.length > 0;
  const step6Text = step6Ready
    ? `${store.studentGroups.length} student cohorts (${totalStudents.toLocaleString()} students) · ${store.sections.length} course sections`
    : 'No student groups configured';

  const hardRulesCount = store.constraints.filter(c => c.kind === 'hard' && c.enabled).length;
  const softRulesCount = store.constraints.filter(c => c.kind === 'soft' && c.enabled).length;
  const step7Ready = store.constraints.length > 0;
  const step7Text = step7Ready
    ? `${hardRulesCount} hard feasibility rules · ${softRulesCount} soft optimization weights`
    : 'No rules configured';

  const allSetupReady = step1Ready && step2Ready && step3Ready && step4Ready && step5Ready && step6Ready && step7Ready;

  const setupItems = [
    { num: 1, stepIdx: 0, title: '01. Term & Time Grid', detail: step1Text, ready: step1Ready },
    { num: 2, stepIdx: 1, title: '02. Departments & Programs', detail: step2Text, ready: step2Ready },
    { num: 3, stepIdx: 2, title: '03. Rooms & Facilities', detail: step3Text, ready: step3Ready },
    { num: 4, stepIdx: 3, title: '04. Courses Catalog', detail: step4Text, ready: step4Ready },
    { num: 5, stepIdx: 4, title: '05. Faculty & Availability', detail: step5Text, ready: step5Ready },
    { num: 6, stepIdx: 5, title: '06. Student Cohorts & Sections', detail: step6Text, ready: step6Ready },
    { num: 7, stepIdx: 6, title: '07. Constraints & Rules', detail: step7Text, ready: step7Ready }
  ];

  // 2. Real calculations for "Will it fit?" chart
  const workingDaysCount = store.timeStructure.workingDays.length || 5;
  const hoursPerRoomPerWeek = 7 * workingDaysCount;

  const lectureRoomsAvail = lectureRooms.length * hoursPerRoomPerWeek;
  const labsAvail = labRooms.length * hoursPerRoomPerWeek;
  const instructorsAvail = totalInstructorLoad;

  const lectureHoursNeeded = store.sections.length > 0
    ? store.sections.reduce((sum, sec) => {
        const c = store.courses.find(item => item.id === sec.courseId);
        return sum + (c ? (c.requiredRoomType === 'lab' ? 0 : (c.lectureHours || c.weeklyContactHours)) : 3);
      }, 0)
    : store.courses.filter(c => c.requiredRoomType !== 'lab').reduce((sum, c) => sum + (c.lectureHours || c.weeklyContactHours), 0);

  const labHoursNeeded = store.sections.length > 0
    ? store.sections.reduce((sum, sec) => {
        const c = store.courses.find(item => item.id === sec.courseId);
        return sum + (c ? (c.requiredRoomType === 'lab' ? c.weeklyContactHours : (c.labHours || 0)) : 0);
      }, 0)
    : store.courses.filter(c => c.requiredRoomType === 'lab' || c.labHours > 0).reduce((sum, c) => sum + (c.labHours || c.weeklyContactHours), 0);

  const instructorHoursNeeded = store.sections.length > 0
    ? store.sections.reduce((sum, sec) => {
        const c = store.courses.find(item => item.id === sec.courseId);
        return sum + (c?.weeklyContactHours || 3);
      }, 0)
    : totalWeeklyHours;

  const lecturePct = lectureRoomsAvail > 0 ? Math.round((lectureHoursNeeded / lectureRoomsAvail) * 100) : 0;
  const labPct = labsAvail > 0 ? Math.round((labHoursNeeded / labsAvail) * 100) : 0;
  const instPct = instructorsAvail > 0 ? Math.round((instructorHoursNeeded / instructorsAvail) * 100) : 0;

  let takeawayTitle = 'Campus capacity is well balanced for generation';
  if (labPct >= lecturePct && labPct >= instPct && labPct > 80) {
    takeawayTitle = 'Laboratory facilities are the highest-demand resource';
  } else if (instPct >= lecturePct && instPct >= labPct && instPct > 80) {
    takeawayTitle = 'Faculty teaching hours are the tightest constraint';
  } else if (lecturePct > 80) {
    takeawayTitle = 'Lecture halls have high weekly utilization';
  }

  const chartGroups = [
    {
      name: 'Lecture Halls',
      needed: lectureHoursNeeded,
      available: lectureRoomsAvail,
      pct: lecturePct
    },
    {
      name: 'Specialized Labs',
      needed: labHoursNeeded,
      available: labsAvail,
      pct: labPct
    },
    {
      name: 'Faculty Teaching Hours',
      needed: instructorHoursNeeded,
      available: instructorsAvail,
      pct: instPct
    }
  ];

  const maxBarValue = Math.max(
    ...chartGroups.map(g => Math.max(g.needed, g.available)),
    100
  );

  // 3. Latest Timetable computation
  const latestScenario = store.scenarios && store.scenarios.length > 0 ? store.scenarios[0] : null;
  const { conflicts } = buildMatrixSchedule(store);
  const totalSections = store.sections.length;
  const placedCount = store.sections.filter(s => s.assignedSlot).length;
  const unplacedCount = totalSections - placedCount;
  const conflictCount = conflicts.length;

  // 4. Needs Attention diagnostics
  const attentionIssues: Array<{ message: string; stepIndex: number; actionLabel: string }> = [];
  if (labHoursNeeded > labsAvail && labsAvail > 0) {
    attentionIssues.push({
      message: `Labs: ${labHoursNeeded} weekly hours needed exceeds ${labsAvail} hours of available lab capacity.`,
      stepIndex: 2,
      actionLabel: 'Add Lab Room'
    });
  }
  if (unplacedCount > 0) {
    attentionIssues.push({
      message: `${unplacedCount} course sections are not yet placed on the timetable grid.`,
      stepIndex: 5,
      actionLabel: 'Run Solver'
    });
  }
  const overbookedInstructors = store.instructors.filter(inst => {
    const hoursTaught = store.sections
      .filter(s => s.instructorId === inst.id)
      .reduce((sum, s) => {
        const c = store.courses.find(course => course.id === s.courseId);
        return sum + (c?.weeklyContactHours || 3);
      }, 0);
    return hoursTaught > inst.maxWeeklyHours;
  });
  if (overbookedInstructors.length > 0) {
    attentionIssues.push({
      message: `${overbookedInstructors.length} instructor exceeds their maximum weekly teaching cap.`,
      stepIndex: 4,
      actionLabel: 'Review Faculty'
    });
  }

  const handleOpenStep = (stepIndex: number) => {
    onOpenSetupStep?.(stepIndex);
    onNavigate('setup');
  };

  const isSampleLoaded = institutionalStore.isSampleDataLoaded();

  const handleToggleSampleData = () => {
    if (isSampleLoaded) {
      institutionalStore.removeSampleData();
      setSampleNotice('Removed multi-department sample dataset and restored base campus records.');
    } else {
      institutionalStore.loadSampleData();
      setSampleNotice('Loaded realistic multi-department university dataset across all sections.');
    }
    setTimeout(() => setSampleNotice(null), 4000);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 text-[#1f1b20]">
      {/* Top Workspace Banner with Atmospheric Gradient Wash */}
      <div className="p-6 bg-gradient-to-br from-[#fff7f2] via-white to-[#faf4fc] border border-[#ece6ed] rounded-xl flex flex-col lg:flex-row lg:items-center justify-between gap-5 shadow-xs">
        <div className="space-y-1">
          <div className="text-xs font-mono text-[#9c4126] font-bold">
            {store.institutionProfile?.name || 'Western Polytechnic Institute'} · {activeTerm?.name || 'Spring 2026'}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1f1b20] tracking-tight">
            Institutional Scheduling Command Center
          </h1>
          <p className="text-sm text-[#655d69] max-w-2xl">
            Step through every workspace section below to configure campus resources, run the combinatorial solver, inspect and export timetables, and review campus feedback.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleToggleSampleData}
            className="btn-secondary text-xs"
          >
            <Database className="w-3.5 h-3.5 text-[#3b1e4a]" />
            <span>{isSampleLoaded ? 'Reset Sample Dataset' : 'Load Full Sample Dataset'}</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenStep(0)}
            className="btn-secondary text-xs"
          >
            <Sliders className="w-3.5 h-3.5 text-[#9c4126]" />
            <span>Configure Setup</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('generate')}
            className="btn-primary text-xs"
          >
            <Cpu className="w-4 h-4" />
            <span>Generate Timetable</span>
          </button>
        </div>
      </div>

      {sampleNotice && (
        <div className="p-3.5 rounded-xl bg-[#eefcf2] border border-[#ece6ed] text-xs text-[#0f5431] flex items-center gap-2 font-medium">
          <Check className="w-4 h-4 text-[#18794e]" />
          <span>{sampleNotice}</span>
        </div>
      )}

      {/* Guided 5-Stage End-to-End Workflow Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          {
            step: '01. Setup Data',
            title: 'Master Resources',
            desc: `${setupItems.filter(s => s.ready).length}/7 modules ready`,
            route: 'setup' as RouteType,
            icon: Database,
            tint: 'from-[#faf4fc] to-white'
          },
          {
            step: '02. Generate',
            title: 'Run Solver Studio',
            desc: `${store.sections.length} sections in scope`,
            route: 'generate' as RouteType,
            icon: Cpu,
            tint: 'from-[#fff7f2] to-white'
          },
          {
            step: '03. Timetables',
            title: 'Inspect & Export',
            desc: `${placedCount} placed · CSV & PDF`,
            route: 'timetables' as RouteType,
            icon: Calendar,
            tint: 'from-[#f1fbf5] to-white'
          },
          {
            step: '04. Feedback',
            title: 'Stakeholder Polls',
            desc: `${store.feedbackPolls?.length || 4} active reviews`,
            route: 'feedback' as RouteType,
            icon: MessageSquare,
            tint: 'from-[#fffbeb] to-white'
          },
          {
            step: '05. Settings',
            title: 'Profile & Backup',
            desc: `${store.auditLogs.length} audit events`,
            route: 'settings' as RouteType,
            icon: Settings,
            tint: 'from-[#fdf4f5] to-white'
          }
        ].map(card => {
          const Icon = card.icon;
          return (
            <button
              key={card.step}
              type="button"
              onClick={() => onNavigate(card.route)}
              className={`p-4 rounded-xl border border-[#ece6ed] hover:border-[#dcd9dd] bg-gradient-to-br ${card.tint} text-left transition-all hover:shadow-sm cursor-pointer flex flex-col justify-between group`}
            >
              <div className="flex items-center justify-between w-full mb-2">
                <span className="text-[11px] font-mono font-bold text-[#9c4126]">{card.step}</span>
                <Icon className="w-4 h-4 text-[#3b1e4a] group-hover:translate-x-0.5 transition-transform" />
              </div>
              <div>
                <div className="text-sm font-bold text-[#1f1b20]">{card.title}</div>
                <div className="text-xs text-[#655d69] mt-0.5">{card.desc}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Needs Attention Diagnostics */}
      {attentionIssues.length > 0 && (
        <div className="p-4 border border-[#ece6ed] bg-gradient-to-r from-[#fff7ed] to-white rounded-xl space-y-2">
          <div className="text-xs font-bold text-[#9a3412] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#b45309] shrink-0" />
            <span>Actionable Schedule Diagnostics</span>
          </div>
          <ul className="space-y-1.5 pl-6 list-disc text-xs text-[#78350f]">
            {attentionIssues.map((issue, idx) => (
              <li key={idx} className="leading-snug flex flex-wrap items-center justify-between gap-2">
                <span>{issue.message}</span>
                <button
                  onClick={() => {
                    if (issue.actionLabel === 'Run Solver') {
                      onNavigate('generate');
                    } else {
                      handleOpenStep(issue.stepIndex);
                    }
                  }}
                  className="font-bold text-[#9c4126] underline hover:text-[#1f1b20] cursor-pointer"
                >
                  {issue.actionLabel} →
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 4 Atmospheric Resource KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => handleOpenStep(2)}
          className="p-5 rounded-xl border border-[#ece6ed] hover:border-[#dcd9dd] bg-gradient-to-br from-[#faf4fc] via-white to-[#f3e8f8] cursor-pointer transition-all hover:shadow-sm space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#655d69]">Campus Rooms & Labs</span>
            <div className="w-8 h-8 rounded-xl bg-[#3b1e4a] text-white flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold font-mono text-[#1f1b20] tabular-nums">
            {store.rooms.length} <span className="text-xs font-sans font-normal text-[#655d69]">({totalSeats.toLocaleString()} seats)</span>
          </div>
          <div className="text-xs text-[#655d69]">
            {lectureRooms.length} lecture · {labRooms.length} labs · {seminarRooms.length} studios
          </div>
        </div>

        <div
          onClick={() => handleOpenStep(3)}
          className="p-5 rounded-xl border border-[#ece6ed] hover:border-[#dcd9dd] bg-gradient-to-br from-[#fff7f2] via-white to-[#ffede3] cursor-pointer transition-all hover:shadow-sm space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#655d69]">Courses & Sections</span>
            <div className="w-8 h-8 rounded-xl bg-[#9c4126] text-white flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold font-mono text-[#1f1b20] tabular-nums">
            {store.courses.length} <span className="text-xs font-sans font-normal text-[#655d69]">({store.sections.length} sections)</span>
          </div>
          <div className="text-xs text-[#655d69]">
            Across {store.departments.length} departments · {totalWeeklyHours} weekly hrs
          </div>
        </div>

        <div
          onClick={() => handleOpenStep(4)}
          className="p-5 rounded-xl border border-[#ece6ed] hover:border-[#dcd9dd] bg-gradient-to-br from-[#f1fbf5] via-white to-[#e5f6ec] cursor-pointer transition-all hover:shadow-sm space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#655d69]">Faculty Roster</span>
            <div className="w-8 h-8 rounded-xl bg-[#18794e] text-white flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold font-mono text-[#1f1b20] tabular-nums">
            {store.instructors.length} <span className="text-xs font-sans font-normal text-[#655d69]">({totalInstructorLoad}h cap)</span>
          </div>
          <div className="text-xs text-[#655d69]">
            Avg max load {avgInstructorLoad} hrs/wk · Click-to-mark availability
          </div>
        </div>

        <div
          onClick={() => handleOpenStep(5)}
          className="p-5 rounded-xl border border-[#ece6ed] hover:border-[#dcd9dd] bg-gradient-to-br from-[#fffbeb] via-white to-[#fef3c7] cursor-pointer transition-all hover:shadow-sm space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#655d69]">Student Cohorts</span>
            <div className="w-8 h-8 rounded-xl bg-[#f27438] text-white flex items-center justify-center">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold font-mono text-[#1f1b20] tabular-nums">
            {store.studentGroups.length} <span className="text-xs font-sans font-normal text-[#655d69]">({totalStudents.toLocaleString()} enrolled)</span>
          </div>
          <div className="text-xs text-[#655d69]">
            Synchronized zero-overlap cohort tracks
          </div>
        </div>
      </div>

      {/* Main Two-Column Row: "Will it fit?" Capacity Analyzer (2/3) + Latest Timetable Card (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT (2/3): Resource Capacity vs Demand Analyzer */}
        <div className="lg:col-span-2 content-card p-6 flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-[#ece6ed] pb-4">
            <div>
              <h2 className="text-lg font-bold text-[#1f1b20]">
                {takeawayTitle}
              </h2>
              <p className="text-xs text-[#655d69] mt-0.5">
                Weekly instructional hours required across all sections compared against campus room and faculty availability.
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs shrink-0 pt-0.5">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-[#3b1e4a]" />
                <span className="text-[#655d69] font-medium">Hours Needed</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-[#ece6ed]" />
                <span className="text-[#655d69] font-medium">Available Cap</span>
              </div>
            </div>
          </div>

          <div className="py-6">
            {viewTableMode ? (
              <div className="border border-[#ece6ed] rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#fbf8fc] text-[#655d69] border-b border-[#ece6ed]">
                    <tr>
                      <th className="py-3 px-4 font-bold">Resource Pool</th>
                      <th className="py-3 px-4 font-bold font-mono">Hours Needed</th>
                      <th className="py-3 px-4 font-bold font-mono">Weekly Capacity</th>
                      <th className="py-3 px-4 font-bold font-mono text-right">Utilization</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#ece6ed]">
                    {chartGroups.map(grp => (
                      <tr key={grp.name} className="hover:bg-[#fbf8fc]">
                        <td className="py-3 px-4 font-semibold text-[#1f1b20]">{grp.name}</td>
                        <td className="py-3 px-4 font-mono text-[#655d69]">{grp.needed} h/wk</td>
                        <td className="py-3 px-4 font-mono text-[#655d69]">{grp.available} h/wk</td>
                        <td className="py-3 px-4 font-mono font-bold text-right text-[#3b1e4a]">{grp.pct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="space-y-6">
                {chartGroups.map(grp => {
                  const neededWidthPct = Math.min(100, Math.max(5, Math.round((grp.needed / maxBarValue) * 100)));
                  const availWidthPct = Math.min(100, Math.max(5, Math.round((grp.available / maxBarValue) * 100)));

                  const isOverCapacity = grp.needed > grp.available;
                  const isHighUtilization = grp.pct > 85;
                  const neededBarColor = isOverCapacity 
                    ? 'bg-[#dc2626]' 
                    : (isHighUtilization ? 'bg-[#9c4126]' : 'bg-[#3b1e4a]');

                  return (
                    <div key={grp.name} className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#1f1b20]">{grp.name}</span>
                          {isOverCapacity && (
                            <span className="text-[11px] font-semibold text-[#dc2626]">
                              · Over capacity
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-xs text-[#655d69] font-semibold">
                          {grp.needed}h needed / {grp.available}h cap ({grp.pct}%)
                        </span>
                      </div>

                      <div className="space-y-1.5 relative">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 bg-[#f6f2f7] h-4 rounded-lg overflow-hidden flex items-center">
                            <div
                              className={`${neededBarColor} h-full rounded-lg transition-all duration-200 ease-out`}
                              style={{ width: `${neededWidthPct}%` }}
                              onMouseEnter={() => setHoveredBar(`${grp.name}-needed`)}
                              onMouseLeave={() => setHoveredBar(null)}
                            />
                          </div>
                          <span className="font-mono text-xs font-bold text-[#1f1b20] w-14 text-right shrink-0">
                            {grp.needed} h
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="flex-1 bg-[#f6f2f7] h-3 rounded-lg overflow-hidden flex items-center">
                            <div
                              className="bg-[#dcd4e0] h-full rounded-lg transition-all duration-200 ease-out"
                              style={{ width: `${availWidthPct}%` }}
                              onMouseEnter={() => setHoveredBar(`${grp.name}-avail`)}
                              onMouseLeave={() => setHoveredBar(null)}
                            />
                          </div>
                          <span className="font-mono text-xs text-[#7c747f] w-14 text-right shrink-0">
                            {grp.available} h
                          </span>
                        </div>

                        {hoveredBar && hoveredBar.startsWith(grp.name) && (
                          <div className="absolute left-1/4 -top-7 z-20 px-3 py-1 bg-[#3b1e4a] text-white text-xs rounded-lg shadow-md pointer-events-none">
                            {grp.name}: {grp.needed}h needed of {grp.available}h available ({grp.pct}%)
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-[#ece6ed] flex justify-between items-center text-xs text-[#7c747f]">
            <span>Baseline: {workingDaysCount} teaching days · 35h weekly availability per room</span>
            <button
              type="button"
              onClick={() => setViewTableMode(!viewTableMode)}
              className="text-xs font-semibold text-[#3b1e4a] hover:underline cursor-pointer"
            >
              {viewTableMode ? 'Switch to Bar Chart' : 'Switch to Tabular View'}
            </button>
          </div>
        </div>

        {/* RIGHT (1/3): Latest Generated Timetable Snapshot */}
        <div className="lg:col-span-1 content-card p-6 flex flex-col justify-between bg-gradient-to-b from-white to-[#faf4fc]/50">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[#ece6ed] pb-3">
              <h2 className="text-lg font-bold text-[#1f1b20]">
                Active Timetable Status
              </h2>
              <span className="text-xs font-mono font-bold text-[#18794e]">
                {latestScenario ? latestScenario.version : 'v1.0'}
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="text-sm font-bold text-[#1f1b20]">
                {latestScenario?.name || 'Master Campus Schedule'}
              </div>
              <div className="text-xs text-[#655d69]">
                {activeTerm?.name || 'Spring 2026'} · {latestScenario?.author || 'Dr. Katherine Reynolds'}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5 py-4 border-y border-[#ece6ed]">
              <div className="p-3 rounded-xl bg-white border border-[#ece6ed]">
                <div className="text-[11px] text-[#7c747f]">Placed</div>
                <div className="text-xl font-extrabold font-mono text-[#1f1b20] mt-0.5 tabular-nums">
                  {placedCount}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-white border border-[#ece6ed]">
                <div className="text-[11px] text-[#7c747f]">Unplaced</div>
                <div className="text-xl font-extrabold font-mono text-[#9c4126] mt-0.5 tabular-nums">
                  {unplacedCount}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-white border border-[#ece6ed]">
                <div className="text-[11px] text-[#7c747f]">Clashes</div>
                <div className={`text-xl font-extrabold font-mono mt-0.5 tabular-nums ${conflictCount > 0 ? 'text-[#dc2626]' : 'text-[#18794e]'}`}>
                  {conflictCount}
                </div>
              </div>
            </div>

            <div className="space-y-2 text-xs text-[#655d69]">
              <div className="flex justify-between">
                <span>Solver Satisfaction Score</span>
                <span className="font-mono font-bold text-[#18794e]">{latestScenario?.metrics?.satisfactionScore || 99.4}%</span>
              </div>
              <div className="flex justify-between">
                <span>Faculty Preference Match</span>
                <span className="font-mono font-bold text-[#1f1b20]">{latestScenario?.metrics?.instructorSatisfaction || 98.8}%</span>
              </div>
              <div className="flex justify-between">
                <span>Student Transit Score</span>
                <span className="font-mono font-bold text-[#1f1b20]">{latestScenario?.metrics?.studentTransitScore || 96.5}%</span>
              </div>
            </div>
          </div>

          <div className="pt-5 space-y-2">
            <button
              type="button"
              onClick={() => onNavigate('timetables')}
              className="w-full h-10 rounded-xl bg-[#3b1e4a] hover:bg-[#2a1335] text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <span>Inspect & Export Matrix</span>
              <ArrowRight className="w-4 h-4 text-[#f27438]" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('generate')}
              className="w-full h-9 rounded-xl border border-[#ece6ed] bg-white hover:bg-[#f6f2f7] text-[#3b1e4a] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Re-run Timetable Generator</span>
            </button>
          </div>
        </div>
      </div>

      {/* 7-Step Setup Checklist & Section Directory */}
      <div className="content-card p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[#ece6ed]">
          <div>
            <h2 className="text-lg font-bold text-[#1f1b20]">
              Master Data & Setup Checklist ({setupItems.filter(s => s.ready).length} of 7 Complete)
            </h2>
            <p className="text-xs text-[#655d69] mt-0.5">
              Click any module below to review, add, or modify institutional records before running the timetable generator.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleOpenStep(0)}
            className="text-xs font-bold text-[#9c4126] hover:underline inline-flex items-center gap-1 cursor-pointer"
          >
            <span>Open Guided Setup Wizard</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {setupItems.map(step => (
            <div
              key={step.num}
              onClick={() => handleOpenStep(step.stepIdx)}
              className="p-4 border border-[#ece6ed] hover:border-[#dcd9dd] rounded-xl bg-[#fbf8fc]/60 hover:bg-white transition-all flex items-start justify-between gap-3 cursor-pointer group"
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold ${
                  step.ready 
                    ? 'bg-[#18794e] text-white' 
                    : 'bg-[#fff7ed] text-[#9a3412] border border-[#fed7aa]'
                }`}>
                  {step.ready ? (
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  ) : (
                    step.num
                  )}
                </div>

                <div className="min-w-0 space-y-0.5">
                  <div className="text-sm font-bold text-[#1f1b20] group-hover:text-[#3b1e4a] transition-colors">
                    {step.title}
                  </div>
                  <div className="text-xs text-[#655d69] truncate">
                    {step.detail}
                  </div>
                </div>
              </div>

              <span className="text-xs font-semibold text-[#3b1e4a] group-hover:text-[#9c4126] shrink-0 pt-0.5">
                Configure →
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
