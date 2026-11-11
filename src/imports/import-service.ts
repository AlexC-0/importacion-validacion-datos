import { createHash } from 'node:crypto';
import { processProductsCsv, type CsvFailure, type NormalizedProduct } from '../csv/process-products-csv.js';
import { MAX_ERROR_DETAILS } from '../csv/types.js';
import { PersistenceError } from '../persistence/database.js';
import type { ImportRepository, StoredImport } from '../persistence/import-repository.js';

export type ImportStore = Pick<ImportRepository, 'findImportByHash' | 'findExistingSkus' | 'createImport'>;

interface ConfirmedImport {
  importacion_id: string;
  estado: 'completada';
  productos_importados: number;
}

interface ConflictError {
  codigo: 'SKU_ALREADY_EXISTS';
  mensaje: string;
  detalles: { fila: number; campo: 'sku'; codigo: 'SKU_ALREADY_EXISTS'; motivo: string }[];
  errores_truncados: boolean;
}

export type ImportResult =
  | { kind: 'created' | 'existing'; importacion: ConfirmedImport }
  | { kind: 'invalid'; error: CsvFailure['error'] }
  | { kind: 'conflict'; error: ConflictError }
  | {
    kind: 'persistence_error';
    commit: 'not_confirmed' | 'unknown';
    error: {
      codigo: 'PERSISTENCE_ERROR' | 'SERVICE_UNAVAILABLE';
      mensaje: string;
      detalles: [];
      errores_truncados: false;
    };
  };

function success(kind: 'created' | 'existing', record: StoredImport): ImportResult {
  return {
    kind,
    importacion: {
      importacion_id: record.id,
      estado: 'completada',
      productos_importados: record.productos_importados,
    },
  };
}

function technical(error: unknown, uncertain = false): ImportResult {
  const code = error instanceof PersistenceError ? error.code : '';
  const unavailable = uncertain || code.startsWith('08') ||
    ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', '57P01', '57P02', '57P03', '55P03', '57014', '40P01', '40001'].includes(code);
  return {
    kind: 'persistence_error',
    commit: uncertain ? 'unknown' : 'not_confirmed',
    error: {
      codigo: unavailable ? 'SERVICE_UNAVAILABLE' : 'PERSISTENCE_ERROR',
      mensaje: uncertain
        ? 'No se pudo confirmar el resultado. Reintenta con los mismos bytes del archivo.'
        : 'No se ha confirmado la importación. No se pudo completar la operación de persistencia.',
      detalles: [],
      errores_truncados: false,
    },
  };
}

function conflict(products: NormalizedProduct[], skus: string[]): ImportResult {
  const existing = new Set(skus);
  const details: ConflictError['detalles'] = [];
  let count = 0;
  products.forEach((p, index) => {
    if (!existing.has(p.sku)) return;
    count++;
    if (details.length < MAX_ERROR_DETAILS) {
      details.push({
        fila: index + 2, campo: 'sku', codigo: 'SKU_ALREADY_EXISTS',
        motivo: 'El SKU ya pertenece a una importación confirmada.',
      });
    }
  });
  return { kind: 'conflict', error: {
    codigo: 'SKU_ALREADY_EXISTS',
    mensaje: 'El archivo contiene productos ya registrados.',
    detalles: details,
    errores_truncados: count > MAX_ERROR_DETAILS,
  } };
}

/** Coordinación de dominio; no conoce Express, nombres de archivo ni códigos HTTP. */
export class ImportService {
  constructor(private readonly repository: ImportStore) {}

  async importCsv(content: Uint8Array): Promise<ImportResult> {
    // Validación y hash síncronos antes del primer await: ambos usan los mismos bytes.
    const validated = processProductsCsv(content);
    if (!validated.ok) return { kind: 'invalid', error: validated.error };
    const hash = createHash('sha256').update(content).digest('hex');
    const products = validated.productos;
    const skus = products.map((p) => p.sku);
    let uncertain = false;

    try {
      const completed = await this.repository.findImportByHash(hash);
      if (completed) return success('existing', completed);
      const existing = await this.repository.findExistingSkus(skus);
      if (existing.length > 0) {
        // Una solicitud idéntica puede haber confirmado después de la primera lectura.
        const recovered = await this.repository.findImportByHash(hash);
        return recovered ? success('existing', recovered) : conflict(products, existing);
      }

      try {
        return success('created', await this.repository.createImport({ sha256: hash, productos: products }));
      } catch (error) {
        uncertain = error instanceof PersistenceError && error.commitUncertain;
        const unique = error instanceof PersistenceError && error.code === '23505';
        if (!unique && !uncertain) return technical(error);

        // createImport ya ha intentado rollback y liberado/descartado su cliente.
        // Estas lecturas usan una nueva transacción/snapshot y solo ven datos confirmados.
        const recovered = await this.repository.findImportByHash(hash);
        if (recovered) return success('existing', recovered);
        if (uncertain) return technical(error, true);
        if (error instanceof PersistenceError && error.constraint === 'productos_sku_unique') {
          const conflicts = await this.repository.findExistingSkus(skus);
          if (conflicts.length > 0) {
            const latest = await this.repository.findImportByHash(hash);
            return latest ? success('existing', latest) : conflict(products, conflicts);
          }
        }
        // Una PK, una huella sin resultado recuperable u otra UNIQUE no es un conflicto de SKU.
        return technical(error);
      }
    } catch (error) {
      return technical(error, uncertain);
    }
  }
}
