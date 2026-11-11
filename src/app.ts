import express from 'express';
import { ImportService } from './imports/import-service.js';
import { PersistenceError } from './persistence/database.js';
import { importRoute, type Importer } from './http/import-route.js';

async function unavailableDatabase(): Promise<never> { throw new PersistenceError('08001'); }
const unavailable = new ImportService({
  findImportByHash: unavailableDatabase,
  findExistingSkus: unavailableDatabase,
  createImport: unavailableDatabase,
});

export function createApp(service: Importer = unavailable) {
  const application = express();
  application.get('/health', (_request, response) => {
    response.status(200).json({ status: 'ok' });
  });
  application.post('/importaciones', importRoute(service));
  return application;
}

// Permite conservar la prueba de health sin abrir conexiones ni leer credenciales.
export const app = createApp();
