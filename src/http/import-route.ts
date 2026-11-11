import type { RequestHandler } from 'express';
import type { ImportService } from '../imports/import-service.js';
import type { CsvErrorCode } from '../csv/types.js';
import { receiveCsv, UploadError } from './receive-csv.js';

export type Importer = Pick<ImportService, 'importCsv'>;
const invalidStatus: Record<CsvErrorCode, number> = {
  FILE_TOO_LARGE: 413, TOO_MANY_ROWS: 413,
  INVALID_ENCODING: 400, INVALID_CSV: 400, INVALID_HEADER: 400, COLUMN_COUNT_MISMATCH: 400,
  EMPTY_IMPORT: 422, VALIDATION_FAILED: 422,
};

export function importRoute(service: Importer): RequestHandler {
  return async (request, response) => {
    try {
      const content = await receiveCsv(request);
      if (request.aborted || response.destroyed) return;
      const result = await service.importCsv(content);
      if (response.destroyed) return;
      switch (result.kind) {
        case 'created': response.status(201).json(result.importacion); break;
        case 'existing': response.status(200).json(result.importacion); break;
        case 'invalid': response.status(invalidStatus[result.error.codigo]).json({ error: result.error }); break;
        case 'conflict': response.status(409).json({ error: result.error }); break;
        case 'persistence_error':
          response.status(result.commit === 'unknown' || result.error.codigo === 'SERVICE_UNAVAILABLE' ? 503 : 500)
            .json({ error: result.error });
          break;
      }
    } catch (error) {
      if (response.destroyed) return;
      if (error instanceof UploadError) {
        // No drenar una subida ilimitada. Entregar el error y cerrar esta conexión.
        response.setHeader('Connection', 'close');
        response.once('finish', () => request.destroy());
        response.status(error.status).json(error.body());
      } else {
        response.status(500).json({ error: {
          codigo: 'PERSISTENCE_ERROR', mensaje: 'No se pudo completar la importación.',
          detalles: [], errores_truncados: false,
        } });
      }
    }
  };
}
