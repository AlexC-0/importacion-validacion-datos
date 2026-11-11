import { randomUUID, createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { createDatabasePool, requiredDatabaseUrl } from '../../src/persistence/database.js';
import { applyMigrations } from '../../src/persistence/migrate.js';
import { ImportRepository } from '../../src/persistence/import-repository.js';
import { processProductsCsv } from '../../src/csv/process-products-csv.js';
import type { NormalizedProduct } from '../../src/csv/types.js';

const url = requiredDatabaseUrl('TEST_DATABASE_URL');
if (decodeURIComponent(new URL(url).pathname) !== '/importacion_validacion_datos_test') {
  throw new Error('Las pruebas requieren la base exclusiva importacion_validacion_datos_test.');
}
if (process.env.DATABASE_URL && new URL(process.env.DATABASE_URL).pathname === new URL(url).pathname) {
  throw new Error('La base de pruebas debe ser distinta de la base de desarrollo.');
}
const admin = createDatabasePool(url);
const owned = new Map<string, Pool>();
let pool: Pool;
let repo: ImportRepository;
const fingerprint = () => createHash('sha256').update(randomUUID()).digest('hex');
const product = (changes: Partial<NormalizedProduct> = {}): NormalizedProduct => ({
  sku: 'P-' + randomUUID().toUpperCase(),
  nombre: 'Café',
  precio_centimos: 1250,
  stock: 10,
  ...changes,
});

async function sandbox(): Promise<Pool> {
  const schema = 'csv_test_' + randomUUID().replace(/-/g, '');
  // Identificador generado internamente, nunca procede del CSV ni de una URL.
  await admin.query('CREATE SCHEMA "' + schema + '"');
  const created = createDatabasePool(url, { schema, max: 1 });
  owned.set(schema, created);
  return created;
}

async function counts() {
  return (await pool.query<{ imports: number; products: number }>(
    'SELECT (SELECT count(*)::int FROM importaciones) AS imports, ' +
    '(SELECT count(*)::int FROM productos) AS products',
  )).rows[0];
}

beforeAll(async () => {
  const identity = await admin.query<{ name: string }>('SELECT current_database() AS name');
  expect(identity.rows[0].name).toBe('importacion_validacion_datos_test');
  pool = await sandbox();
  await applyMigrations(pool);
  repo = new ImportRepository(pool);
});

afterAll(async () => {
  try {
    for (const [schema, created] of owned) {
      await created.end();
      // Solo esquemas creados con éxito por esta ejecución; nunca public ni datos ajenos.
      if (!/^csv_test_[a-f0-9]{32}$/.test(schema)) throw new Error('Esquema de limpieza inválido.');
      await admin.query('DROP SCHEMA "' + schema + '" CASCADE');
    }
  } finally { await admin.end(); }
});

describe('PostgreSQL real: migraciones y persistencia', () => {
  it('crea el esquema desde cero y registra una sola migración', async () => {
    const fresh = await sandbox();
    expect(await applyMigrations(fresh)).toEqual(['001_initial.sql']);
    const tables = await fresh.query<{ tablename: string }>(
      'SELECT tablename FROM pg_tables WHERE schemaname = current_schema() ORDER BY tablename',
    );
    expect(tables.rows.map((row) => row.tablename)).toEqual(['importaciones', 'productos', 'schema_migrations']);
    expect(await applyMigrations(fresh)).toEqual([]);
    expect((await fresh.query('SELECT * FROM schema_migrations')).rowCount).toBe(1);
  });

  it('no modifica un esquema previo sin historial del proyecto', async () => {
    const foreign = await sandbox();
    await foreign.query('CREATE TABLE ajena (valor text)');
    await foreign.query("INSERT INTO ajena VALUES ('conservar')");
    await expect(applyMigrations(foreign)).rejects.toMatchObject({ code: 'SCHEMA_NOT_EMPTY' });
    expect((await foreign.query('SELECT valor FROM ajena')).rows).toEqual([{ valor: 'conservar' }]);
    expect((await foreign.query("SELECT to_regclass('schema_migrations') AS tracker")).rows[0].tracker).toBeNull();
  });

  it('rechaza un historial de migraciones cuyo checksum ha cambiado', async () => {
    const altered = await sandbox();
    await applyMigrations(altered);
    await altered.query("UPDATE schema_migrations SET checksum = 'alterado'");
    await expect(applyMigrations(altered)).rejects.toMatchObject({ code: 'MIGRATION_HISTORY_MISMATCH' });
  });

  it('persiste productos del procesador CSV y mantiene céntimos, Unicode y relaciones', async () => {
    const prefix = randomUUID().toUpperCase();
    const bytes = Buffer.from('sku,nombre,precio_eur,stock\n' +
      prefix + '-A,Cafe\u0301,0.29,0\n' + prefix + '-B,"Taza, ""Norte""",999999.99,1000000');
    const validated = processProductsCsv(bytes);
    expect(validated.ok).toBe(true);
    if (!validated.ok) throw new Error('Fixture CSV inválida.');
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const imported = await repo.createImport({ sha256, productos: validated.productos });
    expect(imported).toMatchObject({ sha256, version_contrato: 'csv-v1', productos_importados: 2 });
    expect(imported.creada_en).toBeInstanceOf(Date);
    expect(await repo.findImportById(imported.id)).toEqual(imported);
    expect(await repo.findImportByHash(sha256)).toEqual(imported);
    const stored = await repo.listProductsByImport(imported.id);
    expect(stored.map(({ id, importacion_id, ...p }) => p)).toEqual(validated.productos);
    expect(stored.every((p) => p.importacion_id === imported.id)).toBe(true);
    expect(await repo.findProductBySku(stored[0].sku)).toEqual(stored[0]);
  });

  it('permite precio cero y límites inclusivos', async () => {
    const imported = await repo.createImport({
      sha256: fingerprint(),
      productos: [product({ precio_centimos: 0, stock: 0 }), product({ precio_centimos: 99999999, stock: 1000000 })],
    });
    const rows = await repo.listProductsByImport(imported.id);
    expect(rows.map((p) => p.precio_centimos).sort((a,b) => a-b)).toEqual([0, 99999999]);
  });

  it('rechaza SKU existente, revierte importación y producto previo y permite reintentar la huella', async () => {
    const existing = product();
    await repo.createImport({ sha256: fingerprint(), productos: [existing] });
    const before = await counts();
    const first = product();
    const hash = fingerprint();
    await expect(repo.createImport({ sha256: hash, productos: [first, existing] }))
      .rejects.toMatchObject({ code: '23505', constraint: 'productos_sku_unique' });
    expect(await counts()).toEqual(before);
    expect(await repo.findImportByHash(hash)).toBeNull();
    expect(await repo.findProductBySku(first.sku)).toBeNull();
    expect(await repo.findProductBySku(existing.sku)).not.toBeNull();
    const retried = await repo.createImport({ sha256: hash, productos: [first] });
    expect(retried.productos_importados).toBe(1);
  });

  it('rechaza una huella repetida sin insertar otra importación ni productos', async () => {
    const hash = fingerprint();
    const imported = await repo.createImport({ sha256: hash, productos: [product()] });
    const before = await counts();
    const next = product();
    await expect(repo.createImport({ sha256: hash, productos: [next] }))
      .rejects.toMatchObject({ code: '23505', constraint: 'importaciones_sha256_unique' });
    expect(await counts()).toEqual(before);
    expect(await repo.findImportByHash(hash)).toEqual(imported);
    expect(await repo.findProductBySku(next.sku)).toBeNull();
  });

  it.each([
    { precio_centimos: -1 }, { precio_centimos: 100000000 },
    { stock: -1 }, { stock: 1000001 },
  ])('aplica CHECK y rollback completo ante %j', async (invalid) => {
    const before = await counts();
    const first = product();
    const bad = product(invalid);
    const hash = fingerprint();
    await expect(repo.createImport({ sha256: hash, productos: [first, bad] }))
      .rejects.toMatchObject({ code: '23514' });
    expect(await counts()).toEqual(before);
    expect(await repo.findImportByHash(hash)).toBeNull();
    expect(await repo.findProductBySku(first.sku)).toBeNull();
  });

  it.each([{ precio_centimos: 12.5 }, { stock: 1.1 }, { precio_centimos: NaN }, { stock: Infinity }])(
    'no deja que PostgreSQL redondee números no enteros %j', async (invalid) => {
      const before = await counts();
      await expect(repo.createImport({ sha256: fingerprint(), productos: [product(invalid)] }))
        .rejects.toMatchObject({ code: 'INVALID_PRODUCTS' });
      expect(await counts()).toEqual(before);
    },
  );

  it.each(['minuscula', '_INICIO', 'A'.repeat(65), 'ß'])('refuerza la normalización de SKU en SQL: %s', async (sku) => {
    await expect(repo.createImport({ sha256: fingerprint(), productos: [product({ sku })] }))
      .rejects.toMatchObject({ code: '23514', constraint: 'productos_sku_format' });
  });

  it.each(['', 'N'.repeat(121), 'Cafe\u0301', ' Nombre ', 'Nom\tbre', 'Nom\u0085bre', 'Nom\u2028bre'])(
    'refuerza nombre normalizado en SQL: %j', async (nombre) => {
      await expect(repo.createImport({ sha256: fingerprint(), productos: [product({ nombre })] }))
        .rejects.toMatchObject({ code: '23514', constraint: 'productos_nombre_check' });
    },
  );

  it('cuenta el nombre Unicode por puntos de código en PostgreSQL', async () => {
    const imported = await repo.createImport({ sha256: fingerprint(), productos: [product({ nombre: '😀'.repeat(120) })] });
    expect((await repo.listProductsByImport(imported.id))[0].nombre).toBe('😀'.repeat(120));
  });

  it('las consultas parametrizadas conservan texto con sintaxis SQL sin ejecutarlo', async () => {
    const nombre = "Taza'); DROP TABLE productos; --";
    const imported = await repo.createImport({ sha256: fingerprint(), productos: [product({ nombre })] });
    expect((await repo.listProductsByImport(imported.id))[0].nombre).toBe(nombre);
    expect(await repo.findProductBySku("' OR 1=1 --")).toBeNull();
  });

  it('impide productos huérfanos mediante clave foránea', async () => {
    const p = product();
    await expect(pool.query(
      'INSERT INTO productos (id,sku,nombre,precio_centimos,stock,importacion_id) VALUES ($1,$2,$3,$4,$5,$6)',
      [randomUUID(), p.sku, p.nombre, p.precio_centimos, p.stock, randomUUID()],
    )).rejects.toMatchObject({ code: '23503', constraint: 'productos_importacion_fk' });
    expect(await repo.findProductBySku(p.sku)).toBeNull();
  });

  it('impide borrar una importación que tiene productos vinculados', async () => {
    const imported = await repo.createImport({ sha256: fingerprint(), productos: [product()] });
    await expect(pool.query('DELETE FROM importaciones WHERE id = $1', [imported.id]))
      .rejects.toMatchObject({ code: '23001', constraint: 'productos_importacion_fk' });
    expect(await repo.findImportById(imported.id)).toEqual(imported);
  });

  it.each(['id', 'sku', 'nombre', 'precio_centimos', 'stock', 'importacion_id'])(
    'aplica NOT NULL a productos.%s', async (column) => {
      const imported = await repo.createImport({ sha256: fingerprint(), productos: [product()] });
      const values: Record<string, unknown> = { id: randomUUID(), sku: product().sku, nombre: 'Nombre', precio_centimos: 0, stock: 0, importacion_id: imported.id };
      values[column] = null;
      await expect(pool.query(
        'INSERT INTO productos (id,sku,nombre,precio_centimos,stock,importacion_id) VALUES ($1,$2,$3,$4,$5,$6)',
        Object.values(values),
      )).rejects.toMatchObject({ code: '23502' });
    },
  );

  it.each([
    ['sha256', 'x'.repeat(64)], ['sha256', 'a'.repeat(63)], ['sha256', 'A'.repeat(64)],
    ['version_contrato', 'csv-v2'], ['productos_importados', 0], ['productos_importados', 10001],
  ])('aplica CHECK en importaciones.%s para %j', async (column, value) => {
    const row: Record<string, unknown> = { id: randomUUID(), sha256: fingerprint(), version_contrato: 'csv-v1', productos_importados: 1 };
    row[column] = value;
    await expect(pool.query(
      'INSERT INTO importaciones (id,sha256,version_contrato,productos_importados) VALUES ($1,$2,$3,$4)',
      Object.values(row),
    )).rejects.toMatchObject({ code: '23514' });
  });

  it('consultas sin coincidencias devuelven null o una lista vacía', async () => {
    expect(await repo.findImportById(randomUUID())).toBeNull();
    expect(await repo.findImportByHash(fingerprint())).toBeNull();
    expect(await repo.findProductBySku(product().sku)).toBeNull();
    expect(await repo.listProductsByImport(randomUUID())).toEqual([]);
  });

  it('libera conexiones después de errores y éxitos con un pool de una conexión', async () => {
    const p = product();
    await expect(repo.createImport({ sha256: 'invalida', productos: [p] })).rejects.toMatchObject({ code: '23514' });
    await repo.createImport({ sha256: fingerprint(), productos: [p] });
    expect(pool.totalCount).toBe(1);
    expect(pool.idleCount).toBe(1);
    expect(pool.waitingCount).toBe(0);
  });

  it('pool.end cierra la conexión real en el servidor', async () => {
    const temporary = createDatabasePool(url, { max: 1 });
    const pid = (await temporary.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    await temporary.end();
    expect(temporary.totalCount).toBe(0);
    expect((await admin.query('SELECT pid FROM pg_stat_activity WHERE pid = $1', [pid])).rowCount).toBe(0);
  });
});
