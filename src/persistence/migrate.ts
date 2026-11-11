import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { Pool } from 'pg';
import { inTransaction, PersistenceError } from './database.js';

const migrationName = '001_initial.sql';
const migrationUrl = new URL('../../migrations/' + migrationName, import.meta.url);

/** Aplica la migración una vez; exige un esquema vacío en la primera ejecución. */
export async function applyMigrations(pool: Pool): Promise<string[]> {
  const sql = (await readFile(migrationUrl, 'utf8')).replace(/\r\n/g, '\n');
  const checksum = createHash('sha256').update(sql).digest('hex');
  return inTransaction(pool, async (client) => {
    const settings = await client.query<{ encoding: string; schema: string | null }>(
      "SELECT current_setting('server_encoding') AS encoding, current_schema() AS schema",
    );
    if (settings.rows[0].encoding !== 'UTF8' || !settings.rows[0].schema) {
      throw new PersistenceError('INVALID_DATABASE');
    }
    // Serializa solo migraciones; no coordina las solicitudes de importación.
    await client.query('SELECT pg_advisory_xact_lock(hashtext(current_database()), hashtext(current_schema()))');
    const existing = await client.query<{ relname: string }>(
      "SELECT relname FROM pg_class WHERE relnamespace = current_schema()::regnamespace " +
      "AND relkind IN ('r', 'p', 'v', 'm', 'S', 'f')",
    );
    const tracked = existing.rows.some((row) => row.relname === 'schema_migrations');
    if (!tracked && existing.rows.length > 0) throw new PersistenceError('SCHEMA_NOT_EMPTY');
    if (!tracked) {
      await client.query(
        'CREATE TABLE schema_migrations (' +
        'version text PRIMARY KEY, checksum text NOT NULL, ' +
        'aplicada_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP)',
      );
    }
    const applied = await client.query<{ version: string; checksum: string }>(
      'SELECT version, checksum FROM schema_migrations ORDER BY version',
    );
    if (applied.rows.some((row) => row.version !== migrationName || row.checksum !== checksum)) {
      throw new PersistenceError('MIGRATION_HISTORY_MISMATCH');
    }
    if (applied.rows.length > 0) return [];
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)', [migrationName, checksum]);
    return [migrationName];
  });
}
