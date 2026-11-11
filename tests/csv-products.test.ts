import { describe, expect, it } from 'vitest';
import { processProductsCsv, type CsvFailure } from '../src/csv/process-products-csv.js';

const header = 'sku,nombre,precio_eur,stock';
const encodeField = (value: string) => '"' + value.replace(/"/g, '""') + '"';
const csv = (rows: string[][]) => Buffer.from(header + '\n' + rows.map((row) => row.map(encodeField).join(',')).join('\n'));
const defaults = ['A', 'Nombre', '12.50', '10'];
const fields = ['sku', 'nombre', 'precio_eur', 'stock'] as const;

function withField(index: number, value: string) {
  const row = [...defaults];
  row[index] = value;
  return processProductsCsv(csv([row]));
}

function error(rows: string[][]): CsvFailure['error'] {
  const result = processProductsCsv(csv(rows));
  expect(result.ok).toBe(false);
  expect(result).not.toHaveProperty('productos');
  if (result.ok) throw new Error('Se esperaba un CSV inválido');
  return result.error;
}

describe('CSV: validación y normalización de productos', () => {
  it('recorta solo espacios ASCII y tabuladores en los extremos de cada campo', () => {
    expect(processProductsCsv(csv([[' \tab-01\t ', ' \tCafe\u0301  molido\t ', '\t 12.50 ', ' 10\t']]))).toEqual({
      ok: true,
      productos: [{ sku: 'AB-01', nombre: 'Café  molido', precio_centimos: 1250, stock: 10 }],
    });
  });

  it.each(fields.map((field, index) => ({ field, index })))(
    'informa solo REQUIRED_FIELD para $field vacío o recortable', ({ field, index }) => {
      for (const empty of ['', ' ', '\t', ' \t \t']) {
        const result = withField(index, empty);
        expect(result).toMatchObject({ ok: false, error: {
          codigo: 'VALIDATION_FAILED',
          detalles: [{ fila: 2, campo: field, codigo: 'REQUIRED_FIELD', motivo: expect.any(String) }],
          errores_truncados: false,
        } });
        if (!result.ok) expect(result.error.detalles).toHaveLength(1);
      }
    },
  );

  it('detecta también campos vacíos sin comillas y no devuelve errores de formato adicionales', () => {
    expect(processProductsCsv(Buffer.from(header + '\n,,,'))).toMatchObject({
      ok: false, error: { detalles: fields.map((campo) => ({ fila: 2, campo, codigo: 'REQUIRED_FIELD' })) },
    });
  });

  it.each(['A', '001', 'ab-01', 'a_B-9', 'a'.repeat(64)])('acepta y normaliza el SKU %j', (value) => {
    const result = withField(0, value);
    expect(result.ok && result.productos[0].sku).toBe(value.toUpperCase());
  });

  it.each([
    'a'.repeat(65), '_A', '-A', 'A B', 'A\tB', 'A.B', 'A/B', 'á-01', 'ß', 'K', 'Ａ',
    '😀', '\u00a0A', 'A\u00a0', 'A\u0000', 'A\u2028',
  ])('rechaza el SKU %j sin convertir Unicode a ASCII', (value) => {
    expect(withField(0, value)).toMatchObject({
      ok: false, error: { detalles: [{ campo: 'sku', codigo: 'INVALID_SKU' }] },
    });
  });

  it.each([
    'N', 'n'.repeat(120), '😀'.repeat(120), 'e\u0301'.repeat(120),
    'Taza, modelo "Norte"', 'Café  molido', '\u00a0Nombre\u00a0',
  ])('acepta el nombre %j y aplica NFC', (value) => {
    const result = withField(1, value);
    expect(result.ok && result.productos[0].nombre).toBe(value.normalize('NFC'));
  });

  it.each([
    'n'.repeat(121), '😀'.repeat(121), 'e\u0301'.repeat(121),
    'Nom\u0000bre', 'Nom\u001fbre', 'Nom\u007fbre', 'Nom\u0085bre',
    'Nom\u009fbre', 'Nom\tbre', 'Nom\u2028bre', 'Nom\u2029bre',
  ])('rechaza nombre fuera de límite o con controles %j', (value) => {
    expect(withField(1, value)).toMatchObject({
      ok: false, error: { detalles: [{ fila: 2, campo: 'nombre', codigo: 'INVALID_NAME' }] },
    });
  });

  it.each([
    ['0', 0], ['0.0', 0], ['0.00', 0], ['0.01', 1], ['0.29', 29],
    ['1.01', 101], ['12', 1200], ['12.0', 1200], ['12.00', 1200],
    ['12.5', 1250], ['12.50', 1250], ['999999', 99999900], ['999999.99', 99999999],
  ] as const)('convierte exactamente el precio %s a %i céntimos', (value, cents) => {
    const result = withField(2, value);
    expect(result.ok && result.productos[0].precio_centimos).toBe(cents);
  });

  it.each([
    '-1', '+1', '-0', '.50', '12.', '01.00', '00', '00.00', '1e2', '1E2',
    '12.345', 'NaN', 'Infinity', '12,50', '1,000.00', '1000000', '1000000.00',
    '1 0', '１', '\u00a01', '1\u00a0', '1\u2028', 'null', '9'.repeat(1000),
  ])('rechaza el precio %j sin redondearlo', (value) => {
    expect(withField(2, value)).toMatchObject({
      ok: false, error: { detalles: [{ campo: 'precio_eur', codigo: 'INVALID_PRICE' }] },
    });
  });

  it.each([['0', 0], ['1', 1], ['999999', 999999], ['1000000', 1000000]] as const)(
    'acepta el stock %s', (value, quantity) => {
      const result = withField(3, value);
      expect(result.ok && result.productos[0].stock).toBe(quantity);
    },
  );

  it.each([
    '1000001', '-1', '-0', '+1', '1.0', '01', '00', '1e2', 'NaN', 'Infinity',
    '1,000', '1 0', '１', '\u00a01', '1\u00a0', '1\u2029', 'null', '9'.repeat(1000),
  ])('rechaza stock inválido %j', (value) => {
    expect(withField(3, value)).toMatchObject({
      ok: false, error: { detalles: [{ campo: 'stock', codigo: 'INVALID_STOCK' }] },
    });
  });

  it('conserva una secuencia grande de espacios interiores y rechaza el nombre por longitud', () => {
    expect(withField(1, 'N' + ' '.repeat(100_000) + 'N')).toMatchObject({
      ok: false, error: { detalles: [{ campo: 'nombre', codigo: 'INVALID_NAME' }] },
    });
  });

  it('trata null como texto ordinario, sin sustituir los valores obligatorios', () => {
    expect(processProductsCsv(csv([['null', 'null', '0', '0']]))).toEqual({
      ok: true, productos: [{ sku: 'NULL', nombre: 'null', precio_centimos: 0, stock: 0 }],
    });
  });

  it('no deduplica nombres iguales o equivalentes tras NFC', () => {
    const result = processProductsCsv(csv([['A', 'Café', '0', '0'], ['B', 'Cafe\u0301', '0', '0']]));
    expect(result.ok && result.productos.map((p) => p.nombre)).toEqual(['Café', 'Café']);
  });

  it('rechaza filas idénticas con referencia a la primera', () => {
    expect(error([defaults, defaults])).toMatchObject({
      codigo: 'VALIDATION_FAILED',
      detalles: [{ fila: 3, campo: 'sku', codigo: 'DUPLICATE_SKU', fila_original: 2 }],
      errores_truncados: false,
    });
  });

  it('detecta todas las repeticiones tras normalizar, aunque la primera fila tenga otro campo inválido', () => {
    const result = error([['ab-01', '', '0', '0'], [' AB-01 ', 'Otro', '1', '1'], ['ab-01', 'Otro', '2', '2']]);
    expect(result.detalles).toEqual([
      { fila: 2, campo: 'nombre', codigo: 'REQUIRED_FIELD', motivo: expect.any(String) },
      { fila: 3, campo: 'sku', codigo: 'DUPLICATE_SKU', motivo: expect.any(String), fila_original: 2 },
      { fila: 4, campo: 'sku', codigo: 'DUPLICATE_SKU', motivo: expect.any(String), fila_original: 2 },
    ]);
  });

  it('ordena incidencias por fila y columna e incluye motivos sin exponer el contenido original', () => {
    const result = error([defaults, ['a', '', '-1', '1.5'], ['_B', 'Bien', 'NaN', '-1']]);
    expect(result.detalles.map(({ fila, campo, codigo }) => ({ fila, campo, codigo }))).toEqual([
      { fila: 3, campo: 'sku', codigo: 'DUPLICATE_SKU' },
      { fila: 3, campo: 'nombre', codigo: 'REQUIRED_FIELD' },
      { fila: 3, campo: 'precio_eur', codigo: 'INVALID_PRICE' },
      { fila: 3, campo: 'stock', codigo: 'INVALID_STOCK' },
      { fila: 4, campo: 'sku', codigo: 'INVALID_SKU' },
      { fila: 4, campo: 'precio_eur', codigo: 'INVALID_PRICE' },
      { fila: 4, campo: 'stock', codigo: 'INVALID_STOCK' },
    ]);
    for (const detail of result.detalles) {
      expect(detail.motivo.length).toBeGreaterThan(0);
      if (detail.codigo !== 'DUPLICATE_SKU') expect(detail).not.toHaveProperty('fila_original');
    }
  });

  it('reproduce los errores del ejemplo contractual sin devolver el producto válido', () => {
    const result = processProductsCsv(Buffer.from(
      header + '\nAB-001,Café molido,12.50,10\nAB-002,Taza,12.345,0\nab-001,Café molido,12.50,10',
    ));
    expect(result).toMatchObject({ ok: false, error: {
      codigo: 'VALIDATION_FAILED',
      detalles: [
        { fila: 3, campo: 'precio_eur', codigo: 'INVALID_PRICE' },
        { fila: 4, campo: 'sku', codigo: 'DUPLICATE_SKU', fila_original: 2 },
      ],
    } });
    expect(result).not.toHaveProperty('productos');
  });

  it('no comparte SKU ni estado entre llamadas: la deduplicación persistente queda fuera del componente', () => {
    const input = csv([defaults]);
    expect(processProductsCsv(input)).toEqual(processProductsCsv(input));
    expect(processProductsCsv(input).ok).toBe(true);
  });
});