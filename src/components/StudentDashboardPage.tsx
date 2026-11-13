import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Vote,
  Sliders,
  Clock,
  GraduationCap,
  CheckCircle2,
  ArrowRight,
  Download,
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
import { resolveUserCohort } from '../utils/userTimetableScope';

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

  // Strictly match student's exact cohort/section (no unrelated fallback)
  const matchedCohort = resolveUserCohort(syncedUser, store.studentGroups);

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
      filterClass: c => (matchedCohort ? c.studentGroupId === matchedCohort.id : false),
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
      <div className="space-y-6 pb-12">
        <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-[#E4E2DA]">
          <div className="space-y-1">
            <div className="text-xs font-medium text-[#77766F]">
              {syncedUser.batchCode || 'Academic Cohort'} · {syncedUser.section || 'Section A'}
            </div>
            <h1 className="font-serif-editorial text-3xl text-[#171717] tracking-tight">
              Schedule &amp; Voting Preferences
            </h1>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('student-dashboard')}
            className="btn-secondary text-xs h-9 px-3.5 shrink-0"
          >
            Back to Dashboard
          </button>
        </header>

        {prefsSavedNotice && (
          <div className="px-4 py-2.5 rounded-xl bg-[#E8F8E0] border border-[#A5E087] text-[#1B5E20] text-xs font-semibold flex items-center gap-2 max-w-3xl">
            <Check className="w-4 h-4 shrink-0" />
            <span>Your personal preferences have been saved.</span>
          </div>
        )}

        <form
          onSubmit={handleSavePreferences}
          className="bg-white border border-[#E4E2DA] rounded-2xl p-6 space-y-6 max-w-3xl"
        >
          <div className="space-y-5">
            <h2 className="font-serif-editorial text-xl text-[#171717] border-b border-[#E4E2DA] pb-3">
              Timetable Display
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

            <div className="border border-[#E4E2DA] rounded-xl divide-y divide-[#E4E2DA]">
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
                  desc: 'Show reminders on your dashboard when active batch questions are awaiting your vote.'
                }
              ].map(item => (
                <label
                  key={item.key}
                  className="flex items-center justify-between gap-4 px-4 py-3.5 cursor-pointer hover:bg-[#F7F6EF]/50 transition-colors"
                >
                  <div>
                    <div className="text-xs font-semibold text-[#171717]">{item.title}</div>
                    <div className="text-[11px] text-[#77766F] mt-0.5">{item.desc}</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefs[item.key]}
                    onChange={e =>
                      setPrefs(prev => ({ ...prev, [item.key]: e.target.checked }))
                    }
                    className="w-4 h-4 rounded border-[#E4E2DA] shrink-0"
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-[#E4E2DA]">
            <button type="submit" className="btn-primary py-2.5 px-5 text-xs font-semibold">
              <Sliders className="w-4 h-4" />
              <span>Save Preferences</span>
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
    <div className="space-y-6 pb-12">
      {/* 1. Student Hero & Enrollment Summary */}
      <section className="bg-white border border-[#E4E2DA] rounded-2xl p-6 sm:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#77766F]">
              <span className="font-semibold text-[#171717]">
                {store.institutionProfile?.name || 'Western Polytechnic'}
              </span>
              <span>·</span>
              <span>{activeTerm?.name || 'Fall 2026'}</span>
              <span>·</span>
              <span className="font-mono-tabular font-semibold text-[#171717]">
                {syncedUser.registrationNumber || '2K25-BSCS-014'}
              </span>
            </div>

            <h1 className="font-serif-editorial text-3xl sm:text-4xl leading-[1.12] text-[#171717] tracking-tight">
              Welcome, {syncedUser.name}.
            </h1>

            <p className="text-sm text-[#57564F]">
              <strong className="text-[#171717]">
                {syncedUser.batchCode || '2K25-BSCS'} ({syncedUser.batchName || 'BS Computer Science'})
              </strong>{' '}
              · <strong className="text-[#171717]">{syncedUser.section || 'Section A'}</strong>
            </p>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => onNavigate('timetables')}
                className="btn-primary h-9 px-4 text-xs"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Open My Timetable</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('student-voting')}
                className="btn-secondary h-9 px-4 text-xs"
              >
                <Vote className="w-3.5 h-3.5" />
                <span>Student Voting ({activePolls.length} Active)</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('student-preferences')}
                className="btn-secondary h-9 px-3.5 text-xs"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>My Preferences</span>
              </button>

              <button
                type="button"
                onClick={handleExportMyTimetable}
                className="h-9 px-3.5 rounded-xl bg-[#B7F77C] hover:bg-[#a5eb68] border border-[#98DF58] text-[#171717] font-semibold text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Schedule (.xlsx)</span>
              </button>
            </div>
          </div>

          {/* Right 5 Columns: Crisp Hairline Enrollment Summary */}
          <div className="lg:col-span-5 border border-[#E4E2DA] rounded-xl divide-y divide-[#E4E2DA] overflow-hidden">
            <div className="px-4 py-3 bg-[#F7F6EF]/60 flex items-center justify-between">
              <div className="text-xs font-semibold text-[#171717]">
                Enrollment Summary · {syncedUser.batchCode || '2K25-BSCS'}
              </div>
              <GraduationCap className="w-4 h-4 text-[#77766F]" />
            </div>

            <div className="grid grid-cols-2 divide-x divide-[#E4E2DA]">
              <div className="px-4 py-3">
                <div className="text-[11px] text-[#77766F]">Weekly Sessions</div>
                <div className="font-mono-tabular text-lg font-bold text-[#171717] mt-0.5">
                  {cohortLecturesCount}L · {cohortLabsCount}Lab
                </div>
              </div>
              <div className="px-4 py-3">
                <div className="text-[11px] text-[#77766F]">Batch Polls Voted</div>
                <div className="font-mono-tabular text-lg font-bold text-[#171717] mt-0.5">
                  {participatedPolls.length} / {polls.length}
                </div>
              </div>
            </div>

            {studentBatch && (
              <div className="px-4 py-3 space-y-1 text-xs">
                <div className="flex items-center justify-between text-[#57564F]">
                  <span>Male BR</span>
                  <span className="font-semibold text-[#171717]">
                    {studentBatch.maleRepresentative?.name.replace(/\s*\(.*\)$/, '') || 'Unassigned'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[#57564F]">
                  <span>Female BR</span>
                  <span className="font-semibold text-[#171717]">
                    {studentBatch.femaleRepresentative?.name.replace(/\s*\(.*\)$/, '') || 'Unassigned'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 2. Active Batch Polls + Schedule Timings */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 Columns: Active Batch Questions */}
        <div className="lg:col-span-7 bg-white border border-[#E4E2DA] rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#E4E2DA] pb-3.5">
            <div>
              <h3 className="font-serif-editorial text-xl text-[#171717]">
                Active Batch Questions
              </h3>
              {pendingMyVotePolls.length > 0 && (
                <p className="text-xs text-[#77766F] mt-0.5">
                  {pendingMyVotePolls.length} awaiting your vote
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onNavigate('student-voting')}
              className="btn-secondary text-xs py-1.5 px-3"
            >
              <span>View All Polls</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {loadingPolls ? (
            <div className="space-y-3">
              {[1, 2].map(n => (
                <div key={n} className="h-16 rounded-xl bg-[#F7F6EF] animate-pulse" />
              ))}
            </div>
          ) : activePolls.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#77766F]">
              No active voting questions are open right now.
            </div>
          ) : (
            <div className="divide-y divide-[#E4E2DA] border border-[#E4E2DA] rounded-xl">
              {activePolls.slice(0, 3).map(poll => (
                <div
                  key={poll.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="text-[11px] text-[#77766F]">
                      <span className="font-mono-tabular font-semibold text-[#171717]">{poll.batchCode}</span>
                      {' · '}
                      <span>{poll.submittedByName}</span>
                    </div>
                    <div className="text-sm font-semibold text-[#171717]">{poll.title}</div>
                    {poll.description && (
                      <div className="text-xs text-[#57564F] line-clamp-1">{poll.description}</div>
                    )}
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
                        className="btn-primary py-1.5 px-3.5 text-xs font-semibold"
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

        {/* Right 5 Columns: University Schedule Timings */}
        <div className="lg:col-span-5 bg-white border border-[#E4E2DA] rounded-2xl p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[#E4E2DA] pb-3.5">
              <div>
                <h3 className="font-serif-editorial text-xl text-[#171717]">
                  Schedule Timings
                </h3>
                <p className="text-xs text-[#77766F]">
                  {activeTerm?.name || 'Fall 2026'} · {activeTiming.workingDays.join('–')}
                </p>
              </div>
              <Clock className="w-4 h-4 text-[#77766F]" />
            </div>

            <div className="border border-[#E4E2DA] rounded-xl divide-y divide-[#E4E2DA] text-xs">
              <div className="flex items-center justify-between px-3.5 py-2.5">
                <span className="text-[#57564F]">Operating Hours</span>
                <span className="font-mono-tabular font-semibold text-[#171717]">
                  {activeTiming.operatingHoursLabel}
                </span>
              </div>
              <div className="flex items-center justify-between px-3.5 py-2.5">
                <span className="text-[#57564F]">Lecture &amp; Break</span>
                <span className="font-mono-tabular font-semibold text-[#171717]">
                  {activeTiming.periodLengthMinutes}m
                  {activeTiming.shortBreakEnabled && activeTiming.shortBreakMinutes > 0
                    ? ` + ${activeTiming.shortBreakMinutes}m break`
                    : ''}
                </span>
              </div>
              <div className="flex items-center justify-between px-3.5 py-2.5">
                <span className="text-[#57564F]">Midday Break</span>
                <span className="font-mono-tabular font-semibold text-[#171717]">
                  {activeTiming.middayBreak.enabled
                    ? activeTiming.middayBreak.timeRangeLabel
                    : 'Disabled'}
                </span>
              </div>
              <div className="flex items-center justify-between px-3.5 py-2.5">
                <span className="text-[#57564F]">Friday / Jummah</span>
                <span className="font-mono-tabular font-semibold text-[#171717] text-right">
                  {activeTiming.fridaySchedule.summaryText}
                </span>
              </div>
              <div className="flex items-center justify-between px-3.5 py-2.5">
                <span className="text-[#57564F]">Laboratory Block</span>
                <span className="font-mono-tabular font-semibold text-[#171717]">
                  {labHoursLabel}h ({activeTiming.labDurationMinutes}m)
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('timetables')}
            className="w-full btn-secondary text-xs py-2.5 justify-center"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Open Weekly Class Timetable</span>
          </button>
        </div>
      </section>
    </div>
  );
};
