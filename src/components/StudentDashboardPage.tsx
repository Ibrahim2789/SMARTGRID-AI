import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Vote,
  Sliders,
  Clock,
  BookOpen,
  GraduationCap,
  CheckCircle2,
  ArrowRight,
  Download,
  UserCheck,
  Check
} from 'lucide-react';
import { RouteType } from './SmartGridNav';
import { useInstitutionalData } from '../data/store';
import { computeAcademicScheduleConfig } from '../types/institutional';
import { buildMatrixSchedule } from '../data/solverAdapter';
import { exportTimetableToGoogleSheetsWorkbook } from '../utils/googleSheetsExport';
import {
  AuthenticatedVotingUser,
  PollDTO,
  BatchDTO,
  fetchVotingOverview
} from '../services/votingApi';

interface StudentDashboardPageProps {
  currentUser: AuthenticatedVotingUser;
  subView?: 'dashboard' | 'preferences';
  onNavigate: (route: RouteType) => void;
  onUserSynced?: (user: AuthenticatedVotingUser) => void;
}

interface StudentPersonalPreferences {
  defaultTimetableView: 'cohort' | 'compact';
  showInstructorNames: boolean;
  showRoomCodes: boolean;
  highlightLabSessions: boolean;
  votingDeadlineAlerts: boolean;
  preferredSelfStudyWindow: 'morning' | 'midday' | 'afternoon';
}

const PREFS_STORAGE_KEY = 'smartgrid_student_personal_prefs_v1';

export const StudentDashboardPage: React.FC<StudentDashboardPageProps> = ({
  currentUser,
  subView = 'dashboard',
  onNavigate,
  onUserSynced
}) => {
  const store = useInstitutionalData();
  const activeTiming = computeAcademicScheduleConfig(store.timeStructure);
  const activeTerm = store.terms.find(t => t.status === 'active') || store.terms[0];

  const [polls, setPolls] = useState<PollDTO[]>([]);
  const [batches, setBatches] = useState<BatchDTO[]>([]);
  const [syncedUser, setSyncedUser] = useState<AuthenticatedVotingUser>(currentUser);
  const [loadingPolls, setLoadingPolls] = useState(true);

  const [prefs, setPrefs] = useState<StudentPersonalPreferences>(() => {
    try {
      const saved = localStorage.getItem(PREFS_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      defaultTimetableView: 'cohort',
      showInstructorNames: true,
      showRoomCodes: true,
      highlightLabSessions: true,
      votingDeadlineAlerts: true,
      preferredSelfStudyWindow: 'afternoon'
    };
  });
  const [prefsSavedNotice, setPrefsSavedNotice] = useState(false);

  const hasLoadedOnceRef = React.useRef(false);
  const currentUserRef = React.useRef(currentUser);
  currentUserRef.current = currentUser;
  const onUserSyncedRef = React.useRef(onUserSynced);
  onUserSyncedRef.current = onUserSynced;

  const loadStudentOverview = useCallback(async (showSkeleton = false) => {
    if (showSkeleton || !hasLoadedOnceRef.current) {
      setLoadingPolls(true);
    }
    try {
      const data = await fetchVotingOverview(currentUserRef.current);
      hasLoadedOnceRef.current = true;
      setPolls(data.polls);
      setBatches(data.batches);
      if (data.user) {
        setSyncedUser(data.user);
        onUserSyncedRef.current?.(data.user);
      }
    } catch {
      // Keep existing state
    } finally {
      setLoadingPolls(false);
    }
  }, [currentUser.id, currentUser.email]);

  useEffect(() => {
    loadStudentOverview(!hasLoadedOnceRef.current);
  }, [loadStudentOverview]);

  const studentBatch = batches.find(b => b.id === syncedUser.batchId) || null;

  // Match student's cohort in institutionalStore to show their real scheduled classes
  const matchedCohort =
    store.studentGroups.find(
      g =>
        syncedUser.batchCode &&
        g.name.toUpperCase().includes(syncedUser.batchCode.toUpperCase())
    ) || store.studentGroups[0];

  const cohortSections = matchedCohort
    ? store.sections.filter(s => s.studentGroupId === matchedCohort.id && s.assignedSlot)
    : [];

  const cohortLecturesCount = cohortSections.filter(s => s.sessionType !== 'Lab').length;
  const cohortLabsCount = cohortSections.filter(s => s.sessionType === 'Lab').length;

  const activePolls = polls.filter(p => p.isActiveVotingWindow);
  const pendingMyVotePolls = activePolls.filter(p => !p.hasVoted);
  const participatedPolls = polls.filter(p => p.hasVoted);

  const labHoursLabel = (activeTiming.labDurationMinutes / 60).toFixed(
    activeTiming.labDurationMinutes % 60 === 0 ? 0 : 1
  );

  const handleExportMyTimetable = async () => {
    const { scheduleData } = buildMatrixSchedule(store);
    await exportTimetableToGoogleSheetsWorkbook({
      store,
      scheduleData,
      filterClass: c => (matchedCohort ? c.studentGroupId === matchedCohort.id : true),
      scope: 'filtered',
      scopeLabel: matchedCohort?.name || syncedUser.batchCode || 'Student_Schedule',
      studentOrUserName: syncedUser.name
    });
  };

  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
    } catch {}
    setPrefsSavedNotice(true);
    setTimeout(() => setPrefsSavedNotice(false), 3000);
  };

  // =========================================================
  // SUB-VIEW: MY PREFERENCES (STUDENT PERSONAL SETTINGS)
  // =========================================================
  if (subView === 'preferences') {
    return (
      <div className="space-y-8 pb-14">
        <header className="bg-white border border-[#E4E2DA] rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-[#77766F]">
              Student Workspace · {syncedUser.batchCode || 'Academic Cohort'} ·{' '}
              {syncedUser.section || 'Section A'}
            </div>
            <h1 className="font-serif-editorial text-3xl sm:text-4xl text-[#171717]">
              My Schedule & Voting Preferences
            </h1>
            <p className="text-xs sm:text-sm text-[#57564F]">
              Customize how your weekly class timetable, laboratory blocks, and batch voting notifications are displayed.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('student-dashboard')}
            className="btn-secondary text-xs h-10 px-4 shrink-0"
          >
            Back to Student Dashboard
          </button>
        </header>

        {prefsSavedNotice && (
          <div className="p-4 rounded-2xl bg-[#E8F8E0] border border-[#A5E087] text-[#1B5E20] text-xs font-semibold flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>Your personal student preferences have been saved.</span>
          </div>
        )}

        <form
          onSubmit={handleSavePreferences}
          className="bg-white border border-[#E4E2DA] rounded-3xl p-6 sm:p-8 space-y-6 max-w-3xl"
        >
          <div className="space-y-4">
            <h2 className="font-serif-editorial text-2xl text-[#171717] border-b border-[#E4E2DA] pb-3">
              Timetable Display Preferences
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                  Default Timetable Layout
                </label>
                <select
                  value={prefs.defaultTimetableView}
                  onChange={e =>
                    setPrefs(prev => ({
                      ...prev,
                      defaultTimetableView: e.target.value as 'cohort' | 'compact'
                    }))
                  }
                  className="input-field h-10 text-xs"
                >
                  <option value="cohort">Landscape Weekly Cohort Grid</option>
                  <option value="compact">Compact Printable View</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                  Preferred Self-Study Window
                </label>
                <select
                  value={prefs.preferredSelfStudyWindow}
                  onChange={e =>
                    setPrefs(prev => ({
                      ...prev,
                      preferredSelfStudyWindow: e.target.value as
                        | 'morning'
                        | 'midday'
                        | 'afternoon'
                    }))
                  }
                  className="input-field h-10 text-xs"
                >
                  <option value="morning">Morning Free Slots (09:00 AM – 12:00 PM)</option>
                  <option value="midday">Around Midday Break (12:00 PM – 02:00 PM)</option>
                  <option value="afternoon">Afternoon Free Slots (02:00 PM – 05:00 PM)</option>
                </select>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              {[
                {
                  key: 'showInstructorNames' as const,
                  title: 'Display Course Instructor Names on Timetable Cells',
                  desc: 'Show the assigned faculty member inside each lecture and laboratory block.'
                },
                {
                  key: 'showRoomCodes' as const,
                  title: 'Display Lecture Hall & Laboratory Room Codes',
                  desc: 'Show building and room identifiers on your weekly schedule.'
                },
                {
                  key: 'highlightLabSessions' as const,
                  title: `Highlight Continuous ${labHoursLabel}-Hour Laboratory Sessions`,
                  desc: 'Apply distinct visual emphasis to multi-slot continuous laboratory sessions.'
                },
                {
                  key: 'votingDeadlineAlerts' as const,
                  title: 'Batch Representative Poll & Deadline Reminders',
                  desc: 'Show reminders on your Student Dashboard when active batch questions are awaiting your vote.'
                }
              ].map(item => (
                <label
                  key={item.key}
                  className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-[#F7F6EF] border border-[#E4E2DA] cursor-pointer"
                >
                  <div>
                    <div className="text-xs font-bold text-[#171717]">{item.title}</div>
                    <div className="text-[11px] text-[#57564F] mt-0.5">{item.desc}</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefs[item.key]}
                    onChange={e =>
                      setPrefs(prev => ({ ...prev, [item.key]: e.target.checked }))
                    }
                    className="w-4 h-4 rounded border-[#E4E2DA]"
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-[#E4E2DA]">
            <button type="submit" className="btn-primary py-2.5 px-6 text-xs font-semibold">
              <Sliders className="w-4 h-4" />
              <span>Save My Preferences</span>
            </button>
          </div>
        </form>
      </div>
    );
  }

  // =========================================================
  // DEFAULT SUB-VIEW: STUDENT DASHBOARD
  // =========================================================
  return (
    <div className="space-y-8 pb-14">
      {/* 1. Student Hero & Identity Banner */}
      <section className="bg-white border border-[#E4E2DA] rounded-3xl p-6 sm:p-8 lg:p-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#57564F]">
              <span className="font-semibold text-[#171717]">
                {store.institutionProfile?.name || 'Western Polytechnic'}
              </span>
              <span>·</span>
              <span>{activeTerm?.name || 'Fall 2026'}</span>
              <span>·</span>
              <span className="font-mono-tabular font-semibold text-[#171717]">
                Roll No: {syncedUser.registrationNumber || '2K25-BSCS-014'}
              </span>
            </div>

            <h1 className="font-serif-editorial text-3xl sm:text-4xl lg:text-[42px] leading-[1.12] text-[#171717] tracking-tight">
              Welcome, {syncedUser.name}.
            </h1>

            <p className="text-sm sm:text-base text-[#55544E] leading-relaxed max-w-2xl">
              You are enrolled in{' '}
              <strong className="text-[#171717]">
                {syncedUser.batchCode || '2K25-BSCS'} ({syncedUser.batchName || 'BS Computer Science'})
              </strong>{' '}
              · <strong className="text-[#171717]">{syncedUser.section || 'Section A'}</strong>. View your conflict-free weekly class schedule, participate in official batch polls, and manage your study preferences.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => onNavigate('timetables')}
                className="btn-primary h-10 px-5 text-xs sm:text-sm"
              >
                <Calendar className="w-4 h-4" />
                <span>Open My Timetable</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('student-voting')}
                className="btn-secondary h-10 px-5 text-xs sm:text-sm"
              >
                <Vote className="w-4 h-4" />
                <span>
                  Student Voting ({activePolls.length} Active)
                </span>
              </button>

              <button
                type="button"
                onClick={handleExportMyTimetable}
                className="h-10 px-4 rounded-xl bg-[#B7F77C] hover:bg-[#a5eb68] border border-[#98DF58] text-[#171717] font-semibold text-xs sm:text-sm inline-flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download Schedule (.xlsx)</span>
              </button>
            </div>
          </div>

          {/* Right 5 Columns: Student Cohort & Representation Summary */}
          <div className="lg:col-span-5 bg-[#F7F6EF] border border-[#E4E2DA] rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E4E2DA] pb-3">
              <div>
                <div className="text-xs font-bold text-[#171717]">
                  Student Enrollment Summary
                </div>
                <div className="text-[11px] text-[#77766F]">
                  {syncedUser.batchCode || '2K25-BSCS'} · {syncedUser.section || 'Section A'}
                </div>
              </div>
              <GraduationCap className="w-5 h-5 text-[#171717]" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-white border border-[#E4E2DA]">
                <div className="text-[11px] text-[#77766F]">Weekly Sessions</div>
                <div className="font-mono-tabular text-xl font-bold text-[#171717] mt-0.5">
                  {cohortLecturesCount} Lectures · {cohortLabsCount} Labs
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-white border border-[#E4E2DA]">
                <div className="text-[11px] text-[#77766F]">Batch Polls Voted</div>
                <div className="font-mono-tabular text-xl font-bold text-[#171717] mt-0.5">
                  {participatedPolls.length} / {polls.length} Polls
                </div>
              </div>
            </div>

            {studentBatch && (
              <div className="p-3.5 rounded-xl bg-white border border-[#E4E2DA] space-y-1.5 text-xs">
                <div className="text-[11px] font-semibold text-[#77766F]">
                  Your Batch Representatives ({studentBatch.code})
                </div>
                <div className="flex items-center justify-between text-[#171717]">
                  <span>Male BR:</span>
                  <span className="font-semibold">
                    {studentBatch.maleRepresentative?.name.replace(/\s*\(.*\)$/, '') ||
                      'Unassigned'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[#171717]">
                  <span>Female BR:</span>
                  <span className="font-semibold">
                    {studentBatch.femaleRepresentative?.name.replace(/\s*\(.*\)$/, '') ||
                      'Unassigned'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 2. Student Quick Action Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div
          onClick={() => onNavigate('timetables')}
          className="bg-white border border-[#E4E2DA] rounded-2xl p-6 flex flex-col justify-between cursor-pointer hover:border-[#171717] transition-colors group"
        >
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#B8EEEE] text-[#171717] flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif-editorial text-2xl text-[#171717]">My Timetable</h2>
              <p className="text-xs text-[#57564F] mt-1 leading-relaxed">
                View your complete weekly class and laboratory schedule across {activeTiming.workingDays.join('–')} ({activeTiming.operatingHoursLabel}).
              </p>
            </div>
          </div>
          <div className="pt-4 mt-4 border-t border-[#E4E2DA] flex items-center justify-between text-xs font-semibold text-[#171717]">
            <span>View Weekly Schedule</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        <div
          onClick={() => onNavigate('student-voting')}
          className="bg-white border border-[#E4E2DA] rounded-2xl p-6 flex flex-col justify-between cursor-pointer hover:border-[#171717] transition-colors group"
        >
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#B7F77C] text-[#171717] flex items-center justify-center">
              <Vote className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif-editorial text-2xl text-[#171717]">Student Voting</h2>
              <p className="text-xs text-[#57564F] mt-1 leading-relaxed">
                {pendingMyVotePolls.length > 0
                  ? `You have ${pendingMyVotePolls.length} active batch ${
                      pendingMyVotePolls.length === 1 ? 'question' : 'questions'
                    } awaiting your vote.`
                  : 'Review published batch questions and inspect finalized cohort voting results.'}
              </p>
            </div>
          </div>
          <div className="pt-4 mt-4 border-t border-[#E4E2DA] flex items-center justify-between text-xs font-semibold text-[#171717]">
            <span>Open Voting Portal</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        <div
          onClick={() => onNavigate('student-preferences')}
          className="bg-white border border-[#E4E2DA] rounded-2xl p-6 flex flex-col justify-between cursor-pointer hover:border-[#171717] transition-colors group"
        >
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#F2D8FA] text-[#171717] flex items-center justify-center">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif-editorial text-2xl text-[#171717]">My Preferences</h2>
              <p className="text-xs text-[#57564F] mt-1 leading-relaxed">
                Configure your personal timetable display options, preferred self-study blocks, and poll reminders.
              </p>
            </div>
          </div>
          <div className="pt-4 mt-4 border-t border-[#E4E2DA] flex items-center justify-between text-xs font-semibold text-[#171717]">
            <span>Customize Preferences</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      </section>

      {/* 3. Active Batch Polls + Relevant Academic Information */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 Columns: Active Batch Polls for Student */}
        <div className="lg:col-span-7 bg-white border border-[#E4E2DA] rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#E4E2DA] pb-3.5">
            <div>
              <h3 className="font-serif-editorial text-2xl text-[#171717]">
                Active Batch Questions
              </h3>
              <p className="text-xs text-[#77766F]">
                Questions published for student voting across your university cohort
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('student-voting')}
              className="btn-secondary text-xs py-1.5 px-3"
            >
              View All Polls
            </button>
          </div>

          {loadingPolls ? (
            <div className="space-y-3">
              {[1, 2].map(n => (
                <div key={n} className="h-20 rounded-2xl bg-[#F7F6EF] animate-pulse" />
              ))}
            </div>
          ) : activePolls.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#77766F]">
              No active voting questions are open right now.
            </div>
          ) : (
            <div className="space-y-3">
              {activePolls.slice(0, 3).map(poll => (
                <div
                  key={poll.id}
                  className="p-4 rounded-2xl bg-[#F7F6EF] border border-[#E4E2DA] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-[#57564F]">
                      <span className="font-bold text-[#171717]">{poll.batchCode}</span>
                      <span>·</span>
                      <span>{poll.submittedByName}</span>
                    </div>
                    <div className="text-sm font-bold text-[#171717]">{poll.title}</div>
                    <div className="text-xs text-[#57564F] line-clamp-1">{poll.description}</div>
                  </div>

                  <div className="shrink-0">
                    {poll.hasVoted ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1B5E20]">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Voted</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onNavigate('student-voting')}
                        className="btn-primary py-2 px-4 text-xs font-semibold"
                      >
                        Cast Vote
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right 5 Columns: Relevant Academic Information */}
        <div className="lg:col-span-5 bg-white border border-[#E4E2DA] rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#E4E2DA] pb-3.5">
            <div>
              <h3 className="font-serif-editorial text-2xl text-[#171717]">
                Academic Schedule Rules
              </h3>
              <p className="text-xs text-[#77766F]">
                Official university timing structure for {activeTerm?.name || 'Fall 2026'}
              </p>
            </div>
            <Clock className="w-4 h-4 text-[#77766F]" />
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3.5 rounded-2xl bg-[#F7F6EF] border border-[#E4E2DA] space-y-1">
              <div className="font-bold text-[#171717]">
                University Operating Hours ({activeTiming.operatingHoursLabel})
              </div>
              <p className="text-[#57564F]">
                Classes run across {activeTiming.workingDays.join(', ')}. Each regular lecture is{' '}
                <strong>{activeTiming.periodLengthMinutes} minutes</strong>
                {activeTiming.shortBreakEnabled && activeTiming.shortBreakMinutes > 0
                  ? ` followed by a ${activeTiming.shortBreakMinutes}-minute transition break.`
                  : '.'}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#F7F6EF] border border-[#E4E2DA] space-y-1">
              <div className="font-bold text-[#171717]">
                {activeTiming.middayBreak.enabled
                  ? `Protected Midday Break (${activeTiming.middayBreak.timeRangeLabel})`
                  : 'Continuous Schedule'}
              </div>
              <p className="text-[#57564F]">
                {activeTiming.middayBreak.enabled
                  ? `All cohorts have a protected ${activeTiming.middayBreak.durationMinutes}-minute midday break (${activeTiming.middayBreak.fullRangeLabel}) with zero scheduled lectures or labs.`
                  : 'Classes run continuously during operating hours.'}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#F7F6EF] border border-[#E4E2DA] space-y-1">
              <div className="font-bold text-[#171717]">
                Continuous {labHoursLabel}-Hour Laboratory Sessions
              </div>
              <p className="text-[#57564F]">
                Practical laboratory courses run for {activeTiming.labDurationMinutes} continuous minutes ({activeTiming.labSpanSlots} consecutive slots) in specialized laboratories.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
