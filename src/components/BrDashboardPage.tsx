import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Trash2,
  Send,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  FileText,
  Users,
  Calendar,
  BarChart3,
  ShieldCheck,
  Lock
} from 'lucide-react';
import {
  AuthenticatedVotingUser,
  PollDTO,
  BatchDTO,
  fetchVotingOverview,
  submitBrQuestion
} from '../services/votingApi';

export type BrWorkspaceTab = 'dashboard' | 'submit' | 'submissions' | 'results';

interface BrDashboardPageProps {
  currentUser: AuthenticatedVotingUser;
  initialSubView?: BrWorkspaceTab;
  onUserSynced?: (user: AuthenticatedVotingUser) => void;
}

export const BrDashboardPage: React.FC<BrDashboardPageProps> = ({
  currentUser,
  initialSubView = 'dashboard',
  onUserSynced
}) => {
  const [subView, setSubView] = useState<BrWorkspaceTab>(initialSubView);
  const [polls, setPolls] = useState<PollDTO[]>([]);
  const [batches, setBatches] = useState<BatchDTO[]>([]);
  const [syncedUser, setSyncedUser] = useState<AuthenticatedVotingUser>(currentUser);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New Question Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState<string[]>([
    'Morning Schedule Block (09:00 AM – 12:00 PM)',
    'Afternoon Schedule Block (02:00 PM – 05:00 PM)'
  ]);
  const [endAtDate, setEndAtDate] = useState<string>(() => {
    const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    return d.toISOString().split('T')[0];
  });
  const [targetScope, setTargetScope] = useState<'all_batches' | 'submitting_batch'>('all_batches');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitBanner, setSubmitBanner] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  useEffect(() => {
    setSubView(initialSubView);
  }, [initialSubView]);

  const hasLoadedOnceRef = React.useRef(false);
  const currentUserRef = React.useRef(currentUser);
  currentUserRef.current = currentUser;
  const onUserSyncedRef = React.useRef(onUserSynced);
  onUserSyncedRef.current = onUserSynced;

  const loadBrData = useCallback(async () => {
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
      setError(err instanceof Error ? err.message : 'Failed to load BR workspace.');
    } finally {
      setLoading(false);
    }
  }, [currentUser.id, currentUser.email]);

  useEffect(() => {
    loadBrData();
  }, [loadBrData]);

  const assignedBatch = batches.find(b => b.id === syncedUser.batchId) || null;

  const handleAddOption = () => {
    if (options.length >= 6) return;
    setOptions(prev => [...prev, '']);
  };

  const handleRemoveOption = (idx: number) => {
    if (options.length <= 2) return;
    setOptions(prev => prev.filter((_, i) => i !== idx));
  };

  const handleOptionChange = (idx: number, val: string) => {
    setOptions(prev => prev.map((opt, i) => (i === idx ? val : opt)));
  };

  const handleSubmitQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitBanner(null);

    const trimmedOptions = options.map(o => o.trim()).filter(Boolean);
    if (trimmedOptions.length < 2) {
      setSubmitBanner({
        type: 'error',
        text: 'Please provide at least two non-empty answer options.'
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const endIso = endAtDate ? new Date(`${endAtDate}T23:59:59`).toISOString() : null;
      const result = await submitBrQuestion(syncedUser, {
        title,
        description,
        options: trimmedOptions,
        endAt: endIso,
        targetScope
      });
      setPolls(prev => [result.poll, ...prev]);
      setTitle('');
      setDescription('');
      setOptions(['Option A', 'Option B']);
      setSubmitBanner({
        type: 'success',
        text: result.message
      });
    } catch (err) {
      setSubmitBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to submit question.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const myBatchSubmissions = polls.filter(
    p =>
      p.submittedByUserId === syncedUser.id ||
      (syncedUser.batchId && p.batchId === syncedUser.batchId)
  );

  const permittedResultsPolls = polls.filter(
    p =>
      (p.status === 'Published' || p.status === 'Closed') &&
      p.canViewResults
  );

  const filteredSubmissions = myBatchSubmissions.filter(p => {
    if (statusFilter === 'ALL') return true;
    return p.status === statusFilter;
  });

  const statusBadgeStyle = (status: PollDTO['status']) => {
    switch (status) {
      case 'Pending':
        return 'bg-[#FFF6D6] border-[#F0D98C] text-[#6E5100]';
      case 'Approved':
        return 'bg-[#E3F2FD] border-[#90CAF9] text-[#0D47A1]';
      case 'Published':
        return 'bg-[#E8F8E0] border-[#A5E087] text-[#1B5E20]';
      case 'Rejected':
        return 'bg-[#FDE8E8] border-[#F5B5B5] text-[#8B1E1E]';
      case 'Closed':
        return 'bg-[#EDEAE0] border-[#D6D4CE] text-[#57564F]';
    }
  };

  return (
    <div className="space-y-8 pb-14">
      {/* BR Identity & Batch Representation Header */}
      <div className="bg-[#171717] text-white rounded-3xl p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2 text-xs text-white/80">
              <span className="font-bold text-[#B8EEEE]">
                {syncedUser.brGenderRole === 'female'
                  ? 'Designated Female Batch Representative'
                  : 'Designated Male Batch Representative'}
              </span>
              <span>·</span>
              <span>
                Batch {syncedUser.batchCode || 'Assigned'} ({syncedUser.batchName || 'University Cohort'})
              </span>
            </div>

            <h1 className="font-serif-editorial text-3xl sm:text-4xl text-white tracking-tight">
              Batch Representative Workspace
            </h1>
            <p className="text-xs sm:text-sm text-white/75 leading-relaxed">
              Submit official student scheduling & academic questions on behalf of your assigned batch, track Administrator moderation feedback, and inspect permitted voting results.
            </p>
          </div>

          {/* 4-Tab Sub-Navigation Switcher */}
          <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl bg-white/10 border border-white/15 self-start lg:self-center shrink-0">
            {(
              [
                { id: 'dashboard', label: 'BR Dashboard' },
                { id: 'submit', label: 'Submit a Question' },
                { id: 'submissions', label: `My Submissions (${myBatchSubmissions.length})` },
                { id: 'results', label: `Voting Status & Results (${permittedResultsPolls.length})` }
              ] as const
            ).map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSubView(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  subView === tab.id
                    ? 'bg-[#B8EEEE] text-[#171717]'
                    : 'text-white/80 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Own Batch Information Strip */}
        {assignedBatch && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 pt-6 border-t border-white/15 text-xs">
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
              <div className="text-[11px] text-white/60">Assigned Batch Cohort</div>
              <div className="font-bold text-white text-sm mt-0.5 font-mono-tabular">
                {assignedBatch.code} · {assignedBatch.studentCount} Students
              </div>
              <div className="text-[11px] text-white/60 mt-0.5">{assignedBatch.name}</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
              <div className="text-[11px] text-[#B8EEEE] font-semibold">
                Male Batch Representative
              </div>
              <div className="font-semibold text-white text-sm mt-0.5 truncate">
                {assignedBatch.maleRepresentative
                  ? assignedBatch.maleRepresentative.name
                  : 'Unassigned'}
              </div>
              <div className="text-[11px] text-white/60 truncate font-mono-tabular">
                {assignedBatch.maleRepresentative?.email || 'Pending Admin assignment'}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
              <div className="text-[11px] text-[#F2D8FA] font-semibold">
                Female Batch Representative
              </div>
              <div className="font-semibold text-white text-sm mt-0.5 truncate">
                {assignedBatch.femaleRepresentative
                  ? assignedBatch.femaleRepresentative.name
                  : 'Unassigned'}
              </div>
              <div className="text-[11px] text-white/60 truncate font-mono-tabular">
                {assignedBatch.femaleRepresentative?.email || 'Pending Admin assignment'}
              </div>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-[#FDE8E8] border border-[#F5B5B5] text-[#8B1E1E] text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* VIEW 1 & 2: BR DASHBOARD OR SUBMIT A QUESTION */}
      {(subView === 'dashboard' || subView === 'submit') && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left 7 Columns: Submit New Batch Question Form */}
          <div className="lg:col-span-7 bg-white border border-[#E4E2DA] rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-[#E4E2DA] pb-4">
              <div>
                <h2 className="font-serif-editorial text-2xl text-[#171717]">
                  Submit a Question for Student Voting
                </h2>
                <p className="text-xs text-[#77766F] mt-0.5">
                  Locked strictly to your designated batch ({syncedUser.batchCode || 'Assigned Cohort'}). Requires Registrar approval before going live.
                </p>
              </div>
              <ShieldCheck className="w-5 h-5 text-[#171717] shrink-0" />
            </div>

            {submitBanner && (
              <div
                className={`p-4 rounded-2xl border text-xs font-medium flex items-center gap-2.5 ${
                  submitBanner.type === 'success'
                    ? 'bg-[#E8F8E0] border-[#A5E087] text-[#1B5E20]'
                    : 'bg-[#FDE8E8] border-[#F5B5B5] text-[#8B1E1E]'
                }`}
              >
                {submitBanner.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{submitBanner.text}</span>
              </div>
            )}

            <form onSubmit={handleSubmitQuestion} className="space-y-5">
              {/* Locked Batch & Representative Role Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-[#F7F6EF] border border-[#E4E2DA]">
                <div>
                  <div className="text-[10px] font-semibold text-[#77766F] flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    <span>Assigned Batch (Database Locked)</span>
                  </div>
                  <div className="text-xs font-bold text-[#171717] mt-1">
                    {syncedUser.batchCode
                      ? `${syncedUser.batchCode} — ${syncedUser.batchName}`
                      : 'No Batch Assigned'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-[#77766F] flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    <span>Representative Seat</span>
                  </div>
                  <div className="text-xs font-bold text-[#171717] mt-1 capitalize">
                    {syncedUser.brGenderRole || 'Representative'} BR · {syncedUser.name}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                  Question Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Preferred Continuous 3-Hour Lab Slot for Microprocessors"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="input-field h-11 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                  Detailed Description & Academic Context *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Explain why this question is being raised and how the result will guide the batch timetable or academic schedule..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="input-field py-2.5 text-xs leading-relaxed"
                />
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[#171717]">
                    Answer Options (Minimum 2 Required) *
                  </label>
                  {options.length < 6 && (
                    <button
                      type="button"
                      onClick={handleAddOption}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#171717] hover:underline cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Option</span>
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {options.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="w-7 h-9 rounded-lg bg-[#F7F6EF] border border-[#E4E2DA] text-xs font-mono-tabular font-semibold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <input
                        type="text"
                        required
                        placeholder={`Answer option ${idx + 1}`}
                        value={opt}
                        onChange={e => handleOptionChange(idx, e.target.value)}
                        className="input-field h-9 text-xs flex-1"
                      />
                      {options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveOption(idx)}
                          className="p-2 rounded-lg text-[#77766F] hover:text-[#8B1E1E] hover:bg-[#FDE8E8] transition-colors cursor-pointer shrink-0"
                          title="Remove option"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                    Proposed Voting Deadline (Optional)
                  </label>
                  <input
                    type="date"
                    value={endAtDate}
                    onChange={e => setEndAtDate(e.target.value)}
                    className="input-field h-10 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                    Recommended Voter Participation Scope
                  </label>
                  <select
                    value={targetScope}
                    onChange={e =>
                      setTargetScope(e.target.value as 'all_batches' | 'submitting_batch')
                    }
                    className="input-field h-10 text-xs"
                  >
                    <option value="all_batches">Open to All University Batches</option>
                    <option value="submitting_batch">
                      My Batch Only ({syncedUser.batchCode || 'Assigned Batch'})
                    </option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || syncedUser.systemRole !== 'br'}
                className="w-full btn-primary py-3 text-xs sm:text-sm font-semibold justify-center disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>
                  {isSubmitting
                    ? 'Submitting Question...'
                    : 'Submit Question for Admin Approval'}
                </span>
              </button>
            </form>
          </div>

          {/* Right 5 Columns: Batch Question Status Tracker */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white border border-[#E4E2DA] rounded-3xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-[#171717]">
                  Batch Question Status Tracker
                </h3>
                <button
                  type="button"
                  onClick={() => setSubView('submissions')}
                  className="text-xs font-semibold text-[#171717] hover:underline cursor-pointer"
                >
                  View All ({myBatchSubmissions.length})
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-[#FFF6D6]/60 border border-[#F0D98C]">
                  <div className="text-lg font-bold font-mono-tabular text-[#6E5100]">
                    {myBatchSubmissions.filter(p => p.status === 'Pending').length}
                  </div>
                  <div className="text-[10px] font-semibold text-[#6E5100]">Pending</div>
                </div>
                <div className="p-2.5 rounded-xl bg-[#E8F8E0]/60 border border-[#A5E087]">
                  <div className="text-lg font-bold font-mono-tabular text-[#1B5E20]">
                    {
                      myBatchSubmissions.filter(
                        p => p.status === 'Published' || p.status === 'Approved'
                      ).length
                    }
                  </div>
                  <div className="text-[10px] font-semibold text-[#1B5E20]">Live / Approved</div>
                </div>
                <div className="p-2.5 rounded-xl bg-[#FDE8E8]/60 border border-[#F5B5B5]">
                  <div className="text-lg font-bold font-mono-tabular text-[#8B1E1E]">
                    {myBatchSubmissions.filter(p => p.status === 'Rejected').length}
                  </div>
                  <div className="text-[10px] font-semibold text-[#8B1E1E]">Rejected</div>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                {loading ? (
                  <div className="h-24 rounded-2xl bg-[#F7F6EF] animate-pulse" />
                ) : (
                  myBatchSubmissions.slice(0, 4).map(item => (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-2xl bg-[#F7F6EF] border border-[#E4E2DA] space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${statusBadgeStyle(
                            item.status
                          )}`}
                        >
                          {item.status}
                        </span>
                        <span className="text-[11px] font-mono-tabular text-[#77766F]">
                          {item.totalVotes} votes
                        </span>
                      </div>

                      <div className="text-xs font-bold text-[#171717] leading-snug">
                        {item.title}
                      </div>

                      {item.status === 'Rejected' && item.rejectionReason && (
                        <div className="p-2.5 rounded-xl bg-[#FDE8E8] border border-[#F5B5B5] text-[11px] text-[#8B1E1E]">
                          <strong>Admin Feedback:</strong> {item.rejectionReason}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: MY SUBMISSIONS */}
      {subView === 'submissions' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-[#E4E2DA] rounded-2xl p-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {(['ALL', 'Pending', 'Approved', 'Published', 'Closed', 'Rejected'] as const).map(
                st => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                      statusFilter === st
                        ? 'bg-[#171717] text-white'
                        : 'text-[#57564F] hover:bg-[#F7F6EF]'
                    }`}
                  >
                    {st === 'ALL' ? 'All Submissions' : st}
                  </button>
                )
              )}
            </div>

            <button
              type="button"
              onClick={() => setSubView('submit')}
              className="btn-primary py-2 px-4 text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Submit New Question</span>
            </button>
          </div>

          {filteredSubmissions.length === 0 ? (
            <div className="bg-white border border-[#E4E2DA] rounded-3xl p-12 text-center space-y-3">
              <FileText className="w-8 h-8 text-[#77766F] mx-auto" />
              <div className="text-base font-bold text-[#171717]">No submissions found</div>
              <p className="text-xs text-[#77766F]">
                Use the Submit a Question form to propose a new question for your batch.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {filteredSubmissions.map(poll => (
                <div
                  key={poll.id}
                  className="bg-white border border-[#E4E2DA] rounded-3xl p-6 sm:p-8 shadow-xs space-y-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#E4E2DA]">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span
                        className={`px-2.5 py-1 rounded-lg border font-bold ${statusBadgeStyle(
                          poll.status
                        )}`}
                      >
                        {poll.status}
                      </span>
                      <span className="font-bold text-[#171717]">{poll.batchCode}</span>
                      <span>·</span>
                      <span className="text-[#57564F]">
                        Submitted by <strong>{poll.submittedByName}</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-[#77766F] font-mono-tabular">
                      <span>Total Votes: {poll.totalVotes}</span>
                      {poll.endAt && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>Due {new Date(poll.endAt).toLocaleDateString()}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="font-serif-editorial text-2xl text-[#171717]">{poll.title}</h3>
                    <p className="text-xs sm:text-sm text-[#57564F]">{poll.description}</p>
                  </div>

                  {poll.status === 'Rejected' && poll.rejectionReason && (
                    <div className="p-4 rounded-2xl bg-[#FDE8E8] border border-[#F5B5B5] text-xs text-[#8B1E1E] flex items-start gap-2.5">
                      <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold mb-0.5">
                          Rejected by University Administrator
                        </div>
                        <p>{poll.rejectionReason}</p>
                      </div>
                    </div>
                  )}

                  {poll.status === 'Pending' && (
                    <div className="p-3.5 rounded-2xl bg-[#FFF6D6]/60 border border-[#F0D98C] text-xs text-[#6E5100] flex items-center gap-2">
                      <Clock className="w-4 h-4 shrink-0" />
                      <span>
                        Awaiting Administrator review and publication before students can vote.
                      </span>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="text-[11px] font-semibold text-[#77766F] flex items-center gap-1.5">
                      <BarChart3 className="w-3.5 h-3.5" />
                      <span>Options & Voting Breakdown</span>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {poll.options.map(opt => (
                        <div
                          key={opt.id}
                          className="p-3.5 rounded-2xl bg-[#F7F6EF] border border-[#E4E2DA] flex items-center justify-between gap-4"
                        >
                          <span className="text-xs font-semibold text-[#171717]">{opt.label}</span>
                          {opt.votes !== null ? (
                            <span className="text-xs font-mono-tabular font-bold text-[#171717] shrink-0">
                              {opt.percentage}% ({opt.votes} votes)
                            </span>
                          ) : (
                            <span className="text-[11px] text-[#77766F]">Pending publication</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW 4: VOTING STATUS & PERMITTED VOTING RESULTS */}
      {subView === 'results' && (
        <div className="space-y-5">
          {permittedResultsPolls.map(poll => (
            <div
              key={poll.id}
              className="bg-white border border-[#E4E2DA] rounded-3xl p-6 sm:p-8 shadow-xs space-y-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#E4E2DA]">
                <div className="flex items-center gap-2 text-xs">
                  <span
                    className={`px-2.5 py-1 rounded-lg border font-bold ${statusBadgeStyle(
                      poll.status
                    )}`}
                  >
                    {poll.status}
                  </span>
                  <span className="font-bold text-[#171717]">{poll.batchCode}</span>
                  <span>·</span>
                  <span className="text-[#57564F]">
                    {poll.submittedByName} ({poll.brGenderRole} BR)
                  </span>
                </div>
                <div className="text-xs font-mono-tabular font-bold text-[#171717]">
                  {poll.totalVotes} Total Student Votes
                </div>
              </div>

              <div>
                <h3 className="font-serif-editorial text-2xl text-[#171717]">{poll.title}</h3>
                <p className="text-xs text-[#57564F] mt-1">{poll.description}</p>
              </div>

              <div className="space-y-2">
                {poll.options.map(opt => {
                  const pct = opt.percentage ?? 0;
                  return (
                    <div
                      key={opt.id}
                      className="relative overflow-hidden rounded-2xl border border-[#E4E2DA] bg-[#F7F6EF] p-3.5"
                    >
                      <div
                        className="absolute inset-y-0 left-0 bg-[#B8EEEE]/45 pointer-events-none"
                        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                      />
                      <div className="relative z-10 flex items-center justify-between gap-4 text-xs">
                        <span className="font-semibold text-[#171717]">{opt.label}</span>
                        <span className="font-mono-tabular font-bold text-[#171717] shrink-0">
                          {opt.percentage ?? 0}% ({opt.votes ?? 0} votes)
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
