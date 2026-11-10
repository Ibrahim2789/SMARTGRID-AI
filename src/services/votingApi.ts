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
  isDemoTemplate?: boolean;
  studentCount?: number;
}

export async function fetchInstitutionsApi(): Promise<RegisteredInstitutionDTO[]> {
  try {
    const res = await fetch('/api/institutions');
    const data = await res.json().catch(() => ({ institutions: [] }));
    return data.institutions || [];
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
  quickSwitch = false,
  expectedPortalRole?: 'student' | 'br' | 'admin' | 'faculty'
): Promise<AuthenticatedVotingUser> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, quickSwitch, expectedPortalRole })
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
  const epochAtStart = activeSessionEpoch;
  const syncedUser = await loginWithBackend(currentUser.email, undefined, true);
  if (isSessionSignedOut || epochAtStart + 1 !== activeSessionEpoch) {
    throw new Error('Session signed out.');
  }
  return syncedUser.token || '';
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

export interface SolveOptimizationApiResponse {
  status: string;
  metrics: {
    placedCount: number;
    unplacedCount: number;
    conflictCount: number;
    roomUtilization: number;
    solverEngine: string;
  };
  assignments?: Record<string, unknown>;
}

export async function solveOptimizationApi(
  payload: Record<string, unknown>
): Promise<SolveOptimizationApiResponse> {
  const res = await fetch('/api/optimization/solve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    throw new Error('Optimization API unavailable');
  }
  return (await res.json()) as SolveOptimizationApiResponse;
}



