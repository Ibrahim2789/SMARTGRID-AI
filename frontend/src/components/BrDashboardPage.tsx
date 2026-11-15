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
  Calendar,
  BarChart3
} from 'lucide-react';
import {
  AuthenticatedVotingUser,
  PollDTO,
  BatchDTO,
  fetchVotingOverview,
  submitBrQuestion
} from '../services/votingApi';
import { showAppPopup } from './ToastPopupHost';

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
      const msg = 'Please provide at least two non-empty answer options.';
      setSubmitBanner({ type: 'error', text: msg });
      showAppPopup({ title: 'Incomplete Poll', message: msg, variant: 'error' });
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
      setSubmitBanner({ type: 'success', text: result.message });
      showAppPopup({ title: 'Question Submitted', message: result.message, variant: 'success' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to submit question.';
      setSubmitBanner({ type: 'error', text: msg });
      showAppPopup({ title: 'Submission Failed', message: msg, variant: 'error' });
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

  const statusTextStyle = (status: PollDTO['status']) => {
    switch (status) {
      case 'Pending':
        return { text: 'text-[#8B5E00]', dot: 'bg-[#8B5E00]' };
      case 'Approved':
        return { text: 'text-[#0D47A1]', dot: 'bg-[#0D47A1]' };
      case 'Published':
        return { text: 'text-[#1B5E20]', dot: 'bg-[#1B5E20]' };
      case 'Rejected':
        return { text: 'text-[#8B1E1E]', dot: 'bg-[#8B1E1E]' };
      case 'Closed':
        return { text: 'text-[#57564F]', dot: 'bg-[#77766F]' };
    }
  };

  return (
    <div className="space-y-6 pb-14">
      {/* BR Identity & Batch Representation Header */}
      <div className="bg-[#171717] text-white rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs text-[#B8EEEE] font-semibold">
              {syncedUser.brGenderRole === 'female'
                ? 'Female Batch Representative'
                : 'Male Batch Representative'}{' '}
              · {syncedUser.batchCode || 'Assigned Batch'}
            </div>

            <h1 className="font-serif-editorial text-2xl sm:text-3xl text-white tracking-tight">
              Batch Representative Workspace
            </h1>
          </div>

          {/* Sub-Navigation Switcher */}
          <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-white/10 border border-white/15 self-start lg:self-center shrink-0">
            {(
              [
                { id: 'dashboard', label: 'Overview & Submit' },
                { id: 'submissions', label: `Submissions (${myBatchSubmissions.length})` },
                { id: 'results', label: `Results (${permittedResultsPolls.length})` }
              ] as const
            ).map(tab => {
              const isSelected =
                tab.id === 'dashboard'
                  ? subView === 'dashboard' || subView === 'submit'
                  : subView === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSubView(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    isSelected
                      ? 'bg-[#B8EEEE] text-[#171717]'
                      : 'text-white/80 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Compact 1-Line Batch & Co-Representative Summary Strip */}
        {assignedBatch && (
          <div className="flex flex-wrap items-center gap-3 mt-4 pt-3.5 border-t border-white/15 text-xs text-white/80">
            <span>
              <strong className="text-white font-mono-tabular">{assignedBatch.code}</strong> ({assignedBatch.studentCount} Students)
            </span>
            <span className="text-white/30">·</span>
            <span>
              Male BR: <strong className="text-[#B8EEEE]">{assignedBatch.maleRepresentative?.name || 'Unassigned'}</strong>
            </span>
            <span className="text-white/30">·</span>
            <span>
              Female BR: <strong className="text-[#F2D8FA]">{assignedBatch.femaleRepresentative?.name || 'Unassigned'}</strong>
            </span>
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
          <div className="lg:col-span-7 bg-white border border-[#E4E2DA] rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
            <div className="border-b border-[#E4E2DA] pb-3.5">
              <h2 className="font-serif-editorial text-2xl text-[#171717]">
                Submit a Batch Question
              </h2>
              <p className="text-xs text-[#77766F] mt-0.5">
                Reviewed by Registrar before opening to student voting.
              </p>
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

            <form onSubmit={handleSubmitQuestion} className="space-y-4">

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
          <div className="lg:col-span-5">
            <div className="bg-white border border-[#E4E2DA] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-serif-editorial text-xl text-[#171717]">
                  Submission Tracker
                </h3>
                <button
                  type="button"
                  onClick={() => setSubView('submissions')}
                  className="text-xs font-semibold text-[#171717] hover:underline cursor-pointer"
                >
                  View All ({myBatchSubmissions.length})
                </button>
              </div>

              <div className="border border-[#E4E2DA] rounded-xl grid grid-cols-3 divide-x divide-[#E4E2DA] text-center">
                <div className="p-2.5">
                  <div className="text-lg font-bold font-mono-tabular text-[#8B5E00]">
                    {myBatchSubmissions.filter(p => p.status === 'Pending').length}
                  </div>
                  <div className="text-[10.5px] font-medium text-[#77766F]">Pending</div>
                </div>
                <div className="p-2.5">
                  <div className="text-lg font-bold font-mono-tabular text-[#1B5E20]">
                    {
                      myBatchSubmissions.filter(
                        p => p.status === 'Published' || p.status === 'Approved'
                      ).length
                    }
                  </div>
                  <div className="text-[10.5px] font-medium text-[#77766F]">Live / Approved</div>
                </div>
                <div className="p-2.5">
                  <div className="text-lg font-bold font-mono-tabular text-[#8B1E1E]">
                    {myBatchSubmissions.filter(p => p.status === 'Rejected').length}
                  </div>
                  <div className="text-[10.5px] font-medium text-[#77766F]">Rejected</div>
                </div>
              </div>

              <div className="divide-y divide-[#E4E2DA] border-t border-[#E4E2DA]">
                {loading ? (
                  <div className="h-24 rounded-xl bg-[#F7F6EF] animate-pulse mt-3" />
                ) : (
                  myBatchSubmissions.slice(0, 4).map(item => {
                    const st = statusTextStyle(item.status);
                    return (
                    <div key={item.id} className="py-3 space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className={`inline-flex items-center gap-1.5 font-semibold ${st.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                          {item.status}
                        </span>
                        <span className="text-[11px] font-mono-tabular text-[#77766F]">
                          {item.totalVotes} votes
                        </span>
                      </div>

                      <div className="text-xs font-semibold text-[#171717] leading-snug">
                        {item.title}
                      </div>

                      {item.status === 'Rejected' && item.rejectionReason && (
                        <div className="text-[11px] text-[#8B1E1E]">
                          <strong>Feedback:</strong> {item.rejectionReason}
                        </div>
                      )}
                    </div>
                    );
                  })
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
            <div className="bg-white border border-[#E4E2DA] rounded-2xl p-10 text-center space-y-2">
              <FileText className="w-7 h-7 text-[#77766F] mx-auto" />
              <div className="text-sm font-semibold text-[#171717]">No submissions found</div>
            </div>
          ) : (
            <div className="space-y-5">
              {filteredSubmissions.map(poll => {
                const st = statusTextStyle(poll.status);
                return (
                <div
                  key={poll.id}
                  className="bg-white border border-[#E4E2DA] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#E4E2DA]">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className={`inline-flex items-center gap-1.5 font-bold ${st.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                        {poll.status}
                      </span>
                      <span className="text-[#E4E2DA]">·</span>
                      <span className="font-bold text-[#171717]">{poll.batchCode}</span>
                      <span className="text-[#E4E2DA]">·</span>
                      <span className="text-[#57564F]">
                        {poll.submittedByName}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-[#77766F] font-mono-tabular">
                      <span>{poll.totalVotes} Votes</span>
                      {poll.endAt && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>Due {new Date(poll.endAt).toLocaleDateString()}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <h3 className="font-serif-editorial text-xl sm:text-2xl text-[#171717]">{poll.title}</h3>
                    <p className="text-xs sm:text-sm text-[#57564F]">{poll.description}</p>
                  </div>

                  {poll.status === 'Rejected' && poll.rejectionReason && (
                    <div className="p-3.5 rounded-xl bg-[#FDE8E8]/60 border border-[#F5B5B5] text-xs text-[#8B1E1E] flex items-start gap-2">
                      <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <strong>Rejected:</strong> {poll.rejectionReason}
                      </div>
                    </div>
                  )}

                  {poll.status === 'Pending' && (
                    <div className="text-xs text-[#8B5E00] flex items-center gap-1.5 font-medium">
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      <span>Awaiting Registrar review before opening to students</span>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-[#77766F] flex items-center gap-1.5">
                      <BarChart3 className="w-3.5 h-3.5" />
                      <span>Options</span>
                    </div>
                    <div className="border border-[#E4E2DA] rounded-xl divide-y divide-[#E4E2DA] overflow-hidden">
                      {poll.options.map(opt => (
                        <div
                          key={opt.id}
                          className="px-3.5 py-2.5 flex items-center justify-between gap-4 text-xs"
                        >
                          <span className="font-medium text-[#171717]">{opt.label}</span>
                          {opt.votes !== null ? (
                            <span className="font-mono-tabular font-semibold text-[#171717] shrink-0">
                              {opt.percentage}% ({opt.votes})
                            </span>
                          ) : (
                            <span className="text-[11px] text-[#77766F]">Pending</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 4: VOTING STATUS & PERMITTED VOTING RESULTS */}
      {subView === 'results' && (
        <div className="space-y-5">
          {permittedResultsPolls.map(poll => {
            const st = statusTextStyle(poll.status);
            return (
            <div
              key={poll.id}
              className="bg-white border border-[#E4E2DA] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#E4E2DA]">
                <div className="flex items-center gap-2 text-xs">
                  <span className={`inline-flex items-center gap-1.5 font-bold ${st.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                    {poll.status}
                  </span>
                  <span className="text-[#E4E2DA]">·</span>
                  <span className="font-bold text-[#171717]">{poll.batchCode}</span>
                  <span className="text-[#E4E2DA]">·</span>
                  <span className="text-[#57564F]">
                    {poll.submittedByName} ({poll.brGenderRole} BR)
                  </span>
                </div>
                <div className="text-xs font-mono-tabular font-bold text-[#171717]">
                  {poll.totalVotes} Votes
                </div>
              </div>

              <div>
                <h3 className="font-serif-editorial text-xl sm:text-2xl text-[#171717]">{poll.title}</h3>
                <p className="text-xs text-[#57564F] mt-1">{poll.description}</p>
              </div>

              <div className="border border-[#E4E2DA] rounded-xl divide-y divide-[#E4E2DA] overflow-hidden">
                {poll.options.map(opt => {
                  const pct = opt.percentage ?? 0;
                  return (
                    <div
                      key={opt.id}
                      className="relative overflow-hidden bg-white px-3.5 py-2.5"
                    >
                      <div
                        className="absolute inset-y-0 left-0 bg-[#B8EEEE]/35 pointer-events-none"
                        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                      />
                      <div className="relative z-10 flex items-center justify-between gap-4 text-xs">
                        <span className="font-medium text-[#171717]">{opt.label}</span>
                        <span className="font-mono-tabular font-semibold text-[#171717] shrink-0">
                          {opt.percentage ?? 0}% ({opt.votes ?? 0})
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
