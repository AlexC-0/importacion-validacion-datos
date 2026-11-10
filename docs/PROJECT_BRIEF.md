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
3. Detectar registros duplicados de acuerdo con una clave de producto por definir.
4. Informar de errores identificando fila y campo, con un mensaje comprensible.
5. Guardar productos e importaciones válidas en PostgreSQL mediante transacciones.
6. Impedir que una misma importación se procese y guarde más de una vez.
7. Permitir consultar productos e importaciones.
8. Mantener pruebas automatizadas y documentación técnica reproducible.

Una importación inválida no debe dejar productos parcialmente guardados.
El diseño del registro de intentos fallidos se decidirá junto con el modelo
de datos; no se presupone un esquema en esta sesión.

## Alcance de la sesión 01

- Crear una carpeta y un repositorio Git independientes.
- Configurar Node.js, TypeScript, Express, Vitest y Supertest.
- Implementar `GET /health` y su prueba.
- Incorporar scripts de desarrollo, tipos, compilación y testing.
- Preparar documentación, reglas operativas y exclusiones de Git.
- Verificar la base técnica y crear un commit inicial.
- Preparar GitHub; crear y publicar el remoto solo tras confirmación expresa.

## Exclusiones

- Interfaz web completa.
- Autenticación multiusuario y gestión de permisos.
- Integraciones externas.
- Microservicios y arquitectura distribuida.
- Despliegue del servicio.
- Sustituir PostgreSQL por MySQL o usar PHP/Apache como servidor de esta API.
- Implementar importación, persistencia o consultas funcionales durante la sesión 01.

## Decisiones pendientes

Antes de implementar la importación se concretarán: columnas y tipos de datos
del CSV, campos obligatorios, clave única de producto, reglas de duplicados,
codificación y delimitador, límites de archivo, numeración de filas, formato de
errores y contrato de respuestas HTTP.

También se definirá cómo identificar una importación repetida, qué ocurre ante
solicitudes concurrentes y cómo consultar estados y resultados. PostgreSQL se
preparará en una sesión posterior, con Docker solo si resulta conveniente.

## Criterios de finalización de la primera versión

- Un CSV válido guarda los productos previstos y permite consultar la importación.
- Los errores de datos señalan filas y campos y se verifican mediante pruebas.
- Se detectan los duplicados definidos por el contrato, tanto dentro del archivo
  como respecto de los productos ya guardados.
- Repetir una importación no duplica productos ni importaciones procesadas.
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
