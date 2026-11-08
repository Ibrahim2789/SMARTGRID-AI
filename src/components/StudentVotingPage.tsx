import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2,
  Clock,
  Lock,
  Vote,
  Filter,
  Calendar,
  Users,
  AlertCircle,
  Sparkles,
  BarChart3,
  ShieldCheck,
  RefreshCw,
  EyeOff
} from 'lucide-react';
import {
  AuthenticatedVotingUser,
  PollDTO,
  BatchDTO,
  fetchVotingOverview,
  castStudentVote
} from '../services/votingApi';

interface StudentVotingPageProps {
  currentUser: AuthenticatedVotingUser;
  onUserSynced?: (user: AuthenticatedVotingUser) => void;
}

type PollFilterTab = 'active' | 'upcoming' | 'closed' | 'participated';

export const StudentVotingPage: React.FC<StudentVotingPageProps> = ({
  currentUser,
  onUserSynced
}) => {
  const [polls, setPolls] = useState<PollDTO[]>([]);
  const [batches, setBatches] = useState<BatchDTO[]>([]);
  const [syncedUser, setSyncedUser] = useState<AuthenticatedVotingUser>(currentUser);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<PollFilterTab>('active');
  const [selectedBatchFilter, setSelectedBatchFilter] = useState<string>('ALL');

  // Track selected option per poll before submitting
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [submittingPollId, setSubmittingPollId] = useState<string | null>(null);
  const [voteFeedback, setVoteFeedback] = useState<
    Record<string, { type: 'success' | 'error'; text: string }>
  >({});

  const hasLoadedOnceRef = React.useRef(false);
  const currentUserRef = React.useRef(currentUser);
  currentUserRef.current = currentUser;
  const onUserSyncedRef = React.useRef(onUserSynced);
  onUserSyncedRef.current = onUserSynced;

  const loadVotingData = useCallback(async () => {
    if (!hasLoadedOnceRef.current) {
      setLoading(true);
    }
    setError(null);
    try {
      const data = await fetchVotingOverview(currentUserRef.current);
      hasLoadedOnceRef.current = true;
      setPolls(data.polls);
      setBatches(data.batches);
      if (data.user) {
        setSyncedUser(data.user);
        onUserSyncedRef.current?.(data.user);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load student polls.');
    } finally {
      setLoading(false);
    }
  }, [currentUser.id, currentUser.email]);

  useEffect(() => {
    loadVotingData();
  }, [loadVotingData]);

  const handleSelectOption = (pollId: string, optionId: string) => {
    setSelectedOptions(prev => ({ ...prev, [pollId]: optionId }));
    if (voteFeedback[pollId]) {
      setVoteFeedback(prev => {
        const next = { ...prev };
        delete next[pollId];
        return next;
      });
    }
  };

  const handleCastVote = async (poll: PollDTO) => {
    const chosenOptionId = selectedOptions[poll.id];
    if (!chosenOptionId) {
      setVoteFeedback(prev => ({
        ...prev,
        [poll.id]: {
          type: 'error',
          text: 'Please select one of the answer options before casting your vote.'
        }
      }));
      return;
    }

    setSubmittingPollId(poll.id);
    setVoteFeedback(prev => {
      const next = { ...prev };
      delete next[poll.id];
      return next;
    });

    try {
      const result = await castStudentVote(syncedUser, poll.id, chosenOptionId);
      setPolls(prev => prev.map(p => (p.id === poll.id ? result.poll : p)));
      setVoteFeedback(prev => ({
        ...prev,
        [poll.id]: {
          type: 'success',
          text: result.message
        }
      }));
    } catch (err) {
      setVoteFeedback(prev => ({
        ...prev,
        [poll.id]: {
          type: 'error',
          text: err instanceof Error ? err.message : 'Could not submit your vote.'
        }
      }));
    } finally {
      setSubmittingPollId(null);
    }
  };

  // Counts per tab
  const activePollsCount = polls.filter(p => p.isActiveVotingWindow).length;
  const upcomingPollsCount = polls.filter(p => p.isUpcoming).length;
  const closedPollsCount = polls.filter(p => p.isExpired || p.status === 'Closed').length;
  const participatedPollsCount = polls.filter(p => p.hasVoted).length;

  const filteredPolls = polls.filter(poll => {
    if (selectedBatchFilter !== 'ALL' && poll.batchId !== selectedBatchFilter) {
      return false;
    }
    if (activeTab === 'active') return poll.isActiveVotingWindow;
    if (activeTab === 'upcoming') return poll.isUpcoming;
    if (activeTab === 'closed') return poll.isExpired || poll.status === 'Closed';
    if (activeTab === 'participated') return poll.hasVoted;
    return true;
  });

  const isStudentRole =
    syncedUser.systemRole === 'student' ||
    syncedUser.role.toLowerCase() === 'student';

  return (
    <div className="space-y-8 pb-14">
      {/* Page Header */}
      <div className="bg-white border border-[#E4E2DA] rounded-3xl p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#B8EEEE]/50 text-[#171717] text-xs font-semibold">
              <Vote className="w-3.5 h-3.5 shrink-0" />
              <span>Official University Cohort Referendums & Batch Polls</span>
            </div>
            <h1 className="font-serif-editorial text-3xl sm:text-4xl text-[#171717] tracking-tight">
              Student Voting Portal
            </h1>
            <p className="text-xs sm:text-sm text-[#57564F] leading-relaxed">
              Review questions proposed by Male and Female Batch Representatives and approved by the Registrar. Each student may cast a single, verified vote per active question before the deadline.
            </p>
          </div>

          {/* Student Cohort Identity Badge */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <div className="p-4 rounded-2xl bg-[#F7F6EF] border border-[#E4E2DA] space-y-1 min-w-[230px]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#77766F]">
                  Voter Registration
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#171717] bg-[#B7F77C] px-2 py-0.5 rounded-md">
                  <ShieldCheck className="w-3 h-3 shrink-0" />
                  <span>Verified</span>
                </span>
              </div>
              <div className="text-sm font-bold text-[#171717] truncate">{syncedUser.name}</div>
              <div className="text-xs text-[#57564F] flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#77766F] shrink-0" />
                <span>
                  {syncedUser.batchCode
                    ? `Batch ${syncedUser.batchCode} (${syncedUser.batchName})`
                    : `${syncedUser.role} Account`}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={loadVotingData}
              className="btn-secondary h-11 px-4 text-xs font-semibold shrink-0"
              title="Refresh polls"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Summary KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-[#E4E2DA]">
          <div className="p-3.5 rounded-2xl bg-[#F7F6EF] border border-[#E4E2DA]">
            <div className="text-[11px] font-medium text-[#77766F]">Active Polls Open</div>
            <div className="text-2xl font-bold text-[#171717] font-mono-tabular mt-0.5">
              {activePollsCount}
            </div>
          </div>
          <div className="p-3.5 rounded-2xl bg-[#F7F6EF] border border-[#E4E2DA]">
            <div className="text-[11px] font-medium text-[#77766F]">Your Participated Polls</div>
            <div className="text-2xl font-bold text-[#171717] font-mono-tabular mt-0.5">
              {participatedPollsCount}
            </div>
          </div>
          <div className="p-3.5 rounded-2xl bg-[#F7F6EF] border border-[#E4E2DA]">
            <div className="text-[11px] font-medium text-[#77766F]">Upcoming Scheduled</div>
            <div className="text-2xl font-bold text-[#171717] font-mono-tabular mt-0.5">
              {upcomingPollsCount}
            </div>
          </div>
          <div className="p-3.5 rounded-2xl bg-[#F7F6EF] border border-[#E4E2DA]">
            <div className="text-[11px] font-medium text-[#77766F]">Closed & Finalized</div>
            <div className="text-2xl font-bold text-[#171717] font-mono-tabular mt-0.5">
              {closedPollsCount}
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar: 4 Required Poll Views + Batch Filter */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-[#E4E2DA] rounded-2xl p-3">
        <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Poll categories">
          {(
            [
              { id: 'active', label: 'Active Polls', count: activePollsCount },
              { id: 'upcoming', label: 'Upcoming Polls', count: upcomingPollsCount },
              { id: 'closed', label: 'Closed Polls', count: closedPollsCount },
              {
                id: 'participated',
                label: 'Previously Participated Polls',
                count: participatedPollsCount
              }
            ] as const
          ).map(tab => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  active
                    ? 'bg-[#171717] text-white shadow-xs'
                    : 'text-[#57564F] hover:text-[#171717] hover:bg-[#F7F6EF]'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono-tabular ${
                    active ? 'bg-white/20 text-white' : 'bg-[#EDEAE0] text-[#171717]'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Batch Filter */}
        <div className="flex items-center gap-2 shrink-0">
          <Filter className="w-3.5 h-3.5 text-[#77766F] shrink-0" />
          <label htmlFor="student-batch-filter" className="text-xs font-medium text-[#57564F]">
            Submitting Batch:
          </label>
          <select
            id="student-batch-filter"
            value={selectedBatchFilter}
            onChange={e => setSelectedBatchFilter(e.target.value)}
            className="h-9 px-3 rounded-xl border border-[#E4E2DA] bg-[#F7F6EF] text-xs font-semibold text-[#171717] focus:outline-none"
          >
            <option value="ALL">All University Batches</option>
            {batches.map(b => (
              <option key={b.id} value={b.id}>
                {b.code} — {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 rounded-2xl bg-[#FDE8E8] border border-[#F5B5B5] text-[#8B1E1E] text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Non-student preview notice */}
      {!isStudentRole && (
        <div className="p-4 rounded-2xl bg-[#F2D8FA]/40 border border-[#D8B4E2] text-[#171717] text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-[#171717] shrink-0" />
            <span>
              You are viewing the Student Voting Portal as <strong>{syncedUser.role}</strong> (
              {syncedUser.name}). Only accounts with the <strong>Student</strong> role can submit ballots. Use the Persona Switcher in the bottom-left profile menu to switch to a Student account to test live voting.
            </span>
          </div>
        </div>
      )}

      {/* Polls Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-6">
          {[1, 2].map(n => (
            <div
              key={n}
              className="bg-white border border-[#E4E2DA] rounded-3xl p-6 sm:p-8 animate-pulse space-y-4"
            >
              <div className="h-5 w-48 bg-[#EDEAE0] rounded-lg" />
              <div className="h-7 w-3/4 bg-[#EDEAE0] rounded-lg" />
              <div className="h-16 w-full bg-[#F7F6EF] rounded-xl" />
            </div>
          ))}
        </div>
      ) : filteredPolls.length === 0 ? (
        <div className="bg-white border border-[#E4E2DA] rounded-3xl p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#F7F6EF] border border-[#E4E2DA] flex items-center justify-center mx-auto text-[#77766F]">
            <Vote className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-[#171717]">
            No polls match this view
          </h3>
          <p className="text-xs text-[#77766F] max-w-md mx-auto">
            {activeTab === 'active'
              ? 'There are currently no active polls open for voting in this filter.'
              : activeTab === 'upcoming'
              ? 'No upcoming scheduled polls are queued at this moment.'
              : activeTab === 'participated'
              ? 'You have not cast a vote in any polls matching this filter yet.'
              : 'No closed polls found for this filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredPolls.map(poll => {
            const feedback = voteFeedback[poll.id];
            const isSubmittingThis = submittingPollId === poll.id;
            const currentSelectedOption =
              selectedOptions[poll.id] || poll.myVotedOptionId || '';

            const canCastVoteNow =
              isStudentRole &&
              poll.isActiveVotingWindow &&
              !poll.hasVoted;

            return (
              <article
                key={poll.id}
                className="bg-white border border-[#E4E2DA] rounded-3xl p-6 sm:p-8 shadow-xs transition-all space-y-6"
              >
                {/* Top Metadata Row: Batch, BR Gender Role, Status Badge, Deadline */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#E4E2DA]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#171717] text-white text-xs font-semibold">
                      <span>{poll.batchCode}</span>
                    </span>

                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                        poll.brGenderRole === 'female'
                          ? 'bg-[#F2D8FA] text-[#171717]'
                          : 'bg-[#B8EEEE] text-[#171717]'
                      }`}
                    >
                      <span>
                        {poll.brGenderRole === 'female'
                          ? 'Female Batch Representative'
                          : 'Male Batch Representative'}
                      </span>
                    </span>

                    <span className="text-xs text-[#57564F]">
                      Proposed by <strong className="text-[#171717]">{poll.submittedByName}</strong>
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {poll.hasVoted && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#B7F77C] text-[#171717] text-xs font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>You have already voted</span>
                      </span>
                    )}

                    {poll.isActiveVotingWindow ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E8F8E0] border border-[#A5E087] text-[#1B5E20] text-xs font-semibold">
                        <span className="w-2 h-2 rounded-full bg-[#2E7D32]" />
                        <span>Active Poll</span>
                      </span>
                    ) : poll.isUpcoming ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF6D6] border border-[#F0D98C] text-[#6E5100] text-xs font-semibold">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        <span>Upcoming Poll</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EDEAE0] text-[#57564F] text-xs font-semibold">
                        <Lock className="w-3.5 h-3.5 shrink-0" />
                        <span>Voting Closed</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Question Title & Description */}
                <div className="space-y-2">
                  <h2 className="font-serif-editorial text-2xl sm:text-3xl text-[#171717] leading-snug">
                    {poll.title}
                  </h2>
                  <p className="text-xs sm:text-sm text-[#57564F] leading-relaxed">
                    {poll.description}
                  </p>
                </div>

                {/* Voting Options & Conditional Results Bars */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-[#77766F]">
                    <span className="font-semibold uppercase tracking-wider text-[11px]">
                      {poll.hasVoted
                        ? 'Your Recorded Response & Options'
                        : poll.isActiveVotingWindow
                        ? 'Select One Option Below'
                        : 'Poll Options'}
                    </span>
                    <span className="font-mono-tabular">
                      Total Votes Cast: <strong className="text-[#171717]">{poll.totalVotes}</strong>
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {poll.options.map(option => {
                      const isMyVotedOption = poll.myVotedOptionId === option.id;
                      const isCurrentlySelected = currentSelectedOption === option.id;
                      const percentage =
                        poll.canViewResults && option.percentage !== null
                          ? option.percentage
                          : 0;

                      return (
                        <div
                          key={option.id}
                          onClick={() => {
                            if (canCastVoteNow) {
                              handleSelectOption(poll.id, option.id);
                            }
                          }}
                          role={canCastVoteNow ? 'radio' : undefined}
                          aria-checked={canCastVoteNow ? isCurrentlySelected : undefined}
                          tabIndex={canCastVoteNow ? 0 : -1}
                          onKeyDown={e => {
                            if (canCastVoteNow && (e.key === 'Enter' || e.key === ' ')) {
                              e.preventDefault();
                              handleSelectOption(poll.id, option.id);
                            }
                          }}
                          className={`relative overflow-hidden rounded-2xl border p-4 transition-all ${
                            canCastVoteNow ? 'cursor-pointer' : 'cursor-default'
                          } ${
                            isMyVotedOption
                              ? 'border-[#171717] bg-[#F7F6EF] ring-2 ring-[#171717]/10'
                              : isCurrentlySelected && canCastVoteNow
                              ? 'border-[#171717] bg-[#B8EEEE]/20'
                              : 'border-[#E4E2DA] bg-white hover:border-[#C2C0B8]'
                          }`}
                        >
                          {/* Progress Bar Fill when results are permitted */}
                          {poll.canViewResults && (
                            <div
                              className={`absolute inset-y-0 left-0 transition-all duration-500 pointer-events-none ${
                                isMyVotedOption ? 'bg-[#B7F77C]/45' : 'bg-[#EDEAE0]/75'
                              }`}
                              style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
                            />
                          )}

                          <div className="relative z-10 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0">
                              {/* Radio Indicator */}
                              <div
                                className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border transition-colors ${
                                  isMyVotedOption || (isCurrentlySelected && canCastVoteNow)
                                    ? 'border-[#171717] bg-[#171717] text-white'
                                    : 'border-[#9E9D96] bg-white'
                                }`}
                              >
                                {(isMyVotedOption || (isCurrentlySelected && canCastVoteNow)) && (
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                )}
                              </div>

                              <span className="text-xs sm:text-sm font-semibold text-[#171717] leading-snug">
                                {option.label}
                              </span>

                              {isMyVotedOption && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#171717] text-white text-[10px] font-semibold shrink-0">
                                  Your Vote
                                </span>
                              )}
                            </div>

                            {/* Vote Count & Percentage if allowed by poll visibility */}
                            {poll.canViewResults && option.votes !== null && (
                              <div className="flex items-center gap-2 shrink-0 text-right font-mono-tabular">
                                <span className="text-xs font-bold text-[#171717]">
                                  {option.percentage}%
                                </span>
                                <span className="text-[11px] text-[#57564F]">
                                  ({option.votes} {option.votes === 1 ? 'vote' : 'votes'})
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Immediate Confirmation or Error Feedback */}
                {feedback && (
                  <div
                    className={`p-3.5 rounded-2xl border text-xs font-medium flex items-center gap-2.5 ${
                      feedback.type === 'success'
                        ? 'bg-[#E8F8E0] border-[#A5E087] text-[#1B5E20]'
                        : 'bg-[#FDE8E8] border-[#F5B5B5] text-[#8B1E1E]'
                    }`}
                  >
                    {feedback.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0" />
                    )}
                    <span>{feedback.text}</span>
                  </div>
                )}

                {/* Footer Row: Deadline Info, Result Visibility Note, and Vote Action Button */}
                <div className="pt-4 border-t border-[#E4E2DA] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-4 text-xs text-[#57564F]">
                    {poll.endAt && (
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-[#77766F] shrink-0" />
                        <span>
                          Voting Deadline:{' '}
                          <strong className="text-[#171717]">
                            {new Date(poll.endAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </strong>
                        </span>
                      </span>
                    )}

                    {poll.startAt && poll.isUpcoming && (
                      <span className="inline-flex items-center gap-1.5 text-[#6E5100]">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          Opens:{' '}
                          <strong>
                            {new Date(poll.startAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </strong>
                        </span>
                      </span>
                    )}

                    {!poll.canViewResults ? (
                      <span className="inline-flex items-center gap-1.5 text-[#77766F]">
                        <EyeOff className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {poll.resultVisibility === 'after_vote'
                            ? 'Results unlock immediately after you cast your vote'
                            : 'Results will be revealed when voting closes'}
                        </span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[#171717]">
                        <BarChart3 className="w-3.5 h-3.5 text-[#77766F] shrink-0" />
                        <span>Live aggregated results visible</span>
                      </span>
                    )}
                  </div>

                  {/* Action Button */}
                  <div className="shrink-0">
                    {poll.hasVoted ? (
                      <button
                        type="button"
                        disabled
                        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#EDEAE0] text-[#57564F] text-xs font-semibold cursor-not-allowed"
                      >
                        <CheckCircle2 className="w-4 h-4 text-[#171717]" />
                        <span>You Have Already Voted</span>
                      </button>
                    ) : poll.isUpcoming ? (
                      <button
                        type="button"
                        disabled
                        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#EDEAE0] text-[#57564F] text-xs font-semibold cursor-not-allowed"
                      >
                        <Clock className="w-4 h-4" />
                        <span>Voting Opens Soon</span>
                      </button>
                    ) : poll.isExpired || poll.status === 'Closed' ? (
                      <button
                        type="button"
                        disabled
                        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#EDEAE0] text-[#57564F] text-xs font-semibold cursor-not-allowed"
                      >
                        <Lock className="w-4 h-4" />
                        <span>Voting Closed</span>
                      </button>
                    ) : isStudentRole ? (
                      <button
                        type="button"
                        disabled={isSubmittingThis || !selectedOptions[poll.id]}
                        onClick={() => handleCastVote(poll)}
                        className="btn-primary py-2.5 px-6 text-xs font-semibold disabled:opacity-50"
                      >
                        <Vote className="w-4 h-4" />
                        <span>{isSubmittingThis ? 'Recording Vote...' : 'Submit Vote'}</span>
                      </button>
                    ) : (
                      <span className="text-xs text-[#77766F] italic">
                        Student role required to vote
                      </span>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
