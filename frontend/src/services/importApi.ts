import type { AuthenticatedVotingUser } from './votingApi';
import type {
  DuplicateHandlingMode,
  FieldDiffEntry,
  ImportCategory,
  ValidationReport,
  ValidationSummary
} from '../utils/csvImport';

export interface BackendImportValidateRequest {
  category: ImportCategory;
  duplicateMode: DuplicateHandlingMode;
  institutionId?: string;
  csvText?: string;
  headers?: string[];
  rows?: string[][];
  columnMappings?: Record<string, string>;
}

export interface BackendImportValidateResponse extends ValidationReport {
  institutionId: string;
  errorCsv: string;
}

export interface BackendImportCommitRequest extends BackendImportValidateRequest {
  fileName: string;
  confirmUpdates: boolean;
  atomic?: boolean;
  idempotencyKey: string;
}

export interface BackendImportCommitResponse {
  success: boolean;
  idempotentReplay: boolean;
  importId: string;
  status: 'completed' | 'partial' | 'failed' | 'rolled_back';
  category: ImportCategory;
  fileName: string;
  duplicateMode: DuplicateHandlingMode;
  durationMs: number;
  counts: {
    totalRows: number;
    created: number;
    updated: number;
    skipped: number;
    failed: number;
  };
  message: string;
  errorCsv: string;
  errorSummary: Array<{
    rowNumber: number;
    identifier: string;
    errors: Array<{ column: string; message: string; suggestion: string }>;
  }>;
  appliedOperations?: Array<Record<string, unknown>>;
}

export interface ImportHistoryEntry {
  id: string;
  institutionId: string;
  userId?: string | null;
  userName: string;
  userEmail: string;
  category: ImportCategory | string;
  fileName: string;
  duplicateMode: DuplicateHandlingMode | string;
  status: 'completed' | 'partial' | 'failed' | 'rolled_back' | string;
  totalRows: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  durationMs: number;
  errorSummary: Array<Record<string, unknown>>;
  createdAt: string;
}

export class ImportApiError extends Error {
  status: number;
  detail?: Record<string, unknown>;
  constructor(message: string, status: number, detail?: Record<string, unknown>) {
    super(message);
    this.name = 'ImportApiError';
    this.status = status;
    this.detail = detail;
  }
}

function authHeaders(user: AuthenticatedVotingUser): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${user.token}`
  };
}

async function handleResponse<T>(res: Response): Promise<T> {
  let parsed: Record<string, unknown> = {};
  try {
    parsed = (await res.json()) as Record<string, unknown>;
  } catch {
    parsed = {};
  }
  if (!res.ok) {
    const detail = (parsed.detail as Record<string, unknown>) || parsed;
    const msg =
      (typeof detail?.error === 'string' && detail.error) ||
      (typeof detail?.message === 'string' && detail.message) ||
      (typeof parsed?.error === 'string' && parsed.error) ||
      `Import request failed (${res.status}).`;
    throw new ImportApiError(msg, res.status, detail);
  }
  return parsed as unknown as T;
}

export async function fetchImportTemplateApi(
  user: AuthenticatedVotingUser,
  category: ImportCategory
): Promise<{ category: string; fileName: string; csvText: string }> {
  const res = await fetch(`/api/imports/template?category=${encodeURIComponent(category)}`, {
    method: 'GET',
    headers: authHeaders(user)
  });
  return handleResponse(res);
}

export async function validateImportBackendApi(
  user: AuthenticatedVotingUser,
  payload: BackendImportValidateRequest
): Promise<BackendImportValidateResponse> {
  const res = await fetch('/api/imports/validate', {
    method: 'POST',
    headers: authHeaders(user),
    body: JSON.stringify(payload)
  });
  return handleResponse<BackendImportValidateResponse>(res);
}

export async function commitImportBackendApi(
  user: AuthenticatedVotingUser,
  payload: BackendImportCommitRequest
): Promise<BackendImportCommitResponse> {
  const res = await fetch('/api/imports/commit', {
    method: 'POST',
    headers: authHeaders(user),
    body: JSON.stringify(payload)
  });
  return handleResponse<BackendImportCommitResponse>(res);
}

export async function fetchImportHistoryBackendApi(
  user: AuthenticatedVotingUser,
  institutionId?: string,
  limit = 25
): Promise<ImportHistoryEntry[]> {
  const qs = new URLSearchParams();
  if (institutionId) qs.set('institutionId', institutionId);
  qs.set('limit', String(limit));
  const res = await fetch(`/api/imports/history?${qs.toString()}`, {
    method: 'GET',
    headers: authHeaders(user)
  });
  const data = await handleResponse<{ history: ImportHistoryEntry[] }>(res);
  return Array.isArray(data.history) ? data.history : [];
}

export type { ValidationSummary, FieldDiffEntry };
