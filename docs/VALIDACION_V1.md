# Validación de la versión candidata V1 — sesión 09

Estado tras la revisión de la sesión 10: la corrección 09.1 está publicada en
[90b0066](https://github.com/AlexC-0/importacion-validacion-datos/commit/90b0066e7210cbecd6dc06dce0ddc6db5813033b).
Su [CI 43102797061](https://github.com/AlexC-0/importacion-validacion-datos/actions/runs/43102797061)
terminó en SUCCESS con 453 pruebas. **V1 está técnicamente preparada para cierre
formal**. Esta entrega documental sigue pendiente de revisión/publicación manual
y de verificar su propia CI antes del cierre definitivo. La evidencia anterior
no valida automáticamente ningún commit posterior. Véase [EVIDENCIAS_V1](EVIDENCIAS_V1.md).

La sesión 08 está publicada en `cb4e48c`. Las reglas de
[CONTRATO_CSV](CONTRATO_CSV.md), [HTTP_IMPORTACIONES](HTTP_IMPORTACIONES.md) y
[HTTP_CONSULTAS](HTTP_CONSULTAS.md) siguen siendo la referencia funcional.
No se añaden funcionalidades ni se cambian D01–D10.

## Matriz de aceptación

Todas las suites citadas pasaron localmente en 09/09.1 y en la CI Linux de
90b0066, sin omisiones. En la sesión 10 se revisan código, contratos y evidencia;
no se ejecuta de nuevo la suite porque no cambia el código.
Las rutas de pruebas son relativas a la raíz del repositorio.

| Área | Criterio y evidencia principal | Resultado verificado sobre 90b0066 |
| --- | --- | --- |
| A. Importación válida | `tests/integration/import-http.test.ts` y `acceptance.test.ts`: 201, UUID, cantidad y filas persistidas; céntimos 29/1250 y Unicode conservados | Correcto |
| B. Recuperación | `tests/integration/import-http.test.ts` y aceptación: mismos bytes → 200, mismo identificador/cantidad, filas y versiones sin cambios | Correcto |
| C. Conflicto | `tests/integration/import-http.test.ts` y aceptación: archivo diferente con SKU existente → 409, sin insertar el SKU nuevo ni modificar los previos | Correcto |
| D. Validación | `tests/csv-*.test.ts`, `tests/import-http.test.ts` y `tests/import-streams.test.ts`: cabeceras/datos inválidos, duplicados, límites, orden/localización de errores, truncamiento y recepción interrumpida | Correcto |
| E. Consultas | `tests/read-parameters.test.ts`, `tests/read-http.test.ts`, `tests/integration/read-http.test.ts`: listados/detalle, filtros/páginas/totales, 400/404, consultas read-only y datos confirmados | Correcto |
| F. Persistencia y concurrencia | `tests/integration/persistence.test.ts`, `tests/integration/import-service.test.ts`, `tests/integration/import-http.test.ts`: rollback, restricciones, carreras con conexiones distintas, reintentos y COMMIT incierto | Correcto |
| G. Estado y cierre | `tests/health.test.ts` y nueva `tests/integration/acceptance.test.ts`: proceso compilado real, health, flujo HTTP, salida 0 y cero conexiones propias después del cierre | Correcto en Windows y en CI Linux con SIGTERM real |

En la sesión 09 se reutilizaron las suites existentes y se añadieron dos casos: una regresión
para el error PostgreSQL 53300 y una aceptación con el proceso compilado real.
Esta última cubre la composición de `dist/server.js`, que las pruebas con
`createApp` no ejercitan; no vuelve a enumerar todas las combinaciones CSV.

El agotamiento de conexiones (53300) se respondía como 500 en importación.
La prueba falló primero con ese resultado; se corrigió su clasificación a
503 SERVICE_UNAVAILABLE, coherente con indisponibilidad temporal y las consultas.
No se modifican transacciones, restricciones ni dependencias.

## Requisitos e instalación

- Node.js 24, al menos 24.13.0; npm compatible con el lock.
- PostgreSQL 18 con bases UTF-8 propias y permisos para crear tablas/esquemas.
- Carpeta independiente del proyecto, con `migrations/` junto al código.
- Git solo para obtener/revisar código. Commit y push exclusivamente manuales.

Desde una copia nueva:

~~~sh
npm ci
npm run typecheck
npm test
npm run build
~~~

Estos comandos sirven en Windows y Linux. No requieren PostgreSQL.
`npm run db:local` es específico de Windows/PowerShell; **no se ejecuta en Linux**.

## Configuración y migraciones

En la máquina Windows del proyecto, la instancia ya existe. Comprueba
`npm run db:local -- -Action Status`; si está detenida, usa Start.
No vuelvas a ejecutar Initialize. Para una instalación Windows nueva sigue
[PERSISTENCIA](PERSISTENCIA.md#entorno-local-windows), incluida su autorización.

En Linux o con otra instancia PostgreSQL 18, prepara bases nuevas propias como
describe [usar otra instancia](PERSISTENCIA.md#usar-otra-instancia-postgresql-18).
Ejemplo SQL desde una sesión administrativa, solo si esos nombres no existen:

~~~sql
CREATE ROLE csv_app LOGIN;
~~~

En psql, asigna su contraseña con `\password csv_app` (solicitud interactiva,
sin ponerla en el historial SQL). Después:

~~~sql
CREATE DATABASE importacion_validacion_datos OWNER csv_app ENCODING 'UTF8' TEMPLATE template0;
CREATE DATABASE importacion_validacion_datos_test OWNER csv_app ENCODING 'UTF8' TEMPLATE template0;
~~~

El administrador debe configurar acceso local autenticado para ese rol.
No se requiere superusuario en la aplicación. Si ya existen esas bases/rol,
verifica su propiedad y finalidad antes de reutilizarlos; no los reinicialices.

Copia `.env.example` a `.env` solo si este no existe
(`Copy-Item` en Windows, `cp -n` en Linux). Completa en tu editor las URL
con credenciales locales y el puerto real. No publiques `.env`.
Codifica los caracteres reservados de usuario/contraseña al formar las URL.

- `DATABASE_URL`: desarrollo, base propia.
- `TEST_DATABASE_URL`: base exactamente `importacion_validacion_datos_test`,
  distinta de desarrollo.
- `PORT`: por defecto 3000. La API escucha en 127.0.0.1.

Las variables del proceso prevalecen sobre `.env`. No hay fallback entre bases.
Con PostgreSQL disponible:

~~~sh
npm run db:migrate
npm run db:migrate
npm run build
npm run test:integration
npm start
~~~

La segunda migración comprueba que la reaplicación no cambia el esquema.
No se editan migraciones publicadas. El arranque no migra automáticamente.
**Compila antes de la integración**: la nueva aceptación ejecuta
`dist/server.js`. Las pruebas crean y eliminan solo sus esquemas propios;
no limpian tablas compartidas ni datos de desarrollo.

## Comprobación HTTP manual

Usa una base de demostración propia: esta prueba manual guarda productos.
Crea `productos.csv` en UTF-8 con estos bytes lógicos:

~~~csv
sku,nombre,precio_eur,stock
DEMO-V1,Café,0.29,2
~~~

Desde otra terminal, mientras `npm start` está activo:

~~~sh
curl -i http://127.0.0.1:3000/health
curl -i -F "archivo=@productos.csv;type=text/csv" http://127.0.0.1:3000/importaciones
curl -i -F "archivo=@productos.csv;type=text/csv" http://127.0.0.1:3000/importaciones
curl -i "http://127.0.0.1:3000/productos?limit=20&offset=0"
curl -i "http://127.0.0.1:3000/importaciones?limit=20&offset=0"
~~~

En Windows PowerShell usa `curl.exe` para evitar el alias de PowerShell.
La primera importación devuelve 201; la repetición exacta, 200 con el mismo
resultado. Si ya habías importado ese SKU con otros bytes, habrá 409.
Consulta `/importaciones/<UUID>` y
`/productos?importacion_id=<UUID>` sustituyendo el UUID por el recibido.
Detén la API con Ctrl+C. Los formatos completos y ejemplos de errores están
en los contratos HTTP enlazados al comienzo.

## Resultados reproducidos en la sesión 09

| Comprobación | Proyecto principal | Copia limpia temporal |
| --- | --- | --- |
| npm ci | Dependencias existentes, lock intacto | Correcto: 167 paquetes, auditoría sin vulnerabilidades notificadas |
| npm run typecheck | Correcto | Correcto |
| npm test | 364 casos / 9 archivos | 364 casos / 9 archivos |
| npm run build | Correcto | Correcto |
| npm run test:integration | 89 casos / 5 archivos | 89 casos / 5 archivos |
| Migración inicial y reaplicación | Cubiertas en integración | Correctas además en base temporal nueva |
| API compilada real | Cubierta en aceptación | Arranque, 201/200, consultas, health y cierre correctos |

Son **453 casos distintos**, ejecutados en ambos entornos Windows; no 906 casos
diferentes. La copia partió de archivos versionables, incluidos los cambios de
esta sesión, sin `.git`, `.env`, `.local`, dependencias ni compilados.
Las credenciales se suministraron al proceso sin escribirlas en la copia.
Se usó la instancia existente, una nueva base temporal de desarrollo y la base
exclusiva de integración con esquemas propios. No se reinstaló PostgreSQL.

La base y carpeta temporales fueron eliminadas tras comprobar el cierre.
El `.env` original conservó su hash; desarrollo conserva cero importaciones
y cero productos. La aceptación verifica cero conexiones del proceso de API.
En Windows, IPC invoca el manejador SIGTERM de la aplicación; en Linux la prueba
envía SIGTERM real. Este segundo comportamiento pasó posteriormente en la
CI 43102797061; la sesión 10 consulta ese resultado, no repite la prueba.

## Integración continua

[ci.yml](../.github/workflows/ci.yml) ejecuta en ubuntu-24.04:

1. Checkout sin persistir credenciales y Node.js 24.
2. npm ci, typecheck, pruebas sin base y build.
3. PostgreSQL 18 como servicio, UTF-8 y health check.
4. Migración inicial/reaplicación y las pruebas de integración/aceptación.

Se activa por push a main y ejecución manual. Permiso único `contents: read`.
El servicio usa una contraseña pública **desechable**, exclusiva de ese job.
No usa credenciales locales, `.env`, `.local/`, XAMPP ni servicios Windows.
DATABASE_URL se limita al paso de migraciones; la integración recibe solo
TEST_DATABASE_URL, con el nombre exacto exigido por sus protecciones.

Acciones oficiales fijadas por SHA: checkout v7.0.1 y setup-node v7.1.0,
comprobadas contra sus etiquetas publicadas.
Referencias: [checkout](https://github.com/actions/checkout/releases),
[setup-node](https://github.com/actions/setup-node/releases) y
[servicios PostgreSQL en Actions](https://docs.github.com/en/actions/tutorials/use-containerized-services/create-postgresql-service-containers).

La revisión de la sesión 09 fue estática, sin linter YAML externo. Después de
publicar 61eff54, el runner superó instalación y tipos, pero falló en npm test;
no alcanzó build, migraciones ni integración. Los logs se revisaron en 09.1.

### Corrección de selección — sesión 09.1

El glob sin comillas se expandía a nombres de archivo antes de llegar a Vitest:
se excluía acceptance.test.ts y se seleccionaban otras cuatro suites de
integración, que fallaban al faltar TEST_DATABASE_URL en el paso normal.
La corrección conserva el patrón y añade comillas escapadas en package.json:

~~~json
{
  "test": "vitest run --exclude \"tests/integration/**\"",
  "test:watch": "vitest --exclude \"tests/integration/**\""
}
~~~

Es un extracto de scripts. test:integration no cambia. npm test y npm run test
son equivalentes: ambos deben ejecutar solo las 364 pruebas normales.
Las 89 pruebas PostgreSQL se ejecutan con npm run test:integration tras build.

En 09.1 pasaron typecheck, npm test, build, npm run test e integración.
Git Bash sobre Windows confirmó la expansión anterior y el patrón literal
corregido; con ese shell, test y test:watch --run ejecutaron los nueve archivos
normales y cero de integración, sin variables de base de datos.
No se añadieron ni eliminaron pruebas: siguen siendo 453 casos.
El workflow conserva su orden y variables. La corrección está publicada en
90b0066 y su ejecución completa en Ubuntu se verificó durante la sesión 10.
La comprobación local de Bash de 09.1 se mantiene como evidencia independiente.

### Resultado remoto verificado — sesión 10

[Commit 90b0066e7210cbecd6dc06dce0ddc6db5813033b](https://github.com/AlexC-0/importacion-validacion-datos/commit/90b0066e7210cbecd6dc06dce0ddc6db5813033b).
[Ejecución 43102797061](https://github.com/AlexC-0/importacion-validacion-datos/actions/runs/43102797061), intento 1, push a main, **SUCCESS**.
Logs del 11/11/2026: Ubuntu 24.04, Node.js 24.22.2 y PostgreSQL 18.6.

| Paso remoto | Resultado |
| --- | --- |
| npm ci | Correcto |
| npm run typecheck | Correcto |
| npm test | 364 pruebas en 9 archivos, integración excluida |
| npm run build | Correcto |
| npm run db:migrate dos veces | 001 aplicada y reaplicación sin pendientes |
| npm run test:integration | 89 pruebas en 5 archivos |

Total 453, sin sumar repeticiones locales como casos diferentes. Se verificaron
metadatos del run, pasos, logs y coincidencia del commit/árbol Git local y remoto.
Este resultado pertenece exclusivamente a 90b0066; no al futuro commit documental.

## Errores habituales y limitaciones

- Integración sin TEST_DATABASE_URL o con nombre incorrecto: falla de forma
  explícita; no se omiten pruebas. Comprueba también que difiere de desarrollo.
- Falta `dist/server.js`: ejecuta build antes de integración/start.
- PostgreSQL no disponible o sin capacidad: error técnico controlado, normalmente
  503; verifica instancia/URL/permisos sin publicar credenciales.
- 400/413/415/422: consulta errores de estructura, bytes, MIME o datos en
  HTTP_IMPORTACIONES. 409 corresponde a otro archivo con SKU existentes.
- COMMIT incierto: reenvía los mismos bytes para recuperar el resultado; no
  presupongas que 503 significa que no hubo commit.
- Puerto ocupado: configura otro PORT; no detengas procesos ajenos.
- OFFSET no mantiene una instantánea entre peticiones diferentes; COUNT y offsets
  altos requieren evaluación de rendimiento. No hay pruebas de carga.
- Los fallos de COMMIT se inyectan en el driver; no prueban cortes físicos de red.
- La auditoría de npm es una observación de esa ejecución, no una garantía de
  seguridad ni sustituto de la revisión de entradas/SQL/errores.
- No hay interfaz, autenticación, edición/borrado ni despliegue.

## Pasos pendientes para cerrar V1

1. Alex revisa la documentación de la sesión 10 y realiza commit/push desde
   GitHub Desktop. La corrección 09.1 ya está publicada y comprobada.
2. Revisar la CI de **ese nuevo commit documental**, sin reutilizar el SUCCESS
   de 90b0066: instalación, tipos, 364 pruebas, build, migraciones y 89 de integración.
3. Si falla, registrar el resultado y resolver la causa antes de declarar cerrado
   el proyecto. No crear tags, releases o despliegues como parte de este encargo.
4. Tras revisión/publicación y CI correctas, registrar la evidencia final de cierre.
   Las limitaciones fuera de alcance no se convierten en trabajo obligatorio.
