import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';
import { ImportService, type ImportStore } from '../src/imports/import-service.js';
import { inTransaction, persistenceError, PersistenceError } from '../src/persistence/database.js';

const bytes = Buffer.from('sku,nombre,precio_eur,stock\nA,Café,0.29,1\nB,Taza,2,0');
const stored = { id: 'original-id', sha256: createHash('sha256').update(bytes).digest('hex'),
  version_contrato: 'csv-v1', productos_importados: 2, creada_en: new Date() };

function repository() {
  return {
    findImportByHash: vi.fn<ImportStore['findImportByHash']>().mockResolvedValue(null),
    findExistingSkus: vi.fn<ImportStore['findExistingSkus']>().mockResolvedValue([]),
    createImport: vi.fn<ImportStore['createImport']>().mockResolvedValue(stored),
  };
}

describe('Servicio de importación: decisiones y errores controlados', () => {
  it('crea usando productos validados y SHA-256 de los bytes originales', async () => {
    const repo = repository();
    expect(await new ImportService(repo).importCsv(bytes)).toEqual({
      kind: 'created', importacion: { importacion_id: stored.id, estado: 'completada', productos_importados: 2 },
    });
    expect(repo.createImport).toHaveBeenCalledWith({ sha256: stored.sha256, productos: [
      { sku: 'A', nombre: 'Café', precio_centimos: 29, stock: 1 },
      { sku: 'B', nombre: 'Taza', precio_centimos: 200, stock: 0 },
    ] });
  });

  it.each(['', 'incorrecto', 'sku,nombre,precio_eur,stock\nA,Café,-1,0',
    'sku,nombre,precio_eur,stock\nA,Café,1,0\nA,Taza,1,0'])(
    'un CSV inválido no realiza ninguna operación de persistencia: %j', async (text) => {
      const repo = repository();
      expect((await new ImportService(repo).importCsv(Buffer.from(text))).kind).toBe('invalid');
      for (const fn of Object.values(repo)) expect(fn).not.toHaveBeenCalled();
    },
  );

  it('recupera la importación antes de consultar SKU y no vuelve a insertar', async () => {
    const repo = repository();
    repo.findImportByHash.mockResolvedValue(stored);
    expect(await new ImportService(repo).importCsv(bytes)).toMatchObject({
      kind: 'existing', importacion: { importacion_id: stored.id, productos_importados: 2 },
    });
    expect(repo.findExistingSkus).not.toHaveBeenCalled();
    expect(repo.createImport).not.toHaveBeenCalled();
  });

  it('prioriza una huella confirmada entre la primera consulta y los conflictos', async () => {
    const repo = repository();
    repo.findImportByHash.mockResolvedValueOnce(null).mockResolvedValueOnce(stored);
    repo.findExistingSkus.mockResolvedValue(['A']);
    expect((await new ImportService(repo).importCsv(bytes)).kind).toBe('existing');
    expect(repo.createImport).not.toHaveBeenCalled();
  });

  it('ordena conflictos por fila original y no crea una importación parcial', async () => {
    const repo = repository();
    repo.findExistingSkus.mockResolvedValue(['B', 'A']);
    const result = await new ImportService(repo).importCsv(bytes);
    expect(result).toMatchObject({ kind: 'conflict', error: {
      codigo: 'SKU_ALREADY_EXISTS', errores_truncados: false,
      detalles: [{ fila: 2, campo: 'sku' }, { fila: 3, campo: 'sku' }],
    } });
    expect(repo.createImport).not.toHaveBeenCalled();
  });

  it.each([100, 101])('limita detalles de %i conflictos sin perder la indicación de truncamiento', async (count) => {
    const repo = repository();
    const skus = Array.from({ length: count }, (_, i) => 'A' + i);
    repo.findExistingSkus.mockResolvedValue([...skus].reverse());
    const result = await new ImportService(repo).importCsv(Buffer.from(
      'sku,nombre,precio_eur,stock\n' + skus.map(s => s + ',Nombre,0,0').join('\n'),
    ));
    expect(result.kind).toBe('conflict');
    if (result.kind === 'conflict') {
      expect(result.error.detalles).toHaveLength(100);
      expect(result.error.detalles.at(-1)?.fila).toBe(101);
      expect(result.error.errores_truncados).toBe(count > 100);
    }
  });

  it.each(['importaciones_sha256_unique', 'productos_sku_unique', 'otra_unique'])(
    'tras 23505 de %s consulta primero la huella confirmada', async (constraint) => {
      const repo = repository();
      repo.createImport.mockRejectedValue(new PersistenceError('23505', constraint));
      repo.findImportByHash.mockResolvedValueOnce(null).mockResolvedValueOnce(stored);
      expect((await new ImportService(repo).importCsv(bytes)).kind).toBe('existing');
    },
  );

  it('tras rollback de SKU resuelve conflictos con una segunda lectura de huella', async () => {
    const repo = repository();
    repo.createImport.mockRejectedValue(new PersistenceError('23505', 'productos_sku_unique'));
    repo.findExistingSkus.mockResolvedValueOnce([]).mockResolvedValueOnce(['B']);
    const result = await new ImportService(repo).importCsv(bytes);
    expect(result).toMatchObject({ kind: 'conflict', error: { detalles: [{ fila: 3, campo: 'sku' }] } });
    expect(repo.findImportByHash).toHaveBeenCalledTimes(3);
  });

  it('recupera una huella confirmada durante la consulta de conflictos posterior al rollback', async () => {
    const repo = repository();
    repo.createImport.mockRejectedValue(new PersistenceError('23505', 'productos_sku_unique'));
    repo.findImportByHash.mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce(stored);
    repo.findExistingSkus.mockResolvedValueOnce([]).mockResolvedValueOnce(['B']);
    expect((await new ImportService(repo).importCsv(bytes)).kind).toBe('existing');
  });

  it.each(['productos_pkey', 'importaciones_pkey', 'importaciones_sha256_unique', 'otra_unique'])(
    'no clasifica %s sin huella recuperable como conflicto de SKU', async (constraint) => {
      const repo = repository();
      repo.createImport.mockRejectedValue(new PersistenceError('23505', constraint));
      expect(await new ImportService(repo).importCsv(bytes)).toMatchObject({
        kind: 'persistence_error', commit: 'not_confirmed', error: { codigo: 'PERSISTENCE_ERROR' },
      });
      expect(repo.createImport).toHaveBeenCalledTimes(1);
    },
  );

  it('una infracción de SKU sin conflicto verificable es técnica', async () => {
    const repo = repository();
    repo.createImport.mockRejectedValue(new PersistenceError('23505', 'productos_sku_unique'));
    expect((await new ImportService(repo).importCsv(bytes)).kind).toBe('persistence_error');
  });

  it.each(['23514', 'ECONNREFUSED', '55P03', '57014'])('controla %s sin filtrar detalles ni reintentar escrituras', async (code) => {
    const repo = repository();
    repo.createImport.mockRejectedValue(Object.assign(new PersistenceError(code), { detail: 'PASSWORD_PRIVADA' }));
    const result = await new ImportService(repo).importCsv(bytes);
    expect(result.kind).toBe('persistence_error');
    expect(JSON.stringify(result)).not.toContain('PASSWORD_PRIVADA');
    expect(repo.createImport).toHaveBeenCalledTimes(1);
  });

  it('controla errores inesperados de consulta sin exponer su mensaje', async () => {
    const repo = repository();
    repo.findImportByHash.mockRejectedValue(new Error('postgresql://usuario:secreto@servidor'));
    const result = await new ImportService(repo).importCsv(bytes);
    expect(result.kind).toBe('persistence_error');
    expect(JSON.stringify(result)).not.toContain('secreto');
  });

  it('COMMIT incierto recupera un resultado confirmado sin otra escritura', async () => {
    const repo = repository();
    repo.createImport.mockRejectedValue(new PersistenceError('ECONNRESET', undefined, true));
    repo.findImportByHash.mockResolvedValueOnce(null).mockResolvedValueOnce(stored);
    expect((await new ImportService(repo).importCsv(bytes)).kind).toBe('existing');
    expect(repo.createImport).toHaveBeenCalledTimes(1);
  });

  it.each(['ausente', 'consulta fallida'])('COMMIT incierto permanece desconocido con resultado %s', async (mode) => {
    const repo = repository();
    repo.createImport.mockRejectedValue(new PersistenceError('ECONNRESET', undefined, true));
    if (mode === 'consulta fallida') {
      repo.findImportByHash.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('privado'));
    }
    expect(await new ImportService(repo).importCsv(bytes)).toMatchObject({
      kind: 'persistence_error', commit: 'unknown', error: { codigo: 'SERVICE_UNAVAILABLE' },
    });
    expect(repo.createImport).toHaveBeenCalledTimes(1);
  });
});

describe('Transacción: distinguir pérdida de COMMIT de errores conocidos', () => {
  it.each(['Query read timeout', 'timeout exceeded when trying to connect'])('clasifica timeout del driver: %s', (message) => {
    expect(persistenceError(new Error(message))).toMatchObject({ code: 'ETIMEDOUT' });
  });
  it.each([
    ['COMMIT', 'ECONNRESET', true], ['COMMIT', '57P01', true],
    ['COMMIT', '40001', false], ['WRITE', 'ECONNRESET', false],
  ] as const)('fallo %s/%s conserva la certeza correcta', async (phase, code, uncertain) => {
    const query = vi.fn(async (sql: string) => {
      if (sql === phase) throw Object.assign(new Error('datos privados'), { code });
      return { rows: [] };
    });
    const release = vi.fn();
    const pool = { connect: vi.fn(async () => ({ query, release })) } as unknown as Pool;
    await expect(inTransaction(pool, async client => { await client.query('WRITE'); }))
      .rejects.toMatchObject({ code, commitUncertain: uncertain });
    expect(query).toHaveBeenCalledWith('ROLLBACK');
    expect(release).toHaveBeenCalledWith(code !== '40001');
  });
});
