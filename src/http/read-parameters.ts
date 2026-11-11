export interface Pagination {
  limit: number;
  offset: number;
}
export interface ProductQuery extends Pagination {
  importacionId?: string;
}
export class ReadParameterError extends Error {
  constructor(message: string, public readonly field: string | null) { super(message); }
}

export function parseUuid(value: string, field: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new ReadParameterError('Usa un UUID con formato hexadecimal 8-4-4-4-12.', field);
  }
  return value.toLowerCase();
}

function parameters(raw: string, allowed: readonly string[]): URLSearchParams {
  try { decodeURIComponent(raw.replace(/\+/g, ' ')); }
  catch { throw new ReadParameterError('La codificación de los parámetros no es válida.', null); }
  const query = new URLSearchParams(raw);
  const seen = new Set<string>();
  for (const key of query.keys()) {
    if (!allowed.includes(key)) throw new ReadParameterError('La solicitud contiene un parámetro no admitido.', null);
    if (seen.has(key)) throw new ReadParameterError('No repitas un parámetro de consulta.', key);
    seen.add(key);
  }
  return query;
}
function integer(value: string | null, fallback: number, min: number, max: number, field: string) {
  if (value === null) return fallback;
  if (!/^(0|[1-9][0-9]*)$/.test(value)) {
    throw new ReadParameterError('Usa un entero decimal sin signos, espacios ni ceros iniciales.', field);
  }
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < min || result > max) {
    throw new ReadParameterError('El valor está fuera del rango permitido.', field);
  }
  return result;
}

export function parseListQuery(raw: string, products = false): ProductQuery {
  const query = parameters(raw, products ? ['limit', 'offset', 'importacion_id'] : ['limit', 'offset']);
  const result: ProductQuery = {
    limit: integer(query.get('limit'), 20, 1, 100, 'limit'),
    offset: integer(query.get('offset'), 0, 0, Number.MAX_SAFE_INTEGER, 'offset'),
  };
  if (query.has('importacion_id')) result.importacionId = parseUuid(query.get('importacion_id')!, 'importacion_id');
  return result;
}

export function parseImportDetail(id: string, raw: string): string {
  parameters(raw, []);
  return parseUuid(id, 'id');
}
