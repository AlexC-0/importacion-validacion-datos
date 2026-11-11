# Estado del proyecto

Fecha de actualización: 11 de noviembre de 2026.

## Estado publicado y alcance actual

- Repositorio público: [AlexC-0/importacion-validacion-datos](https://github.com/AlexC-0/importacion-validacion-datos).
- Rama principal: `main`; remoto `origin` configurado hacia ese repositorio.
- Commit inicial publicado: `852e829`
  (`852e829b979b6c8e55e3227b28b61f21f6b7b074`).
- Sesión 02 publicada: commit documental `cb89a65`, integrado en `main` con
  `52bc5c1` (`52bc5c1ac5b37048af551620d2e1d34806f53f2e`).
- Sesión 03 publicada: `47278b3`
  (`47278b314f0b12ae523b4941af23d4a87122b7db`), con el contrato aprobado.
- Sesión 04 publicada por Alex: `b1cb2e2`
  (`b1cb2e2a586ca29aebd8f25bc60e1aa3c14c5e08`).
- Al iniciar la sesión 05, `main` local y GitHub coincidían en `b1cb2e2` y
  el directorio de trabajo estaba limpio. Esta entrega queda local para revisión,
  commit y push manuales.
- Versión del proyecto en `package.json`: `0.1.0`.
- La API no está desplegada. Publicar código en GitHub no inicia un servicio.

## Sesión 01 — Base técnica completada

- Aplicación Express en TypeScript y arranque HTTP separados.
- `GET /health` con respuesta 200 y cuerpo `{ "status": "ok" }`.
- Una prueba de estado, Content-Type JSON y cuerpo con Vitest y Supertest.
- Scripts de desarrollo, compilación, ejecución, tipos y testing.
- Configuración opcional de `PORT`, ejemplo de entorno y exclusiones de Git.
- Error de arranque explícito si el puerto es inválido o está ocupado.
- Documentación inicial y control de versiones independientes del proyecto anterior.

### Entorno y dependencias detectados en la sesión 01

Windows 10, PowerShell 5.1, Git 2.56.0.windows.4, Node.js 24.13.0 y npm 11.6.2.
PostgreSQL no estaba disponible en PATH ni en su ubicación habitual.
Docker 29.9.3 estaba instalado con su servicio detenido; es opcional.
GitHub Desktop y Git Credential Manager disponibles; GitHub CLI no detectado.

Dependencias: Express 5.3.0, TypeScript 7.0.2, tsx 4.23.15, Vitest 5.1.0 y
Supertest 7.3.2. Tipos: Node 24.19.2, Express 5.0.6 y Supertest 7.2.1.
Las versiones resueltas están fijadas en `package-lock.json`.

### Resultados históricos de la sesión 01

| Comprobación | Resultado registrado |
| --- | --- |
| Instalación inicial y `npm ci` | Correctas; npm reportó 0 vulnerabilidades |
| `npm run typecheck` | Correcto: código y pruebas |
| `npm test` | 1 archivo y 1 prueba correctos |
| `npm run build` | Correcto |
| HTTP real a `/health`, desarrollo y servidor compilado | 200 y JSON esperado |
| Puerto ocupado y `PORT` inválido | Fallo explícito, sin falso mensaje de éxito |
| Exclusiones de Git y revisión del commit inicial | Correctas; sin secretos detectados |

Estos resultados son históricos; no se presentan como nuevas ejecuciones en
las sesiones 02 o 03. Los procesos temporales de las comprobaciones se detuvieron.
En aquel momento la suite guardada contenía solo la prueba de `/health`.

## Sesión 02 — Documentación completada y publicada

Se actualizaron README, AGENTS, PROJECT_BRIEF y este estado, y se añadió
[CONTRATO_CSV.md](CONTRATO_CSV.md) como propuesta técnica.
Alex realizó el commit y el push manuales. La entrega está publicada en
`cb89a65` e integrada en `main` mediante `52bc5c1`.

Se estableció la norma permanente que reserva todos los commits y push al usuario
desde GitHub Desktop; Codex tiene prohibido ejecutarlos o usar acciones equivalentes.
El código, la configuración y las dependencias no cambiaron.

### Comprobaciones históricas de la sesión 02

- Diff y formato documental sin errores.
- Siete enlaces locales válidos; tres ejemplos JSON y tres bloques CSV comprobados.
- Gramáticas, errores por fila/campo, límites en bytes y decisiones D01–D10 revisados.
- Ambigüedades de concurrencia, límite de detalles y catálogo de errores corregidas.

Estos resultados corresponden a la propuesta de la sesión 02, anterior al ajuste
de D10. La aprobación y las nuevas comprobaciones se registran a continuación.

## Sesión 03 — Contrato CSV V1 aprobado y publicado

Alex Cobián aprobó D01–D10 el 11 de noviembre de 2026, con esta modificación de D10:

- `201 Created`: importación nueva confirmada.
- `200 OK`: mismos bytes de un archivo ya importado con éxito; recuperar su
  resultado original, sin insertar productos ni crear otra importación.
- `409 Conflict`: otro archivo diferente que contiene SKU existentes.

La documentación alinea los ejemplos, códigos, concurrencia y casos límite con
esta distinción. Si varias solicitudes idénticas concurren, como máximo una
crea la importación y las demás que recuperen el resultado confirmado devuelven
200. Un rollback no reserva permanentemente la huella.

D01–D09 conservan sus reglas aprobadas: UTF-8/coma, columnas fijas, normalización,
precios exactos, duplicados, límites de V1, errores, atomicidad y SHA-256 de bytes
originales. Un cambio de BOM, finales de línea, espacios u orden produce otra
huella; no es repetición exacta. V1 no persiste intentos fallidos.

Se separan expresamente las reglas aprobadas de los aspectos internos pendientes
en la sección 14 del contrato. La aprobación no autoriza por sí sola implementar
el importador. La sesión 03 únicamente modifica los cinco documentos existentes.

### Publicación y comprobaciones históricas de la sesión 03

La sesión 03 dejó cinco documentos para revisión y publicación manual por Alex,
sin staging ni cambios de rama. Después, el usuario publicó `47278b3`, cuya
presencia en `main` local y GitHub se comprobó al iniciar la sesión 04.

Comprobaciones históricas ejecutadas en la entrega documental de la sesión 03:

- Inspección de ruta, rama, remoto y estado inicial limpio; `main` local y GitHub
  coincidían en `52bc5c1`.
- Diff revisado y `git diff --check` correcto, sin marcadores de conflicto.
- Siete enlaces locales válidos y bloques Markdown cerrados.
- Tres ejemplos JSON y tres bloques CSV comprobados. Las respuestas de éxito
  201 y 200 contienen exactamente el mismo identificador, estado y cantidad.
- Tabla D01–D10 aprobada, mapa HTTP y casos de repetición/concurrencia coherentes.
  El código de error obsoleto para archivos ya importados se ha retirado.
- Gramáticas, restricciones de campos, límites y ejemplos CSV de la propuesta
  aprobada conservados; verificación documental de sus casos numéricos y errores.
- Huellas de todos los demás archivos versionados sin cambios: código, pruebas,
  dependencias, configuración y archivos auxiliares preservados.
- Exactamente cinco documentos modificados; sin archivos nuevos, staging,
  conflictos ni cambios de rama o HEAD.

Estas comprobaciones validan la referencia documental; no demuestran una
implementación de la importación ni son pruebas funcionales de la API.

Durante la sesión 03 no se instalaron dependencias ni se ejecutaron de nuevo
pruebas funcionales o compilación: solo hubo cambios documentales.
No se desplegó la API.

## Sesión 04 — Procesamiento y validación CSV publicados

Entrada pública: `processProductsCsv(content: Uint8Array)`, compatible con
`Buffer`, en `src/csv/process-products-csv.ts`. Devuelve productos normalizados
o errores estructurados; no devuelve productos parciales cuando falla.

Implementado:

- UTF-8 estricto, un BOM inicial opcional, LF/CRLF, comas, comillas y escape doble.
- Cabecera exacta, cuatro columnas y rechazo de líneas vacías, CR aislado,
  comillas inválidas y campos multilínea.
- Recorte exclusivo de espacios ASCII/tabuladores en extremos; SKU ASCII en
  mayúsculas y nombres NFC medidos en puntos de código.
- Gramáticas y rangos de precio/stock, conversión exacta a céntimos enteros.
- Duplicados internos con referencia a la primera fila y rechazo del archivo.
- Límites inclusivos de 5242880 bytes originales y 10000 productos.
- Errores ordenados por fila/columna; hasta 100 detalles e indicador de truncamiento
  únicamente cuando se encuentran más. Los errores estructurales tienen prioridad.
- Pruebas construidas en memoria, incluidos los extremos de tamaño y filas.

Se eligió un parser acotado al contrato, sin añadir dependencias. Se separan
interpretación, validación y tipos en cuatro módulos de `src/csv/`.
El recorte recorre los extremos del valor sin búsquedas repetidas sobre
secuencias largas de espacios interiores.

La API y su arranque no cambian. No se implementan rutas nuevas, recepción
multipart, infraestructura, base de datos, transacciones, conflictos contra
catálogo, huellas persistidas, coordinación concurrente ni consultas.

### Comprobaciones históricas ejecutadas en la sesión 04

Entorno usado: Node.js 24.13.0, npm 11.6.2, Git 2.56.0.windows.4 y PowerShell 5.1.
Las dependencias existentes estaban instaladas; no se añadieron ni reinstalaron.

| Comprobación | Resultado |
| --- | --- |
| `npm run typecheck` | Correcto, código y pruebas con TypeScript estricto |
| `npm test` | 4 archivos y 190 pruebas correctos: 189 CSV y 1 de `GET /health` |
| `npm run build` | Correcto, salida en `dist/` excluida de Git |

Se cubren sintaxis, UTF-8/BOM, terminadores, cabecera, columnas, campos obligatorios,
normalización, Unicode, precios exactos, stock, duplicados, localización/orden de
errores, truncamiento, archivos vacíos, límites y prioridad estructural.
La prueba HTTP existente verifica 200, Content-Type JSON y cuerpo de `/health`
sin iniciar el servidor de desarrollo.

La primera ejecución detectó un paréntesis incorrecto en una prueba nueva; se
corrigió. La ejecución final de las tres comprobaciones es correcta.
No se presentan las pruebas históricas de arranque o instalación como ejecutadas
de nuevo. Las pruebas de límites no equivalen a pruebas de carga en producción.

### Entrega y publicación de la sesión 04

- Rama `main`, HEAD publicado de partida `47278b3`, sin nuevos commits.
- Cinco documentos actualizados: AGENTS, README, PROJECT_BRIEF, STATUS y notas
  de avance del CONTRATO_CSV; sus reglas y ejemplos aprobados se conservan.
- Cuatro módulos nuevos en `src/csv/` y tres archivos nuevos de pruebas CSV.
- Código HTTP, prueba original, dependencias y configuraciones preservados.
- Sin staging, creación de ramas, commit, push ni despliegue por parte de Codex.
- Revisión final de diff, enlaces, ejemplos, exclusiones y alcance registrada
  en el informe de entrega.

Alex revisó y publicó la sesión 04 en `b1cb2e2` desde GitHub Desktop.
La lista anterior describe su entrega local histórica antes de esa publicación.

## Sesión 05 — PostgreSQL y primera persistencia

### Inspección inicial y autorización

No se encontró PostgreSQL, psql, proceso, servicio ni configuración de conexión
de este proyecto. Docker 29.9.3 estaba instalado, con motor detenido; WSL no podía
arrancar. No se alteraron esos componentes ni MySQL/Apache de XAMPP.

Alex autorizó expresamente descargar PostgreSQL, prepararlo en `.local/`,
iniciarlo solo en `127.0.0.1:55432` y crear bases independientes de desarrollo
y pruebas, sin instalar un servicio de Windows.

### Entorno operativo comprobado

- PostgreSQL y psql 18.6, binarios oficiales de EDB para Windows x64.
- Cluster UTF-8 con locale C, datos en `.local/data`.
- Base de desarrollo `importacion_validacion_datos`.
- Base exclusiva de pruebas `importacion_validacion_datos_test`.
- Rol `csv_app`, propietario de ambas bases, sin superusuario, CREATEDB ni CREATEROLE.
- Contraseñas aleatorias y autenticación SCRAM-SHA-256; credenciales locales
  excluidas de Git en `.env` y `.local/admin.pgpass`.
- Escucha verificada exclusivamente en `127.0.0.1:55432`.
- Parada, arranque y consulta de estado comprobados mediante `db:local`.
- La instancia queda arrancada al entregar; no arranca automáticamente con Windows.
- Desarrollo conserva cero importaciones y cero productos; la suite no lo utiliza.
- Tras las pruebas quedan cero esquemas temporales `csv_test_*`.

### Implementación

- `migrations/001_initial.sql`: importaciones, productos, claves, unicidad de
  huella/SKU, normalización, rangos y relación restrictiva.
- `src/persistence/database.ts`: pool, errores técnicos sin datos sensibles
  y transacción con liberación de cliente; descarte si falla el rollback.
- `import-repository.ts`: inserción transaccional y consultas por identificador,
  huella, SKU e importación. Recibe productos ya validados.
- `migrate.ts` y `migrate-cli.ts`: SQL versionado, historial/checksum y ejecución
  desde el proyecto, también con JavaScript compilado.
- `scripts/local-postgres.ps1`: preparación, arranque, parada y estado de la
  instancia local autorizada, sin sobrescribir instancias o configuraciones.
- `tests/integration/persistence.test.ts`: pruebas reales en esquemas nuevos
  de la base exclusiva, sin limpiar datos de procedencia desconocida.
- Nuevas dependencias mínimas: `pg@8.23.1` y `@types/pg@8.23.1`.
  Instalación correcta; npm informó de cero vulnerabilidades.

El modelo, decisiones y reproducción se documentan en
[PERSISTENCIA](PERSISTENCIA.md). Se conservan las reglas aprobadas del contrato.
No hay ORM, nuevas rutas, multipart, autenticación, despliegue ni colas.

### Comprobaciones ejecutadas en la sesión 05

| Comprobación | Resultado final |
| --- | --- |
| `npm run typecheck` | Correcto, incluido el código de integración |
| `npm test` | 190 pruebas correctas en 4 archivos; CSV y GET /health |
| `npm run build` | Correcto |
| `npm run test:integration` | 45 pruebas reales correctas en PostgreSQL 18.6 |
| `npm run db:migrate` | Creación desde cero y reaplicación sin cambios correctas |
| Ejecutor compilado de migraciones | Correcto tras reiniciar PostgreSQL |
| Inicialización repetida | Rechazada como se esperaba; datos y .env preservados |
| Conexiones | Liberación tras error/éxito y cierre real comprobados |
| Aislamiento | Base exclusiva, esquemas propios limpiados y desarrollo sin filas |

Las 235 pruebas se ejecutaron, sin omisiones. La suite de integración comprobó
migración inicial, historial alterado, esquema ajeno, céntimos exactos, Unicode,
relaciones, unicidad, NOT NULL, CHECK, consultas parametrizadas, rollback completo
y reutilización/cierre de conexiones. Se corrigió una expectativa inicial:
ON DELETE RESTRICT devuelve 23001 en PostgreSQL 18, distinto del 23503 de una FK
inexistente. La protección de datos funcionó en ambos casos.

Las pruebas no equivalen a pruebas de carga ni validan aún la clasificación
funcional bajo concurrencia o la pérdida de respuesta después de COMMIT.

### Estado de la entrega

Rama `main`, HEAD `b1cb2e2`, mismo remoto del proyecto.
Cambios locales sin staging, commit ni push. La sesión 05 no está publicada.
Código CSV, aplicación Express, arranque HTTP y pruebas previas conservados.

Binarios, ZIP, datos, logs, credenciales, dependencias instaladas y salida dist
quedan excluidos de Git. No se modifican otros repositorios ni servicios.
La revisión final del diff, documentación y exclusiones se registra en el
informe de entrega. No hay bloqueos de entorno pendientes.

## Pendiente y próximo paso

La capa de persistencia aporta atomicidad e integridad relacional verificadas,
pero todavía no constituye el servicio completo de importación.
Ante una huella duplicada devuelve un error técnico de unicidad; el futuro
servicio deberá recuperar la importación existente conforme a D09/D10.

Sesión 06 recomendada: desarrollar un servicio independiente de HTTP que coordine
validación CSV, SHA-256 de bytes originales, reintentos, conflictos y persistencia,
con pruebas reales de concurrencia. No traducir todo error de unicidad a 409.
Posteriormente integrar multipart y respuestas HTTP 200/201/409, consultas
públicas y límites de recepción. Todo ello requiere autorización del alcance.

Alex realizará la revisión, el commit y el push manuales desde GitHub Desktop.
