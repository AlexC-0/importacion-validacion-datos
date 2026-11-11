import {
  CSV_COLUMNS,
  MAX_PRODUCT_ROWS,
  csvFailure,
  type CsvFailure,
  type CsvRecord,
} from './types.js';

type ParsedRecord = { ok: true; fields: string[] } | CsvFailure;
type ParsedCsv = { ok: true; records: CsvRecord[] } | CsvFailure;

// El contrato prohíbe campos multilínea: cada registro empieza y acaba en su fila.
function parseRecord(line: string, fila: number): ParsedRecord {
  const fields: string[] = [];
  let index = 0;

  while (true) {
    if (fields.length === CSV_COLUMNS.length) {
      return csvFailure(
        fila === 1 ? 'INVALID_HEADER' : 'COLUMN_COUNT_MISMATCH',
        'Se han encontrado más de cuatro columnas.',
        fila,
      );
    }
    if (line[index] === '"') {
      const start = ++index;
      let closed = false;

      while (index < line.length) {
        if (line[index] !== '"') {
          index++;
        } else if (line[index + 1] === '"') {
          index += 2;
        } else {
          fields.push(line.slice(start, index).replace(/""/g, '"'));
          index++;
          closed = true;
          break;
        }
      }

      if (!closed) {
        return csvFailure(
          'INVALID_CSV',
          'Campo entrecomillado sin cerrar en su fila; no se permiten campos multilínea.',
          fila,
        );
      }
      if (index < line.length && line[index] !== ',') {
        return csvFailure('INVALID_CSV', 'Hay caracteres después de una comilla de cierre.', fila);
      }
    } else {
      const start = index;
      while (index < line.length && line[index] !== ',') {
        if (line[index] === '"') {
          return csvFailure('INVALID_CSV', 'Una comilla aparece dentro de un campo sin entrecomillar.', fila);
        }
        index++;
      }
      fields.push(line.slice(start, index));
    }

    if (index === line.length) return { ok: true, fields };
    index++; // Coma; la siguiente iteración también conserva un último campo vacío.
  }
}

export function parseCsv(text: string): ParsedCsv {
  if (text.length === 0) {
    return csvFailure('INVALID_HEADER', 'El archivo debe contener la cabecera obligatoria.');
  }

  const records: CsvRecord[] = [];
  let start = 0;
  let fila = 1;

  while (start < text.length) {
    if (fila > MAX_PRODUCT_ROWS + 1) {
      return csvFailure('TOO_MANY_ROWS', 'El archivo supera el máximo de 10000 productos.', fila);
    }

    const newline = text.indexOf('\n', start);
    const end = newline === -1 ? text.length : newline;
    let line = text.slice(start, end);
    if (newline !== -1 && line.endsWith('\r')) line = line.slice(0, -1);

    if (line.includes('\r')) {
      return csvFailure('INVALID_CSV', 'No se permiten retornos de carro aislados; usa LF o CRLF.', fila);
    }
    if (fila > 1 && line.length === 0) {
      return csvFailure('INVALID_CSV', 'No se permiten filas vacías.', fila);
    }

    const parsed = parseRecord(line, fila);
    if (!parsed.ok) return parsed;
    const fields = parsed.fields;

    if (fila === 1) {
      if (fields.length !== CSV_COLUMNS.length || CSV_COLUMNS.some((name, i) => fields[i] !== name)) {
        return csvFailure(
          'INVALID_HEADER',
          'La cabecera debe ser sku,nombre,precio_eur,stock, en ese orden y sin espacios.',
          fila,
        );
      }
    } else {
      if (fields.length !== CSV_COLUMNS.length) {
        return csvFailure('COLUMN_COUNT_MISMATCH', 'Cada producto debe contener exactamente cuatro campos.', fila);
      }
      records.push({ fila, values: [fields[0], fields[1], fields[2], fields[3]] });
    }

    if (newline === -1) break;
    start = newline + 1;
    fila++;
  }

  return { ok: true, records };
}
