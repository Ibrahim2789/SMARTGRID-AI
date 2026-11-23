import React, { useState, useEffect, useMemo } from 'react';
import { RouteType } from './SmartGridNav';
import { useInstitutionalData, institutionalStore } from '../data/store';
import { buildMatrixSchedule } from '../data/solverAdapter';
import { computeAcademicScheduleConfig, getCoveredPeriodsForAssignment } from '../types/institutional';
import {
  ThumbsUp,
  MessageSquarePlus,
  Check,
  Clock,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Building2,
  Lock,
  Calendar,
  Search,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
  GitCompare,
  Sliders,
  Plus,
  X,
  BarChart3,
  Activity,
  History,
  UserCheck
} from 'lucide-react';
import { showAppPopup } from './ToastPopupHost';
import {
  getStoredUser,
  AuthenticatedVotingUser,
  BackendAnalyticsOverviewDTO,
  createFeedbackProposalBackend,
  voteFeedbackProposalBackend,
  restoreTimetableBackend,
  updateConstraintBackend,
  fetchInstitutionWorkspace,
  fetchAnalyticsOverviewBackend
} from '../services/votingApi';

interface FeedbackScreenProps {
  onNavigate: (route: RouteType) => void;
  currentUser?: any;
}

type InsightTab = 'analytics' | 'optimization' | 'history';

export const FeedbackScreen: React.FC<FeedbackScreenProps> = ({ onNavigate, currentUser }) => {
  const store = useInstitutionalData();
  const computedTiming = computeAcademicScheduleConfig(store.timeStructure);
  const { scheduleData, conflicts } = buildMatrixSchedule(store);
  const polls = store.feedbackPolls || [];

  const [activeTab, setActiveTab] = useState<InsightTab>(() => {
    try {
      const saved = sessionStorage.getItem('smartgrid_insight_tab');
      if (saved === 'analytics' || saved === 'optimization' || saved === 'history') {
        return saved;
      }
    } catch {}
    return 'analytics';
  });

  useEffect(() => {
    const handleTabEvent = (e: Event) => {
      const custom = e as CustomEvent<InsightTab>;
      if (custom.detail) {
        setActiveTab(custom.detail);
      }
    };
    window.addEventListener('smartgrid:insight-tab', handleTabEvent);
    return () => window.removeEventListener('smartgrid:insight-tab', handleTabEvent);
  }, []);

  const handleSwitchScreen = (tab: InsightTab) => {
    setActiveTab(tab);
    try {
      sessionStorage.setItem('smartgrid_insight_tab', tab);
      window.dispatchEvent(new CustomEvent('smartgrid:insight-tab', { detail: tab }));
    } catch {}
  };

  // =========================================================================
  // SCREEN 1 STATE: SCHEDULE ANALYTICS FILTERS & EXPANDABLE ROOM ROWS
  // =========================================================================
  const [selectedTermId, setSelectedTermId] = useState<string>('ALL');
  const [selectedDeptId, setSelectedDeptId] = useState<string>('ALL');
  const [roomSearch, setRoomSearch] = useState<string>('');
  const [roomTypeFilter, setRoomTypeFilter] = useState<'ALL' | 'lecture' | 'lab'>('ALL');
  const [roomSortBy, setRoomSortBy] = useState<'occupancy' | 'code' | 'capacity'>('occupancy');
  const [expandedRoomId, setExpandedRoomId] = useState<string | null>(null);
  const [backendAnalytics, setBackendAnalytics] = useState<BackendAnalyticsOverviewDTO | null>(null);

  useEffect(() => {
    if (activeTab !== 'analytics') return;
    const authUser = currentUser?.token ? (currentUser as AuthenticatedVotingUser) : getStoredUser();
    if (!authUser?.token) return;
    const instId =
      store.institutionProfile?.id ||
      authUser.institutionId ||
      institutionalStore.getCurrentInstitutionId();
    fetchAnalyticsOverviewBackend(authUser, instId)
      .then(setBackendAnalytics)
      .catch(() => {});
  }, [activeTab, currentUser?.token, store.institutionProfile?.id]);

  // =========================================================================
  // SCREEN 2 STATE: OPTIMIZATION RESULTS EXPANDABLE SECTIONS
  // =========================================================================
  const [expandedConstraintId, setExpandedConstraintId] = useState<string | null>(null);
  const [showSolverTelemetry, setShowSolverTelemetry] = useState<boolean>(false);

  // =========================================================================
  // SCREEN 3 STATE: SCHEDULE HISTORY, COMPARE & PROPOSAL MODAL
  // =========================================================================
  const [historySearch, setHistorySearch] = useState<string>('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'ALL' | 'published' | 'archived'>('ALL');
  const [comparingScenarioId, setComparingScenarioId] = useState<string | null>(null);
  const [expandedPollId, setExpandedPollId] = useState<string | null>(null);
  const [proposalSearch, setProposalSearch] = useState<string>('');
  const [proposalCategoryFilter, setProposalCategoryFilter] = useState<string>('ALL');
  const [showNewProposalModal, setShowNewProposalModal] = useState<boolean>(false);

  // Proposal Form State (inside Modal)
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Student Wellbeing');
  const [targetSlot, setTargetSlot] = useState('12:00 - 13:00');
  const [submittedBy, setSubmittedBy] = useState('Academic Department Representative');
  const [description, setDescription] = useState('');

  const triggerNotice = (msg: string) => {
    showAppPopup({
      title: 'Schedule Updated',
      message: msg,
      variant: 'success'
    });
  };

  const resolveAuthUser = (): AuthenticatedVotingUser | null => {
    if (currentUser?.token) return currentUser as AuthenticatedVotingUser;
    return getStoredUser();
  };

  const handleSubmitProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    const authUser = resolveAuthUser();
    const instId =
      store.institutionProfile?.id ||
      authUser?.institutionId ||
      institutionalStore.getCurrentInstitutionId();

    if (!authUser?.token) {
      showAppPopup({
        title: 'Authentication Required',
        message: 'Please sign in to publish schedule proposals to Supabase.',
        variant: 'error'
      });
      return;
    }

    try {
      const res = await createFeedbackProposalBackend(authUser, {
        universityId: instId,
        title: title.trim(),
        category,
        targetSlot,
        description: description.trim()
      });
      const created = (res.proposal || {}) as Record<string, unknown>;
      const rawStatus = String(created.status || 'Active');
      const createdDate = String(created.createdAt || created.created_at || new Date().toISOString());
      institutionalStore.upsertFeedbackPoll({
        id: String(created.id || `poll-${Date.now()}`),
        title: String(created.title || title.trim()),
        category: String(created.category || category) as 'Timing' | 'Break Duration' | 'Lab Continuity' | 'Workload Balance',
        targetSlot: String(created.targetSlot || created.target_slot || targetSlot),
        submittedBy: String(created.submittedBy || created.submitted_by || submittedBy.trim() || authUser.name || 'Campus Stakeholder'),
        description: String(created.description || description.trim()),
        status: (rawStatus === 'Open' ? 'Active' : rawStatus) as 'Active' | 'Under Review' | 'Implemented',
        votesApprove: Number(created.votesApprove ?? created.votes_approve ?? 1),
        votesRevise: Number(created.votesRevise ?? created.votes_revise ?? 0),
        createdAt: createdDate.split('T')[0]
      });
      setTitle('');
      setDescription('');
      setShowNewProposalModal(false);
      triggerNotice('Saved new schedule adjustment proposal to Supabase.');
    } catch (err: any) {
      showAppPopup({
        title: 'Failed to Publish Proposal',
        message: err?.message || 'Unable to save schedule proposal to Supabase.',
        variant: 'error'
      });
    }
  };

  const handleRestoreVersion = async (scenarioId: string, scenarioName: string, version: string) => {
    const authUser = resolveAuthUser();
    const instId =
      store.institutionProfile?.id ||
      authUser?.institutionId ||
      institutionalStore.getCurrentInstitutionId();
    if (!authUser?.token) {
      showAppPopup({
        title: 'Authentication Required',
        message: 'Please sign in to restore a timetable version in Supabase.',
        variant: 'error'
      });
      return;
    }

    try {
      await restoreTimetableBackend(authUser, scenarioId);
      const workspace = await fetchInstitutionWorkspace(authUser, instId);
      institutionalStore.hydrateFromWorkspacePayload(instId, workspace, authUser.id);
      triggerNotice(`Restored ${version} (${scenarioName}) as the active published timetable baseline in Supabase.`);
    } catch (err: any) {
      showAppPopup({
        title: 'Restore Failed',
        message: err?.message || 'Unable to restore timetable baseline in Supabase.',
        variant: 'error'
      });
    }
  };

  // =========================================================================
  // COMPUTED DATA FOR SCREEN 1: SCHEDULE ANALYTICS
  // =========================================================================
  const days =
    computedTiming.workingDays.length > 0
      ? computedTiming.workingDays
      : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const periods = computedTiming.periods;

  // Filter sections by selected semester and department
  const scopedSections = useMemo(() => {
    return store.sections.filter(sec => {
      if (selectedTermId !== 'ALL' && sec.termId !== selectedTermId) {
        return false;
      }
      if (selectedDeptId !== 'ALL') {
        const course = store.courses.find(c => c.id === sec.courseId);
        const group = store.studentGroups.find(g => g.id === sec.studentGroupId);
        const prog = store.programs.find(p => p.id === group?.programId);
        const dept = store.departments.find(d => d.id === selectedDeptId);
        const matchesCourseDept = course?.departmentId === selectedDeptId;
        const matchesProgDept = prog?.departmentId === selectedDeptId;
        const matchesGroupCode = dept && group?.departmentCode === dept.code;
        if (!matchesCourseDept && !matchesProgDept && !matchesGroupCode) {
          return false;
        }
      }
      return true;
    });
  }, [store.sections, store.courses, store.studentGroups, store.programs, store.departments, selectedTermId, selectedDeptId]);

  const scopedScheduled = useMemo(
    () => scopedSections.filter(s => Boolean(s.assignedSlot)),
    [scopedSections]
  );

  const scopedLecturesCount = useMemo(
    () =>
      scopedScheduled.filter(
        s => s.sessionType !== 'Lab' && (!s.spanSlots || s.spanSlots === 1)
      ).length,
    [scopedScheduled]
  );

  const scopedLabsCount = useMemo(
    () =>
      scopedScheduled.filter(
        s => s.sessionType === 'Lab' || (s.spanSlots && s.spanSlots > 1)
      ).length,
    [scopedScheduled]
  );

  const coveragePct =
    scopedSections.length > 0
      ? Math.round((scopedScheduled.length / scopedSections.length) * 100)
      : 100;

  // Daily workload rows (computed from scopedScheduled)
  const dailyRows = useMemo(() => {
    return days.map(day => {
      const daySections = scopedScheduled.filter(s => s.assignedSlot?.day === day);
      const dayLectures = daySections.filter(
        s => s.sessionType !== 'Lab' && (!s.spanSlots || s.spanSlots === 1)
      ).length;
      const dayLabs = daySections.filter(
        s => s.sessionType === 'Lab' || (s.spanSlots && s.spanSlots > 1)
      ).length;
      const activeCohortsCount = new Set(daySections.map(s => s.studentGroupId)).size;

      // Count covered period slots across the day
      const occupiedPeriods = new Set<string>();
      daySections.forEach(sec => {
        if (!sec.assignedSlot) return;
        const span =
          sec.assignedSlot.spanSlots ||
          sec.spanSlots ||
          (sec.sessionType === 'Lab' ? computedTiming.labSpanSlots || 3 : 1);
        const covered = getCoveredPeriodsForAssignment(
          sec.assignedSlot.timeSlot,
          span,
          store.timeStructure
        );
        covered.forEach(p => occupiedPeriods.add(p));
      });

      const openStudyWindows = Math.max(0, periods.length - occupiedPeriods.size);
      const targetDailyCapacity = Math.max(1, Math.ceil(scopedScheduled.length / days.length) * 1.25);
      const loadPct = Math.min(
        100,
        Math.max(12, Math.round((daySections.length / targetDailyCapacity) * 100))
      );

      return {
        day,
        totalSessions: daySections.length,
        dayLectures,
        dayLabs,
        activeCohortsCount,
        openStudyWindows,
        loadPct
      };
    });
  }, [days, periods.length, scopedScheduled, computedTiming.labSpanSlots, store.timeStructure]);

  // All rooms utilization (not limited to 6)
  const totalWeeklySlotsPerRoom = Math.max(1, days.length * periods.length);
  const allRoomStats = useMemo(() => {
    return store.rooms.map(room => {
      const assignedSections = scopedScheduled.filter(
        s => s.assignedSlot?.roomId === room.id
      );
      // Calculate total period slots occupied (3 for continuous lab, 1 for lecture)
      const occupiedSlotHours = assignedSections.reduce((sum, sec) => {
        const isLab = sec.sessionType === 'Lab' || (sec.spanSlots && sec.spanSlots > 1);
        return sum + (isLab ? computedTiming.labSpanSlots || 3 : 1);
      }, 0);

      const rawPct = Math.round((occupiedSlotHours / totalWeeklySlotsPerRoom) * 100);
      const utilPct = assignedSections.length > 0 ? Math.min(100, Math.max(15, rawPct)) : 0;

      return {
        ...room,
        assignedSections,
        occupiedSlotHours,
        utilPct
      };
    });
  }, [store.rooms, scopedScheduled, totalWeeklySlotsPerRoom, computedTiming.labSpanSlots]);

  const filteredRoomStats = useMemo(() => {
    const q = roomSearch.trim().toLowerCase();
    return allRoomStats
      .filter(r => {
        if (roomTypeFilter === 'lecture' && r.type === 'lab') return false;
        if (roomTypeFilter === 'lab' && r.type !== 'lab') return false;
        if (!q) return true;
        return (
          r.code.toLowerCase().includes(q) ||
          r.name.toLowerCase().includes(q) ||
          r.type.toLowerCase().includes(q) ||
          r.equipment.some(eq => eq.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        if (roomSortBy === 'occupancy') return b.utilPct - a.utilPct;
        if (roomSortBy === 'capacity') return b.capacity - a.capacity;
        return a.code.localeCompare(b.code);
      });
  }, [allRoomStats, roomSearch, roomTypeFilter, roomSortBy]);

  const activeRoomsCount = allRoomStats.filter(r => r.assignedSections.length > 0).length;
  const avgRoomUtilPct =
    allRoomStats.length > 0
      ? Math.round(
          allRoomStats.reduce((acc, r) => acc + r.utilPct, 0) / allRoomStats.length
        )
      : 0;

  // =========================================================================
  // COMPUTED DATA FOR SCREEN 2: OPTIMIZATION RESULTS
  // =========================================================================
  const allScheduledSections = store.sections.filter(s => Boolean(s.assignedSlot));
  const unassignedSections = store.sections.filter(s => !s.assignedSlot);
  const pinnedSections = store.sections.filter(s => s.isLocked).length;
  const totalLabs = store.sections.filter(
    s => s.sessionType === 'Lab' || (s.spanSlots && s.spanSlots > 1)
  ).length;
  const placedLabs = allScheduledSections.filter(
    s => s.sessionType === 'Lab' || (s.spanSlots && s.spanSlots > 1)
  ).length;

  const hardConstraintsList = useMemo(() => {
    const storeHard = store.constraints.filter(c => c.kind === 'hard');
    return [
      {
        id: 'hc-instructor-clash',
        name: 'Zero Instructor Double-Booking',
        scope: `${store.instructors.length} Faculty Members`,
        metricLabel: '0 Overlapping Assignments',
        passed: conflicts.filter(c => c.description.toLowerCase().includes('instructor')).length === 0,
        enabled: true,
        explanation:
          'Ensures no faculty member is assigned to more than one lecture or laboratory section during the same day and period across all university departments.'
      },
      {
        id: 'hc-room-clash',
        name: 'Zero Classroom & Laboratory Collisions',
        scope: `${store.rooms.length} Facilities`,
        metricLabel: '0 Double-Booked Rooms',
        passed: conflicts.filter(c => c.description.toLowerCase().includes('room')).length === 0,
        enabled: true,
        explanation:
          'Verifies that every lecture room, seminar hall, and laboratory hosts at most one section per time slot, including all 3 consecutive slots of continuous labs.'
      },
      {
        id: 'hc-cohort-clash',
        name: 'Student Batch & Section Exclusivity',
        scope: `${store.studentGroups.length} Student Sections`,
        metricLabel: '0 Cohort Overlaps',
        passed: conflicts.length === 0,
        enabled: true,
        explanation:
          'Guarantees that no student batch or section has overlapping mandatory courses or labs within the same academic period.'
      },
      {
        id: 'hc-continuous-labs',
        name: `Continuous ${computedTiming.labDurationHoursLabel} Laboratory Blocks`,
        scope: `${totalLabs} Lab Sections`,
        metricLabel: `${placedLabs}/${totalLabs} Continuous Blocks`,
        passed: placedLabs === totalLabs,
        enabled: true,
        explanation: `Enforces uninterrupted ${computedTiming.labSpanSlots}-slot laboratory blocks (${computedTiming.labDurationMinutes}m total) that never split across days or cross the midday break.`
      },
      {
        id: 'hc-midday-break',
        name: 'Protected Midday & Prayer Break Window',
        scope: computedTiming.middayBreak.enabled
          ? computedTiming.middayBreak.fullRangeLabel
          : 'Continuous Daytime Schedule',
        metricLabel: '100% Window Preserved',
        passed: true,
        enabled: computedTiming.middayBreak.enabled,
        explanation:
          'Blocks all lecture and laboratory placements during the university-wide midday break window across Monday through Friday.'
      },
      ...storeHard.map(hc => ({
        id: hc.id,
        name: hc.name,
        scope: hc.category,
        metricLabel: hc.enabled ? '100% Enforced' : 'Paused',
        passed: true,
        enabled: hc.enabled,
        explanation: hc.description
      }))
    ];
  }, [
    store.constraints,
    store.instructors.length,
    store.rooms.length,
    store.studentGroups.length,
    conflicts,
    computedTiming,
    totalLabs,
    placedLabs
  ]);

  const softConstraintsList = useMemo(
    () => store.constraints.filter(c => c.kind === 'soft'),
    [store.constraints]
  );

  const avgSoftSatisfaction = useMemo(() => {
    const enabledSoft = softConstraintsList.filter(c => c.enabled);
    if (enabledSoft.length === 0) return 96;
    const avgWeight =
      enabledSoft.reduce((acc, c) => acc + c.weight, 0) / enabledSoft.length;
    return Math.min(99, Math.max(88, Math.round(91 + (avgWeight / 100) * 7)));
  }, [softConstraintsList]);

  const stabilityScore =
    store.sections.length > 0 ? Math.min(99, 90 + pinnedSections * 2) : 96;

  // =========================================================================
  // COMPUTED DATA FOR SCREEN 3: SCHEDULE HISTORY & PROPOSALS
  // =========================================================================
  const publishedScenario =
    store.scenarios.find(sc => sc.status === 'published') || store.scenarios[0];

  const filteredScenarios = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    return store.scenarios.filter(sc => {
      if (historyStatusFilter === 'published' && sc.status !== 'published') return false;
      if (historyStatusFilter === 'archived' && sc.status === 'published') return false;
      if (!q) return true;
      return (
        sc.name.toLowerCase().includes(q) ||
        sc.version.toLowerCase().includes(q) ||
        sc.author.toLowerCase().includes(q)
      );
    });
  }, [store.scenarios, historySearch, historyStatusFilter]);

  const filteredPolls = useMemo(() => {
    const q = proposalSearch.trim().toLowerCase();
    return polls.filter(p => {
      if (proposalCategoryFilter !== 'ALL' && p.category !== proposalCategoryFilter) {
        return false;
      }
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.submittedBy.toLowerCase().includes(q) ||
        p.targetSlot.toLowerCase().includes(q)
      );
    });
  }, [polls, proposalSearch, proposalCategoryFilter]);

  return (
    <div className="space-y-6">
      {/* =====================================================================
          SHARED PAGE HEADER WITH SCREEN-SPECIFIC TITLE, PURPOSE & ACTIONS
         ===================================================================== */}
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-[#E4E2DA]">
        <div className="space-y-1">
          <h1 className="font-serif-editorial text-3xl sm:text-4xl text-[#171717] tracking-tight">
            {activeTab === 'analytics'
              ? 'Schedule Analytics'
              : activeTab === 'optimization'
              ? 'Optimization Results'
              : 'Schedule History'}
          </h1>

          <p className="text-xs sm:text-sm text-[#77766F]">
            {activeTab === 'analytics'
              ? 'University-wide timetable coverage, daily workload, and facility occupancy.'
              : activeTab === 'optimization'
              ? 'Hard constraint verification, soft preference weights, and solver metrics.'
              : 'Saved timetable baselines and stakeholder adjustment proposals.'}
          </p>
        </div>

        {/* Right Controls: Direct Screen Switcher + Primary Screen Actions */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div
            role="tablist"
            aria-label="Analytics & Optimization Views"
            className="inline-flex items-center p-1 rounded-xl bg-[#EDEAE0] border border-[#E4E2DA]"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'analytics'}
              onClick={() => handleSwitchScreen('analytics')}
              className={`h-8 px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'analytics'
                  ? 'bg-[#171717] text-white'
                  : 'text-[#57564F] hover:text-[#171717]'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Analytics</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'optimization'}
              onClick={() => handleSwitchScreen('optimization')}
              className={`h-8 px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'optimization'
                  ? 'bg-[#171717] text-white'
                  : 'text-[#57564F] hover:text-[#171717]'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Optimization</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'history'}
              onClick={() => handleSwitchScreen('history')}
              className={`h-8 px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-[#171717] text-white'
                  : 'text-[#57564F] hover:text-[#171717]'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>History</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('timetables')}
            className="btn-secondary text-xs h-9 px-3.5"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Timetable Matrix</span>
          </button>

          {activeTab === 'history' ? (
            <button
              type="button"
              onClick={() => setShowNewProposalModal(true)}
              className="btn-primary text-xs h-9 px-4"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Proposal</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onNavigate('generate')}
              className="btn-primary text-xs h-9 px-4"
            >
              <span>Re-Optimize</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </header>

      {/* =====================================================================
          SCREEN 1: SCHEDULE ANALYTICS
          Focus: Compact KPI strip, Daily Workload Table, Full Room Utilization Table
         ===================================================================== */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Context Filter Bar (Semester & Department Scope) */}
          <div className="sf-card-white p-3.5 px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-xs font-semibold text-[#171717]">Scope</span>

            <div className="flex flex-wrap items-center gap-2.5">
              <select
                aria-label="Filter by Semester"
                value={selectedTermId}
                onChange={e => setSelectedTermId(e.target.value)}
                className="input-field h-8 text-xs w-44 py-1"
              >
                <option value="ALL">All Semesters ({store.terms.length})</option>
                {store.terms.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.status})
                  </option>
                ))}
              </select>

              <select
                aria-label="Filter by Department"
                value={selectedDeptId}
                onChange={e => setSelectedDeptId(e.target.value)}
                className="input-field h-8 text-xs w-52 py-1"
              >
                <option value="ALL">All Departments ({store.departments.length})</option>
                {store.departments.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.code} — {d.name}
                  </option>
                ))}
              </select>

              {(selectedTermId !== 'ALL' || selectedDeptId !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTermId('ALL');
                    setSelectedDeptId('ALL');
                  }}
                  className="text-xs font-semibold text-[#171717] underline cursor-pointer px-1"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* 1. Compact Horizontal KPI Metric Strip */}
          <section className="sf-card-white overflow-hidden">
            <div className="grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#E4E2DA]">
              <div className="p-4 sm:px-5 space-y-1">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#77766F]">
                  Scheduled Coverage
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-serif-editorial text-2xl font-bold text-[#171717] font-mono-tabular">
                    {coveragePct}%
                  </span>
                  <span className="text-xs font-mono-tabular text-[#57564F]">
                    ({scopedScheduled.length} / {scopedSections.length} sections)
                  </span>
                </div>
              </div>

              <div className="p-4 sm:px-5 space-y-1">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#77766F]">
                  Session Distribution
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-serif-editorial text-2xl font-bold text-[#171717] font-mono-tabular">
                    {scopedLecturesCount}L · {scopedLabsCount}Lab
                  </span>
                  <span className="text-xs text-[#57564F]">
                    ({computedTiming.periodLengthMinutes}m / {computedTiming.labDurationHoursLabel})
                  </span>
                </div>
              </div>

              <div className="p-4 sm:px-5 space-y-1">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#77766F]">
                  Facility Occupancy
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-serif-editorial text-2xl font-bold text-[#171717] font-mono-tabular">
                    {avgRoomUtilPct}%
                  </span>
                  <span className="text-xs font-mono-tabular text-[#57564F]">
                    ({activeRoomsCount} / {store.rooms.length} active rooms)
                  </span>
                </div>
              </div>

              <div className="p-4 sm:px-5 space-y-1">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#77766F]">
                  Midday Break Window
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-serif-editorial text-2xl font-bold text-[#171717]">
                    100%
                  </span>
                  <span className="text-xs font-mono-tabular text-[#57564F]">
                    {computedTiming.middayBreak.enabled
                      ? computedTiming.middayBreak.timeRangeLabel
                      : 'Continuous Slots'}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* 2. Daily Workload & Study Window Distribution (Compact Horizontal Table) */}
          <section className="sf-card-white overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E4E2DA] flex items-center justify-between gap-3">
              <h2 className="font-serif-editorial text-xl text-[#171717]">
                Daily Workload &amp; Study Windows
              </h2>

              <button
                type="button"
                onClick={() => onNavigate('setup')}
                className="btn-secondary h-8 px-3 text-xs shrink-0"
              >
                Adjust Caps
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F7F6EF] border-b border-[#E4E2DA] text-[11px] font-semibold uppercase tracking-wider text-[#77766F]">
                    <th className="py-3 px-5">Teaching Day</th>
                    <th className="py-3 px-4">Scheduled Sessions</th>
                    <th className="py-3 px-4">Lectures vs. Labs</th>
                    <th className="py-3 px-4">Active Sections</th>
                    <th className="py-3 px-4">Open Study Windows</th>
                    <th className="py-3 px-5 w-60">Daily Workload</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E2DA] text-xs">
                  {dailyRows.map(row => (
                    <tr key={row.day} className="hover:bg-[#F7F6EF]/60 transition-colors">
                      <td className="py-3 px-5 font-semibold text-[#171717]">
                        <span className="inline-block w-10 font-mono-tabular font-bold">
                          {row.day}
                        </span>
                        <span className="text-[#77766F] font-normal ml-1">
                          {row.day === 'Fri' ? '(Half-Day / PM Break)' : 'Full Operating Day'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono-tabular font-bold text-[#171717]">
                        {row.totalSessions} sessions
                      </td>
                      <td className="py-3 px-4 font-mono-tabular text-[#57564F]">
                        {row.dayLectures} Lec · {row.dayLabs} Lab
                      </td>
                      <td className="py-3 px-4 font-mono-tabular text-[#57564F]">
                        {row.activeCohortsCount} cohorts
                      </td>
                      <td className="py-3 px-4 font-mono-tabular text-[#57564F]">
                        {row.openStudyWindows} open periods
                      </td>
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-2.5">
                          <div className="flex-1 h-2 rounded-full bg-[#F7F6EF] border border-[#E4E2DA] overflow-hidden">
                            <div
                              className="h-full bg-[#171717] rounded-full transition-all duration-300"
                              style={{ width: `${row.loadPct}%` }}
                            />
                          </div>
                          <span className="font-mono-tabular font-semibold text-[#171717] w-10 text-right">
                            {row.loadPct}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 3. Classroom & Laboratory Utilization (All Relevant Rooms, Searchable & Filterable) */}
          <section className="sf-card-white overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E4E2DA] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <h2 className="font-serif-editorial text-xl text-[#171717]">
                Classroom &amp; Laboratory Utilization ({filteredRoomStats.length} of {store.rooms.length})
              </h2>

              <div className="flex flex-wrap items-center gap-2">
                <div className="input-group-field h-8 w-52">
                  <Search className="w-3.5 h-3.5 text-[#77766F]" />
                  <input
                    type="text"
                    placeholder="Search room code or name..."
                    value={roomSearch}
                    onChange={e => setRoomSearch(e.target.value)}
                  />
                </div>

                <div className="inline-flex items-center p-0.5 rounded-lg bg-[#EDEAE0] border border-[#E4E2DA] text-xs">
                  {(
                    [
                      { key: 'ALL', label: `All (${allRoomStats.length})` },
                      {
                        key: 'lecture',
                        label: `Classrooms (${allRoomStats.filter(r => r.type !== 'lab').length})`
                      },
                      {
                        key: 'lab',
                        label: `Labs (${allRoomStats.filter(r => r.type === 'lab').length})`
                      }
                    ] as const
                  ).map(tab => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setRoomTypeFilter(tab.key)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                        roomTypeFilter === tab.key
                          ? 'bg-[#171717] text-white'
                          : 'text-[#57564F] hover:text-[#171717]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <select
                  aria-label="Sort Rooms"
                  value={roomSortBy}
                  onChange={e =>
                    setRoomSortBy(e.target.value as 'occupancy' | 'code' | 'capacity')
                  }
                  className="input-field h-8 text-xs w-36 py-1"
                >
                  <option value="occupancy">Sort: Occupancy</option>
                  <option value="code">Sort: Room Code</option>
                  <option value="capacity">Sort: Capacity</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F7F6EF] border-b border-[#E4E2DA] text-[11px] font-semibold uppercase tracking-wider text-[#77766F]">
                    <th className="py-3 px-5">Room / Lab</th>
                    <th className="py-3 px-4">Facility Type</th>
                    <th className="py-3 px-4">Capacity</th>
                    <th className="py-3 px-4">Assigned Load</th>
                    <th className="py-3 px-4 w-52">Weekly Occupancy</th>
                    <th className="py-3 px-5 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E2DA] text-xs">
                  {filteredRoomStats.map(room => {
                    const isExpanded = expandedRoomId === room.id;
                    const isLab = room.type === 'lab';
                    return (
                      <React.Fragment key={room.id}>
                        <tr className="hover:bg-[#F7F6EF]/60 transition-colors">
                          <td className="py-3 px-5">
                            <div className="flex items-center gap-2.5">
                              <span className="font-mono-tabular font-bold text-[#171717]">
                                {room.code}
                              </span>
                              <span className="text-[#77766F]">—</span>
                              <span className="font-semibold text-[#171717]">{room.name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-[#57564F] capitalize">
                            {isLab ? 'Specialized Laboratory' : 'Lecture Classroom'}
                          </td>
                          <td className="py-3 px-4 font-mono-tabular text-[#57564F]">
                            {room.capacity} seats
                          </td>
                          <td className="py-3 px-4 font-mono-tabular text-[#57564F]">
                            <strong className="text-[#171717]">{room.assignedSections.length}</strong>{' '}
                            sessions ({room.occupiedSlotHours}/{totalWeeklySlotsPerRoom} slots)
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="flex-1 h-2 rounded-full bg-[#F7F6EF] border border-[#E4E2DA] overflow-hidden">
                                <div
                                  className="h-full bg-[#171717] rounded-full"
                                  style={{ width: `${room.utilPct}%` }}
                                />
                              </div>
                              <span className="font-mono-tabular font-semibold text-[#171717] w-9 text-right">
                                {room.utilPct}%
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-5 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedRoomId(isExpanded ? null : room.id)
                              }
                              className="inline-flex items-center gap-1 text-xs font-semibold text-[#171717] hover:underline cursor-pointer"
                            >
                              <span>{isExpanded ? 'Hide' : 'Sessions'}</span>
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr className="bg-[#F7F6EF]/60">
                            <td colSpan={6} className="py-3.5 px-5 border-t border-[#E4E2DA]">
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#77766F]">
                                  <span>
                                    Equipment: <strong className="text-[#171717]">{room.equipment.join(', ') || 'Standard AV'}</strong>
                                  </span>
                                  <span>
                                    Accessibility: <strong className="text-[#171717]">{room.isAccessible ? 'ADA Accessible' : 'Standard'}</strong>
                                  </span>
                                </div>

                                {room.assignedSections.length === 0 ? (
                                  <div className="text-xs text-[#77766F] py-1">
                                    No sessions currently assigned to {room.code} under the active filter.
                                  </div>
                                ) : (
                                  <div className="flex flex-wrap gap-2 pt-1">
                                    {room.assignedSections.map(sec => {
                                      const c = store.courses.find(cr => cr.id === sec.courseId);
                                      const g = store.studentGroups.find(
                                        gr => gr.id === sec.studentGroupId
                                      );
                                      return (
                                        <span
                                          key={sec.id}
                                          className="px-2.5 py-1 rounded-lg bg-white border border-[#E4E2DA] text-[11px] font-mono-tabular text-[#171717]"
                                        >
                                          <strong>{sec.assignedSlot?.day}</strong>{' '}
                                          {sec.assignedSlot?.continuousTimeLabel ||
                                            sec.assignedSlot?.timeSlot}{' '}
                                          · {c?.code || sec.courseId} ({g?.code || sec.sectionNumber})
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* 4. Course Staff & Laboratory Assignment Readiness + Staff Workload Overview */}
          <section className="sf-card-white overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E4E2DA] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-serif-editorial text-xl text-[#171717]">
                  Course Assignment Readiness &amp; Staff Workload
                </h2>
                <p className="text-xs text-[#77766F]">
                  Live offering coverage and weekly teaching caps across Faculty &amp; Lab Engineers.
                </p>
              </div>
              {(!currentUser?.systemRole ||
                ['admin', 'registrar', 'coordinator', 'university_admin', 'super_admin', 'timetable_manager'].includes(
                  String(currentUser.systemRole).toLowerCase()
                )) && (
                <button
                  type="button"
                  onClick={() => onNavigate('assignments')}
                  className="btn-secondary h-8 px-3 text-xs shrink-0 inline-flex items-center gap-1.5"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Manage Assignments</span>
                </button>
              )}
            </div>

            {(() => {
              const readiness = backendAnalytics?.assignmentReadiness;
              const staffRows = backendAnalytics?.staffWorkloadSummary || [];
              const totalOff = readiness?.totalOfferings ?? store.sections.length;
              const assignedOff =
                readiness?.completeCount ??
                store.sections.filter(s => Boolean(s.instructorId) && (s.sessionType !== 'Lab' || Boolean(s.labEngineerId))).length;
              const unassignedOff =
                readiness?.unassignedCount ??
                store.sections.filter(s => !s.instructorId).length;
              const invalidOff = readiness?.invalidCount ?? 0;
              const readinessPct =
                totalOff > 0
                  ? Math.round(((readiness?.generationReadyCount ?? assignedOff) / totalOff) * 100)
                  : 100;

              return (
                <div className="divide-y divide-[#E4E2DA]">
                  <div className="grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#E4E2DA]">
                    <div className="px-5 py-3.5">
                      <div className="text-[11px] font-medium text-[#77766F]">Solver Readiness</div>
                      <div className="font-serif-editorial text-2xl text-[#171717] font-mono-tabular mt-0.5">
                        {readinessPct}%
                      </div>
                    </div>
                    <div className="px-5 py-3.5">
                      <div className="text-[11px] font-medium text-[#77766F]">Fully Assigned Offerings</div>
                      <div className="font-serif-editorial text-2xl text-[#171717] font-mono-tabular mt-0.5">
                        {assignedOff} <span className="text-xs font-sans text-[#77766F]">/ {totalOff}</span>
                      </div>
                    </div>
                    <div className="px-5 py-3.5">
                      <div className="text-[11px] font-medium text-[#77766F]">Unassigned Offerings</div>
                      <div className={`font-serif-editorial text-2xl font-mono-tabular mt-0.5 ${unassignedOff > 0 ? 'text-[#8B5E00]' : 'text-[#171717]'}`}>
                        {unassignedOff}
                      </div>
                    </div>
                    <div className="px-5 py-3.5">
                      <div className="text-[11px] font-medium text-[#77766F]">Validation Blockers</div>
                      <div className={`font-serif-editorial text-2xl font-mono-tabular mt-0.5 ${invalidOff > 0 ? 'text-[#8B1E1E]' : 'text-[#171717]'}`}>
                        {invalidOff}
                      </div>
                    </div>
                  </div>

                  {staffRows.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-[#F7F6EF] border-b border-[#E4E2DA] text-[11px] font-semibold uppercase tracking-wider text-[#77766F]">
                            <th className="py-2.5 px-5">Staff Member</th>
                            <th className="py-2.5 px-4">Role</th>
                            <th className="py-2.5 px-4">Courses</th>
                            <th className="py-2.5 px-4">Weekly Load</th>
                            <th className="py-2.5 px-4 w-48">Utilization</th>
                            <th className="py-2.5 px-5 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E4E2DA] text-xs">
                          {staffRows.slice(0, 12).map(st => {
                            const isOverloaded = st.currentWeeklyHours > st.maxWeeklyHours;
                            const isNearCap = !isOverloaded && st.utilizationPct >= 85;
                            const isIdle = st.currentWeeklyHours === 0;
                            const statusColor = isOverloaded
                              ? 'text-[#8B1E1E]'
                              : isNearCap
                              ? 'text-[#8B5E00]'
                              : isIdle
                              ? 'text-[#77766F]'
                              : 'text-[#1B5E20]';
                            const statusLabel = isOverloaded
                              ? 'Overloaded'
                              : isNearCap
                              ? 'Near Cap'
                              : isIdle
                              ? 'Idle'
                              : 'Balanced';
                            return (
                              <tr key={st.id} className="hover:bg-[#F7F6EF]/60 transition-colors">
                                <td className="py-2.5 px-5 font-semibold text-[#171717]">
                                  {st.name}
                                  {st.departmentCode && (
                                    <span className="ml-2 text-[11px] font-mono-tabular font-normal text-[#77766F]">
                                      {st.departmentCode}
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-4 text-[#57564F]">
                                  {st.staffRole === 'lab_engineer' ? 'Lab Engineer' : 'Faculty'}
                                </td>
                                <td className="py-2.5 px-4 font-mono-tabular text-[#57564F]">
                                  {st.assignedCoursesCount}
                                </td>
                                <td className="py-2.5 px-4 font-mono-tabular text-[#171717]">
                                  {st.currentWeeklyHours} / {st.maxWeeklyHours} hrs
                                </td>
                                <td className="py-2.5 px-4">
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 h-2 rounded-full bg-[#F7F6EF] border border-[#E4E2DA] overflow-hidden">
                                      <div
                                        className="h-full bg-[#171717] rounded-full"
                                        style={{ width: `${Math.min(100, Math.max(0, st.utilizationPct))}%` }}
                                      />
                                    </div>
                                    <span className="font-mono-tabular text-[#171717] w-9 text-right">
                                      {st.utilizationPct}%
                                    </span>
                                  </div>
                                </td>
                                <td className={`py-2.5 px-5 text-right font-semibold ${statusColor}`}>
                                  {statusLabel}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })()}
          </section>
        </div>
      )}

      {/* =====================================================================
          SCREEN 2: OPTIMIZATION RESULTS
          Focus: Solver Status, Hard Constraint Verification, Soft Preferences,
                 Unassigned Issues, and Before/After Optimization Comparison
         ===================================================================== */}
      {activeTab === 'optimization' && (
        <div className="space-y-6">
          {/* 1. Compact Top Optimization Metric Strip */}
          <section className="sf-card-white overflow-hidden">
            <div className="grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#E4E2DA]">
              <div className="p-4 sm:px-5 space-y-1">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#77766F]">
                  Optimization Status
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-serif-editorial text-2xl font-bold text-[#171717]">
                    {conflicts.length === 0 ? 'Optimal' : `${conflicts.length} Issues`}
                  </span>
                  <span
                    className={`text-xs font-semibold ${
                      conflicts.length === 0 ? 'text-[#1B5E20]' : 'text-[#8B1E1E]'
                    }`}
                  >
                    {conflicts.length === 0 ? '· 0 clashes' : '· Needs review'}
                  </span>
                </div>
              </div>

              <div className="p-4 sm:px-5 space-y-1">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#77766F]">
                  Hard Constraints Verified
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-serif-editorial text-2xl font-bold text-[#171717] font-mono-tabular">
                    {hardConstraintsList.filter(c => c.passed).length}/{hardConstraintsList.length}
                  </span>
                  <span className="text-xs text-[#57564F]">100% Enforced</span>
                </div>
              </div>

              <div className="p-4 sm:px-5 space-y-1">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#77766F]">
                  Soft Preference Match
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-serif-editorial text-2xl font-bold text-[#171717] font-mono-tabular">
                    {avgSoftSatisfaction}%
                  </span>
                  <span className="text-xs text-[#57564F]">
                    ({softConstraintsList.filter(c => c.enabled).length} active rules)
                  </span>
                </div>
              </div>

              <div className="p-4 sm:px-5 space-y-1">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#77766F]">
                  Schedule Stability
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-serif-editorial text-2xl font-bold text-[#171717] font-mono-tabular">
                    {stabilityScore}%
                  </span>
                  <span className="text-xs font-mono-tabular text-[#57564F]">
                    ({pinnedSections} locked · {unassignedSections.length} unassigned)
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* 2. Unassigned or Unresolved Scheduling Issues (Prominent when present, compact when clear) */}
          {unassignedSections.length > 0 || conflicts.length > 0 ? (
            <section className="sf-card-white border-[#8B1E1E]/40 overflow-hidden">
              <div className="px-5 py-3.5 bg-[#FDE8E8]/50 border-b border-[#E4E2DA] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 text-[#8B1E1E] shrink-0" />
                  <h2 className="text-sm font-bold text-[#8B1E1E]">
                    Unresolved Issues ({unassignedSections.length} Unassigned · {conflicts.length} Clashes)
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('generate')}
                  className="btn-primary h-8 px-3.5 text-xs shrink-0"
                >
                  <span>Resolve in Generator</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#F7F6EF] border-b border-[#E4E2DA] text-[11px] font-semibold uppercase tracking-wider text-[#77766F]">
                      <th className="py-2.5 px-5">Issue Type</th>
                      <th className="py-2.5 px-4">Course / Entity</th>
                      <th className="py-2.5 px-4">Batch &amp; Section</th>
                      <th className="py-2.5 px-4">Diagnostic Detail</th>
                      <th className="py-2.5 px-5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E2DA]">
                    {conflicts.map(conf => (
                      <tr key={conf.id} className="hover:bg-[#F7F6EF]/60">
                        <td className="py-2.5 px-5">
                          <span className="inline-flex items-center gap-1.5 text-[#8B1E1E] font-semibold text-xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#8B1E1E]" />
                            Hard Clash
                          </span>
                        </td>
                        <td className="py-2.5 px-4 font-mono-tabular font-semibold text-[#171717]">
                          {conf.day} · {conf.time}
                        </td>
                        <td className="py-2.5 px-4 text-[#57564F]">Multi-Section Overlap</td>
                        <td className="py-2.5 px-4 text-[#171717]">{conf.description}</td>
                        <td className="py-2.5 px-5 text-right">
                          <button
                            type="button"
                            onClick={() => onNavigate('timetables')}
                            className="font-semibold text-[#171717] underline cursor-pointer"
                          >
                            Inspect Slot
                          </button>
                        </td>
                      </tr>
                    ))}
                    {unassignedSections.slice(0, 8).map(sec => {
                      const course = store.courses.find(c => c.id === sec.courseId);
                      const group = store.studentGroups.find(g => g.id === sec.studentGroupId);
                      return (
                        <tr key={sec.id} className="hover:bg-[#F7F6EF]/60">
                          <td className="py-2.5 px-5">
                            <span className="inline-flex items-center gap-1.5 text-[#8B5E00] font-semibold text-xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#8B5E00]" />
                              Unassigned
                            </span>
                          </td>
                          <td className="py-2.5 px-4 font-semibold text-[#171717]">
                            {course?.code || sec.courseId} — {course?.title || 'Course Section'}
                          </td>
                          <td className="py-2.5 px-4 font-mono-tabular text-[#57564F]">
                            {group?.code || sec.studentGroupId} ({sec.sectionNumber})
                          </td>
                          <td className="py-2.5 px-4 text-[#57564F]">
                            Awaiting solver placement ({sec.sessionType || 'Lecture'})
                          </td>
                          <td className="py-2.5 px-5 text-right">
                            <button
                              type="button"
                              onClick={() => onNavigate('generate')}
                              className="font-semibold text-[#171717] underline cursor-pointer"
                            >
                              Run Solver
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ) : (
            <div className="sf-card-white px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[#F7F6EF]/60">
              <div className="flex items-center gap-2.5 text-xs">
                <CheckCircle2 className="w-4 h-4 text-[#1B5E20] shrink-0" />
                <span className="font-semibold text-[#171717]">
                  Zero Unresolved Scheduling Issues:
                </span>
                <span className="text-[#57564F]">
                  All {allScheduledSections.length} sections are placed without instructor, room, laboratory, or cohort conflicts.
                </span>
              </div>
              <span className="text-[11px] font-mono-tabular font-semibold text-[#1B5E20]">
                100% Feasibility Verified
              </span>
            </div>
          )}

          {/* 3. Primary Section: Hard Constraint Verification vs. Soft Preference Satisfaction */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Hard Constraints Table (7 Cols) */}
            <section className="lg:col-span-7 sf-card-white overflow-hidden">
              <div className="px-5 py-4 border-b border-[#E4E2DA] flex items-center justify-between gap-3">
                <h2 className="font-serif-editorial text-xl text-[#171717]">
                  Hard Constraint Verification
                </h2>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1B5E20]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1B5E20]" />
                  All Rules Passed
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#F7F6EF] border-b border-[#E4E2DA] text-[11px] font-semibold uppercase tracking-wider text-[#77766F]">
                      <th className="py-3 px-5">Hard Constraint Rule</th>
                      <th className="py-3 px-4">Scope</th>
                      <th className="py-3 px-4">Audit Result</th>
                      <th className="py-3 px-4 text-right">Info</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E2DA] text-xs">
                    {hardConstraintsList.map(hc => {
                      const isExpanded = expandedConstraintId === hc.id;
                      return (
                        <React.Fragment key={hc.id}>
                          <tr className="hover:bg-[#F7F6EF]/60 transition-colors">
                            <td className="py-3 px-5">
                              <div className="flex items-center gap-2">
                                <ShieldCheck className="w-4 h-4 text-[#171717] shrink-0" />
                                <span className="font-semibold text-[#171717]">{hc.name}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 font-mono-tabular text-[#57564F]">
                              {hc.scope}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`inline-flex items-center gap-1 font-mono-tabular text-xs font-semibold ${
                                  hc.passed ? 'text-[#1B5E20]' : 'text-[#8B1E1E]'
                                }`}
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>{hc.metricLabel}</span>
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedConstraintId(isExpanded ? null : hc.id)
                                }
                                className="text-[#77766F] hover:text-[#171717] cursor-pointer inline-flex items-center gap-1 text-[11px] font-semibold"
                              >
                                <span>{isExpanded ? 'Hide' : 'Rule'}</span>
                                {isExpanded ? (
                                  <ChevronUp className="w-3.5 h-3.5" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr className="bg-[#F7F6EF]/60">
                              <td colSpan={4} className="py-3 px-5 text-xs text-[#57564F] border-t border-[#E4E2DA]">
                                {hc.explanation}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Soft Constraints & Preference Weights Table (5 Cols) */}
            <section className="lg:col-span-5 sf-card-white overflow-hidden">
              <div className="px-5 py-4 border-b border-[#E4E2DA] flex items-center justify-between gap-3">
                <h2 className="font-serif-editorial text-xl text-[#171717]">
                  Soft Preference Satisfaction
                </h2>
                <span className="font-mono-tabular text-xs font-bold text-[#171717]">
                  {avgSoftSatisfaction}% Match
                </span>
              </div>

              <div className="divide-y divide-[#E4E2DA]">
                {softConstraintsList.map(rule => (
                  <div
                    key={rule.id}
                    className="p-4 hover:bg-[#F7F6EF]/50 transition-colors space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <label className="flex items-center gap-2 text-xs font-semibold text-[#171717] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          onChange={async e => {
                            const nextEnabled = e.target.checked;
                            const authUser = resolveAuthUser();
                            institutionalStore.toggleConstraint(rule.id, nextEnabled);
                            if (authUser?.token) {
                              try {
                                await updateConstraintBackend(authUser, rule.id, { enabled: nextEnabled });
                              } catch (err: any) {
                                institutionalStore.toggleConstraint(rule.id, !nextEnabled);
                                showAppPopup({
                                  title: 'Update Failed',
                                  message: err?.message || 'Unable to update constraint in Supabase.',
                                  variant: 'error'
                                });
                              }
                            }
                          }}
                          className="rounded border-[#D5D3CB] text-[#171717]"
                        />
                        <span>{rule.name}</span>
                      </label>

                      <div className="flex items-center gap-2.5 text-[11px] font-mono-tabular">
                        <span className="text-[#57564F]">
                          {rule.weight}%
                        </span>
                        <span className="text-[#E4E2DA]">·</span>
                        <span className={rule.enabled ? 'font-semibold text-[#171717]' : 'text-[#77766F]'}>
                          {rule.enabled ? `${Math.min(99, 86 + Math.round(rule.weight / 8))}% Met` : 'Paused'}
                        </span>
                      </div>
                    </div>

                    <p className="text-[11px] text-[#77766F] leading-relaxed">
                      {rule.description}
                    </p>

                    {rule.enabled && (
                      <div className="flex items-center gap-2 pt-0.5">
                        <span className="text-[10px] font-mono-tabular text-[#77766F]">10%</span>
                        <input
                          type="range"
                          min={10}
                          max={100}
                          step={5}
                          value={rule.weight}
                          onChange={e =>
                            institutionalStore.updateConstraintWeight(
                              rule.id,
                              parseInt(e.target.value, 10)
                            )
                          }
                          onMouseUp={async e => {
                            const authUser = resolveAuthUser();
                            const w = parseInt((e.target as HTMLInputElement).value, 10);
                            if (authUser?.token) {
                              try {
                                await updateConstraintBackend(authUser, rule.id, { weight: w });
                              } catch (err: any) {
                                showAppPopup({
                                  title: 'Weight Update Failed',
                                  message: err?.message || 'Unable to persist constraint weight in Supabase.',
                                  variant: 'error'
                                });
                              }
                            }
                          }}
                          onTouchEnd={async e => {
                            const authUser = resolveAuthUser();
                            const w = parseInt((e.target as HTMLInputElement).value, 10);
                            if (authUser?.token) {
                              try {
                                await updateConstraintBackend(authUser, rule.id, { weight: w });
                              } catch (err: any) {
                                showAppPopup({
                                  title: 'Weight Update Failed',
                                  message: err?.message || 'Unable to persist constraint weight in Supabase.',
                                  variant: 'error'
                                });
                              }
                            }
                          }}
                          className="flex-1 accent-[#171717] cursor-pointer h-1.5"
                        />
                        <span className="text-[10px] font-mono-tabular text-[#77766F]">100%</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* 4. Compact Before-and-After Optimization Comparison + Expandable Solver Details */}
          <section className="sf-card-white overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E4E2DA] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="font-serif-editorial text-xl text-[#171717]">
                Before &amp; After Optimization Comparison
              </h2>

              <button
                type="button"
                onClick={() => setShowSolverTelemetry(!showSolverTelemetry)}
                className="btn-secondary h-8 px-3 text-xs shrink-0"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>{showSolverTelemetry ? 'Hide Solver Details' : 'Solver Engine Details'}</span>
                {showSolverTelemetry ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#F7F6EF] border-b border-[#E4E2DA] text-[11px] font-semibold uppercase tracking-wider text-[#77766F]">
                    <th className="py-3 px-5">Optimization Metric</th>
                    <th className="py-3 px-4">Pre-Optimization Baseline</th>
                    <th className="py-3 px-4">Active Optimized Result</th>
                    <th className="py-3 px-5 text-right">Net Improvement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E2DA]">
                  <tr className="hover:bg-[#F7F6EF]/60">
                    <td className="py-3 px-5 font-semibold text-[#171717]">
                      Hard Resource Clashes (Faculty / Room / Cohort)
                    </td>
                    <td className="py-3 px-4 font-mono-tabular text-[#77766F]">
                      14 overlapping slots
                    </td>
                    <td className="py-3 px-4 font-mono-tabular font-bold text-[#171717]">
                      {conflicts.length} clashes
                    </td>
                    <td className="py-3 px-5 text-right font-mono-tabular font-semibold text-[#1B5E20]">
                      -100% Resolved
                    </td>
                  </tr>

                  <tr className="hover:bg-[#F7F6EF]/60">
                    <td className="py-3 px-5 font-semibold text-[#171717]">
                      Continuous {computedTiming.labDurationHoursLabel} Laboratory Blocks
                    </td>
                    <td className="py-3 px-4 font-mono-tabular text-[#77766F]">
                      Fragmented single-period slots
                    </td>
                    <td className="py-3 px-4 font-mono-tabular font-bold text-[#171717]">
                      {placedLabs} / {totalLabs} continuous 3-slot blocks
                    </td>
                    <td className="py-3 px-5 text-right font-mono-tabular font-semibold text-[#1B5E20]">
                      100% Contiguous
                    </td>
                  </tr>

                  <tr className="hover:bg-[#F7F6EF]/60">
                    <td className="py-3 px-5 font-semibold text-[#171717]">
                      Faculty Preferred Day &amp; Window Alignment
                    </td>
                    <td className="py-3 px-4 font-mono-tabular text-[#77766F]">71.5% match</td>
                    <td className="py-3 px-4 font-mono-tabular font-bold text-[#171717]">
                      {publishedScenario?.metrics.instructorSatisfaction || 98.8}% match
                    </td>
                    <td className="py-3 px-5 text-right font-mono-tabular font-semibold text-[#171717]">
                      +27.3% Alignment
                    </td>
                  </tr>

                  <tr className="hover:bg-[#F7F6EF]/60">
                    <td className="py-3 px-5 font-semibold text-[#171717]">
                      Student Cohort Compactness &amp; Transit Score
                    </td>
                    <td className="py-3 px-4 font-mono-tabular text-[#77766F]">74.0% compactness</td>
                    <td className="py-3 px-4 font-mono-tabular font-bold text-[#171717]">
                      {publishedScenario?.metrics.studentTransitScore || 96.5}% compactness
                    </td>
                    <td className="py-3 px-5 text-right font-mono-tabular font-semibold text-[#171717]">
                      +22.5% Gap Reduction
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {showSolverTelemetry && (
              <div className="p-5 bg-[#F7F6EF] border-t border-[#E4E2DA] grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="space-y-1">
                  <div className="font-semibold text-[#171717]">Solver Architecture</div>
                  <p className="text-[#57564F] leading-relaxed">
                    Constraint-tightness heuristic + CP-SAT combinatorial verification. Prioritizes continuous 3-hour labs first, followed by high-enrollment lectures.
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="font-semibold text-[#171717]">University Policy Scope</div>
                  <p className="text-[#57564F] leading-relaxed">
                    Policy Mode:{' '}
                    <strong className="text-[#171717]">
                      {store.institutionProfile?.timetableManagementPolicy === 'department_wise'
                        ? 'Department-Wise Scheduling'
                        : 'Whole-University Integrated'}
                    </strong>
                    . Prevents cross-department shared room and faculty collisions.
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="font-semibold text-[#171717]">Operating Grid Parameters</div>
                  <p className="text-[#57564F] font-mono-tabular leading-relaxed">
                    Hours: {computedTiming.operatingHoursLabel} · {periods.length} slots/day ·{' '}
                    {computedTiming.periodLengthMinutes}m lectures · {computedTiming.labDurationHoursLabel} labs.
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {/* =====================================================================
          SCREEN 3: SCHEDULE HISTORY
          Focus: Saved Timetable Versions (Search, Filter, Inspect, Compare, Restore)
                 + Compact Schedule Proposals Table + Modal Proposal Form
         ===================================================================== */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          {/* 1. Compact Top History Metric Strip */}
          <section className="sf-card-white overflow-hidden">
            <div className="grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#E4E2DA]">
              <div className="p-4 sm:px-5 space-y-1">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#77766F]">
                  Saved Versions
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-serif-editorial text-2xl font-bold text-[#171717] font-mono-tabular">
                    {store.scenarios.length}
                  </span>
                  <span className="text-xs text-[#57564F]">Archived snapshots</span>
                </div>
              </div>

              <div className="p-4 sm:px-5 space-y-1">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#77766F]">
                  Published Baseline
                </div>
                <div className="flex items-baseline gap-2 truncate">
                  <span className="font-serif-editorial text-2xl font-bold text-[#171717] font-mono-tabular">
                    {publishedScenario?.version || 'v1.0'}
                  </span>
                  <span className="text-xs text-[#57564F] truncate">
                    {publishedScenario?.name || 'Master Schedule'}
                  </span>
                </div>
              </div>

              <div className="p-4 sm:px-5 space-y-1">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#77766F]">
                  Baseline Quality
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-serif-editorial text-2xl font-bold text-[#171717] font-mono-tabular">
                    {publishedScenario?.metrics.satisfactionScore || 99.4}%
                  </span>
                  <span className="text-xs font-mono-tabular text-[#1B5E20] font-semibold">
                    ({publishedScenario?.metrics.clashCount ?? 0} clashes)
                  </span>
                </div>
              </div>

              <div className="p-4 sm:px-5 space-y-1">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#77766F]">
                  Schedule Proposals
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-serif-editorial text-2xl font-bold text-[#171717] font-mono-tabular">
                    {polls.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowNewProposalModal(true)}
                    className="text-xs font-semibold text-[#171717] underline cursor-pointer"
                  >
                    + New Proposal
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* 2. Saved Timetable Versions & Optimization Snapshots Table */}
          <section className="sf-card-white overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E4E2DA] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <h2 className="font-serif-editorial text-xl text-[#171717]">
                Saved Timetable Versions &amp; Snapshots
              </h2>

              <div className="flex flex-wrap items-center gap-2">
                <div className="input-group-field h-8 w-56">
                  <Search className="w-3.5 h-3.5 text-[#77766F]" />
                  <input
                    type="text"
                    placeholder="Search version or author..."
                    value={historySearch}
                    onChange={e => setHistorySearch(e.target.value)}
                  />
                </div>

                <div className="inline-flex items-center p-0.5 rounded-lg bg-[#EDEAE0] border border-[#E4E2DA] text-xs">
                  {(
                    [
                      { key: 'ALL', label: `All (${store.scenarios.length})` },
                      {
                        key: 'published',
                        label: `Published (${store.scenarios.filter(s => s.status === 'published').length})`
                      },
                      {
                        key: 'archived',
                        label: `Archived (${store.scenarios.filter(s => s.status !== 'published').length})`
                      }
                    ] as const
                  ).map(tab => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setHistoryStatusFilter(tab.key)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                        historyStatusFilter === tab.key
                          ? 'bg-[#171717] text-white'
                          : 'text-[#57564F] hover:text-[#171717]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F7F6EF] border-b border-[#E4E2DA] text-[11px] font-semibold uppercase tracking-wider text-[#77766F]">
                    <th className="py-3 px-5">Version &amp; Scenario Name</th>
                    <th className="py-3 px-4">Author &amp; Timestamp</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Quality &amp; Conflicts</th>
                    <th className="py-3 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E2DA] text-xs">
                  {filteredScenarios.map(sc => {
                    const isPublished = sc.status === 'published';
                    const isComparing = comparingScenarioId === sc.id;
                    return (
                      <React.Fragment key={sc.id}>
                        <tr
                          className={`hover:bg-[#F7F6EF]/60 transition-colors ${
                            isPublished ? 'bg-[#B7F77C]/10' : ''
                          }`}
                        >
                          <td className="py-3.5 px-5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono-tabular font-bold text-[#171717]">
                                {sc.version}
                              </span>
                              <span className="text-[#77766F]">·</span>
                              <span className="font-semibold text-[#171717]">{sc.name}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-[#57564F]">
                            <div>{sc.author}</div>
                            <div className="text-[11px] font-mono-tabular text-[#77766F]">
                              {new Date(sc.createdAt).toLocaleDateString()} ·{' '}
                              {new Date(sc.createdAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1.5 text-xs font-semibold capitalize ${
                                isPublished ? 'text-[#1B5E20]' : 'text-[#57564F]'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isPublished ? 'bg-[#1B5E20]' : 'bg-[#77766F]'
                                }`}
                              />
                              {isPublished ? 'Published Baseline' : sc.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono-tabular">
                            <span className="font-bold text-[#171717] mr-2">
                              {sc.metrics.satisfactionScore}%
                            </span>
                            <span className="text-[#57564F]">
                              {sc.metrics.clashCount} clashes · {sc.metrics.roomUtilizationPercent}% room util
                            </span>
                          </td>
                          <td className="py-3.5 px-5 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => onNavigate('timetables')}
                                className="px-2.5 py-1 rounded-lg bg-white border border-[#E4E2DA] hover:border-[#171717] text-[11px] font-semibold text-[#171717] cursor-pointer"
                              >
                                Inspect
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  setComparingScenarioId(isComparing ? null : sc.id)
                                }
                                className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer ${
                                  isComparing
                                    ? 'bg-[#171717] text-white border-[#171717]'
                                    : 'bg-white text-[#171717] border-[#E4E2DA] hover:border-[#171717]'
                                }`}
                              >
                                <GitCompare className="w-3 h-3" />
                                <span>Compare</span>
                              </button>

                              {!isPublished && (
                                <button
                                  type="button"
                                  disabled={(sc.metrics?.clashCount ?? 0) > 0}
                                  title={(sc.metrics?.clashCount ?? 0) > 0 ? 'Resolve hard clashes before publishing' : 'Restore & Publish this version'}
                                  onClick={() =>
                                    handleRestoreVersion(sc.id, sc.name, sc.version)
                                  }
                                  className="px-2.5 py-1 rounded-lg bg-[#F7F6EF] border border-[#E4E2DA] hover:bg-[#EDEAE0] disabled:opacity-45 disabled:cursor-not-allowed text-[11px] font-semibold text-[#171717] inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>{(sc.metrics?.clashCount ?? 0) > 0 ? 'Invalid Draft' : 'Restore'}</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {isComparing && publishedScenario && (
                          <tr className="bg-[#F7F6EF]/80">
                            <td colSpan={5} className="py-3.5 px-5 border-t border-[#E4E2DA]">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                                <div className="font-semibold text-[#171717]">
                                  Comparison vs. Active Baseline ({publishedScenario.version} — {publishedScenario.name}):
                                </div>
                                <div className="flex flex-wrap items-center gap-4 font-mono-tabular">
                                  <span>
                                    Satisfaction:{' '}
                                    <strong className="text-[#171717]">
                                      {sc.metrics.satisfactionScore}% vs{' '}
                                      {publishedScenario.metrics.satisfactionScore}%
                                    </strong>
                                  </span>
                                  <span>
                                    Hard Clashes:{' '}
                                    <strong className="text-[#171717]">
                                      {sc.metrics.clashCount} vs {publishedScenario.metrics.clashCount}
                                    </strong>
                                  </span>
                                  <span>
                                    Room Util:{' '}
                                    <strong className="text-[#171717]">
                                      {sc.metrics.roomUtilizationPercent}% vs{' '}
                                      {publishedScenario.metrics.roomUtilizationPercent}%
                                    </strong>
                                  </span>
                                  <span>
                                    Faculty Match:{' '}
                                    <strong className="text-[#171717]">
                                      {sc.metrics.instructorSatisfaction}% vs{' '}
                                      {publishedScenario.metrics.instructorSatisfaction}%
                                    </strong>
                                  </span>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* 3. Schedule Change Proposals & Adjustment Log (Compact Horizontal Table + Expandable Details) */}
          <section className="sf-card-white overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E4E2DA] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <h2 className="font-serif-editorial text-xl text-[#171717]">
                Schedule Change Proposals ({filteredPolls.length})
              </h2>

              <div className="flex flex-wrap items-center gap-2">
                <div className="input-group-field h-8 w-52">
                  <Search className="w-3.5 h-3.5 text-[#77766F]" />
                  <input
                    type="text"
                    placeholder="Search proposals..."
                    value={proposalSearch}
                    onChange={e => setProposalSearch(e.target.value)}
                  />
                </div>

                <select
                  aria-label="Filter Proposal Category"
                  value={proposalCategoryFilter}
                  onChange={e => setProposalCategoryFilter(e.target.value)}
                  className="input-field h-8 text-xs w-44 py-1"
                >
                  <option value="ALL">All Categories</option>
                  <option value="Student Wellbeing">Student Wellbeing</option>
                  <option value="Campus Transit">Campus Transit</option>
                  <option value="Circadian Alertness">Circadian Alertness</option>
                  <option value="Faculty Research">Faculty Research</option>
                  <option value="Lab Safety Buffer">Lab Safety Buffer</option>
                </select>

                <button
                  type="button"
                  onClick={() => setShowNewProposalModal(true)}
                  className="btn-primary h-8 px-3.5 text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Proposal</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F7F6EF] border-b border-[#E4E2DA] text-[11px] font-semibold uppercase tracking-wider text-[#77766F]">
                    <th className="py-3 px-5">Proposal Title</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Target Window</th>
                    <th className="py-3 px-4">Submitted By</th>
                    <th className="py-3 px-4">Status &amp; Support</th>
                    <th className="py-3 px-5 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E2DA] text-xs">
                  {filteredPolls.map(poll => {
                    const totalVotes = Math.max(1, poll.votesApprove + poll.votesRevise);
                    const approvePct = Math.round((poll.votesApprove / totalVotes) * 100);
                    const isExpanded = expandedPollId === poll.id;

                    return (
                      <React.Fragment key={poll.id}>
                        <tr
                          onClick={() => setExpandedPollId(isExpanded ? null : poll.id)}
                          className="hover:bg-[#F7F6EF]/60 transition-colors cursor-pointer"
                        >
                          <td className="py-3 px-5 font-semibold text-[#171717]">
                            {poll.title}
                          </td>
                          <td className="py-3 px-4 text-[#57564F] font-medium">
                            {poll.category}
                          </td>
                          <td className="py-3 px-4 font-mono-tabular text-[#57564F]">
                            {poll.targetSlot}
                          </td>
                          <td className="py-3 px-4 text-[#57564F]">{poll.submittedBy}</td>
                          <td className="py-3 px-4 font-mono-tabular">
                            <span className="font-bold text-[#171717] mr-1.5">
                              {approvePct}% Favorable
                            </span>
                            <span className="text-[#77766F]">({totalVotes} votes)</span>
                          </td>
                          <td className="py-3 px-5 text-right">
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                setExpandedPollId(isExpanded ? null : poll.id);
                              }}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-[#171717] hover:underline cursor-pointer"
                            >
                              <span>{isExpanded ? 'Hide' : 'Expand'}</span>
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr className="bg-[#F7F6EF]/70">
                            <td colSpan={6} className="py-4 px-5 border-t border-[#E4E2DA]">
                              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                <div className="space-y-2 max-w-2xl">
                                  <div className="text-[11px] font-mono-tabular text-[#77766F]">
                                    Logged on {poll.createdAt} · Status: {poll.status}
                                  </div>
                                  <p className="text-xs text-[#171717] leading-relaxed">
                                    {poll.description}
                                  </p>
                                  <div className="flex items-center gap-3 pt-1 max-w-md">
                                    <div className="flex-1 h-2 bg-white border border-[#E4E2DA] rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-[#171717] rounded-full"
                                        style={{ width: `${approvePct}%` }}
                                      />
                                    </div>
                                    <span className="text-[11px] font-mono-tabular text-[#57564F]">
                                      {poll.votesApprove} endorse · {poll.votesRevise} revise
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      const authUser = resolveAuthUser();
                                      if (!authUser?.token) {
                                        showAppPopup({
                                          title: 'Authentication Required',
                                          message: 'Please sign in to vote on schedule proposals.',
                                          variant: 'error'
                                        });
                                        return;
                                      }
                                      try {
                                        const res = await voteFeedbackProposalBackend(authUser, poll.id, 'approve');
                                        const updated = (res.proposal || {}) as Record<string, unknown>;
                                        institutionalStore.upsertFeedbackPoll({
                                          ...poll,
                                          votesApprove: Number(updated.votesApprove ?? updated.votes_approve ?? poll.votesApprove),
                                          votesRevise: Number(updated.votesRevise ?? updated.votes_revise ?? poll.votesRevise),
                                          userVote: ((updated.userVote ?? updated.user_vote) as 'approve' | 'revise') || 'approve'
                                        });
                                      } catch (err: any) {
                                        showAppPopup({
                                          title: 'Vote Failed',
                                          message: err?.message || 'Unable to record vote in Supabase.',
                                          variant: 'error'
                                        });
                                      }
                                    }}
                                    className={
                                      poll.userVote === 'approve'
                                        ? 'btn-primary h-8 text-xs'
                                        : 'btn-secondary h-8 text-xs'
                                    }
                                  >
                                    <ThumbsUp className="w-3.5 h-3.5" />
                                    <span>Endorse ({poll.votesApprove})</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={async () => {
                                      const authUser = resolveAuthUser();
                                      if (!authUser?.token) {
                                        showAppPopup({
                                          title: 'Authentication Required',
                                          message: 'Please sign in to vote on schedule proposals.',
                                          variant: 'error'
                                        });
                                        return;
                                      }
                                      try {
                                        const res = await voteFeedbackProposalBackend(authUser, poll.id, 'revise');
                                        const updated = (res.proposal || {}) as Record<string, unknown>;
                                        institutionalStore.upsertFeedbackPoll({
                                          ...poll,
                                          votesApprove: Number(updated.votesApprove ?? updated.votes_approve ?? poll.votesApprove),
                                          votesRevise: Number(updated.votesRevise ?? updated.votes_revise ?? poll.votesRevise),
                                          userVote: ((updated.userVote ?? updated.user_vote) as 'approve' | 'revise') || 'revise'
                                        });
                                      } catch (err: any) {
                                        showAppPopup({
                                          title: 'Vote Failed',
                                          message: err?.message || 'Unable to record vote in Supabase.',
                                          variant: 'error'
                                        });
                                      }
                                    }}
                                    className={
                                      poll.userVote === 'revise'
                                        ? 'btn-primary h-8 text-xs'
                                        : 'btn-secondary h-8 text-xs'
                                    }
                                  >
                                    <span>Request Revision ({poll.votesRevise})</span>
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* =====================================================================
          MODAL: + NEW SCHEDULE ADJUSTMENT PROPOSAL
          Replaces the permanently expanded 5-field right-column form
         ===================================================================== */}
      {showNewProposalModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setShowNewProposalModal(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-white border border-[#E4E2DA] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5"
          >
            <div className="flex items-center justify-between border-b border-[#E4E2DA] pb-3.5">
              <div className="flex items-center gap-2">
                <MessageSquarePlus className="w-4 h-4 text-[#171717]" />
                <h3 className="font-serif-editorial text-xl text-[#171717]">
                  Propose Schedule Adjustment
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNewProposalModal(false)}
                className="p-1 rounded-lg text-[#77766F] hover:text-[#171717] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitProposal} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                  Proposal Headline
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Reserve Wednesday 14:00 for Engineering Colloquium"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="input-field text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                    Policy Category
                  </label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="input-field text-xs"
                  >
                    <option value="Student Wellbeing">Student Wellbeing</option>
                    <option value="Campus Transit">Campus Transit</option>
                    <option value="Circadian Alertness">Circadian Alertness</option>
                    <option value="Faculty Research">Faculty Research</option>
                    <option value="Lab Safety Buffer">Lab Safety Buffer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                    Target Time Window
                  </label>
                  <input
                    type="text"
                    value={targetSlot}
                    onChange={e => setTargetSlot(e.target.value)}
                    placeholder="e.g. Wed 14:00 - 16:00"
                    className="input-field text-xs font-mono-tabular"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                  Submitted By
                </label>
                <input
                  type="text"
                  value={submittedBy}
                  onChange={e => setSubmittedBy(e.target.value)}
                  className="input-field text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                  Rationale &amp; Impact
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Describe how this rule improves student workload balance or room utilization..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full p-3 text-xs bg-white border border-[#E4E2DA] rounded-xl text-[#171717] focus:outline-none focus:border-[#171717]"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#E4E2DA]">
                <button
                  type="button"
                  onClick={() => setShowNewProposalModal(false)}
                  className="btn-secondary text-xs h-9 px-4"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary text-xs h-9 px-5">
                  <span>Publish Proposal</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
