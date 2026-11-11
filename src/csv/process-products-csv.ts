import { TextDecoder } from 'node:util';
import { parseCsv } from './parse-csv.js';
import { MAX_CSV_BYTES, csvFailure, type CsvProcessingResult } from './types.js';
import { validateProducts } from './validate-products.js';

export type {
  CsvProcessingResult,
  CsvFailure,
  CsvErrorDetail,
  NormalizedProduct,
} from './types.js';

/** Procesa bytes originales sin modificar la entrada ni realizar operaciones HTTP o de persistencia. */
export function processProductsCsv(content: Uint8Array): CsvProcessingResult {
  if (content.byteLength > MAX_CSV_BYTES) {
    return csvFailure('FILE_TOO_LARGE', 'El archivo supera el máximo de 5 MiB (5242880 bytes).');
  }

  let text: string;
  try {
    // Conservar el BOM al decodificar permite retirar exactamente uno, no dos.
    text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(content);
  } catch {
    return csvFailure('INVALID_ENCODING', 'El archivo debe contener UTF-8 válido.');
  }
  if (text.startsWith('\uFEFF')) text = text.slice(1);

  // Completar estructura y límites antes de evaluar datos: un fallo tardío de
  // sintaxis tiene prioridad sobre errores semánticos de las primeras filas.
  const parsed = parseCsv(text);
  if (!parsed.ok) return parsed;
  return validateProducts(parsed.records);
}
