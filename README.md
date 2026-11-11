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
La sesión 03 está publicada en `47278b3`. Esas respuestas HTTP pertenecen a
la futura importación persistida; todavía no existe `POST /importaciones`.

La sesión 04 está publicada en `b1cb2e2` e incorpora un procesador CSV independiente de HTTP y persistencia.
Valida los bytes originales, normaliza productos, detecta SKU duplicados dentro
del archivo y devuelve errores por fila y campo, sin productos parcialmente aceptados.

La sesión 05 incorpora PostgreSQL local, migración del esquema y persistencia
transaccional de importaciones y productos, con consultas internas y pruebas reales.

Quedan pendientes recepción multipart, nuevas rutas, clasificación funcional de
conflictos/reintentos y coordinación de solicitudes concurrentes.
La API sigue exponiendo únicamente `GET /health`. No hay despliegue.

## Tecnologías y requisitos

- Node.js 24 LTS, versión 24.13.0 o superior dentro de la rama 24.
- npm (comprobación inicial con 11.6.2).
- TypeScript y Express.
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

Este endpoint confirma que el proceso HTTP responde; todavía no comprueba
conexión con una base de datos. El servidor escucha únicamente en
`127.0.0.1` para trabajar en local. Si el puerto está ocupado, cambia `PORT`.

Para compilar y ejecutar JavaScript:

```powershell
npm run build
npm start
```

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
npm run test:integration
# Para detenerlo al terminar de trabajar:
npm run db:local -- -Action Stop
```

Consulta [el diseño y la preparación desde cero](docs/PERSISTENCIA.md) para las
variables, tablas, migraciones y uso de `ImportRepository`.
El driver `pg` y `@types/pg` son las únicas dependencias añadidas.
La capa aún no decide respuestas HTTP 200/201/409 ni coordina reintentos.

## Pruebas y comprobaciones

```powershell
npm run typecheck
npm test
npm run build
```

`typecheck` comprueba los tipos de código y pruebas. `build` genera solo la
aplicación en `dist/`. La prueba HTTP valida estado 200, Content-Type y cuerpo
de `GET /health`; no necesita PostgreSQL ni un servidor iniciado.
Las pruebas CSV cubren sintaxis, normalización, gramáticas y rangos, duplicados,
localización y prioridad de errores, rechazo completo y límites.
Los casos grandes se construyen en memoria.

`npm test` ejecuta las 190 pruebas existentes sin PostgreSQL. Las 45 pruebas
reales de persistencia se ejecutan por separado con `npm run test:integration`;
requieren la base exclusiva `importacion_validacion_datos_test` y no se omiten
silenciosamente si falta configuración.

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
  csv/
    process-products-csv.ts # Entrada pública: bytes y resultado tipado
    parse-csv.ts          # Sintaxis, cabecera, filas y columnas
    validate-products.ts  # Normalización, campos y duplicados internos
    types.ts              # Tipos, límites y errores
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
  integration/persistence.test.ts # Pruebas reales en base aislada
docs/
  PROJECT_BRIEF.md        # Alcance y criterios de finalización
  STATUS.md               # Estado real y siguiente paso
  CONTRATO_CSV.md         # Contrato V1 aprobado; implementación parcial
  PERSISTENCIA.md         # Modelo, configuración y pruebas PostgreSQL
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

Las sesiones 02, 03 y 04 ya están publicadas. La sesión 05 queda local,
pendiente de revisión, commit y push manuales.

Próximo paso recomendado: implementar el servicio que coordine validación,
huella, conflictos y persistencia, con pruebas de reintentos y concurrencia.
La recepción HTTP se integrará posteriormente respetando las respuestas del contrato.
