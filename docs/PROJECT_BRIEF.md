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

## Funcionalidades previstas para la primera versión

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
El modelo de datos y sus mecanismos internos se diseñarán posteriormente.

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

## Sesión 04 — Procesamiento y validación CSV

La autorización de esta sesión incorpora un componente independiente que recibe
bytes originales y devuelve productos normalizados o errores estructurados.

- Interpretación estricta de UTF-8, BOM, comillas, delimitador, cabecera y filas.
- Normalización y validación de SKU, nombre, precio y stock.
- Precios exactos en céntimos y duplicados internos con referencia a la primera fila.
- Límites de contenido y detalles, prioridad estructural y rechazo completo.
- Pruebas con Vitest, conservando la prueba existente de `GET /health`.
- Parser acotado al contrato, sin dependencias añadidas ni cambios en las rutas.

No incorpora recepción HTTP, multipart, persistencia, transacciones, conflictos
contra catálogo, idempotencia persistente ni concurrencia.
Los cambios quedan locales para revisión y publicación manual por el usuario.

## Exclusiones

- Interfaz web completa.
- Autenticación multiusuario y gestión de permisos.
- Integraciones externas.
- Microservicios y arquitectura distribuida.
- Despliegue del servicio.
- Sustituir PostgreSQL por MySQL o usar PHP/Apache como servidor de esta API.
- Implementar importación, persistencia o consultas funcionales durante las sesiones 01, 02 y 03.

## Contrato aprobado y aspectos de implementación pendientes

El formato aprobado es `sku,nombre,precio_eur,stock`.
[CONTRATO_CSV.md](CONTRATO_CSV.md) recoge D01–D10: tipos y límites,
normalización, validación, duplicados, atomicidad, huella de bytes originales,
errores y respuestas HTTP. No quedan decisiones D01–D10 pendientes de aprobación.

El parsing y la validación en memoria están implementados en `src/csv/`.
Quedan por diseñar recepción multipart, persistencia y coordinación concurrente
en PostgreSQL, formato de identificadores y consultas de productos e importaciones. Los límites aprobados de V1 se evaluarán
con futuras pruebas de carga; esa evaluación no impide usarlos como referencia.
No se añaden infraestructura ni tablas durante esta sesión.

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

Próxima sesión recomendada: preparar PostgreSQL, el modelo de productos e
importaciones y sus pruebas antes de integrar persistencia y recepción HTTP.
Requiere autorización específica de ese alcance.
