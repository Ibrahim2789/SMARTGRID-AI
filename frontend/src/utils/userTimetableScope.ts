import { Instructor, StudentGroup } from '../types/institutional';
import { AuthenticatedVotingUser } from '../services/votingApi';

export type NormalizedUserRole = 'admin' | 'br' | 'faculty' | 'student';

export function getNormalizedUserRole(
  user?: { role?: string; systemRole?: string } | null
): NormalizedUserRole {
  if (!user) return 'admin';
  const r = (user.systemRole || user.role || '').toLowerCase();
  if (r === 'admin' || r === 'registrar') return 'admin';
  if (r === 'br') return 'br';
  if (r === 'faculty') return 'faculty';
  if (r === 'student') return 'student';
  return 'admin';
}

export function normalizePersonName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(dr|prof|engr|mr|ms|mrs)\b\.?/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function extractSectionCode(section?: string | null): string {
  if (!section) return '';
  return section.replace(/section\s*/i, '').trim().toUpperCase();
}

/**
 * Resolves the exact StudentGroup (class/section) belonging to a Student or BR.
 * Returns null if no matching group exists (never falls back to an unrelated cohort).
 */
export function resolveUserCohort(
  user: Partial<AuthenticatedVotingUser> | null | undefined,
  studentGroups: StudentGroup[]
): StudentGroup | null {
  if (!user || studentGroups.length === 0) return null;

  const batchCode = (user.batchCode || '').trim().toUpperCase();
  const sec = extractSectionCode(user.section);

  if (batchCode) {
    if (sec) {
      const exactSectionCode = `${batchCode}-${sec}`;
      const byExactCode = studentGroups.find(
        g => g.code.toUpperCase() === exactSectionCode
      );
      if (byExactCode) return byExactCode;
    }

    const byBatchExact = studentGroups.find(g => g.code.toUpperCase() === batchCode);
    if (byBatchExact) return byBatchExact;

    if (sec) {
      const byPrefixAndSec = studentGroups.find(
        g =>
          g.code.toUpperCase().startsWith(batchCode) &&
          (g.section || '').trim().toUpperCase() === sec
      );
      if (byPrefixAndSec) return byPrefixAndSec;
    }

    const byPrefix = studentGroups.find(g =>
      g.code.toUpperCase().startsWith(batchCode)
    );
    if (byPrefix) return byPrefix;

    const byName = studentGroups.find(
      g =>
        g.name.toUpperCase().includes(batchCode) &&
        (!sec || (g.section || '').trim().toUpperCase() === sec)
    );
    if (byName) return byName;
  }

  if (user.batchId) {
    const byId = studentGroups.find(g => g.id === user.batchId);
    if (byId) return byId;
  }

  return null;
}

/**
 * Resolves all sections belonging strictly to a Batch Representative's assigned batch.
 * Never returns cohorts from other batches or departments.
 */
export function resolveBrBatchCohorts(
  user: Partial<AuthenticatedVotingUser> | null | undefined,
  studentGroups: StudentGroup[]
): StudentGroup[] {
  if (!user || studentGroups.length === 0) return [];
  const batchCode = (user.batchCode || '').trim().toUpperCase();

  if (batchCode) {
    const matching = studentGroups.filter(
      g =>
        g.code.toUpperCase() === batchCode ||
        g.code.toUpperCase().startsWith(`${batchCode}-`) ||
        g.name.toUpperCase().includes(batchCode)
    );
    if (matching.length > 0) return matching;
  }

  const fallbackSingle = resolveUserCohort(user, studentGroups);
  return fallbackSingle ? [fallbackSingle] : [];
}

/**
 * Resolves the exact Instructor record matching a Faculty account.
 * Returns null if no matching instructor exists (never leaks another instructor's timetable).
 */
export function resolveFacultyInstructor(
  user: Partial<AuthenticatedVotingUser> | null | undefined,
  instructors: Instructor[]
): Instructor | null {
  if (!user || instructors.length === 0) return null;

  const userEmail = (user.email || '').trim().toLowerCase();
  if (userEmail) {
    const byEmail = instructors.find(
      i => (i.email || '').trim().toLowerCase() === userEmail
    );
    if (byEmail) return byEmail;
  }

  const rawName = (user.name || '').trim().toLowerCase();
  const normUser = normalizePersonName(user.name || '');

  if (rawName || normUser) {
    const byNormalizedExact = instructors.find(i => {
      const instNorm = normalizePersonName(i.name);
      return (
        i.name.trim().toLowerCase() === rawName ||
        (normUser && instNorm === normUser)
      );
    });
    if (byNormalizedExact) return byNormalizedExact;

    const byTokenInclusion = instructors.find(i => {
      const instNorm = normalizePersonName(i.name);
      if (!instNorm || !normUser) return false;
      return instNorm.includes(normUser) || normUser.includes(instNorm);
    });
    if (byTokenInclusion) return byTokenInclusion;
  }

  return null;
}
