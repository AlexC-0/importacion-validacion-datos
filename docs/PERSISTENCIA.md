# Persistencia PostgreSQL — sesión 05

## Alcance disponible

PostgreSQL 18, driver pg y SQL versionado, sin ORM. La capa recibe productos
normalizados de processProductsCsv y una huella SHA-256 calculada por el llamador
sobre los bytes originales. No interpreta CSV, recibe multipart ni decide
respuestas HTTP. No registra intentos fallidos.

Las sesiones 04 y 05 están publicadas en b1cb2e2 y 59dbc42.
La sesión 06, publicada en f4b63e3, añade el servicio de coordinación descrito
a continuación. La sesión 07 lo expone mediante POST /importaciones; consulta
[HTTP_IMPORTACIONES](HTTP_IMPORTACIONES.md). La capa SQL conserva su independencia.

## Entorno local Windows

Alex autorizó descargar PostgreSQL y mantener una instancia aislada en
.local/, sin servicio de Windows ni cambios en Docker, WSL o XAMPP.

- PostgreSQL y psql comprobados: 18.6, binarios Windows x64 de EDB.
- Escucha exclusiva en 127.0.0.1:55432.
- Cluster UTF-8 en .local/data; locale C.
- Base de desarrollo: importacion_validacion_datos.
- Base de integración: importacion_validacion_datos_test.
- Rol de aplicación csv_app, sin privilegios de superusuario; propietario de
  esas dos bases. csv_admin se limita a la administración del cluster local.
- Autenticación SCRAM-SHA-256 y contraseñas aleatorias generadas localmente.
- Credenciales en .env y .local/admin.pgpass; ambos excluidos de Git.
- No hay arranque automático al encender Windows.

El script scripts/local-postgres.ps1 prepara el cluster y las bases. Initialize
se niega a sobrescribir un directorio de datos, marcador o .env existentes.
Start/Stop/Status verifican el marcador de propiedad del proyecto. No modifica
PATH, registro de Windows, reglas de firewall ni servicios.

Desde una copia nueva, antes de crear manualmente un .env:

~~~powershell
npm ci
npm run db:local -- -Action Initialize
npm run db:migrate
npm run test:integration
~~~

Initialize descarga los binarios si faltan; requiere autorización previa para
preparar software e iniciar el proceso. La URL fijada corresponde a PostgreSQL
18.6 en la [distribución de EDB](https://www.enterprisedb.com/download-postgresql-binaries),
enlazada desde [PostgreSQL para Windows](https://www.postgresql.org/download/windows/).
Si la descarga o inicialización falla, se conservan los archivos para diagnóstico:
no eliminar datos automáticamente ni repetir sobre una carpeta desconocida.

En esta máquina la inicialización ya está realizada. Para posteriores sesiones:

~~~powershell
npm run db:local -- -Action Status
npm run db:local -- -Action Stop
npm run db:local -- -Action Start
~~~

No ejecutar Initialize nuevamente para arrancar una instancia existente.
Los binarios, ZIP, datos, logs y credenciales locales nunca deben seleccionarse
para un commit.

## Usar otra instancia PostgreSQL 18

Preparar dos bases nuevas UTF-8 exclusivas del proyecto, con un usuario autorizado
para crear tablas y esquemas. No ejecutar migraciones sobre bases de otros
proyectos. Copiar .env.example a .env únicamente si no hay configuración propia,
y completar las URL locales sin publicar sus credenciales.

| Variable | Uso |
| --- | --- |
| PORT | Puerto de la API; no cambia su comportamiento |
| DATABASE_URL | Base de desarrollo para db:migrate y consumidores de persistencia |
| TEST_DATABASE_URL | Base exclusiva importacion_validacion_datos_test |

No existe fallback de TEST_DATABASE_URL a DATABASE_URL. La ejecución de integración
falla si falta su variable o apunta a otro nombre de base; no omite las pruebas.
Las variables del proceso tienen prioridad sobre .env.
GET /health y npm test no necesitan PostgreSQL.

## Modelo relacional

| Tabla/campo | Tipo y restricciones | Motivo |
| --- | --- | --- |
| importaciones.id | uuid, PRIMARY KEY | UUID generado con randomUUID; sin extensión SQL |
| importaciones.sha256 | text COLLATE C, NOT NULL, UNIQUE, 64 dígitos hexadecimales minúsculos | Identidad exacta del archivo original; no del nombre ni datos normalizados |
| importaciones.version_contrato | text, NOT NULL, CHECK csv-v1 | Registrar la versión realmente utilizada; otra versión exige revisión |
| importaciones.productos_importados | integer, NOT NULL, CHECK 1..10000 | Cantidad calculada desde la lista recibida |
| importaciones.creada_en | timestamptz, NOT NULL, CURRENT_TIMESTAMP | Instante de creación dentro de la transacción, no instante exacto del commit |
| productos.id | uuid, PRIMARY KEY | Identificador independiente del SKU |
| productos.sku | text COLLATE C, NOT NULL, UNIQUE y gramática ASCII de 1..64 | Solo SKU ya normalizado en mayúsculas |
| productos.nombre | text, NOT NULL, CHECK longitud/NFC/extremos/controles | 1..120 puntos de código; conservar el nombre aprobado |
| productos.precio_centimos | integer, NOT NULL, CHECK 0..99999999 | Céntimos exactos; sin float ni redondeo |
| productos.stock | integer, NOT NULL, CHECK 0..1000000 | Cantidad entera dentro del rango V1 |
| productos.importacion_id | uuid, NOT NULL, FOREIGN KEY | Toda fila referencia una importación existente |

La FK usa ON UPDATE RESTRICT y ON DELETE RESTRICT: impide referencias huérfanas
y borrados en cascada accidentales. El índice productos_importacion_idx permite
consultar por importación; PRIMARY KEY y UNIQUE ya crean sus índices.
No se añaden índices duplicados ni campos para administración futura.

Los CHECK no reparan ni normalizan los valores. La aplicación aporta productos
validados y la base refuerza las restricciones. La capa rechaza números no enteros
antes de enviarlos para evitar conversiones implícitas que redondeen.

La cantidad de productos se calcula y persiste junto con la lista en una única
transacción. No hay trigger que compare conteos entre tablas: escrituras SQL
manuales ajenas al repositorio podrían desajustar ese conteo. No se expone una
operación de edición ni borrado de catálogo.

## Migración

migrations/001_initial.sql crea importaciones, productos y su índice de FK.
src/persistence/migrate.ts mantiene schema_migrations con nombre, checksum SHA-256
y fecha de aplicación. Esta tabla es metadato técnico, no una entidad funcional.

~~~powershell
npm run db:migrate
~~~

En la primera aplicación exige un esquema vacío; no adopta tablas ajenas.
Se aplica SQL y registro de versión en una transacción. Las reaplicaciones son
un no-op; un checksum alterado o una versión desconocida abortan.
El checksum normaliza CRLF a LF para ser reproducible entre Windows y Linux.
No editar una migración ya aplicada: añadir una nueva al ampliar el esquema
y actualizar explícitamente el ejecutor, que actualmente conoce solo 001.

Un advisory lock transaccional serializa migraciones de la misma base/esquema.
Este bloqueo técnico no implementa la coordinación de solicitudes del importador.
No hay migraciones destructivas ni rollback automático de versiones publicadas.
La carpeta migrations debe acompañar al código compilado cuando se distribuya.

## Uso de la capa

~~~typescript
import { createHash } from 'node:crypto';
import { processProductsCsv } from '../csv/process-products-csv.js';
import { createDatabasePool, requiredDatabaseUrl } from './database.js';
import { ImportRepository } from './import-repository.js';

// Ejemplo desde src/persistence/: contenido original recibido por el llamador.
const contenido = Buffer.from('sku,nombre,precio_eur,stock\nA-1,Café,0.29,2');
const resultado = processProductsCsv(contenido);
if (!resultado.ok) throw new Error('CSV inválido; no llamar a persistencia.');

const pool = createDatabasePool(requiredDatabaseUrl());
try {
  const repository = new ImportRepository(pool);
  const importacion = await repository.createImport({
    sha256: createHash('sha256').update(contenido).digest('hex'),
    productos: resultado.productos,
  });
  const productos = await repository.listProductsByImport(importacion.id);
  console.log(importacion.id, productos.length);
} finally {
  await pool.end();
}
~~~

ImportRepository permite createImport, findImportById, findImportByHash,
findProductBySku y listProductsByImport. Las búsquedas de SKU esperan el valor
normalizado. Las consultas usan parámetros; valores de datos nunca forman SQL.

BEGIN, inserción de importación, inserciones de productos y COMMIT usan el mismo
cliente del pool. Ante fallo, ROLLBACK deshace la importación y sus productos.
El cliente se libera siempre; si el rollback falla, se descarta la conexión.
El pool se cierra con end por parte de quien lo crea.

Los errores propios exponen código técnico y nombre de restricción cuando existe,
sin detalles de consultas, credenciales ni valores. Por ejemplo, 23505 indica
unicidad; 23514, CHECK; 23503, referencia inexistente; 23001, operación impedida
por RESTRICT en PostgreSQL 18. No son todavía respuestas funcionales HTTP.

Una huella repetida sigue produciendo una infracción técnica de unicidad en la
capa SQL. ImportService la resuelve consultando de nuevo la huella confirmada.
No convierte cualquier 23505 en conflicto de SKU. La recuperación y la
incertidumbre de COMMIT se detallan en la sección siguiente.

## Coordinación e idempotencia — sesión 06

Entrada: ImportService.importCsv(Uint8Array). El servicio reutiliza
processProductsCsv e ImportRepository, sin Express ni nombres de archivo.

1. Validar CSV; un fallo devuelve invalid sin consultas ni escrituras.
2. Calcular SHA-256 de los bytes originales, antes del primer await.
3. Consultar la huella: si está confirmada, devolver existing.
4. Consultar SKU en bloque. Si hay conflictos, volver a consultar la huella:
   una solicitud idéntica pudo confirmar entre ambas lecturas.
5. Intentar crear importación y productos en una transacción. Solo un COMMIT
   reconocido permite devolver created.
6. Ante 23505, después del rollback y liberación del cliente, consultar la huella
   en una nueva lectura. Si existe, devolver existing con el resultado original.
7. Solo productos_sku_unique permite clasificar un conflicto funcional, tras
   comprobar los SKU reales y volver a priorizar la huella confirmada.
   Una PK, otra UNIQUE o una huella sin resultado recuperable son errores técnicos.

### Concurrencia sin bloqueo global

La huella se inserta antes de los productos. La restricción UNIQUE hace esperar
a un competidor idéntico hasta el commit o rollback de quien insertó primero.
Si confirma, el competidor recupera la importación; si revierte, puede insertarla.
No se usa ON CONFLICT DO NOTHING, upsert ni un mutex de proceso.

Los productos se insertan por SKU ASCII ordenado, sobre una copia de la lista,
para evitar ciclos de bloqueo debidos a órdenes opuestos entre archivos.
El servicio mantiene la lista original para localizar los errores por fila.
Dos archivos diferentes que comparten SKU no pueden confirmar ambos ese SKU.
Las inserciones del perdedor se revierten completamente.

Se usa READ COMMITTED explícito. Las lecturas posteriores al rollback solo ven
resultados confirmados y no conservan el snapshot de la transacción fallida.
No se añaden tablas ni se modifican migraciones publicadas.

La [comprobación de unicidad de PostgreSQL](https://www.postgresql.org/docs/18/index-unique-checks.html)
incluye la espera de transacciones pendientes; no se confía solo en una
consulta previa que pueda quedar desactualizada.

### Resultados de dominio

| kind | Contenido |
| --- | --- |
| created | importacion con importacion_id, estado completada y productos_importados |
| existing | Mismo formato, identificador y cantidad originales; ninguna nueva inserción |
| invalid | Error contractual del procesador CSV |
| conflict | SKU_ALREADY_EXISTS, detalles por fila/campo y truncamiento a 100 |
| persistence_error | PERSISTENCE_ERROR o SERVICE_UNAVAILABLE, mensaje seguro y certeza de commit |

Son resultados de dominio. El adaptador HTTP de la sesión 07 traduce
created/existing/conflict a 201/200/409 según el contrato y conserva el resto
de clasificaciones. No publica la propiedad interna commit.
Un error técnico no incluye credenciales, mensajes PostgreSQL, SQL ni datos
de sus excepciones. No se persisten intentos fallidos.

### Límites de espera y COMMIT incierto

El pool espera hasta 5 s por conexión. Cada transacción limita la espera de
bloqueos a 5 s y su duración a 30 s. Las sentencias tienen límite servidor de
15 s y las consultas límite cliente de 20 s. Son límites operativos finitos,
no una promesa de latencia total ni pruebas de carga.
No hay reintentos automáticos de escritura ni bucles ilimitados.

Un timeout o un bloqueo agotado devuelve error técnico controlado; no se
inventa un conflicto ni una recuperación si el resultado aún no está confirmado.

Si la conexión se interrumpe durante COMMIT, un ROLLBACK posterior no demuestra
que el commit no ocurrió. PersistenceError marca commitUncertain; el cliente
afectado se descarta y el servicio intenta una sola recuperación por huella.

- Si encuentra una importación confirmada, devuelve existing.
- Si no puede demostrar el resultado, devuelve persistence_error con
  commit: unknown y SERVICE_UNAVAILABLE. No afirma éxito ni ausencia de escrituras.
- Un reintento posterior con los mismos bytes vuelve a consultar la huella.
- commit: not_confirmed identifica fallos sin confirmación propia y sin
  incertidumbre de COMMIT detectada; no es un informe de ausencia global de datos.

La pérdida de respuesta se prueba inyectando un error en el límite del driver
después de un COMMIT ejecutado realmente en PostgreSQL, incluyendo fallo de la
consulta de recuperación y reintento posterior. No es una prueba de partición
física de red ni de caída del sistema operativo.

## Pruebas

~~~powershell
npm run typecheck
npm test
npm run build
npm run test:integration
~~~

npm test ejecuta 274 casos: 190 CSV/health, 34 del servicio y errores técnicos,
y 50 HTTP/streams, sin requerir base de datos. La integración ejecuta 74 casos
reales: 45 de persistencia, 18 de coordinación y 11 de HTTP, con migración desde cero,
reaplicación, rechazo de esquemas ajenos e historial alterado, inserción desde
CSV, exactitud de céntimos, Unicode, consultas, claves, rangos, unicidad,
rollback sin residuos y cierre/reutilización de conexiones.

Cada ejecución crea esquemas csv_test_<UUID> nuevos en la base exclusiva,
ejecuta las migraciones y elimina únicamente los esquemas creados por ella.
No vacía public, no trunca tablas compartidas y no reinicia bases existentes.
Una interrupción forzosa podría dejar un esquema de esa ejecución: inspeccionarlo
antes de cualquier limpieza manual.

La suite de coordinación usa pools independientes de una conexión, verifica
PID distintos y sincroniza las carreras después de las consultas iniciales.
Prueba cuatro archivos idénticos simultáneos, archivos distintos con SKU
compartidos y orden inverso, espera observable de una transacción pendiente,
commit/rollback del competidor, timeout, fallo de inserción y recuperación de
respuesta perdida. No son pruebas de carga ni cobertura de todo fallo de red.

Referencias técnicas: [transacciones con pg](https://node-postgres.com/features/transactions),
[consultas parametrizadas](https://node-postgres.com/features/queries) y
[restricciones PostgreSQL](https://www.postgresql.org/docs/18/ddl-constraints.html).
