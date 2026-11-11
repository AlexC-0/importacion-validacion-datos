import request from 'supertest';
import { request as httpRequest } from 'node:http';
import { once } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { ImportService, type ImportStore } from '../src/imports/import-service.js';
import { PersistenceError } from '../src/persistence/database.js';
import { MAX_CSV_BYTES } from '../src/csv/types.js';
import { MAX_MULTIPART_BYTES } from '../src/http/receive-csv.js';
import { boundary, rootType, goodCsv, multipart } from './helpers/multipart.js';

const record = { id: 'a2c10e86-a049-4d16-8f92-9023b3f44001', sha256: '0'.repeat(64),
  version_contrato: 'csv-v1', productos_importados: 1, creada_en: new Date() };
function setup() {
  const store: ImportStore = {
    findImportByHash: vi.fn(async () => null),
    findExistingSkus: vi.fn(async () => []),
    createImport: vi.fn(async () => record),
  };
  const service = new ImportService(store);
  const call = vi.spyOn(service, 'importCsv');
  return { store, call, app: createApp(service) };
}
const post = (app: ReturnType<typeof createApp>, body = multipart(), type = rootType) =>
  request(app).post('/importaciones').set('Content-Type', type).send(body);
afterEach(() => { vi.restoreAllMocks(); });

describe('POST /importaciones: contrato HTTP y recepción', () => {
  it('201 conserva exactamente los bytes, ignora extensión y devuelve solo el resultado confirmado', async () => {
    const { app, call } = setup();
    const bytes = Buffer.concat([Buffer.from([239,187,191]), goodCsv]);
    const response = await post(app, multipart(bytes, { filename: 'no-es-csv.bin' })).expect(201);
    expect(call.mock.calls[0][0]).toEqual(bytes);
    expect(response.body).toEqual({ importacion_id: record.id, estado: 'completada', productos_importados: 1 });
  });
  it('200 recupera el mismo resultado sin insertar', async () => {
    const { app, store } = setup();
    vi.mocked(store.findImportByHash).mockResolvedValue(record);
    const result = await post(app).expect(200);
    expect(result.body).toEqual({ importacion_id: record.id, estado: 'completada', productos_importados: 1 });
    expect(store.createImport).not.toHaveBeenCalled();
  });
  it('409 conserva fila y campo de conflictos', async () => {
    const { app, store } = setup();
    vi.mocked(store.findExistingSkus).mockResolvedValue(['A']);
    const result = await post(app).expect(409);
    expect(result.body.error).toMatchObject({ codigo: 'SKU_ALREADY_EXISTS', detalles: [{ fila: 2, campo: 'sku' }] });
    expect(store.createImport).not.toHaveBeenCalled();
  });
  it.each([
    ['cabecera', Buffer.from('sku,nombre\nA,B'), 400, 'INVALID_HEADER'],
    ['columnas', Buffer.from('sku,nombre,precio_eur,stock\nA,B,1'), 400, 'COLUMN_COUNT_MISMATCH'],
    ['comillas', Buffer.from('sku,nombre,precio_eur,stock\nA,"B,1,1'), 400, 'INVALID_CSV'],
    ['UTF-8', Buffer.concat([goodCsv, Buffer.from([255])]), 400, 'INVALID_ENCODING'],
    ['precio', Buffer.from('sku,nombre,precio_eur,stock\nA,B,-1,1'), 422, 'VALIDATION_FAILED'],
    ['duplicado', Buffer.from('sku,nombre,precio_eur,stock\nA,B,1,1\na,C,2,2'), 422, 'VALIDATION_FAILED'],
    ['sin productos', Buffer.from('sku,nombre,precio_eur,stock'), 422, 'EMPTY_IMPORT'],
  ])('%s devuelve %s sin acceder a persistencia', async (_label, content, status, code) => {
    const { app, store } = setup();
    const result = await post(app, multipart(content as Buffer)).expect(status as number);
    expect(result.body.error.codigo).toBe(code);
    expect(store.findImportByHash).not.toHaveBeenCalled();
    expect(store.createImport).not.toHaveBeenCalled();
  });
  it('ordena detalles, conserva fila_original y trunca a 100', async () => {
    const { app } = setup();
    const rows = Array.from({ length: 101 }, (_, n) => 'A,Nombre,-1,' + n);
    const result = await post(app, multipart(Buffer.from('sku,nombre,precio_eur,stock\n' + rows.join('\n')))).expect(422);
    expect(result.body.error.detalles).toHaveLength(100);
    expect(result.body.error.errores_truncados).toBe(true);
    expect(result.body.error.detalles.slice(0,3)).toMatchObject([
      { fila:2, campo:'precio_eur', codigo:'INVALID_PRICE' },
      { fila:3, campo:'sku', codigo:'DUPLICATE_SKU', fila_original:2 },
      { fila:3, campo:'precio_eur', codigo:'INVALID_PRICE' },
    ]);
  });
  it.each(['text/csv', 'application/octet-stream', null, 'TEXT/CSV; CHARSET="UTF-8"'])('acepta tipo de parte %s', async type => {
    await post(setup().app, multipart(goodCsv, { type })).expect(201);
  });
  it.each(['application/json', 'application/gzip', 'text/csv; charset=iso-8859-1', 'text/csv; charset=""', 'text/csv; charset'])('rechaza tipo de parte %s', async type => {
    const { app, call } = setup();
    const result = await post(app, multipart(goodCsv, { type })).expect(415);
    expect(result.body.error.codigo).toBe('UNSUPPORTED_MEDIA_TYPE');
    expect(call).not.toHaveBeenCalled();
  });
  it.each(['application/json', 'text/csv', 'multipart/related; boundary=' + boundary,
    rootType + '; charset=latin1'])('rechaza tipo de solicitud %s', async type => {
    await post(setup().app, multipart(), type).expect(415);
  });
  it('acepta charset UTF-8 y boundary entrecomillado en solicitud', async () => {
    await post(setup().app, multipart(), 'Multipart/Form-Data; boundary="' + boundary + '"; charset=UTF-8').expect(201);
  });
  it('rechaza compresión de solicitud', async () => {
    await post(setup().app).set('Content-Encoding', 'gzip').expect(415);
  });
  it('rechaza codificación base64 de parte sin transformar los bytes', async () => {
    await post(setup().app, multipart(goodCsv, { extraHeaders: '\r\nContent-Transfer-Encoding: base64' })).expect(415);
  });
  it.each([
    ['archivo ausente', Buffer.from('--' + boundary + '--\r\n')],
    ['campo texto', multipart(goodCsv, { filename: null })],
    ['campo incorrecto', multipart(goodCsv, { name: 'otro' })],
    ['cierre ausente', multipart(goodCsv, { close: false })],
    ['cuerpo ajeno', Buffer.from('no multipart')],
    ['cabeceras malformadas', Buffer.from('--' + boundary + '\r\nincorrecto\r\n\r\ncontenido\r\n--' + boundary + '--\r\n')],
  ])('%s produce 400 y nunca llama al servicio', async (_label, body) => {
    const { app, call } = setup();
    const result = await post(app, body).expect(400);
    expect(result.body.error).toMatchObject({ codigo:'INVALID_REQUEST', errores_truncados:false });
    expect(call).not.toHaveBeenCalled();
  });
  it('boundary ausente produce 400', async () => {
    await post(setup().app, multipart(), 'multipart/form-data').expect(400);
  });
  it.each([true, false])('rechaza segunda parte, archivo=%s', async file => {
    const { app, call } = setup();
    const first = multipart().subarray(0, -Buffer.byteLength('--' + boundary + '--\r\n'));
    const body = Buffer.concat([first, multipart(goodCsv, { name:'extra', filename:file ? 'otro.csv' : null })]);
    await post(app, body).expect(400);
    expect(call).not.toHaveBeenCalled();
  });
  it('5 MiB exactos se aceptan; un byte adicional se rechaza sin procesar', async () => {
    const { app, call } = setup();
    const exact = Buffer.concat([goodCsv, Buffer.alloc(MAX_CSV_BYTES - goodCsv.length, 32)]);
    await post(app, multipart(exact)).expect(201);
    call.mockClear();
    const result = await post(app, multipart(Buffer.concat([exact, Buffer.from(' ') ]))).expect(413);
    expect(result.body.error.codigo).toBe('FILE_TOO_LARGE');
    expect(call).not.toHaveBeenCalled();
  });
  it('10000 productos se aceptan; 10001 producen 413 sin persistir', async () => {
    const { app, store } = setup();
    const rows = Array.from({ length:10000 }, (_, i) => 'A' + i + ',Nombre,1,1').join('\n');
    const valid = Buffer.from('sku,nombre,precio_eur,stock\n' + rows);
    await post(app, multipart(valid)).expect(201);
    vi.mocked(store.createImport).mockClear();
    const result = await post(app, multipart(Buffer.concat([valid, Buffer.from('\nEXTRA,Nombre,1,1')]))).expect(413);
    expect(result.body.error.codigo).toBe('TOO_MANY_ROWS');
    expect(store.createImport).not.toHaveBeenCalled();
  });
  it.each([false, true])('límite de cuerpo inclusive, exceso=%s, sin Content-Length', async excess => {
    const { app, call } = setup();
    const body = multipart();
    const input = Buffer.concat([body, Buffer.alloc(MAX_MULTIPART_BYTES - body.length + Number(excess), 32)]);
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const port = (server.address() as {port:number}).port;
    try {
      const result = await new Promise<{ status:number; body: string }>((resolve, reject) => {
        const req = httpRequest({ host:'127.0.0.1', port, path:'/importaciones', method:'POST',
          headers:{ 'Content-Type':rootType, 'Transfer-Encoding':'chunked' } }, res => {
          let data=''; res.on('data', chunk => { data += chunk; });
          res.on('end', () => resolve({ status:res.statusCode!, body:data }));
        });
        req.on('error', reject);
        // Bytes reales contados aunque no exista longitud declarada.
        for (let i=0; i<input.length; i+=16384) req.write(input.subarray(i, i+16384));
        req.end();
      });
      expect(result.status).toBe(excess ? 413 : 201);
      if (excess) { expect(JSON.parse(result.body).error.codigo).toBe('FILE_TOO_LARGE'); expect(call).not.toHaveBeenCalled(); }
    } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
  });
  it.each([
    ['23514', 500, 'PERSISTENCE_ERROR', false],
    ['ECONNREFUSED', 503, 'SERVICE_UNAVAILABLE', false],
    ['ECONNRESET', 503, 'SERVICE_UNAVAILABLE', true],
  ])('fallo %s devuelve HTTP %s y %s, incierto=%s', async (code, status, expected, uncertain) => {
    const { app, store } = setup();
    vi.mocked(store.createImport).mockRejectedValue(new PersistenceError(code as string, undefined, uncertain as boolean));
    const result = await post(app).expect(status as number);
    expect(result.body.error.codigo).toBe(expected);
    expect(result.body).not.toHaveProperty('importacion_id');
    expect(result.body).not.toHaveProperty('commit');
    expect(JSON.stringify(result.body)).not.toMatch(/ECONN|23514|stack|postgres:\/\//);
  });
  it('excepción inesperada no filtra mensajes internos', async () => {
    const app = createApp({ importCsv: async () => { throw new Error('postgres://usuario:secreto@host/base'); } });
    const result = await post(app).expect(500);
    expect(JSON.stringify(result.body)).not.toMatch(/secreto|usuario|stack/);
  });
  it('sin configuración de persistencia mantiene health y devuelve 503', async () => {
    const app = createApp();
    expect((await request(app).get('/health').expect(200)).body).toEqual({ status:'ok' });
    await post(app).expect(503);
  });
});
