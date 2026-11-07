import React, { useState, useId } from 'react';
import { RouteType } from './SmartGridNav';
import { useInstitutionalData, institutionalStore } from '../data/store';
import { buildMatrixSchedule } from '../data/solverAdapter';
import { Check, AlertCircle } from 'lucide-react';

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

  // 1. Data computation for the 6 setup steps
  const activeTerm = store.terms.find(t => t.status === 'active') || store.terms[0];
  const step1Ready = !!(activeTerm && store.timeStructure.periods.length > 0);
  const step1Text = activeTerm 
    ? `${activeTerm.name.replace('Term 2 (Spring 2026)', 'Spring 2026')} | Mon-Fri, 09:00-17:00, 30-min grid`
    : 'Needs term dates and hours configuration';

  const lectureRooms = store.rooms.filter(r => r.type === 'lecture');
  const labRooms = store.rooms.filter(r => r.type === 'lab');
  const seminarRooms = store.rooms.filter(r => r.type === 'seminar' || r.type === 'studio');
  const totalSeats = store.rooms.reduce((acc, r) => acc + (r.capacity || 0), 0);
  const step2Ready = store.rooms.length > 0;
  const step2Text = step2Ready 
    ? `${store.rooms.length} rooms: ${lectureRooms.length} lecture, ${labRooms.length} labs, ${seminarRooms.length} seminar | ${totalSeats.toLocaleString()} seats`
    : 'No rooms configured';

  const uniqueDepartments = new Set(store.courses.map(c => c.departmentId)).size;
  const totalWeeklyHours = store.courses.reduce((acc, c) => acc + (c.weeklyContactHours || 0), 0);
  const step3Ready = store.courses.length > 0;
  const step3Text = step3Ready
    ? `${store.courses.length} courses across ${uniqueDepartments || 3} departments | ${totalWeeklyHours} weekly hours`
    : 'No courses configured';

  const totalInstructorLoad = store.instructors.reduce((acc, i) => acc + (i.maxWeeklyHours || 0), 0);
  const avgInstructorLoad = store.instructors.length > 0 ? Math.round(totalInstructorLoad / store.instructors.length) : 0;
  const step4Ready = store.instructors.length > 0;
  const step4Text = step4Ready
    ? `${store.instructors.length} instructors | average load ${avgInstructorLoad} h/week`
    : 'No instructors configured';

  const totalStudents = store.studentGroups.reduce((acc, g) => acc + (g.size || 0), 0);
  const step5Ready = store.studentGroups.length > 0;
  const step5Text = step5Ready
    ? `${store.studentGroups.length} groups | ${totalStudents.toLocaleString()} students`
    : 'No student groups configured';

  const hardRulesCount = store.constraints.filter(c => c.kind === 'hard' && c.enabled).length;
  const softRulesCount = store.constraints.filter(c => c.kind === 'soft' && c.enabled).length;
  const step6Ready = store.constraints.length > 0;
  const step6Text = step6Ready
    ? `${hardRulesCount} must-have rules | ${softRulesCount} preferences`
    : 'No rules configured';

  const allSetupReady = step1Ready && step2Ready && step3Ready && step4Ready && step5Ready && step6Ready;

  // Setup items list
  const setupItems = [
    { num: 1, title: 'Term and time slots', detail: step1Text, ready: step1Ready },
    { num: 2, title: 'Rooms', detail: step2Text, ready: step2Ready },
    { num: 3, title: 'Courses', detail: step3Text, ready: step3Ready },
    { num: 4, title: 'Instructors', detail: step4Text, ready: step4Ready },
    { num: 5, title: 'Student groups', detail: step5Text, ready: step5Ready },
    { num: 6, title: 'Rules', detail: step6Text, ready: step6Ready }
  ];

  // If incomplete, sort incomplete items to top
  const sortedSetupItems = allSetupReady 
    ? setupItems 
    : [...setupItems].sort((a, b) => (a.ready === b.ready ? 0 : a.ready ? 1 : -1));

  // Collapsible state: if all 6 ready, collapsed by default
  const [setupExpanded, setSetupExpanded] = useState(!allSetupReady);

  // 2. Real calculations for "Will it fit?" chart
  // Teaching hours per day: 09:00 to 17:00 (8 hrs) minus lunch break (1 hr) = 7 teaching hours/day
  const workingDaysCount = store.timeStructure.workingDays.length || 5;
  const hoursPerRoomPerWeek = 7 * workingDaysCount; // 35 hours/week

  const lectureRoomsAvail = lectureRooms.length * hoursPerRoomPerWeek;
  const labsAvail = labRooms.length * hoursPerRoomPerWeek;
  const instructorsAvail = totalInstructorLoad;

  // Needed hours computed from active sections or courses
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

  // Computed plain-English takeaway
  let takeawayTitle = "There is plenty of room capacity";
  if (labPct >= lecturePct && labPct >= instPct) {
    takeawayTitle = labPct > 80 ? "Labs are the tightest resource" : "There is plenty of lab and room capacity";
  } else if (instPct >= lecturePct && instPct >= labPct) {
    takeawayTitle = instPct > 80 ? "Instructor load is the tightest resource" : "There is plenty of faculty capacity";
  } else if (lecturePct > 80) {
    takeawayTitle = "Lecture halls are heavily utilized";
  }

  const chartGroups = [
    {
      name: 'Lecture rooms',
      needed: lectureHoursNeeded,
      available: lectureRoomsAvail,
      pct: lecturePct
    },
    {
      name: 'Labs',
      needed: labHoursNeeded,
      available: labsAvail,
      pct: labPct
    },
    {
      name: 'Instructors',
      needed: instructorHoursNeeded,
      available: instructorsAvail,
      pct: instPct
    }
  ];

  // Scale maximum for bar widths
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

  // Check if data changed since latest timetable
  const lastUpdated = latestScenario ? new Date(latestScenario.updatedAt || latestScenario.createdAt).getTime() : 0;
  const hasDataChanged = store.auditLogs.some(log => new Date(log.timestamp).getTime() > lastUpdated);

  // 4. Row 0: Real Needs Attention issues (at most 3 lines)
  const attentionIssues: Array<{ message: string; stepIndex: number }> = [];
  if (labHoursNeeded > labsAvail && labsAvail > 0) {
    attentionIssues.push({
      message: `Labs: ${labHoursNeeded} hours needed weekly exceeds ${labsAvail} hours total lab availability.`,
      stepIndex: 1 // Rooms
    });
  }
  const unplacedSections = store.sections.filter(s => !s.assignedSlot);
  if (unplacedSections.length > 0) {
    attentionIssues.push({
      message: `${unplacedSections.length} sections are not yet allocated to rooms and time periods.`,
      stepIndex: 0 // Term & Slots / Generate
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
      message: `${overbookedInstructors.length} instructor exceeds registered weekly workload cap.`,
      stepIndex: 3 // Instructors
    });
  }

  // 5. Primary button label and action
  let primaryActionLabel = "Continue setup";
  let handlePrimaryAction = () => {
    const firstIncomplete = setupItems.findIndex(s => !s.ready);
    onOpenSetupStep?.(firstIncomplete !== -1 ? firstIncomplete : 0);
    onNavigate('setup');
  };

  if (allSetupReady) {
    if (latestScenario) {
      primaryActionLabel = "Open timetables";
      handlePrimaryAction = () => onNavigate('timetables');
    } else {
      primaryActionLabel = "Generate timetable";
      handlePrimaryAction = () => onNavigate('generate');
    }
  }

  const handleEditStep = (stepNumber: number) => {
    onOpenSetupStep?.(stepNumber - 1);
    onNavigate('setup');
  };

  const isSampleLoaded = institutionalStore.isSampleDataLoaded();

  const handleLoadSampleData = () => {
    if (institutionalStore.hasRealData()) {
      if (!window.confirm('Real data already exists. Add the realistic sample dataset alongside your existing data without overwriting anything?')) {
        return;
      }
    }
    institutionalStore.loadSampleData();
  };

  const chartAriaLabel = `Resource capacity comparison: Lecture rooms ${lecturePct}% used (${lectureHoursNeeded} of ${lectureRoomsAvail} hours), Labs ${labPct}% used (${labHoursNeeded} of ${labsAvail} hours), Instructors ${instPct}% used (${instructorHoursNeeded} of ${instructorsAvail} hours).`;

  return (
    <div className="w-full max-w-[1200px] px-6 lg:px-10 py-8 lg:py-10 space-y-6 text-[#1B2430]">
      {/* Page Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E8EAEE]">
        <div>
          <h1 className="text-[28px] font-semibold text-[#1B2430] tracking-tight">
            Home
          </h1>
          <p className="text-[16px] text-[#556070] mt-0.5">
            Review your timetable data readiness before generating the schedule.
          </p>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          {!isSampleLoaded ? (
            <button
              type="button"
              onClick={handleLoadSampleData}
              className="text-[13px] font-medium text-[#556070] hover:text-[#1B2430] underline underline-offset-2 transition-colors cursor-pointer"
            >
              Load sample data
            </button>
          ) : (
            <span className="text-[12px] font-medium text-[#059669] bg-[#ECFDF5] border border-[#A7F3D0] px-2 py-0.5 rounded">
              Sample data active
            </span>
          )}
          {hasDataChanged && latestScenario && (
            <span className="text-[14px] text-[#7A8594] hidden md:inline">
              Data changed since the last timetable
            </span>
          )}
          <button
            onClick={handlePrimaryAction}
            className="btn-primary"
          >
            {primaryActionLabel}
          </button>
        </div>
      </div>

      {/* Row 0: Optional "Needs attention" list (rendered only when real issues exist) */}
      {attentionIssues.length > 0 && (
        <div className="content-card p-4 border border-[#FDE68A] bg-[#FFFBEB] rounded-lg space-y-2">
          <div className="text-[14px] font-semibold text-[#92400E] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#B45309] shrink-0" />
            <span>Needs attention</span>
          </div>
          <ul className="space-y-1.5 pl-6 list-disc text-[14px] text-[#78350F]">
            {attentionIssues.slice(0, 3).map((issue, idx) => (
              <li key={idx} className="leading-snug">
                <span>{issue.message} </span>
                <button
                  onClick={() => handleEditStep(issue.stepIndex + 1)}
                  className="font-medium underline hover:text-[#1B2430] cursor-pointer ml-1"
                >
                  Fix
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Row 1: Two Columns (2/3 + 1/3, 24px gap on desktop, stacked below 1024px) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT (2/3): Chart Card "Will it fit?" */}
        <div className="lg:col-span-2 content-card p-6 flex flex-col justify-between">
          <div className="space-y-1">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[18px] font-semibold text-[#1B2430]">
                  {allSetupReady ? takeawayTitle : 'Will it fit?'}
                </h2>
                <p className="text-[14px] text-[#556070] mt-0.5">
                  Hours needed across all scheduled sections compared with weekly campus facility and faculty limits.
                </p>
              </div>

              {allSetupReady && (
                <div className="flex items-center gap-4 text-[13px] shrink-0 pt-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-xs bg-[#4A6785]" />
                    <span className="text-[#556070]">Needed</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-xs bg-[#D9E0E8]" />
                    <span className="text-[#556070]">Available</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Chart Content Area */}
          <div className="py-6">
            {!allSetupReady ? (
              <div className="py-10 text-center space-y-2">
                <p className="text-[15px] text-[#556070]">
                  Add rooms and courses to see whether they fit.
                </p>
                <button
                  onClick={handlePrimaryAction}
                  className="text-[14px] text-[#1B2430] font-medium underline cursor-pointer"
                >
                  Continue to next missing step
                </button>
              </div>
            ) : viewTableMode ? (
              /* Accessible Table View */
              <div className="border border-[#E8EAEE] rounded-md overflow-hidden">
                <table className="w-full text-left text-[14px]">
                  <thead className="bg-[#F6F7F9] text-[#556070] border-b border-[#E8EAEE]">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">Resource</th>
                      <th className="py-2.5 px-4 font-semibold font-mono">Needed</th>
                      <th className="py-2.5 px-4 font-semibold font-mono">Available</th>
                      <th className="py-2.5 px-4 font-semibold font-mono text-right">Utilization</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8EAEE]">
                    {chartGroups.map(grp => (
                      <tr key={grp.name} className="hover:bg-[#F6F7F9]">
                        <td className="py-2.5 px-4 font-medium text-[#1B2430]">{grp.name}</td>
                        <td className="py-2.5 px-4 font-mono text-[#556070]">{grp.needed} h/week</td>
                        <td className="py-2.5 px-4 font-mono text-[#556070]">{grp.available} h/week</td>
                        <td className="py-2.5 px-4 font-mono font-medium text-right text-[#1B2430]">{grp.pct}% used</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Grouped Horizontal Bar Chart */
              <div 
                className="space-y-6"
                role="img"
                aria-label={chartAriaLabel}
              >
                {chartGroups.map(grp => {
                  const neededWidthPct = Math.min(100, Math.max(4, Math.round((grp.needed / maxBarValue) * 100)));
                  const availWidthPct = Math.min(100, Math.max(4, Math.round((grp.available / maxBarValue) * 100)));

                  // Over-capacity coloring rules
                  const isOverCapacity = grp.needed > grp.available;
                  const isHighUtilization = grp.pct > 85;
                  const neededBarColor = isOverCapacity 
                    ? 'bg-[#DC2626]' 
                    : (isHighUtilization ? 'bg-[#B45309]' : 'bg-[#4A6785]');

                  return (
                    <div key={grp.name} className="space-y-1.5">
                      <div className="flex items-center justify-between text-[14px]">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-[#1B2430]">{grp.name}</span>
                          {isOverCapacity && (
                            <span className="text-[12px] font-semibold text-[#DC2626] bg-[#FEF2F2] px-1.5 py-0.2 rounded border border-[#FECACA]">
                              Over capacity
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-[14px] text-[#556070] font-medium">
                          {grp.pct}% used
                        </span>
                      </div>

                      {/* Grouped Horizontal Bars */}
                      <div className="space-y-1 relative group">
                        {/* Needed Bar */}
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-[#F6F7F9] h-5 rounded-[4px] overflow-hidden flex items-center">
                            <div
                              className={`${neededBarColor} h-full rounded-[4px] transition-all duration-200 ease-out`}
                              style={{ width: `${neededWidthPct}%` }}
                              onMouseEnter={() => setHoveredBar(`${grp.name}-needed`)}
                              onMouseLeave={() => setHoveredBar(null)}
                            />
                          </div>
                          <span className="font-mono text-[14px] font-medium text-[#1B2430] w-12 text-right shrink-0">
                            {grp.needed} h
                          </span>
                        </div>

                        {/* Available Bar */}
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-[#F6F7F9] h-5 rounded-[4px] overflow-hidden flex items-center">
                            <div
                              className="bg-[#D9E0E8] h-full rounded-[4px] transition-all duration-200 ease-out"
                              style={{ width: `${availWidthPct}%` }}
                              onMouseEnter={() => setHoveredBar(`${grp.name}-avail`)}
                              onMouseLeave={() => setHoveredBar(null)}
                            />
                          </div>
                          <span className="font-mono text-[14px] text-[#7A8594] w-12 text-right shrink-0">
                            {grp.available} h
                          </span>
                        </div>

                        {/* Hover Tooltip */}
                        {hoveredBar && hoveredBar.startsWith(grp.name) && (
                          <div className="absolute left-1/3 -top-8 z-20 px-2.5 py-1 bg-[#1B2430] text-white text-[13px] rounded shadow-md pointer-events-none">
                            {grp.needed} hours needed of {grp.available} hours available weekly ({grp.pct}%)
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Toggle Accessible View */}
          {allSetupReady && (
            <div className="pt-2 border-t border-[#E8EAEE] flex justify-between items-center text-[13px] text-[#7A8594]">
              <span>Grid scale: 35h capacity per room/week</span>
              <button
                type="button"
                onClick={() => setViewTableMode(!viewTableMode)}
                className="text-[13px] text-[#556070] hover:text-[#1B2430] underline cursor-pointer"
              >
                {viewTableMode ? 'View as chart' : 'View as table'}
              </button>
            </div>
          )}
        </div>

        {/* RIGHT (1/3): "Latest timetable" card */}
        <div className="lg:col-span-1 content-card p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <h2 className="text-[18px] font-semibold text-[#1B2430]">
              Latest timetable
            </h2>

            {!latestScenario ? (
              <p className="text-[15px] text-[#556070] py-6">
                No timetable yet.
              </p>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1">
                  <div className="text-[15px] font-semibold text-[#1B2430]">
                    {activeTerm?.name || 'Spring 2026'}
                  </div>
                  <div className="text-[13px] text-[#556070]">
                    {latestScenario.name}
                  </div>
                  <div className="text-[13px] text-[#7A8594] pt-0.5">
                    {latestScenario.status === 'published' ? 'Published' : 'Draft'} on{' '}
                    {new Date(latestScenario.updatedAt || latestScenario.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}{' '}
                    by {latestScenario.author}
                  </div>
                </div>

                {/* Three Plain Numbers in a row */}
                <div className="grid grid-cols-3 gap-2 pt-3 pb-2 border-y border-[#E8EAEE]">
                  <div>
                    <div className="text-[12px] text-[#7A8594]">Placed</div>
                    <div className="text-[22px] font-bold font-mono text-[#1B2430] mt-0.5">
                      {placedCount}
                    </div>
                  </div>
                  <div>
                    <div className="text-[12px] text-[#7A8594]">Unplaced</div>
                    <div className="text-[22px] font-bold font-mono text-[#1B2430] mt-0.5">
                      {unplacedCount}
                    </div>
                  </div>
                  <div>
                    <div className="text-[12px] text-[#7A8594]">Conflicts</div>
                    <div className={`text-[22px] font-bold font-mono mt-0.5 ${conflictCount > 0 ? 'text-[#DC2626]' : 'text-[#15803D]'}`}>
                      {conflictCount}
                    </div>
                    {conflictCount > 0 && (
                      <span className="text-[11px] font-semibold text-[#DC2626]">
                        conflicts
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {latestScenario && (
            <div className="pt-4 border-t border-[#E8EAEE]">
              <button
                type="button"
                onClick={() => onNavigate('timetables')}
                className="text-[14px] font-medium text-[#1B2430] hover:underline cursor-pointer"
              >
                View timetable
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Row 2: "Setup" card, full width */}
      <div className="content-card p-6 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-[#E8EAEE]">
          <div className="flex items-center gap-3">
            <h2 className="text-[18px] font-semibold text-[#1B2430]">
              Setup
            </h2>
            <span className="text-[14px] text-[#556070]">
              {setupItems.filter(s => s.ready).length} of 6 complete
            </span>
          </div>

          {allSetupReady && (
            <button
              type="button"
              onClick={() => setSetupExpanded(!setupExpanded)}
              className="text-[14px] font-medium text-[#1B2430] hover:underline cursor-pointer"
            >
              {setupExpanded ? 'Collapse' : 'Review'}
            </button>
          )}
        </div>

        {/* 2-Column Grid (3 rows x 2 columns) */}
        {setupExpanded && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sortedSetupItems.map(step => (
              <div
                key={step.num}
                className="p-4 border border-[#E8EAEE] rounded-md bg-white hover:bg-[#F6F7F9] transition-colors flex items-start justify-between gap-3 group"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-semibold ${
                    step.ready 
                      ? 'bg-[#15803D] text-white' 
                      : 'border border-[#B45309] text-[#B45309] bg-[#FFFBEB]'
                  }`}>
                    {step.ready ? (
                      <Check className="w-3 h-3 stroke-[3]" />
                    ) : (
                      '!'
                    )}
                  </div>

                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[15px] font-semibold text-[#1B2430]">
                        {step.title}
                      </span>
                      {!step.ready && (
                        <span className="text-[12px] font-medium text-[#B45309] bg-[#FFFBEB] px-1.5 py-0.2 rounded border border-[#FDE68A]">
                          Needs input
                        </span>
                      )}
                    </div>
                    <div className="text-[14px] text-[#556070] truncate">
                      {step.detail}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleEditStep(step.num)}
                  className="text-[14px] font-medium text-[#556070] hover:text-[#1B2430] underline cursor-pointer shrink-0 ml-2"
                >
                  Edit
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
