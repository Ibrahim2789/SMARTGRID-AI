import express, { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import {
  db,
  initializeVotingDatabase,
  hashPassword,
  verifyPassword,
  signAuthToken,
  verifyAuthToken,
  AuthTokenPayload,
  VotingUserRole,
  BrGenderRole,
  PollStatus,
  ResultVisibility
} from './src/server/votingDb';

// Initialize SQLite tables and university seed data
initializeVotingDatabase();

interface AuthenticatedRequest extends Request {
  authUser?: AuthTokenPayload;
}

function mapRoleToDisplayRole(role: VotingUserRole): string {
  switch (role) {
    case 'admin':
      return 'Registrar';
    case 'br':
      return 'BR';
    case 'student':
      return 'Student';
    case 'faculty':
      return 'Faculty';
  }
}

function getUserAuthContext(userId: string) {
  const user = db
    .prepare(
      `SELECT u.*, b.code as batch_code, b.name as batch_name, b.department_code as batch_department
       FROM users u
       LEFT JOIN batches b ON b.id = u.batch_id
       WHERE u.id = ?`
    )
    .get(userId) as
    | {
        id: string;
        name: string;
        email: string;
        role: VotingUserRole;
        gender: BrGenderRole | null;
        batch_id: string | null;
        registration_number: string | null;
        section: string | null;
        is_active: number;
        must_reset_password: number;
        credential_hint: string | null;
        institution: string;
        batch_code: string | null;
        batch_name: string | null;
        batch_department: string | null;
      }
    | undefined;

  if (!user) return null;

  let brAssignment:
    | {
        id: string;
        batch_id: string;
        gender_role: BrGenderRole;
        batch_code: string;
        batch_name: string;
        department_code: string;
      }
    | undefined;

  if (user.role === 'br') {
    brAssignment = db
      .prepare(
        `SELECT a.id, a.batch_id, a.gender_role, b.code as batch_code, b.name as batch_name, b.department_code
         FROM br_assignments a
         JOIN batches b ON b.id = a.batch_id
         WHERE a.user_id = ? AND a.is_active = 1`
      )
      .get(user.id) as typeof brAssignment;
  }

  const effectiveBatchId = brAssignment ? brAssignment.batch_id : user.batch_id;
  const effectiveBatchCode = brAssignment ? brAssignment.batch_code : user.batch_code;
  const effectiveBatchName = brAssignment ? brAssignment.batch_name : user.batch_name;
  const effectiveBrGender = brAssignment ? brAssignment.gender_role : null;

  const token = signAuthToken({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    institutionId: (user as any).institution_id || 'inst-western-poly',
    batchId: effectiveBatchId,
    brGenderRole: effectiveBrGender
  });

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: mapRoleToDisplayRole(user.role),
    systemRole: user.role,
    institution: user.institution || 'Western Polytechnic',
    institutionId: (user as any).institution_id || 'inst-western-poly',
    batchId: effectiveBatchId,
    batchCode: effectiveBatchCode,
    batchName: effectiveBatchName,
    brGenderRole: effectiveBrGender,
    registrationNumber: user.registration_number || null,
    section: user.section || null,
    isActive: Boolean(user.is_active),
    token
  };
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }
  const token = authHeader.slice(7).trim();
  const payload = verifyAuthToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired authentication session.' });
    return;
  }

  // Always verify user still exists and is active in DB
  const dbUser = db
    .prepare('SELECT id, role, is_active, batch_id, institution_id FROM users WHERE id = ?')
    .get(payload.userId) as
    | { id: string; role: VotingUserRole; is_active: number; batch_id: string | null; institution_id?: string }
    | undefined;

  if (!dbUser || !dbUser.is_active) {
    res.status(403).json({
      error: 'Your account has been deactivated by the Administrator. Please contact the Registrar.'
    });
    return;
  }

  if (dbUser.role === 'br') {
    const activeAssign = db
      .prepare(
        'SELECT batch_id, gender_role FROM br_assignments WHERE user_id = ? AND is_active = 1'
      )
      .get(dbUser.id) as { batch_id: string; gender_role: BrGenderRole } | undefined;
    payload.batchId = activeAssign ? activeAssign.batch_id : null;
    payload.brGenderRole = activeAssign ? activeAssign.gender_role : null;
  } else {
    payload.batchId = dbUser.batch_id;
  }
  payload.role = dbUser.role;
  payload.institutionId = dbUser.institution_id || payload.institutionId || 'inst-western-poly';

  req.authUser = payload;
  next();
}

function requireRole(...allowedRoles: VotingUserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.authUser) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    if (!allowedRoles.includes(req.authUser.role)) {
      res.status(403).json({
        error: `Access denied. Required role: ${allowedRoles.join(' or ')}. Your current role is ${req.authUser.role}.`
      });
      return;
    }
    next();
  };
}

function buildEnrichedPollsForUser(authUser: AuthTokenPayload) {
  const nowIso = new Date().toISOString();

  // Auto-close any Published polls whose end_at has passed
  db.prepare(
    `UPDATE polls
     SET status = 'Closed', closed_at = ?, updated_at = ?
     WHERE status = 'Published' AND end_at IS NOT NULL AND end_at < ?`
  ).run(nowIso, nowIso, nowIso);

  const userInstId = authUser.institutionId || 'inst-western-poly';
  let pollsQuery = `
    SELECT p.*, b.code as batch_code, b.name as batch_name, b.department_code, b.student_count as batch_student_count
    FROM polls p
    JOIN batches b ON b.id = p.batch_id
    WHERE (p.institution_id = ? OR (p.institution_id IS NULL AND ? = 'inst-western-poly'))
  `;
  const queryParams: (string | number)[] = [userInstId, userInstId];

  if (authUser.role === 'student' || authUser.role === 'faculty') {
    // Students only see Published or Closed polls (never Pending, Approved draft, or Rejected)
    pollsQuery += ` AND p.status IN ('Published', 'Closed')`;
  } else if (authUser.role === 'br') {
    // BRs see all their own batch's submissions AND Published/Closed polls across batches
    pollsQuery += ` AND (p.batch_id = ? OR p.submitted_by_user_id = ? OR p.status IN ('Published', 'Closed'))`;
    queryParams.push(authUser.batchId || '', authUser.userId);
  }
  pollsQuery += ` ORDER BY p.created_at DESC`;

  const rawPolls = db.prepare(pollsQuery).all(...queryParams) as Array<{
    id: string;
    title: string;
    description: string;
    batch_id: string;
    batch_code: string;
    batch_name: string;
    department_code: string;
    batch_student_count: number;
    target_scope: 'all_batches' | 'submitting_batch';
    submitted_by_user_id: string;
    submitted_by_name: string;
    br_gender_role: BrGenderRole;
    status: PollStatus;
    rejection_reason: string | null;
    result_visibility: ResultVisibility;
    start_at: string | null;
    end_at: string | null;
    published_at: string | null;
    closed_at: string | null;
    created_at: string;
    updated_at: string;
  }>;

  const allOptions = db
    .prepare('SELECT id, poll_id, label, sort_order FROM poll_options ORDER BY sort_order ASC')
    .all() as Array<{ id: string; poll_id: string; label: string; sort_order: number }>;

  const voteCountsByOption = db
    .prepare('SELECT poll_id, option_id, COUNT(*) as count FROM poll_votes GROUP BY poll_id, option_id')
    .all() as Array<{ poll_id: string; option_id: string; count: number }>;

  const batchParticipationRows = db
    .prepare(
      `SELECT pv.poll_id, pv.batch_id, b.code as batch_code, b.name as batch_name, b.student_count, COUNT(*) as votes_cast
       FROM poll_votes pv
       JOIN batches b ON b.id = pv.batch_id
       GROUP BY pv.poll_id, pv.batch_id`
    )
    .all() as Array<{
    poll_id: string;
    batch_id: string;
    batch_code: string;
    batch_name: string;
    student_count: number;
    votes_cast: number;
  }>;

  const userVotes = db
    .prepare('SELECT poll_id, option_id, created_at FROM poll_votes WHERE student_user_id = ?')
    .all(authUser.userId) as Array<{ poll_id: string; option_id: string; created_at: string }>;

  const userVoteMap = new Map(userVotes.map(v => [v.poll_id, v]));

  return rawPolls.map(poll => {
    const optionsForPoll = allOptions.filter(o => o.poll_id === poll.id);
    const countsForPoll = voteCountsByOption.filter(c => c.poll_id === poll.id);
    const totalVotes = countsForPoll.reduce((acc, row) => acc + Number(row.count), 0);

    const myVote = userVoteMap.get(poll.id) || null;
    const hasVoted = Boolean(myVote);

    const isUpcoming =
      poll.status === 'Published' && Boolean(poll.start_at && poll.start_at > nowIso);
    const isExpired =
      poll.status === 'Closed' ||
      (poll.status === 'Published' && Boolean(poll.end_at && poll.end_at < nowIso));
    const isActiveVotingWindow =
      poll.status === 'Published' && !isUpcoming && !isExpired;

    let canViewResults = false;
    if (authUser.role === 'admin') {
      canViewResults = true;
    } else if (authUser.role === 'br') {
      canViewResults =
        poll.result_visibility === 'always' ||
        isExpired ||
        poll.status === 'Closed' ||
        poll.submitted_by_user_id === authUser.userId ||
        poll.batch_id === authUser.batchId;
    } else {
      if (poll.result_visibility === 'always') {
        canViewResults = true;
      } else if (poll.result_visibility === 'after_vote') {
        canViewResults = hasVoted || isExpired || poll.status === 'Closed';
      } else if (poll.result_visibility === 'after_close') {
        canViewResults = isExpired || poll.status === 'Closed';
      }
    }

    const enrichedOptions = optionsForPoll.map(opt => {
      const foundCount = countsForPoll.find(c => c.option_id === opt.id);
      const votes = foundCount ? Number(foundCount.count) : 0;
      const percentage = totalVotes > 0 ? Math.round((votes / totalVotes) * 1000) / 10 : 0;
      return {
        id: opt.id,
        label: opt.label,
        sortOrder: opt.sort_order,
        votes: canViewResults ? votes : null,
        percentage: canViewResults ? percentage : null
      };
    });

    const batchBreakdown =
      authUser.role === 'admin' || canViewResults
        ? batchParticipationRows
            .filter(r => r.poll_id === poll.id)
            .map(r => ({
              batchId: r.batch_id,
              batchCode: r.batch_code,
              batchName: r.batch_name,
              studentCount: r.student_count,
              votesCast: Number(r.votes_cast),
              participationRate:
                r.student_count > 0
                  ? Math.min(100, Math.round((Number(r.votes_cast) / r.student_count) * 1000) / 10)
                  : 0
            }))
        : [];

    return {
      id: poll.id,
      title: poll.title,
      description: poll.description,
      batchId: poll.batch_id,
      batchCode: poll.batch_code,
      batchName: poll.batch_name,
      departmentCode: poll.department_code,
      targetScope: poll.target_scope,
      submittedByUserId: poll.submitted_by_user_id,
      submittedByName: poll.submitted_by_name,
      brGenderRole: poll.br_gender_role,
      status: poll.status,
      rejectionReason:
        authUser.role === 'admin' || authUser.role === 'br' ? poll.rejection_reason : null,
      resultVisibility: poll.result_visibility,
      startAt: poll.start_at,
      endAt: poll.end_at,
      publishedAt: poll.published_at,
      closedAt: poll.closed_at,
      createdAt: poll.created_at,
      updatedAt: poll.updated_at,
      isUpcoming,
      isExpired,
      isActiveVotingWindow,
      hasVoted,
      myVotedOptionId: myVote ? myVote.option_id : null,
      myVotedAt: myVote ? myVote.created_at : null,
      canViewResults,
      totalVotes,
      options: enrichedOptions,
      batchBreakdown
    };
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // =========================================================
  // MULTI-UNIVERSITY INSTITUTION MANAGEMENT ENDPOINTS
  // =========================================================
  app.get('/api/institutions', (_req: Request, res: Response) => {
    try {
      const rows = db.prepare('SELECT * FROM institutions ORDER BY created_at ASC').all();
      res.json({ institutions: rows });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch institutions', details: err.message });
    }
  });

  app.post('/api/institutions/register', (req: Request, res: Response) => {
    try {
      const {
        name,
        code,
        campusName,
        accreditation,
        adminName,
        adminEmail,
        adminPassword,
        workingDays,
        dayStartTime,
        dayEndTime,
        periodLengthMinutes,
        shortBreakMinutes,
        middayBreakEnabled,
        middayBreakStart,
        middayBreakDuration,
        labDurationMinutes
      } = req.body;

      if (!name || !code || !adminEmail || !adminPassword) {
        res.status(400).json({ error: 'University name, code, admin email, and password are required.' });
        return;
      }

      const cleanCode = code.trim().toUpperCase();
      const instId = `inst-${cleanCode.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString(36)}`;

      // Insert institution
      db.prepare(`
        INSERT INTO institutions (
          id, name, code, campus_name, accreditation, academic_year, current_term,
          working_days, day_start_time, day_end_time, period_length_minutes, short_break_minutes,
          midday_break_enabled, midday_break_start, midday_break_duration, lab_duration_minutes,
          timezone, is_sample, created_at
        ) VALUES (?, ?, ?, ?, ?, '2026–2027', 'Fall Semester 2026', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'UTC', 0, datetime('now'))
      `).run(
        instId,
        name.trim(),
        cleanCode,
        campusName?.trim() || 'Main Campus',
        accreditation?.trim() || 'Accredited Higher Education Institution',
        workingDays || 'Mon,Tue,Wed,Thu,Fri',
        dayStartTime || '09:00',
        dayEndTime || '17:00',
        periodLengthMinutes || 50,
        shortBreakMinutes || 10,
        middayBreakEnabled ? 1 : 0,
        middayBreakStart || '13:00',
        middayBreakDuration || 60,
        labDurationMinutes || 180
      );

      // Seed two starter batches for the newly registered university so Student Sign Up & BR Management work out of the box
      const nowIso = new Date().toISOString();
      const batch1Id = `batch-${cleanCode.toLowerCase()}-cs-1`;
      const batch2Id = `batch-${cleanCode.toLowerCase()}-se-1`;
      db.prepare(`
        INSERT OR IGNORE INTO batches (id, code, name, department_code, year, semester, student_count, institution_id, created_at)
        VALUES (?, ?, ?, 'CS', 1, 1, 60, ?, ?)
      `).run(batch1Id, `${cleanCode}-2026-CS`, `Computer Science — Cohort 2026 (${cleanCode})`, instId, nowIso);
      db.prepare(`
        INSERT OR IGNORE INTO batches (id, code, name, department_code, year, semester, student_count, institution_id, created_at)
        VALUES (?, ?, ?, 'SE', 2, 3, 55, ?, ?)
      `).run(batch2Id, `${cleanCode}-2025-SE`, `Software & Systems Engineering — Cohort 2025 (${cleanCode})`, instId, nowIso);

      // Create admin user for this institution
      const adminId = `user-admin-${Date.now()}`;
      db.prepare(`
        INSERT INTO users (
          id, name, email, password_hash, role, gender, batch_id,
          registration_number, section,
          is_active, must_reset_password, credential_hint, institution, institution_id, created_at
        ) VALUES (?, ?, ?, ?, 'admin', 'male', null, null, null, 1, 0, ?, ?, ?, datetime('now'))
      `).run(
        adminId,
        adminName?.trim() || 'University Administrator',
        adminEmail.trim().toLowerCase(),
        hashPassword(adminPassword.trim()),
        adminPassword.trim(),
        name.trim(),
        instId
      );

      const authContext = getUserAuthContext(adminId);
      res.json({
        success: true,
        institutionId: instId,
        institutionName: name.trim(),
        institutionCode: cleanCode,
        user: authContext
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to register institution', details: err.message });
    }
  });

  app.get('/api/institutions/:id/data', (req: Request, res: Response) => {
    try {
      const instId = req.params.id;
      const row = db.prepare('SELECT payload FROM institution_data WHERE institution_id = ?').get(instId) as { payload: string } | undefined;
      if (row && row.payload) {
        res.json({ data: JSON.parse(row.payload) });
      } else {
        res.json({ data: null });
      }
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to retrieve institution data', details: err.message });
    }
  });

  app.post('/api/institutions/:id/data', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const instId = req.params.id;
      const { data } = req.body;
      if (!data) {
        res.status(400).json({ error: 'Missing data payload.' });
        return;
      }
      db.prepare(`
        INSERT INTO institution_data (institution_id, payload, updated_at)
        VALUES (?, ?, datetime('now'))
        ON CONFLICT(institution_id) DO UPDATE SET
          payload = excluded.payload,
          updated_at = datetime('now')
      `).run(instId, JSON.stringify(data));
      res.json({ success: true, message: 'Institutional academic catalog saved.' });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to save institution data', details: err.message });
    }
  });

  // =========================================================
  // PUBLIC BATCHES ENDPOINT (Scoped by University / Institution)
  // =========================================================
  app.get('/api/auth/batches-public', (req: Request, res: Response) => {
    try {
      const institutionId = (req.query.institutionId as string) || '';
      let rows;
      if (institutionId) {
        rows = db
          .prepare(
            'SELECT id, code, name, department_code as departmentCode, year, semester FROM batches WHERE institution_id = ? ORDER BY year DESC, code ASC'
          )
          .all(institutionId);
      } else {
        rows = db
          .prepare(
            'SELECT id, code, name, department_code as departmentCode, year, semester FROM batches ORDER BY year DESC, code ASC'
          )
          .all();
      }
      res.json({ batches: rows });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to load university batches.'
      });
    }
  });

  // =========================================================
  // STUDENT REGISTRATION ENDPOINT (Strictly Forces 'student' Role)
  // =========================================================
  app.post('/api/auth/register-student', (req: Request, res: Response) => {
    try {
      const {
        name,
        email,
        registrationNumber,
        batchId,
        customBatchCode,
        section,
        password,
        confirmPassword,
        institutionId,
        role: attemptedRoleOverride
      } = req.body as {
        name?: string;
        email?: string;
        registrationNumber?: string;
        batchId?: string;
        customBatchCode?: string;
        section?: string;
        password?: string;
        confirmPassword?: string;
        institutionId?: string;
        role?: string;
      };

      // Reject any attempt to self-assign BR or Admin role during registration
      if (
        attemptedRoleOverride &&
        attemptedRoleOverride.toLowerCase() !== 'student'
      ) {
        res.status(403).json({
          error:
            'Security violation: Public registration is strictly restricted to Student accounts. Batch Representative (BR) and Admin accounts cannot be self-registered.'
        });
        return;
      }

      const cleanName = (name || '').trim();
      const cleanEmail = (email || '').trim().toLowerCase();
      const cleanRegNo = (registrationNumber || '').trim().toUpperCase();
      let cleanBatchId = (batchId || '').trim();
      const cleanCustomBatch = (customBatchCode || '').trim().toUpperCase();
      const cleanSection = (section || '').trim();
      const cleanPassword = (password || '').trim();
      const cleanConfirm = (confirmPassword || '').trim();
      const requestedInstId = (institutionId || '').trim();

      if (!cleanName || cleanName.length < 2) {
        res.status(400).json({ error: 'Please enter your full name.' });
        return;
      }

      if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        res.status(400).json({ error: 'Please enter a valid university or student email address.' });
        return;
      }

      if (!cleanRegNo || cleanRegNo.length < 3) {
        res.status(400).json({
          error: 'Please enter your student registration / roll number.'
        });
        return;
      }

      if (!cleanBatchId && !cleanCustomBatch) {
        res.status(400).json({ error: 'Please select or enter your academic batch.' });
        return;
      }

      if (!cleanSection) {
        res.status(400).json({ error: 'Please select or enter your class section.' });
        return;
      }

      if (cleanPassword.length < 6) {
        res.status(400).json({ error: 'Password must be at least 6 characters long.' });
        return;
      }

      if (cleanPassword !== cleanConfirm) {
        res.status(400).json({ error: 'Password and Confirm Password do not match.' });
        return;
      }

      // Resolve target institution
      let resolvedInstId = requestedInstId || 'inst-western-poly';
      let resolvedInstName = 'Western Polytechnic';

      const instRow = db
        .prepare('SELECT id, name FROM institutions WHERE id = ? OR UPPER(code) = UPPER(?)')
        .get(resolvedInstId, resolvedInstId) as { id: string; name: string } | undefined;

      if (instRow) {
        resolvedInstId = instRow.id;
        resolvedInstName = instRow.name;
      }

      // If student entered a custom batch code (e.g. for a newly registered university), create or find it
      if ((cleanBatchId === '__custom__' || !cleanBatchId) && cleanCustomBatch) {
        const existingCustomBatch = db
          .prepare('SELECT id, institution_id FROM batches WHERE UPPER(code) = ? AND institution_id = ?')
          .get(cleanCustomBatch, resolvedInstId) as { id: string; institution_id: string } | undefined;

        if (existingCustomBatch) {
          cleanBatchId = existingCustomBatch.id;
        } else {
          const newBatchId = `batch-${cleanCustomBatch.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString(36)}`;
          db.prepare(
            `INSERT INTO batches (id, code, name, department_code, year, semester, student_count, institution_id, created_at)
             VALUES (?, ?, ?, 'GEN', 1, 1, 60, ?, ?)`
          ).run(
            newBatchId,
            cleanCustomBatch,
            `${cleanCustomBatch} Cohort`,
            resolvedInstId,
            new Date().toISOString()
          );
          cleanBatchId = newBatchId;
        }
      }

      const batchRow = db
        .prepare('SELECT id, code, name, institution_id FROM batches WHERE id = ?')
        .get(cleanBatchId) as { id: string; code: string; name: string; institution_id?: string } | undefined;

      if (!batchRow) {
        res.status(400).json({ error: 'Selected academic batch was not found.' });
        return;
      }

      if (batchRow.institution_id) {
        const batchInst = db
          .prepare('SELECT id, name FROM institutions WHERE id = ?')
          .get(batchRow.institution_id) as { id: string; name: string } | undefined;
        if (batchInst) {
          resolvedInstId = batchInst.id;
          resolvedInstName = batchInst.name;
        }
      }

      const existingEmail = db
        .prepare('SELECT id FROM users WHERE LOWER(email) = ?')
        .get(cleanEmail) as { id: string } | undefined;

      if (existingEmail) {
        res.status(409).json({
          error: `An account with email "${cleanEmail}" is already registered.`
        });
        return;
      }

      const existingReg = db
        .prepare('SELECT id FROM users WHERE UPPER(registration_number) = ? AND institution_id = ?')
        .get(cleanRegNo, resolvedInstId) as { id: string } | undefined;

      if (existingReg) {
        res.status(409).json({
          error: `A student with registration/roll number "${cleanRegNo}" is already registered at ${resolvedInstName}.`
        });
        return;
      }

      const nowIso = new Date().toISOString();
      const newStudentId = `user-student-${crypto.randomUUID().slice(0, 8)}`;

      db.exec('BEGIN IMMEDIATE;');
      try {
        db.prepare(
          `INSERT INTO users (
            id, name, email, password_hash, role, gender, batch_id,
            registration_number, section,
            is_active, must_reset_password, credential_hint, institution, institution_id, created_at
          ) VALUES (?, ?, ?, ?, 'student', NULL, ?, ?, ?, 1, 0, NULL, ?, ?, ?)`
        ).run(
          newStudentId,
          cleanName,
          cleanEmail,
          hashPassword(cleanPassword),
          cleanBatchId,
          cleanRegNo,
          cleanSection,
          resolvedInstName,
          resolvedInstId,
          nowIso
        );
        db.exec('COMMIT;');
      } catch (err) {
        db.exec('ROLLBACK;');
        throw err;
      }

      const authContext = getUserAuthContext(newStudentId);
      res.status(201).json({
        message: 'Student account registered.',
        user: authContext
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Student registration failed.'
      });
    }
  });

  // =========================================================
  // FACULTY ACCOUNT ACTIVATION / REGISTRATION ENDPOINT
  // =========================================================
  app.post('/api/auth/activate-faculty', (req: Request, res: Response) => {
    try {
      const {
        name,
        email,
        department,
        institutionId,
        password,
        confirmPassword
      } = req.body as {
        name?: string;
        email?: string;
        department?: string;
        institutionId?: string;
        password?: string;
        confirmPassword?: string;
      };

      const cleanName = (name || '').trim();
      const cleanEmail = (email || '').trim().toLowerCase();
      const cleanDept = (department || 'Faculty Member').trim();
      const cleanPassword = (password || '').trim();
      const cleanConfirm = (confirmPassword || '').trim();
      const requestedInstId = (institutionId || 'inst-western-poly').trim();

      if (!cleanName || cleanName.length < 2) {
        res.status(400).json({ error: 'Please enter your full name and academic title (e.g., Dr. Sarah Chen).' });
        return;
      }
      if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        res.status(400).json({ error: 'Please enter a valid institutional faculty email address.' });
        return;
      }
      if (cleanPassword.length < 6) {
        res.status(400).json({ error: 'Password must be at least 6 characters long.' });
        return;
      }
      if (cleanPassword !== cleanConfirm) {
        res.status(400).json({ error: 'Password and Confirm Password do not match.' });
        return;
      }

      let resolvedInstId = requestedInstId;
      let resolvedInstName = 'Western Polytechnic';
      const instRow = db
        .prepare('SELECT id, name FROM institutions WHERE id = ? OR UPPER(code) = UPPER(?)')
        .get(requestedInstId, requestedInstId) as { id: string; name: string } | undefined;
      if (instRow) {
        resolvedInstId = instRow.id;
        resolvedInstName = instRow.name;
      }

      const existingUser = db
        .prepare('SELECT id, role, institution_id FROM users WHERE LOWER(email) = ?')
        .get(cleanEmail) as { id: string; role: string; institution_id?: string } | undefined;

      let facultyUserId = '';

      if (existingUser) {
        if (existingUser.role !== 'faculty') {
          res.status(409).json({
            error: `Email "${cleanEmail}" is already registered under a ${existingUser.role.toUpperCase()} account.`
          });
          return;
        }
        // Activate / claim pre-imported faculty record
        facultyUserId = existingUser.id;
        db.prepare(`
          UPDATE users
          SET name = ?, password_hash = ?, credential_hint = ?, is_active = 1,
              section = ?, institution = ?, institution_id = ?
          WHERE id = ?
        `).run(
          cleanName,
          hashPassword(cleanPassword),
          cleanPassword,
          cleanDept,
          resolvedInstName,
          resolvedInstId,
          facultyUserId
        );
      } else {
        facultyUserId = `user-faculty-${crypto.randomUUID().slice(0, 8)}`;
        db.prepare(`
          INSERT INTO users (
            id, name, email, password_hash, role, gender, batch_id,
            registration_number, section,
            is_active, must_reset_password, credential_hint, institution, institution_id, created_at
          ) VALUES (?, ?, ?, ?, 'faculty', NULL, NULL, NULL, ?, 1, 0, ?, ?, ?, ?)
        `).run(
          facultyUserId,
          cleanName,
          cleanEmail,
          hashPassword(cleanPassword),
          cleanDept,
          cleanPassword,
          resolvedInstName,
          resolvedInstId,
          new Date().toISOString()
        );
      }

      const authContext = getUserAuthContext(facultyUserId);
      res.status(201).json({
        message: 'Faculty account activated.',
        user: authContext
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to activate faculty account.'
      });
    }
  });

  // =========================================================
  // AUTHENTICATION ENDPOINTS
  // =========================================================
  app.post('/api/auth/login', (req: Request, res: Response) => {
    try {
      const { email, password, quickSwitch, expectedPortalRole } = req.body as {
        email?: string;
        password?: string;
        quickSwitch?: boolean;
        expectedPortalRole?: 'student' | 'br' | 'admin' | 'faculty';
      };

      if (!email || typeof email !== 'string') {
        res.status(400).json({ error: 'Institutional email is required.' });
        return;
      }

      const normalizedEmail = email.trim().toLowerCase();
      const userRow = db
        .prepare('SELECT * FROM users WHERE LOWER(email) = ?')
        .get(normalizedEmail) as
        | {
            id: string;
            role: VotingUserRole;
            password_hash: string;
            is_active: number;
          }
        | undefined;

      if (!userRow) {
        res.status(401).json({
          error: 'No institutional account found for this email address.'
        });
        return;
      }

      if (!userRow.is_active) {
        res.status(403).json({
          error: 'This account has been deactivated by the University Administrator.'
        });
        return;
      }

      // Enforce portal-specific role separation when logging in through a dedicated portal screen
      if (expectedPortalRole) {
        const actualRole = userRow.role;
        if (expectedPortalRole === 'admin' && actualRole !== 'admin') {
          res.status(403).json({
            error: `Access denied: This account is registered as a ${mapRoleToDisplayRole(actualRole)}, not an Administrator. Please use the ${mapRoleToDisplayRole(actualRole)} Login screen.`
          });
          return;
        }
        if (expectedPortalRole === 'br' && actualRole !== 'br') {
          res.status(403).json({
            error: `Access denied: This account is not a designated Batch Representative (BR) account. Only BR accounts issued by the Administrator can sign in here.`
          });
          return;
        }
        if (expectedPortalRole === 'faculty' && actualRole !== 'faculty') {
          res.status(403).json({
            error: `Access denied: This account is registered as a ${mapRoleToDisplayRole(actualRole)}, not Faculty. Please use the ${mapRoleToDisplayRole(actualRole)} Login screen.`
          });
          return;
        }
        if (expectedPortalRole === 'student' && actualRole !== 'student') {
          res.status(403).json({
            error: `This account is a ${mapRoleToDisplayRole(actualRole)} account. Please use the dedicated ${mapRoleToDisplayRole(actualRole)} Login option.`
          });
          return;
        }
      }

      const isPlaceholderDemoMask = password === '••••••••••••';
      if (!quickSwitch && !isPlaceholderDemoMask) {
        if (!password || !verifyPassword(password, userRow.password_hash)) {
          res.status(401).json({
            error: 'Invalid email or password. Please check your credentials.'
          });
          return;
        }
      }

      const authContext = getUserAuthContext(userRow.id);
      if (!authContext) {
        res.status(500).json({ error: 'Unable to load account context.' });
        return;
      }

      res.json({ user: authContext });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Login failed.'
      });
    }
  });

  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const authContext = getUserAuthContext(req.authUser!.userId);
    if (!authContext) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    res.json({ user: authContext });
  });

  app.patch('/api/auth/profile', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const authUser = req.authUser!;
      const { name, section, newPassword } = req.body as {
        name?: string;
        section?: string;
        newPassword?: string;
      };

      const cleanName = (name || '').trim();
      if (!cleanName || cleanName.length < 2) {
        res.status(400).json({ error: 'Name must be at least 2 characters long.' });
        return;
      }

      if (newPassword && newPassword.trim().length > 0) {
        if (newPassword.trim().length < 6) {
          res.status(400).json({ error: 'New password must be at least 6 characters long.' });
          return;
        }
        db.prepare(
          'UPDATE users SET name = ?, section = COALESCE(?, section), password_hash = ? WHERE id = ?'
        ).run(cleanName, section ? section.trim() : null, hashPassword(newPassword.trim()), authUser.userId);
      } else {
        db.prepare('UPDATE users SET name = ?, section = COALESCE(?, section) WHERE id = ?').run(
          cleanName,
          section ? section.trim() : null,
          authUser.userId
        );
      }

      const updated = getUserAuthContext(authUser.userId);
      res.json({
        message: 'Account profile updated.',
        user: updated
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to update profile.'
      });
    }
  });

  // =========================================================
  // VOTING OVERVIEW (Role-Filtered Polls, Batches & Stats)
  // =========================================================
  app.get('/api/voting/overview', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const authUser = req.authUser!;
      const polls = buildEnrichedPollsForUser(authUser);
      const userInstId = authUser.institutionId || 'inst-western-poly';

      const batches = db
        .prepare('SELECT * FROM batches WHERE institution_id = ? OR (institution_id IS NULL AND ? = "inst-western-poly") ORDER BY year DESC, code ASC')
        .all(userInstId, userInstId) as Array<{
        id: string;
        code: string;
        name: string;
        department_code: string;
        year: number;
        semester: number;
        student_count: number;
        created_at: string;
      }>;

      const activeAssignments = db
        .prepare(
          `SELECT a.id, a.batch_id, a.user_id, a.gender_role, a.is_active, a.assigned_by, a.assigned_at,
                  u.name as user_name, u.email as user_email, u.is_active as user_is_active,
                  u.credential_hint
           FROM br_assignments a
           JOIN users u ON u.id = a.user_id
           JOIN batches b ON b.id = a.batch_id
           WHERE a.is_active = 1 AND (b.institution_id = ? OR (b.institution_id IS NULL AND ? = 'inst-western-poly'))`
        )
        .all(userInstId, userInstId) as Array<{
        id: string;
        batch_id: string;
        user_id: string;
        gender_role: BrGenderRole;
        is_active: number;
        assigned_by: string;
        assigned_at: string;
        user_name: string;
        user_email: string;
        user_is_active: number;
        credential_hint: string | null;
      }>;

      // Aggregate distinct students and total votes cast per batch across all polls for Analytics
      const batchVoteAggRows = db
        .prepare(
          `SELECT batch_id,
                  COUNT(*) as total_votes_cast,
                  COUNT(DISTINCT student_user_id) as unique_voters
           FROM poll_votes
           GROUP BY batch_id`
        )
        .all() as Array<{
        batch_id: string;
        total_votes_cast: number;
        unique_voters: number;
      }>;

      const batchQuestionsAggRows = db
        .prepare(
          `SELECT batch_id,
                  COUNT(*) as total_questions,
                  SUM(CASE WHEN br_gender_role = 'male' THEN 1 ELSE 0 END) as male_br_questions,
                  SUM(CASE WHEN br_gender_role = 'female' THEN 1 ELSE 0 END) as female_br_questions
           FROM polls
           GROUP BY batch_id`
        )
        .all() as Array<{
        batch_id: string;
        total_questions: number;
        male_br_questions: number;
        female_br_questions: number;
      }>;

      const enrichedBatches = batches.map(b => {
        const maleBr = activeAssignments.find(
          a => a.batch_id === b.id && a.gender_role === 'male'
        );
        const femaleBr = activeAssignments.find(
          a => a.batch_id === b.id && a.gender_role === 'female'
        );
        const voteAgg = batchVoteAggRows.find(v => v.batch_id === b.id);
        const qAgg = batchQuestionsAggRows.find(q => q.batch_id === b.id);
        const totalVotesCast = voteAgg ? Number(voteAgg.total_votes_cast) : 0;
        const uniqueVoters = voteAgg ? Number(voteAgg.unique_voters) : 0;

        return {
          id: b.id,
          code: b.code,
          name: b.name,
          departmentCode: b.department_code,
          year: b.year,
          semester: b.semester,
          studentCount: b.student_count,
          totalVotesCast,
          uniqueVoters,
          questionsSubmitted: qAgg ? Number(qAgg.total_questions) : 0,
          maleBrQuestions: qAgg ? Number(qAgg.male_br_questions) : 0,
          femaleBrQuestions: qAgg ? Number(qAgg.female_br_questions) : 0,
          maleRepresentative: maleBr
            ? {
                assignmentId: maleBr.id,
                userId: maleBr.user_id,
                name: maleBr.user_name,
                email: maleBr.user_email,
                isActive: Boolean(maleBr.user_is_active),
                credentialHint: authUser.role === 'admin' ? maleBr.credential_hint : undefined,
                assignedAt: maleBr.assigned_at
              }
            : null,
          femaleRepresentative: femaleBr
            ? {
                assignmentId: femaleBr.id,
                userId: femaleBr.user_id,
                name: femaleBr.user_name,
                email: femaleBr.user_email,
                isActive: Boolean(femaleBr.user_is_active),
                credentialHint: authUser.role === 'admin' ? femaleBr.credential_hint : undefined,
                assignedAt: femaleBr.assigned_at
              }
            : null
        };
      });

      let brAccounts: Array<{
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
      }> = [];

      if (authUser.role === 'admin') {
        const rawBrUsers = db
          .prepare(
            `SELECT u.*, b.code as batch_code, b.name as batch_name,
                    (SELECT COUNT(*) FROM polls p WHERE p.submitted_by_user_id = u.id) as questions_count
             FROM users u
             LEFT JOIN batches b ON b.id = u.batch_id
             WHERE u.role = 'br'
               AND (u.institution_id = ? OR (u.institution_id IS NULL AND ? = 'inst-western-poly'))
             ORDER BY u.created_at DESC`
          )
          .all(userInstId, userInstId) as Array<{
          id: string;
          name: string;
          email: string;
          gender: BrGenderRole | null;
          batch_id: string | null;
          batch_code: string | null;
          batch_name: string | null;
          is_active: number;
          credential_hint: string | null;
          questions_count: number;
          created_at: string;
        }>;

        brAccounts = rawBrUsers.map(u => ({
          id: u.id,
          name: u.name,
          email: u.email,
          gender: u.gender,
          batchId: u.batch_id,
          batchCode: u.batch_code,
          batchName: u.batch_name,
          isActive: Boolean(u.is_active),
          hasActiveAssignment: activeAssignments.some(a => a.user_id === u.id),
          credentialHint: u.credential_hint,
          questionsSubmittedCount: Number(u.questions_count),
          createdAt: u.created_at
        }));
      }

      res.json({
        user: getUserAuthContext(authUser.userId),
        polls,
        batches: enrichedBatches,
        brAccounts
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to load voting overview.'
      });
    }
  });

  // =========================================================
  // STUDENT ENDPOINT: CAST VOTE (Strict One-Vote-Per-Question Transaction)
  // =========================================================
  app.post(
    '/api/voting/polls/:pollId/vote',
    requireAuth,
    requireRole('student'),
    (req: AuthenticatedRequest, res: Response) => {
      const { pollId } = req.params;
      const { optionId } = req.body as { optionId?: string };
      const authUser = req.authUser!;

      if (!optionId || typeof optionId !== 'string') {
        res.status(400).json({ error: 'Please select a valid answer option before voting.' });
        return;
      }

      const nowIso = new Date().toISOString();

      db.exec('BEGIN IMMEDIATE;');
      try {
        const poll = db
          .prepare('SELECT * FROM polls WHERE id = ?')
          .get(pollId) as
          | {
              id: string;
              status: PollStatus;
              batch_id: string;
              target_scope: 'all_batches' | 'submitting_batch';
              start_at: string | null;
              end_at: string | null;
            }
          | undefined;

        if (!poll) {
          db.exec('ROLLBACK;');
          res.status(404).json({ error: 'Voting question not found.' });
          return;
        }

        if (poll.status !== 'Published') {
          db.exec('ROLLBACK;');
          res.status(400).json({
            error: `Voting is not open for this question (current status: ${poll.status}).`
          });
          return;
        }

        if (poll.start_at && poll.start_at > nowIso) {
          db.exec('ROLLBACK;');
          res.status(400).json({ error: 'Voting for this question has not started yet.' });
          return;
        }

        if (poll.end_at && poll.end_at < nowIso) {
          db.prepare(
            `UPDATE polls SET status = 'Closed', closed_at = ?, updated_at = ? WHERE id = ?`
          ).run(nowIso, nowIso, pollId);
          db.exec('COMMIT;');
          res.status(400).json({ error: 'The voting deadline for this question has passed.' });
          return;
        }

        if (poll.target_scope === 'submitting_batch' && authUser.batchId !== poll.batch_id) {
          db.exec('ROLLBACK;');
          res.status(403).json({
            error: 'This poll is restricted to students of the submitting batch.'
          });
          return;
        }

        const optionRow = db
          .prepare('SELECT id, label FROM poll_options WHERE id = ? AND poll_id = ?')
          .get(optionId, pollId) as { id: string; label: string } | undefined;

        if (!optionRow) {
          db.exec('ROLLBACK;');
          res.status(400).json({ error: 'Selected option does not belong to this poll.' });
          return;
        }

        const existingVote = db
          .prepare('SELECT id FROM poll_votes WHERE poll_id = ? AND student_user_id = ?')
          .get(pollId, authUser.userId) as { id: string } | undefined;

        if (existingVote) {
          db.exec('ROLLBACK;');
          res.status(409).json({
            error: 'You have already voted on this question. Duplicate votes are not permitted.'
          });
          return;
        }

        const effectiveBatchId = authUser.batchId || poll.batch_id;
        const voteId = `vote-${crypto.randomUUID()}`;

        db.prepare(
          `INSERT INTO poll_votes (id, poll_id, option_id, student_user_id, batch_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).run(voteId, pollId, optionId, authUser.userId, effectiveBatchId, nowIso);

        db.exec('COMMIT;');

        const updatedPolls = buildEnrichedPollsForUser(authUser);
        const updatedPoll = updatedPolls.find(p => p.id === pollId);

        res.status(201).json({
          message: `Your vote for "${optionRow.label}" has been recorded.`,
          poll: updatedPoll
        });
      } catch (err) {
        try {
          db.exec('ROLLBACK;');
        } catch {}
        const msg = err instanceof Error ? err.message : 'Failed to record vote.';
        if (msg.includes('UNIQUE constraint failed')) {
          res.status(409).json({
            error: 'You have already voted on this question.'
          });
          return;
        }
        res.status(500).json({ error: msg });
      }
    }
  );

  // =========================================================
  // BATCH REPRESENTATIVE (BR) ENDPOINT: SUBMIT NEW QUESTION
  // =========================================================
  app.post(
    '/api/voting/br/polls',
    requireAuth,
    requireRole('br'),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const authUser = req.authUser!;

        const assignment = db
          .prepare(
            `SELECT a.batch_id, a.gender_role, b.code as batch_code, b.name as batch_name, u.name as user_name
             FROM br_assignments a
             JOIN batches b ON b.id = a.batch_id
             JOIN users u ON u.id = a.user_id
             WHERE a.user_id = ? AND a.is_active = 1`
          )
          .get(authUser.userId) as
          | {
              batch_id: string;
              gender_role: BrGenderRole;
              batch_code: string;
              batch_name: string;
              user_name: string;
            }
          | undefined;

        if (!assignment) {
          res.status(403).json({
            error:
              'You do not have an active Batch Representative assignment. Please contact the Administrator.'
          });
          return;
        }

        const {
          title,
          description,
          options,
          endAt,
          targetScope,
          requestedBatchId
        } = req.body as {
          title?: string;
          description?: string;
          options?: string[];
          endAt?: string | null;
          targetScope?: 'all_batches' | 'submitting_batch';
          requestedBatchId?: string;
        };

        if (requestedBatchId && requestedBatchId !== assignment.batch_id) {
          res.status(403).json({
            error: `Batch Representatives can only submit questions for their own assigned batch (${assignment.batch_code}).`
          });
          return;
        }

        const cleanTitle = (title || '').trim();
        const cleanDescription = (description || '').trim();

        if (cleanTitle.length < 5) {
          res.status(400).json({
            error: 'Question title must be at least 5 characters long.'
          });
          return;
        }

        if (cleanDescription.length < 10) {
          res.status(400).json({
            error: 'Please provide a clear question description or context (at least 10 characters).'
          });
          return;
        }

        if (!Array.isArray(options)) {
          res.status(400).json({
            error: 'At least two answer options are required.'
          });
          return;
        }

        const cleanOptions = options.map(o => String(o || '').trim()).filter(Boolean);
        if (cleanOptions.length < 2) {
          res.status(400).json({
            error: 'Please provide at least two non-empty answer options.'
          });
          return;
        }

        const uniqueOptions = new Set(cleanOptions.map(o => o.toLowerCase()));
        if (uniqueOptions.size !== cleanOptions.length) {
          res.status(400).json({
            error: 'Answer options must be distinct from one another.'
          });
          return;
        }

        const nowIso = new Date().toISOString();
        const pollId = `poll-${crypto.randomUUID()}`;
        const scope = targetScope === 'submitting_batch' ? 'submitting_batch' : 'all_batches';

        const userInstId = authUser.institutionId || 'inst-western-poly';

        db.exec('BEGIN IMMEDIATE;');
        try {
          db.prepare(
            `INSERT INTO polls (
              id, title, description, batch_id, target_scope,
              submitted_by_user_id, submitted_by_name, br_gender_role,
              status, rejection_reason, result_visibility,
              start_at, end_at, published_at, closed_at, institution_id, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending', NULL, 'after_vote', NULL, ?, NULL, NULL, ?, ?, ?)`
          ).run(
            pollId,
            cleanTitle,
            cleanDescription,
            assignment.batch_id,
            scope,
            authUser.userId,
            assignment.user_name,
            assignment.gender_role,
            endAt || null,
            userInstId,
            nowIso,
            nowIso
          );

          const insertOpt = db.prepare(
            `INSERT INTO poll_options (id, poll_id, label, sort_order) VALUES (?, ?, ?, ?)`
          );
          cleanOptions.forEach((label, idx) => {
            insertOpt.run(`opt-${crypto.randomUUID()}`, pollId, label, idx + 1);
          });

          db.exec('COMMIT;');
        } catch (err) {
          db.exec('ROLLBACK;');
          throw err;
        }

        const updatedPolls = buildEnrichedPollsForUser(authUser);
        const createdPoll = updatedPolls.find(p => p.id === pollId);

        res.status(201).json({
          message: 'Question submitted to the Administrator for review and approval.',
          poll: createdPoll
        });
      } catch (err) {
        res.status(500).json({
          error: err instanceof Error ? err.message : 'Failed to submit question.'
        });
      }
    }
  );

  // =========================================================
  // ADMIN ENDPOINTS: BATCHES, BR ACCOUNTS & QUESTION MODERATION
  // =========================================================

  app.post(
    '/api/voting/admin/batches',
    requireAuth,
    requireRole('admin'),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const { code, name, departmentCode, year, semester, studentCount } = req.body as {
          code?: string;
          name?: string;
          departmentCode?: string;
          year?: number;
          semester?: number;
          studentCount?: number;
        };

        const cleanCode = (code || '').trim().toUpperCase();
        const cleanName = (name || '').trim();
        const cleanDept = (departmentCode || 'BSCS').trim().toUpperCase();

        if (!cleanCode || !cleanName) {
          res.status(400).json({ error: 'Batch code and batch name are required.' });
          return;
        }

        const adminInstId = req.authUser!.institutionId || 'inst-western-poly';

        const existing = db
          .prepare('SELECT id FROM batches WHERE UPPER(code) = ? AND institution_id = ?')
          .get(cleanCode, adminInstId) as { id: string } | undefined;

        if (existing) {
          res.status(409).json({ error: `A batch with code "${cleanCode}" already exists in your university.` });
          return;
        }

        const batchId = `batch-${cleanCode.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString(36)}`;
        const nowIso = new Date().toISOString();

        db.prepare(
          `INSERT INTO batches (id, code, name, department_code, year, semester, student_count, institution_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          batchId,
          cleanCode,
          cleanName,
          cleanDept,
          Number(year) || 1,
          Number(semester) || 1,
          Math.max(1, Number(studentCount) || 60),
          adminInstId,
          nowIso
        );

        res.status(201).json({
          message: `Batch ${cleanCode} created.`,
          batchId
        });
      } catch (err) {
        res.status(500).json({
          error: err instanceof Error ? err.message : 'Failed to create batch.'
        });
      }
    }
  );

  app.post(
    '/api/voting/admin/br-accounts',
    requireAuth,
    requireRole('admin'),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const {
          name,
          email,
          password,
          batchId,
          genderRole,
          replaceExisting
        } = req.body as {
          name?: string;
          email?: string;
          password?: string;
          batchId?: string;
          genderRole?: BrGenderRole;
          replaceExisting?: boolean;
        };

        const cleanName = (name || '').trim();
        const cleanEmail = (email || '').trim().toLowerCase();
        const cleanPassword = (password || '').trim();

        if (!cleanName || !cleanEmail || !cleanPassword || !batchId || !genderRole) {
          res.status(400).json({
            error:
              'Full name, institutional email, password, target batch, and representative gender role (male/female) are required.'
          });
          return;
        }

        if (genderRole !== 'male' && genderRole !== 'female') {
          res.status(400).json({
            error: 'Representative role must be either "male" or "female".'
          });
          return;
        }

        if (cleanPassword.length < 6) {
          res.status(400).json({
            error: 'BR password must be at least 6 characters long.'
          });
          return;
        }

        const batchRow = db
          .prepare('SELECT id, code, name FROM batches WHERE id = ?')
          .get(batchId) as { id: string; code: string; name: string } | undefined;

        if (!batchRow) {
          res.status(404).json({ error: 'Selected batch does not exist.' });
          return;
        }

        const existingEmail = db
          .prepare('SELECT id FROM users WHERE LOWER(email) = ?')
          .get(cleanEmail) as { id: string } | undefined;

        if (existingEmail) {
          res.status(409).json({
            error: `An account with email "${cleanEmail}" already exists.`
          });
          return;
        }

        db.exec('BEGIN IMMEDIATE;');
        try {
          const existingSlotAssignment = db
            .prepare(
              `SELECT a.id, u.name as current_br_name
               FROM br_assignments a
               JOIN users u ON u.id = a.user_id
               WHERE a.batch_id = ? AND a.gender_role = ? AND a.is_active = 1`
            )
            .get(batchId, genderRole) as { id: string; current_br_name: string } | undefined;

          if (existingSlotAssignment) {
            if (!replaceExisting) {
              db.exec('ROLLBACK;');
              res.status(409).json({
                error: `Batch ${batchRow.code} already has an active ${genderRole} Batch Representative (${existingSlotAssignment.current_br_name}). Enable "Replace current ${genderRole} representative" or deactivate the existing assignment first.`
              });
              return;
            }
            db.prepare('UPDATE br_assignments SET is_active = 0 WHERE id = ?').run(
              existingSlotAssignment.id
            );
          }

          const nowIso = new Date().toISOString();
          const newUserId = `user-br-${genderRole}-${crypto.randomUUID().slice(0, 8)}`;
          const displayLabel = `${cleanName} (${genderRole === 'male' ? 'Male' : 'Female'} BR · ${batchRow.code})`;
          const adminInstId = req.authUser!.institutionId || 'inst-western-poly';
          const adminInstRow = db
            .prepare('SELECT name FROM institutions WHERE id = ?')
            .get(adminInstId) as { name: string } | undefined;
          const adminInstName = adminInstRow?.name || 'Western Polytechnic';

          db.prepare(
            `INSERT INTO users (
              id, name, email, password_hash, role, gender, batch_id,
              is_active, must_reset_password, credential_hint, institution, institution_id, created_at
            ) VALUES (?, ?, ?, ?, 'br', ?, ?, 1, 0, ?, ?, ?, ?)`
          ).run(
            newUserId,
            displayLabel,
            cleanEmail,
            hashPassword(cleanPassword),
            genderRole,
            batchId,
            cleanPassword,
            adminInstName,
            adminInstId,
            nowIso
          );

          db.prepare(
            `INSERT INTO br_assignments (id, batch_id, user_id, gender_role, is_active, assigned_by, assigned_at)
             VALUES (?, ?, ?, ?, 1, ?, ?)`
          ).run(
            `assign-${crypto.randomUUID().slice(0, 8)}`,
            batchId,
            newUserId,
            genderRole,
            req.authUser!.name,
            nowIso
          );

          db.exec('COMMIT;');

          res.status(201).json({
            message: `Created ${genderRole === 'male' ? 'Male' : 'Female'} Batch Representative account for ${batchRow.code}.`,
            issuedCredentials: {
              userId: newUserId,
              name: displayLabel,
              email: cleanEmail,
              password: cleanPassword,
              batchCode: batchRow.code,
              batchName: batchRow.name,
              genderRole
            }
          });
        } catch (err) {
          db.exec('ROLLBACK;');
          throw err;
        }
      } catch (err) {
        res.status(500).json({
          error: err instanceof Error ? err.message : 'Failed to create BR account.'
        });
      }
    }
  );

  app.patch(
    '/api/voting/admin/br-accounts/:userId',
    requireAuth,
    requireRole('admin'),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const { userId } = req.params;
        const { action, newPassword, batchId, genderRole } = req.body as {
          action: 'activate' | 'deactivate' | 'reset_password' | 'assign_slot';
          newPassword?: string;
          batchId?: string;
          genderRole?: BrGenderRole;
        };

        const brUser = db
          .prepare(`SELECT * FROM users WHERE id = ? AND role = 'br'`)
          .get(userId) as
          | {
              id: string;
              name: string;
              email: string;
              gender: BrGenderRole | null;
              batch_id: string | null;
              is_active: number;
            }
          | undefined;

        if (!brUser) {
          res.status(404).json({ error: 'Batch Representative account not found.' });
          return;
        }

        db.exec('BEGIN IMMEDIATE;');
        try {
          if (action === 'deactivate') {
            db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(userId);
            db.prepare('UPDATE br_assignments SET is_active = 0 WHERE user_id = ?').run(userId);
            db.exec('COMMIT;');
            res.json({ message: `Deactivated BR account "${brUser.name}".` });
            return;
          }

          if (action === 'activate') {
            db.prepare('UPDATE users SET is_active = 1 WHERE id = ?').run(userId);
            if (brUser.batch_id && brUser.gender) {
              db.prepare(
                'UPDATE br_assignments SET is_active = 0 WHERE batch_id = ? AND gender_role = ?'
              ).run(brUser.batch_id, brUser.gender);
              db.prepare(
                `INSERT INTO br_assignments (id, batch_id, user_id, gender_role, is_active, assigned_by, assigned_at)
                 VALUES (?, ?, ?, ?, 1, ?, ?)`
              ).run(
                `assign-${crypto.randomUUID().slice(0, 8)}`,
                brUser.batch_id,
                userId,
                brUser.gender,
                req.authUser!.name,
                new Date().toISOString()
              );
            }
            db.exec('COMMIT;');
            res.json({ message: `Activated BR account "${brUser.name}".` });
            return;
          }

          if (action === 'reset_password') {
            const cleanPass = (newPassword || '').trim();
            if (cleanPass.length < 6) {
              db.exec('ROLLBACK;');
              res.status(400).json({
                error: 'New password must be at least 6 characters long.'
              });
              return;
            }
            db.prepare(
              'UPDATE users SET password_hash = ?, credential_hint = ?, is_active = 1 WHERE id = ?'
            ).run(hashPassword(cleanPass), cleanPass, userId);
            db.exec('COMMIT;');
            res.json({
              message: `Password reset for "${brUser.name}".`,
              issuedCredentials: {
                name: brUser.name,
                email: brUser.email,
                password: cleanPass
              }
            });
            return;
          }

          if (action === 'assign_slot') {
            if (!batchId || !genderRole) {
              db.exec('ROLLBACK;');
              res.status(400).json({ error: 'batchId and genderRole are required.' });
              return;
            }
            db.prepare(
              'UPDATE br_assignments SET is_active = 0 WHERE batch_id = ? AND gender_role = ?'
            ).run(batchId, genderRole);
            db.prepare('UPDATE br_assignments SET is_active = 0 WHERE user_id = ?').run(userId);
            db.prepare('UPDATE users SET batch_id = ?, gender = ?, is_active = 1 WHERE id = ?').run(
              batchId,
              genderRole,
              userId
            );
            db.prepare(
              `INSERT INTO br_assignments (id, batch_id, user_id, gender_role, is_active, assigned_by, assigned_at)
               VALUES (?, ?, ?, ?, 1, ?, ?)`
            ).run(
              `assign-${crypto.randomUUID().slice(0, 8)}`,
              batchId,
              userId,
              genderRole,
              req.authUser!.name,
              new Date().toISOString()
            );
            db.exec('COMMIT;');
            res.json({ message: `Assigned "${brUser.name}" as ${genderRole} BR.` });
            return;
          }

          db.exec('ROLLBACK;');
          res.status(400).json({ error: 'Unsupported action.' });
        } catch (err) {
          db.exec('ROLLBACK;');
          throw err;
        }
      } catch (err) {
        res.status(500).json({
          error: err instanceof Error ? err.message : 'Failed to update BR account.'
        });
      }
    }
  );

  app.patch(
    '/api/voting/admin/polls/:pollId/status',
    requireAuth,
    requireRole('admin'),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const { pollId } = req.params;
        const {
          status,
          rejectionReason,
          resultVisibility,
          startAt,
          endAt,
          targetScope
        } = req.body as {
          status?: PollStatus;
          rejectionReason?: string;
          resultVisibility?: ResultVisibility;
          startAt?: string | null;
          endAt?: string | null;
          targetScope?: 'all_batches' | 'submitting_batch';
        };

        const existing = db
          .prepare('SELECT * FROM polls WHERE id = ?')
          .get(pollId) as
          | {
              id: string;
              status: PollStatus;
              result_visibility: ResultVisibility;
              start_at: string | null;
              end_at: string | null;
              published_at: string | null;
              closed_at: string | null;
              target_scope: 'all_batches' | 'submitting_batch';
            }
          | undefined;

        if (!existing) {
          res.status(404).json({ error: 'Question not found.' });
          return;
        }

        const nextStatus = status || existing.status;
        if (nextStatus === 'Rejected' && (!rejectionReason || !rejectionReason.trim())) {
          res.status(400).json({
            error: 'Please provide a rejection reason so the Batch Representative understands the feedback.'
          });
          return;
        }

        const nowIso = new Date().toISOString();
        const nextVisibility = resultVisibility || existing.result_visibility;
        const nextStartAt = startAt !== undefined ? startAt : existing.start_at;
        const nextEndAt = endAt !== undefined ? endAt : existing.end_at;
        const nextScope = targetScope || existing.target_scope;

        const publishedAt =
          nextStatus === 'Published' && !existing.published_at ? nowIso : existing.published_at;
        const closedAt =
          nextStatus === 'Closed' ? nowIso : nextStatus === 'Published' ? null : existing.closed_at;

        db.prepare(
          `UPDATE polls
           SET status = ?,
               rejection_reason = ?,
               result_visibility = ?,
               start_at = ?,
               end_at = ?,
               target_scope = ?,
               published_at = ?,
               closed_at = ?,
               updated_at = ?
           WHERE id = ?`
        ).run(
          nextStatus,
          nextStatus === 'Rejected' ? (rejectionReason || '').trim() : null,
          nextVisibility,
          nextStartAt,
          nextEndAt,
          nextScope,
          publishedAt,
          closedAt,
          nowIso,
          pollId
        );

        const updatedPolls = buildEnrichedPollsForUser(req.authUser!);
        const updatedPoll = updatedPolls.find(p => p.id === pollId);

        res.json({
          message: `Question status updated to ${nextStatus}.`,
          poll: updatedPoll
        });
      } catch (err) {
        res.status(500).json({
          error: err instanceof Error ? err.message : 'Failed to update question status.'
        });
      }
    }
  );

  app.delete(
    '/api/voting/admin/polls/:pollId',
    requireAuth,
    requireRole('admin'),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const { pollId } = req.params;
        const info = db.prepare('DELETE FROM polls WHERE id = ?').run(pollId);
        if (info.changes === 0) {
          res.status(404).json({ error: 'Question not found.' });
          return;
        }
        res.json({ message: 'Question permanently removed.' });
      } catch (err) {
        res.status(500).json({
          error: err instanceof Error ? err.message : 'Failed to delete question.'
        });
      }
    }
  );

  // =========================================================
  // VITE DEV MIDDLEWARE OR PRODUCTION STATIC ASSETS
  // =========================================================
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SmartGrid AI Server + Voting Engine listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
