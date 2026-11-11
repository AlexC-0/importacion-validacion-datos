import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type { NormalizedProduct } from '../csv/types.js';
import { inTransaction, persistenceError, PersistenceError } from './database.js';

export interface StoredImport {
  id: string;
  sha256: string;
  version_contrato: string;
  productos_importados: number;
  creada_en: Date;
}

export interface StoredProduct extends NormalizedProduct {
  id: string;
  importacion_id: string;
}

export class ImportRepository {
  constructor(private readonly pool: Pool) {}

  /** Solo productos ya validados. La huella corresponde a los bytes originales del CSV. */
  async createImport(input: {
    sha256: string;
    productos: readonly NormalizedProduct[];
    versionContrato?: 'csv-v1';
  }): Promise<StoredImport> {
    // Copiar antes del primer await evita cambios del llamador durante la transacción.
    const productos = input.productos.map((product) => ({ ...product }))
      .sort((a, b) => a.sku < b.sku ? -1 : a.sku > b.sku ? 1 : 0);
    const sha256 = input.sha256;
    const version = input.versionContrato ?? 'csv-v1';
    if (
      productos.length < 1 || productos.length > 10000 ||
      productos.some((p) => !Number.isSafeInteger(p.precio_centimos) || !Number.isSafeInteger(p.stock))
    ) {
      throw new PersistenceError('INVALID_PRODUCTS');
    }
    return inTransaction(this.pool, async (client) => {
      const imported = await client.query<StoredImport>(
        'INSERT INTO importaciones (id, sha256, version_contrato, productos_importados) ' +
        'VALUES ($1, $2, $3, $4) RETURNING id, sha256, version_contrato, productos_importados, creada_en',
        [randomUUID(), sha256, version, productos.length],
      );
      const result = imported.rows[0];
      for (const p of productos) {
        await client.query(
          'INSERT INTO productos (id, sku, nombre, precio_centimos, stock, importacion_id) ' +
          'VALUES ($1, $2, $3, $4, $5, $6)',
          [randomUUID(), p.sku, p.nombre, p.precio_centimos, p.stock, result.id],
        );
      }
      return result;
    });
  }

  /** Consulta en bloque; los límites de detalle y el orden de filas pertenecen al servicio. */
  async findExistingSkus(skus: readonly string[]): Promise<string[]> {
    try {
      const result = await this.pool.query<{ sku: string }>(
        'SELECT sku FROM productos WHERE sku = ANY($1::text[])', [skus],
      );
      return result.rows.map((row) => row.sku);
    } catch (error) { throw persistenceError(error); }
  }

  async findImportById(id: string): Promise<StoredImport | null> {
    try {
      const result = await this.pool.query<StoredImport>('SELECT * FROM importaciones WHERE id = $1', [id]);
      return result.rows[0] ?? null;
    } catch (error) { throw persistenceError(error); }
  }

  async findImportByHash(sha256: string): Promise<StoredImport | null> {
    try {
      const result = await this.pool.query<StoredImport>('SELECT * FROM importaciones WHERE sha256 = $1', [sha256]);
      return result.rows[0] ?? null;
    } catch (error) { throw persistenceError(error); }
  }

  async findProductBySku(sku: string): Promise<StoredProduct | null> {
    try {
      const result = await this.pool.query<StoredProduct>('SELECT * FROM productos WHERE sku = $1', [sku]);
      return result.rows[0] ?? null;
    } catch (error) { throw persistenceError(error); }
  }

  async listProductsByImport(id: string): Promise<StoredProduct[]> {
    try {
      const result = await this.pool.query<StoredProduct>(
        'SELECT * FROM productos WHERE importacion_id = $1 ORDER BY sku', [id],
      );
      return result.rows;
    } catch (error) { throw persistenceError(error); }
  }
}
