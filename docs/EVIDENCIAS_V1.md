# Evidencias técnicas de V1

Ficha de la sesión 10, revisada el 11 de noviembre de 2026. Describe capacidades
comprobadas del Proyecto 01 de CHAMBA DIARIA; no acredita usuarios reales,
métricas de rendimiento ni uso en producción.

## Evidencia publicada y estado de cierre

- Repositorio público: [AlexC-0/importacion-validacion-datos](https://github.com/AlexC-0/importacion-validacion-datos).
- Commit verificado: [90b0066e7210cbecd6dc06dce0ddc6db5813033b](https://github.com/AlexC-0/importacion-validacion-datos/commit/90b0066e7210cbecd6dc06dce0ddc6db5813033b).
- [GitHub Actions 43102797061](https://github.com/AlexC-0/importacion-validacion-datos/actions/runs/43102797061):
  **SUCCESS**, intento 1, evento push sobre main.
- Ejecución del 11/11/2026, 21:24:38–21:25:19 UTC
  (22:24:38–22:25:19 en Europe/Madrid); no es una medición de rendimiento de la API.
- Entorno de logs: Ubuntu 24.04, Node.js 24.22.2, servicio PostgreSQL 18.6.

| Paso remoto | Resultado verificado en pasos y logs |
| --- | --- |
| npm ci | Correcto |
| npm run typecheck | Correcto |
| npm test | 364 pruebas / 9 archivos, sin integración |
| npm run build | Correcto |
| db:migrate, dos veces | 001_initial.sql aplicada; segunda ejecución sin pendientes |
| npm run test:integration | 89 pruebas / 5 archivos, con PostgreSQL real |

Total: **453 pruebas satisfactorias**. La sesión 10 consulta esta evidencia,
no vuelve a ejecutar la suite ni crea nuevos casos.
HEAD local, origin/main y main remoto coincidían al iniciar en ese commit;
su árbol Git es `f74aa16336e963bbba80fab464785237ebb58326`.

La V1 está técnicamente preparada para cierre formal. Esta ficha y la entrega
documental de sesión 10 siguen locales: el cierre definitivo requiere revisión,
commit/push manuales y comprobar la CI de ese futuro commit. El SUCCESS anterior
no demuestra la verificación de cambios posteriores. No se crean tags/releases;
package.json conserva 0.1.0 y csv-v1 identifica el contrato de datos.

## Problema, usuarios y capacidades

Los catálogos CSV pueden mezclar datos válidos, errores y SKU repetidos. La API
valida y explica incidencias antes de persistir, evita importaciones parciales
y permite recuperar el resultado de un envío repetido.

Usuarios previstos: personas que preparan catálogos, equipos técnicos que
consumen HTTP y desarrolladores que mantienen la API. No hay autenticación
multiusuario ni evidencia de clientes reales.

| Capacidad revisada | Implementación / pruebas representativas |
| --- | --- |
| CSV estricto, normalización, errores por fila/campo y límites | [src/csv](../src/csv/process-products-csv.ts), [parser](../tests/csv-parser.test.ts), [productos](../tests/csv-products.test.ts), [límites](../tests/csv-limits.test.ts) |
| Importación atómica, restricciones y migración reproducible | [repositorio SQL](../src/persistence/import-repository.ts), [integración de persistencia](../tests/integration/persistence.test.ts) |
| Repetición exacta, conflictos y concurrencia | [ImportService](../src/imports/import-service.ts), [integración del servicio](../tests/integration/import-service.test.ts) |
| POST /importaciones, multipart y clasificación HTTP | [adaptador](../src/http/import-route.ts), [recepción](../src/http/receive-csv.ts), [HTTP con PostgreSQL](../tests/integration/import-http.test.ts) |
| GET /productos, GET /importaciones y GET /importaciones/:id | [rutas de lectura](../src/http/read-routes.ts), [integración de consultas](../tests/integration/read-http.test.ts) |
| GET /health, arranque y cierre de conexiones | [health](../tests/health.test.ts), [aceptación del proceso compilado](../tests/integration/acceptance.test.ts) |

Se contrastó el [alcance aprobado](PROJECT_BRIEF.md) con estos componentes y la
[matriz A–G](VALIDACION_V1.md#matriz-de-aceptación). No se identificaron criterios
funcionales incumplidos dentro del alcance V1. D01–D10 se conservan sin cambios;
las referencias históricas de diseño en CONTRATO_CSV se contextualizan con
PERSISTENCIA y los contratos HTTP, que describen la implementación actual.

## Arquitectura y tecnologías efectivas

Aplicación TypeScript estricta/NodeNext sobre Node.js 24 y Express.
HTTP adapta solicitudes/resultados; el procesador CSV trabaja con bytes sin I/O;
ImportService coordina validación, identidad y conflictos; ImportRepository
ejecuta SQL parametrizado con pg. PostgreSQL 18 almacena productos/importaciones
y refuerza integridad. Un pool compartido se cierra al detener el proceso.

Multiparty analiza multipart acotado en memoria y content-type valida MIME.
Vitest y Supertest cubren comportamiento; PostgreSQL real verifica integridad
y concurrencia. tsx sirve al desarrollo/migraciones; GitHub Actions automatiza
comprobaciones. Apache, PHP y MySQL no participan.

## Decisiones y alternativas

| Decisión implementada | Razón | Alternativa y límite |
| --- | --- | --- |
| CSV estricto, cabecera fija y sin multilínea; parser acotado | Errores localizables y normalización inequívoca según D01–D04 | Un parser permisivo/mapeo de columnas ampliaría el contrato; no se ofrece |
| SKU ASCII en mayúsculas y nombre Unicode NFC | Detectar duplicados sin depender de la caja; conservar nombres Unicode | No se deduplica por nombre ni se transliteran SKU |
| Precio convertido de dígitos decimales a céntimos enteros | Evitar redondeo y pérdida por coma flotante; 0.29 → 29 | Un tipo decimal sería posible con otro diseño; V1 usa integer y rangos acotados |
| Una transacción PostgreSQL por importación | Importación y productos se confirman juntos o revierten | Los commits por lotes permitirían aceptación parcial, contraria a D08 |
| SHA-256 de bytes originales | Identidad exacta independiente del nombre y multipart | Una huella de datos normalizados agruparía archivos distintos; no es D09 |
| Recuperar resultado confirmado: 201 nueva / 200 repetida | Reintentar sin duplicar y conservar ID/cantidad | No es upsert; otro archivo con SKU existente recibe 409 |
| Unicidad SQL de huella/SKU y recuperación tras rollback | Resolver carreras más allá de una consulta previa o un mutex local | Esperas finitas pueden producir 503; no se promete éxito de toda petición concurrente |
| Ordenar inserciones por SKU y usar READ COMMITTED | Reducir ciclos de bloqueo y recuperar con una lectura nueva | No elimina todo fallo transitorio; COMMIT incierto se trata explícitamente |
| Pruebas con base exclusiva y esquemas propios | Evitar limpiar datos compartidos; migrar desde cero y limpiar lo creado | Requieren PostgreSQL real; no se omiten si falta configuración |
| Separación HTTP/CSV/servicio/SQL y consultas parametrizadas | Probar responsabilidades y conservar reglas fuera de Express | Sin ORM ni capas distribuidas; no se anticipan componentes ajenos al alcance |

Después de un COMMIT incierto se intenta recuperar la huella. Si no hay evidencia
suficiente se responde 503 y se pide repetir los mismos bytes; no se afirma que
hubo rollback. Las restricciones de base protegen las escrituras concurrentes;
ninguna respuesta 200 se basa en una importación todavía no confirmada.

## Casos representativos y reproducibilidad

- UTF-8/BOM, LF/CRLF, comillas escapadas; rechazos de cabecera, multilínea y columnas.
- Normalización NFC/SKU, precio cero y límites, 100 detalles con truncamiento.
- 201 y datos exactos; 200 con ID/cantidad originales y sin registros nuevos.
- 409 con filas nuevas y conflictivas: catálogo previo intacto, sin inserción parcial.
- Rollback tras una inserción, reintento posterior y restricciones UNIQUE/FK/CHECK.
- Solicitudes idénticas concurrentes 201/200; archivos distintos con SKU común 201/409.
- Pérdida de respuesta tras COMMIT real inyectada en el driver y recuperación posterior.
- Filtros, paginación, total en página vacía, 400/404 y consultas en modo SQL read-only.
- Servidor compilado, health y cierre con cero conexiones propias; SIGTERM real en CI Linux.

La sesión 09 reprodujo instalación con npm ci, tipos, build y 453 casos en una
copia Windows sin dependencias/configuración heredadas en disco, con una base
temporal propia y migración/reaplicación. Eliminó sus recursos temporales.
La sesión 09.1 repitió las comprobaciones y verificó la exclusión bajo Git Bash.
Son resultados históricos locales, distintos de la CI Linux enlazada arriba.

El lock fija dependencias; la migración registra checksum e historial.
Desarrollo y pruebas usan bases separadas y .env excluido. Las instrucciones
de [VALIDACION_V1](VALIDACION_V1.md) permiten repetir instalación, migraciones,
peticiones y pruebas. La CI usa credenciales desechables y no depende de .local.

## Limitaciones y cierre formal

No hay frontend, autenticación, edición/eliminación, despliegue público ni
integraciones externas. Los límites CSV/multipart son deliberados y no
certifican capacidad bajo carga. No hay pruebas de carga ni cortes físicos de
red; la pérdida de COMMIT se simula en el driver. OFFSET no comparte instantánea
entre solicitudes; cada listado sí obtiene total y página en una misma sentencia.

Estas exclusiones no bloquean el alcance V1 ni se convierten en tareas
obligatorias. Esta evidencia puede servir a una futura actualización del
portfolio/CV o entrevista; no se modifica ni publica ahora ningún material
profesional. Pendientes únicamente de esta entrega: revisión/publicación manual
y comprobación de la CI del nuevo commit documental para registrar el cierre.
