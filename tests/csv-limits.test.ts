import { describe, expect, it } from 'vitest';
import { processProductsCsv, type CsvFailure } from '../src/csv/process-products-csv.js';

const header = 'sku,nombre,precio_eur,stock';
const limitBytes = 5 * 1024 * 1024;
const process = (text: string) => processProductsCsv(Buffer.from(text, 'utf8'));

function error(text: string): CsvFailure['error'] {
  const result = process(text);
  expect(result.ok).toBe(false);
  expect(result).not.toHaveProperty('productos');
  if (result.ok) throw new Error('Se esperaba un CSV inválido');
  return result.error;
}

function fileOfSize(size: number, bom = ''): Buffer {
  const prefix = bom + header + '\r\nA,';
  const suffix = 'Café,0,0\r\n';
  const padding = size - Buffer.byteLength(prefix + suffix);
  return Buffer.from(prefix + ' '.repeat(padding) + suffix);
}

describe('CSV: límites y prioridad de errores', () => {
  it.each([limitBytes - 1, limitBytes])('acepta un archivo válido de %i bytes', (size) => {
    const content = fileOfSize(size);
    expect(content.byteLength).toBe(size);
    expect(processProductsCsv(content)).toEqual({
      ok: true, productos: [{ sku: 'A', nombre: 'Café', precio_centimos: 0, stock: 0 }],
    });
  });

  it('incluye BOM, UTF-8 multibyte y CRLF en el límite inclusivo', () => {
    const content = fileOfSize(limitBytes, '\uFEFF');
    expect(content.byteLength).toBe(limitBytes);
    expect(content.toString('utf8').length).toBeLessThan(limitBytes);
    expect(processProductsCsv(content).ok).toBe(true);
    expect(processProductsCsv(Buffer.concat([content, Buffer.from(' ')]))).toMatchObject({
      ok: false, error: { codigo: 'FILE_TOO_LARGE', detalles: [{ fila: null, campo: null }] },
    });
  });

  it('rechaza un byte por encima del límite antes de decodificar o validar datos', () => {
    const content = Buffer.alloc(limitBytes + 1, 0xff);
    const result = processProductsCsv(content);
    expect(result).toMatchObject({
      ok: false, error: { codigo: 'FILE_TOO_LARGE', errores_truncados: false },
    });
    expect(result).not.toHaveProperty('productos');
  });

  it.each(['', '\n', '\r\n'])('admite exactamente 10000 productos, terminador %j', (ending) => {
    const rows = Array.from({ length: 10_000 }, (_, i) => 'SKU-' + i + ',Nombre,0.29,1');
    const result = process(header + '\n' + rows.join('\n') + ending);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.productos).toHaveLength(10_000);
      expect(result.productos[9999]).toEqual({ sku: 'SKU-9999', nombre: 'Nombre', precio_centimos: 29, stock: 1 });
    }
  });

  it('rechaza el producto 10001 aunque las primeras filas también tengan errores de datos', () => {
    const rows = Array.from({ length: 10_001 }, (_, i) => 'SKU-' + i + ',Nombre,-1,0');
    expect(error(header + '\n' + rows.join('\n'))).toMatchObject({
      codigo: 'TOO_MANY_ROWS',
      detalles: [{ fila: 10002, campo: null, codigo: 'TOO_MANY_ROWS' }],
      errores_truncados: false,
    });
  });

  it.each([99, 100, 101])('retiene los primeros 100 de %i errores e indica truncamiento exacto', (count) => {
    const rows = Array.from({ length: count }, (_, i) => 'SKU-' + i + ',Nombre,-1,0');
    const result = error(header + '\n' + rows.join('\n'));
    expect(result.codigo).toBe('VALIDATION_FAILED');
    expect(result.detalles).toHaveLength(Math.min(count, 100));
    expect(result.errores_truncados).toBe(count > 100);
    expect(result.detalles[0]).toMatchObject({ fila: 2, campo: 'precio_eur', codigo: 'INVALID_PRICE' });
    expect(result.detalles.at(-1)?.fila).toBe(Math.min(count, 100) + 1);
  });

  it('el límite cuenta detalles, no filas, y conserva el orden de columnas', () => {
    const result = error(header + '\n' + Array.from({ length: 26 }, () => ',,,').join('\n'));
    expect(result.detalles).toHaveLength(100);
    expect(result.errores_truncados).toBe(true);
    expect(result.detalles.slice(-4).map(({ fila, campo }) => ({ fila, campo }))).toEqual([
      { fila: 26, campo: 'sku' },
      { fila: 26, campo: 'nombre' },
      { fila: 26, campo: 'precio_eur' },
      { fila: 26, campo: 'stock' },
    ]);
  });

  it('100 errores seguidos de filas válidas no implican truncamiento', () => {
    const rows = Array.from({ length: 100 }, (_, i) => 'A' + i + ',Nombre,-1,0');
    expect(error(header + '\n' + rows.join('\n') + '\nB,Nombre,1,0').errores_truncados).toBe(false);
  });

  it.each([
    ['B,"Sin cerrar,0,0', 'INVALID_CSV'],
    ['B,Nombre,0,0,extra', 'COLUMN_COUNT_MISMATCH'],
    ['', 'INVALID_CSV'],
  ])('prioriza un error estructural tardío %s sobre datos inválidos previos', (last, code) => {
    const text = header + '\nA,Nombre,-1,0\n' + last + '\n';
    expect(error(text)).toMatchObject({
      codigo: code, detalles: [{ fila: 3, campo: null, codigo: code }], errores_truncados: false,
    });
  });

  it('comprueba estructura más allá de 100 errores potenciales de datos', () => {
    const rows = Array.from({ length: 101 }, (_, i) => 'A' + i + ',Nombre,-1,0');
    expect(error(header + '\n' + rows.join('\n') + '\nB,"Sin cierre,0,0')).toMatchObject({
      codigo: 'INVALID_CSV', detalles: [{ fila: 103, campo: null }], errores_truncados: false,
    });
  });

  it('detecta bytes inválidos al final antes de evaluar cabecera y datos', () => {
    expect(processProductsCsv(Buffer.concat([Buffer.from('cabecera incorrecta\n'), Buffer.from([0xff])])))
      .toMatchObject({ ok: false, error: { codigo: 'INVALID_ENCODING' } });
  });

  it('rechaza exceso de columnas sin aceptar un prefijo válido del registro', () => {
    expect(error(header + '\nA,Nombre,0,0' + ','.repeat(100_000)).codigo).toBe('COLUMN_COUNT_MISMATCH');
  });

  it('no expone productos parciales para ninguna fase fallida', () => {
    for (const suffix of ['B,,0,0', 'B,Nombre,-1,0', 'A,Otro,0,0', 'B,"Sin cierre', 'B,Nombre,0']) {
      const result = process(header + '\nA,Nombre,0,0\n' + suffix);
      expect(result.ok).toBe(false);
      expect(Object.keys(result).sort()).toEqual(['error', 'ok']);
    }
  });
});