export const CSV_COLUMNS = ['sku', 'nombre', 'precio_eur', 'stock'] as const;
export const MAX_CSV_BYTES = 5 * 1024 * 1024;
export const MAX_PRODUCT_ROWS = 10_000;
export const MAX_ERROR_DETAILS = 100;

export type CsvField = (typeof CSV_COLUMNS)[number];

export interface NormalizedProduct {
  sku: string;
  nombre: string;
  precio_centimos: number;
  stock: number;
}

export type CsvErrorCode =
  | 'FILE_TOO_LARGE'
  | 'TOO_MANY_ROWS'
  | 'INVALID_ENCODING'
  | 'INVALID_CSV'
  | 'INVALID_HEADER'
  | 'COLUMN_COUNT_MISMATCH'
  | 'EMPTY_IMPORT'
  | 'VALIDATION_FAILED';

export type CsvDetailCode =
  | Exclude<CsvErrorCode, 'VALIDATION_FAILED'>
  | 'REQUIRED_FIELD'
  | 'INVALID_SKU'
  | 'INVALID_NAME'
  | 'INVALID_PRICE'
  | 'INVALID_STOCK'
  | 'DUPLICATE_SKU';

export interface CsvErrorDetail {
  fila: number | null;
  campo: CsvField | null;
  codigo: CsvDetailCode;
  motivo: string;
  fila_original?: number;
}

export interface CsvFailure {
  ok: false;
  error: {
    codigo: CsvErrorCode;
    mensaje: string;
    detalles: CsvErrorDetail[];
    errores_truncados: boolean;
  };
}

export type CsvProcessingResult =
  | { ok: true; productos: NormalizedProduct[] }
  | CsvFailure;

export interface CsvRecord {
  fila: number;
  values: [string, string, string, string];
}

export function csvFailure(
  codigo: Exclude<CsvErrorCode, 'VALIDATION_FAILED'>,
  mensaje: string,
  fila: number | null = null,
  campo: CsvField | null = null,
): CsvFailure {
  return {
    ok: false,
    error: {
      codigo,
      mensaje,
      detalles: [{ fila, campo, codigo, motivo: mensaje }],
      errores_truncados: false,
    },
  };
}
