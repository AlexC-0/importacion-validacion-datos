import { Pool, type PoolClient } from 'pg';

export class PersistenceError extends Error {
  constructor(public readonly code: string, public readonly constraint?: string) {
    super('La operación PostgreSQL no se ha completado.');
    this.name = 'PersistenceError';
  }
}

export function persistenceError(error: unknown): PersistenceError {
  if (error instanceof PersistenceError) return error;
  const details = error as { code?: unknown; constraint?: unknown } | null;
  return new PersistenceError(
    typeof details?.code === 'string' ? details.code : 'UNKNOWN',
    typeof details?.constraint === 'string' ? details.constraint : undefined,
  );
}

export function requiredDatabaseUrl(variable = 'DATABASE_URL'): string {
  const value = process.env[variable];
  if (!value) throw new Error('Falta configurar ' + variable + '.');
  let url: URL;
  try { url = new URL(value); } catch { throw new Error(variable + ' no es una URL PostgreSQL válida.'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.pathname.length < 2) {
    throw new Error(variable + ' debe identificar una base de datos PostgreSQL.');
  }
  return value;
}

export function createDatabasePool(
  connectionString: string,
  options: { schema?: string; max?: number } = {},
): Pool {
  const schema = options.schema ?? 'public';
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(schema)) throw new Error('Nombre de esquema inválido.');
  const pool = new Pool({
    connectionString,
    max: options.max ?? 5,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
    statement_timeout: 15000,
    application_name: 'importacion-validacion-datos',
    options: '-c search_path=' + schema + ',pg_catalog',
  });
  // No imprimir el error original: puede contener valores de las consultas.
  pool.on('error', () => console.error('Se ha cerrado una conexión PostgreSQL inactiva por un error.'));
  return pool;
}

export async function inTransaction<T>(
  pool: Pool,
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  let client: PoolClient | undefined;
  let discard = false;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch { discard = true; }
    }
    throw persistenceError(error);
  } finally {
    client?.release(discard);
  }
}
