export type VotingRole = 'Registrar' | 'Admin' | 'BR' | 'Student' | 'Faculty';
export type BrGenderRole = 'male' | 'female';
export type PollStatus = 'Pending' | 'Approved' | 'Rejected' | 'Published' | 'Closed';
export type ResultVisibility = 'always' | 'after_vote' | 'after_close';

export interface AuthenticatedVotingUser {
  id?: string;
  name: string;
  email: string;
  role: string;
  systemRole?: 'admin' | 'br' | 'student' | 'faculty';
  institution?: string;
  institutionId?: string;
  batchId?: string | null;
  batchCode?: string | null;
  batchName?: string | null;
  brGenderRole?: BrGenderRole | null;
  registrationNumber?: string | null;
  section?: string | null;
  isActive?: boolean;
  token?: string;
}

export interface PublicBatchOption {
  id: string;
  code: string;
  name: string;
  departmentCode: string;
  year: number;
  semester: number;
}

export interface PollOptionDTO {
  id: string;
  label: string;
  sortOrder: number;
  votes: number | null;
  percentage: number | null;
}

export interface BatchParticipationDTO {
  batchId: string;
  batchCode: string;
  batchName: string;
  studentCount: number;
  votesCast: number;
  participationRate: number;
}

export interface PollDTO {
  id: string;
  title: string;
  description: string;
  batchId: string;
  batchCode: string;
  batchName: string;
  departmentCode: string;
  targetScope: 'all_batches' | 'submitting_batch';
  submittedByUserId: string;
  submittedByName: string;
  brGenderRole: BrGenderRole;
  status: PollStatus;
  rejectionReason: string | null;
  resultVisibility: ResultVisibility;
  startAt: string | null;
  endAt: string | null;
  publishedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  isUpcoming: boolean;
  isExpired: boolean;
  isActiveVotingWindow: boolean;
  hasVoted: boolean;
  myVotedOptionId: string | null;
  myVotedAt: string | null;
  canViewResults: boolean;
  totalVotes: number;
  options: PollOptionDTO[];
  batchBreakdown: BatchParticipationDTO[];
}

export interface BatchRepresentativeAssignmentDTO {
  assignmentId: string;
  userId: string;
  name: string;
  email: string;
  isActive: boolean;
  credentialHint?: string | null;
  assignedAt: string;
}

export interface BatchDTO {
  id: string;
  code: string;
  name: string;
  departmentCode: string;
  year: number;
  semester: number;
  studentCount: number;
  totalVotesCast?: number;
  uniqueVoters?: number;
  questionsSubmitted?: number;
  maleBrQuestions?: number;
  femaleBrQuestions?: number;
  maleRepresentative: BatchRepresentativeAssignmentDTO | null;
  femaleRepresentative: BatchRepresentativeAssignmentDTO | null;
}

export interface BrAccountDTO {
  id: string;
  name: string;
  email: string;
  gender: BrGenderRole | null;
  batchId: string | null;
  batchCode: string | null;
  batchName: string | null;
  isActive: boolean;
  hasActiveAssignment: boolean;
  credentialHint: string | null;
  questionsSubmittedCount: number;
  createdAt: string;
}

export interface VotingOverviewResponse {
  user: AuthenticatedVotingUser;
  polls: PollDTO[];
  batches: BatchDTO[];
  brAccounts: BrAccountDTO[];
}

let activeSessionEpoch = 0;
let isSessionSignedOut = false;

export function getActiveSessionEpoch(): number {
  return activeSessionEpoch;
}

export function isCurrentlySignedOut(): boolean {
  return isSessionSignedOut;
}

export function getStoredUser(): AuthenticatedVotingUser | null {
  if (isSessionSignedOut) return null;
  try {
    const raw = sessionStorage.getItem('smartgrid_user');
    return raw ? (JSON.parse(raw) as AuthenticatedVotingUser) : null;
  } catch {
    return null;
  }
}

function saveStoredUser(user: AuthenticatedVotingUser, expectedEpoch?: number): void {
  if (isSessionSignedOut) return;
  if (expectedEpoch !== undefined && expectedEpoch !== activeSessionEpoch) return;
  try {
    sessionStorage.setItem('smartgrid_user', JSON.stringify(user));
  } catch {
    // Ignore storage errors
  }
}

export function clearStoredUser(): void {
  activeSessionEpoch += 1;
  isSessionSignedOut = true;
  try {
    sessionStorage.removeItem('smartgrid_user');
  } catch {
    // Ignore storage errors
  }
}

export function markSessionActive(user: AuthenticatedVotingUser): void {
  activeSessionEpoch += 1;
  isSessionSignedOut = false;
  try {
    sessionStorage.setItem('smartgrid_user', JSON.stringify(user));
  } catch {
    // Ignore storage errors
  }
}

export interface RegisteredInstitutionDTO {
  id: string;
  name: string;
  code: string;
  campusName?: string;
  accreditation?: string;
  academicYear?: string;
  currentTerm?: string;
  workingDays?: string[];
  dayStartTime?: string;
  dayEndTime?: string;
  periodLengthMinutes?: number;
  shortBreakMinutes?: number;
  middayBreakEnabled?: boolean;
  middayBreakStart?: string;
  middayBreakDuration?: number;
  labDurationMinutes?: number;
  isDemoTemplate?: boolean;
  isSample?: boolean;
  studentCount?: number;
}

function normalizeInstitutionRow(raw: Record<string, unknown>): RegisteredInstitutionDTO {
  const wdRaw = raw.workingDays ?? raw.working_days;
  const workingDays = Array.isArray(wdRaw)
    ? wdRaw.map(String)
    : typeof wdRaw === 'string'
    ? wdRaw.split(',').map(s => s.trim()).filter(Boolean)
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const isSample = Boolean(raw.isSample ?? raw.is_sample ?? raw.isDemoTemplate);
  return {
    id: String(raw.id || ''),
    name: String(raw.name || ''),
    code: String(raw.code || ''),
    campusName: String(raw.campusName ?? raw.campus_name ?? 'Main Campus'),
    accreditation: raw.accreditation ? String(raw.accreditation) : undefined,
    academicYear: raw.academicYear ? String(raw.academicYear) : raw.academic_year ? String(raw.academic_year) : undefined,
    currentTerm: raw.currentTerm ? String(raw.currentTerm) : raw.current_term ? String(raw.current_term) : undefined,
    workingDays,
    dayStartTime: String(raw.dayStartTime ?? raw.day_start_time ?? '09:00'),
    dayEndTime: String(raw.dayEndTime ?? raw.day_end_time ?? '17:00'),
    periodLengthMinutes: Number(raw.periodLengthMinutes ?? raw.period_length_minutes ?? 50),
    shortBreakMinutes: Number(raw.shortBreakMinutes ?? raw.short_break_minutes ?? 10),
    middayBreakEnabled: Boolean(raw.middayBreakEnabled ?? raw.midday_break_enabled ?? true),
    middayBreakStart: String(raw.middayBreakStart ?? raw.midday_break_start ?? '13:00'),
    middayBreakDuration: Number(raw.middayBreakDuration ?? raw.midday_break_duration ?? 60),
    labDurationMinutes: Number(raw.labDurationMinutes ?? raw.lab_duration_minutes ?? 180),
    isDemoTemplate: isSample,
    isSample,
    studentCount: raw.studentCount !== undefined ? Number(raw.studentCount) : undefined
  };
}

export async function fetchInstitutionsApi(): Promise<RegisteredInstitutionDTO[]> {
  try {
    const res = await fetch('/api/institutions');
    const data = await res.json().catch(() => ({ institutions: [] }));
    const list = Array.isArray(data.institutions) ? data.institutions : [];
    return list.map((row: Record<string, unknown>) => normalizeInstitutionRow(row));
  } catch {
    return [];
  }
}

export async function fetchPublicBatches(institutionId?: string): Promise<PublicBatchOption[]> {
  const query = institutionId ? `?institutionId=${encodeURIComponent(institutionId)}` : '';
  const res = await fetch(`/api/auth/batches-public${query}`);
  const data = await res.json().catch(() => ({ batches: [] }));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to load batches.');
  }
  return (data.batches || []) as PublicBatchOption[];
}

export async function registerStudentAccount(payload: {
  name: string;
  email: string;
  registrationNumber: string;
  batchId: string;
  customBatchCode?: string;
  section: string;
  password: string;
  confirmPassword: string;
  institutionId?: string;
}): Promise<AuthenticatedVotingUser> {
  const res = await fetch('/api/auth/register-student', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Student registration failed.');
  }
  markSessionActive(data.user);
  return data.user as AuthenticatedVotingUser;
}

export async function activateFacultyAccount(payload: {
  name: string;
  email: string;
  department: string;
  institutionId: string;
  password: string;
  confirmPassword: string;
}): Promise<AuthenticatedVotingUser> {
  const res = await fetch('/api/auth/activate-faculty', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Faculty account activation failed.');
  }
  markSessionActive(data.user);
  return data.user as AuthenticatedVotingUser;
}

export async function registerUniversityAccount(payload: {
  name: string;
  code: string;
  campusName: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  workingDays?: string;
  dayStartTime?: string;
  dayEndTime?: string;
  periodLengthMinutes?: number;
  shortBreakMinutes?: number;
  middayBreakEnabled?: boolean;
  middayBreakStart?: string;
  middayBreakDuration?: number;
  labDurationMinutes?: number;
}): Promise<{
  institutionId: string;
  institutionName: string;
  institutionCode: string;
  user: AuthenticatedVotingUser;
}> {
  const res = await fetch('/api/institutions/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to register university.');
  }
  markSessionActive(data.user);
  return {
    institutionId: data.institutionId,
    institutionName: data.institutionName || payload.name,
    institutionCode: data.institutionCode || payload.code.toUpperCase(),
    user: data.user as AuthenticatedVotingUser
  };
}

export async function loginWithBackend(
  email: string,
  password?: string,
  expectedPortalRole?: 'student' | 'br' | 'admin' | 'faculty'
): Promise<AuthenticatedVotingUser> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, expectedPortalRole })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Authentication failed.');
  }
  markSessionActive(data.user);
  return data.user as AuthenticatedVotingUser;
}

export async function verifyBackendSession(
  token: string
): Promise<AuthenticatedVotingUser | null> {
  const epochAtStart = activeSessionEpoch;
  if (isSessionSignedOut) return null;
  try {
    const res = await fetch('/api/auth/me', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    if (isSessionSignedOut || epochAtStart !== activeSessionEpoch) {
      return null;
    }
    if (!res.ok) return null;
    const data = await res.json();
    if (isSessionSignedOut || epochAtStart !== activeSessionEpoch) {
      return null;
    }
    if (data?.user) {
      saveStoredUser(data.user, epochAtStart);
      return data.user as AuthenticatedVotingUser;
    }
    return null;
  } catch {
    return null;
  }
}

export async function ensureBackendToken(
  currentUser: AuthenticatedVotingUser
): Promise<string> {
  if (isSessionSignedOut) {
    throw new Error('Session signed out.');
  }
  if (currentUser.token) {
    return currentUser.token;
  }
  const stored = getStoredUser();
  if (stored?.token && stored.email.toLowerCase() === currentUser.email.toLowerCase()) {
    return stored.token;
  }
  throw new Error('Authentication token missing. Please sign in again.');
}

async function authorizedFetch<T>(
  url: string,
  currentUser: AuthenticatedVotingUser,
  init?: RequestInit
): Promise<T> {
  const epochAtStart = activeSessionEpoch;
  if (isSessionSignedOut) {
    throw new Error('Session signed out.');
  }
  const token = await ensureBackendToken(currentUser);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...((init?.headers as Record<string, string>) || {})
  };
  const res = await fetch(url, {
    ...init,
    headers
  });
  const data = await res.json().catch(() => ({}));
  if (isSessionSignedOut || epochAtStart !== activeSessionEpoch) {
    throw new Error('Session changed or signed out.');
  }
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export async function updateOwnProfile(
  currentUser: AuthenticatedVotingUser,
  payload: { name: string; section?: string; newPassword?: string }
): Promise<{ message: string; user: AuthenticatedVotingUser }> {
  const epochAtStart = activeSessionEpoch;
  const res = await authorizedFetch<{ message: string; user: AuthenticatedVotingUser }>(
    '/api/auth/profile',
    currentUser,
    {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }
  );
  if (res.user && !isSessionSignedOut && epochAtStart === activeSessionEpoch) {
    saveStoredUser(res.user, epochAtStart);
  }
  return res;
}

export async function fetchVotingOverview(
  currentUser: AuthenticatedVotingUser
): Promise<VotingOverviewResponse> {
  return authorizedFetch<VotingOverviewResponse>('/api/voting/overview', currentUser);
}

export async function castStudentVote(
  currentUser: AuthenticatedVotingUser,
  pollId: string,
  optionId: string
): Promise<{ message: string; poll: PollDTO }> {
  return authorizedFetch<{ message: string; poll: PollDTO }>(
    `/api/voting/polls/${encodeURIComponent(pollId)}/vote`,
    currentUser,
    {
      method: 'POST',
      body: JSON.stringify({ optionId })
    }
  );
}

export async function submitBrQuestion(
  currentUser: AuthenticatedVotingUser,
  payload: {
    title: string;
    description: string;
    options: string[];
    endAt?: string | null;
    targetScope?: 'all_batches' | 'submitting_batch';
  }
): Promise<{ message: string; poll: PollDTO }> {
  return authorizedFetch<{ message: string; poll: PollDTO }>(
    '/api/voting/br/polls',
    currentUser,
    {
      method: 'POST',
      body: JSON.stringify(payload)
    }
  );
}

export async function createBatchAdmin(
  currentUser: AuthenticatedVotingUser,
  payload: {
    code: string;
    name: string;
    departmentCode: string;
    year: number;
    semester: number;
    studentCount: number;
  }
): Promise<{ message: string; batchId: string }> {
  return authorizedFetch<{ message: string; batchId: string }>(
    '/api/voting/admin/batches',
    currentUser,
    {
      method: 'POST',
      body: JSON.stringify(payload)
    }
  );
}

export async function createBrAccountAdmin(
  currentUser: AuthenticatedVotingUser,
  payload: {
    name: string;
    email: string;
    password: string;
    batchId: string;
    genderRole: BrGenderRole;
    replaceExisting?: boolean;
  }
): Promise<{
  message: string;
  issuedCredentials: {
    userId: string;
    name: string;
    email: string;
    password: string;
    batchCode: string;
    batchName: string;
    genderRole: BrGenderRole;
  };
}> {
  return authorizedFetch('/api/voting/admin/br-accounts', currentUser, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function updateBrAccountAdmin(
  currentUser: AuthenticatedVotingUser,
  userId: string,
  payload: {
    action: 'activate' | 'deactivate' | 'reset_password' | 'assign_slot';
    newPassword?: string;
    batchId?: string;
    genderRole?: BrGenderRole;
  }
): Promise<{
  message: string;
  issuedCredentials?: { name: string; email: string; password: string };
}> {
  return authorizedFetch(
    `/api/voting/admin/br-accounts/${encodeURIComponent(userId)}`,
    currentUser,
    {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }
  );
}

export async function updatePollStatusAdmin(
  currentUser: AuthenticatedVotingUser,
  pollId: string,
  payload: {
    status?: PollStatus;
    rejectionReason?: string;
    resultVisibility?: ResultVisibility;
    startAt?: string | null;
    endAt?: string | null;
    targetScope?: 'all_batches' | 'submitting_batch';
  }
): Promise<{ message: string; poll: PollDTO }> {
  return authorizedFetch(
    `/api/voting/admin/polls/${encodeURIComponent(pollId)}/status`,
    currentUser,
    {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }
  );
}

export async function deletePollAdmin(
  currentUser: AuthenticatedVotingUser,
  pollId: string
): Promise<{ message: string }> {
  return authorizedFetch(
    `/api/voting/admin/polls/${encodeURIComponent(pollId)}`,
    currentUser,
    {
      method: 'DELETE'
    }
  );
}

// =========================================================
// PYTHON FASTAPI HYBRID AI OPTIMIZATION & RESCHEDULING CLIENT
// =========================================================

export async function runHybridOptimizationBackend(
  currentUser: AuthenticatedVotingUser,
  payload?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  return authorizedFetch<Record<string, unknown>>(
    '/api/optimization/run',
    currentUser,
    {
      method: 'POST',
      body: JSON.stringify(payload || {})
    }
  );
}

export async function compareOptimizationAlgorithmsBackend(
  currentUser: AuthenticatedVotingUser,
  payload?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  return authorizedFetch<Record<string, unknown>>(
    '/api/optimization/compare',
    currentUser,
    {
      method: 'POST',
      body: JSON.stringify(payload || {})
    }
  );
}

export async function reportDisruptionAndRescheduleBackend(
  currentUser: AuthenticatedVotingUser,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  return authorizedFetch<Record<string, unknown>>(
    '/api/rescheduling/disruptions',
    currentUser,
    {
      method: 'POST',
      body: JSON.stringify(payload)
    }
  );
}

export async function approveReschedulingProposalBackend(
  currentUser: AuthenticatedVotingUser,
  proposalId: string
): Promise<Record<string, unknown>> {
  return authorizedFetch<Record<string, unknown>>(
    `/api/rescheduling/proposals/${encodeURIComponent(proposalId)}/approve`,
    currentUser,
    {
      method: 'POST'
    }
  );
}

export async function saveStudentPreferenceBackend(
  currentUser: AuthenticatedVotingUser,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  return authorizedFetch<Record<string, unknown>>(
    '/api/preferences/student',
    currentUser,
    {
      method: 'POST',
      body: JSON.stringify(payload)
    }
  );
}

export async function saveInstructorPreferenceBackend(
  currentUser: AuthenticatedVotingUser,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  return authorizedFetch<Record<string, unknown>>(
    '/api/preferences/instructor',
    currentUser,
    {
      method: 'POST',
      body: JSON.stringify(payload)
    }
  );
}

export interface UniversityDetectionResult {
  status: 'idle' | 'detecting' | 'detected' | 'unrecognized' | 'unsupported';
  domain?: string;
  institutionId?: string;
  institutionName?: string;
  institutionCode?: string;
  campusName?: string;
  message?: string;
}

export async function detectUniversityByEmailApi(
  email: string
): Promise<UniversityDetectionResult> {
  const res = await fetch(
    `/api/auth/detect-university?email=${encodeURIComponent(email.trim())}`
  );
  const data = await res.json().catch(() => ({ status: 'idle' }));
  return data as UniversityDetectionResult;
}

export async function requestPasswordRecoveryApi(payload: {
  email: string;
  role: string;
}): Promise<{
  status: string;
  accountFound: boolean;
  role: string;
  institutionName?: string;
  message: string;
}> {
  const res = await fetch('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Unable to process password recovery request.');
  }
  return data;
}

export interface BackendFitnessBreakdown {
  totalScore: number;
  studentSatisfaction: number;
  instructorSatisfaction: number;
  roomUtilization: number;
  compactnessScore: number;
  workloadBalanceScore: number;
  fairnessScore: number;
  studentGapMinutesAvg?: number;
  batchSatisfactionByBatch?: Record<string, number>;
}

export interface BackendOptimizationAssignment {
  roomId: string;
  day: string;
  startTime: string;
  secondDay?: string;
  secondStartTime?: string;
  thirdDay?: string;
  thirdStartTime?: string;
}

export interface BackendOptimizationRunResult {
  runId: string;
  timetableVersionId: string;
  algorithm: string;
  feasible: boolean;
  hardConstraintViolations: number;
  totalSessions: number;
  placedSessions: number;
  placedCount: number;
  unplacedCount: number;
  executionTimeMs: number;
  fitness: BackendFitnessBreakdown;
  fitnessHistory: number[];
  validationReport?: Record<string, unknown>;
  assignments: Record<string, BackendOptimizationAssignment>;
}

export interface BackendAlgorithmBenchmarkItem {
  algorithm: string;
  label?: string;
  feasible: boolean;
  hardConstraintViolations: number;
  executionTimeMs: number;
  placedSessions?: number;
  totalSessions?: number;
  fitness: BackendFitnessBreakdown;
}

export interface BackendOptimizationCompareResponse {
  comparison: BackendAlgorithmBenchmarkItem[];
  recommendedAlgorithm?: string;
  summary?: Record<string, unknown>;
}

export interface BackendOptimizationRunHistoryDTO {
  id: string;
  institution_id: string;
  timetable_version_id: string | null;
  algorithm: string;
  algorithm_pipeline: string;
  status: string;
  total_sessions: number;
  placed_sessions: number;
  hard_constraint_violations: number;
  execution_time_ms: number;
  convergence_history: number[];
  summary_metrics: Partial<BackendFitnessBreakdown>;
  dsatur_initial_fitness?: number;
  ga_best_fitness?: number;
  sa_final_fitness?: number;
  assignments_snapshot?: Record<string, BackendOptimizationAssignment>;
  created_at: string;
}

export interface BackendTimetableVersionDTO {
  id: string;
  institution_id: string;
  name: string;
  version_name: string;
  version_number: string;
  status: 'draft' | 'published' | 'archived';
  algorithm_used: string;
  hard_violations_count: number;
  hard_conflicts_count: number;
  overall_fitness_score: number;
  fitness_score: number;
  student_satisfaction_score: number;
  instructor_satisfaction_score: number;
  room_utilization_score: number;
  fairness_score: number;
  published_at: string | null;
  created_at: string;
  entries: Record<string, BackendOptimizationAssignment> | Array<Record<string, unknown>>;
  timetableEntries?: Array<Record<string, unknown>>;
  metrics: {
    totalScore: number;
    studentSatisfaction: number;
    instructorSatisfaction: number;
    roomUtilization: number;
    fairnessScore: number;
  };
}

export interface BackendReschedulingProposalDTO {
  id: string;
  institution_id: string;
  disruption_id: string;
  base_timetable_version_id: string | null;
  status: 'pending_approval' | 'approved' | 'rejected' | string;
  algorithm_used: string;
  disruption_type?: string;
  disruption_title?: string;
  disruption_description?: string;
  affected_sessions_count: number;
  changed_sessions_count: number;
  unchanged_sessions_count: number;
  stability_percentage: number;
  stability_score: number;
  remaining_hard_violations: number;
  original_quality_score: number;
  proposed_quality_score: number;
  new_fitness_score: number;
  repair_execution_time_ms: number;
  changes: Array<{
    sectionId: string;
    courseCode?: string;
    courseTitle?: string;
    oldDay?: string;
    oldStartTime?: string;
    oldRoomId?: string;
    newDay?: string;
    newStartTime?: string;
    newRoomId?: string;
    reason?: string;
  }>;
  proposed_assignments?: Record<string, BackendOptimizationAssignment>;
  updatedEntries?: Record<string, BackendOptimizationAssignment>;
  created_at: string;
  updated_at: string;
}

export interface BackendNotificationDTO {
  id: string;
  institution_id: string;
  recipient_user_id: string | null;
  recipient_role: string | null;
  title: string;
  message: string;
  notification_type: string;
  is_read: boolean;
  created_at: string;
}

export interface BackendAnalyticsOverviewDTO {
  universityId: string;
  catalogSummary: {
    batches: number;
    courses: number;
    classrooms: number;
    instructors: number;
    studentVotesCast: number;
  };
  latestOptimizationRun: {
    id: string | null;
    algorithmPipeline: string;
    dsaturInitialFitness: number | null;
    gaBestFitness: number | null;
    saFinalFitness: number | null;
    hardConstraintViolations: number;
    executionTimeMs: number;
    metrics: Partial<BackendFitnessBreakdown>;
  };
}

export interface BackendStudentPreferenceDTO {
  id?: string;
  institution_id?: string;
  user_id?: string;
  batch_id?: string | null;
  preferred_time_window: 'morning' | 'midday' | 'afternoon' | 'balanced';
  avoid_early_8am: boolean;
  avoid_late_after_4pm: boolean;
  max_acceptable_gap_minutes: number;
  max_daily_lectures: number;
  preferred_free_day: string | null;
  updated_at?: string;
}

export interface BackendInstructorPreferenceDTO {
  id?: string;
  institution_id?: string;
  instructor_id: string;
  preferred_days: string[];
  preferred_start_time: string;
  preferred_end_time: string;
  avoid_back_to_back_more_than: number;
  max_consecutive_hours?: number;
  prefer_compact_schedule: boolean;
  notes?: string;
  updated_at?: string;
}

export interface BackendStudentDirectoryDTO {
  id: string;
  name: string;
  email: string;
  role: string;
  batch_id: string | null;
  registration_number: string | null;
  section: string | null;
  is_active: boolean;
  created_at: string;
}

export async function fetchDatabaseStatusApi(): Promise<{
  status: string;
  provider?: string;
  error?: string;
}> {
  try {
    const res = await fetch('/api/database/status');
    return (await res.json().catch(() => ({ status: 'unavailable' }))) as {
      status: string;
      provider?: string;
      error?: string;
    };
  } catch {
    return { status: 'unavailable' };
  }
}

export async function fetchInstitutionDataApi(
  institutionId: string
): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`/api/institutions/${encodeURIComponent(institutionId)}/data`);
    if (!res.ok) return null;
    const json = await res.json().catch(() => ({ data: null }));
    return json && typeof json.data === 'object' && json.data !== null
      ? (json.data as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export async function saveInstitutionDataApi(
  currentUser: AuthenticatedVotingUser,
  institutionId: string,
  data: unknown
): Promise<{ success: boolean; message?: string }> {
  return authorizedFetch<{ success: boolean; message?: string }>(
    `/api/institutions/${encodeURIComponent(institutionId)}/data`,
    currentUser,
    {
      method: 'POST',
      body: JSON.stringify({ data })
    }
  );
}

export async function updateUniversitySettingsBackend(
  currentUser: AuthenticatedVotingUser,
  universityId: string,
  settings: {
    workingDays?: string[] | string;
    dayStartTime?: string;
    dayEndTime?: string;
    periodLengthMinutes?: number;
    shortBreakMinutes?: number;
    middayBreakEnabled?: boolean;
    middayBreakStart?: string;
    middayBreakDuration?: number;
    labDurationMinutes?: number;
  }
): Promise<{ message: string; university: Record<string, unknown> }> {
  return authorizedFetch<{ message: string; university: Record<string, unknown> }>(
    `/api/universities/${encodeURIComponent(universityId)}/settings`,
    currentUser,
    {
      method: 'PATCH',
      body: JSON.stringify(settings)
    }
  );
}

export async function fetchDepartmentsBackend(
  currentUser: AuthenticatedVotingUser,
  universityId?: string
): Promise<Array<Record<string, unknown>>> {
  const q = universityId ? `?universityId=${encodeURIComponent(universityId)}` : '';
  const res = await authorizedFetch<{ departments: Array<Record<string, unknown>> }>(
    `/api/departments${q}`,
    currentUser
  );
  return res.departments || [];
}

export async function createDepartmentBackend(
  currentUser: AuthenticatedVotingUser,
  payload: {
    universityId?: string;
    code: string;
    name: string;
    facultyGroup?: string;
    headOfDepartment?: string;
  }
): Promise<{ message: string; department: Record<string, unknown> | null }> {
  return authorizedFetch('/api/departments', currentUser, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function fetchCoursesBackend(
  currentUser: AuthenticatedVotingUser,
  universityId?: string
): Promise<Array<Record<string, unknown>>> {
  const q = universityId ? `?universityId=${encodeURIComponent(universityId)}` : '';
  const res = await authorizedFetch<{ courses: Array<Record<string, unknown>> }>(
    `/api/courses${q}`,
    currentUser
  );
  return res.courses || [];
}

export async function createCourseBackend(
  currentUser: AuthenticatedVotingUser,
  payload: {
    id?: string;
    universityId?: string;
    code: string;
    title: string;
    departmentCode?: string;
    batchId?: string;
    instructorId?: string;
    type?: string;
    creditHours?: number;
    hoursPerWeek?: number;
    studentCount?: number;
    requiredRoomType?: string;
    requiredEquipment?: string[];
    sectionCode?: string;
  }
): Promise<{ message: string; course: Record<string, unknown> | null }> {
  return authorizedFetch('/api/courses', currentUser, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function fetchInstructorsBackend(
  currentUser: AuthenticatedVotingUser,
  universityId?: string
): Promise<Array<Record<string, unknown>>> {
  const q = universityId ? `?universityId=${encodeURIComponent(universityId)}` : '';
  const res = await authorizedFetch<{ instructors: Array<Record<string, unknown>> }>(
    `/api/instructors${q}`,
    currentUser
  );
  return res.instructors || [];
}

export async function createInstructorBackend(
  currentUser: AuthenticatedVotingUser,
  payload: {
    id?: string;
    universityId?: string;
    name: string;
    email?: string;
    departmentCode?: string;
    designation?: string;
    specialization?: string;
    maxWeeklyHours?: number;
    maxDailyClasses?: number;
  }
): Promise<{ message: string; instructor: Record<string, unknown> | null }> {
  return authorizedFetch('/api/instructors', currentUser, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function fetchClassroomsBackend(
  currentUser: AuthenticatedVotingUser,
  universityId?: string
): Promise<Array<Record<string, unknown>>> {
  const q = universityId ? `?universityId=${encodeURIComponent(universityId)}` : '';
  const res = await authorizedFetch<{ classrooms: Array<Record<string, unknown>> }>(
    `/api/classrooms${q}`,
    currentUser
  );
  return res.classrooms || [];
}

export async function createClassroomBackend(
  currentUser: AuthenticatedVotingUser,
  payload: {
    id?: string;
    universityId?: string;
    code?: string;
    name: string;
    building?: string;
    floor?: number;
    capacity?: number;
    type?: string;
    equipment?: string[];
    isAvailable?: boolean;
  }
): Promise<{ message: string; classroom: Record<string, unknown> | null }> {
  return authorizedFetch('/api/classrooms', currentUser, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function fetchStudentsBackend(
  currentUser: AuthenticatedVotingUser,
  universityId?: string,
  batchId?: string
): Promise<BackendStudentDirectoryDTO[]> {
  const params = new URLSearchParams();
  if (universityId) params.set('universityId', universityId);
  if (batchId) params.set('batchId', batchId);
  const qs = params.toString() ? `?${params.toString()}` : '';
  const res = await authorizedFetch<{ students: BackendStudentDirectoryDTO[] }>(
    `/api/students${qs}`,
    currentUser
  );
  return res.students || [];
}

export async function fetchStudentPreferencesBackend(
  currentUser: AuthenticatedVotingUser
): Promise<BackendStudentPreferenceDTO[]> {
  const res = await authorizedFetch<{ preferences: BackendStudentPreferenceDTO[] }>(
    '/api/preferences/student',
    currentUser
  );
  return res.preferences || [];
}

export async function fetchInstructorPreferencesBackend(
  currentUser: AuthenticatedVotingUser
): Promise<BackendInstructorPreferenceDTO[]> {
  const res = await authorizedFetch<{ preferences: BackendInstructorPreferenceDTO[] }>(
    '/api/preferences/instructor',
    currentUser
  );
  return res.preferences || [];
}

export async function fetchOptimizationRunsBackend(
  currentUser: AuthenticatedVotingUser,
  universityId?: string
): Promise<{
  runs: BackendOptimizationRunHistoryDTO[];
  scores: Array<Record<string, unknown>>;
}> {
  const q = universityId ? `?universityId=${encodeURIComponent(universityId)}` : '';
  return authorizedFetch(`/api/optimization/runs${q}`, currentUser);
}

export async function fetchTimetablesBackend(
  currentUser: AuthenticatedVotingUser,
  universityId?: string
): Promise<BackendTimetableVersionDTO[]> {
  const q = universityId ? `?universityId=${encodeURIComponent(universityId)}` : '';
  const res = await authorizedFetch<{ timetables: BackendTimetableVersionDTO[] }>(
    `/api/timetables${q}`,
    currentUser
  );
  return res.timetables || [];
}

export async function publishTimetableBackend(
  currentUser: AuthenticatedVotingUser,
  versionId: string
): Promise<{ message: string }> {
  return authorizedFetch<{ message: string }>(
    `/api/timetables/${encodeURIComponent(versionId)}/publish`,
    currentUser,
    { method: 'POST' }
  );
}

export async function fetchReschedulingProposalsBackend(
  currentUser: AuthenticatedVotingUser,
  universityId?: string
): Promise<BackendReschedulingProposalDTO[]> {
  const q = universityId ? `?universityId=${encodeURIComponent(universityId)}` : '';
  const res = await authorizedFetch<{ proposals: BackendReschedulingProposalDTO[] }>(
    `/api/rescheduling/proposals${q}`,
    currentUser
  );
  return res.proposals || [];
}

export async function rejectReschedulingProposalBackend(
  currentUser: AuthenticatedVotingUser,
  proposalId: string
): Promise<{ message: string; proposalId: string }> {
  return authorizedFetch<{ message: string; proposalId: string }>(
    `/api/rescheduling/proposals/${encodeURIComponent(proposalId)}/reject`,
    currentUser,
    { method: 'POST' }
  );
}

export async function fetchAnalyticsOverviewBackend(
  currentUser: AuthenticatedVotingUser,
  universityId?: string
): Promise<BackendAnalyticsOverviewDTO> {
  const q = universityId ? `?universityId=${encodeURIComponent(universityId)}` : '';
  return authorizedFetch<BackendAnalyticsOverviewDTO>(
    `/api/analytics/overview${q}`,
    currentUser
  );
}

export async function fetchNotificationsBackend(
  currentUser: AuthenticatedVotingUser
): Promise<BackendNotificationDTO[]> {
  const res = await authorizedFetch<{ notifications: BackendNotificationDTO[] }>(
    '/api/notifications',
    currentUser
  );
  return res.notifications || [];
}

export async function markNotificationReadBackend(
  currentUser: AuthenticatedVotingUser,
  notificationId: string
): Promise<{ message: string }> {
  return authorizedFetch<{ message: string }>(
    `/api/notifications/${encodeURIComponent(notificationId)}/read`,
    currentUser,
    { method: 'PATCH' }
  );
}

export interface SolveOptimizationApiResponse {
  status: string;
  runId?: string;
  timetableVersionId?: string;
  metrics: {
    placedCount: number;
    unplacedCount: number;
    conflictCount: number;
    roomUtilization: number;
    solverEngine: string;
    totalScore?: number;
    studentSatisfaction?: number;
    instructorSatisfaction?: number;
    fairnessScore?: number;
    executionTimeMs?: number;
  };
  fitnessHistory?: number[];
  assignments?: Record<string, BackendOptimizationAssignment>;
}

export async function solveOptimizationApi(
  payload: Record<string, unknown>,
  currentUser?: AuthenticatedVotingUser | null
): Promise<SolveOptimizationApiResponse> {
  const user = currentUser || getStoredUser();
  if (!user?.token) {
    throw new Error('Authentication required for backend optimization.');
  }

  const strategyRaw = String(payload.algorithm || payload.strategy || 'hybrid_dsatur_ga_sa').toLowerCase();
  const algorithm =
    strategyRaw === 'dsatur' || strategyRaw === 'dsatur_only'
      ? 'dsatur_only'
      : strategyRaw === 'genetic' || strategyRaw === 'ga_only'
      ? 'ga_only'
      : strategyRaw === 'ga_sa' || strategyRaw === 'sa'
      ? 'ga_sa'
      : 'hybrid_dsatur_ga_sa';

  const result = await authorizedFetch<BackendOptimizationRunResult>(
    '/api/optimization/run',
    user,
    {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        universityId: payload.universityId || payload.institutionId || user.institutionId,
        algorithm
      })
    }
  );

  return {
    status: result.feasible ? 'feasible' : 'partial',
    runId: result.runId,
    timetableVersionId: result.timetableVersionId,
    metrics: {
      placedCount: result.placedCount ?? Object.keys(result.assignments || {}).length,
      unplacedCount: result.unplacedCount ?? 0,
      conflictCount: result.hardConstraintViolations ?? 0,
      roomUtilization: result.fitness?.roomUtilization ?? 82.0,
      solverEngine: `Python FastAPI (${result.algorithm})`,
      totalScore: result.fitness?.totalScore,
      studentSatisfaction: result.fitness?.studentSatisfaction,
      instructorSatisfaction: result.fitness?.instructorSatisfaction,
      fairnessScore: result.fitness?.fairnessScore,
      executionTimeMs: result.executionTimeMs
    },
    fitnessHistory: result.fitnessHistory,
    assignments: result.assignments
  };
}



