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
- Sesión 05 publicada por Alex: `59dbc42`
  (`59dbc4230b9c6826fdb7ebcbe8feb6afbf45d6e1`).
- Sesión 06 publicada por Alex: `f4b63e3`
  (`f4b63e31e29e895cb012512a21288a3567637115`).
- Sesión 07 publicada por Alex: `96a9ae0`
  (`96a9ae06b560d1c08dfafd39ca558ad53b99409d`).
- Sesión 08 publicada por Alex: `cb4e48c`
  (`cb4e48c5f4956c5d2584c461c2ce4aece2cb8082`).
- Al iniciar la sesión 09, main, origin/main y GitHub coincidían en cb4e48c;
  no había cambios pendientes. La sesión 09 se entregó sin staging y Alex
  la publicó en `61eff54` (`61eff54655ec365f177fc109ebef60ff44b6f84b`).
- Al iniciar la sesión 09.1, main y origin/main coinciden en 61eff54, sin cambios
  pendientes. La primera CI falló en npm test; la corrección 09.1 queda local.
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

## Sesión 05 — PostgreSQL y primera persistencia, publicada

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

### Comprobaciones históricas ejecutadas en la sesión 05

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

### Entrega y publicación de la sesión 05

La entrega partió de `b1cb2e2` y quedó local sin staging, commit ni push por
parte de Codex. Alex la publicó posteriormente en `59dbc42`, verificado al
iniciar la sesión 06.
Código CSV, aplicación Express, arranque HTTP y pruebas previas conservados.

Binarios, ZIP, datos, logs, credenciales, dependencias instaladas y salida dist
quedan excluidos de Git. No se modifican otros repositorios ni servicios.
La revisión final del diff, documentación y exclusiones se registra en el
informe de entrega. No hay bloqueos de entorno pendientes.

## Sesión 06 — Coordinación de importaciones, conflictos y reintentos, publicada

### Estado inicial

Repositorio limpio en `main`, commit `59dbc42`, coincidente con GitHub.
Se revisaron instrucciones, documentación, contrato, módulos CSV/PostgreSQL y
suites existentes. Se conserva la instancia PostgreSQL 18.6 de la sesión 05.

Una comprobación desde el sandbox no pudo ver correctamente el proceso.
La comprobación con permisos confirmó que la instancia existente seguía operativa;
el intento de arranque adicional fue rechazado sin crear otra instancia.
No se reinstaló PostgreSQL, no se reinicializó el cluster y no se modificaron
servicios de Windows, XAMPP, Docker ni WSL.

### Implementación

- `src/imports/import-service.ts`: servicio independiente de Express, entrada
  de bytes originales y resultados tipados `created`, `existing`, `invalid`,
  `conflict` y `persistence_error`.
- Validación antes de cualquier operación de persistencia; SHA-256 exclusivamente
  de bytes originales, calculado antes de la primera espera asíncrona.
- Recuperación del identificador y cantidad originales; ninguna nueva escritura
  cuando se recupera una importación confirmada.
- Conflictos `SKU_ALREADY_EXISTS`, por fila/campo, ordenados y limitados a
  100 detalles con truncamiento indicado.
- Consulta de SKU en bloque e inserciones ordenadas para evitar ciclos por
  orden inverso entre archivos concurrentes.
- Restricciones únicas existentes y rollback como garantía frente a carreras.
  Tras una infracción de unicidad se consulta primero la huella confirmada.
  Una PK u otra UNIQUE no se convierte automáticamente en conflicto de SKU.
- Transacciones READ COMMITTED, límites de espera y descarte de conexiones
  afectadas; sin reintentos automáticos de escritura.
- Distinción de COMMIT incierto: recuperación por huella o error técnico
  controlado con `commit: unknown`; nunca éxito sin evidencia.

No se han añadido dependencias, tablas ni migraciones, ni modificado las
decisiones D01–D10. La API mantiene únicamente `GET /health`.
Las decisiones y límites se detallan en [PERSISTENCIA](PERSISTENCIA.md).

### Comprobaciones históricas ejecutadas en la sesión 06

| Comprobación | Resultado |
| --- | --- |
| `npm run typecheck` | Correcto |
| `npm test` | 224 pruebas correctas en 5 archivos |
| `npm run build` | Correcto |
| `npm run test:integration` | 63 pruebas reales correctas en 2 archivos |

Total: 287 pruebas ejecutadas sin omisiones; se conservan las 190 CSV/health
y 45 PostgreSQL anteriores, con 34 pruebas nuevas del servicio/errores y
18 nuevas de integración. Se corrigió una llamada de prueba no compatible
con ES2022 sin cambiar la configuración de compilación.

Las nuevas pruebas verifican:

- Creación, recuperación idéntica, nombre externo irrelevante y huellas distintas
  al cambiar BOM, LF/CRLF, espacios u orden.
- Conflictos parciales sin modificar el catálogo, validación sin consultas,
  rollback de una inserción intermedia y reintento de los mismos bytes.
- Cuatro conexiones con PID distintos: una creación y tres recuperaciones.
- Archivos distintos con SKU compartidos y orden inverso: una confirmación y
  un conflicto completo; archivos independientes pueden confirmar ambos.
- Carrera entre consulta inicial de huella y detección de SKU existentes.
- Espera observable en PostgreSQL de una huella no confirmada: recuperación
  después del commit o creación después del rollback del competidor.
- Timeout real de espera, error controlado y reintento posterior.
- COMMIT real con pérdida simulada de respuesta en el driver, recuperación
  inmediata o incertidumbre controlada seguida de recuperación posterior.
- Errores sin detalles sensibles, orden/truncamiento y liberación de conexiones.

### PostgreSQL y entrega

- Instancia existente operativa en `127.0.0.1:55432`, versión 18.6.
- Base de integración exclusiva `importacion_validacion_datos_test`.
- Cero esquemas temporales `csv_test_*` después de las pruebas.
- Desarrollo conserva cero importaciones y cero productos.
- Código CSV, aplicación/arranque HTTP, pruebas anteriores, migración publicada,
  configuración y dependencias conservados.
- Rama `main`, HEAD `59dbc42`; cambios locales sin staging, commit ni push.
- La entrega de sesión 06 quedó pendiente de revisión y publicación manual.
  Alex la publicó posteriormente en `f4b63e3`, verificado al iniciar la sesión 07.

## Sesión 07 — Integración HTTP de importaciones, publicada

### Estado inicial y alcance

Ruta independiente comprobada, rama main limpia y remoto correcto. HEAD y
GitHub coincidían en f4b63e3. La instancia PostgreSQL 18.6 seguía activa en
127.0.0.1:55432 (PID 20536); no hubo reinstalación ni reinicialización.

Se revisaron instrucciones, contrato D01–D10, capas CSV/servicio/PostgreSQL,
configuración y pruebas. No había cambios previos que preservar.

### Implementación

- POST /importaciones recibe multipart válido con exactamente un archivo en
  el campo archivo, sin campos extra ni almacenamiento temporal.
- multiparty 4.3.1 en modo streaming y content-type 1.0.5 para cabeceras MIME
  estrictas; tipos correspondientes y lock actualizado. Sin otro parser CSV.
- Recuento real e independiente de cuerpo completo (5308416 bytes) y archivo
  (5242880 bytes), incluyendo solicitudes chunked sin Content-Length.
- Recepción interrumpida ante exceso, multipart incompleto/malformado, error,
  desconexión o timeout. Ningún buffer truncado se entrega al servicio.
- Tipos declarados aprobados y charset UTF-8; nombre/extensión informativos.
- Adaptador de resultados existentes a 201/200/400/413/415/422/409/500/503,
  con detalles contractuales y sin exponer errores internos ni certeza no probada.
- createApp permite inyectar el servicio; servidor y aplicación separados.
  Un pool por proceso, cierre único y manejadores SIGINT/SIGTERM.
- GET /health mantiene su respuesta. Sin DATABASE_URL, la validación sigue
  funcionando y un archivo válido recibe 503.
- Límites operativos: 30 s para completar recepción y 35 s de gracia de cierre.
  No alteran D01–D10 ni sustituyen las futuras pruebas de carga.
- CSV, servicio, persistencia y migraciones publicadas se reutilizan sin cambios.

Detalles de uso y decisiones en [HTTP_IMPORTACIONES](HTTP_IMPORTACIONES.md).

### Comprobaciones históricas ejecutadas en la sesión 07

| Comprobación | Resultado real |
| --- | --- |
| Instalación de dependencias y npm ci desde el lock | Correctos; npm informó 0 vulnerabilidades |
| npm run typecheck | Correcto |
| npm test | 274 pruebas correctas en 7 archivos |
| npm run build | Correcto |
| npm run test:integration | 74 pruebas reales correctas en 3 archivos |

Total: 348 pruebas sin omisiones. Se conservan las 287 de sesiones anteriores
y se añaden 50 HTTP/streams y 11 HTTP con PostgreSQL real.

Las nuevas pruebas verifican tipos, charset, campos, múltiples partes, ausencia
de archivo, multipart malformado/incompleto, UTF-8, prioridad de validación,
filas/campos/duplicados y truncamiento. Incluyen los límites exactos y un byte
adicional, 10000/10001 filas, cuerpo chunked, interrupción de una subida aún
abierta, desconexión y timeout.

Las pruebas PostgreSQL usan solo esquemas propios de la base exclusiva:
creación y recuperación confirmadas, conflictos sin inserción parcial,
rollback después de una inserción y reintento, y carreras HTTP sincronizadas
con conexiones de PID diferentes (201/200 y 201/409). La pérdida de respuesta
tras COMMIT real se inyecta en el driver: 200 cuando se recupera evidencia,
503 sin evidencia, seguido de recuperación con 200.

Incidencias corregidas durante el desarrollo: charset vacío o malformado que
un parser MIME permisivo aceptaba; comprobación asíncrona de desconexión que
rechazaba por el evento error esperado; tipos del cuerpo de una prueba fetch.
La recepción atiende aborted/error y libera recursos. Las comprobaciones finales
anteriores se ejecutaron después de corregir esas incidencias.

### Demostración con la API compilada

Se arrancó dist/server.js en un proceso real, puerto local temporal y esquema
propio de importacion_validacion_datos_test, con la migración aprobada.
Se envió multipart con un producto DEMO-07, Café, precio 0.29 y stock 2.

- GET /health: 200 y JSON esperado.
- POST de archivo nuevo: 201, estado completada, cantidad 1.
- Reenvío con otro nombre: 200 y exactamente el mismo resultado.
- Archivo diferente con el mismo SKU: 409.
- Precio inválido: 422.
- Base comprobada: una importación y un producto.
- Manejador de cierre ejecutado, proceso terminado con código 0 y cero
  conexiones restantes de ese servidor. El esquema propio se eliminó.

No se insertaron datos de demostración en desarrollo ni se eliminaron datos ajenos.

### Entrega y Git

Revisión final correcta: git diff --check, 20 enlaces locales, 6 ejemplos JSON,
4 bloques CSV y sintaxis de 3 ejemplos TypeScript. Reglas D01–D10, ejemplos
contractuales y norma permanente de Git conservados. Sin credenciales locales
detectadas en archivos versionables; exclusiones de Git comprobadas.
PostgreSQL 18.6 conserva cero esquemas temporales y desarrollo sigue con cero
importaciones y cero productos. No quedan bloqueos de entorno.
Rama main y HEAD f4b63e3 conservados. Sin staging, commit, push, ramas nuevas
ni cambios en otros repositorios. Binarios, dependencias, dist y credenciales
continúan excluidos. No se despliega la API.

La sesión 07 se entregó pendiente de revisión, commit y push manuales de Alex.
Alex la publicó después en 96a9ae0, verificado al comenzar la sesión 08.

## Sesión 08 — Consultas HTTP de productos e importaciones

### Inspección y contrato previo

Repositorio limpio en main, HEAD 96a9ae0 coincidente con GitHub.
La sesión 07 fue publicada por Alex; se revisaron instrucciones, contratos,
código HTTP, repositorio SQL, migración y pruebas antes de modificar.

PostgreSQL 18.6 seguía activo en 127.0.0.1:55432, PID 20536.
No se reinstaló, reinicializó ni alteró ningún servicio de Windows, XAMPP,
Docker o WSL. Desarrollo conserva cero importaciones y cero productos.

Se redactó [HTTP_CONSULTAS](HTTP_CONSULTAS.md) antes de implementar las rutas,
adoptando los valores del encargo y precisando gramática, UUID, desempate,
serialización y errores. D01–D10 permanecen intactas.

### Implementación

- GET /productos: lista paginada, orden SKU ascendente y filtro importacion_id.
  Se conservan nombre Unicode, stock y precio en céntimos enteros.
- GET /importaciones: metadatos confirmados, orden creada_en DESC e id DESC,
  sin exponer SHA-256 en el listado.
- GET /importaciones/:id: detalle con SHA-256; UUID inválido 400,
  UUID válido inexistente 404 NOT_FOUND.
- limit predeterminado 20, rango 1..100; offset predeterminado 0,
  hasta Number.MAX_SAFE_INTEGER. Gramática decimal estricta.
- Validación previa de duplicados, desconocidos, codificación URL y UUID.
  Errores 400/404/500/503 estructurados, sin datos internos.
- Dos nuevos métodos SELECT en ImportRepository; detalle reutiliza findImportById.
  Una sola sentencia por listado obtiene total y página con la misma instantánea.
  La unión externa conserva el total cuando el offset deja vacía la página.
- createApp conserva el primer argumento de importación y añade un segundo
  argumento opcional para lectura. El servidor comparte el repositorio/pool.
- Sin nuevas tablas, dependencias, migraciones ni cambios de importación,
  concurrencia, idempotencia, health o recepción multipart.

### Comprobaciones ejecutadas en la sesión 08

| Comprobación | Resultado real |
| --- | --- |
| npm run typecheck | Correcto |
| npm test | 363 pruebas correctas en 9 archivos |
| npm run build | Correcto |
| npm run test:integration | 88 pruebas reales correctas en 4 archivos |

Total: 451 pruebas ejecutadas sin omisiones. Se conservan las 348 anteriores
y se añaden 89 de parámetros/HTTP y 14 de integración de lectura.
No se reinstalaron dependencias, al no haber cambios en package.json ni el lock.

Las nuevas pruebas cubren catálogo vacío, defaults y extremos de paginación,
offset fuera del catálogo, filtros, UUID, parámetros desconocidos/duplicados,
codificación inválida e intentos de inyección SQL. Verifican Unicode, céntimos,
proyección de campos, fechas UTC, desempate por ID, totales y errores seguros.

Con PostgreSQL real se ejecutan las consultas con default_transaction_read_only=on
y se comparan filas completas y versiones xmin antes/después: sin modificaciones.
Se comprueba que una importación no confirmada no aparece y que COMMIT/ROLLBACK
del competidor producen los resultados esperados. El historial se contrasta
con varios CSV importados por HTTP y un reenvío idempotente.

Las pruebas solo crean/eliminan esquemas propios de la base de integración.
Los UPDATE de fechas para preparar empates son fixtures exclusivos de esa base;
no pertenecen a las rutas ni alteran datos de desarrollo.

### Demostración HTTP con servidor compilado

Se arrancó dist/server.js como proceso real en un puerto temporal de loopback,
usando un esquema propio de importacion_validacion_datos_test.

- POST /importaciones: dos archivos nuevos 201 y repetición exacta 200.
- GET /health: 200 y JSON esperado.
- GET /productos: 200; tres SKU ordenados A-08, B-08 y Z-08.
- GET /productos?limit=1&offset=1: 200; B-08 y paginacion
  con limit 1, offset 1 y total 3.
- GET /productos?importacion_id=<UUID>: 200; total filtrado 2.
- GET /importaciones: 200; dos importaciones confirmadas.
- GET /importaciones?limit=1&offset=1: 200; una entrada y total 2.
- GET /importaciones/<UUID>: 200; hash y cantidad 2 comprobados.
- limit=0 y UUID inválido: 400 INVALID_REQUEST.
- UUID inexistente: 404 NOT_FOUND.
- Filas y versiones comparadas antes/después de las consultas: sin cambios.
- Cierre del servidor con código 0 y cero conexiones de ese proceso.

El esquema propio de demostración se eliminó. No se insertaron ni borraron
datos de desarrollo. El servidor temporal quedó detenido.

### Entrega y control de versiones

Revisión final correcta: git diff --check; 29 enlaces locales, 10 ejemplos JSON,
4 bloques CSV y sintaxis de 3 ejemplos TypeScript revisados. Secciones 0–13
del contrato de importación y métodos anteriores de persistencia intactos.
Dependencias, migraciones y suites anteriores conservadas. Sin credenciales
locales detectadas en archivos versionables; exclusiones verificadas.
PostgreSQL 18.6 sigue en 127.0.0.1:55432; cero esquemas temporales y desarrollo
con cero importaciones y cero productos. No quedan bloqueos.
Se conserva main y HEAD 96a9ae0, sin staging, commit, push ni ramas nuevas.
La sesión 08 se entregó pendiente de revisión y publicación manual de Alex.
Después la publicó en cb4e48c, verificado al iniciar la sesión 09.
No se despliega la aplicación.

## Sesión 09 — Validación integral y preparación de V1

### Revisión y corrección acotada

Inspección de contratos, código, pruebas, scripts, migración y PostgreSQL,
partiendo de main limpio en cb4e48c. Revisión de validación, SQL parametrizado,
transacciones, errores y gestión de recursos, reutilizando la cobertura existente.
D01–D10, migración 001, dependencias y rutas conservan su alcance.

Se demostró un defecto: el error PostgreSQL 53300 (conexiones agotadas) devolvía
500 en POST /importaciones. La nueva regresión falló primero (esperado 503,
recibido 500); después se añadió ese código a indisponibilidad temporal y pasó
como 503 SERVICE_UNAVAILABLE. No se modificó la coordinación transaccional.

Se añadió una aceptación del proceso dist/server.js: arranque real, health,
201/200/409/422, listados/detalle/filtros/paginación y errores 400/404.
Compara filas y xmin, comprueba salida 0 y cero conexiones de ese servidor.
En Windows IPC invoca el manejador SIGTERM; Linux usará SIGTERM real en CI.
Las demás combinaciones se conservan en sus suites, sin duplicación masiva.

### Comprobaciones ejecutadas en la sesión 09

| Comprobación | Resultado real |
| --- | --- |
| npm run typecheck | Correcto |
| npm test | 364 pruebas correctas en 9 archivos |
| npm run build | Correcto |
| npm run test:integration | 89 pruebas reales correctas en 5 archivos |

Total: 453 casos sin omisiones, dos más que en la sesión 08. La
[matriz A–G](VALIDACION_V1.md#matriz-de-aceptación) vincula los criterios con
sus evidencias. La prueba de GET /health sigue pasando.

### Reproducibilidad y limpieza

Copia temporal de archivos versionables, incluidos los cambios de código de
esta sesión, sin .git, .env, .local, node_modules ni dist. npm ci instaló 167
paquetes; su auditoría no notificó vulnerabilidades. Se repitieron typecheck,
las 364 pruebas sin base, build y las 89 de integración, todas correctas.
Son los mismos 453 casos en otro entorno local, no 906 casos distintos.

Una base temporal nueva UTF-8, en la instancia existente, permitió comprobar
migración inicial y reaplicación, arranque compilado, importación 201, reenvío
200, consultas y precio 29 céntimos. Credenciales transmitidas por entorno,
sin guardarlas en la copia. Cierre con código 0 y sin conexiones restantes.
La base y carpeta temporales se eliminaron; .env original conserva su hash.
No se reinicializó PostgreSQL ni se alteraron datos de desarrollo.

### CI y entrega pendiente

.github/workflows/ci.yml prepara ubuntu-24.04, Node.js 24 y PostgreSQL 18,
con npm ci, typecheck, test, build, migración/reaplicación e integración.
Se activa por push a main o manualmente. Permisos contents: read, checkout
sin persistir credenciales y contraseña desechable del servicio de CI.
Acciones oficiales fijadas por SHA: checkout v7.0.1 y setup-node v7.1.0.

Al entregar la sesión 09 se realizó revisión estática de estructura, comandos,
permisos, base y variables, sin linter YAML externo ni ejecución del runner.
La primera ejecución remota posterior falló, como registra la sesión 09.1.
**V1 no está cerrada definitivamente.**
No se cambian package.json, lock ni migraciones; no hay nuevas dependencias.

Revisión final: git diff --check correcto, 42 enlaces locales (incluidas anclas),
10 ejemplos JSON, 5 bloques CSV con los resultados válidos/inválidos previstos
y sintaxis de 3 ejemplos TypeScript comprobados. Contratos intactos; sin valores
de las credenciales locales detectados en los 49 archivos versionables.
.env, .local, node_modules y dist siguen excluidos de Git.

PostgreSQL 18.6 permanece activo en 127.0.0.1:55432, PID 20536. Desarrollo
conserva cero importaciones y cero productos; cero esquemas temporales y cero
conexiones de aceptación. Base/carpeta de reproducción eliminadas y sin
procesos de API de prueba residuales. No se detuvo la instancia existente.

Al entregar la sesión 09, main conservaba cb4e48c, sin staging, commit, push,
ramas nuevas, tags, releases ni despliegue por parte de Codex. Alex publicó
posteriormente los cambios en 61eff54 desde GitHub Desktop.
La guía [VALIDACION_V1](VALIDACION_V1.md) reúne instalación Windows/Linux,
configuración, migraciones, pruebas, ejemplos, errores y limitaciones.

## Sesión 09.1 — Corrección de la selección de pruebas en CI

### Causa verificada

Se consultaron los pasos y logs del job 130792950708 de la
[primera ejecución de CI](https://github.com/AlexC-0/importacion-validacion-datos/actions/runs/43101238510),
correspondiente a 61eff54. Instalación y typecheck correctos; npm test falló.
Build, migraciones e integración quedaron sin ejecutar por ese fallo.

El comando era vitest run --exclude tests/integration/**. Los logs muestran
cuatro suites de tests/integration cargadas y el error de configuración ausente
TEST_DATABASE_URL; no llegaron a ejecutarse casos de prueba.

Git Bash local reprodujo la expansión: el glob sin comillas se convirtió en
cinco rutas. La primera, acceptance.test.ts, ocupó el argumento de --exclude;
las otras cuatro quedaron como filtros de ejecución. Esto explica tanto las
cuatro suites fallidas como la ausencia de las nueve suites normales en CI.
No faltaba una variable en el workflow: integración no debía cargarse en ese paso.

### Corrección mínima

package.json entrecomilla tests/integration/** en test y test:watch, escapando
las comillas dobles en JSON. Vitest recibe un solo patrón literal y excluye
la carpeta completa. test:integration y ci.yml permanecen intactos.
No se añaden dependencias, pruebas, exclusiones adicionales ni cambios de API.

### Comprobaciones locales ejecutadas

| Comprobación | Resultado |
| --- | --- |
| npm run typecheck | Correcto |
| npm test | 364 pruebas en 9 archivos; ninguna suite de integración |
| npm run build | Correcto |
| npm run test | 364 pruebas en los mismos 9 archivos |
| npm run test:integration | 89 pruebas reales en los 5 archivos de integración |
| Git Bash: argumentos de test y test:watch | Un argumento literal tests/integration/** después de --exclude |
| npm test con Git Bash como script-shell | 364 pruebas / 9 archivos, sin variables PostgreSQL; cero archivos de integración |
| npm run test:watch -- --run con ese script-shell | 364 pruebas / 9 archivos, sin variables PostgreSQL; cero archivos de integración |

npm test y npm run test son equivalentes; ninguno debe cargar integración.
El comando que ejecuta las 89 pruebas PostgreSQL es npm run test:integration.
La opción --run permitió comprobar test:watch sin dejar un observador activo.
Se contrastaron los nombres de los nueve archivos mediante la salida detallada.

Las 453 pruebas existentes se conservan y pasan, incluyendo health, endpoints,
concurrencia, rollback y aceptación del proceso compilado. Las repeticiones
anteriores no son casos adicionales. Tipos y compilación correctos.
Git Bash está instalado en Windows: esta evidencia no sustituye un runner Linux.
No se instaló software ni se reinicializó PostgreSQL.

Se revisó el orden del workflow: npm ci, typecheck, npm test, build,
migración/reaplicación e integración con TEST_DATABASE_URL solo en su paso.
No se proporcionan credenciales de base al paso de pruebas normales para ocultar
el fallo. Código, contratos D01–D10, pruebas, lock y migraciones sin cambios.

### Estado y nueva comprobación remota pendiente

README, PROJECT_BRIEF y VALIDACION_V1 registran la publicación de la sesión 09
y el fallo inicial. Esta corrección queda sin staging, commit ni push en main,
sobre 61eff54. Alex debe revisarla y publicarla mediante GitHub Desktop.
Después se comprobará una nueva ejecución asociada al nuevo commit; repetir
la ejecución de 61eff54 no incorporaría estos cambios. V1 permanece abierta.

## Limitaciones y siguiente sesión

OFFSET no garantiza una instantánea compartida entre distintas solicitudes:
nuevas importaciones pueden desplazar páginas. Total y página sí son coherentes
dentro de cada consulta. COUNT exactos y offsets altos requieren evaluación
de rendimiento antes de adoptar volúmenes grandes; no hay pruebas de carga.

Las fechas HTTP tienen precisión de milisegundos; la ordenación usa la precisión
de PostgreSQL. No se ofrece búsqueda avanzada, edición, eliminación, exportación,
frontend, autenticación ni despliegue.

La cobertura de COMMIT incierto sigue usando fallos inyectados en el driver;
no es una prueba de corte físico de red. No quedan bloqueos de implementación.

Siguiente paso: revisión y publicación manual de la corrección 09.1; después,
verificar en GitHub Actions la ejecución del nuevo commit en main y registrar
su URL/resultado. Solo con esa evidencia podrá declararse cerrada V1.
Las pruebas de carga y fallos físicos de red siguen fuera de esta entrega.
