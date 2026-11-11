import { Router, type Request, type RequestHandler, type ErrorRequestHandler } from 'express';
import { PersistenceError } from '../persistence/database.js';
import type { ImportRepository } from '../persistence/import-repository.js';
import { parseImportDetail, parseListQuery, ReadParameterError } from './read-parameters.js';

export type ReadStore = Pick<ImportRepository, 'listProducts' | 'listImports' | 'findImportById'>;
class NotFound extends Error {}
function rawQuery(request: Request) {
  const index = request.originalUrl.indexOf('?');
  return index < 0 ? '' : request.originalUrl.slice(index + 1);
}
function failure(error: unknown) {
  if (error instanceof ReadParameterError) return {
    status: 400,
    body: { error: { codigo: 'INVALID_REQUEST', mensaje: error.message,
      detalles: [{ fila: null, campo: error.field, codigo: 'INVALID_REQUEST', motivo: error.message }],
      errores_truncados: false } },
  };
  const missing = error instanceof NotFound;
  const code = error instanceof PersistenceError ? error.code : '';
  const temporary = code.startsWith('08') ||
    ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', '57P01', '57P02', '57P03', '55P03', '57014', '40P01', '40001', '53300'].includes(code);
  return {
    status: missing ? 404 : temporary ? 503 : 500,
    body: { error: {
      codigo: missing ? 'NOT_FOUND' : temporary ? 'SERVICE_UNAVAILABLE' : 'PERSISTENCE_ERROR',
      mensaje: missing ? 'La importación no existe.' : temporary
        ? 'La persistencia no está disponible temporalmente.' : 'No se pudo completar la consulta.',
      detalles: [], errores_truncados: false,
    } },
  };
}
function route(read: (request: Request) => Promise<unknown>): RequestHandler {
  return async (request, response) => {
    try { response.status(200).json(await read(request)); }
    catch (error) {
      const result = failure(error);
      response.status(result.status).json(result.body);
    }
  };
}

/** Solo adaptación HTTP y validación de entrada; SQL pertenece al repositorio. */
export function readRoutes(store: ReadStore) {
  const router = Router();
  router.get('/productos', route(async request => {
    const query = parseListQuery(rawQuery(request), true);
    const result = await store.listProducts(query);
    return { productos: result.items.map(p => ({
      id: p.id, sku: p.sku, nombre: p.nombre, precio_centimos: p.precio_centimos,
      stock: p.stock, importacion_id: p.importacion_id,
    })), paginacion: { limit: query.limit, offset: query.offset, total: result.total } };
  }));
  router.get('/importaciones', route(async request => {
    const query = parseListQuery(rawQuery(request));
    const result = await store.listImports(query);
    return { importaciones: result.items.map(i => ({
      id: i.id, version_contrato: i.version_contrato, productos_importados: i.productos_importados,
      creada_en: i.creada_en.toISOString(),
    })), paginacion: { limit: query.limit, offset: query.offset, total: result.total } };
  }));
  router.get('/importaciones/:id', route(async request => {
    const id = parseImportDetail(request.params.id as string, rawQuery(request));
    const record = await store.findImportById(id);
    if (!record) throw new NotFound();
    return { id: record.id, sha256: record.sha256, version_contrato: record.version_contrato,
      productos_importados: record.productos_importados, creada_en: record.creada_en.toISOString() };
  }));
  // Express puede rechazar escapes de la ruta antes de ejecutar el controlador.
  const malformedPath: ErrorRequestHandler = (error, _request, response, next) => {
    if (!(error instanceof URIError)) { next(error); return; }
    const result = failure(new ReadParameterError('La codificación de la ruta no es válida.', null));
    response.status(result.status).json(result.body);
  };
  router.use(malformedPath);
  return router;
}
