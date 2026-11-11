CREATE TABLE importaciones (
  id uuid PRIMARY KEY,
  sha256 text COLLATE "C" NOT NULL,
  version_contrato text NOT NULL,
  productos_importados integer NOT NULL,
  creada_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT importaciones_sha256_unique UNIQUE (sha256),
  CONSTRAINT importaciones_sha256_format CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT importaciones_version_check CHECK (version_contrato = 'csv-v1'),
  CONSTRAINT importaciones_cantidad_check CHECK (productos_importados BETWEEN 1 AND 10000)
);

CREATE TABLE productos (
  id uuid PRIMARY KEY,
  sku text COLLATE "C" NOT NULL,
  nombre text NOT NULL,
  precio_centimos integer NOT NULL,
  stock integer NOT NULL,
  importacion_id uuid NOT NULL,
  CONSTRAINT productos_sku_unique UNIQUE (sku),
  CONSTRAINT productos_sku_format CHECK (sku ~ '^[A-Z0-9][A-Z0-9_-]{0,63}$'),
  CONSTRAINT productos_nombre_check CHECK (
    char_length(nombre) BETWEEN 1 AND 120
    AND nombre IS NFC NORMALIZED
    AND nombre = btrim(nombre, E' \t')
    AND nombre !~ U&'[\0001-\001F\007F-\009F\2028\2029]'
  ),
  CONSTRAINT productos_precio_check CHECK (precio_centimos BETWEEN 0 AND 99999999),
  CONSTRAINT productos_stock_check CHECK (stock BETWEEN 0 AND 1000000),
  CONSTRAINT productos_importacion_fk FOREIGN KEY (importacion_id)
    REFERENCES importaciones(id) ON UPDATE RESTRICT ON DELETE RESTRICT
);

-- Las PK y UNIQUE ya crean índices; la FK necesita este índice para consultas.
CREATE INDEX productos_importacion_idx ON productos (importacion_id);
