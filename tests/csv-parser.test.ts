import { describe, expect, it } from 'vitest';
import { processProductsCsv, type CsvFailure } from '../src/csv/process-products-csv.js';

const header = 'sku,nombre,precio_eur,stock';
const product = 'AB-001,Café molido,12.50,10';
const expected = { sku: 'AB-001', nombre: 'Café molido', precio_centimos: 1250, stock: 10 };
const process = (text: string) => processProductsCsv(Buffer.from(text, 'utf8'));

function error(text: string): CsvFailure['error'] {
  const result = process(text);
  expect(result.ok).toBe(false);
  expect(result).not.toHaveProperty('productos');
  if (result.ok) throw new Error('Se esperaba un CSV inválido');
  return result.error;
}

describe('CSV: interpretación del contenido original', () => {
  it('procesa un producto sin terminador final', () => {
    expect(process(header + '\n' + product)).toEqual({ ok: true, productos: [expected] });
  });

  it('procesa el ejemplo válido del contrato con comas y comillas escapadas', () => {
    expect(process(header + '\n' + product + '\nAB-002,"Taza, modelo ""Norte""",0,0')).toEqual({
      ok: true,
      productos: [expected, { sku: 'AB-002', nombre: 'Taza, modelo "Norte"', precio_centimos: 0, stock: 0 }],
    });
  });

  it('admite todos los campos y la cabecera entrecomillados', () => {
    expect(process('"sku","nombre","precio_eur","stock"\n"AB-001","Café molido","12.50","10"'))
      .toEqual({ ok: true, productos: [expected] });
  });

  it('interpreta una comilla escapada como nombre de un carácter', () => {
    expect(process(header + '\nA,"""",0,0')).toEqual({
      ok: true, productos: [{ sku: 'A', nombre: '"', precio_centimos: 0, stock: 0 }],
    });
  });

  it.each(['\n', '\r\n'])('admite el terminador %j', (ending) => {
    expect(process(header + ending + product + ending)).toEqual({ ok: true, productos: [expected] });
  });

  it('admite LF y CRLF mezclados', () => {
    const result = process(header + '\r\n' + product + '\nB,Otro,1,2\r\n');
    expect(result.ok && result.productos.length).toBe(2);
  });

  it('acepta un único BOM UTF-8 inicial', () => {
    expect(process('\uFEFF' + header + '\n' + product)).toEqual({ ok: true, productos: [expected] });
  });

  it('rechaza un segundo BOM sin retirarlo silenciosamente', () => {
    expect(error('\uFEFF\uFEFF' + header + '\n' + product).codigo).toBe('INVALID_HEADER');
  });

  it.each([
    [0xc3], [0xc0, 0xaf], [0xed, 0xa0, 0x80], [0xff], [0x80], [0xf4, 0x90, 0x80, 0x80],
  ])('rechaza la secuencia UTF-8 inválida %j', (...bytes) => {
    const result = processProductsCsv(Buffer.concat([Buffer.from(header + '\nA,'), Buffer.from(bytes)]));
    expect(result).toMatchObject({
      ok: false,
      error: { codigo: 'INVALID_ENCODING', detalles: [{ fila: null, campo: null }], errores_truncados: false },
    });
    expect(result).not.toHaveProperty('productos');
  });

  it('usa solo los bytes de la vista recibida y no modifica la entrada', () => {
    const content = Buffer.from(header + '\n' + product);
    const backing = Buffer.concat([Buffer.from([0xff]), content, Buffer.from([0xff])]);
    const original = Buffer.from(backing);
    const view = new Uint8Array(backing.buffer, backing.byteOffset + 1, content.length);
    expect(processProductsCsv(view)).toEqual({ ok: true, productos: [expected] });
    expect(backing).toEqual(original);
  });

  it.each([
    [header + '\r' + product, 1],
    [header + '\n' + product + '\r', 2],
    [header + '\r\r\n' + product, 1],
    [header + '\nA,"Nom\rbre",0,0', 2],
    [header + '\nA,"Nom\nbre",0,0', 2],
    [header + '\r\nA,"Nom\r\nbre",0,0', 2],
  ])('rechaza CR aislado o un campo multilínea: %j', (text, fila) => {
    expect(error(text)).toMatchObject({
      codigo: 'INVALID_CSV', detalles: [{ fila, campo: null, codigo: 'INVALID_CSV' }],
    });
  });

  it.each([
    'SKU,nombre,precio_eur,stock',
    ' sku,nombre,precio_eur,stock',
    'sku,nombre ,precio_eur,stock',
    'nombre,sku,precio_eur,stock',
    'sku,nombre,precio_eur',
    'sku,nombre,precio_eur,stock,extra',
    'sku,sku,precio_eur,stock',
    'sku;nombre;precio_eur;stock',
    'sku\tnombre\tprecio_eur\tstock',
    'sep=,',
    '',
    product,
  ])('rechaza cabecera incorrecta %j', (wrongHeader) => {
    expect(error(wrongHeader + '\n' + product)).toMatchObject({
      codigo: 'INVALID_HEADER', detalles: [{ fila: 1, campo: null }],
    });
  });

  it.each(['A,Nombre,1', 'A,Nombre,1,2,extra', 'A,Nombre,1,2,', 'A,Nombre,12,50,2'])(
    'rechaza número incorrecto de columnas: %j', (row) => {
      expect(error(header + '\n' + row)).toMatchObject({
        codigo: 'COLUMN_COUNT_MISMATCH', detalles: [{ fila: 2, campo: null }],
      });
    },
  );

  it.each([
    'A,Nom"bre,0,0',
    'A,"Nombre,0,0',
    'A,"Nombre"x,0,0',
    'A,"Nombre" ,0,0',
    'A, "Nombre",0,0',
    'A,"Nombre""",0,0"',
    'A,"Nombre"",0,0',
    '"A,Nombre,0,0',
  ])('rechaza sintaxis de comillas inválida %j', (row) => {
    expect(error(header + '\n' + row)).toMatchObject({
      codigo: 'INVALID_CSV', detalles: [{ fila: 2, campo: null }],
    });
  });

  it.each(['', '\uFEFF'])('rechaza archivo sin cabecera %j', (text) => {
    expect(error(text)).toMatchObject({
      codigo: 'INVALID_HEADER', detalles: [{ fila: null, campo: null }],
    });
  });

  it.each(['', '\n', '\r\n'])('rechaza solo cabecera con terminador %j', (ending) => {
    expect(error(header + ending)).toMatchObject({
      codigo: 'EMPTY_IMPORT', detalles: [{ fila: null, campo: null }],
    });
  });

  it.each([
    [header + '\n\n' + product, 2],
    [header + '\n' + product + '\n\n', 3],
    [header + '\r\n' + product + '\r\n\r\n', 3],
  ])('no omite líneas vacías: %j', (text, fila) => {
    expect(error(text)).toMatchObject({ codigo: 'INVALID_CSV', detalles: [{ fila }] });
  });

  it('no ignora comentarios', () => {
    expect(error(header + '\n# comentario\n' + product)).toMatchObject({
      codigo: 'COLUMN_COUNT_MISMATCH', detalles: [{ fila: 2 }],
    });
  });

  it('no ignora una cabecera repetida entre los datos', () => {
    expect(error(header + '\n' + product + '\n' + header)).toMatchObject({
      codigo: 'VALIDATION_FAILED',
      detalles: [
        { fila: 3, campo: 'precio_eur', codigo: 'INVALID_PRICE' },
        { fila: 3, campo: 'stock', codigo: 'INVALID_STOCK' },
      ],
    });
  });

  it('conserva la fila física tras registros CRLF', () => {
    expect(error(header + '\r\n' + product + '\r\nB,"Sin cierre,0,0')).toMatchObject({
      codigo: 'INVALID_CSV', detalles: [{ fila: 3 }],
    });
  });
});