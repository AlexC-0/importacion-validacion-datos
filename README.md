# Importación y validación de datos

Una API REST para importar productos desde
archivos CSV, validar los datos y guardar importaciones válidas en PostgreSQL.

## Estado actual

La base de la sesión 01 está publicada en el repositorio público
[AlexC-0/importacion-validacion-datos](https://github.com/AlexC-0/importacion-validacion-datos),
en la rama principal `main`, con el commit inicial `852e829`.
La versión actual del proyecto en `package.json` es `0.1.0`.

Está preparada la API con Express y TypeScript, el endpoint `GET /health`
y su prueba con Vitest y Supertest. La documentación de la sesión 02 se publicó
en `cb89a65` y quedó integrada en `main` mediante `52bc5c1`.

Durante la sesión 03, Alex Cobián aprobó D01–D10 del
[contrato CSV V1](docs/CONTRATO_CSV.md): una importación nueva confirmada devuelve
201; el reenvío exacto recupera el resultado existente con 200, sin nuevas
inserciones; otro archivo con SKU existentes devuelve 409.
La sesión 03 está publicada en `47278b3`. La sesión 07 implementa esas respuestas
mediante `POST /importaciones`.

La sesión 04 está publicada en `b1cb2e2` e incorpora un procesador CSV independiente de HTTP y persistencia.
Valida los bytes originales, normaliza productos, detecta SKU duplicados dentro
del archivo y devuelve errores por fila y campo, sin productos parcialmente aceptados.

La sesión 05 está publicada en `59dbc42` e incorpora PostgreSQL local, migración del esquema y persistencia
transaccional de importaciones y productos, con consultas internas y pruebas reales.

La sesión 06 está publicada en `f4b63e3` e incorpora un servicio que coordina validación, huella de bytes,
creación transaccional, conflictos, reintentos y solicitudes concurrentes.

La sesión 07 está publicada en `96a9ae0` y añade `POST /importaciones`: recepción multipart, límites de bytes,
validación, persistencia e idempotencia con las respuestas aprobadas.
La sesión 08 está publicada en `cb4e48c` y añade `GET /productos`,
`GET /importaciones` y su detalle por UUID,
con paginación y consultas de solo lectura. `GET /health` conserva su comportamiento.
La sesión 09 prepara la candidata V1: aceptación del servidor compilado,
corrección de indisponibilidad PostgreSQL y CI. Las 453 pruebas pasan localmente;
la ejecución remota de Actions sigue pendiente de publicación manual.
Consulta la [guía de validación V1](docs/VALIDACION_V1.md).
No hay despliegue ni cierre definitivo de V1.

## Tecnologías y requisitos

- Node.js 24 LTS, versión 24.13.0 o superior dentro de la rama 24.
- npm (comprobación inicial con 11.6.2).
- TypeScript y Express; multiparty para recepción y content-type para cabeceras MIME.
- Vitest y Supertest para pruebas; tsx para ejecutar TypeScript en desarrollo.
- Git y GitHub para control de versiones.
- PostgreSQL 18 y driver pg para persistencia; no se requieren para `/health` ni `npm test`.
- Docker es opcional. Apache, PHP y MySQL no participan en esta API.

Las versiones exactas de las dependencias quedan fijadas en `package-lock.json`.

## Instalación

Abre esta carpeta como proyecto independiente en VS Code y ejecuta:

```powershell
npm ci
```

Para preparar la instancia PostgreSQL local desde una copia nueva, consulta
[PERSISTENCIA](docs/PERSISTENCIA.md). Su inicializador genera `.env` sin sobrescribir
archivos existentes. En la máquina de esta sesión ya está preparado.

Si configuras otra instancia propia y todavía no existe `.env`, puedes crear
la configuración de ejemplo:

```powershell
Copy-Item .env.example .env
```

`.env` está excluido de Git. `PORT` conserva el valor predeterminado `3000`
y rango 1..65535. `DATABASE_URL` configura la persistencia y
`TEST_DATABASE_URL` identifica la base exclusiva de pruebas.
Los scripts correspondientes leen `.env`; las variables del proceso tienen
prioridad. No copies credenciales reales a archivos versionados.

## Ejecutar la API

```powershell
npm run dev
```

El proceso se reinicia al cambiar el código. Para detenerlo, pulsa `Ctrl+C`.

En otra terminal:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/health
```

Respuesta HTTP 200, con Content-Type JSON:

```json
{ "status": "ok" }
```

Este endpoint confirma que el proceso HTTP responde; no comprueba
conexión con una base de datos. El servidor escucha únicamente en
`127.0.0.1` para trabajar en local. Si el puerto está ocupado, cambia `PORT`.

Para compilar y ejecutar JavaScript:

```powershell
npm run build
npm start
```

## Importar productos mediante HTTP

Configura `DATABASE_URL` en el entorno local, comprueba la instancia PostgreSQL
existente con `npm run db:local -- -Action Status` y aplica `npm run db:migrate`
si corresponde. El arranque de la API no crea ni modifica tablas automáticamente.

Con un archivo UTF-8 que respete la cabecera `sku,nombre,precio_eur,stock`:

~~~powershell
curl.exe -i -F "archivo=@productos.csv;type=text/csv" http://127.0.0.1:3000/importaciones
~~~

Una nueva importación confirmada devuelve 201. Reenviar exactamente los mismos
bytes devuelve 200 con el identificador y cantidad originales. Otro archivo con
SKU existentes devuelve 409 sin inserciones parciales.

Consulta [HTTP_IMPORTACIONES](docs/HTTP_IMPORTACIONES.md) para ejemplos, errores,
límites, mecanismo multipart y ciclo de vida del servidor. Sin `DATABASE_URL`,
health sigue operativo; un CSV válido recibe 503 y uno inválido conserva su
error de validación. Con URL configurada pero PostgreSQL no disponible, el servicio
devuelve el error técnico correspondiente.

## Consultar productos e importaciones

~~~powershell
curl.exe -i "http://127.0.0.1:3000/productos?limit=20&offset=0"
curl.exe -i "http://127.0.0.1:3000/importaciones?limit=20&offset=0"
# Sustituye este UUID por uno obtenido del listado o de una importación:
curl.exe -i "http://127.0.0.1:3000/importaciones/a2c10e86-a049-4d16-8f92-9023b3f44001"
~~~

Los listados devuelven la lista y `paginacion` con limit, offset y total.
limit es 20 por defecto, entre 1 y 100; offset parte de 0.
Productos se ordenan por SKU y admiten filtro `importacion_id`.
Importaciones se ordenan por fecha e ID descendentes; el detalle incluye SHA-256.
Los precios se devuelven en céntimos enteros y las fechas en UTC.

Parámetros inválidos devuelven 400; un detalle inexistente, 404 NOT_FOUND.
Una página vacía conserva su total real. Consultas sin persistencia disponible
responden 503; health permanece operativo.
Consulta [HTTP_CONSULTAS](docs/HTTP_CONSULTAS.md) para las reglas completas,
formatos, errores y límites de paginación entre peticiones concurrentes.

## Procesador CSV

La función `processProductsCsv(content: Uint8Array)`, en
`src/csv/process-products-csv.ts`, admite también `Buffer`. Recibe los bytes
originales para comprobar UTF-8 y tamaño; no modifica la entrada ni realiza I/O.

Ejemplo desde un archivo TypeScript en la raíz del proyecto:

```typescript
import { processProductsCsv } from './src/csv/process-products-csv.js';

const resultado = processProductsCsv(Buffer.from(
  'sku,nombre,precio_eur,stock\n ab-01 ,Café molido,12.50,10',
  'utf8',
));

if (resultado.ok) {
  console.log(resultado.productos);
  // [{ sku: 'AB-01', nombre: 'Café molido', precio_centimos: 1250, stock: 10 }]
} else {
  console.log(resultado.error);
}
```

El resultado es una unión tipada:

- `ok: true`: `productos` con SKU, nombre, precio en céntimos enteros y stock.
- `ok: false`: `error` con código, mensaje, detalles por fila/campo e indicador
  `errores_truncados`; nunca incluye productos.

Se comprueba toda la estructura antes de validar datos para conservar la
prioridad contractual de errores. Se aplican límites inclusivos de 5 MiB de bytes
originales, 10000 productos y 100 detalles de error devueltos.

El parser está acotado al contrato: al prohibir campos multilínea, permite
controlar las filas físicas directamente sin añadir dependencias.
La normalización recorta únicamente espacios ASCII y tabuladores en extremos,
convierte SKU ASCII a mayúsculas y nombres a NFC. Los precios se convierten a
céntimos mediante dígitos enteros, sin redondeo ni aritmética decimal binaria.

Dos llamadas con los mismos bytes vuelven a validarlos: este componente no
registra importaciones ni aplica la idempotencia persistente D09/D10.
Su éxito significa datos válidos en memoria, no una importación confirmada.

## Persistencia PostgreSQL

La capa de `src/persistence/` registra una importación y todos sus productos en
una transacción y permite consultarlos por identificador, huella o SKU.
Los errores revierten las escrituras; las restricciones SQL impiden SKU/huellas
duplicados, referencias inexistentes y valores fuera de rango.

El entorno autorizado usa PostgreSQL 18.6 en `127.0.0.1:55432`, sin servicio de
Windows. Desarrollo y pruebas tienen bases distintas. Los binarios, datos,
logs y credenciales locales están excluidos de Git.

```powershell
npm run db:local -- -Action Status
# Si está detenido:
npm run db:local -- -Action Start
npm run db:migrate
npm run build
npm run test:integration
# Para detenerlo al terminar de trabajar:
npm run db:local -- -Action Stop
```

Consulta [el diseño y la preparación desde cero](docs/PERSISTENCIA.md) para las
variables, tablas, migraciones y uso de `ImportRepository`.
La sesión 05 añadió `pg` y `@types/pg`. La capa SQL se utiliza mediante
`ImportService` para coordinar reintentos y conflictos; la ruta HTTP de la
sesión 07 traduce sus resultados sin duplicar esas reglas.

## Servicio de importación

`ImportService`, en `src/imports/import-service.ts`, recibe los bytes originales
y reutiliza el procesador CSV y `ImportRepository`. No depende de Express.

```typescript
import { ImportService } from './src/imports/import-service.js';
import { ImportRepository } from './src/persistence/import-repository.js';
import { createDatabasePool, requiredDatabaseUrl } from './src/persistence/database.js';

const pool = createDatabasePool(requiredDatabaseUrl());
try {
  const service = new ImportService(new ImportRepository(pool));
  const result = await service.importCsv(Buffer.from(
    'sku,nombre,precio_eur,stock\nA-1,Café,0.29,2',
  ));
  console.log(result.kind);
} finally {
  await pool.end();
}
```

El resultado distingue `created`, `existing`, `invalid`, `conflict` y
`persistence_error`. Los dos éxitos contienen el mismo formato de
`importacion`: identificador, estado completada y cantidad original.
Un error técnico distingue `commit: not_confirmed` de `commit: unknown`;
el segundo requiere reintentar los mismos bytes para resolver la incertidumbre.

Solo bytes exactamente iguales recuperan una importación existente.
Cambiar BOM, finales de línea, espacios u orden produce otra huella y puede
generar conflictos de SKU. Los conflictos conservan filas originales, campo
`sku` y el límite de 100 detalles. Un CSV inválido no accede a PostgreSQL.

Las restricciones únicas coordinan las escrituras simultáneas. Tras rollback,
la huella confirmada tiene prioridad sobre el conflicto de SKU. Los tiempos de
espera son finitos y no hay bucles de reintento de escrituras.
Consulta [PERSISTENCIA](docs/PERSISTENCIA.md) para las garantías y limitaciones.

## Pruebas y comprobaciones

```powershell
npm run typecheck
npm test
npm run build
npm run test:integration
```

`typecheck` comprueba los tipos de código y pruebas. `build` genera solo la
aplicación en `dist/`. La prueba HTTP valida estado 200, Content-Type y cuerpo
de `GET /health`; no necesita PostgreSQL ni un servidor iniciado.
Las pruebas CSV cubren sintaxis, normalización, gramáticas y rangos, duplicados,
localización y prioridad de errores, rechazo completo y límites.
Los casos grandes se construyen en memoria.

`npm test` ejecuta 364 pruebas sin PostgreSQL. Las 89 pruebas reales de
persistencia, coordinación, HTTP y aceptación del servidor compilado se ejecutan
con `npm run test:integration`, después de `npm run build`. Requieren la base
exclusiva `importacion_validacion_datos_test` y no se omiten silenciosamente
si falta configuración. Total: 453 casos.

La [matriz de aceptación y reproducción](docs/VALIDACION_V1.md) relaciona los
criterios con sus suites. El [workflow de CI](.github/workflows/ci.yml) prepara
estas comprobaciones en Linux con Node.js 24 y PostgreSQL 18. Su resultado
remoto solo podrá verificarse tras el commit y push manuales.

Para ejecutar solo el procesador:

```powershell
npm test -- tests/csv-parser.test.ts tests/csv-products.test.ts tests/csv-limits.test.ts
```

Para mantener Vitest observando cambios, usa `npm run test:watch`.
Los resultados de la última ejecución están en [STATUS](docs/STATUS.md).

## Estructura

```text
src/
  app.ts                 # Aplicación Express y rutas
  server.ts              # Arranque del servidor local
  http/
    receive-csv.ts        # Multipart, cabeceras, límites y cierre de streams
    import-route.ts       # Traducción de resultados a HTTP
    read-parameters.ts    # Paginación, UUID y validación de parámetros
    read-routes.ts        # Listados y detalle de solo lectura
  csv/
    process-products-csv.ts # Entrada pública: bytes y resultado tipado
    parse-csv.ts          # Sintaxis, cabecera, filas y columnas
    validate-products.ts  # Normalización, campos y duplicados internos
    types.ts              # Tipos, límites y errores
  imports/
    import-service.ts     # Coordinación, huellas, conflictos y reintentos
  persistence/
    database.ts           # Pool, transacción y errores técnicos
    import-repository.ts  # Inserciones y consultas parametrizadas
    migrate.ts            # Historial y aplicación de SQL versionado
    migrate-cli.ts        # Entrada del comando db:migrate
migrations/
  001_initial.sql         # Tablas, restricciones e índice de FK
scripts/
  local-postgres.ps1      # Preparación y ciclo de vida local en Windows
tests/
  health.test.ts         # Contrato HTTP de /health
  csv-parser.test.ts     # Codificación y estructura CSV
  csv-products.test.ts   # Validación y normalización
  csv-limits.test.ts     # Límites, prioridad y rechazo completo
  import-service.test.ts # Decisiones del servicio y errores técnicos
  import-http.test.ts    # Contrato HTTP y límites
  import-streams.test.ts # Interrupción, timeout y cierre de recepción
  read-parameters.test.ts # Gramáticas y rangos de consulta
  read-http.test.ts      # Respuestas, proyección y errores de lectura
  integration/acceptance.test.ts # Servidor compilado, flujo completo y cierre
  integration/read-http.test.ts # Paginación, confirmación y ausencia de escrituras
  helpers/multipart.ts  # Solicitudes construidas en memoria
  integration/import-http.test.ts # HTTP y PostgreSQL, carreras y rollback
  integration/persistence.test.ts # Pruebas reales en base aislada
  integration/import-service.test.ts # Carreras con conexiones independientes
docs/
  PROJECT_BRIEF.md        # Alcance y criterios de finalización
  STATUS.md               # Estado real y siguiente paso
  CONTRATO_CSV.md         # Contrato V1 aprobado
  PERSISTENCIA.md         # Modelo, configuración y pruebas PostgreSQL
  HTTP_IMPORTACIONES.md   # Uso de la ruta, respuestas y recepción multipart
  HTTP_CONSULTAS.md       # Contrato de las consultas, paginación y ejemplos
  VALIDACION_V1.md        # Matriz, reproducción y verificación pendiente de CI
.github/workflows/ci.yml  # CI Linux, Node.js 24 y PostgreSQL 18
AGENTS.md                 # Instrucciones operativas para Codex
.env.example              # Configuración local de ejemplo
package.json
package-lock.json
tsconfig.json
tsconfig.build.json
```

## Desarrollo y seguimiento

Consulta [el alcance](docs/PROJECT_BRIEF.md), [el estado](docs/STATUS.md) y
[las instrucciones operativas](AGENTS.md) antes de continuar.

Todos los commits y push los realiza exclusivamente el usuario desde GitHub
Desktop. Codex deja los cambios locales para revisión y propone un Summary
en castellano y una Description fiel al trabajo realizado; tiene prohibido
ejecutar `git commit`, `git push` o acciones equivalentes mientras el usuario
no modifique expresamente esta norma.

La sesión 08 está publicada en `cb4e48c`. La sesión 09 queda local,
pendiente de revisión, commit y push manuales.

Próximo paso: publicar manualmente y revisar la ejecución de GitHub Actions
para ese commit. Solo después podrá registrarse el cierre de V1.
Las pruebas de carga y de fallos físicos de red siguen pendientes.
