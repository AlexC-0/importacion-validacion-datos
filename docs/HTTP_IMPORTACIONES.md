# Importaciones HTTP — sesión 07

## Uso local

`POST /importaciones` recibe exactamente un archivo en el campo `archivo`,
mediante `multipart/form-data`. No admite campos adicionales. El nombre y la
extensión no determinan la validez del CSV.

Configura `DATABASE_URL` en `.env`, comprueba la instancia existente y aplica
la migración si corresponde; no se ejecutan migraciones al arrancar la API:

~~~powershell
npm run db:local -- -Action Status
# Solo si está detenida:
npm run db:local -- -Action Start
npm run db:migrate
npm run dev
~~~

Consulta [PERSISTENCIA](PERSISTENCIA.md) para preparar una instalación nueva.
No vuelvas a inicializar el cluster existente.

Ejemplo de `productos.csv`, guardado como UTF-8:

~~~csv
sku,nombre,precio_eur,stock
DEMO-07,Café,0.29,2
~~~

En otra terminal, desde la carpeta del archivo:

~~~powershell
curl.exe -i -F "archivo=@productos.csv;type=text/csv" http://127.0.0.1:3000/importaciones
~~~

Usa `curl.exe` para evitar el alias de Windows PowerShell. Deja que el cliente
genere el boundary; no establezcas manualmente un Content-Type raíz sin boundary.
El ejemplo guarda datos en la base configurada por quien lo ejecuta.

Una importación nueva confirmada devuelve 201:

~~~json
{
  "importacion_id": "23b6697c-108d-443a-92c4-18681f7a2eed",
  "estado": "completada",
  "productos_importados": 1
}
~~~

El identificador es ilustrativo. Reenviar exactamente los mismos bytes, incluso
renombrando el archivo, devuelve 200 con el mismo identificador y cantidad.
Cambiar BOM, espacios, finales de línea u orden genera otra huella: puede
producir 409 por SKU existentes. No se crea un resultado nuevo al recuperar otro.

## Respuestas

| HTTP | Situación | Código general de error |
| --- | --- | --- |
| 201 | Nueva importación confirmada | Sin bloque error |
| 200 | Recuperación de una importación confirmada | Sin bloque error |
| 400 | Solicitud/multipart inválido, UTF-8 o estructura CSV inválidos | INVALID_REQUEST, INVALID_ENCODING, INVALID_CSV, INVALID_HEADER, COLUMN_COUNT_MISMATCH |
| 413 | Exceso de bytes de archivo/cuerpo o de filas | FILE_TOO_LARGE, TOO_MANY_ROWS |
| 415 | Tipo de solicitud/parte o charset no admitido | UNSUPPORTED_MEDIA_TYPE |
| 422 | Datos inválidos, duplicados internos o ausencia de productos | VALIDATION_FAILED, EMPTY_IMPORT |
| 409 | Otro archivo con SKU registrados | SKU_ALREADY_EXISTS |
| 500 | Error inesperado de persistencia o ejecución | PERSISTENCE_ERROR |
| 503 | Persistencia no disponible o resultado de COMMIT no demostrable | SERVICE_UNAVAILABLE |

Los detalles del servicio se conservan, incluidas fila, campo, motivo,
`fila_original` para duplicados internos y `errores_truncados`. Ejemplo 422:

~~~json
{
  "error": {
    "codigo": "VALIDATION_FAILED",
    "mensaje": "El archivo contiene datos inválidos.",
    "detalles": [
      {
        "fila": 2,
        "campo": "precio_eur",
        "codigo": "INVALID_PRICE",
        "motivo": "Usa un importe de 0 a 999999.99, con punto y hasta dos decimales, sin signos ni ceros iniciales."
      }
    ],
    "errores_truncados": false
  }
}
~~~

Los errores de recepción usan fila y campo null. Ningún error incluye SQL,
credenciales, stack traces o mensajes originales de excepciones.
La propiedad interna `commit` del servicio no se publica. Un COMMIT incierto
sin recuperación demostrable responde 503 y pide reintentar los mismos bytes;
no afirma que no se hayan guardado datos. La recuperación demostrada devuelve 200.

## Recepción, límites y memoria

- Tipos de parte admitidos: text/csv, application/octet-stream o ausencia de tipo.
- Todo charset declarado debe ser UTF-8, sin distinción de mayúsculas.
  Un charset vacío o malformado se rechaza.
- Archivo máximo inclusivo: 5242880 bytes originales.
- Cuerpo multipart máximo inclusivo: 5308416 bytes, también con transferencia chunked.
- Se cuentan los bytes de todo el cuerpo, incluidas cabeceras y epílogo multipart.
  Content-Length solo permite rechazo temprano; no sustituye al contador real.
- Se cuentan por separado los bytes de archivo. Al superar el límite se detiene
  la recepción, sin esperar el cierre multipart ni llamar al servicio.
- No se descomprime el cuerpo ni se decodifican partes base64. Los bytes originales
  llegan sin transformación al servicio.
- El procesador conserva 10000 productos como máximo y 100 detalles de error.
- Un fallo de recepción interrumpe los streams, entrega JSON cuando la conexión
  lo permite y cierra esa conexión; no drena un cuerpo de tamaño ilimitado.
- Una desconexión del cliente antes de terminar impide llamar al servicio.
  Si el cliente ya se desconectó, no se puede garantizar que reciba una respuesta.

Se utiliza [multiparty](https://github.com/pillarjs/multiparty) 4.3.1 mediante
eventos `part`, con autoFiles y autoFields desactivados y sin callback de parse.
Este modo expone cabeceras de parte y streams y evita almacenamiento temporal.
Un Transform cuenta el cuerpo antes del parser y otro contador acota el archivo.
Solo se entrega el buffer después del cierre correcto del cuerpo y las partes.
Los tipos de multiparty omiten Writable y maxHeaderSize: se adapta esa declaración
al objeto real de la versión fijada.

[content-type](https://github.com/jshttp/content-type/tree/v1.0.5) 1.0.5 analiza
las cabeceras MIME con gramática estricta; se fija la rama 1.0 para no adoptar
el parsing permisivo de parámetros malformados de versiones mayores.
Ambas dependencias tienen tipos de desarrollo y versiones resueltas en el lock.
No se añade otro parser CSV.

La recepción tiene un plazo operativo de 30 segundos: una subida que no termina
recibe 400 INVALID_REQUEST si aún es posible responder. No cambia los límites de
datos de D06. La memoria por solicitud está acotada por el cuerpo, buffers del
stream y archivo (la concatenación final puede copiarlo); no se promete una
cuota global de memoria bajo carga simultánea. Quedan pendientes pruebas de carga.

## Composición y ciclo de vida

`createApp(service)` permite inyectar un importador tipado. El controlador solo
recibe bytes y traduce resultados; el servicio conserva validación, SHA-256,
transacciones, conflictos y coordinación concurrente.

`src/server.ts` crea un único pool por proceso usando DATABASE_URL.
No crea una conexión por petición. El pool abre conexiones de forma diferida.
Sin DATABASE_URL, health responde normalmente; un CSV válido recibe 503 y los
CSV inválidos conservan la validación previa a persistencia.

SIGINT/SIGTERM dejan de aceptar conexiones nuevas, esperan las peticiones activas
y cierran el pool una sola vez. Tras 35 segundos de gracia se cierran las
conexiones HTTP restantes. Una terminación forzosa del sistema operativo no
permite garantizar que se ejecuten los manejadores de cierre.
GET /health conserva 200 y `{"status":"ok"}`; no es una prueba de conexión SQL.
El servidor continúa escuchando solo en 127.0.0.1.

## Pruebas y alcance pendiente

~~~powershell
npm run typecheck
npm test
npm run build
npm run test:integration
~~~

50 pruebas nuevas sin PostgreSQL cubren HTTP, errores, límites inclusive/exceso,
transferencia chunked, rechazo antes de terminar la subida, desconexión, timeout
y prioridad de validación. Las 11 nuevas de integración usan PostgreSQL real
solo en esquemas propios de la base exclusiva de pruebas.

Las carreras HTTP sincronizan solicitudes con conexiones PostgreSQL de PID
distintos: archivos idénticos obtienen 201/200; archivos distintos con SKU comunes
obtienen 201/409 sin productos parciales. Se comprueba rollback tras una inserción
y pérdida de respuesta después de un COMMIT real, inyectada en el driver.
No equivale a cortar físicamente la red ni a una prueba de carga.

Resultados y demostración real en [STATUS](STATUS.md). La sesión 07 está publicada
en 96a9ae0. La sesión 08 incorpora las [consultas HTTP](HTTP_CONSULTAS.md) de
productos e importaciones. No hay frontend, autenticación,
integraciones externas, colas, upsert ni despliegue.
