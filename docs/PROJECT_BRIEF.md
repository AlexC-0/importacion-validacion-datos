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

## Alcance de la sesión 03

- Consolidar D01–D10 aprobadas por Alex Cobián como contrato CSV V1.
- Reflejar la modificación de D10: nueva importación confirmada con 201,
  repetición exacta con 200 y recuperación del resultado existente sin nuevas
  inserciones, y otro archivo con SKU existentes con 409.
- Alinear ejemplos, códigos, concurrencia y casos límite con esas respuestas.
- Separar reglas contractuales de los aspectos internos de implementación pendientes.
- Actualizar el estado real y dejar la documentación para commit y push manuales.
- Mantener intactos código, pruebas, configuración y dependencias.
  La aprobación del contrato no autoriza implementar el importador.

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

Quedan por diseñar las bibliotecas y organización interna, la persistencia y
coordinación concurrente en PostgreSQL, el formato de identificadores y las
consultas de productos e importaciones. Los límites aprobados de V1 se evaluarán
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
aspectos internos pendientes. Los cambios documentales se entregan sin staging,
commit ni push; el usuario realizará la confirmación y publicación manuales.
