import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2,
  XCircle,
  Globe,
  Lock,
  Trash2,
  Eye,
  Plus,
  Users,
  KeyRound,
  UserCheck,
  UserX,
  BarChart3,
  Filter,
  Calendar,
  ShieldCheck,
  Copy,
  Check,
  RefreshCw,
  LogIn,
  AlertCircle,
  TrendingUp,
  PieChart as PieChartIcon
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  AuthenticatedVotingUser,
  PollDTO,
  BatchDTO,
  BrAccountDTO,
  BrGenderRole,
  PollStatus,
  ResultVisibility,
  fetchVotingOverview,
  createBatchAdmin,
  createBrAccountAdmin,
  updateBrAccountAdmin,
  updatePollStatusAdmin,
  deletePollAdmin,
  loginWithBackend
} from '../services/votingApi';

interface AdminVotingManagementPageProps {
  currentUser: AuthenticatedVotingUser;
  initialSubView?: 'voting' | 'analytics' | 'br-management';
  onSwitchUser?: (user: AuthenticatedVotingUser) => void;
}

export const AdminVotingManagementPage: React.FC<AdminVotingManagementPageProps> = ({
  currentUser,
  initialSubView = 'voting',
  onSwitchUser
}) => {
  const [subView, setSubView] = useState<'voting' | 'analytics' | 'br-management'>(initialSubView);
  const [polls, setPolls] = useState<PollDTO[]>([]);
  const [batches, setBatches] = useState<BatchDTO[]>([]);
  const [brAccounts, setBrAccounts] = useState<BrAccountDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Question Moderation Filters (Section 4A)
  const [filterBatch, setFilterBatch] = useState<string>('ALL');
  const [filterGender, setFilterGender] = useState<'ALL' | 'male' | 'female'>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterDateRange, setFilterDateRange] = useState<'ALL' | '24h' | '7d'>('ALL');

  // Preview & Publish Modal State
  const [previewPoll, setPreviewPoll] = useState<PollDTO | null>(null);
  const [publishStartAt, setPublishStartAt] = useState<string>('');
  const [publishEndAt, setPublishEndAt] = useState<string>('');
  const [publishVisibility, setPublishVisibility] = useState<ResultVisibility>('after_vote');
  const [publishScope, setPublishScope] = useState<'all_batches' | 'submitting_batch'>(
    'all_batches'
  );

  // Reject Modal State
  const [rejectingPoll, setRejectingPoll] = useState<PollDTO | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState<string>('');

  // Create Batch Form State
  const [showCreateBatchModal, setShowCreateBatchModal] = useState(false);
  const [newBatchCode, setNewBatchCode] = useState('');
  const [newBatchName, setNewBatchName] = useState('');
  const [newBatchDept, setNewBatchDept] = useState('BSCS');
  const [newBatchYear, setNewBatchYear] = useState(1);
  const [newBatchSemester, setNewBatchSemester] = useState(1);
  const [newBatchStudents, setNewBatchStudents] = useState(90);

  // Create BR Account & Assign to Batch Form State
  const [brFormBatchId, setBrFormBatchId] = useState<string>('');
  const [brFormGender, setBrFormGender] = useState<BrGenderRole>('male');
  const [brFormName, setBrFormName] = useState<string>('');
  const [brFormEmail, setBrFormEmail] = useState<string>('');
  const [brFormPassword, setBrFormPassword] = useState<string>('BR-Access@2026');
  const [brFormReplaceExisting, setBrFormReplaceExisting] = useState<boolean>(true);
  const [issuedCredsCard, setIssuedCredsCard] = useState<{
    name: string;
    email: string;
    password: string;
    batchCode?: string;
    genderRole?: string;
  } | null>(null);
  const [copiedCreds, setCopiedCreds] = useState(false);

  // Password Reset Modal State
  const [resettingBr, setResettingBr] = useState<BrAccountDTO | null>(null);
  const [resetPasswordInput, setResetPasswordInput] = useState('BR-Reset@2026');

  useEffect(() => {
    setSubView(initialSubView);
  }, [initialSubView]);

  const hasLoadedOnceRef = React.useRef(false);
  const currentUserRef = React.useRef(currentUser);
  currentUserRef.current = currentUser;

  const loadAdminOverview = useCallback(async () => {
    if (!hasLoadedOnceRef.current) {
      setLoading(true);
    }
    try {
      const data = await fetchVotingOverview(currentUserRef.current);
      hasLoadedOnceRef.current = true;
      setPolls(data.polls);
      setBatches(data.batches);
      setBrAccounts(data.brAccounts || []);
      setBrFormBatchId(prev => prev || (data.batches.length > 0 ? data.batches[0].id : ''));
    } catch (err) {
      setBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to load voting administration data.'
      });
    } finally {
      setLoading(false);
    }
  }, [currentUser.id, currentUser.email]);

  useEffect(() => {
    loadAdminOverview();
  }, [loadAdminOverview]);

  const openPublishPreviewModal = (poll: PollDTO) => {
    setPreviewPoll(poll);
    const todayStr = new Date().toISOString().split('T')[0];
    const defaultEndStr = poll.endAt
      ? poll.endAt.split('T')[0]
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setPublishStartAt(poll.startAt ? poll.startAt.split('T')[0] : todayStr);
    setPublishEndAt(defaultEndStr);
    setPublishVisibility(poll.resultVisibility || 'after_vote');
    setPublishScope(poll.targetScope || 'all_batches');
  };

  const handleQuickStatusChange = async (
    pollId: string,
    status: PollStatus,
    extra?: {
      rejectionReason?: string;
      resultVisibility?: ResultVisibility;
      startAt?: string | null;
      endAt?: string | null;
      targetScope?: 'all_batches' | 'submitting_batch';
    }
  ) => {
    setBanner(null);
    try {
      const res = await updatePollStatusAdmin(currentUser, pollId, {
        status,
        ...extra
      });
      setPolls(prev => prev.map(p => (p.id === pollId ? res.poll : p)));
      setBanner({ type: 'success', text: res.message });
      setPreviewPoll(null);
      setRejectingPoll(null);
      setRejectionReasonInput('');
    } catch (err) {
      setBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to update status.'
      });
    }
  };

  const handleDeletePoll = async (pollId: string) => {
    setBanner(null);
    try {
      const res = await deletePollAdmin(currentUser, pollId);
      setPolls(prev => prev.filter(p => p.id !== pollId));
      setBanner({ type: 'success', text: res.message });
    } catch (err) {
      setBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to remove question.'
      });
    }
  };

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);
    try {
      const res = await createBatchAdmin(currentUser, {
        code: newBatchCode,
        name: newBatchName,
        departmentCode: newBatchDept,
        year: newBatchYear,
        semester: newBatchSemester,
        studentCount: newBatchStudents
      });
      setBanner({ type: 'success', text: res.message });
      setShowCreateBatchModal(false);
      setNewBatchCode('');
      setNewBatchName('');
      await loadAdminOverview();
    } catch (err) {
      setBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to create batch.'
      });
    }
  };

  const handleCreateBrAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);
    try {
      const res = await createBrAccountAdmin(currentUser, {
        name: brFormName,
        email: brFormEmail,
        password: brFormPassword,
        batchId: brFormBatchId,
        genderRole: brFormGender,
        replaceExisting: brFormReplaceExisting
      });
      setIssuedCredsCard({
        name: res.issuedCredentials.name,
        email: res.issuedCredentials.email,
        password: res.issuedCredentials.password,
        batchCode: res.issuedCredentials.batchCode,
        genderRole: res.issuedCredentials.genderRole
      });
      setBanner({ type: 'success', text: res.message });
      setBrFormName('');
      setBrFormEmail('');
      await loadAdminOverview();
    } catch (err) {
      setBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to create BR account.'
      });
    }
  };

  const handleBrAccountAction = async (
    userId: string,
    action: 'activate' | 'deactivate' | 'reset_password',
    newPassword?: string
  ) => {
    setBanner(null);
    try {
      const res = await updateBrAccountAdmin(currentUser, userId, {
        action,
        newPassword
      });
      if (res.issuedCredentials) {
        setIssuedCredsCard(res.issuedCredentials);
      }
      setResettingBr(null);
      setBanner({ type: 'success', text: res.message });
      await loadAdminOverview();
    } catch (err) {
      setBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Action failed.'
      });
    }
  };

  const handleTestLoginAsBr = async (email: string, password?: string | null) => {
    try {
      const loggedInBr = await loginWithBackend(
        email,
        password || undefined,
        !password
      );
      onSwitchUser?.(loggedInBr);
    } catch (err) {
      setBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Could not switch to BR account.'
      });
    }
  };

  // Analytics Computations
  const totalVotesCast = polls.reduce((sum, p) => sum + p.totalVotes, 0);
  const maleBrQuestionsCount = polls.filter(p => p.brGenderRole === 'male').length;
  const femaleBrQuestionsCount = polls.filter(p => p.brGenderRole === 'female').length;
  const activeQuestionsCount = polls.filter(p => p.status === 'Published').length;
  const closedQuestionsCount = polls.filter(p => p.status === 'Closed').length;
  const pendingApprovalCount = polls.filter(p => p.status === 'Pending').length;

  // Build Recharts dataset for Batch Participation Rates
  const publishedOrClosedPollsCount = Math.max(
    1,
    polls.filter(p => p.status === 'Published' || p.status === 'Closed').length
  );

  const batchParticipationChartData = batches.map(batch => {
    const votesCast = batch.totalVotesCast || 0;
    const uniqueVoters = batch.uniqueVoters || 0;
    // Engagement rate relative to active cohort participation across open polls
    const rawEngagementPct =
      batch.studentCount > 0
        ? Math.min(
            100,
            Math.round(
              ((votesCast * 12) / Math.max(1, batch.studentCount)) * 10
            ) / 10
          )
        : 0;

    return {
      batchCode: batch.code,
      batchName: batch.name,
      department: batch.departmentCode,
      studentCount: batch.studentCount,
      votesCast,
      uniqueVoters,
      participationRate: rawEngagementPct,
      maleBrQuestions: batch.maleBrQuestions || 0,
      femaleBrQuestions: batch.femaleBrQuestions || 0,
      totalQuestions: batch.questionsSubmitted || 0
    };
  });

  const brGenderPieData = [
    { name: 'Male BR Submissions', value: maleBrQuestionsCount, color: '#171717' },
    { name: 'Female BR Submissions', value: femaleBrQuestionsCount, color: '#84CC16' }
  ];

  const pollStatusChartData = [
    { status: 'Published', count: activeQuestionsCount },
    { status: 'Closed', count: closedQuestionsCount },
    { status: 'Pending', count: pendingApprovalCount },
    { status: 'Approved', count: polls.filter(p => p.status === 'Approved').length },
    { status: 'Rejected', count: polls.filter(p => p.status === 'Rejected').length }
  ];

  // Filtered Polls
  const filteredPolls = polls.filter(p => {
    if (filterBatch !== 'ALL' && p.batchId !== filterBatch) return false;
    if (filterGender !== 'ALL' && p.brGenderRole !== filterGender) return false;
    if (filterStatus !== 'ALL' && p.status !== filterStatus) return false;
    if (filterDateRange !== 'ALL') {
      const createdMs = new Date(p.createdAt).getTime();
      const cutoffMs =
        filterDateRange === '24h'
          ? Date.now() - 24 * 60 * 60 * 1000
          : Date.now() - 7 * 24 * 60 * 60 * 1000;
      if (createdMs < cutoffMs) return false;
    }
    return true;
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
    <div className="space-y-8 pb-16">
      {/* Top Admin Header & 3-Tab Sub-View Switcher */}
      <div className="bg-white border border-[#E4E2DA] rounded-3xl p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="text-xs font-semibold text-[#57564F]">
              Registrar & Governance Control Center · {publishedOrClosedPollsCount} Published/Closed Polls
            </div>
            <h1 className="font-serif-editorial text-3xl sm:text-4xl text-[#171717] tracking-tight">
              {subView === 'voting'
                ? 'Voting Moderation Queue'
                : subView === 'analytics'
                ? 'Voting Analytics & Cohort Engagement'
                : 'Batch & Representative (BR) Management'}
            </h1>
            <p className="text-xs sm:text-sm text-[#57564F] leading-relaxed">
              {subView === 'voting'
                ? 'Review, approve, reject, or publish questions submitted by Male and Female Batch Representatives. Configure voting windows and result visibility rules.'
                : subView === 'analytics'
                ? 'Interactive visualizations of student participation rates across batches, vote distributions, and Male vs Female BR submission activity.'
                : 'Manage university batches, assign one Male and one Female Batch Representative per cohort, and issue or reset BR login credentials.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div
              className="flex flex-wrap items-center gap-1 p-1.5 rounded-2xl bg-[#F7F6EF] border border-[#E4E2DA]"
              role="tablist"
              aria-label="Voting administration tabs"
            >
              <button
                type="button"
                role="tab"
                aria-selected={subView === 'voting'}
                onClick={() => setSubView('voting')}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                  subView === 'voting'
                    ? 'bg-[#171717] text-white'
                    : 'text-[#57564F] hover:text-[#171717]'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Moderation Queue</span>
                {pendingApprovalCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-[#B7F77C] text-[#171717] text-[10px] font-bold">
                    {pendingApprovalCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={subView === 'analytics'}
                onClick={() => setSubView('analytics')}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                  subView === 'analytics'
                    ? 'bg-[#171717] text-white'
                    : 'text-[#57564F] hover:text-[#171717]'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Voting Analytics</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={subView === 'br-management'}
                onClick={() => setSubView('br-management')}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                  subView === 'br-management'
                    ? 'bg-[#171717] text-white'
                    : 'text-[#57564F] hover:text-[#171717]'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>BR Management</span>
              </button>
            </div>

            <button
              type="button"
              onClick={loadAdminOverview}
              className="btn-secondary h-10 px-3 text-xs"
              title="Refresh data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Compact Inline Summary Metrics Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-5 pt-4 border-t border-[#E4E2DA] text-xs">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="px-3 py-1.5 rounded-xl bg-[#FFF6D6]/70 border border-[#F0D98C] text-[#6E5100] font-semibold">
              Pending Review: <strong className="font-mono-tabular">{pendingApprovalCount}</strong>
            </span>
            <span className="px-3 py-1.5 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] text-[#171717]">
              Active Polls: <strong className="font-mono-tabular">{activeQuestionsCount}</strong> · Closed: <strong className="font-mono-tabular">{closedQuestionsCount}</strong>
            </span>
            <span className="px-3 py-1.5 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] text-[#171717]">
              Total Votes Cast: <strong className="font-mono-tabular">{totalVotesCast}</strong>
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-[#B8EEEE]/40 border border-[#8FD8D8] text-[#171717] font-medium">
              Male BR: <strong className="font-mono-tabular">{maleBrQuestionsCount}</strong>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-[#F2D8FA]/50 border border-[#D8B4E2] text-[#171717] font-medium">
              Female BR: <strong className="font-mono-tabular">{femaleBrQuestionsCount}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      {banner && (
        <div
          className={`p-4 rounded-2xl border text-xs font-medium flex items-center justify-between gap-3 ${
            banner.type === 'success'
              ? 'bg-[#E8F8E0] border-[#A5E087] text-[#1B5E20]'
              : 'bg-[#FDE8E8] border-[#F5B5B5] text-[#8B1E1E]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {banner.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{banner.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="text-xs underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* =========================================================
          SUB-VIEW: VOTING ANALYTICS TAB (Recharts Visualizations)
         ========================================================= */}
      {subView === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Chart 1 (8 cols): Participation Rate & Votes Cast Across Batches */}
            <div className="lg:col-span-8 bg-white border border-[#E4E2DA] rounded-3xl p-6 sm:p-8 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E4E2DA] pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[#171717]" />
                    <h2 className="font-serif-editorial text-2xl text-[#171717]">
                      Student Participation & Engagement Across Batches
                    </h2>
                  </div>
                  <p className="text-xs text-[#77766F] mt-0.5">
                    Compares engagement rate (%), total votes cast, and BR questions proposed per academic cohort
                  </p>
                </div>
              </div>

              <div className="h-[320px] w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={batchParticipationChartData}
                    margin={{ top: 12, right: 20, left: 0, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E4E2DA" vertical={false} />
                    <XAxis
                      dataKey="batchCode"
                      tick={{ fill: '#171717', fontSize: 12, fontWeight: 600 }}
                      axisLine={{ stroke: '#E4E2DA' }}
                    />
                    <YAxis
                      tick={{ fill: '#57564F', fontSize: 11 }}
                      axisLine={{ stroke: '#E4E2DA' }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#171717',
                        borderColor: '#383838',
                        borderRadius: '12px',
                        color: '#FFFFFF',
                        fontSize: '12px'
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar
                      dataKey="participationRate"
                      name="Engagement Index (%)"
                      fill="#171717"
                      radius={[6, 6, 0, 0]}
                    />
                    <Bar
                      dataKey="votesCast"
                      name="Total Votes Cast"
                      fill="#84CC16"
                      radius={[6, 6, 0, 0]}
                    />
                    <Bar
                      dataKey="totalQuestions"
                      name="BR Questions Submitted"
                      fill="#38BDF8"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2 (4 cols): Male vs Female BR Submissions & Status Breakdown */}
            <div className="lg:col-span-4 bg-white border border-[#E4E2DA] rounded-3xl p-6 sm:p-8 flex flex-col justify-between space-y-6">
              <div className="space-y-2 border-b border-[#E4E2DA] pb-4">
                <div className="flex items-center gap-2">
                  <PieChartIcon className="w-4 h-4 text-[#171717]" />
                  <h2 className="font-serif-editorial text-2xl text-[#171717]">
                    Representative Parity
                  </h2>
                </div>
                <p className="text-xs text-[#77766F]">
                  Questions submitted by designated Male vs Female Batch Representatives
                </p>
              </div>

              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={brGenderPieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={78}
                      paddingAngle={4}
                    >
                      {brGenderPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#171717',
                        borderColor: '#383838',
                        borderRadius: '12px',
                        color: '#FFFFFF',
                        fontSize: '12px'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA]">
                  <span className="font-semibold text-[#171717]">Male BR Questions</span>
                  <span className="font-mono-tabular font-bold text-[#171717]">
                    {maleBrQuestionsCount} (
                    {polls.length > 0
                      ? Math.round((maleBrQuestionsCount / polls.length) * 100)
                      : 0}
                    %)
                  </span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA]">
                  <span className="font-semibold text-[#171717]">Female BR Questions</span>
                  <span className="font-mono-tabular font-bold text-[#171717]">
                    {femaleBrQuestionsCount} (
                    {polls.length > 0
                      ? Math.round((femaleBrQuestionsCount / polls.length) * 100)
                      : 0}
                    %)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Batch Engagement Table & Question Status Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 bg-white border border-[#E4E2DA] rounded-3xl p-6 sm:p-8 space-y-4">
              <h3 className="font-serif-editorial text-2xl text-[#171717]">
                Cohort-by-Cohort Participation Breakdown
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#E4E2DA] text-[#77766F]">
                      <th className="py-2.5 pr-4 font-semibold">Batch Cohort</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Enrolled</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Unique Voters</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Total Ballots</th>
                      <th className="py-2.5 px-3 font-semibold text-right">BR Submissions (M / F)</th>
                      <th className="py-2.5 pl-3 font-semibold text-right">Engagement</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E2DA]">
                    {batchParticipationChartData.map(row => (
                      <tr key={row.batchCode} className="hover:bg-[#F7F6EF]/70">
                        <td className="py-3 pr-4">
                          <div className="font-bold text-[#171717]">{row.batchCode}</div>
                          <div className="text-[11px] text-[#77766F]">{row.batchName}</div>
                        </td>
                        <td className="py-3 px-3 text-right font-mono-tabular">
                          {row.studentCount}
                        </td>
                        <td className="py-3 px-3 text-right font-mono-tabular font-semibold">
                          {row.uniqueVoters}
                        </td>
                        <td className="py-3 px-3 text-right font-mono-tabular font-bold text-[#171717]">
                          {row.votesCast}
                        </td>
                        <td className="py-3 px-3 text-right font-mono-tabular">
                          {row.maleBrQuestions}M · {row.femaleBrQuestions}F
                        </td>
                        <td className="py-3 pl-3 text-right font-mono-tabular font-bold text-[#171717]">
                          {row.participationRate}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="lg:col-span-4 bg-white border border-[#E4E2DA] rounded-3xl p-6 sm:p-8 space-y-4">
              <h3 className="font-serif-editorial text-2xl text-[#171717]">
                Poll Lifecycle Pipeline
              </h3>
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={pollStatusChartData}
                    layout="vertical"
                    margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E4E2DA" horizontal={false} />
                    <XAxis type="number" tick={{ fill: '#57564F', fontSize: 11 }} />
                    <YAxis
                      type="category"
                      dataKey="status"
                      tick={{ fill: '#171717', fontSize: 11, fontWeight: 600 }}
                      width={75}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#171717',
                        borderColor: '#383838',
                        borderRadius: '12px',
                        color: '#FFFFFF',
                        fontSize: '12px'
                      }}
                    />
                    <Bar dataKey="count" name="Questions" fill="#171717" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          SUB-VIEW 1: VOTING MODERATION QUEUE (Section 4)
         ========================================================= */}
      {subView === 'voting' && (
        <div className="space-y-6">
          {/* Multi-Dimensional Filter Bar */}
          <div className="bg-white border border-[#E4E2DA] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-[#171717]">
              <Filter className="w-4 h-4 text-[#77766F]" />
              <span>Filter Questions:</span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <select
                value={filterBatch}
                onChange={e => setFilterBatch(e.target.value)}
                className="h-9 px-3 rounded-xl border border-[#E4E2DA] bg-[#F7F6EF] text-xs font-semibold text-[#171717]"
              >
                <option value="ALL">All Batches</option>
                {batches.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.code} — {b.name}
                  </option>
                ))}
              </select>

              <select
                value={filterGender}
                onChange={e => setFilterGender(e.target.value as 'ALL' | 'male' | 'female')}
                className="h-9 px-3 rounded-xl border border-[#E4E2DA] bg-[#F7F6EF] text-xs font-semibold text-[#171717]"
              >
                <option value="ALL">All Representatives (Male & Female BR)</option>
                <option value="male">Male Representative Only</option>
                <option value="female">Female Representative Only</option>
              </select>

              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="h-9 px-3 rounded-xl border border-[#E4E2DA] bg-[#F7F6EF] text-xs font-semibold text-[#171717]"
              >
                <option value="ALL">All Statuses</option>
                <option value="Pending">Pending Review</option>
                <option value="Approved">Approved (Ready to Publish)</option>
                <option value="Published">Published (Live Voting)</option>
                <option value="Closed">Closed</option>
                <option value="Rejected">Rejected</option>
              </select>

              <select
                value={filterDateRange}
                onChange={e => setFilterDateRange(e.target.value as 'ALL' | '24h' | '7d')}
                className="h-9 px-3 rounded-xl border border-[#E4E2DA] bg-[#F7F6EF] text-xs font-semibold text-[#171717]"
              >
                <option value="ALL">Any Submission Date</option>
                <option value="24h">Submitted in Last 24 Hours</option>
                <option value="7d">Submitted in Last 7 Days</option>
              </select>
            </div>
          </div>

          {/* Questions Moderation Cards */}
          <div className="space-y-5">
            {filteredPolls.map(poll => (
              <div
                key={poll.id}
                className="bg-white border border-[#E4E2DA] rounded-3xl p-6 sm:p-8 shadow-xs space-y-6"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#E4E2DA]">
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
                    <span className="font-semibold text-[#57564F]">
                      {poll.brGenderRole === 'female' ? 'Female BR' : 'Male BR'}
                    </span>
                    <span>·</span>
                    <span className="text-[#57564F]">
                      Submitted by <strong className="text-[#171717]">{poll.submittedByName}</strong>
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-[#77766F]">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Submitted {new Date(poll.createdAt).toLocaleDateString()}</span>
                    </span>
                    <span className="font-mono-tabular font-bold text-[#171717]">
                      {poll.totalVotes} Total Votes
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <h2 className="font-serif-editorial text-2xl text-[#171717]">{poll.title}</h2>
                  <p className="text-xs sm:text-sm text-[#57564F] leading-relaxed">
                    {poll.description}
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className={`${poll.batchBreakdown.length > 0 ? 'lg:col-span-7' : 'lg:col-span-12'} space-y-2`}>
                    <div className="text-[11px] font-semibold text-[#77766F]">
                      Answer Options & Vote Distribution
                    </div>
                    <div className={`grid grid-cols-1 ${poll.batchBreakdown.length === 0 ? 'sm:grid-cols-2' : ''} gap-2`}>
                      {poll.options.map(opt => {
                        const pct = opt.percentage ?? 0;
                        return (
                          <div
                            key={opt.id}
                            className="relative overflow-hidden rounded-xl border border-[#E4E2DA] bg-[#F7F6EF] p-3"
                          >
                            <div
                              className="absolute inset-y-0 left-0 bg-[#B8EEEE]/45 pointer-events-none"
                              style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                            />
                            <div className="relative z-10 flex items-center justify-between gap-3 text-xs">
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

                  {poll.batchBreakdown.length > 0 && (
                    <div className="lg:col-span-5 space-y-2">
                      <div className="text-[11px] font-semibold text-[#77766F]">
                        Participation by Batch
                      </div>
                      <div className="space-y-2">
                        {poll.batchBreakdown.map(b => (
                          <div
                            key={b.batchId}
                            className="p-3 rounded-xl bg-[#F7F6EF] border border-[#E4E2DA] space-y-1"
                          >
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-[#171717]">{b.batchCode}</span>
                              <span className="font-mono-tabular text-[#57564F]">
                                {b.votesCast} / {b.studentCount} students ({b.participationRate}%)
                              </span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-[#E4E2DA] overflow-hidden">
                              <div
                                className="h-full bg-[#171717]"
                                style={{ width: `${Math.min(100, b.participationRate)}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {poll.status === 'Rejected' && poll.rejectionReason && (
                  <div className="p-3.5 rounded-2xl bg-[#FDE8E8] border border-[#F5B5B5] text-xs text-[#8B1E1E]">
                    <strong>Rejection Feedback Sent to BR:</strong> {poll.rejectionReason}
                  </div>
                )}

                <div className="pt-4 border-t border-[#E4E2DA] flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#57564F]">
                    <span>
                      Result Visibility:{' '}
                      <strong className="text-[#171717]">
                        {poll.resultVisibility === 'always'
                          ? 'Always Live'
                          : poll.resultVisibility === 'after_vote'
                          ? 'After Student Votes'
                          : 'After Voting Closes'}
                      </strong>
                    </span>
                    {poll.endAt && (
                      <span>
                        · Closes{' '}
                        <strong className="text-[#171717]">
                          {new Date(poll.endAt).toLocaleDateString()}
                        </strong>
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openPublishPreviewModal(poll)}
                      className="btn-secondary py-2 px-3.5 text-xs font-semibold"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Preview & Configure Publishing</span>
                    </button>

                    {poll.status === 'Pending' && (
                      <button
                        type="button"
                        onClick={() => handleQuickStatusChange(poll.id, 'Approved')}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#E3F2FD] hover:bg-[#BBDEFB] text-[#0D47A1] text-xs font-semibold cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Approve</span>
                      </button>
                    )}

                    {(poll.status === 'Pending' || poll.status === 'Approved') && (
                      <button
                        type="button"
                        onClick={() => openPublishPreviewModal(poll)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#B7F77C] hover:bg-[#a6ec68] text-[#171717] text-xs font-bold cursor-pointer"
                      >
                        <Globe className="w-3.5 h-3.5" />
                        <span>Publish for Voting</span>
                      </button>
                    )}

                    {poll.status !== 'Rejected' && poll.status !== 'Closed' && (
                      <button
                        type="button"
                        onClick={() => {
                          setRejectingPoll(poll);
                          setRejectionReasonInput(poll.rejectionReason || '');
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#FDE8E8] hover:bg-[#FAC5C5] text-[#8B1E1E] text-xs font-semibold cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                    )}

                    {poll.status === 'Published' && (
                      <button
                        type="button"
                        onClick={() => handleQuickStatusChange(poll.id, 'Closed')}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#EDEAE0] hover:bg-[#E4E2DA] text-[#171717] text-xs font-semibold cursor-pointer"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>Close Voting</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDeletePoll(poll.id)}
                      className="p-2 rounded-xl text-[#77766F] hover:text-[#8B1E1E] hover:bg-[#FDE8E8] transition-colors cursor-pointer"
                      title="Delete question permanently"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================
          SUB-VIEW 2: BATCH & BR MANAGEMENT (Section 1A & 1B)
         ========================================================= */}
      {subView === 'br-management' && (
        <div className="space-y-8">
          {issuedCredsCard && (
            <div className="bg-[#171717] text-white rounded-3xl p-6 border border-[#383838] shadow-lg space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#B7F77C] text-[#171717] flex items-center justify-center font-bold">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#B7F77C]">
                      Batch Representative Credentials Ready
                    </div>
                    <div className="text-sm font-semibold text-white">
                      {issuedCredsCard.name}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(
                        `Email: ${issuedCredsCard.email}\nPassword: ${issuedCredsCard.password}`
                      );
                      setCopiedCreds(true);
                      setTimeout(() => setCopiedCreds(false), 2000);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white cursor-pointer"
                  >
                    {copiedCreds ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#B7F77C]" />
                        <span>Copied Credentials</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Login Details</span>
                      </>
                    )}
                  </button>

                  {onSwitchUser && (
                    <button
                      type="button"
                      onClick={() =>
                        handleTestLoginAsBr(issuedCredsCard.email, issuedCredsCard.password)
                      }
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#B8EEEE] text-[#171717] text-xs font-bold cursor-pointer"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Sign In as This BR Now</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono-tabular">
                <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-[10px] text-white/60">Login Email</div>
                  <div className="text-white font-semibold mt-0.5">{issuedCredsCard.email}</div>
                </div>
                <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-[10px] text-white/60">Issued Password</div>
                  <div className="text-[#B7F77C] font-semibold mt-0.5">
                    {issuedCredsCard.password}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-[10px] text-white/60">Assigned Batch & Role</div>
                  <div className="text-white font-semibold mt-0.5 capitalize">
                    {issuedCredsCard.batchCode || 'Assigned Batch'} ·{' '}
                    {issuedCredsCard.genderRole || 'Representative'} BR
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-serif-editorial text-2xl text-[#171717]">
                    University Batches & Designated Representatives
                  </h2>
                  <p className="text-xs text-[#77766F]">
                    Each batch has strictly 1 Male Representative slot and 1 Female Representative slot.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowCreateBatchModal(true)}
                  className="btn-primary py-2 px-4 text-xs font-semibold"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Batch</span>
                </button>
              </div>

              <div className="bg-white border border-[#E4E2DA] rounded-2xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#F7F6EF] border-b border-[#E4E2DA] text-[11px] font-semibold uppercase tracking-wider text-[#77766F]">
                        <th className="py-3 px-4">Batch &amp; Department</th>
                        <th className="py-3 px-3">Sem / Size</th>
                        <th className="py-3 px-4">Male Representative</th>
                        <th className="py-3 px-4">Female Representative</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E4E2DA] text-xs">
                      {batches.map(batch => (
                        <tr key={batch.id} className="hover:bg-[#F7F6EF]/60 transition-colors align-top">
                          <td className="py-3.5 px-4">
                            <div className="font-mono-tabular font-bold text-[#171717]">{batch.code}</div>
                            <div className="text-[11px] text-[#57564F] mt-0.5">{batch.name}</div>
                            <div className="text-[10.5px] text-[#77766F] mt-0.5">
                              Dept: {batch.departmentCode} · Year {batch.year}
                            </div>
                          </td>
                          <td className="py-3.5 px-3 font-mono-tabular text-[11px] text-[#57564F] whitespace-nowrap">
                            <div>Sem {batch.semester}</div>
                            <div className="text-[#77766F]">{batch.studentCount} students</div>
                          </td>
                          <td className="py-3.5 px-4">
                            {batch.maleRepresentative ? (
                              <div className="space-y-0.5">
                                <div className="font-semibold text-[#171717] flex items-center gap-1.5">
                                  <span>{batch.maleRepresentative.name}</span>
                                  <span className="px-1.5 py-0.2 rounded bg-[#E8F8E0] text-[#1B5E20] text-[10px]">
                                    Assigned
                                  </span>
                                </div>
                                <div className="text-[11px] text-[#57564F] font-mono-tabular truncate max-w-[180px]">
                                  {batch.maleRepresentative.email}
                                </div>
                                {batch.maleRepresentative.credentialHint && (
                                  <div className="text-[10.5px] text-[#77766F] font-mono-tabular">
                                    Pass: {batch.maleRepresentative.credentialHint}
                                  </div>
                                )}
                                {onSwitchUser && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleTestLoginAsBr(
                                        batch.maleRepresentative!.email,
                                        batch.maleRepresentative!.credentialHint
                                      )
                                    }
                                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#171717] underline cursor-pointer pt-0.5"
                                  >
                                    <LogIn className="w-3 h-3" />
                                    <span>Test Login</span>
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <span className="inline-block px-1.5 py-0.5 rounded bg-[#FFF4E5] text-[#6E5100] text-[10px] font-semibold">
                                  Vacant Slot
                                </span>
                                <div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setBrFormBatchId(batch.id);
                                      setBrFormGender('male');
                                      setBrFormEmail(
                                        `br.male.${batch.code.toLowerCase().replace(/[^a-z0-9]/g, '')}@westernpoly.edu`
                                      );
                                    }}
                                    className="text-[11px] font-bold text-[#171717] underline cursor-pointer"
                                  >
                                    + Assign Male BR →
                                  </button>
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            {batch.femaleRepresentative ? (
                              <div className="space-y-0.5">
                                <div className="font-semibold text-[#171717] flex items-center gap-1.5">
                                  <span>{batch.femaleRepresentative.name}</span>
                                  <span className="px-1.5 py-0.2 rounded bg-[#E8F8E0] text-[#1B5E20] text-[10px]">
                                    Assigned
                                  </span>
                                </div>
                                <div className="text-[11px] text-[#57564F] font-mono-tabular truncate max-w-[180px]">
                                  {batch.femaleRepresentative.email}
                                </div>
                                {batch.femaleRepresentative.credentialHint && (
                                  <div className="text-[10.5px] text-[#77766F] font-mono-tabular">
                                    Pass: {batch.femaleRepresentative.credentialHint}
                                  </div>
                                )}
                                {onSwitchUser && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleTestLoginAsBr(
                                        batch.femaleRepresentative!.email,
                                        batch.femaleRepresentative!.credentialHint
                                      )
                                    }
                                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#171717] underline cursor-pointer pt-0.5"
                                  >
                                    <LogIn className="w-3 h-3" />
                                    <span>Test Login</span>
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <span className="inline-block px-1.5 py-0.5 rounded bg-[#FFF4E5] text-[#6E5100] text-[10px] font-semibold">
                                  Vacant Slot
                                </span>
                                <div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setBrFormBatchId(batch.id);
                                      setBrFormGender('female');
                                      setBrFormEmail(
                                        `br.female.${batch.code.toLowerCase().replace(/[^a-z0-9]/g, '')}@westernpoly.edu`
                                      );
                                    }}
                                    className="text-[11px] font-bold text-[#171717] underline cursor-pointer"
                                  >
                                    + Assign Female BR →
                                  </button>
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 space-y-6">
              <div className="bg-white border border-[#E4E2DA] rounded-3xl p-6 shadow-xs space-y-5">
                <div className="border-b border-[#E4E2DA] pb-3">
                  <h3 className="font-serif-editorial text-xl text-[#171717]">
                    Create BR Login Account &amp; Assign Slot
                  </h3>
                  <p className="text-xs text-[#77766F] mt-0.5">
                    Creates a verified Batch Representative account and issues login credentials.
                  </p>
                </div>

                <form onSubmit={handleCreateBrAccount} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#171717] mb-1">
                      Target Batch *
                    </label>
                    <select
                      value={brFormBatchId}
                      onChange={e => setBrFormBatchId(e.target.value)}
                      className="input-field h-10 text-xs"
                    >
                      {batches.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.code} — {b.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#171717] mb-1">
                      Representative Gender Role *
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setBrFormGender('male')}
                        className={`py-2.5 px-3 rounded-xl border text-xs font-semibold cursor-pointer ${
                          brFormGender === 'male'
                            ? 'border-[#171717] bg-[#B8EEEE]/40 text-[#171717]'
                            : 'border-[#E4E2DA] bg-white text-[#57564F]'
                        }`}
                      >
                        Male Representative
                      </button>
                      <button
                        type="button"
                        onClick={() => setBrFormGender('female')}
                        className={`py-2.5 px-3 rounded-xl border text-xs font-semibold cursor-pointer ${
                          brFormGender === 'female'
                            ? 'border-[#171717] bg-[#F2D8FA]/50 text-[#171717]'
                            : 'border-[#E4E2DA] bg-white text-[#57564F]'
                        }`}
                      >
                        Female Representative
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#171717] mb-1">
                      Student Representative Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., Mariam Tariq"
                      value={brFormName}
                      onChange={e => setBrFormName(e.target.value)}
                      className="input-field h-10 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#171717] mb-1">
                      Issued Institutional Login Email *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="br.female.2k25bce@westernpoly.edu"
                      value={brFormEmail}
                      onChange={e => setBrFormEmail(e.target.value)}
                      className="input-field h-10 text-xs font-mono-tabular"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#171717] mb-1">
                      Initial Password *
                    </label>
                    <input
                      type="text"
                      required
                      value={brFormPassword}
                      onChange={e => setBrFormPassword(e.target.value)}
                      className="input-field h-10 text-xs font-mono-tabular"
                    />
                  </div>

                  <label className="flex items-center gap-2 text-xs text-[#57564F] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={brFormReplaceExisting}
                      onChange={e => setBrFormReplaceExisting(e.target.checked)}
                      className="rounded border-[#E4E2DA]"
                    />
                    <span>
                      Replace existing active {brFormGender} representative for this batch if slot is occupied
                    </span>
                  </label>

                  <button
                    type="submit"
                    className="w-full btn-primary py-2.5 text-xs font-semibold justify-center"
                  >
                    <KeyRound className="w-4 h-4" />
                    <span>Create BR Account &amp; Issue Credentials</span>
                  </button>
                </form>
              </div>

              <div className="bg-white border border-[#E4E2DA] rounded-2xl overflow-hidden shadow-xs">
                <div className="p-4 border-b border-[#E4E2DA] flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[#171717]">
                    Issued BR Accounts Directory ({brAccounts.length})
                  </h3>
                </div>

                <div className="overflow-x-auto max-h-[420px]">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#F7F6EF] border-b border-[#E4E2DA] text-[10.5px] font-semibold uppercase tracking-wider text-[#77766F]">
                        <th className="py-2.5 px-3.5">Representative</th>
                        <th className="py-2.5 px-3">Batch</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E4E2DA] text-xs">
                      {brAccounts.map(acc => (
                        <tr key={acc.id} className="hover:bg-[#F7F6EF]/60 transition-colors">
                          <td className="py-2.5 px-3.5">
                            <div className="font-semibold text-[#171717]">{acc.name}</div>
                            <div className="text-[10.5px] font-mono-tabular text-[#57564F] truncate max-w-[160px]">
                              {acc.email}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-mono-tabular text-[11px] text-[#57564F]">
                            {acc.batchCode || '—'}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                acc.isActive
                                  ? 'bg-[#E8F8E0] text-[#1B5E20]'
                                  : 'bg-[#FDE8E8] text-[#8B1E1E]'
                              }`}
                            >
                              {acc.isActive ? 'Active' : 'Deactivated'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setResettingBr(acc);
                                  setResetPasswordInput('BR-NewPass@2026');
                                }}
                                className="px-2 py-1 rounded bg-[#F7F6EF] border border-[#E4E2DA] text-[10px] font-semibold text-[#171717] hover:bg-[#EDEAE0] cursor-pointer"
                              >
                                Reset Pass
                              </button>
                              {acc.isActive ? (
                                <button
                                  type="button"
                                  onClick={() => handleBrAccountAction(acc.id, 'deactivate')}
                                  className="px-2 py-1 rounded bg-[#FDE8E8] text-[10px] font-semibold text-[#8B1E1E] cursor-pointer"
                                >
                                  Deactivate
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleBrAccountAction(acc.id, 'activate')}
                                  className="px-2 py-1 rounded bg-[#E8F8E0] text-[10px] font-semibold text-[#1B5E20] cursor-pointer"
                                >
                                  Activate
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PREVIEW & PUBLISH MODAL */}
      {previewPoll && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setPreviewPoll(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-white border border-[#E4E2DA] rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-[#E4E2DA] pb-3">
              <h3 className="font-serif-editorial text-2xl text-[#171717]">
                Preview & Publish Question
              </h3>
              <span className="text-xs font-bold text-[#171717]">{previewPoll.batchCode}</span>
            </div>

            <div className="p-4 rounded-2xl bg-[#F7F6EF] border border-[#E4E2DA] space-y-2">
              <div className="text-[11px] font-semibold text-[#77766F]">
                Submitted by {previewPoll.submittedByName} ({previewPoll.brGenderRole} BR)
              </div>
              <div className="text-base font-bold text-[#171717]">{previewPoll.title}</div>
              <p className="text-xs text-[#57564F] leading-relaxed">{previewPoll.description}</p>
              <div className="space-y-1.5 pt-2">
                {previewPoll.options.map((opt, idx) => (
                  <div
                    key={opt.id}
                    className="px-3 py-2 rounded-xl bg-white border border-[#E4E2DA] text-xs font-medium text-[#171717]"
                  >
                    {idx + 1}. {opt.label}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#171717] mb-1">
                  Voting Start Date
                </label>
                <input
                  type="date"
                  value={publishStartAt}
                  onChange={e => setPublishStartAt(e.target.value)}
                  className="input-field h-10 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#171717] mb-1">
                  Voting End Date / Deadline
                </label>
                <input
                  type="date"
                  value={publishEndAt}
                  onChange={e => setPublishEndAt(e.target.value)}
                  className="input-field h-10 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#171717] mb-1">
                  Result Visibility Condition
                </label>
                <select
                  value={publishVisibility}
                  onChange={e => setPublishVisibility(e.target.value as ResultVisibility)}
                  className="input-field h-10 text-xs"
                >
                  <option value="after_vote">Show results immediately after voting</option>
                  <option value="always">Always show live results to students</option>
                  <option value="after_close">Reveal results only after voting closes</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#171717] mb-1">
                  Eligible Student Voters
                </label>
                <select
                  value={publishScope}
                  onChange={e =>
                    setPublishScope(e.target.value as 'all_batches' | 'submitting_batch')
                  }
                  className="input-field h-10 text-xs"
                >
                  <option value="all_batches">All University Batches</option>
                  <option value="submitting_batch">
                    Only {previewPoll.batchCode} Students
                  </option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E4E2DA]">
              <button
                type="button"
                onClick={() => setPreviewPoll(null)}
                className="btn-secondary py-2 px-4 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  handleQuickStatusChange(previewPoll.id, 'Published', {
                    startAt: publishStartAt ? new Date(`${publishStartAt}T00:00:00`).toISOString() : null,
                    endAt: publishEndAt ? new Date(`${publishEndAt}T23:59:59`).toISOString() : null,
                    resultVisibility: publishVisibility,
                    targetScope: publishScope
                  })
                }
                className="btn-primary py-2.5 px-5 text-xs font-semibold"
              >
                <Globe className="w-4 h-4" />
                <span>Publish & Open Student Voting</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT QUESTION MODAL */}
      {rejectingPoll && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setRejectingPoll(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-white border border-[#E4E2DA] rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-4"
          >
            <h3 className="font-serif-editorial text-2xl text-[#171717]">
              Reject Question & Send Feedback to BR
            </h3>
            <p className="text-xs text-[#57564F]">
              Provide a clear reason why <strong>“{rejectingPoll.title}”</strong> cannot be published.
            </p>
            <textarea
              rows={3}
              required
              placeholder="Explain why this question was rejected or what revisions are required..."
              value={rejectionReasonInput}
              onChange={e => setRejectionReasonInput(e.target.value)}
              className="input-field py-2.5 text-xs"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectingPoll(null)}
                className="btn-secondary py-2 px-4 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  handleQuickStatusChange(rejectingPoll.id, 'Rejected', {
                    rejectionReason: rejectionReasonInput
                  })
                }
                className="px-4 py-2 rounded-xl bg-[#8B1E1E] text-white text-xs font-semibold cursor-pointer"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE BATCH MODAL */}
      {showCreateBatchModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setShowCreateBatchModal(false)}
        >
          <form
            onClick={e => e.stopPropagation()}
            onSubmit={handleCreateBatch}
            className="bg-white border border-[#E4E2DA] rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-4"
          >
            <h3 className="font-serif-editorial text-2xl text-[#171717]">
              Create New University Batch
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#171717] mb-1">
                  Batch Code *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., 2K26-BESE"
                  value={newBatchCode}
                  onChange={e => setNewBatchCode(e.target.value)}
                  className="input-field h-10 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#171717] mb-1">
                  Department Code *
                </label>
                <input
                  type="text"
                  required
                  placeholder="BESE"
                  value={newBatchDept}
                  onChange={e => setNewBatchDept(e.target.value)}
                  className="input-field h-10 text-xs"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-1">
                Full Batch Name *
              </label>
              <input
                type="text"
                required
                placeholder="BE Software Engineering — Batch 2K26"
                value={newBatchName}
                onChange={e => setNewBatchName(e.target.value)}
                className="input-field h-10 text-xs"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#171717] mb-1">Year</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={newBatchYear}
                  onChange={e => setNewBatchYear(Number(e.target.value))}
                  className="input-field h-10 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#171717] mb-1">Semester</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={newBatchSemester}
                  onChange={e => setNewBatchSemester(Number(e.target.value))}
                  className="input-field h-10 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#171717] mb-1">Students</label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={newBatchStudents}
                  onChange={e => setNewBatchStudents(Number(e.target.value))}
                  className="input-field h-10 text-xs"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => setShowCreateBatchModal(false)}
                className="btn-secondary py-2 px-4 text-xs"
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary py-2 px-5 text-xs font-semibold">
                Create Batch
              </button>
            </div>
          </form>
        </div>
      )}

      {/* RESET BR PASSWORD MODAL */}
      {resettingBr && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setResettingBr(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-white border border-[#E4E2DA] rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4"
          >
            <h3 className="font-serif-editorial text-xl text-[#171717]">
              Reset Password for {resettingBr.name}
            </h3>
            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-1">
                New Password
              </label>
              <input
                type="text"
                value={resetPasswordInput}
                onChange={e => setResetPasswordInput(e.target.value)}
                className="input-field h-10 text-xs font-mono-tabular"
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setResettingBr(null)}
                className="btn-secondary py-2 px-4 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  handleBrAccountAction(resettingBr.id, 'reset_password', resetPasswordInput)
                }
                className="btn-primary py-2 px-4 text-xs font-semibold"
              >
                Save New Password
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
