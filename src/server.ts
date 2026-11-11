import { createApp } from './app.js';
import { ImportService } from './imports/import-service.js';
import { ImportRepository } from './persistence/import-repository.js';
import { createDatabasePool, requiredDatabaseUrl } from './persistence/database.js';

const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT debe ser un número entero entre 1 y 65535.');
}

// Un pool por proceso; la conexión es diferida hasta la primera operación SQL.
// Sin DATABASE_URL, health sigue disponible y la importación responde 503.
const pool = process.env.DATABASE_URL ? createDatabasePool(requiredDatabaseUrl()) : undefined;
const service = pool ? new ImportService(new ImportRepository(pool)) : undefined;
const server = createApp(service).listen(port, '127.0.0.1', () => {
  console.log(`API disponible en http://127.0.0.1:${port}`);
});
let poolClosed: Promise<void> | undefined;
function closePool() { return poolClosed ??= pool?.end() ?? Promise.resolve(); }
server.on('error', () => {
  console.error('No se pudo iniciar la API.');
  process.exitCode = 1;
  void closePool().catch(() => { console.error('No se pudo cerrar el pool PostgreSQL.'); });
});

let closing = false;
function shutdown() {
  if (closing) return;
  closing = true;
  // Dar tiempo a las peticiones activas; cierre forzado acotado si un cliente no termina.
  const deadline = setTimeout(() => {
    server.closeAllConnections();
    process.exitCode = 1;
  }, 35_000);
  deadline.unref();
  server.close(() => {
    void closePool().catch(() => {
      console.error('No se pudo cerrar el pool PostgreSQL.');
      process.exitCode = 1;
    }).finally(() => clearTimeout(deadline));
  });
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
