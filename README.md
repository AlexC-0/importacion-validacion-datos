# Importación y validación de datos

API REST para importar catálogos de productos desde CSV, detectar datos inválidos
y duplicados, y guardar únicamente importaciones completas en PostgreSQL.
Permite consultar los productos y el historial de importaciones confirmadas.

Proyecto 01 de CHAMBA DIARIA. Pensado para personas que preparan catálogos y
equipos técnicos que los envían mediante HTTP; no implica usuarios reales ni
uso en producción.

## Estado y evidencia

V1 funcional implementada y técnicamente preparada para cierre formal.
La sesión 09.1 está publicada en
[90b0066](https://github.com/AlexC-0/importacion-validacion-datos/commit/90b0066e7210cbecd6dc06dce0ddc6db5813033b).
Su [CI 43102797061](https://github.com/AlexC-0/importacion-validacion-datos/actions/runs/43102797061)
terminó en **SUCCESS** el 11 de noviembre de 2026: instalación, tipos,
364 pruebas normales, compilación, migraciones y 89 pruebas de integración.

Son **453 pruebas** sobre ese commit. La documentación de la sesión 10 queda
pendiente de revisión, publicación manual y CI de su propio commit para el
cierre definitivo. No hay despliegue público, tag ni release. La versión de
package.json sigue siendo `0.1.0`; V1 denomina el alcance funcional.

## Capacidades

- CSV estricto UTF-8, normalización de SKU/nombres y precios exactos en céntimos.
- Errores estructurados por fila/campo; duplicados internos y límites verificados.
- Una transacción por importación: sin productos parcialmente aceptados.
- Recuperación de archivos idénticos ya confirmados, incluso bajo concurrencia.
- Conflictos de SKU rechazados sin upsert.
- Consultas paginadas con totales y filtro de productos por importación.

| Método y ruta | Comportamiento |
| --- | --- |
| GET /health | 200 y `{"status":"ok"}`; comprueba HTTP, no la conexión SQL |
| POST /importaciones | Multipart, un archivo en `archivo`; 201 al crear, 200 al recuperar los mismos bytes, 409 por SKU existentes en otro archivo |
| GET /productos | Lista por SKU, limit/offset y filtro opcional importacion_id |
| GET /importaciones | Historial por fecha e ID descendentes, limit/offset |
| GET /importaciones/:id | Metadatos y SHA-256; 404 si el UUID válido no existe |

Los errores distinguen estructura/solicitud (400), tamaño (413), tipo (415),
datos (422) y fallos técnicos (500/503). Un 503 de COMMIT incierto no demuestra
ausencia de escrituras: se reintentan los mismos bytes para recuperar evidencia.

## Tecnologías y arquitectura

Node.js 24 (>=24.13.0 y <25), TypeScript estricto con NodeNext, Express,
PostgreSQL 18 y pg. Multiparty recibe el archivo y content-type valida MIME.
Vitest/Supertest prueban el comportamiento; tsx ejecuta el código en desarrollo.
Versiones resueltas en package-lock.json. GitHub Actions ejecuta CI en Linux.

~~~mermaid
flowchart LR
  H["HTTP / Express"] --> S["ImportService"]
  S --> C["Procesador CSV"]
  S --> R["ImportRepository / pg"]
  H -->|Consultas| R
  R --> P[("PostgreSQL")]
~~~

`src/http/` recibe/valida solicitudes y traduce respuestas;
`src/csv/` procesa bytes sin I/O; `src/imports/` coordina huellas y resultados;
`src/persistence/` encapsula SQL parametrizado y transacciones.
`src/server.ts` compone un pool compartido y gestiona arranque/cierre.
`migrations/` contiene el esquema versionado. No se utiliza ORM.

## Instalación y configuración

Trabaja en una carpeta independiente con Node.js 24 y npm:

~~~sh
npm ci
~~~

Prepara dos bases PostgreSQL 18 UTF-8 propias: desarrollo y
`importacion_validacion_datos_test`. Sigue [PERSISTENCIA](docs/PERSISTENCIA.md)
para Windows o [VALIDACION_V1](docs/VALIDACION_V1.md#configuración-y-migraciones)
para otra instancia/Linux.

Si todavía no existe `.env`, copia `.env.example` con `Copy-Item` en
PowerShell o `cp -n` en Linux y completa las credenciales en tu editor.
El inicializador Windows genera su propio .env: no lo crees antes de Initialize.

- DATABASE_URL identifica desarrollo.
- TEST_DATABASE_URL identifica exclusivamente la base de integración.
- PORT es opcional, por defecto 3000.
- .env y .local están excluidos de Git; no publiques credenciales.
- Las variables del proceso prevalecen sobre .env.

En la máquina del proyecto PostgreSQL ya está instalado. Comprueba
`npm run db:local -- -Action Status` y usa Start si está detenido.
**No repitas Initialize sobre el cluster existente.**
El script db:local es específico de Windows; no se necesita XAMPP ni MySQL.
Docker solo se usa como servicio del runner de CI, no es obligatorio localmente.

Con tu base de desarrollo configurada:

~~~sh
npm run db:migrate
npm run dev
~~~

La migración se reaplica sin duplicar el esquema y no se ejecuta al arrancar
la API. El servidor escucha únicamente en `127.0.0.1`. Detenlo con Ctrl+C.
Sin DATABASE_URL, health funciona; las operaciones que necesitan persistencia
responden 503. Para ejecutar compilado:

~~~sh
npm run build
npm start
~~~

## Ejemplo de uso

Guarda `productos.csv` en UTF-8:

~~~csv
sku,nombre,precio_eur,stock
DEMO-V1,Café,0.29,2
~~~

Con la API activa, en otra terminal:

~~~sh
curl -i http://127.0.0.1:3000/health
curl -i -F "archivo=@productos.csv;type=text/csv" http://127.0.0.1:3000/importaciones
curl -i "http://127.0.0.1:3000/productos?limit=20&offset=0"
curl -i "http://127.0.0.1:3000/importaciones?limit=20&offset=0"
~~~

En Windows PowerShell usa `curl.exe`. El ejemplo inserta un producto en la
base configurada si ese SKU no existe. Respuesta 201, con UUID ilustrativo:

~~~json
{
  "importacion_id": "23b6697c-108d-443a-92c4-18681f7a2eed",
  "estado": "completada",
  "productos_importados": 1
}
~~~

Reenviar exactamente los mismos bytes devuelve 200 con ese mismo resultado.
El producto consultado conserva `precio_centimos: 29` y `stock: 2`.
Para obtener detalle o filtrar, sustituye el UUID recibido en
`/importaciones/<UUID>` o `/productos?importacion_id=<UUID>`.
Los [ejemplos de consulta](docs/HTTP_CONSULTAS.md) y
[errores de importación](docs/HTTP_IMPORTACIONES.md) detallan los cuerpos JSON.

## Comprobaciones automatizadas

~~~sh
npm run typecheck
npm test
npm run build
npm run test:integration
~~~

- npm test (equivalente a npm run test): 364 pruebas, sin PostgreSQL.
- test:integration: 89 pruebas reales; exige su base exclusiva y build previo.
- test:watch observa las pruebas normales. Su glob está entrecomillado para
  evitar que Bash expanda nombres de archivo antes de llegar a Vitest.
- La integración crea/elimina solo sus esquemas propios; falla si no está
  configurada. Incluye el arranque y cierre del servidor compilado.
- [ci.yml](.github/workflows/ci.yml) ejecuta instalación, tipos, pruebas, build,
  migración/reaplicación e integración con PostgreSQL 18; push a main o manual.

La [matriz de aceptación](docs/VALIDACION_V1.md#matriz-de-aceptación) relaciona
criterios y suites. Los resultados remotos y locales se registran por separado
en [STATUS](docs/STATUS.md); no se atribuyen a commits posteriores.

## Límites y exclusiones de V1

CSV de hasta 5 MiB, 10000 productos, un archivo por solicitud y 100 detalles
de error. Cuerpo multipart máximo: 5308416 bytes. UTF-8, coma, cabecera fija
`sku,nombre,precio_eur,stock`, LF/CRLF y sin campos multilínea.
Listados: limit 20 por defecto, máximo 100.

No hay frontend, autenticación, edición/eliminación, integraciones externas ni
despliegue público. No se certifica rendimiento a gran escala: no hay pruebas
de carga. COMMIT incierto se prueba con fallos del driver, sin cortes físicos
de red. OFFSET no garantiza una instantánea común entre distintas solicitudes.
Estas exclusiones no son tareas obligatorias para cerrar el alcance aprobado.

## Documentación y mantenimiento

- [Evidencias V1](docs/EVIDENCIAS_V1.md): capacidades, decisiones, alternativas y CI.
- [Validación V1](docs/VALIDACION_V1.md): reproducción, matriz y cierre formal.
- [Contrato CSV](docs/CONTRATO_CSV.md): decisiones D01–D10 aprobadas.
- [Persistencia](docs/PERSISTENCIA.md): esquema, configuración y concurrencia.
- [Importaciones HTTP](docs/HTTP_IMPORTACIONES.md) y [consultas HTTP](docs/HTTP_CONSULTAS.md).
- [Alcance](docs/PROJECT_BRIEF.md), [estado e historial](docs/STATUS.md) e
  [instrucciones para Codex](AGENTS.md).

Todos los commits y push corresponden exclusivamente a Alex desde GitHub
Desktop. Codex deja los cambios locales para revisión, sin staging ni publicación.
