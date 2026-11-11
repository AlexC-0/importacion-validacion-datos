# Contrato de consultas HTTP — V1

Contrato de lectura de la sesión 08, documentado antes de implementar las rutas.
Adopta los valores propuestos en el encargo. No modifica D01–D10 ni los errores
específicos de POST /importaciones.

## Rutas y parámetros

| Ruta | Parámetros admitidos | Orden |
| --- | --- | --- |
| GET /productos | limit, offset, importacion_id opcional | SKU ascendente, comparación ASCII (collation C del esquema) |
| GET /importaciones | limit, offset | creada_en descendente, id descendente como desempate |
| GET /importaciones/:id | UUID en la ruta; ningún parámetro de consulta | Un registro |

limit: entero decimal de 1 a 100, predeterminado 20.
offset: entero decimal de 0 a 9007199254740991, predeterminado 0.
La cota de offset permite representarlo exactamente como número JSON.
Se admiten solo dígitos ASCII, sin signos, espacios, exponentes, fracciones
ni ceros iniciales salvo el propio 0. Valores vacíos son inválidos.

Todos los parámetros desconocidos, repetidos (incluso con igual valor) o con
notación de arrays/objetos se rechazan con 400. La validación se realiza después
de decodificar la URL, antes de consultar PostgreSQL. Codificación URL inválida
también produce 400.

UUID: forma hexadecimal canónica 8-4-4-4-12 con guiones, sin llaves ni espacios.
Se aceptan letras mayúsculas/minúsculas y se normalizan a minúsculas.
No se restringen versión ni variante: un UUID sintácticamente válido que no
esté registrado produce 404 en detalle y lista vacía al usarse como filtro.

## GET /productos

Respuesta 200:

~~~json
{
  "productos": [
    {
      "id": "d2359f1c-41fe-4c42-886c-01157701cd70",
      "sku": "AB-001",
      "nombre": "Café",
      "precio_centimos": 29,
      "stock": 2,
      "importacion_id": "a2c10e86-a049-4d16-8f92-9023b3f44001"
    }
  ],
  "paginacion": { "limit": 20, "offset": 0, "total": 1 }
}
~~~

Se exponen exactamente esos seis campos. Precio en céntimos enteros, sin
convertir a euros ni redondear; nombre Unicode conservado.
importacion_id filtra productos asociados a esa importación.

total cuenta todas las coincidencias del filtro antes de paginar.
Si no hay coincidencias: productos vacío y total 0.
Si offset supera las coincidencias: productos vacío, conservando el total real.

## GET /importaciones

Solo devuelve importaciones confirmadas, nunca transacciones pendientes ni
intentos fallidos. El esquema V1 ya registra únicamente importaciones completadas.

~~~json
{
  "importaciones": [
    {
      "id": "a2c10e86-a049-4d16-8f92-9023b3f44001",
      "version_contrato": "csv-v1",
      "productos_importados": 1,
      "creada_en": "2026-11-11T12:00:00.000Z"
    }
  ],
  "paginacion": { "limit": 20, "offset": 0, "total": 1 }
}
~~~

No incluye sha256 en el listado. Fechas ISO 8601 UTC serializadas con Z y
precisión de milisegundos; la ordenación SQL usa la precisión original de
PostgreSQL. El identificador desempata fechas iguales.
Un catálogo vacío o un offset superior al total siguen respondiendo 200.

## GET /importaciones/:id

Si existe, respuesta 200 con objeto directo:

~~~json
{
  "id": "a2c10e86-a049-4d16-8f92-9023b3f44001",
  "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "version_contrato": "csv-v1",
  "productos_importados": 1,
  "creada_en": "2026-11-11T12:00:00.000Z"
}
~~~

Los identificadores y huella de los ejemplos son ilustrativos.
Los productos se consultan mediante GET /productos?importacion_id=<UUID>;
no se incluyen dentro del detalle.

## Errores

| HTTP | Código | Motivo |
| --- | --- | --- |
| 400 | INVALID_REQUEST | Parámetros o UUID inválidos, ambiguos o desconocidos |
| 404 | NOT_FOUND | UUID válido de una importación inexistente |
| 500 | PERSISTENCE_ERROR | Fallo inesperado de consulta |
| 503 | SERVICE_UNAVAILABLE | PostgreSQL no disponible, timeout o fallo transitorio |

~~~json
{
  "error": {
    "codigo": "NOT_FOUND",
    "mensaje": "La importación no existe.",
    "detalles": [],
    "errores_truncados": false
  }
}
~~~

NOT_FOUND pertenece exclusivamente al contrato de lectura. Los errores de
parámetros llevan un detalle con fila null, campo igual al parámetro admitido afectado,
codigo INVALID_REQUEST y motivo en castellano. Los errores de ruta/URL sin un
parámetro localizable y los parámetros desconocidos usan campo null.
Se informa del primer fallo encontrado.
No se exponen SQL, credenciales, stack traces ni mensajes originales de PostgreSQL.

## Persistencia y consistencia

Las consultas usan el pool existente y parámetros SQL. No hay nuevas tablas,
migraciones, dependencias, transacciones de escritura ni cambios del catálogo.
Cada listado obtiene total y página mediante una única sentencia SELECT, con
la misma instantánea de datos confirmados. Si el total no pudiera representarse
como entero JSON seguro, se devuelve 500 en lugar de redondearlo.

La instantánea por sentencia sigue el aislamiento
[Read Committed de PostgreSQL](https://www.postgresql.org/docs/18/transaction-iso.html).
El orden es determinista para los datos visibles en cada solicitud. OFFSET
no congela el catálogo entre peticiones: importaciones nuevas pueden desplazar
las páginas. No se prometen cursores ni una instantánea compartida entre solicitudes.
Los offsets altos y COUNT exactos pueden resultar costosos; no son un mecanismo
de búsqueda avanzada ni sustituyen las futuras pruebas de carga.

## Uso local y verificación

Con DATABASE_URL configurada y la API arrancada mediante npm run dev o npm start:

~~~powershell
curl.exe -i "http://127.0.0.1:3000/productos?limit=20&offset=0"
curl.exe -i "http://127.0.0.1:3000/importaciones?limit=1&offset=0"
# Sustituye el UUID por uno recuperado del listado o de POST /importaciones:
curl.exe -i "http://127.0.0.1:3000/importaciones/a2c10e86-a049-4d16-8f92-9023b3f44001"
curl.exe -i "http://127.0.0.1:3000/productos?importacion_id=a2c10e86-a049-4d16-8f92-9023b3f44001"
~~~

Sin persistencia configurada, los parámetros inválidos conservan 400 y las
consultas válidas devuelven 503. GET /health y POST /importaciones conservan
sus contratos. No hay edición, eliminación, exportación, frontend ni autenticación.

~~~powershell
npm run typecheck
npm test
npm run build
npm run test:integration
~~~

La sesión 08 añade 89 pruebas de parámetros/HTTP y 14 de integración real.
Las pruebas reales utilizan únicamente esquemas propios de la base exclusiva
de integración. Resultados de ejecución y demostración HTTP en [STATUS](STATUS.md).
Configuración PostgreSQL en [PERSISTENCIA](PERSISTENCIA.md) y contrato de subida
en [HTTP_IMPORTACIONES](HTTP_IMPORTACIONES.md).
