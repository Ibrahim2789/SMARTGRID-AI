import type {
  AssignmentValidationResultDTO,
  AssignmentWorkspaceResponseDTO,
  BulkPreviewResponseDTO,
  CopySectionResponseDTO,
  StaffWorkloadDTO
} from '../types/institutional';

export type VotingRole = 'Registrar' | 'Admin' | 'BR' | 'Student' | 'Faculty';
export type BrGenderRole = 'male' | 'female';
export type PollStatus = 'Pending' | 'Approved' | 'Rejected' | 'Published' | 'Closed';
export type ResultVisibility = 'always' | 'after_vote' | 'after_close';
export type PollCategory =
  | 'preferred_lecture_timing'
  | 'preferred_free_day'
  | 'lab_timing_preferences'
  | 'break_schedule_preference'
  | 'general_suggestion';
export type OptimizerApprovalStatus =
  | 'pending_review'
  | 'approved_for_optimizer'
  | 'rejected_from_optimizer';

export interface AuthenticatedVotingUser {
  id?: string;
  name: string;
  email: string;
  role: string;
  systemRole?: 'admin' | 'university_admin' | 'super_admin' | 'timetable_manager' | 'br' | 'student' | 'faculty';
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
  targetBatchIds?: string[];
  pollCategory?: PollCategory;
  optimizerApprovalStatus?: OptimizerApprovalStatus;
  optimizerRejectionReason?: string | null;
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

export async function fetchInstitutionsApi(token?: string): Promise<RegisteredInstitutionDTO[]> {
  try {
    const authToken = token ?? getStoredUser()?.token;
    const headers: Record<string, string> = {};
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    const res = await fetch('/api/institutions', { headers });
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

export class AssignmentApiError extends Error {
  status: number;
  data: Record<string, unknown>;

  constructor(message: string, status: number, data: Record<string, unknown>) {
    super(message);
    this.name = 'AssignmentApiError';
    this.status = status;
    this.data = data;
  }
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
    const rawDetail =
      data && typeof data === 'object' && 'detail' in data && typeof data.detail === 'object' && data.detail !== null
        ? (data.detail as Record<string, unknown>)
        : (data as Record<string, unknown>);
    const message =
      (typeof rawDetail?.error === 'string' && rawDetail.error) ||
      (typeof data?.error === 'string' && data.error) ||
      (typeof data?.detail === 'string' && data.detail) ||
      `Request failed (${res.status})`;
    throw new AssignmentApiError(message, res.status, rawDetail || {});
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
    pollCategory?: PollCategory;
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

export interface OptimizerVotingConfigDTO {
  useVotingPreferences: boolean;
  votingPreferenceInfluence: number;
  lowParticipationThreshold: number;
}

export async function updatePollOptimizerApprovalAdmin(
  currentUser: AuthenticatedVotingUser,
  pollId: string,
  payload: {
    approvalStatus: OptimizerApprovalStatus;
    rejectionReason?: string;
  }
): Promise<{ message: string; poll: PollDTO }> {
  return authorizedFetch(
    `/api/voting/admin/polls/${encodeURIComponent(pollId)}/optimizer-approval`,
    currentUser,
    {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }
  );
}

export async function fetchOptimizerVotingConfigAdmin(
  currentUser: AuthenticatedVotingUser
): Promise<OptimizerVotingConfigDTO> {
  return authorizedFetch<OptimizerVotingConfigDTO>(
    '/api/voting/admin/optimizer-config',
    currentUser
  );
}

export async function updateOptimizerVotingConfigAdmin(
  currentUser: AuthenticatedVotingUser,
  payload: Partial<OptimizerVotingConfigDTO>
): Promise<{ message: string }> {
  return authorizedFetch<{ message: string }>(
    '/api/voting/admin/optimizer-config',
    currentUser,
    {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }
  );
}

export async function fetchActiveVotingPreferencesAdmin(
  currentUser: AuthenticatedVotingUser
): Promise<{
  useVotingPreferences: boolean;
  votingPreferenceInfluence: number;
  lowParticipationThreshold: number;
  batchPreferences: Record<string, Record<string, unknown>>;
  traceability: Array<Record<string, unknown>>;
}> {
  return authorizedFetch('/api/voting/admin/active-preferences', currentUser);
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
  worstBatchSatisfaction?: number;
  leastSatisfiedBatchScore?: number;
  batchSatisfactionByBatch?: Record<string, number>;
}

export interface BackendOptimizationAssignment {
  roomId: string;
  day: string;
  startTime: string;
  endTime?: string;
  startMinutes?: number;
  endMinutes?: number;
  durationMinutes?: number;
  instructorId?: string;
  labEngineerId?: string;
  secondDay?: string;
  secondStartTime?: string;
  thirdDay?: string;
  thirdStartTime?: string;
}

export interface BackendOptimizationEntry {
  sectionId?: string;
  sessionId?: string;
  courseId?: string;
  courseCode?: string;
  courseTitle?: string;
  batchId?: string;
  batchCode?: string;
  sectionCode?: string;
  instructorId?: string;
  labEngineerId?: string;
  roomId?: string;
  day?: string;
  startTime?: string;
  endTime?: string;
  startMinutes?: number;
  endMinutes?: number;
  durationMinutes?: number;
  sessionType?: string;
  componentType?: string;
  slotSource?: string;
  isSplitLab?: boolean;
  isLocked?: boolean;
}

export interface BackendPreValidationReport {
  valid?: boolean;
  errors?: string[];
  warnings?: string[];
}

export interface BackendOptimizationRunResult {
  runId: string;
  timetableVersionId: string;
  status?: string;
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
  preValidation?: BackendPreValidationReport;
  timeConfig?: Record<string, unknown>;
  entries?: BackendOptimizationEntry[];
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
  assignmentReadiness?: {
    totalOfferings?: number;
    completeCount?: number;
    generationReadyCount?: number;
    missingInstructorCount?: number;
    missingLabEngineerCount?: number;
    missingLaboratoryCount?: number;
    invalidCount?: number;
    partialCount?: number;
    unassignedCount?: number;
    unsyncedOfferingsCount?: number;
  };
  staffWorkloadSummary?: Array<{
    id: string;
    name: string;
    staffRole: 'faculty' | 'lab_engineer';
    departmentCode: string;
    currentWeeklyHours: number;
    maxWeeklyHours: number;
    utilizationPct: number;
    assignedCoursesCount: number;
  }>;
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
    const stored = getStoredUser();
    const headers: Record<string, string> = {};
    if (stored?.token) {
      headers.Authorization = `Bearer ${stored.token}`;
    }
    const res = await fetch(`/api/institutions/${encodeURIComponent(institutionId)}/data`, {
      headers
    });
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

export async function fetchInstitutionWorkspace(
  currentUser: AuthenticatedVotingUser,
  institutionId: string
): Promise<Record<string, unknown>> {
  const res = await authorizedFetch<{ workspace: Record<string, unknown> }>(
    `/api/institutions/${encodeURIComponent(institutionId)}/workspace`,
    currentUser
  );
  if (!res || typeof res.workspace !== 'object' || res.workspace === null) {
    throw new Error('Supabase workspace payload was empty.');
  }
  return res.workspace;
}

export async function resetInstitutionWorkspaceBackend(
  currentUser: AuthenticatedVotingUser,
  institutionId: string
): Promise<{ message: string; workspace: Record<string, unknown> }> {
  return authorizedFetch<{ message: string; workspace: Record<string, unknown> }>(
    `/api/institutions/${encodeURIComponent(institutionId)}/reset`,
    currentUser,
    { method: 'POST' }
  );
}

export async function loadSampleInstitutionCatalogBackend(
  currentUser: AuthenticatedVotingUser,
  institutionId: string
): Promise<{ message: string; workspace: Record<string, unknown> }> {
  return authorizedFetch<{ message: string; workspace: Record<string, unknown> }>(
    `/api/institutions/${encodeURIComponent(institutionId)}/load-sample`,
    currentUser,
    { method: 'POST' }
  );
}

export async function updateUniversitySettingsBackend(
  currentUser: AuthenticatedVotingUser,
  universityId: string,
  settings: {
    universityName?: string;
    campusCode?: string;
    campusName?: string;
    accreditation?: string;
    registrarName?: string;
    registrarEmail?: string;
    autoConflictSweep?: boolean;
    defaultSessionMinutes?: number;
    timetableManagementPolicy?: 'whole_university' | 'department_wise';
    activeTermIds?: string[];
    breaks?: unknown[];
    workingDays?: string[] | string;
    dayStartTime?: string;
    dayEndTime?: string;
    periodLengthMinutes?: number;
    shortBreakEnabled?: boolean;
    shortBreakMinutes?: number;
    includeBreakAfterLastSlot?: boolean;
    middayBreakEnabled?: boolean;
    middayBreakMode?: string;
    middayBreakStart?: string;
    middayBreakStartTime?: string;
    middayBreakDuration?: number;
    middayBreakDurationMinutes?: number;
    labDurationMinutes?: number;
    labSplitAllowed?: boolean;
    fridayEnabled?: boolean;
    fridayMode?: string;
    fridayStartTime?: string;
    fridayEndTime?: string;
    fridayBreakStartTime?: string;
    fridayBreakEndTime?: string;
    fridayClosingTime?: string;
    fridayCompressionScope?: string;
    fridayPeriodLengthMinutes?: number;
    fridayShortBreakMinutes?: number;
    fridayAllowedBatches?: string[];
    fridayAllowedDepartments?: string[];
    fridayAfternoonShiftEnabled?: boolean;
    fridayAfternoonStartTime?: string;
  }
): Promise<{ message: string; university: Record<string, unknown>; timeStructure?: Record<string, unknown> }> {
  return authorizedFetch<{ message: string; university: Record<string, unknown>; timeStructure?: Record<string, unknown> }>(
    `/api/universities/${encodeURIComponent(universityId)}/settings`,
    currentUser,
    {
      method: 'PATCH',
      body: JSON.stringify(settings)
    }
  );
}

export async function createSemesterBackend(
  currentUser: AuthenticatedVotingUser,
  payload: {
    id?: string;
    universityId?: string;
    name: string;
    code: string;
    academicYear?: string;
    semesterNumber?: number;
    startDate?: string;
    endDate?: string;
    status?: 'draft' | 'active' | 'archived';
    isActive?: boolean;
    weeksCount?: number;
    departmentIds?: string[];
  }
): Promise<{ message: string; semester: Record<string, unknown> | null }> {
  return authorizedFetch('/api/semesters', currentUser, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function updateSemesterBackend(
  currentUser: AuthenticatedVotingUser,
  semesterId: string,
  payload: Record<string, unknown>
): Promise<{ message: string; semester: Record<string, unknown> }> {
  return authorizedFetch(`/api/semesters/${encodeURIComponent(semesterId)}`, currentUser, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export async function deleteSemesterBackend(
  currentUser: AuthenticatedVotingUser,
  semesterId: string
): Promise<{ message: string }> {
  return authorizedFetch(`/api/semesters/${encodeURIComponent(semesterId)}`, currentUser, {
    method: 'DELETE'
  });
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
    id?: string;
    universityId?: string;
    code: string;
    name: string;
    school?: string;
    facultyGroup?: string;
    headOfDepartment?: string;
    colorHex?: string;
    subDepartments?: string[];
  }
): Promise<{ message: string; department: Record<string, unknown> | null }> {
  return authorizedFetch('/api/departments', currentUser, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function updateDepartmentBackend(
  currentUser: AuthenticatedVotingUser,
  deptId: string,
  payload: {
    code?: string;
    name?: string;
    school?: string;
    colorHex?: string;
    subDepartments?: string[];
    headOfDepartment?: string;
  }
): Promise<{ message: string; department: Record<string, unknown> }> {
  return authorizedFetch(`/api/departments/${encodeURIComponent(deptId)}`, currentUser, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export async function deleteDepartmentBackend(
  currentUser: AuthenticatedVotingUser,
  deptId: string
): Promise<{ message: string }> {
  return authorizedFetch(`/api/departments/${encodeURIComponent(deptId)}`, currentUser, {
    method: 'DELETE'
  });
}

export async function createBatchCatalogBackend(
  currentUser: AuthenticatedVotingUser,
  payload: {
    id?: string;
    universityId?: string;
    code: string;
    name?: string;
    departmentCode?: string;
    programId?: string;
    termId?: string;
    batchCode?: string;
    section?: string;
    homeRoom?: string;
    year?: number;
    semester?: number;
    academicYear?: number;
    size?: number;
    studentCount?: number;
    sharedCourseIds?: string[];
  }
): Promise<{ message: string; batch: Record<string, unknown> | null }> {
  return authorizedFetch('/api/batches', currentUser, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function updateBatchBackend(
  currentUser: AuthenticatedVotingUser,
  batchId: string,
  payload: Record<string, unknown>
): Promise<{ message: string; batch: Record<string, unknown> }> {
  return authorizedFetch(`/api/batches/${encodeURIComponent(batchId)}`, currentUser, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export async function deleteBatchBackend(
  currentUser: AuthenticatedVotingUser,
  batchId: string
): Promise<{ message: string }> {
  return authorizedFetch(`/api/batches/${encodeURIComponent(batchId)}`, currentUser, {
    method: 'DELETE'
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
    departmentId?: string;
    departmentCode?: string;
    subDepartment?: string;
    batchId?: string;
    assignedBatchId?: string;
    semester?: number;
    instructorId?: string;
    assignedInstructorId?: string;
    assignedLabEngineerId?: string;
    type?: string;
    courseType?: string;
    creditHours?: number;
    lectureCredits?: number;
    labCredits?: number;
    lectureHours?: number;
    labHours?: number;
    hoursPerWeek?: number;
    studentCount?: number;
    requiredRoomType?: string;
    requiredEquipment?: string[];
    sectionCode?: string;
    labSessionMode?: string;
    isElective?: boolean;
    electivePoolName?: string;
    autoCreateSessions?: boolean;
  }
): Promise<{ message: string; course: Record<string, unknown> | null }> {
  return authorizedFetch('/api/courses', currentUser, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function updateCourseBackend(
  currentUser: AuthenticatedVotingUser,
  courseId: string,
  payload: Record<string, unknown>
): Promise<{ message: string; course: Record<string, unknown> }> {
  return authorizedFetch(`/api/courses/${encodeURIComponent(courseId)}`, currentUser, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export async function deleteCourseBackend(
  currentUser: AuthenticatedVotingUser,
  courseId: string
): Promise<{ message: string }> {
  return authorizedFetch(`/api/courses/${encodeURIComponent(courseId)}`, currentUser, {
    method: 'DELETE'
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
    departmentId?: string;
    departmentCode?: string;
    subDepartment?: string;
    title?: string;
    designation?: string;
    specialization?: string;
    staffRole?: string;
    maxWeeklyHours?: number;
    maxDailyClasses?: number;
    maxConsecutiveHours?: number;
    qualifiedCourseIds?: string[];
    preferredDays?: string[];
    unavailableSlots?: Array<{ day: string; timeSlot: string; reason?: string }>;
  }
): Promise<{ message: string; instructor: Record<string, unknown> | null }> {
  return authorizedFetch('/api/instructors', currentUser, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function updateInstructorBackend(
  currentUser: AuthenticatedVotingUser,
  instId: string,
  payload: Record<string, unknown>
): Promise<{ message: string; instructor: Record<string, unknown> }> {
  return authorizedFetch(`/api/instructors/${encodeURIComponent(instId)}`, currentUser, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export async function updateInstructorAvailabilityBackend(
  currentUser: AuthenticatedVotingUser,
  instId: string,
  unavailableSlots: Array<{ day: string; timeSlot: string; reason?: string }>
): Promise<{ message: string; unavailableCount: number }> {
  return authorizedFetch(`/api/instructors/${encodeURIComponent(instId)}/availability`, currentUser, {
    method: 'PUT',
    body: JSON.stringify({ unavailableSlots })
  });
}

export async function deleteInstructorBackend(
  currentUser: AuthenticatedVotingUser,
  instId: string
): Promise<{ message: string }> {
  return authorizedFetch(`/api/instructors/${encodeURIComponent(instId)}`, currentUser, {
    method: 'DELETE'
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
    buildingId?: string;
    code?: string;
    name: string;
    building?: string;
    floor?: number;
    capacity?: number;
    type?: string;
    equipment?: string[];
    isAccessible?: boolean;
    isAvailable?: boolean;
    assignedLabEngineerId?: string;
    labCategory?: string;
  }
): Promise<{ message: string; classroom: Record<string, unknown> | null }> {
  return authorizedFetch('/api/classrooms', currentUser, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function updateClassroomBackend(
  currentUser: AuthenticatedVotingUser,
  roomId: string,
  payload: Record<string, unknown>
): Promise<{ message: string; classroom: Record<string, unknown> }> {
  return authorizedFetch(`/api/classrooms/${encodeURIComponent(roomId)}`, currentUser, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export async function deleteClassroomBackend(
  currentUser: AuthenticatedVotingUser,
  roomId: string
): Promise<{ message: string }> {
  return authorizedFetch(`/api/classrooms/${encodeURIComponent(roomId)}`, currentUser, {
    method: 'DELETE'
  });
}

export async function createSectionBackend(
  currentUser: AuthenticatedVotingUser,
  payload: Record<string, unknown>
): Promise<{ message: string; section: Record<string, unknown> | null }> {
  return authorizedFetch('/api/sections', currentUser, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function deleteSectionBackend(
  currentUser: AuthenticatedVotingUser,
  sectionId: string
): Promise<{ message: string }> {
  return authorizedFetch(`/api/sections/${encodeURIComponent(sectionId)}`, currentUser, {
    method: 'DELETE'
  });
}

export async function autoGenerateSectionsBackend(
  currentUser: AuthenticatedVotingUser,
  payload?: { universityId?: string; termId?: string }
): Promise<{ message: string; createdCount: number; sections: Array<Record<string, unknown>> }> {
  return authorizedFetch('/api/sections/auto-generate', currentUser, {
    method: 'POST',
    body: JSON.stringify(payload || {})
  });
}

export async function updateSectionSlotBackend(
  currentUser: AuthenticatedVotingUser,
  sectionId: string,
  assignedSlot: Record<string, unknown>
): Promise<{ message: string; section: Record<string, unknown> }> {
  return authorizedFetch(`/api/sections/${encodeURIComponent(sectionId)}/slot`, currentUser, {
    method: 'PATCH',
    body: JSON.stringify({ assignedSlot })
  });
}

export async function toggleSectionLockBackend(
  currentUser: AuthenticatedVotingUser,
  sectionId: string,
  isLocked?: boolean
): Promise<{ message: string; isLocked: boolean; section: Record<string, unknown> }> {
  return authorizedFetch(`/api/sections/${encodeURIComponent(sectionId)}/lock`, currentUser, {
    method: 'PATCH',
    body: JSON.stringify(isLocked === undefined ? {} : { isLocked })
  });
}

export async function swapSectionsBackend(
  currentUser: AuthenticatedVotingUser,
  sectionAId: string,
  sectionBId: string
): Promise<{ message: string }> {
  return authorizedFetch('/api/sections/swap', currentUser, {
    method: 'POST',
    body: JSON.stringify({ sectionAId, sectionBId })
  });
}

export async function createConstraintBackend(
  currentUser: AuthenticatedVotingUser,
  payload: Record<string, unknown>
): Promise<{ message: string; constraint: Record<string, unknown> | null }> {
  return authorizedFetch('/api/constraints', currentUser, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function updateConstraintBackend(
  currentUser: AuthenticatedVotingUser,
  constraintId: string,
  payload: { enabled?: boolean; isEnabled?: boolean; weight?: number; name?: string; description?: string }
): Promise<{ message: string; constraint: Record<string, unknown> }> {
  return authorizedFetch(`/api/constraints/${encodeURIComponent(constraintId)}`, currentUser, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export async function deleteConstraintBackend(
  currentUser: AuthenticatedVotingUser,
  constraintId: string
): Promise<{ message: string }> {
  return authorizedFetch(`/api/constraints/${encodeURIComponent(constraintId)}`, currentUser, {
    method: 'DELETE'
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

export async function restoreTimetableBackend(
  currentUser: AuthenticatedVotingUser,
  versionId: string
): Promise<{ message: string; version: Record<string, unknown> }> {
  return authorizedFetch<{ message: string; version: Record<string, unknown> }>(
    `/api/timetables/${encodeURIComponent(versionId)}/restore`,
    currentUser,
    { method: 'POST' }
  );
}

export async function deleteTimetableBackend(
  currentUser: AuthenticatedVotingUser,
  versionId: string
): Promise<{ message: string }> {
  return authorizedFetch<{ message: string }>(
    `/api/timetables/${encodeURIComponent(versionId)}`,
    currentUser,
    { method: 'DELETE' }
  );
}

export async function patchTimetableEntriesBackend(
  currentUser: AuthenticatedVotingUser,
  versionId: string,
  payload: Record<string, unknown>
): Promise<{ message: string; timetableEntries: Array<Record<string, unknown>> }> {
  return authorizedFetch<{ message: string; timetableEntries: Array<Record<string, unknown>> }>(
    `/api/timetables/${encodeURIComponent(versionId)}/entries`,
    currentUser,
    {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }
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

export async function fetchReschedulingDisruptionsBackend(
  currentUser: AuthenticatedVotingUser,
  universityId?: string
): Promise<Array<Record<string, unknown>>> {
  const q = universityId ? `?universityId=${encodeURIComponent(universityId)}` : '';
  const res = await authorizedFetch<{ disruptions: Array<Record<string, unknown>> }>(
    `/api/rescheduling/disruptions${q}`,
    currentUser
  );
  return res.disruptions || [];
}

export async function fetchReschedulingHistoryBackend(
  currentUser: AuthenticatedVotingUser,
  universityId?: string
): Promise<Array<Record<string, unknown>>> {
  const q = universityId ? `?universityId=${encodeURIComponent(universityId)}` : '';
  const res = await authorizedFetch<{ history: Array<Record<string, unknown>> }>(
    `/api/rescheduling/history${q}`,
    currentUser
  );
  return res.history || [];
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

export async function fetchFeedbackProposalsBackend(
  currentUser: AuthenticatedVotingUser,
  universityId?: string
): Promise<Array<Record<string, unknown>>> {
  const q = universityId ? `?universityId=${encodeURIComponent(universityId)}` : '';
  const res = await authorizedFetch<{ proposals: Array<Record<string, unknown>> }>(
    `/api/feedback/proposals${q}`,
    currentUser
  );
  return res.proposals || [];
}

export async function createFeedbackProposalBackend(
  currentUser: AuthenticatedVotingUser,
  payload: {
    universityId?: string;
    title: string;
    category: string;
    description: string;
    targetSlot?: string;
  }
): Promise<{ message: string; proposal: Record<string, unknown> | null }> {
  return authorizedFetch('/api/feedback/proposals', currentUser, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function voteFeedbackProposalBackend(
  currentUser: AuthenticatedVotingUser,
  proposalId: string,
  vote: 'approve' | 'revise'
): Promise<{ message: string; proposal: Record<string, unknown> }> {
  return authorizedFetch(
    `/api/feedback/proposals/${encodeURIComponent(proposalId)}/vote`,
    currentUser,
    {
      method: 'POST',
      body: JSON.stringify({ vote })
    }
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
    compactnessScore?: number;
    studentGapMinutesAvg?: number;
    fairnessScore?: number;
    worstBatchSatisfaction?: number;
    executionTimeMs?: number;
  };
  fitnessHistory?: number[];
  preValidation?: BackendPreValidationReport;
  validationReport?: Record<string, unknown>;
  timeConfig?: Record<string, unknown>;
  entries?: BackendOptimizationEntry[];
  assignments?: Record<string, BackendOptimizationAssignment>;
}

export async function validateTimetableBackend(
  currentUser: AuthenticatedVotingUser,
  payload: Record<string, unknown>
): Promise<{ valid: boolean; validationReport?: Record<string, unknown> }> {
  return authorizedFetch<{ valid: boolean; validationReport?: Record<string, unknown> }>(
    '/api/optimization/validate',
    currentUser,
    {
      method: 'POST',
      body: JSON.stringify(payload)
    }
  );
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
      compactnessScore: result.fitness?.compactnessScore,
      studentGapMinutesAvg: result.fitness?.studentGapMinutesAvg,
      fairnessScore: result.fitness?.fairnessScore,
      worstBatchSatisfaction:
        result.fitness?.worstBatchSatisfaction ?? result.fitness?.leastSatisfiedBatchScore,
      executionTimeMs: result.executionTimeMs
    },
    fitnessHistory: result.fitnessHistory,
    preValidation: result.preValidation,
    validationReport: result.validationReport,
    timeConfig: result.timeConfig,
    entries: result.entries,
    assignments: result.assignments
  };
}

// =========================================================================
// Course, Instructor, Lab Engineer & Laboratory Assignment Workspace APIs
// =========================================================================

export async function fetchAssignmentWorkspaceApi(
  user: AuthenticatedVotingUser,
  filters?: {
    universityId?: string;
    termId?: string;
    departmentId?: string;
    cohortCode?: string;
    programId?: string;
    sectionId?: string;
    status?: string;
    componentType?: string;
    search?: string;
  }
): Promise<AssignmentWorkspaceResponseDTO> {
  const params = new URLSearchParams();
  if (filters?.universityId || user.institutionId) {
    params.set('universityId', String(filters?.universityId || user.institutionId));
  }
  if (filters?.termId) params.set('termId', filters.termId);
  if (filters?.departmentId) params.set('departmentId', filters.departmentId);
  if (filters?.cohortCode) params.set('cohortCode', filters.cohortCode);
  if (filters?.programId) params.set('programId', filters.programId);
  if (filters?.sectionId) params.set('sectionId', filters.sectionId);
  if (filters?.status) params.set('status', filters.status);
  if (filters?.componentType) params.set('componentType', filters.componentType);
  if (filters?.search) params.set('search', filters.search);
  return authorizedFetch<AssignmentWorkspaceResponseDTO>(
    `/api/assignments/workspace?${params.toString()}`,
    user
  );
}

export async function syncAssignmentOfferingsApi(
  user: AuthenticatedVotingUser,
  payload?: {
    universityId?: string;
    termId?: string;
    departmentId?: string;
    courseIds?: string[];
  }
): Promise<{ message: string; createdCount: number }> {
  return authorizedFetch<{ message: string; createdCount: number }>(
    '/api/assignments/sync-offerings',
    user,
    {
      method: 'POST',
      body: JSON.stringify({
        universityId: payload?.universityId || user.institutionId,
        termId: payload?.termId,
        departmentId: payload?.departmentId,
        courseIds: payload?.courseIds
      })
    }
  );
}

export async function validateOfferingAssignmentApi(
  user: AuthenticatedVotingUser,
  payload: {
    universityId?: string;
    offeringId: string;
    instructorId?: string | null;
    labEngineerId?: string | null;
    assignedLabId?: string | null;
    allowWorkloadOverride?: boolean;
  }
): Promise<
  AssignmentValidationResultDTO & {
    offeringId: string;
    updatedWorkloadPreview?: {
      instructor?: StaffWorkloadDTO | null;
      labEngineer?: StaffWorkloadDTO | null;
    };
  }
> {
  return authorizedFetch(
    '/api/assignments/validate',
    user,
    {
      method: 'POST',
      body: JSON.stringify({
        universityId: payload.universityId || user.institutionId,
        offeringId: payload.offeringId,
        instructorId: payload.instructorId ?? null,
        labEngineerId: payload.labEngineerId ?? null,
        assignedLabId: payload.assignedLabId ?? null,
        allowWorkloadOverride: Boolean(payload.allowWorkloadOverride)
      })
    }
  );
}

export async function saveOfferingAssignmentApi(
  user: AuthenticatedVotingUser,
  offeringId: string,
  payload: {
    universityId?: string;
    instructorId?: string | null;
    labEngineerId?: string | null;
    assignedLabId?: string | null;
    allowWorkloadOverride?: boolean;
    confirmTimetableImpact?: boolean;
  }
): Promise<{
  message: string;
  offeringId: string;
  validation: AssignmentValidationResultDTO;
}> {
  return authorizedFetch(
    `/api/assignments/offerings/${encodeURIComponent(offeringId)}`,
    user,
    {
      method: 'PUT',
      body: JSON.stringify({
        universityId: payload.universityId || user.institutionId,
        ...payload
      })
    }
  );
}

export async function previewBulkAssignmentApi(
  user: AuthenticatedVotingUser,
  payload: {
    universityId?: string;
    offeringIds: string[];
    instructorId?: string | null;
    labEngineerId?: string | null;
    assignedLabId?: string | null;
    overwriteExisting?: boolean;
    allowWorkloadOverride?: boolean;
  }
): Promise<BulkPreviewResponseDTO> {
  return authorizedFetch<BulkPreviewResponseDTO>(
    '/api/assignments/bulk/preview',
    user,
    {
      method: 'POST',
      body: JSON.stringify({
        universityId: payload.universityId || user.institutionId,
        offeringIds: payload.offeringIds,
        instructorId: payload.instructorId || null,
        labEngineerId: payload.labEngineerId || null,
        assignedLabId: payload.assignedLabId || null,
        overwriteExisting: Boolean(payload.overwriteExisting),
        allowWorkloadOverride: Boolean(payload.allowWorkloadOverride)
      })
    }
  );
}

export async function applyBulkAssignmentApi(
  user: AuthenticatedVotingUser,
  payload: {
    universityId?: string;
    offeringIds: string[];
    instructorId?: string | null;
    labEngineerId?: string | null;
    assignedLabId?: string | null;
    overwriteExisting?: boolean;
    allowWorkloadOverride?: boolean;
    confirmTimetableImpact?: boolean;
  }
): Promise<{
  message: string;
  appliedCount: number;
  skippedOverwriteCount: number;
}> {
  return authorizedFetch(
    '/api/assignments/bulk/apply',
    user,
    {
      method: 'POST',
      body: JSON.stringify({
        universityId: payload.universityId || user.institutionId,
        offeringIds: payload.offeringIds,
        instructorId: payload.instructorId || null,
        labEngineerId: payload.labEngineerId || null,
        assignedLabId: payload.assignedLabId || null,
        overwriteExisting: Boolean(payload.overwriteExisting),
        allowWorkloadOverride: Boolean(payload.allowWorkloadOverride),
        confirmTimetableImpact: Boolean(payload.confirmTimetableImpact)
      })
    }
  );
}

export async function copySectionAssignmentsApi(
  user: AuthenticatedVotingUser,
  payload: {
    universityId?: string;
    sourceSectionId: string;
    targetSectionIds: string[];
    previewOnly?: boolean;
    overwriteExisting?: boolean;
    allowWorkloadOverride?: boolean;
    confirmTimetableImpact?: boolean;
  }
): Promise<CopySectionResponseDTO> {
  return authorizedFetch<CopySectionResponseDTO>(
    '/api/assignments/copy-section',
    user,
    {
      method: 'POST',
      body: JSON.stringify({
        universityId: payload.universityId || user.institutionId,
        sourceSectionId: payload.sourceSectionId,
        targetSectionIds: payload.targetSectionIds,
        previewOnly: Boolean(payload.previewOnly),
        overwriteExisting: Boolean(payload.overwriteExisting),
        allowWorkloadOverride: Boolean(payload.allowWorkloadOverride),
        confirmTimetableImpact: Boolean(payload.confirmTimetableImpact)
      })
    }
  );
}

export async function clearOfferingAssignmentApi(
  user: AuthenticatedVotingUser,
  payload: {
    universityId?: string;
    offeringIds: string[];
    fields?: Array<'instructorId' | 'labEngineerId' | 'assignedLabId'>;
    confirmTimetableImpact?: boolean;
  }
): Promise<{ message: string; clearedCount: number }> {
  return authorizedFetch(
    '/api/assignments/clear',
    user,
    {
      method: 'POST',
      body: JSON.stringify({
        universityId: payload.universityId || user.institutionId,
        offeringIds: payload.offeringIds,
        fields: payload.fields,
        confirmTimetableImpact: Boolean(payload.confirmTimetableImpact)
      })
    }
  );
}

export async function fetchStaffWorkloadOverviewApi(
  user: AuthenticatedVotingUser,
  filters?: {
    universityId?: string;
    departmentId?: string;
    staffRole?: string;
    search?: string;
  }
): Promise<{
  universityId: string;
  staff: StaffWorkloadDTO[];
  totals: {
    totalStaff: number;
    activeStaff: number;
    overloadedCount: number;
    unassignedStaffCount: number;
  };
}> {
  const params = new URLSearchParams();
  if (filters?.universityId || user.institutionId) {
    params.set('universityId', String(filters?.universityId || user.institutionId));
  }
  if (filters?.departmentId) params.set('departmentId', filters.departmentId);
  if (filters?.staffRole) params.set('staffRole', filters.staffRole);
  if (filters?.search) params.set('search', filters.search);
  return authorizedFetch(`/api/assignments/workload?${params.toString()}`, user);
}

export async function fetchAssignmentHistoryApi(
  user: AuthenticatedVotingUser,
  universityId?: string
): Promise<{
  universityId: string;
  history: Array<{
    id: string;
    actor_name?: string;
    actor_role?: string;
    action: string;
    entity_type: string;
    entity_id: string;
    summary: string;
    previous_value?: string;
    new_value?: string;
    created_at: string;
  }>;
}> {
  const uni = universityId || user.institutionId;
  const q = uni ? `?universityId=${encodeURIComponent(uni)}` : '';
  return authorizedFetch(`/api/assignments/history${q}`, user);
}

export async function fetchMyStaffAssignmentsApi(
  user: AuthenticatedVotingUser,
  universityId?: string
): Promise<{
  universityId: string;
  instructor: StaffWorkloadDTO | null;
  offerings: import('../types/institutional').AssignmentOfferingDTO[];
}> {
  const uni = universityId || user.institutionId;
  const q = uni ? `?universityId=${encodeURIComponent(uni)}` : '';
  return authorizedFetch(`/api/assignments/my-load${q}`, user);
}

export interface ValidationReportDTO {
  id: string;
  institution_id: string;
  timetable_version_id: string;
  validation_status: 'VALID' | 'VALID WITH WARNINGS' | 'INVALID' | 'INCOMPLETE' | 'VALIDATION FAILED';
  total_required_sessions: number;
  total_scheduled_sessions: number;
  total_unscheduled_sessions: number;
  section_conflict_count: number;
  instructor_conflict_count: number;
  lab_engineer_conflict_count: number;
  room_conflict_count: number;
  invalid_duration_count: number;
  credit_hour_fulfillment: Record<string, any>;
  staff_assignment_integrity: Record<string, any>;
  total_hard_violations: number;
  total_warnings: number;
  validation_timestamp: string;
  report_data: {
    isValid: boolean;
    hardViolationCount: number;
    violations: Array<{
      type: string;
      severity: string;
      sessionIds: string[];
      message: string;
    }>;
    creditSummary: Record<string, any>;
  };
  versionName?: string;
  versionStatus?: string;
  fitnessScore?: number;
}

export interface ValidationOverviewDTO {
  totalGenerated: number;
  fullyValid: number;
  withIssues: number;
  incomplete: number;
  latestTimestamp: string;
}

export async function fetchValidationReportsApi(
  user: AuthenticatedVotingUser,
  universityId?: string
): Promise<{ reports: ValidationReportDTO[]; summary: ValidationOverviewDTO }> {
  const uni = universityId || user.institutionId;
  const q = uni ? `?universityId=${encodeURIComponent(uni)}` : '';
  return authorizedFetch(`/api/timetables/validation-reports${q}`, user);
}

export async function fetchTimetableValidationReportApi(
  user: AuthenticatedVotingUser,
  versionId: string,
  universityId?: string
): Promise<{ report: ValidationReportDTO }> {
  const uni = universityId || user.institutionId;
  const q = uni ? `?universityId=${encodeURIComponent(uni)}` : '';
  return authorizedFetch(`/api/timetables/${encodeURIComponent(versionId)}/validation${q}`, user);
}

export async function runTimetableValidationApi(
  user: AuthenticatedVotingUser,
  versionId: string
): Promise<{ message: string; report: ValidationReportDTO }> {
  return authorizedFetch(`/api/timetables/${encodeURIComponent(versionId)}/validate`, user, {
    method: 'POST'
  });
}





