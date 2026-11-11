import { randomUUID, createHash } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import { createDatabasePool, requiredDatabaseUrl } from '../../src/persistence/database.js';
import { applyMigrations } from '../../src/persistence/migrate.js';
import { ImportRepository } from '../../src/persistence/import-repository.js';
import { ImportService, type ImportStore } from '../../src/imports/import-service.js';

const url = requiredDatabaseUrl('TEST_DATABASE_URL');
if (decodeURIComponent(new URL(url).pathname) !== '/importacion_validacion_datos_test' ||
  (process.env.DATABASE_URL && new URL(process.env.DATABASE_URL).pathname === new URL(url).pathname)) {
  throw new Error('Se requiere la base exclusiva importacion_validacion_datos_test.');
}
const admin = createDatabasePool(url);
let schema: string;
let pools: Pool[] = [];
let pool: Pool;
let repo: ImportRepository;
let service: ImportService;
const header = 'sku,nombre,precio_eur,stock';
const csv = (...rows: string[]) => Buffer.from([header, ...rows].join('\n'));
const bytes = csv('A,Café,0.29,2', 'B,Taza,12.50,0');
const hash = (content: Uint8Array) => createHash('sha256').update(content).digest('hex');

function connection(): Pool {
  const result = createDatabasePool(url, { schema, max: 1 });
  pools.push(result);
  return result;
}
function bind(repository: ImportRepository): ImportStore {
  return {
    findImportByHash: repository.findImportByHash.bind(repository),
    findExistingSkus: repository.findExistingSkus.bind(repository),
    createImport: repository.createImport.bind(repository),
  };
}
function gate(size: number): () => Promise<void> {
  let remaining = size;
  let release!: () => void;
  const ready = new Promise<void>(resolve => { release = resolve; });
  return async () => {
    if (--remaining === 0) release();
    await ready;
  };
}
async function counts() {
  return (await pool.query(
    'SELECT (SELECT count(*)::int FROM importaciones) AS imports, ' +
    '(SELECT count(*)::int FROM productos) AS products',
  )).rows[0];
}

beforeAll(async () => {
  expect((await admin.query('SELECT current_database() AS name')).rows[0].name).toBe('importacion_validacion_datos_test');
});
beforeEach(async () => {
  schema = 'csv_test_' + randomUUID().replace(/-/g, '');
  await admin.query('CREATE SCHEMA "' + schema + '"');
  pool = connection();
  await applyMigrations(pool);
  repo = new ImportRepository(pool);
  service = new ImportService(repo);
});
afterEach(async () => {
  vi.restoreAllMocks();
  for (const item of pools) await item.end();
  pools = [];
  if (!/^csv_test_[a-f0-9]{32}$/.test(schema)) throw new Error('Esquema inválido.');
  await admin.query('DROP SCHEMA "' + schema + '" CASCADE');
});
afterAll(async () => { await admin.end(); });

describe('Servicio con PostgreSQL real', () => {
  it('crea y recupera los mismos identificador, cantidad y productos', async () => {
    const first = await service.importCsv(bytes);
    const again = await service.importCsv(bytes);
    expect(first.kind).toBe('created');
    expect(again.kind).toBe('existing');
    if ('importacion' in first && 'importacion' in again) {
      expect(first.importacion).toEqual(again.importacion);
      const rows = await repo.listProductsByImport(first.importacion.importacion_id);
      expect(rows.map(p => p.precio_centimos)).toEqual([29, 1250]);
      expect((await repo.findImportByHash(hash(bytes)))?.id).toBe(first.importacion.importacion_id);
    }
    expect(await counts()).toEqual({ imports: 1, products: 2 });
  });

  it('un cambio de nombre externo no afecta al resultado: solo se pasan bytes', async () => {
    const firstFile = { name: 'original.csv', bytes };
    const renamed = { name: 'renombrado.csv', bytes: Buffer.from(bytes) };
    const first = await service.importCsv(firstFile.bytes);
    const next = await service.importCsv(renamed.bytes);
    expect(firstFile.name).not.toBe(renamed.name);
    expect(first).toMatchObject({ kind: 'created' });
    expect(next).toMatchObject({ kind: 'existing' });
    if ('importacion' in first && 'importacion' in next) expect(next.importacion).toEqual(first.importacion);
    expect(await counts()).toEqual({ imports: 1, products: 2 });
  });

  it.each(['BOM', 'CRLF', 'espacios', 'orden'])('bytes distintos por %s producen otra huella y conflicto', async (variant) => {
    await service.importCsv(bytes);
    const text = bytes.toString();
    const changed = Buffer.from(variant === 'BOM' ? '\uFEFF' + text :
      variant === 'CRLF' ? text.replace(/\n/g, '\r\n') :
      variant === 'espacios' ? text.replace('A,Café', ' A ,Café') :
      [header, 'B,Taza,12.50,0', 'A,Café,0.29,2'].join('\n'));
    expect(hash(changed)).not.toBe(hash(bytes));
    expect(await service.importCsv(changed)).toMatchObject({ kind: 'conflict', error: { codigo: 'SKU_ALREADY_EXISTS' } });
    expect(await repo.findImportByHash(hash(changed))).toBeNull();
    expect(await counts()).toEqual({ imports: 1, products: 2 });
  });

  it('un archivo parcialmente conflictivo no inserta ni modifica productos', async () => {
    await service.importCsv(bytes);
    const original = await repo.findProductBySku('A');
    const result = await service.importCsv(csv('NUEVO,Nuevo,1,1', 'A,Modificado,99,8'));
    expect(result).toMatchObject({ kind: 'conflict', error: { detalles: [{ fila: 3, campo: 'sku' }] } });
    expect(await repo.findProductBySku('NUEVO')).toBeNull();
    expect(await repo.findProductBySku('A')).toEqual(original);
    expect(await counts()).toEqual({ imports: 1, products: 2 });
  });

  it('CSV inválido no consulta ni escribe PostgreSQL', async () => {
    const spy = vi.spyOn(pool, 'query');
    expect((await service.importCsv(csv('A,Nombre,-1,0'))).kind).toBe('invalid');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
    expect(await counts()).toEqual({ imports: 0, products: 0 });
  });

  it('error después de una inserción revierte todo y el mismo archivo puede reintentarse', async () => {
    await pool.query(
      "CREATE FUNCTION reject_product() RETURNS trigger LANGUAGE plpgsql AS $$ " +
      "BEGIN IF NEW.sku = 'Z_FAIL' THEN RAISE EXCEPTION 'fallo de prueba' USING ERRCODE = '23514'; END IF; RETURN NEW; END $$",
    );
    await pool.query('CREATE TRIGGER reject_product BEFORE INSERT ON productos FOR EACH ROW EXECUTE FUNCTION reject_product()');
    const input = csv('A,Primero,1,1', 'Z_FAIL,Segundo,1,1');
    expect((await service.importCsv(input)).kind).toBe('persistence_error');
    expect(await counts()).toEqual({ imports: 0, products: 0 });
    expect(await repo.findImportByHash(hash(input))).toBeNull();
    await pool.query('DROP TRIGGER reject_product ON productos');
    expect((await service.importCsv(input)).kind).toBe('created');
    expect(await counts()).toEqual({ imports: 1, products: 2 });
  });

  it('cuatro solicitudes idénticas en conexiones distintas crean una sola importación', async () => {
    const wait = gate(4);
    const clients = Array.from({ length: 4 }, () => connection());
    const pids = await Promise.all(clients.map(p => p.query('SELECT pg_backend_pid() AS pid')));
    expect(new Set(pids.map(r => r.rows[0].pid)).size).toBe(4);
    const services = clients.map(p => {
      const r = new ImportRepository(p);
      return new ImportService({ ...bind(r), createImport: async input => { await wait(); return r.createImport(input); } });
    });
    const results = await Promise.all(services.map(s => s.importCsv(bytes)));
    expect(results.filter(r => r.kind === 'created')).toHaveLength(1);
    expect(results.filter(r => r.kind === 'existing')).toHaveLength(3);
    const ids = results.map(r => 'importacion' in r ? r.importacion.importacion_id : null);
    expect(new Set(ids).size).toBe(1);
    expect(ids[0]).not.toBeNull();
    expect(await counts()).toEqual({ imports: 1, products: 2 });
    for (const p of clients) { expect(p.idleCount).toBe(1); expect(p.waitingCount).toBe(0); }
  });

  it('dos archivos distintos con SKU compartidos y orden inverso confirman solo uno', async () => {
    const wait = gate(2);
    const a = connection(), b = connection();
    const pids = await Promise.all([a.query('SELECT pg_backend_pid() AS pid'), b.query('SELECT pg_backend_pid() AS pid')]);
    expect(pids[0].rows[0].pid).not.toBe(pids[1].rows[0].pid);
    const run = (p: Pool, input: Buffer) => {
      const r = new ImportRepository(p);
      return new ImportService({ ...bind(r), createImport: async data => { await wait(); return r.createImport(data); } }).importCsv(input);
    };
    const results = await Promise.all([
      run(a, csv('A,Uno,1,1', 'B,Dos,2,2', 'ONLY_A,Tres,3,3')),
      run(b, csv('B,Diferente,4,4', 'A,Diferente,5,5', 'ONLY_B,Tres,3,3')),
    ]);
    expect(results.map(r => r.kind).sort()).toEqual(['conflict', 'created']);
    expect(await counts()).toEqual({ imports: 1, products: 3 });
    const losingSku = results[0].kind === 'created' ? 'ONLY_B' : 'ONLY_A';
    expect(await repo.findProductBySku(losingSku)).toBeNull();
  });

  it('archivos independientes pueden confirmar ambos sin bloqueo global', async () => {
    const other = new ImportService(new ImportRepository(connection()));
    const results = await Promise.all([service.importCsv(bytes), other.importCsv(csv('C,Otro,1,1'))]);
    expect(results.map(r => r.kind)).toEqual(['created', 'created']);
    expect(await counts()).toEqual({ imports: 2, products: 3 });
  });

  it('recupera una importación idéntica que confirma entre lectura de huella y conflictos', async () => {
    const other = new ImportService(new ImportRepository(connection()));
    const coordinated = new ImportService({
      ...bind(repo),
      findExistingSkus: async skus => {
        expect((await other.importCsv(bytes)).kind).toBe('created');
        return repo.findExistingSkus(skus);
      },
    });
    expect((await coordinated.importCsv(bytes)).kind).toBe('existing');
    expect(await counts()).toEqual({ imports: 1, products: 2 });
  });

  it.each(['COMMIT', 'ROLLBACK'])('espera una huella pendiente hasta %s del competidor', async (ending) => {
    const blocker = await pool.connect();
    const id = randomUUID();
    let released = false;
    const other = new ImportService(new ImportRepository(connection()));
    try {
      await blocker.query('BEGIN');
      await blocker.query(
        'INSERT INTO importaciones (id,sha256,version_contrato,productos_importados) VALUES ($1,$2,$3,$4)',
        [id, hash(bytes), 'csv-v1', 2],
      );
      await blocker.query(
        'INSERT INTO productos (id,sku,nombre,precio_centimos,stock,importacion_id) VALUES ($1,$2,$3,$4,$5,$6),($7,$8,$9,$10,$11,$12)',
        [randomUUID(),'A','Café',29,2,id,randomUUID(),'B','Taza',1250,0,id],
      );
      const pending = other.importCsv(bytes);
      let settled = false;
      void pending.then(() => { settled = true; });
      // Esperar evidencia de bloqueo en PostgreSQL, no un sleep que presupone una carrera.
      let waiting = false;
      for (let n = 0; n < 100; n++) {
        const locks = await admin.query(
          "SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = current_database() " +
          "AND wait_event_type = 'Lock' AND query LIKE 'INSERT INTO importaciones%'",
        );
        if (locks.rows[0].n > 0) { waiting = true; break; }
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      expect(waiting).toBe(true);
      expect(settled).toBe(false);
      await blocker.query(ending);
      blocker.release(); released = true;
      const result = await pending;
      expect(result.kind).toBe(ending === 'COMMIT' ? 'existing' : 'created');
      if ('importacion' in result) {
        expect(result.importacion.productos_importados).toBe(2);
        if (ending === 'COMMIT') expect(result.importacion.importacion_id).toBe(id);
        else expect(result.importacion.importacion_id).not.toBe(id);
      }
      expect(await counts()).toEqual({ imports: 1, products: 2 });
    } finally {
      if (!released) { await blocker.query('ROLLBACK'); blocker.release(); }
    }
  });

  it('una espera de unicidad agotada devuelve error controlado y permite reintentar', async () => {
    const blocker = await pool.connect();
    const other = new ImportService(new ImportRepository(connection()));
    try {
      await blocker.query('BEGIN');
      await blocker.query('INSERT INTO importaciones (id,sha256,version_contrato,productos_importados) VALUES ($1,$2,$3,$4)',
        [randomUUID(), hash(bytes), 'csv-v1', 2]);
      expect(await other.importCsv(bytes)).toMatchObject({ kind: 'persistence_error', commit: 'not_confirmed', error: { codigo: 'SERVICE_UNAVAILABLE' } });
    } finally { await blocker.query('ROLLBACK'); blocker.release(); }
    expect(await counts()).toEqual({ imports: 0, products: 0 });
    expect((await other.importCsv(bytes)).kind).toBe('created');
  }, 15000);
  it.each([false, true])('COMMIT real con respuesta perdida; recuperación diferida=%s', async (deferred) => {
    let reads = 0;
    const wrapped: ImportStore = {
      ...bind(repo),
      findImportByHash: async sha => {
        if (++reads === 2 && deferred) throw new Error('conexión interrumpida');
        return repo.findImportByHash(sha);
      },
      createImport: async input => {
        const connect = pool.connect.bind(pool);
        const connectSpy = vi.spyOn(pool, 'connect').mockImplementationOnce(async () => {
          const client = await connect();
          const query = client.query.bind(client);
          vi.spyOn(client, 'query').mockImplementation((async (sql: string, values?: unknown[]) => {
            const result = await query(sql, values);
            if (sql === 'COMMIT') {
              await client.end();
              throw Object.assign(new Error('respuesta perdida'), { code: 'ECONNRESET' });
            }
            return result;
          }) as PoolClient['query']);
          return client;
        });
        try { return await repo.createImport(input); } finally { connectSpy.mockRestore(); }
      },
    };
    const result = await new ImportService(wrapped).importCsv(bytes);
    if (deferred) expect(result).toMatchObject({ kind: 'persistence_error', commit: 'unknown' });
    else expect(result.kind).toBe('existing');
    expect(await counts()).toEqual({ imports: 1, products: 2 });
    const retry = await service.importCsv(bytes);
    expect(retry.kind).toBe('existing');
    if (!deferred) expect(retry).toEqual(result);
    if ('importacion' in retry) expect((await repo.findImportByHash(hash(bytes)))?.id).toBe(retry.importacion.importacion_id);
  });
});
