import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export type VotingUserRole = 'admin' | 'br' | 'student' | 'faculty';
export type BrGenderRole = 'male' | 'female';
export type PollStatus = 'Pending' | 'Approved' | 'Rejected' | 'Published' | 'Closed';
export type ResultVisibility = 'always' | 'after_vote' | 'after_close';

export interface DbUserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: VotingUserRole;
  gender: BrGenderRole | null;
  batch_id: string | null;
  registration_number: string | null;
  section: string | null;
  is_active: number;
  must_reset_password: number;
  credential_hint: string | null;
  institution: string;
  institution_id?: string;
  created_at: string;
}

export interface AuthTokenPayload {
  userId: string;
  email: string;
  name: string;
  role: VotingUserRole;
  institutionId?: string;
  batchId: string | null;
  brGenderRole: BrGenderRole | null;
  exp: number;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'smartgrid_voting.sqlite');
export const db = new DatabaseSync(DB_PATH);

// Enable WAL and Foreign Keys for high concurrency and referential integrity
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

const TOKEN_SECRET =
  process.env.SMARTGRID_AUTH_SECRET || 'smartgrid-institutional-voting-hmac-secret-2026';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

export function signAuthToken(payload: Omit<AuthTokenPayload, 'exp'>): string {
  const fullPayload: AuthTokenPayload = {
    ...payload,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7 // 7 days
  };
  const body = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyAuthToken(token: string): AuthTokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [body, sig] = parts;
    const expectedSig = crypto
      .createHmac('sha256', TOKEN_SECRET)
      .update(body)
      .digest('base64url');
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }
    const decoded = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as AuthTokenPayload;
    if (decoded.exp < Date.now()) return null;
    return decoded;
  } catch {
    return null;
  }
}

export function initializeVotingDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS batches (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      department_code TEXT NOT NULL,
      year INTEGER NOT NULL,
      semester INTEGER NOT NULL,
      student_count INTEGER NOT NULL DEFAULT 50,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'br', 'student', 'faculty')),
      gender TEXT CHECK(gender IN ('male', 'female')),
      batch_id TEXT REFERENCES batches(id) ON DELETE SET NULL,
      registration_number TEXT,
      section TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      must_reset_password INTEGER NOT NULL DEFAULT 0,
      credential_hint TEXT,
      institution TEXT NOT NULL DEFAULT 'Western Polytechnic',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS br_assignments (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      gender_role TEXT NOT NULL CHECK(gender_role IN ('male', 'female')),
      is_active INTEGER NOT NULL DEFAULT 1,
      assigned_by TEXT NOT NULL,
      assigned_at TEXT NOT NULL
    );

    -- Enforce at most ONE active Male BR and ONE active Female BR per batch at the database level
    CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_br_slot
      ON br_assignments(batch_id, gender_role)
      WHERE is_active = 1;

    -- Enforce that a BR user can only hold one active BR assignment at a time
    CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_br_user
      ON br_assignments(user_id)
      WHERE is_active = 1;

    CREATE TABLE IF NOT EXISTS polls (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      batch_id TEXT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
      target_scope TEXT NOT NULL DEFAULT 'all_batches' CHECK(target_scope IN ('all_batches', 'submitting_batch')),
      submitted_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      submitted_by_name TEXT NOT NULL,
      br_gender_role TEXT NOT NULL CHECK(br_gender_role IN ('male', 'female')),
      status TEXT NOT NULL CHECK(status IN ('Pending', 'Approved', 'Rejected', 'Published', 'Closed')),
      rejection_reason TEXT,
      result_visibility TEXT NOT NULL DEFAULT 'after_vote' CHECK(result_visibility IN ('always', 'after_vote', 'after_close')),
      start_at TEXT,
      end_at TEXT,
      published_at TEXT,
      closed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_polls_status ON polls(status);
    CREATE INDEX IF NOT EXISTS idx_polls_batch ON polls(batch_id);
    CREATE INDEX IF NOT EXISTS idx_polls_submitter ON polls(submitted_by_user_id);

    CREATE TABLE IF NOT EXISTS poll_options (
      id TEXT PRIMARY KEY,
      poll_id TEXT NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      sort_order INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_poll_options_poll ON poll_options(poll_id);

    CREATE TABLE IF NOT EXISTS poll_votes (
      id TEXT PRIMARY KEY,
      poll_id TEXT NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
      option_id TEXT NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
      student_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      batch_id TEXT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      UNIQUE(poll_id, student_user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_poll_votes_poll ON poll_votes(poll_id);
    CREATE INDEX IF NOT EXISTS idx_poll_votes_student ON poll_votes(student_user_id);
    CREATE INDEX IF NOT EXISTS idx_poll_votes_batch ON poll_votes(batch_id);
  `);

  // Safe migration for existing SQLite databases created before registration_number and section were added
  const userColumns = db.prepare(`PRAGMA table_info(users)`).all() as Array<{ name: string }>;
  const hasRegNumber = userColumns.some(c => c.name === 'registration_number');
  if (!hasRegNumber) {
    db.exec(`ALTER TABLE users ADD COLUMN registration_number TEXT;`);
  }
  const hasSection = userColumns.some(c => c.name === 'section');
  if (!hasSection) {
    db.exec(`ALTER TABLE users ADD COLUMN section TEXT;`);
  }

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_student_reg_number
      ON users(UPPER(registration_number))
      WHERE registration_number IS NOT NULL AND registration_number != '';
  `);

  // Ensure existing seeded students have registration numbers and sections populated
  db.prepare(
    `UPDATE users SET registration_number = '2K25-BSCS-014', section = 'Section A' WHERE id = 'user-student-maya' AND (registration_number IS NULL OR registration_number = '')`
  ).run();
  db.prepare(
    `UPDATE users SET registration_number = '2K25-BSCS-028', section = 'Section B' WHERE id = 'user-student-ahmed' AND (registration_number IS NULL OR registration_number = '')`
  ).run();
  db.prepare(
    `UPDATE users SET registration_number = '2K24-BESE-009', section = 'Section A' WHERE id = 'user-student-sara' AND (registration_number IS NULL OR registration_number = '')`
  ).run();
  db.prepare(
    `UPDATE users SET registration_number = '2K24-BESE-033', section = 'Section B' WHERE id = 'user-student-daniyal' AND (registration_number IS NULL OR registration_number = '')`
  ).run();
  db.prepare(
    `UPDATE users SET registration_number = '2K24-BEE-019', section = 'Section A' WHERE id = 'user-student-usman' AND (registration_number IS NULL OR registration_number = '')`
  ).run();
  db.prepare(
    `UPDATE users SET registration_number = '2K24-BEE-044', section = 'Section B' WHERE id = 'user-student-hira' AND (registration_number IS NULL OR registration_number = '')`
  ).run();
  db.prepare(
    `UPDATE users SET registration_number = '2K25-BCE-012', section = 'Section A' WHERE id = 'user-student-rayyan' AND (registration_number IS NULL OR registration_number = '')`
  ).run();
  db.prepare(
    `UPDATE users SET registration_number = '2K26-BSCS-005', section = 'Section A' WHERE id = 'user-student-zoya' AND (registration_number IS NULL OR registration_number = '')`
  ).run();

  // Safe migration for multi-university tenant architecture
  db.exec(`
    CREATE TABLE IF NOT EXISTS institutions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      campus_name TEXT,
      accreditation TEXT,
      academic_year TEXT DEFAULT '2026–2027',
      current_term TEXT DEFAULT 'Fall Semester 2026',
      working_days TEXT DEFAULT 'Mon,Tue,Wed,Thu,Fri',
      day_start_time TEXT DEFAULT '09:00',
      day_end_time TEXT DEFAULT '17:00',
      period_length_minutes INTEGER DEFAULT 50,
      short_break_minutes INTEGER DEFAULT 10,
      midday_break_enabled INTEGER DEFAULT 1,
      midday_break_start TEXT DEFAULT '13:00',
      midday_break_duration INTEGER DEFAULT 60,
      lab_duration_minutes INTEGER DEFAULT 180,
      logo_url TEXT,
      timezone TEXT DEFAULT 'UTC',
      is_sample INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS institution_data (
      institution_id TEXT PRIMARY KEY REFERENCES institutions(id) ON DELETE CASCADE,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  const uCols = db.prepare(`PRAGMA table_info(users)`).all() as Array<{ name: string }>;
  if (!uCols.some(c => c.name === 'institution_id')) {
    db.exec(`ALTER TABLE users ADD COLUMN institution_id TEXT;`);
    db.exec(`UPDATE users SET institution_id = 'inst-western-poly';`);
  }

  const bCols = db.prepare(`PRAGMA table_info(batches)`).all() as Array<{ name: string }>;
  if (!bCols.some(c => c.name === 'institution_id')) {
    db.exec(`ALTER TABLE batches ADD COLUMN institution_id TEXT;`);
    db.exec(`UPDATE batches SET institution_id = 'inst-western-poly';`);
  }

  const pCols = db.prepare(`PRAGMA table_info(polls)`).all() as Array<{ name: string }>;
  if (!pCols.some(c => c.name === 'institution_id')) {
    db.exec(`ALTER TABLE polls ADD COLUMN institution_id TEXT;`);
    db.exec(`UPDATE polls SET institution_id = 'inst-western-poly';`);
  }

  // Ensure inst-western-poly exists in institutions
  db.prepare(`
    INSERT OR IGNORE INTO institutions (
      id, name, code, campus_name, accreditation, academic_year, current_term,
      working_days, day_start_time, day_end_time, period_length_minutes, short_break_minutes,
      midday_break_enabled, midday_break_start, midday_break_duration, lab_duration_minutes,
      timezone, is_sample, created_at
    ) VALUES (
      'inst-western-poly', 'Western Polytechnic Institute', 'WPI', 'Main Academic Complex',
      'PEC & NCEAC Accredited (Engineering & Computing)', '2026–2027', 'Fall Semester 2026',
      'Mon,Tue,Wed,Thu,Fri', '09:00', '17:00', 50, 10, 1, '13:00', 60, 180,
      'Asia/Karachi (PKT)', 1, datetime('now')
    )
  `).run();

  // Ensure inst-apex-tech exists in institutions (Distinct University B)
  db.prepare(`
    INSERT OR IGNORE INTO institutions (
      id, name, code, campus_name, accreditation, academic_year, current_term,
      working_days, day_start_time, day_end_time, period_length_minutes, short_break_minutes,
      midday_break_enabled, midday_break_start, midday_break_duration, lab_duration_minutes,
      timezone, is_sample, created_at
    ) VALUES (
      'inst-apex-tech', 'Apex Institute of Science & Technology', 'AIST', 'Downtown Innovation Campus',
      'ABET & National Board of Accreditation (NBA)', '2026–2027', 'Spring Semester 2026',
      'Mon,Tue,Wed,Thu,Fri,Sat', '08:30', '16:30', 60, 15, 1, '12:15', 45, 120,
      'America/New_York (EST)', 0, datetime('now')
    )
  `).run();

  // Backfill institution_id on existing users and batches where null
  db.prepare(`UPDATE users SET institution_id = 'inst-western-poly' WHERE institution_id IS NULL OR institution_id = ''`).run();
  db.prepare(`UPDATE batches SET institution_id = 'inst-western-poly' WHERE institution_id IS NULL OR institution_id = ''`).run();
  db.prepare(`UPDATE polls SET institution_id = 'inst-western-poly' WHERE institution_id IS NULL OR institution_id = ''`).run();

  seedInitialVotingData();
  seedMissingFacultyAccounts();
  seedApexInstituteData();
}

function seedMissingFacultyAccounts(): void {
  try {
    const insertUser = db.prepare(`
      INSERT OR IGNORE INTO users (
        id, name, email, password_hash, role, gender, batch_id,
        registration_number, section,
        is_active, must_reset_password, credential_hint, institution, institution_id, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Western Polytechnic', 'inst-western-poly', datetime('now'))
    `);

    insertUser.run(
      'user-faculty-jehanzeb',
      'Dr. Jehanzeb Ahmad',
      'jehanzeb.ahmad@westernpoly.edu',
      hashPassword('Faculty@2026'),
      'faculty',
      'male',
      null,
      null,
      null,
      1,
      0,
      'Faculty@2026'
    );

    insertUser.run(
      'user-faculty-turing',
      'Prof. Alan Turing',
      'a.turing@westernpoly.edu',
      hashPassword('Faculty@2026'),
      'faculty',
      'male',
      null,
      null,
      null,
      1,
      0,
      'Faculty@2026'
    );
  } catch (err) {
    console.warn('Faculty seeding notice:', err);
  }
}

function seedApexInstituteData(): void {
  try {
    // 1. Seed Batches for Apex Institute
    const insertBatch = db.prepare(`
      INSERT OR IGNORE INTO batches (id, code, name, department_code, year, semester, student_count, institution_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'inst-apex-tech', datetime('now'))
    `);

    insertBatch.run('batch-apex-2k25-bme', '2K25-BME', 'BS Mechanical Engineering — Batch 2K25', 'BME', 2, 4, 85);
    insertBatch.run('batch-apex-2k25-bsds', '2K25-BSDS', 'BS Data Science — Batch 2K25', 'BSDS', 2, 4, 95);

    // 2. Seed Users for Apex Institute (Admin, Faculty, Male & Female BRs, Students)
    const insertUser = db.prepare(`
      INSERT OR IGNORE INTO users (
        id, name, email, password_hash, role, gender, batch_id,
        registration_number, section,
        is_active, must_reset_password, credential_hint, institution, institution_id, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Apex Institute of Science & Technology', 'inst-apex-tech', datetime('now'))
    `);

    // Apex Admin
    insertUser.run(
      'user-apex-admin',
      'Dr. Arthur Vance',
      'admin@apextech.edu',
      hashPassword('Admin@2026'),
      'admin',
      'male',
      null,
      null,
      null,
      1,
      0,
      'Admin@2026'
    );

    // Apex Faculty
    insertUser.run(
      'user-apex-vance',
      'Dr. Marcus Vance',
      'm.vance@apextech.edu',
      hashPassword('Faculty@2026'),
      'faculty',
      'male',
      null,
      null,
      null,
      1,
      0,
      'Faculty@2026'
    );

    insertUser.run(
      'user-apex-rostova',
      'Prof. Elena Rostova',
      'e.rostova@apextech.edu',
      hashPassword('Faculty@2026'),
      'faculty',
      'female',
      null,
      null,
      null,
      1,
      0,
      'Faculty@2026'
    );

    // Apex Male BR
    insertUser.run(
      'user-apex-br-liam',
      'Liam Chen',
      'br.male@apextech.edu',
      hashPassword('BR@2026'),
      'br',
      'male',
      'batch-apex-2k25-bme',
      '2K25-BME-002',
      'Section A',
      1,
      0,
      'BR@2026'
    );

    // Apex Female BR
    insertUser.run(
      'user-apex-br-aria',
      'Aria Thorne',
      'br.female@apextech.edu',
      hashPassword('BR@2026'),
      'br',
      'female',
      'batch-apex-2k25-bsds',
      '2K25-BSDS-003',
      'Section A',
      1,
      0,
      'BR@2026'
    );

    // Apex Student
    insertUser.run(
      'user-apex-student-alex',
      'Alex Rivera',
      'student.alex@apextech.edu',
      hashPassword('Student@2026'),
      'student',
      'male',
      'batch-apex-2k25-bme',
      '2K25-BME-001',
      'Section A',
      1,
      0,
      'Student@2026'
    );

    // 3. Seed BR assignments
    const insertAssign = db.prepare(`
      INSERT OR IGNORE INTO br_assignments (id, batch_id, user_id, gender_role, is_active, assigned_by, assigned_at)
      VALUES (?, ?, ?, ?, 1, 'user-apex-admin', datetime('now'))
    `);
    insertAssign.run('assign-apex-liam', 'batch-apex-2k25-bme', 'user-apex-br-liam', 'male');
    insertAssign.run('assign-apex-aria', 'batch-apex-2k25-bsds', 'user-apex-br-aria', 'female');

    // 4. Seed Poll for Apex
    const insertPoll = db.prepare(`
      INSERT OR IGNORE INTO polls (
        id, title, description, batch_id, target_scope,
        submitted_by_user_id, submitted_by_name, br_gender_role,
        status, result_visibility, start_at, end_at, published_at, institution_id, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, 'all_batches', ?, ?, ?, 'Published', 'after_vote', datetime('now', '-1 day'), datetime('now', '+5 days'), datetime('now', '-1 day'), 'inst-apex-tech', datetime('now', '-1 day'), datetime('now'))
    `);
    insertPoll.run(
      'poll-apex-gpu-lab',
      'Extend Saturday High-Performance GPU Cluster Hours for Capstone AI',
      'Proposal to extend Ada-DS1 high-performance cluster access until 18:30 on Saturdays for senior robotics and machine learning research.',
      'batch-apex-2k25-bsds',
      'user-apex-br-aria',
      'Aria Thorne',
      'female'
    );

    const insertOption = db.prepare(`
      INSERT OR IGNORE INTO poll_options (id, poll_id, label, sort_order)
      VALUES (?, ?, ?, ?)
    `);
    insertOption.run('opt-apex-gpu-1', 'poll-apex-gpu-lab', 'Approve Saturday Extension to 18:30', 1);
    insertOption.run('opt-apex-gpu-2', 'poll-apex-gpu-lab', 'Keep Standard 16:30 Saturday Close', 2);
  } catch (err) {
    console.warn('Apex seeding notice:', err);
  }
}

function seedInitialVotingData(): void {
  const existingBatchCount = db
    .prepare('SELECT COUNT(*) as cnt FROM batches')
    .get() as { cnt: number };
  if (existingBatchCount.cnt > 0) {
    return;
  }

  const now = new Date();
  const isoNow = now.toISOString();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const inFiveDays = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString();
  const inSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

  db.exec('BEGIN IMMEDIATE;');
  try {
    // 1. Seed University Batches aligned with existing departments (BSCS, BESE, BEE, BCE)
    const batches = [
      {
        id: 'batch-2k25-bscs',
        code: '2K25-BSCS',
        name: 'BS Computer Science — Batch 2K25',
        department_code: 'BSCS',
        year: 2,
        semester: 3,
        student_count: 110
      },
      {
        id: 'batch-2k24-bese',
        code: '2K24-BESE',
        name: 'BE Software Engineering — Batch 2K24',
        department_code: 'BESE',
        year: 3,
        semester: 5,
        student_count: 95
      },
      {
        id: 'batch-2k24-bee',
        code: '2K24-BEE',
        name: 'BE Electrical Engineering — Batch 2K24',
        department_code: 'BEE',
        year: 3,
        semester: 5,
        student_count: 105
      },
      {
        id: 'batch-2k25-bce',
        code: '2K25-BCE',
        name: 'BE Computer Systems Engineering — Batch 2K25',
        department_code: 'BCE',
        year: 2,
        semester: 3,
        student_count: 90
      },
      {
        id: 'batch-2k26-bscs',
        code: '2K26-BSCS',
        name: 'BS Computer Science — Batch 2K26',
        department_code: 'BSCS',
        year: 1,
        semester: 1,
        student_count: 120
      }
    ];

    const insertBatch = db.prepare(`
      INSERT INTO batches (id, code, name, department_code, year, semester, student_count, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const b of batches) {
      insertBatch.run(
        b.id,
        b.code,
        b.name,
        b.department_code,
        b.year,
        b.semester,
        b.student_count,
        threeDaysAgo
      );
    }

    // 2. Seed Users (Admin, Faculty, Male & Female BRs, and Students across batches)
    const insertUser = db.prepare(`
      INSERT INTO users (
        id, name, email, password_hash, role, gender, batch_id,
        registration_number, section,
        is_active, must_reset_password, credential_hint, institution, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Western Polytechnic', ?)
    `);

    // Admin account
    insertUser.run(
      'user-admin-reynolds',
      'Dr. Katherine Reynolds',
      'k.reynolds@westernpoly.edu',
      hashPassword('Admin@2026'),
      'admin',
      'female',
      null,
      null,
      null,
      1,
      0,
      'Admin@2026',
      threeDaysAgo
    );

    // Faculty account
    insertUser.run(
      'user-faculty-turing',
      'Prof. Alan Turing',
      'a.turing@westernpoly.edu',
      hashPassword('Faculty@2026'),
      'faculty',
      'male',
      null,
      null,
      null,
      1,
      0,
      'Faculty@2026',
      threeDaysAgo
    );

    insertUser.run(
      'user-faculty-jehanzeb',
      'Dr. Jehanzeb Ahmad',
      'jehanzeb.ahmad@westernpoly.edu',
      hashPassword('Faculty@2026'),
      'faculty',
      'male',
      null,
      null,
      null,
      1,
      0,
      'Faculty@2026',
      threeDaysAgo
    );

    // Batch Representatives (Male + Female for each major batch)
    const brUsers = [
      {
        id: 'user-br-male-2k25-bscs',
        name: 'Hamza Tariq (Male BR · 2K25-BSCS)',
        email: 'br.male.2k25bscs@westernpoly.edu',
        pass: 'BR-2K25CS-M!',
        gender: 'male' as const,
        batchId: 'batch-2k25-bscs',
        regNo: '2K25-BSCS-BR01',
        section: 'Section A'
      },
      {
        id: 'user-br-female-2k25-bscs',
        name: 'Aisha Siddiqui (Female BR · 2K25-BSCS)',
        email: 'br.female.2k25bscs@westernpoly.edu',
        pass: 'BR-2K25CS-F!',
        gender: 'female' as const,
        batchId: 'batch-2k25-bscs',
        regNo: '2K25-BSCS-BR02',
        section: 'Section A'
      },
      {
        id: 'user-br-male-2k24-bese',
        name: 'Zain Ul Abideen (Male BR · 2K24-BESE)',
        email: 'br.male.2k24bese@westernpoly.edu',
        pass: 'BR-2K24SE-M!',
        gender: 'male' as const,
        batchId: 'batch-2k24-bese',
        regNo: '2K24-BESE-BR01',
        section: 'Section A'
      },
      {
        id: 'user-br-female-2k24-bese',
        name: 'Fatima Noor (Female BR · 2K24-BESE)',
        email: 'br.female.2k24bese@westernpoly.edu',
        pass: 'BR-2K24SE-F!',
        gender: 'female' as const,
        batchId: 'batch-2k24-bese',
        regNo: '2K24-BESE-BR02',
        section: 'Section B'
      },
      {
        id: 'user-br-male-2k24-bee',
        name: 'Bilal Mahmood (Male BR · 2K24-BEE)',
        email: 'br.male.2k24bee@westernpoly.edu',
        pass: 'BR-2K24EE-M!',
        gender: 'male' as const,
        batchId: 'batch-2k24-bee',
        regNo: '2K24-BEE-BR01',
        section: 'Section A'
      },
      {
        id: 'user-br-female-2k24-bee',
        name: 'Sana Javed (Female BR · 2K24-BEE)',
        email: 'br.female.2k24bee@westernpoly.edu',
        pass: 'BR-2K24EE-F!',
        gender: 'female' as const,
        batchId: 'batch-2k24-bee',
        regNo: '2K24-BEE-BR02',
        section: 'Section B'
      },
      {
        id: 'user-br-male-2k25-bce',
        name: 'Omar Farooq (Male BR · 2K25-BCE)',
        email: 'br.male.2k25bce@westernpoly.edu',
        pass: 'BR-2K25CE-M!',
        gender: 'male' as const,
        batchId: 'batch-2k25-bce',
        regNo: '2K25-BCE-BR01',
        section: 'Section A'
      }
    ];

    const insertBrAssignment = db.prepare(`
      INSERT INTO br_assignments (id, batch_id, user_id, gender_role, is_active, assigned_by, assigned_at)
      VALUES (?, ?, ?, ?, 1, 'Dr. Katherine Reynolds', ?)
    `);

    for (const br of brUsers) {
      insertUser.run(
        br.id,
        br.name,
        br.email,
        hashPassword(br.pass),
        'br',
        br.gender,
        br.batchId,
        br.regNo,
        br.section,
        1,
        0,
        br.pass,
        threeDaysAgo
      );
      insertBrAssignment.run(
        `assign-${br.id}`,
        br.batchId,
        br.id,
        br.gender,
        threeDaysAgo
      );
    }

    // Seed Students across batches
    const studentUsers = [
      {
        id: 'user-student-maya',
        name: 'Maya Lin',
        email: 'm.lin@westernpoly.edu',
        gender: 'female' as const,
        batchId: 'batch-2k25-bscs',
        regNo: '2K25-BSCS-014',
        section: 'Section A'
      },
      {
        id: 'user-student-ahmed',
        name: 'Ahmed Raza',
        email: 'a.raza@westernpoly.edu',
        gender: 'male' as const,
        batchId: 'batch-2k25-bscs',
        regNo: '2K25-BSCS-028',
        section: 'Section B'
      },
      {
        id: 'user-student-sara',
        name: 'Sara Khan',
        email: 's.khan@westernpoly.edu',
        gender: 'female' as const,
        batchId: 'batch-2k24-bese',
        regNo: '2K24-BESE-009',
        section: 'Section A'
      },
      {
        id: 'user-student-daniyal',
        name: 'Daniyal Sheikh',
        email: 'd.sheikh@westernpoly.edu',
        gender: 'male' as const,
        batchId: 'batch-2k24-bese',
        regNo: '2K24-BESE-033',
        section: 'Section B'
      },
      {
        id: 'user-student-usman',
        name: 'Usman Ali',
        email: 'u.ali@westernpoly.edu',
        gender: 'male' as const,
        batchId: 'batch-2k24-bee',
        regNo: '2K24-BEE-019',
        section: 'Section A'
      },
      {
        id: 'user-student-hira',
        name: 'Hira Malik',
        email: 'h.malik@westernpoly.edu',
        gender: 'female' as const,
        batchId: 'batch-2k24-bee',
        regNo: '2K24-BEE-044',
        section: 'Section B'
      },
      {
        id: 'user-student-rayyan',
        name: 'Rayyan Qureshi',
        email: 'r.qureshi@westernpoly.edu',
        gender: 'male' as const,
        batchId: 'batch-2k25-bce',
        regNo: '2K25-BCE-012',
        section: 'Section A'
      },
      {
        id: 'user-student-zoya',
        name: 'Zoya Hassan',
        email: 'z.hassan@westernpoly.edu',
        gender: 'female' as const,
        batchId: 'batch-2k26-bscs',
        regNo: '2K26-BSCS-005',
        section: 'Section A'
      }
    ];

    for (const st of studentUsers) {
      insertUser.run(
        st.id,
        st.name,
        st.email,
        hashPassword('Student@2026'),
        'student',
        st.gender,
        st.batchId,
        st.regNo,
        st.section,
        1,
        0,
        'Student@2026',
        threeDaysAgo
      );
    }

    // 3. Seed Polls across Published, Upcoming, Closed, Pending, Approved, and Rejected states
    const insertPoll = db.prepare(`
      INSERT INTO polls (
        id, title, description, batch_id, target_scope,
        submitted_by_user_id, submitted_by_name, br_gender_role,
        status, rejection_reason, result_visibility,
        start_at, end_at, published_at, closed_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertOption = db.prepare(`
      INSERT INTO poll_options (id, poll_id, label, sort_order)
      VALUES (?, ?, ?, ?)
    `);

    const insertVote = db.prepare(`
      INSERT INTO poll_votes (id, poll_id, option_id, student_user_id, batch_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    // Poll 1: ACTIVE / PUBLISHED (Maya Lin has NOT voted yet -> ready to test live voting!)
    insertPoll.run(
      'poll-1-friday-labs',
      'Preferred Continuous 3-Hour Lab Slot on Fridays',
      'To prevent Friday afternoon overlap with inter-departmental societies and Jummah prayers, which continuous 3-hour slot should the timetable engine prioritize for Friday laboratory sections?',
      'batch-2k25-bscs',
      'all_batches',
      'user-br-male-2k25-bscs',
      'Hamza Tariq (Male BR · 2K25-BSCS)',
      'male',
      'Published',
      null,
      'after_vote',
      twoDaysAgo,
      inFiveDays,
      twoDaysAgo,
      null,
      twoDaysAgo,
      twoDaysAgo
    );
    insertOption.run('opt-p1-1', 'poll-1-friday-labs', 'Morning Block (09:00 AM – 12:00 PM)', 1);
    insertOption.run('opt-p1-2', 'poll-1-friday-labs', 'Post-Break Afternoon Block (02:00 PM – 05:00 PM)', 2);
    insertOption.run('opt-p1-3', 'poll-1-friday-labs', 'Move Friday Labs to Thursday Afternoon where room capacity permits', 3);

    insertVote.run('vote-p1-1', 'poll-1-friday-labs', 'opt-p1-1', 'user-student-ahmed', 'batch-2k25-bscs', yesterday);
    insertVote.run('vote-p1-2', 'poll-1-friday-labs', 'opt-p1-1', 'user-student-sara', 'batch-2k24-bese', yesterday);
    insertVote.run('vote-p1-3', 'poll-1-friday-labs', 'opt-p1-3', 'user-student-daniyal', 'batch-2k24-bese', yesterday);
    insertVote.run('vote-p1-4', 'poll-1-friday-labs', 'opt-p1-1', 'user-student-usman', 'batch-2k24-bee', yesterday);
    insertVote.run('vote-p1-5', 'poll-1-friday-labs', 'opt-p1-2', 'user-student-hira', 'batch-2k24-bee', yesterday);
    insertVote.run('vote-p1-6', 'poll-1-friday-labs', 'opt-p1-1', 'user-student-rayyan', 'batch-2k25-bce', yesterday);

    // Poll 2: ACTIVE / PUBLISHED
    insertPoll.run(
      'poll-2-elective-track',
      'Fall 2026 Senior Technical Elective Cluster Preference',
      'Which technical elective cluster should be scheduled in conflict-free morning slots for inter-batch enrollment?',
      'batch-2k24-bese',
      'all_batches',
      'user-br-female-2k24-bese',
      'Fatima Noor (Female BR · 2K24-BESE)',
      'female',
      'Published',
      null,
      'always',
      twoDaysAgo,
      inSevenDays,
      twoDaysAgo,
      null,
      twoDaysAgo,
      twoDaysAgo
    );
    insertOption.run('opt-p2-1', 'poll-2-elective-track', 'Cloud Native Architecture & DevOps Engineering', 1);
    insertOption.run('opt-p2-2', 'poll-2-elective-track', 'Applied Machine Learning & Computer Vision', 2);
    insertOption.run('opt-p2-3', 'poll-2-elective-track', 'Cybersecurity & Distributed Systems Security', 3);
    insertOption.run('opt-p2-4', 'poll-2-elective-track', 'Embedded IoT & Real-Time Robotics', 4);

    insertVote.run('vote-p2-1', 'poll-2-elective-track', 'opt-p2-2', 'user-student-ahmed', 'batch-2k25-bscs', yesterday);
    insertVote.run('vote-p2-2', 'poll-2-elective-track', 'opt-p2-2', 'user-student-sara', 'batch-2k24-bese', yesterday);
    insertVote.run('vote-p2-3', 'poll-2-elective-track', 'opt-p2-1', 'user-student-daniyal', 'batch-2k24-bese', yesterday);
    insertVote.run('vote-p2-4', 'poll-2-elective-track', 'opt-p2-4', 'user-student-usman', 'batch-2k24-bee', yesterday);
    insertVote.run('vote-p2-5', 'poll-2-elective-track', 'opt-p2-3', 'user-student-zoya', 'batch-2k26-bscs', yesterday);

    // Poll 3: ACTIVE / PUBLISHED where Maya Lin HAS ALREADY VOTED
    insertPoll.run(
      'poll-3-midday-break',
      'Midday Break Utilization & Campus Shuttle Sync',
      'Should the 1:00 PM – 2:00 PM protected midday break remain strictly free of makeup tutorials across all engineering and computing batches?',
      'batch-2k25-bscs',
      'all_batches',
      'user-br-female-2k25-bscs',
      'Aisha Siddiqui (Female BR · 2K25-BSCS)',
      'female',
      'Published',
      null,
      'after_vote',
      threeDaysAgo,
      inFiveDays,
      threeDaysAgo,
      null,
      threeDaysAgo,
      threeDaysAgo
    );
    insertOption.run('opt-p3-1', 'poll-3-midday-break', 'Yes — Keep 1:00 PM – 2:00 PM 100% protected across all batches', 1);
    insertOption.run('opt-p3-2', 'poll-3-midday-break', 'Allow optional 30-minute recitation sessions at 1:30 PM', 2);
    insertOption.run('opt-p3-3', 'poll-3-midday-break', 'Shift midday break to 12:30 PM – 1:30 PM on Mondays & Wednesdays', 3);

    insertVote.run('vote-p3-1', 'poll-3-midday-break', 'opt-p3-1', 'user-student-maya', 'batch-2k25-bscs', yesterday);
    insertVote.run('vote-p3-2', 'poll-3-midday-break', 'opt-p3-1', 'user-student-ahmed', 'batch-2k25-bscs', yesterday);
    insertVote.run('vote-p3-3', 'poll-3-midday-break', 'opt-p3-1', 'user-student-sara', 'batch-2k24-bese', yesterday);
    insertVote.run('vote-p3-4', 'poll-3-midday-break', 'opt-p3-3', 'user-student-usman', 'batch-2k24-bee', yesterday);
    insertVote.run('vote-p3-5', 'poll-3-midday-break', 'opt-p3-2', 'user-student-rayyan', 'batch-2k25-bce', yesterday);

    // Poll 4: UPCOMING POLL
    insertPoll.run(
      'poll-4-upcoming-exam-prep',
      'Midterm Reading Day & Lab Freeze Window',
      'Select the preferred reading day pattern prior to Fall 2026 Midterm Examinations.',
      'batch-2k24-bee',
      'all_batches',
      'user-br-male-2k24-bee',
      'Bilal Mahmood (Male BR · 2K24-BEE)',
      'male',
      'Published',
      null,
      'after_close',
      tomorrow,
      inSevenDays,
      isoNow,
      null,
      isoNow,
      isoNow
    );
    insertOption.run('opt-p4-1', 'poll-4-upcoming-exam-prep', 'Full Friday Reading Day + Zero Thursday Afternoon Labs', 1);
    insertOption.run('opt-p4-2', 'poll-4-upcoming-exam-prep', 'Half-Day Thursday + Half-Day Friday Review Clinics', 2);

    // Poll 5: CLOSED POLL
    insertPoll.run(
      'poll-5-closed-lecture-gap',
      'Standard 10-Minute Transition Break Between 50-Minute Lectures',
      'Finalized cohort referendum on adopting 50-minute lectures + 10-minute transition breaks instead of back-to-back 60-minute lectures.',
      'batch-2k24-bee',
      'all_batches',
      'user-br-female-2k24-bee',
      'Sana Javed (Female BR · 2K24-BEE)',
      'female',
      'Closed',
      null,
      'after_close',
      threeDaysAgo,
      yesterday,
      threeDaysAgo,
      yesterday,
      threeDaysAgo,
      yesterday
    );
    insertOption.run('opt-p5-1', 'poll-5-closed-lecture-gap', 'Approve 50m Lecture + 10m Transition Break (Adopted)', 1);
    insertOption.run('opt-p5-2', 'poll-5-closed-lecture-gap', 'Retain 60m Continuous Lectures Without Break', 2);

    insertVote.run('vote-p5-1', 'poll-5-closed-lecture-gap', 'opt-p5-1', 'user-student-maya', 'batch-2k25-bscs', twoDaysAgo);
    insertVote.run('vote-p5-2', 'poll-5-closed-lecture-gap', 'opt-p5-1', 'user-student-ahmed', 'batch-2k25-bscs', twoDaysAgo);
    insertVote.run('vote-p5-3', 'poll-5-closed-lecture-gap', 'opt-p5-1', 'user-student-sara', 'batch-2k24-bese', twoDaysAgo);
    insertVote.run('vote-p5-4', 'poll-5-closed-lecture-gap', 'opt-p5-1', 'user-student-daniyal', 'batch-2k24-bese', twoDaysAgo);
    insertVote.run('vote-p5-5', 'poll-5-closed-lecture-gap', 'opt-p5-2', 'user-student-usman', 'batch-2k24-bee', twoDaysAgo);
    insertVote.run('vote-p5-6', 'poll-5-closed-lecture-gap', 'opt-p5-1', 'user-student-hira', 'batch-2k24-bee', twoDaysAgo);
    insertVote.run('vote-p5-7', 'poll-5-closed-lecture-gap', 'opt-p5-1', 'user-student-rayyan', 'batch-2k25-bce', twoDaysAgo);
    insertVote.run('vote-p5-8', 'poll-5-closed-lecture-gap', 'opt-p5-1', 'user-student-zoya', 'batch-2k26-bscs', twoDaysAgo);

    // Poll 6: PENDING ADMIN APPROVAL
    insertPoll.run(
      'poll-6-pending-compiler-lab',
      'Dedicated GPU Cluster Hours for Operating Systems & AI Labs',
      'Should Computing Lab 3 be reserved from 3:00 PM – 5:00 PM on Tuesdays and Thursdays for open batch project work?',
      'batch-2k25-bscs',
      'all_batches',
      'user-br-male-2k25-bscs',
      'Hamza Tariq (Male BR · 2K25-BSCS)',
      'male',
      'Pending',
      null,
      'after_vote',
      null,
      inSevenDays,
      null,
      null,
      isoNow,
      isoNow
    );
    insertOption.run('opt-p6-1', 'poll-6-pending-compiler-lab', 'Reserve Tue/Thu 3:00 PM – 5:00 PM for Open Batch Lab Access', 1);
    insertOption.run('opt-p6-2', 'poll-6-pending-compiler-lab', 'Reserve Wed/Fri Morning 9:00 AM – 11:00 AM Instead', 2);
    insertOption.run('opt-p6-3', 'poll-6-pending-compiler-lab', 'Keep Current Ad-Hoc Lab Booking Policy', 3);

    // Poll 7: APPROVED
    insertPoll.run(
      'poll-7-approved-seminar',
      'Bi-Weekly Industry Capstone Seminar Slot',
      'Which afternoon slot works best for hosting guest engineering practitioners without conflicting with core lab sections?',
      'batch-2k25-bce',
      'all_batches',
      'user-br-male-2k25-bce',
      'Omar Farooq (Male BR · 2K25-BCE)',
      'male',
      'Approved',
      null,
      'after_vote',
      isoNow,
      inSevenDays,
      null,
      null,
      yesterday,
      isoNow
    );
    insertOption.run('opt-p7-1', 'poll-7-approved-seminar', 'Wednesday 04:00 PM – 05:00 PM (Main Auditorium)', 1);
    insertOption.run('opt-p7-2', 'poll-7-approved-seminar', 'Friday 11:00 AM – 12:00 PM (Main Auditorium)', 2);

    // Poll 8: REJECTED
    insertPoll.run(
      'poll-8-rejected-saturday',
      'Shift Core Mathematics Lectures to Saturday Morning',
      'Proposal to move Linear Algebra & Differential Equations to Saturday 9:00 AM – 12:00 PM.',
      'batch-2k25-bscs',
      'all_batches',
      'user-br-female-2k25-bscs',
      'Aisha Siddiqui (Female BR · 2K25-BSCS)',
      'female',
      'Rejected',
      'University Academic Configuration strictly designates Monday–Friday as operating days. Saturday classes are restricted to emergency makeup sessions only.',
      'after_close',
      null,
      null,
      null,
      null,
      twoDaysAgo,
      yesterday
    );
    insertOption.run('opt-p8-1', 'poll-8-rejected-saturday', 'Move to Saturday 9:00 AM', 1);
    insertOption.run('opt-p8-2', 'poll-8-rejected-saturday', 'Keep on Weekday Schedule', 2);

    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}
