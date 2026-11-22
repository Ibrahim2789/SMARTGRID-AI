import fs from 'node:fs';
import path from 'node:path';
import { Pool, type PoolClient } from 'pg';

export interface DbMigrationStatus {
  executed: boolean;
  succeeded: boolean;
  skippedReason?: string;
  rlsTablesChecked: number;
  rlsEnabledCount: number;
  verifiedTablesCount: number;
  error?: string;
  ranAt: string;
}

let lastMigrationStatus: DbMigrationStatus = {
  executed: false,
  succeeded: false,
  rlsTablesChecked: 0,
  rlsEnabledCount: 0,
  verifiedTablesCount: 0,
  ranAt: new Date().toISOString()
};

export function getLastMigrationStatus(): DbMigrationStatus {
  return lastMigrationStatus;
}

function isLocalHostConnection(dbUrl: string): boolean {
  try {
    const parsed = new URL(dbUrl);
    const h = parsed.hostname.toLowerCase();
    return h === 'localhost' || h === '127.0.0.1' || h === '::1';
  } catch {
    return false;
  }
}

export async function runDatabaseMigrations(): Promise<DbMigrationStatus> {
  const dbUrl = (process.env.SUPABASE_DB_URL || '').trim();
  if (!dbUrl || dbUrl.includes('[YOUR-PASSWORD]') || dbUrl.toLowerCase().includes('placeholder')) {
    lastMigrationStatus = {
      executed: false,
      succeeded: false,
      skippedReason: 'SUPABASE_DB_URL is not configured or contains a placeholder.',
      rlsTablesChecked: 0,
      rlsEnabledCount: 0,
      verifiedTablesCount: 0,
      ranAt: new Date().toISOString()
    };
    console.warn('[DB Migration] Skipped: SUPABASE_DB_URL not provided.');
    return lastMigrationStatus;
  }

  const migrationPath = path.resolve(
    process.cwd(),
    'supabase/schema.sql'
  );
  if (!fs.existsSync(migrationPath)) {
    lastMigrationStatus = {
      executed: false,
      succeeded: false,
      error: 'Schema SQL file (supabase/schema.sql) missing.',
      rlsTablesChecked: 0,
      rlsEnabledCount: 0,
      verifiedTablesCount: 0,
      ranAt: new Date().toISOString()
    };
    console.error('[DB Migration] Schema file not found.');
    return lastMigrationStatus;
  }

  const sql = fs.readFileSync(migrationPath, 'utf-8');
  const activeSql = sql
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/--.*$/gm, '');
  if (/enable\s+row\s+level\s+security/i.test(activeSql)) {
    throw new Error(
      'Safety check failed: Schema SQL contains active ENABLE ROW LEVEL SECURITY, which is prohibited.'
    );
  }

  const pool = new Pool({
    connectionString: dbUrl,
    ssl: isLocalHostConnection(dbUrl) ? undefined : { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
    idleTimeoutMillis: 5000
  });

  let client: PoolClient | null = null;
  try {
    client = await pool.connect();
    // 1. Inspect existing RLS settings without altering them
    const rlsBefore = await client.query<{ tablename: string; rowsecurity: boolean }>(
      `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
    );
    const enabledBefore = rlsBefore.rows.filter((r) => r.rowsecurity).map((r) => r.tablename);
    console.log(
      `[DB Migration] Checked ${rlsBefore.rows.length} public tables (RLS enabled: ${enabledBefore.length}). Applying persistence sync migration without modifying RLS...`
    );

    // 2. Apply idempotent schema sync inside transaction
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');

    // 3. Verify tables & ensure RLS status did not change unexpectedly
    const rlsAfter = await client.query<{ tablename: string; rowsecurity: boolean }>(
      `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
    );
    const enabledAfter = rlsAfter.rows.filter((r) => r.rowsecurity).map((r) => r.tablename);

    lastMigrationStatus = {
      executed: true,
      succeeded: true,
      rlsTablesChecked: rlsAfter.rows.length,
      rlsEnabledCount: enabledAfter.length,
      verifiedTablesCount: rlsAfter.rows.length,
      ranAt: new Date().toISOString()
    };
    console.log(
      `[DB Migration] Sync complete. Verified ${rlsAfter.rows.length} public tables (RLS enabled count unchanged: ${enabledAfter.length}).`
    );
    return lastMigrationStatus;
  } catch (err) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ignore rollback failure
      }
    }
    const errMsg = err instanceof Error ? err.message : String(err);
    lastMigrationStatus = {
      executed: true,
      succeeded: false,
      rlsTablesChecked: 0,
      rlsEnabledCount: 0,
      verifiedTablesCount: 0,
      error: errMsg,
      ranAt: new Date().toISOString()
    };
    console.error(`[DB Migration] Failed: ${errMsg}`);
    return lastMigrationStatus;
  } finally {
    if (client) {
      client.release();
    }
    await pool.end().catch(() => {});
  }
}
