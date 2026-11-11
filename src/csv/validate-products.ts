import {
  MAX_ERROR_DETAILS,
  csvFailure,
  type CsvDetailCode,
  type CsvErrorDetail,
  type CsvField,
  type CsvProcessingResult,
  type CsvRecord,
  type NormalizedProduct,
} from './types.js';

function trimEdges(value: string): string {
  let start = 0;
  let end = value.length;
  const isEdgeSpace = (index: number) => value[index] === ' ' || value[index] === '\t';
  while (start < end && isEdgeSpace(start)) start++;
  while (end > start && isEdgeSpace(end - 1)) end--;
  return value.slice(start, end);
}

function priceInCents(value: string): number | undefined {
  if (value.length > 9) return undefined;
  const match = /^(0|[1-9][0-9]*)(\.[0-9]{1,2})?$/.exec(value);
  if (!match || match[0] !== value) return undefined;

  const [euros, decimals = ''] = value.split('.');
  // Se convierte una cadena de dígitos enteros, nunca un importe fraccionario.
  const cents = Number(euros + decimals.padEnd(2, '0'));
  return cents <= 99_999_999 ? cents : undefined;
}

function stockQuantity(value: string): number | undefined {
  if (value.length > 7) return undefined;
  const match = /^(0|[1-9][0-9]*)$/.exec(value);
  if (!match || match[0] !== value) return undefined;
  const quantity = Number(value);
  return quantity <= 1_000_000 ? quantity : undefined;
}

export function validateProducts(records: CsvRecord[]): CsvProcessingResult {
  if (records.length === 0) {
    return csvFailure('EMPTY_IMPORT', 'El archivo debe contener al menos un producto.');
  }

  const productos: NormalizedProduct[] = [];
  const detalles: CsvErrorDetail[] = [];
  const firstRows = new Map<string, number>();
  let errores_truncados = false;

  for (const { fila, values } of records) {
    const [rawSku, rawName, rawPrice, rawStock] = values.map(trimEdges);
    let rowValid = true;
    const issue = (codigo: CsvDetailCode, campo: CsvField, motivo: string, firstRow?: number) => {
      rowValid = false;
      if (detalles.length < MAX_ERROR_DETAILS) {
        detalles.push({
          fila, campo, codigo, motivo,
          ...(firstRow === undefined ? {} : { fila_original: firstRow }),
        });
      } else {
        errores_truncados = true;
      }
    };

    // Validar ASCII antes de convertir caja: no transformar, por ejemplo, ß en SS.
    let sku = rawSku;
    if (rawSku === '') {
      issue('REQUIRED_FIELD', 'sku', 'El SKU es obligatorio.');
    } else if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(rawSku) || /[^\x00-\x7f]/.test(rawSku)) {
      issue('INVALID_SKU', 'sku', 'Usa de 1 a 64 caracteres ASCII: letras, dígitos, guion o guion bajo; empieza por letra o dígito.');
    } else {
      sku = rawSku.toUpperCase();
      const firstRow = firstRows.get(sku);
      if (firstRow !== undefined) {
        issue('DUPLICATE_SKU', 'sku', 'El SKU coincide con una fila anterior.', firstRow);
      } else {
        // Una primera fila con otro campo inválido también reserva la referencia del SKU.
        firstRows.set(sku, fila);
      }
    }

    const nombre = rawName.normalize('NFC');
    if (nombre === '') {
      issue('REQUIRED_FIELD', 'nombre', 'El nombre es obligatorio.');
    } else if (
      nombre.length > 240 ||
      [...nombre].length > 120 ||
      /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u.test(nombre)
    ) {
      issue('INVALID_NAME', 'nombre', 'Usa de 1 a 120 puntos de código Unicode sin controles ni separadores de línea.');
    }

    const precio_centimos = priceInCents(rawPrice);
    if (rawPrice === '') {
      issue('REQUIRED_FIELD', 'precio_eur', 'El precio es obligatorio.');
    } else if (precio_centimos === undefined) {
      issue('INVALID_PRICE', 'precio_eur', 'Usa un importe de 0 a 999999.99, con punto y hasta dos decimales, sin signos ni ceros iniciales.');
    }

    const stock = stockQuantity(rawStock);
    if (rawStock === '') {
      issue('REQUIRED_FIELD', 'stock', 'El stock es obligatorio.');
    } else if (stock === undefined) {
      issue('INVALID_STOCK', 'stock', 'Usa un entero de 0 a 1000000, sin signos ni ceros iniciales.');
    }

    if (rowValid && precio_centimos !== undefined && stock !== undefined) {
      productos.push({ sku, nombre, precio_centimos, stock });
    }
  }

  if (detalles.length > 0) {
    return {
      ok: false,
      error: {
        codigo: 'VALIDATION_FAILED',
        mensaje: 'El archivo contiene datos inválidos.',
        detalles,
        errores_truncados,
      },
    };
  }

  return { ok: true, productos };
}