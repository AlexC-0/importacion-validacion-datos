# Contrato de importación CSV — V1

**Estado: D01–D10 aprobadas por Alex Cobián durante la sesión 03.**
Fecha de aprobación y consolidación documental: 11 de noviembre de 2026.
Identificador del contrato: `csv-v1`. Es una referencia contractual aprobada;
su aprobación se distingue del avance de implementación descrito en la sección 14.
La API no está desplegada.

## 0. Reglas aprobadas y alcance de esta referencia

Este contrato establece cómo importar productos con las columnas
`sku,nombre,precio_eur,stock`, informar de errores por fila y campo y evitar
duplicados. Una importación inválida no puede dejar productos guardados parcialmente.

Las reglas D01–D09 de la propuesta de la sesión 02 están aprobadas para V1.
D10 está aprobada con esta distinción obligatoria: nueva importación confirmada,
`201 Created`; repetición exacta de un archivo ya confirmado, `200 OK` con
el resultado existente; otro archivo con SKU existentes, `409 Conflict`.

Las secciones 1–13 fijan el comportamiento aprobado y sus ejemplos de referencia.
La sección 14 separa los aspectos internos de implementación aún pendientes.
La aprobación del contrato no autoriza por sí sola implementar el importador.
Estado de implementación: la sesión 04 incorporó validación CSV en memoria;
la sesión 05 añade tablas PostgreSQL, persistencia transaccional y pruebas reales.
La sesión 06 añade el servicio de coordinación, reintentos y conflictos, con
pruebas de concurrencia. La sesión 07 añade recepción multipart y respuestas HTTP
mediante `POST /importaciones`; `GET /health` permanece igual. Las reglas aprobadas
no cambian.

## 1. Codificación y delimitador aprobados — D01

- UTF-8 válido, con o sin un único BOM UTF-8 al principio del archivo.
  Retirar ese BOM para interpretar la cabecera, pero conservar los bytes
  originales para calcular la huella de repetición.
- Delimitador único: coma (`,`). No detectar automáticamente punto y coma o
  tabulador ni aceptar líneas especiales como `sep=,`.
- Aceptar finales de línea LF o CRLF, también mezclados; rechazar CR aislado.
  El último registro puede terminar con un salto de línea o sin él.
- Usar comillas dobles para campos que contienen comas o comillas; representar
  una comilla interior mediante dos comillas dobles consecutivas.
- No permitir comillas sueltas en un campo sin entrecomillar ni caracteres
  fuera de las comillas de cierre antes del delimitador o fin de registro.
- Rechazar saltos de línea dentro de campos, incluso entrecomillados, para que
  cada producto ocupe una sola línea física. Un CSV general sí puede permitirlos;
  esta es una restricción deliberada del contrato V1.
- No admitir comentarios ni líneas vacías. Un único terminador al final no
  crea un registro vacío; un segundo terminador sí.

Se toma como referencia la sintaxis de comas y comillas de
[RFC 4180, sección 2](https://www.rfc-editor.org/rfc/rfc4180.html#section-2).
UTF-8, LF y la prohibición de campos multilínea son decisiones de este proyecto;
no se afirma compatibilidad con todas las variantes de CSV.
Motivo: mantener un formato predecible y errores fáciles de localizar.

## 2. Cabecera y columnas obligatorias — D02

La primera fila debe producir exactamente estas cuatro columnas, en este orden:

```csv
sku,nombre,precio_eur,stock
```

Los nombres son sensibles a mayúsculas y no se recortan espacios en la cabecera.
Se comparan los valores después de interpretar el CSV: entrecomillar correctamente
un nombre de columna es válido. Rechazar columnas faltantes, adicionales,
duplicadas o desordenadas, y cualquier fila de datos con un número distinto de
cuatro campos. Esto evita interpretar silenciosamente un campo como otro.

Los cuatro valores son obligatorios. Un campo vacío o que quede vacío tras la
normalización es inválido. Un archivo vacío o con solo cabecera es inválido.
Una cabecera repetida entre los datos no se omite: se valida como datos y falla.

## 3. Tipos y restricciones aprobadas — D03 y D04

Los límites se aplican al valor normalizado. `null` no es un valor especial
del CSV: no sustituye un campo obligatorio.

| Campo | Tipo lógico | Regla aprobada |
| --- | --- | --- |
| `sku` | Texto identificador | De 1 a 64 caracteres ASCII. Tras normalizar: `^[A-Z0-9][A-Z0-9_-]{0,63}$`. Empieza por letra o dígito; admite guion y guion bajo después. |
| `nombre` | Texto Unicode | De 1 a 120 puntos de código Unicode después de NFC. Conservar acentos, mayúsculas, comas, comillas y espacios interiores. Rechazar controles C0/C1 y separadores de línea U+2028/U+2029. |
| `precio_eur` | Importe decimal en euros | De 0 a 999999.99, ambos inclusive. Parte entera obligatoria y 0, 1 o 2 decimales separados por punto. Sin signo, exponentes, separadores de miles ni ceros iniciales salvo el propio 0. |
| `stock` | Entero | De 0 a 1000000, ambos inclusive. Solo dígitos ASCII, sin signo, decimales, exponentes ni ceros iniciales salvo el propio 0. |

Gramática léxica antes de comprobar el rango:

- Precio: `^(0|[1-9][0-9]*)(\.[0-9]{1,2})?$`.
- Stock: `^(0|[1-9][0-9]*)$`.

Ejemplos de precio válidos: `0`, `0.00`, `12`, `12.5`, `12.50`.
Inválidos: `-1`, `+1`, `.50`, `12.`, `01.00`, `1e2`, `12.345`,
`NaN`, `Infinity` y `"12,50"`. Una coma decimal sin comillas además altera
el número de columnas.

No redondear ni truncar precios. Usar conversión decimal exacta a céntimos
enteros para comparar y persistir, por ejemplo `12.5` → `1250`.
No usar `parseFloat` ni multiplicar valores binarios de coma flotante como regla
de validación. La futura representación en PostgreSQL se decidirá al diseñar
persistencia; aquí no se define una tabla.

El precio cero y los rangos de precio y stock documentados están aprobados.
El tamaño del nombre se expresa en puntos de código, no en bytes ni unidades
UTF-16. Un SKU numérico se conserva como texto, incluidos sus ceros iniciales.

## 4. Normalización aprobada — D03

Orden: interpretar CSV → recortar extremos de cada valor → normalizar texto →
validar gramática y rangos → buscar duplicados.

- En datos, recortar únicamente espacio ASCII U+0020 y tabulador U+0009 en los
  extremos. No sustituir espacios interiores ni espacios Unicode diferentes.
- SKU: exigir que el texto de entrada sea ASCII antes de convertir `a-z` a
  `A-Z`. No quitar acentos ni convertir símbolos Unicode en letras ASCII.
  Así ` ab-01 ` se convierte en `AB-01`, pero `á-01` o `ß` se rechazan.
- Nombre: aplicar NFC y conservar los espacios interiores. No cambiar su caja
  ni deduplicar por nombre. Un tabulador interior es un control y se rechaza.
- Precio: normalizar a céntimos después de validar; `12`, `12.0` y `12.00`
  representan el mismo importe.
- Stock: convertir a entero únicamente después de validar el texto completo.
- No reparar silenciosamente columnas, valores negativos o decimales inválidos.

## 5. Duplicados dentro del archivo — D05

La clave aprobada es el SKU normalizado. Dos filas con `ab-01` y ` AB-01 `
son duplicadas, aunque nombre, precio y stock sean iguales.

Rechazar la importación completa. Para cada aparición posterior a la primera,
emitir `DUPLICATE_SKU` con su fila, campo `sku` y `fila_original`.
No elegir «la última fila gana», sumar stock ni descartar registros.
Los nombres repetidos con SKU diferentes son válidos.

## 6. Conflictos con productos registrados — D05

V1 solo inserta productos nuevos. Si un archivo diferente de los ya importados
contiene un SKU normalizado registrado, responder `409 Conflict` con
`SKU_ALREADY_EXISTS`, incluso si los demás datos coinciden.
No actualizar, mezclar ni ignorar filas. Una repetición exacta de un archivo
completado recupera su resultado con 200, como se define en la sección 10.

Antes de buscar esos conflictos, comprobar si el archivo completo ya fue
importado con éxito (sección 10), para distinguir repetición de conflicto.
Si después se detecta un conflicto de SKU, volver a resolver la huella completada
antes de clasificarlo: otra solicitud idéntica puede haber confirmado entre las
consultas. También tras revertir un conflicto de unicidad, comprobar el resultado
confirmado del mismo archivo. Si existe, tiene prioridad recuperar ese resultado
con `200 OK`, sin nuevas inserciones; en otro caso, responder
`409 Conflict` con `SKU_ALREADY_EXISTS`. El diseño futuro debe garantizar
esta clasificación coherente junto con la unicidad, sin depender solo de la
consulta inicial. Un archivo diferente con 99 productos nuevos y 1 existente
no inserta ninguno de los 100.

Motivo: evitar modificaciones de catálogo implícitas. Actualizar productos o
hacer upsert exigiría otro contrato y aprobación expresa.

## 7. Límites aprobados para V1 — D06

| Elemento | Límite inclusivo aprobado |
| --- | --- |
| Archivo CSV | 5 MiB = 5242880 bytes originales, incluido BOM y finales de línea |
| Filas de productos | De 1 a 10000; la cabecera no cuenta |
| Archivos por solicitud | Exactamente 1 |
| Cuerpo HTTP completo | 5308416 bytes: 5 MiB más 64 KiB para multipart |
| Detalles de error devueltos | Hasta 100 |

No admitir archivos comprimidos. La longitud declarada por el cliente no sustituye
el recuento de bytes recibidos. Abortar al superar los límites de bytes o filas,
con 413; no guardar productos ni aceptar únicamente las primeras filas.
El límite de 100 detalles solo limita la respuesta: no es un umbral de rechazo
ni exige detener el análisis. Más de un archivo es una solicitud inválida (400).

Estos límites están aceptados para V1 y permiten acotar la primera versión
síncrona. No son resultados de una prueba de carga: se evaluarán en el futuro
con volúmenes reales y pruebas de carga. Esa evaluación no deja pendiente su
aprobación actual ni permite cambiarlos sin actualizar el contrato.

## 8. Formato de errores — D07

Las respuestas de error usan la estructura JSON aprobada, ilustrada con este ejemplo:

```json
{
  "error": {
    "codigo": "VALIDATION_FAILED",
    "mensaje": "El archivo contiene datos inválidos.",
    "detalles": [
      {
        "fila": 3,
        "campo": "precio_eur",
        "codigo": "INVALID_PRICE",
        "motivo": "Usa un importe no negativo con punto y hasta dos decimales."
      },
      {
        "fila": 4,
        "campo": "sku",
        "codigo": "DUPLICATE_SKU",
        "motivo": "El SKU coincide con una fila anterior.",
        "fila_original": 2
      }
    ],
    "errores_truncados": false
  }
}
```

- `fila`: línea física inicial del registro, contando desde 1. Cabecera = 1;
  primer producto = 2. No renumerar al encontrar filas vacías o erróneas.
- `campo`: uno de los cuatro nombres de columna o `null` para un error de
  registro, cabecera o archivo sin campo identificable.
- `fila: null` cuando el error afecta a toda la solicitud o no se puede ubicar
  con certeza; nunca inventar una posición. En un campo multilínea prohibido
  o una comilla sin cerrar, señalar la línea donde empezó el registro si se conoce.
- `codigo`: identificador estable para clientes y pruebas. `motivo`:
  explicación legible en castellano. No incluir stack traces ni el archivo completo.
- `fila_original` solo aparece en duplicados internos.
- Ordenar detalles por fila y por el orden de columnas de la cabecera.
  Para un campo vacío, informar `REQUIRED_FIELD` sin añadir otro error de formato
  para ese mismo campo.
- Retener como máximo los primeros 100 detalles de la fase fallida.
  `errores_truncados: true` significa que se han encontrado más y se omitieron;
  no implica que se hayan validado todos los fallos posibles de otras fases.

`VALIDATION_FAILED` es el código general de errores de datos; cada detalle
concreta su causa, como `INVALID_PRICE` o `DUPLICATE_SKU`. En los demás errores,
el código general identifica la causa principal de la fase fallida.

Códigos de error aprobados para V1: `VALIDATION_FAILED`, `INVALID_REQUEST`, `UNSUPPORTED_MEDIA_TYPE`,
`FILE_TOO_LARGE`, `TOO_MANY_ROWS`, `INVALID_ENCODING`, `INVALID_CSV`,
`INVALID_HEADER`, `COLUMN_COUNT_MISMATCH`, `EMPTY_IMPORT`, `REQUIRED_FIELD`,
`INVALID_SKU`, `INVALID_NAME`, `INVALID_PRICE`, `INVALID_STOCK`,
`DUPLICATE_SKU`, `SKU_ALREADY_EXISTS`,
`PERSISTENCE_ERROR` y `SERVICE_UNAVAILABLE`.
La repetición exacta es un resultado de éxito HTTP 200 y no tiene código de error.

## 9. Rechazo completo y orden de validación — D08

Secuencia lógica aprobada; su organización interna aún no está implementada:

1. Validar el tipo y la estructura de la solicitud y sus límites de bytes.
2. Decodificar UTF-8 y analizar el CSV: cabecera, comillas, líneas y columnas.
   Controlar el número de registros durante la lectura.
3. Normalizar y validar todos los campos y duplicados internos, sin persistir.
4. Consultar la huella de importaciones completadas. Si existe un resultado
   confirmado, devolverlo con 200 y terminar sin crear importación ni productos.
   En otro caso, comprobar conflictos de SKU, manteniendo la prioridad de
   repetición exacta también ante concurrencia (sección 6).
5. Solo para una importación nueva, registrar en una única transacción la
   importación completada y todos sus productos, garantizando unicidad de
   huella y SKU normalizado.
6. Responder 201 únicamente después de confirmar esa nueva transacción.
   Un resultado 200 siempre corresponde a una importación ya confirmada.

La primera fase que falla determina la respuesta. Un límite detectado durante
la lectura permite interrumpirla inmediatamente con 413. Un error de sintaxis
impide continuar el análisis de forma fiable y produce 400; no se prometen
errores de campos posteriores. Si la estructura completa es válida pero hay
errores de datos, responder 422 sin consultar conflictos de catálogo.
Así, un precio inválido y un SKU ya existente producen primero 422.
En una fase se recogen detalles hasta el límite indicado; si se puede continuar
con seguridad, se comprueba si existen más para indicar el truncamiento.

Ante fallo de persistencia, hacer rollback de todos los productos y del registro
de importación completada. No guardar por lotes con commits parciales.
La transacción por sí sola no evita dos solicitudes simultáneas: la persistencia
futura debe garantizar unicidad atómica de huella y SKU; una comprobación previa
en memoria no basta. Si otra solicitud gana esa carrera, revertir cualquier
escritura propia no confirmada y resolver el resultado definitivo: para el mismo
archivo ya confirmado, devolver 200 con el resultado existente; para otro archivo
con SKU coincidentes, devolver 409. Si hay un fallo de persistencia en lugar de
un resultado recuperable, aplicar 500/503 según la causa.

V1 no almacena de forma persistente intentos fallidos. Una auditoría persistente
de fallos sería una ampliación futura de alcance, no una decisión pendiente de V1.

## 10. Prevención de importaciones repetidas — D09 y D10

Usar SHA-256 de los bytes originales del CSV como identidad del archivo.
Excluir el nombre de archivo y el envoltorio multipart; incluir BOM y finales
de línea. La unicidad se aplica a importaciones completadas de este catálogo.

- Mismos bytes y distinto nombre: misma importación. Devolver `200 OK`
  recuperando el resultado confirmado, incluido su identificador original.
  No insertar productos ni crear otra importación.
- Comprobar la repetición exacta antes de conflictos individuales de SKU y
  mantener esa prioridad al resolver carreras de concurrencia (sección 6).
- No reservar definitivamente la huella de un archivo inválido o de una
  transacción revertida: puede corregirse o reintentarse.
- Varias solicitudes idénticas concurrentes: como máximo una crea la importación
  y sus productos. La que confirma la creación devuelve 201; las demás que
  encuentran esa importación ya confirmada devuelven 200 con el mismo resultado.
  Si una transacción falla y revierte, no bloquea permanentemente los reintentos.
- Una solicitud todavía en curso no es un resultado confirmado y no permite
  responder 200 anticipadamente. La coordinación interna para esperar o resolver
  la concurrencia se concretará al implementar, respetando las respuestas aprobadas.
- Si se pierde la respuesta tras confirmar la transacción, reenviar el archivo
  devuelve 200 con el resultado existente y no duplica productos.
- Guardar la versión aprobada del contrato junto al resultado en el diseño
  futuro. No cambiar la regla de huella entre versiones sin revisar su compatibilidad.

**Límite deliberado:** cambiar BOM, LF/CRLF, espacios u orden de registros produce
otra huella. Estos archivos no son repeticiones exactas aunque los datos
normalizados sean equivalentes. Si contienen SKU ya guardados, responder 409 sin
guardar productos. Si no existen conflictos y todos sus datos son válidos,
pueden crear una importación nueva con 201.

La huella de bytes queda aprobada para V1. Una huella canónica de los datos
normalizados no forma parte de este contrato ni queda pendiente de elección.
La estrategia concreta de concurrencia en PostgreSQL sí queda para una sesión
futura, sin cambiar las garantías de unicidad, rollback y recuperación del resultado.

## 11. Solicitud y respuestas HTTP aprobadas — D10

Ruta aprobada: `POST /importaciones`, con `multipart/form-data` y exactamente
un archivo en el campo `archivo`; rechazar campos adicionales.
Ruta implementada durante la sesión 07; `GET /health` conserva su comportamiento.

Admitir el tipo de la parte `text/csv`, `application/octet-stream`
o ausencia de tipo; si declara charset, exigir UTF-8. Otros tipos declarados
producen 415. La extensión y el nombre del archivo son informativos: no sustituyen
la validación del contenido. El cuerpo raíz debe ser multipart válido.

| HTTP | Situación aprobada |
| --- | --- |
| 201 Created | Importación nueva y productos confirmados; devolver su identificador y cantidad importada |
| 200 OK | Repetición exacta de bytes ya importados con éxito; recuperar el resultado existente, sin crear importación ni productos |
| 400 Bad Request | Solicitud incompleta/multipart inválido, UTF-8 inválido, cabecera o sintaxis CSV incorrectas, número de columnas incorrecto |
| 413 Content Too Large | Archivo/cuerpo excede bytes permitidos o más de 10000 filas |
| 415 Unsupported Media Type | Tipo de solicitud, tipo de archivo declarado o charset no admitidos |
| 422 Unprocessable Content | CSV estructuralmente válido con datos inválidos, duplicados internos o sin productos |
| 409 Conflict | Otro archivo diferente contiene SKU existentes, incluidos conflictos concurrentes; ninguna inserción parcial |
| 500 Internal Server Error | Fallo inesperado de persistencia con rollback |
| 503 Service Unavailable | Dependencia de persistencia temporalmente no disponible; sin confirmación parcial |

Estas asignaciones siguen la semántica de
[RFC 9110, sección 15](https://www.rfc-editor.org/rfc/rfc9110.html#section-15).
La clasificación del exceso de filas como 413 y la recuperación de una repetición
exacta como 200 están aprobadas. La repetición exacta no es un error ni devuelve 409.

### Respuestas de éxito coherentes

Tanto 201 como 200 usan los mismos campos: `importacion_id`, `estado` y
`productos_importados`. En un reenvío exacto se recuperan los valores originales:
`productos_importados` cuenta los productos de la importación existente, no
inserciones nuevas en la solicitud de reintento. No se genera otro identificador,
no se devuelve un bloque `error` y no se cambia la cantidad a cero.

Ejemplo de importación nueva confirmada — HTTP 201 Created:

```json
{
  "importacion_id": "ejemplo-importacion-001",
  "estado": "completada",
  "productos_importados": 2
}
```

Ejemplo de reenvío de exactamente el mismo archivo — HTTP 200 OK:

```json
{
  "importacion_id": "ejemplo-importacion-001",
  "estado": "completada",
  "productos_importados": 2
}
```

El identificador de estos ejemplos es ilustrativo; la implementación usa UUID,
como se documenta en PERSISTENCIA. Los dos productos y la importación son los
ya confirmados: el segundo ejemplo no representa nuevas escrituras.

Las rutas de consulta de productos e importaciones y el formato de sus respuestas
se diseñarán posteriormente; no se incorporan rutas de consulta durante la sesión 07.

## 12. Ejemplos y casos para futuras pruebas

Los siguientes casos expresan el contrato completo aprobado. Las pruebas de la
sesión 04 cubren el contenido CSV y sus errores en memoria; la sesión 05
añade pruebas de persistencia, restricciones y rollback. La sesión 06 verifica
recuperación y coordinación concurrente. La sesión 07 verifica recepción multipart,
límites y exposición HTTP, también con PostgreSQL real.

### Archivo válido

```csv
sku,nombre,precio_eur,stock
AB-001,Café molido,12.50,10
AB-002,"Taza, modelo ""Norte""",0,0
```

Resultado esperado: 201 y dos productos, suponiendo catálogo sin esos SKU.
Precios normalizados: 1250 y 0 céntimos.

### Archivo con errores de datos y duplicado

```csv
sku,nombre,precio_eur,stock
AB-001,Café molido,12.50,10
AB-002,Taza,12.345,0
ab-001,Café molido,12.50,10
```

Resultado esperado: 422 con `INVALID_PRICE` en fila 3, campo `precio_eur`,
y `DUPLICATE_SKU` en fila 4, campo `sku`, `fila_original: 2`.
Corresponde al ejemplo de error de la sección 8. No se guarda ningún producto.

### Matriz de casos límite

| Caso | Resultado esperado |
| --- | --- |
| UTF-8 con/sin BOM y LF/CRLF; último salto opcional | Aceptar si los datos son válidos |
| Bytes UTF-8 inválidos, CR aislado o comillas sin cerrar | 400; sin productos |
| Delimitador `;`, cabecera con mayúsculas, espacio o columnas reordenadas | 400, `INVALID_HEADER` |
| Columna extra, columna ausente o coma sobrante | 400, `COLUMN_COUNT_MISMATCH` |
| Línea vacía entre productos o segundo salto final | 400, estructura inválida |
| Nombre con salto de línea entre comillas | 400, `INVALID_CSV`, fila inicial del registro |
| Archivo de 0 bytes o solo BOM, sin cabecera | 400, `INVALID_HEADER` |
| Solo cabecera, con o sin terminador | 422, `EMPTY_IMPORT` |
| Campo vacío, `""` o solo espacios/tabuladores recortables | 422, `REQUIRED_FIELD` |
| SKU `ab-01` frente a ` AB-01 ` | 422, `DUPLICATE_SKU`, referencia a primera fila |
| Dos filas idénticas | 422, `DUPLICATE_SKU` |
| Nombre repetido con SKU distintos | Aceptar si no existen conflictos |
| SKU de 64/65 caracteres | Aceptar/rechazar respectivamente |
| SKU `001`; SKU `á-01` o `ß` | Conservar `001`; rechazar los no ASCII |
| Nombre NFC de 120/121 puntos de código | Aceptar/rechazar respectivamente |
| Nombre con acento compuesto/descompuesto equivalente | Mismo nombre tras NFC; el SKU determina duplicidad |
| Precio 0, 999999.99 / 1000000 | Aceptar los dos primeros; rechazar el último |
| Precio `12.5` / `"12,50"` / `12.345` / `1e2` | 1250 céntimos / rechazar / rechazar / rechazar |
| Stock 0, 1000000 / 1000001, -1, 1.0, 01 | Aceptar los dos primeros; rechazar el resto |
| 10000/10001 registros bien formados | Aceptar hasta el límite / 413 |
| 5242880/5242881 bytes CSV | Continuar validación / 413 |
| Cuerpo multipart de 5308416/5308417 bytes | Continuar validación / 413 |
| 101 errores de datos en un CSV estructuralmente válido | 422; 100 detalles y `errores_truncados: true` |
| Precio inválido y SKU ya existente | 422; sin consultar conflictos ni guardar |
| Archivo nuevo con un SKU ya registrado entre filas nuevas | 409; ninguna inserción |
| Mismo archivo válido reenviado, incluso renombrado | 200 con el mismo resultado, identificador y cantidad originales; ninguna nueva importación ni producto |
| Archivo equivalente con distinto BOM, finales de línea, espacios u orden | Otra huella; 409 si contiene SKU existentes; no es repetición exacta |
| Dos o más solicitudes idénticas simultáneas | Como máximo una creación; 201 para quien la confirma y 200 con el resultado existente para las demás que lo recuperen |
| Otra petición idéntica confirma entre la consulta de huella y la detección de SKU existente | Resolver la huella confirmada y devolver 200 con el resultado existente, no 409 |
| Otra petición idéntica confirma antes de resolver un error de unicidad | Revertir las escrituras propias y recuperar con 200 el resultado confirmado |
| Dos archivos distintos comparten un SKU, enviados simultáneamente | Como máximo uno completo; el perdedor revierte todos sus productos y recibe 409 |
| Error al persistir después de insertar algunas filas | 500/503 según causa; rollback completo |
| Reintento tras rollback / tras pérdida de respuesta con commit confirmado | Puede crear con 201 si tiene éxito / recupera el resultado con 200 sin duplicación |

## 13. Registro de decisiones aprobadas

Alex Cobián aprobó D01–D10 para V1 durante la sesión 03, con el ajuste obligatorio
de D10 a recuperación de repeticiones exactas mediante HTTP 200.

| ID | Decisión contractual | Estado |
| --- | --- | --- |
| D01 | UTF-8, coma, comillas dobles; LF/CRLF; sin campos multilínea, según sección 1 | Aprobada |
| D02 | `sku,nombre,precio_eur,stock`, obligatorias y en orden fijo | Aprobada |
| D03 | Recorte de extremos; SKU ASCII de 1–64 sin distinguir mayúsculas; nombre NFC de 1–120, según secciones 3–4 | Aprobada |
| D04 | Gramática estricta; precio cero permitido, 0–999999.99 EUR y stock 0–1000000; conversión exacta a céntimos | Aprobada |
| D05 | Rechazo completo de duplicados internos y SKU existentes en otro archivo; sin upsert | Aprobada |
| D06 | 5 MiB, 10000 productos, 1 archivo y 100 detalles; cuerpo HTTP máximo de 5308416 bytes | Aprobada para V1; evaluación futura con pruebas de carga |
| D07 | Fila física inicial, campo, códigos estables, mensajes en castellano y truncamiento | Aprobada |
| D08 | Atomicidad completa, rollback y unicidad segura ante concurrencia; sin persistencia de intentos fallidos en V1 | Aprobada |
| D09 | SHA-256 de bytes originales para identificar archivos exactamente iguales ya confirmados | Aprobada |
| D10 | POST /importaciones, multipart/form-data, campo archivo; nueva importación 201, repetición exacta 200 con resultado existente, otro archivo con conflictos SKU 409; resto del mapa HTTP de la sección 11 | Aprobada con modificación respecto a la sesión 02 |

## 14. Aspectos internos y trabajo posterior

Las reglas anteriores siguen aprobadas. Avance de implementación:

- Sesión 04 publicada en `b1cb2e2`: parsing y validación CSV en memoria.
- Sesión 05 publicada en `59dbc42`: PostgreSQL, UUID, migración, restricciones,
  persistencia transaccional y consultas internas.
- Sesión 06 publicada en `f4b63e3`: servicio que coordina validación, huella,
  conflictos y creación, con recuperación tras unicidad y pruebas independientes.
- Sesión 07: recepción multipart y traducción a HTTP, límites y gestión de streams;
  pruebas HTTP de atomicidad, idempotencia y concurrencia.

La estrategia, los resultados tipados, los límites de espera y la incertidumbre
de COMMIT se documentan en [PERSISTENCIA](PERSISTENCIA.md).
Si una recuperación después de un COMMIT incierto no puede demostrar el
resultado, se devuelve error técnico controlado; un reintento posterior puede
resolverlo por la misma huella. No se afirma éxito sin evidencia.

Quedan pendientes:

- Rutas y contratos de consulta HTTP de productos e importaciones.
- Evaluación de límites con pruebas de carga y pruebas de fallos físicos de red.

Las reglas, la tabla D01–D10 y los ejemplos de las secciones anteriores se
conservan. Los commits y push siguen siendo manuales y exclusivos del usuario.
