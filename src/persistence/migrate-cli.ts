import { createDatabasePool, requiredDatabaseUrl, PersistenceError } from './database.js';
import { applyMigrations } from './migrate.js';

async function main(): Promise<void> {
  const pool = createDatabasePool(requiredDatabaseUrl());
  try {
    const applied = await applyMigrations(pool);
    console.log(applied.length ? 'Migración aplicada: ' + applied.join(', ') : 'Esquema actualizado; sin migraciones pendientes.');
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  if (error instanceof PersistenceError) {
    console.error('Migración fallida. Código: ' + error.code);
  } else {
    console.error('No se pudo preparar el esquema. Revisa DATABASE_URL, la conexión y los archivos de migración.');
  }
  process.exitCode = 1;
});
