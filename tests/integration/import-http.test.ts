import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import { createApp } from '../../src/app.js';
import { ImportService, type ImportStore } from '../../src/imports/import-service.js';
import { createDatabasePool, requiredDatabaseUrl } from '../../src/persistence/database.js';
import { ImportRepository } from '../../src/persistence/import-repository.js';
import { applyMigrations } from '../../src/persistence/migrate.js';
import { rootType, goodCsv, multipart } from '../helpers/multipart.js';

const url = requiredDatabaseUrl('TEST_DATABASE_URL');
if (decodeURIComponent(new URL(url).pathname) !== '/importacion_validacion_datos_test' ||
    (process.env.DATABASE_URL && new URL(process.env.DATABASE_URL).pathname === new URL(url).pathname)) {
  throw new Error('Se requiere la base exclusiva importacion_validacion_datos_test.');
}
const admin = createDatabasePool(url);
let schema: string;
let pool: Pool;
let repo: ImportRepository;
let pools: Pool[] = [];
let app: ReturnType<typeof createApp>;
function connection() {
  const p = createDatabasePool(url, { schema, max:1 });
  pools.push(p);
  return p;
}
function bind(r: ImportRepository): ImportStore {
  return { findImportByHash:r.findImportByHash.bind(r),
    findExistingSkus:r.findExistingSkus.bind(r), createImport:r.createImport.bind(r) };
}
const post = (target = app, bytes = goodCsv, filename = 'productos.csv') =>
  request(target).post('/importaciones').set('Content-Type', rootType).send(multipart(bytes, { filename }));
async function counts() {
  return (await pool.query('SELECT (SELECT count(*)::int FROM importaciones) AS imports, ' +
    '(SELECT count(*)::int FROM productos) AS products')).rows[0];
}
beforeEach(async () => {
  expect((await admin.query('SELECT current_database() AS name')).rows[0].name).toBe('importacion_validacion_datos_test');
  schema = 'csv_test_' + randomUUID().replace(/-/g, '');
  await admin.query('CREATE SCHEMA "' + schema + '"');
  pool = connection();
  await applyMigrations(pool);
  repo = new ImportRepository(pool);
  app = createApp(new ImportService(repo));
});
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(pools.map(p => p.end()));
  pools = [];
  if (!/^csv_test_[a-f0-9]{32}$/.test(schema)) throw new Error('Esquema inválido.');
  await admin.query('DROP SCHEMA "' + schema + '" CASCADE');
});
afterAll(async () => { await admin.end(); });

describe('Importación HTTP con PostgreSQL real', () => {
  it('201 confirma productos; 200 recupera el mismo resultado incluso renombrando el archivo', async () => {
    const first = await post().expect(201);
    expect(await counts()).toEqual({ imports:1, products:1 });
    expect(await repo.findProductBySku('A')).toMatchObject({ precio_centimos:29, nombre:'Café', stock:2,
      importacion_id:first.body.importacion_id });
    const again = await post(app, goodCsv, 'otro.bin').expect(200);
    expect(again.body).toEqual(first.body);
    expect(await counts()).toEqual({ imports:1, products:1 });
  });
  it.each(['BOM', 'CRLF', 'espacios'])('otro archivo por %s produce 409 sin duplicar', async variant => {
    await post().expect(201);
    const changed = Buffer.from(variant === 'BOM' ? '\uFEFF' + goodCsv.toString() :
      variant === 'CRLF' ? goodCsv.toString().replace(/\n/g, '\r\n') :
      goodCsv.toString().replace('A,Café', ' A ,Café'));
    const conflict = await post(app, changed).expect(409);
    expect(conflict.body.error).toMatchObject({ codigo:'SKU_ALREADY_EXISTS', detalles:[{fila:2,campo:'sku'}] });
    expect(await counts()).toEqual({ imports:1, products:1 });
  });
  it('conflicto parcial revierte/rechaza todo y preserva el producto existente', async () => {
    await post().expect(201);
    const before = await repo.findProductBySku('A');
    const body = Buffer.from('sku,nombre,precio_eur,stock\nNUEVO,Nuevo,1,1\nA,Modificado,9,9');
    await post(app, body).expect(409);
    expect(await repo.findProductBySku('NUEVO')).toBeNull();
    expect(await repo.findProductBySku('A')).toEqual(before);
    expect(await counts()).toEqual({ imports:1, products:1 });
  });
  it('fallos HTTP y CSV no guardan importaciones ni productos', async () => {
    await request(app).post('/importaciones').send('texto').expect(415);
    await post(app, Buffer.from('cabecera incorrecta')).expect(400);
    await post(app, Buffer.from('sku,nombre,precio_eur,stock\nA,B,-1,0')).expect(422);
    expect(await counts()).toEqual({ imports:0, products:0 });
  });
  it('fallo después de una inserción devuelve 500, rollback completo y reintento 201', async () => {
    await pool.query("CREATE FUNCTION reject_product() RETURNS trigger LANGUAGE plpgsql AS $$ " +
      "BEGIN IF NEW.sku = 'Z_FAIL' THEN RAISE EXCEPTION 'dato interno sensible' USING ERRCODE = '23514'; END IF; RETURN NEW; END $$");
    await pool.query('CREATE TRIGGER reject_product BEFORE INSERT ON productos FOR EACH ROW EXECUTE FUNCTION reject_product()');
    const csv = Buffer.from('sku,nombre,precio_eur,stock\nA,Primero,1,1\nZ_FAIL,Segundo,2,2');
    const result = await post(app, csv).expect(500);
    expect(JSON.stringify(result.body)).not.toMatch(/sensible|23514|INSERT|stack/);
    expect(await counts()).toEqual({ imports:0, products:0 });
    await pool.query('DROP TRIGGER reject_product ON productos');
    await post(app, csv).expect(201);
    expect(await counts()).toEqual({ imports:1, products:2 });
  });
  it.each([true, false])('solicitudes HTTP concurrentes, bytes idénticos=%s', async identical => {
    let remaining = 2;
    let release!: () => void;
    const ready = new Promise<void>(resolve => { release = resolve; });
    const independent = [connection(), connection()];
    const pids = await Promise.all(independent.map(p => p.query('SELECT pg_backend_pid() AS pid')));
    expect(pids[0].rows[0].pid).not.toBe(pids[1].rows[0].pid);
    const apps = independent.map(p => {
      const r = new ImportRepository(p);
      return createApp(new ImportService({ ...bind(r), createImport:async input => {
        if (--remaining === 0) release();
        await ready;
        return r.createImport(input);
      } }));
    });
    const a = Buffer.from('sku,nombre,precio_eur,stock\nA,Uno,1,1\nB,Dos,2,2\nSOLO_A,Tres,3,3');
    const b = identical ? a : Buffer.from('sku,nombre,precio_eur,stock\nB,Otro,9,9\nA,Otro,9,9\nSOLO_B,Tres,3,3');
    const results = await Promise.all([post(apps[0], a), post(apps[1], b)]);
    expect(results.map(r => r.status).sort()).toEqual(identical ? [200,201] : [201,409]);
    expect(await counts()).toEqual({ imports:1, products:3 });
    if (identical) expect(results[0].body).toEqual(results[1].body);
    else {
      const loser = results[0].status === 201 ? 'SOLO_B' : 'SOLO_A';
      expect(await repo.findProductBySku(loser)).toBeNull();
    }
    expect((await request(app).get('/health').expect(200)).body).toEqual({ status:'ok' });
  }, 10000);
  it.each([false, true])('respuesta perdida tras COMMIT real; recuperación bloqueada=%s', async blocked => {
    let reads = 0;
    const wrapped: ImportStore = { ...bind(repo),
      findImportByHash:async sha => {
        if (++reads === 2 && blocked) throw new Error('fallo de recuperación');
        return repo.findImportByHash(sha);
      },
      createImport:async input => {
        const connect = pool.connect.bind(pool);
        const spy = vi.spyOn(pool, 'connect').mockImplementationOnce(async () => {
          const client = await connect();
          const query = client.query.bind(client);
          vi.spyOn(client, 'query').mockImplementation((async (sql:string, values?:unknown[]) => {
            const result = await query(sql, values);
            if (sql === 'COMMIT') {
              await client.end();
              throw Object.assign(new Error('respuesta perdida'), { code:'ECONNRESET' });
            }
            return result;
          }) as PoolClient['query']);
          return client;
        });
        try { return await repo.createImport(input); } finally { spy.mockRestore(); }
      },
    };
    const response = await post(createApp(new ImportService(wrapped))).expect(blocked ? 503 : 200);
    expect(await counts()).toEqual({ imports:1, products:1 });
    if (blocked) {
      expect(response.body.error.codigo).toBe('SERVICE_UNAVAILABLE');
      expect(response.body).not.toHaveProperty('importacion_id');
    }
    const again = await post().expect(200);
    if (!blocked) expect(again.body).toEqual(response.body);
    expect(await counts()).toEqual({ imports:1, products:1 });
  });
});
