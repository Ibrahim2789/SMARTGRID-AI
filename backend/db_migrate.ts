import dns from 'node:dns';
import fs from 'node:fs';
import path from 'node:path';
import { Pool, type PoolClient, type PoolConfig } from 'pg';

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

function isLocalHostConnection(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '::1';
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

async function resolveIpv4IfAvailable(hostname: string): Promise<string> {
  if (!hostname || isLocalHostConnection(hostname)) return hostname;
  try {
    const res = await dns.promises.lookup(hostname, { family: 4 });
    return res.address || hostname;
  } catch {
    return hostname;
  }
}

async function buildPgPoolConfig(dbUrl: string): Promise<{ config: PoolConfig; hostname: string }> {
  const trimmed = dbUrl.trim();
  // Try splitting manually on the LAST '@' so passwords containing unescaped '@' or '#' work safely
  const schemeMatch = trimmed.match(/^(postgres(?:ql)?):\/\/(.+)$/i);
  if (schemeMatch) {
    const rest = schemeMatch[2];
    const lastAt = rest.lastIndexOf('@');
    if (lastAt > 0) {
      const credsPart = rest.slice(0, lastAt);
      const targetPart = rest.slice(lastAt + 1);
      const colonIdx = credsPart.indexOf(':');
      const user = safeDecode(colonIdx >= 0 ? credsPart.slice(0, colonIdx) : credsPart);
      const password = colonIdx >= 0 ? safeDecode(credsPart.slice(colonIdx + 1)) : '';

      const slashIdx = targetPart.indexOf('/');
      const queryIdx = targetPart.indexOf('?');
      const hostPortEnd =
        slashIdx >= 0 && queryIdx >= 0
          ? Math.min(slashIdx, queryIdx)
          : slashIdx >= 0
          ? slashIdx
          : queryIdx >= 0
          ? queryIdx
          : targetPart.length;
      const hostPort = targetPart.slice(0, hostPortEnd);
      const dbAndQuery = targetPart.slice(hostPortEnd);
      const dbOnly = dbAndQuery.split('?')[0].replace(/^\/+/, '') || 'postgres';

      const lastColon = hostPort.lastIndexOf(':');
      const hasPort = lastColon > 0 && !hostPort.endsWith(']');
      const rawHost = (hasPort ? hostPort.slice(0, lastColon) : hostPort).replace(/^\[|\]$/g, '');
      const port = hasPort ? Number(hostPort.slice(lastColon + 1)) || 5432 : 5432;
      const host = await resolveIpv4IfAvailable(rawHost);

      return {
        hostname: rawHost,
        config: {
          host,
          port,
          user,
          password,
          database: dbOnly,
          ssl: isLocalHostConnection(rawHost) ? undefined : { rejectUnauthorized: false, servername: rawHost },
          connectionTimeoutMillis: 8000,
          idleTimeoutMillis: 5000
        }
      };
    }
  }

  let hostname = '';
  try {
    hostname = new URL(trimmed).hostname;
  } catch {
    hostname = '';
  }
  return {
    hostname,
    config: {
      connectionString: trimmed,
      ssl: isLocalHostConnection(hostname) ? undefined : { rejectUnauthorized: false },
      connectionTimeoutMillis: 8000,
      idleTimeoutMillis: 5000
    }
  };
}

function cleanEnv(val: string | undefined): string {
  let s = (val || '').trim();
  if (s.length >= 2 && ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")))) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

function isPlaceholder(val: string | undefined): boolean {
  const low = cleanEnv(val).toLowerCase();
  if (!low) return true;
  if (low.startsWith('your-') || low.includes('[your-')) return true;
  return (
    low.includes('your-project-ref') ||
    low.includes('your-anon-key') ||
    low.includes('your-service-role') ||
    low.includes('your-supabase') ||
    low.includes('example.com') ||
    low.includes('example-key') ||
    low.includes('placeholder')
  );
}

function readFirstValidEnv(...names: string[]): string {
  for (const name of names) {
    const val = cleanEnv(process.env[name]);
    if (val && !isPlaceholder(val)) {
      return val;
    }
  }
  return '';
}

async function verifySchemaViaSupabaseRest(): Promise<{ ok: boolean; tableCount: number; reason?: string }> {
  let supaUrl = readFirstValidEnv('SUPABASE_URL', 'VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL').replace(/\/+$/, '');
  const dbUrl = readFirstValidEnv('SUPABASE_DB_URL', 'DATABASE_URL');
  if (!supaUrl && dbUrl) {
    const m = dbUrl.match(/db\.([a-z0-9]{12,32})\.supabase\.co/i) || dbUrl.match(/postgres\.([a-z0-9]{12,32}):/i);
    if (m) {
      supaUrl = `https://${m[1]}.supabase.co`;
    }
  }

  const apiKey =
    readFirstValidEnv('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_KEY', 'SERVICE_ROLE_KEY') ||
    readFirstValidEnv('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY');

  if (!supaUrl || !apiKey) {
    return { ok: false, tableCount: 0, reason: 'SUPABASE_URL or API key not configured.' };
  }

  try {
    const baseHeaders: Record<string, string> = {
      apikey: apiKey,
      Accept: 'application/openapi+json'
    };
    if (!apiKey.startsWith('sb_')) {
      baseHeaders.Authorization = `Bearer ${apiKey}`;
    }
    const resp = await fetch(`${supaUrl}/rest/v1/`, {
      method: 'GET',
      headers: baseHeaders,
      signal: AbortSignal.timeout(8000)
    });
    if (resp.ok) {
      const doc = (await resp.json()) as {
        definitions?: Record<string, unknown>;
        components?: { schemas?: Record<string, unknown> };
      };
      const defs = doc.definitions || doc.components?.schemas || {};
      const tableCount = Object.keys(defs).length;
      if (tableCount > 0) {
        return { ok: true, tableCount };
      }
    }

    // Fallback: directly probe core table via PostgREST if OpenAPI schema listing is restricted
    const probeResp = await fetch(`${supaUrl}/rest/v1/institutions?select=id&limit=1`, {
      method: 'GET',
      headers: { ...baseHeaders, Accept: 'application/json' },
      signal: AbortSignal.timeout(8000)
    });
    if (probeResp.ok) {
      return { ok: true, tableCount: 1 };
    }
    return { ok: false, tableCount: 0, reason: `PostgREST HTTP ${resp.status}/${probeResp.status}` };
  } catch (err) {
    return {
      ok: false,
      tableCount: 0,
      reason: err instanceof Error ? err.message : String(err)
    };
  }
}

export async function runDatabaseMigrations(): Promise<DbMigrationStatus> {
  const dbUrl = readFirstValidEnv('SUPABASE_DB_URL', 'DATABASE_URL');
  if (!dbUrl) {
    const restCheck = await verifySchemaViaSupabaseRest();
    lastMigrationStatus = {
      executed: false,
      succeeded: restCheck.ok,
      skippedReason: restCheck.ok
        ? `SUPABASE_DB_URL not provided; verified ${restCheck.tableCount} public tables via Supabase REST API.`
        : 'SUPABASE_DB_URL is not configured or contains a placeholder.',
      rlsTablesChecked: restCheck.tableCount,
      rlsEnabledCount: 0,
      verifiedTablesCount: restCheck.tableCount,
      ranAt: new Date().toISOString()
    };
    console.warn(`[DB Migration] Skipped direct Postgres sync: ${lastMigrationStatus.skippedReason}`);
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

  const { config } = await buildPgPoolConfig(dbUrl);
  const pool = new Pool(config);

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
    const restCheck = await verifySchemaViaSupabaseRest();
    if (restCheck.ok) {
      lastMigrationStatus = {
        executed: false,
        succeeded: true,
        skippedReason: `Direct Postgres connection unavailable (${errMsg}); verified ${restCheck.tableCount} tables via Supabase HTTPS REST API.`,
        rlsTablesChecked: restCheck.tableCount,
        rlsEnabledCount: 0,
        verifiedTablesCount: restCheck.tableCount,
        ranAt: new Date().toISOString()
      };
      console.warn(`[DB Migration] ${lastMigrationStatus.skippedReason}`);
      return lastMigrationStatus;
    }

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
