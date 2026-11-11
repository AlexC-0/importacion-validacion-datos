# Proyecto 01 — Importación y validación de datos

## Contexto y problema

CHAMBA DIARIA es un itinerario de desarrollo profesional con funcionalidades
verificables, documentación, pruebas y control de versiones.

Los catálogos de productos recibidos en CSV pueden contener datos inválidos o
duplicados. Se necesita una API que detecte los problemas, explique cómo
corregirlos y evite persistir importaciones parciales o repetidas.

## Usuarios previstos

- Personas que preparan y revisan archivos de productos.
- Equipos técnicos que envían archivos y consultan los resultados mediante HTTP.
- Desarrolladores que mantienen y verifican la API.

Estos perfiles describen usos previstos; no implican autenticación ni gestión
multiusuario en la primera versión.

## Funcionalidades implementadas para la primera versión

1. Recibir archivos CSV de productos mediante una API REST.
2. Validar formato y datos de cada registro.
3. Detectar registros duplicados mediante el SKU normalizado definido en el contrato.
4. Informar de errores identificando fila y campo, con un mensaje comprensible.
5. Guardar productos e importaciones válidas en PostgreSQL mediante transacciones.
6. Impedir que una misma importación se procese y guarde más de una vez.
7. Permitir consultar productos e importaciones.
8. Mantener pruebas automatizadas y documentación técnica reproducible.

Una importación inválida no debe dejar productos parcialmente guardados.
V1 no almacena de forma persistente intentos fallidos, según D08.
El modelo de datos y la transacción inicial se implementan en la sesión 05;
la coordinación funcional y concurrente se incorpora en la sesión 06.

## Sesión 01 — Completada

Se creó la base independiente con Node.js, TypeScript, Express, Vitest y
Supertest, `GET /health`, su prueba, scripts y documentación inicial.
El commit `852e829` está publicado en `main` en el repositorio público
[AlexC-0/importacion-validacion-datos](https://github.com/AlexC-0/importacion-validacion-datos).
La API no está desplegada.

## Sesión 02 — Completada y publicada

Se actualizó el estado, se estableció la norma permanente de commits y push
manuales y se preparó la propuesta de [CONTRATO_CSV.md](CONTRATO_CSV.md).
El usuario publicó el commit `cb89a65`, integrado en `main` mediante `52bc5c1`.
Se conservaron intactos el código, las dependencias y el comportamiento de la API.

## Sesión 03 — Completada y publicada

D01–D10 quedaron aprobadas y consolidadas en `47278b3`, publicado en `main`.
El contrato distingue nueva importación confirmada con 201, repetición exacta
con 200 y recuperación del resultado existente, y otro archivo con SKU
existentes con 409. Se alinearon ejemplos, códigos, concurrencia y casos límite
sin implementar funcionalidades.

## Sesión 04 — Procesamiento y validación CSV, publicada

Publicada en `b1cb2e2`. Esta sesión incorporó un componente independiente que recibe
bytes originales y devuelve productos normalizados o errores estructurados.

- Interpretación estricta de UTF-8, BOM, comillas, delimitador, cabecera y filas.
- Normalización y validación de SKU, nombre, precio y stock.
- Precios exactos en céntimos y duplicados internos con referencia a la primera fila.
- Límites de contenido y detalles, prioridad estructural y rechazo completo.
- Pruebas con Vitest, conservando la prueba existente de `GET /health`.
- Parser acotado al contrato, sin dependencias añadidas ni cambios en las rutas.

No incorpora recepción HTTP, multipart, persistencia, transacciones, conflictos
contra catálogo, idempotencia persistente ni concurrencia.
Alex confirmó y publicó esos cambios. La capa CSV permanece independiente.

## Sesión 05 — PostgreSQL y persistencia transaccional, publicada

Alex publicó esta entrega en `59dbc42`.

- Instancia PostgreSQL local aislada autorizada por Alex, con bases separadas.
- Modelo mínimo de importaciones y productos, migración SQL versionada y driver pg.
- Inserción atómica de la importación y sus productos; rollback ante errores.
- Restricciones de unicidad, referencias, normalización y rangos en SQL.
- Consultas internas de comprobación y pruebas reales en esquemas propios.
- Documentación del modelo y preparación en [PERSISTENCIA](PERSISTENCIA.md).

No incorpora rutas, multipart, interfaz, autenticación, despliegue ni clasificación
funcional de respuestas 200/201/409 durante la sesión 05.

## Sesión 06 — Coordinación de importaciones

- Servicio independiente de Express que valida CSV antes de consultar PostgreSQL.
- SHA-256 de bytes originales, recuperación por huella y conflictos de SKU.
- Una sola creación para archivos idénticos concurrentes; recuperación posterior
  del identificador y cantidad confirmados.
- Rechazo completo de archivos diferentes con SKU existentes, sin upsert.
- Recuperación tras rollback de unicidad y distinción de COMMIT incierto.
- Pruebas con conexiones independientes, barreras de sincronización y fallos
  controlados, conservando las suites anteriores.
- Sin cambios de esquema, dependencias, rutas ni infraestructura.

Alex publicó la sesión 06 en `f4b63e3`, verificado al iniciar la sesión 07.

## Sesión 07 — Integración HTTP de importaciones, publicada

- `POST /importaciones` recibe un archivo multipart en el campo `archivo`.
- Límites de bytes originales y cuerpo completo, tipos MIME y charset UTF-8.
- Adaptador HTTP sobre el servicio existente, sin duplicar reglas CSV ni SQL.
- Respuestas 201/200/400/413/415/422/409/500/503 y errores sin información interna.
- Pool compartido por proceso, inyección para pruebas y cierre al detener la API.
- Pruebas HTTP y PostgreSQL real, incluidas concurrencia e incertidumbre de COMMIT.
- `GET /health` preservado; sin cambios en D01–D10 ni migraciones publicadas.

Alex publicó la sesión 07 en `96a9ae0`, verificado al iniciar la sesión 08.

## Sesión 08 — Consultas HTTP de solo lectura, publicada

- GET /productos con orden por SKU, paginación y filtro por importación.
- GET /importaciones con fecha descendente e ID como desempate.
- GET /importaciones/:id con metadatos, hash y 404 para UUID inexistente.
- Validación previa, errores seguros y consultas SQL parametrizadas.
- Total y página en una misma instantánea; precios exactos y Unicode preservados.
- Pruebas HTTP, PostgreSQL en modo read-only y verificación de filas sin cambios.
- Sin nuevas tablas, dependencias ni cambios en D01–D10 o en la importación.

Contrato: [HTTP_CONSULTAS](HTTP_CONSULTAS.md). Alex publicó esta entrega en
`cb4e48c`, verificado al iniciar la sesión 09.

## Sesión 09 — Validación integral y candidata V1

- Matriz de aceptación ligada a las suites existentes, sin duplicarlas.
- Prueba del servidor compilado: importación, recuperación, conflicto,
  consultas, health y cierre sin conexiones propias residuales.
- Corrección demostrada: PostgreSQL 53300 devuelve 503 en importación.
- 453 pruebas correctas, tipos y build, también desde una copia limpia.
- Migración y reaplicación en una base temporal nueva; HTTP real y limpieza.
- Workflow Linux con Node.js 24/PostgreSQL 18, credenciales desechables y
  permisos de lectura; publicado en 61eff54. La primera ejecución falló y
  la corrección 09.1 publicada en 90b0066 pasó la CI completa.
- Sin nuevas funcionalidades, dependencias, tablas ni cambios de D01–D10.

Evidencia y pasos: [VALIDACION_V1](VALIDACION_V1.md). Alex publicó la sesión 09
en 61eff54. La sesión 09.1 corrige la expansión del glob en test y test:watch
que hizo fallar npm test en la primera CI. Las 453 pruebas pasan localmente;
la corrección está publicada en 90b0066 y la CI 43102797061 terminó en SUCCESS.

## Sesión 10 — Revisión de cierre y evidencias técnicas

Se contrastaron los criterios de V1 con contratos, código y suites existentes.
No se identificaron incumplimientos funcionales dentro del alcance aprobado.
La [ficha de evidencias](EVIDENCIAS_V1.md) documenta capacidades, arquitectura,
decisiones, alternativas, límites y referencias públicas verificadas.

La V1 está técnicamente preparada para cierre formal. La entrega documental
sigue local: el cierre definitivo queda condicionado a revisión, publicación
manual y comprobación de la CI correspondiente a su nuevo commit. No se
traslada el SUCCESS de 90b0066 a un commit posterior.

## Exclusiones

- Interfaz web completa.
- Autenticación multiusuario y gestión de permisos.
- Integraciones externas.
- Microservicios y arquitectura distribuida.
- Despliegue del servicio.
- Sustituir PostgreSQL por MySQL o usar PHP/Apache como servidor de esta API.
- Implementar importación, persistencia o consultas funcionales durante las sesiones 01, 02 y 03.

## Contrato aprobado y validación pendiente

El formato aprobado es `sku,nombre,precio_eur,stock`.
[CONTRATO_CSV.md](CONTRATO_CSV.md) recoge D01–D10: tipos y límites,
normalización, validación, duplicados, atomicidad, huella de bytes originales,
errores y respuestas HTTP. No quedan decisiones D01–D10 pendientes de aprobación.

El parsing y la validación en memoria están implementados en `src/csv/`.
La sesión 05 añade persistencia con UUID, precios enteros, relaciones y consultas
internas. La sesión 06 coordina reintentos y conflictos bajo concurrencia.
La sesión 07 añade recepción multipart y respuestas HTTP de importación.
La sesión 08 incorpora el contrato y las rutas de consulta HTTP.
La sesión 09 comprueba el conjunto y prepara CI; la corrección 09.1 supera
la ejecución remota 43102797061. La sesión 10 documenta el cierre técnico;
su publicación y CI quedan pendientes para el cierre definitivo. Los límites aprobados de V1 se
evaluarán con futuras pruebas de carga; no se modifican en esta sesión.

## Criterios de finalización de la primera versión

- Un CSV válido guarda los productos previstos y permite consultar la importación.
- Los errores de datos señalan filas y campos y se verifican mediante pruebas.
- Se detectan los duplicados definidos por el contrato, tanto dentro del archivo
  como respecto de los productos ya guardados.
- Reenviar los mismos bytes de una importación confirmada devuelve 200 con su
  resultado original, sin duplicar productos ni crear otra importación.
- Una validación fallida o un error de persistencia no deja productos parciales.
- Las consultas de productos e importaciones funcionan según el contrato documentado.
- Hay pruebas de casos válidos, inválidos, duplicados, repetición y rollback.
- Una instalación limpia permite compilar y ejecutar las pruebas con instrucciones
  reproducibles, sin secretos en el repositorio.
- La CI de la candidata debe ejecutarse en GitHub y revisarse sobre el commit
  publicado manualmente antes de declarar cerrada V1.

Resultado de revisión de la sesión 10: criterios funcionales y de reproducción
cumplidos con evidencia local histórica y CI Linux sobre 90b0066, 453 pruebas.
La [matriz A–G](VALIDACION_V1.md#matriz-de-aceptación) relaciona requisitos y suites.
Solo queda revisar/publicar esta entrega y verificar su CI para el cierre formal;
las exclusiones no generan obligaciones de implementación adicionales.

## Criterios de cierre de la sesión 01

Carpeta independiente, proyecto anterior intacto, dependencias instalables,
TypeScript compilable, `GET /health` operativo y probado, documentación coherente
y commit inicial revisado. El estado de GitHub debe indicarse con exactitud,
incluida cualquier confirmación o acción pendiente.

## Criterios de cierre de la sesión 02

La sesión 02 entregó documentación coherente, la norma permanente de commits y
push manuales y un contrato entonces propuesto con casos verificables.
La entrega ya fue confirmada y publicada por el usuario, sin implementar
endpoints adicionales ni persistencia.

## Criterios de cierre de la sesión 03

D01–D10 registradas como aprobadas, repetición exacta coherente con HTTP 200 en
todo el contrato, referencias y ejemplos comprobados, e identificación de
aspectos internos pendientes. Los cambios documentales se entregaron sin staging,
commit ni push por parte de Codex; Alex ya los confirmó y publicó en `47278b3`.

## Criterios de cierre de la sesión 04

Componente reutilizable y tipado conforme a las reglas de contenido CSV,
con pruebas de casos válidos, inválidos, límites y errores localizados.
`typecheck`, `test` y `build` deben pasar, incluida la prueba HTTP existente.
La documentación distingue implementación disponible y garantías futuras.
No se modifican dependencias, rutas ni infraestructura; los cambios se dejan
sin staging, commit ni push para revisión manual.

La sesión 04 ya está publicada. Sus comprobaciones históricas se conservan
separadas de las ejecuciones de la sesión 05.

## Criterios de cierre de la sesión 05

Esquema reproducible desde cero, restricciones verificadas en PostgreSQL real,
persistencia transaccional sin residuos al fallar una inserción y conexiones
cerradas/liberadas correctamente. Las pruebas existentes, tipos y compilación
deben seguir pasando. No considerar validada la persistencia si se omite la
integración por falta de entorno.

La sesión 05 está publicada en `59dbc42`; sus resultados se consideran históricos.

## Criterios de cierre de la sesión 06

Resultados tipados para creación, recuperación, CSV inválido, conflicto y fallo
técnico; huella de bytes originales, prioridad de repetición exacta, atomicidad
y unicidad verificadas con conexiones PostgreSQL independientes.
La incertidumbre de COMMIT se representa sin afirmar éxito ni rollback no probado.

La sesión 06 está publicada en `f4b63e3`; sus resultados son históricos.

## Criterios de cierre de la sesión 07

Recepción multipart acotada, contrato HTTP completo y reutilización del servicio.
Pruebas de límites, errores, atomicidad y concurrencia; arranque y petición real.
Tipos, pruebas y compilación correctos; documentación y cambios sin staging.

La sesión 07 está publicada en `96a9ae0`.

## Criterios de cierre de la sesión 08

Tres consultas funcionales, paginación determinista, filtro por importación,
metadatos correctos y errores de entrada/inexistencia/persistencia controlados.
Las consultas no modifican registros y solo observan datos confirmados.
Tipos, pruebas, build y demostración HTTP real correctos, sin cambios de esquema.

La sesión 08 está publicada en `cb4e48c`.

## Criterios de cierre de la sesión 09

Candidata comprobada localmente, instalación reproducida, datos de prueba
limpios, documentación coherente y CI preparada. No confundir esos resultados
con una ejecución remota: esta se verificó después en 43102797061 para 90b0066.
No se crean tags, releases ni despliegues.

## Criterios de cierre de la sesión 10

Documentación coherente con el código, evidencia de commit/CI exactos, matriz
satisfecha y límites explícitos. La revisión documental no sustituye una ejecución
de pruebas; no se repite la suite sin cambios de código. Los cambios permanecen
sin staging, commit ni push. Cierre definitivo tras revisión y publicación manuales
y verificación de la CI del commit documental.
