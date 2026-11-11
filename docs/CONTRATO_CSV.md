# Propuesta de contrato de importación CSV

**Estado: borrador pendiente de revisión y aprobación.**
Sesión 02 de CHAMBA DIARIA. Última revisión: 11 de noviembre de 2026.
Identificador documental: `csv-v1-propuesta`; no representa una versión de API publicada.

## 0. Qué está acordado y qué se propone

El objetivo es importar productos con el formato inicial
`sku,nombre,precio_eur,stock`, informar de errores por fila y campo y evitar
duplicados. La garantía de partida es transaccional: una importación inválida
no puede dejar productos guardados parcialmente.

**Todas las reglas concretas, límites, rutas y respuestas siguientes son
propuestas**, incluso cuando se expresan como «aceptar», «rechazar» o «debe».
Necesitan aprobación antes de implementarse. La sección 13 recoge las decisiones.
Actualmente solo existen `GET /health` y su prueba. No hay importador, tablas,
transacciones ni endpoints de importación implementados.

## 1. Codificación y delimitador propuestos — D01

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
  esta es una restricción deliberada de la propuesta.
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

## 3. Tipos y restricciones propuestas — D03 y D04

Los límites se aplican al valor normalizado. `null` no es un valor especial
del CSV: no sustituye un campo obligatorio.

| Campo | Tipo lógico | Regla propuesta |
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

No redondear ni truncar precios. Proponer conversión decimal exacta a céntimos
enteros para comparar y persistir, por ejemplo `12.5` → `1250`.
No usar `parseFloat` ni multiplicar valores binarios de coma flotante como regla
de validación. La futura representación en PostgreSQL se decidirá al diseñar
persistencia; aquí no se define una tabla.

Permitir precio cero y acotar precio/stock son decisiones de negocio pendientes.
El tamaño del nombre se expresa en puntos de código, no en bytes ni unidades
UTF-16. Un SKU numérico se conserva como texto, incluidos sus ceros iniciales.

## 4. Normalización propuesta — D03

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

La clave propuesta es el SKU normalizado. Dos filas con `ab-01` y ` AB-01 `
son duplicadas, aunque nombre, precio y stock sean iguales.

Rechazar la importación completa. Para cada aparición posterior a la primera,
emitir `DUPLICATE_SKU` con su fila, campo `sku` y `fila_original`.
No elegir «la última fila gana», sumar stock ni descartar registros.
Los nombres repetidos con SKU diferentes son válidos.

## 6. Conflictos con productos registrados — D05

Proponer una primera versión que solo inserta productos nuevos. Cualquier SKU
normalizado ya registrado produce `409 Conflict` con `SKU_ALREADY_EXISTS`,
incluso si los demás datos coinciden. No actualizar, mezclar ni ignorar filas.

Antes de buscar esos conflictos, comprobar si el archivo completo ya fue
importado con éxito (sección 10), para distinguir repetición de conflicto.
Si después se detecta un conflicto de SKU, volver a resolver la huella completada
antes de clasificarlo: otra solicitud idéntica puede haber confirmado entre las
consultas. También tras revertir un conflicto de unicidad, comprobar el resultado
confirmado del mismo archivo. Si existe, tiene prioridad
`IMPORT_ALREADY_PROCESSED` con su identificador; en otro caso,
`SKU_ALREADY_EXISTS`. El diseño futuro debe garantizar esta clasificación
coherente junto con la unicidad, sin depender solo de la consulta inicial.
Con 99 productos nuevos y 1 existente, no insertar ninguno de los 100.

Motivo: evitar modificaciones de catálogo implícitas. Actualizar productos o
hacer upsert exigiría otro contrato y aprobación expresa.

## 7. Límites propuestos — D06

| Elemento | Límite inclusivo propuesto |
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

Los límites propuestos permiten validar archivos acotados con una primera versión
síncrona. No son resultados de una prueba de carga: deben confirmarse con los
volúmenes reales esperados.

## 8. Formato de errores — D07

Todas las respuestas de error propuestas usan JSON con este esquema de ejemplo:

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

Códigos de partida: `VALIDATION_FAILED`, `INVALID_REQUEST`, `UNSUPPORTED_MEDIA_TYPE`,
`FILE_TOO_LARGE`, `TOO_MANY_ROWS`, `INVALID_ENCODING`, `INVALID_CSV`,
`INVALID_HEADER`, `COLUMN_COUNT_MISMATCH`, `EMPTY_IMPORT`, `REQUIRED_FIELD`,
`INVALID_SKU`, `INVALID_NAME`, `INVALID_PRICE`, `INVALID_STOCK`,
`DUPLICATE_SKU`, `SKU_ALREADY_EXISTS`, `IMPORT_ALREADY_PROCESSED`,
`PERSISTENCE_ERROR` y `SERVICE_UNAVAILABLE`.
La estructura y los nombres todavía requieren aprobación.

## 9. Rechazo completo y orden de validación — D08

Propuesta de fases, sin implementar todavía:

1. Validar el tipo y la estructura de la solicitud y sus límites de bytes.
2. Decodificar UTF-8 y analizar el CSV: cabecera, comillas, líneas y columnas.
   Controlar el número de registros durante la lectura.
3. Normalizar y validar todos los campos y duplicados internos, sin persistir.
4. Consultar la huella de importaciones completadas; después, conflictos de SKU.
5. En una única transacción, registrar la importación completada y todos sus
   productos, garantizando unicidad de huella y SKU normalizado.
6. Responder con éxito únicamente después de confirmar la transacción.

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
en memoria no basta. Si otra solicitud gana esa carrera, la perdedora revierte
todo y responde con el conflicto correspondiente.

Proponer no guardar intentos fallidos como importaciones en esta primera versión.
Decidirlo antes de implementar; si se necesita auditoría de fallos, se diseñará
separadamente sin marcar esos intentos como importaciones completadas.

## 10. Prevención de importaciones repetidas — D09

Proponer SHA-256 de los bytes originales del CSV como identidad del archivo.
Excluir el nombre de archivo y el envoltorio multipart; incluir BOM y finales
de línea. La unicidad se aplica a importaciones completadas de este catálogo.

- Mismos bytes y distinto nombre: misma importación; responder 409 con
  `IMPORT_ALREADY_PROCESSED` y el identificador de la importación existente.
- Comprobar esa repetición antes de conflictos individuales de SKU.
- No reservar definitivamente la huella de un archivo inválido o de una
  transacción revertida: puede corregirse o reintentarse.
- Dos peticiones idénticas concurrentes: como máximo una crea productos.
  Si ambas llegan a completarse sin otros fallos, una devuelve 201 y la otra 409
  con el mismo identificador existente. Si la primera revierte, no bloquea
  permanentemente un reintento posterior.
- Si se pierde la respuesta tras confirmar la transacción, reenviar el archivo
  no duplica productos: el 409 permite recuperar el identificador existente.
- Guardar la versión aprobada del contrato junto al resultado en el diseño
  futuro. No cambiar la regla de huella entre versiones sin revisar su compatibilidad.

**Límite deliberado:** cambiar LF por CRLF, añadir BOM, reordenar filas o cambiar
espacios produce otra huella. Si el contenido se normaliza a SKU ya guardados,
se rechaza por conflicto de SKU, sin duplicar productos. No se promete reconocer
estos archivos como la misma importación lógica.

Alternativa pendiente: calcular una huella canónica de los datos normalizados.
Eso exige fijar serialización, orden y versión del algoritmo. La huella de bytes
se propone por su sencillez; el usuario debe decidir qué considera «repetida».
La estrategia concreta de concurrencia en PostgreSQL queda para una sesión futura.

## 11. Solicitud y respuestas HTTP previstas — D10

Ruta propuesta: `POST /importaciones`, con `multipart/form-data` y exactamente
un archivo en el campo `archivo`; rechazar campos adicionales.
No existe todavía esta ruta ni se modifica `GET /health`.

Proponer admitir el tipo de la parte `text/csv`, `application/octet-stream`
o ausencia de tipo; si declara charset, exigir UTF-8. Otros tipos declarados
producen 415. La extensión y el nombre del archivo son informativos: no sustituyen
la validación del contenido. El cuerpo raíz debe ser multipart válido.

| HTTP | Situación propuesta |
| --- | --- |
| 201 Created | Productos e importación confirmados; devolver identificador y cantidad importada |
| 400 Bad Request | Solicitud incompleta/multipart inválido, UTF-8 inválido, cabecera o sintaxis CSV incorrectas, número de columnas incorrecto |
| 413 Content Too Large | Archivo/cuerpo excede bytes permitidos o más de 10000 filas |
| 415 Unsupported Media Type | Tipo de solicitud, tipo de archivo declarado o charset no admitidos |
| 422 Unprocessable Content | CSV estructuralmente válido con datos inválidos, duplicados internos o sin productos |
| 409 Conflict | Archivo ya importado o SKU que ya existe, incluidos conflictos concurrentes |
| 500 Internal Server Error | Fallo inesperado de persistencia con rollback |
| 503 Service Unavailable | Dependencia de persistencia temporalmente no disponible; sin confirmación parcial |

Estas asignaciones se proponen siguiendo la semántica de
[RFC 9110, sección 15](https://www.rfc-editor.org/rfc/rfc9110.html#section-15).
La clasificación del exceso de filas como 413 y la repetición como 409 son
decisiones del contrato. Una alternativa para reintentos idénticos sería 200
con el resultado anterior; todavía no se ha aprobado ninguna de ellas.

Ejemplo ilustrativo de éxito, sin fijar aún el formato de identificadores:

```json
{
  "importacion_id": "ejemplo-importacion-001",
  "estado": "completada",
  "productos_importados": 2
}
```

Ejemplo de repetición:

```json
{
  "error": {
    "codigo": "IMPORT_ALREADY_PROCESSED",
    "mensaje": "Este archivo ya se importó correctamente.",
    "detalles": [
      {
        "fila": null,
        "campo": null,
        "codigo": "IMPORT_ALREADY_PROCESSED",
        "motivo": "Los bytes del archivo coinciden con una importación completada."
      }
    ],
    "errores_truncados": false
  },
  "importacion_id": "ejemplo-importacion-001"
}
```

Las rutas de consulta de productos e importaciones y el formato definitivo de
sus identificadores y respuestas se diseñarán posteriormente.

## 12. Ejemplos y casos para futuras pruebas

Los siguientes casos son especificaciones propuestas, no pruebas implementadas.

### Archivo válido

```csv
sku,nombre,precio_eur,stock
AB-001,Café molido,12.50,10
AB-002,"Taza, modelo ""Norte""",0,0
```

Resultado propuesto: 201 y dos productos, suponiendo catálogo sin esos SKU.
Precios normalizados: 1250 y 0 céntimos.

### Archivo con errores de datos y duplicado

```csv
sku,nombre,precio_eur,stock
AB-001,Café molido,12.50,10
AB-002,Taza,12.345,0
ab-001,Café molido,12.50,10
```

Resultado propuesto: 422 con `INVALID_PRICE` en fila 3, campo `precio_eur`,
y `DUPLICATE_SKU` en fila 4, campo `sku`, `fila_original: 2`.
Corresponde al ejemplo de error de la sección 8. No se guarda ningún producto.

### Matriz de casos límite

| Caso | Resultado esperado propuesto |
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
| Mismo archivo válido reenviado, incluso renombrado | 409 y referencia a la importación existente |
| Archivo equivalente con distinto BOM, finales de línea u orden | Otra huella; 409 por SKU existentes |
| Dos solicitudes idénticas simultáneas | Una única importación confirmada; 201 y 409 si ambas terminan sin otros fallos |
| Dos archivos distintos comparten un SKU, enviados simultáneamente | Como máximo uno completo; el perdedor revierte todos sus productos |
| Error al persistir después de insertar algunas filas | 500/503 según causa; rollback completo |
| Reintento tras rollback / tras pérdida de respuesta con commit confirmado | Puede completarse / 409 sin duplicación |

## 13. Decisiones que necesitan aprobación

Ninguna decisión de esta tabla se considera aprobada por incluirse aquí.

| ID | Propuesta a revisar | Cuestión pendiente |
| --- | --- | --- |
| D01 | UTF-8, coma, comillas dobles; LF/CRLF; sin campos multilínea | ¿Los archivos reales pueden exportarse con este formato o necesitan `;`/saltos en nombres? |
| D02 | Cuatro columnas obligatorias y orden fijo | ¿Se acepta rechazar columnas adicionales, vacías o reordenadas? |
| D03 | SKU ASCII de 1–64, sin distinguir mayúsculas; nombre NFC de 1–120; recorte de extremos | ¿Coincide con los identificadores y nombres reales? ¿Las mayúsculas identifican productos distintos? |
| D04 | Precio 0–999999.99 y stock 0–1000000; gramática estricta | ¿Se permite precio cero? ¿Son suficientes los rangos y se acepta rechazar ceros iniciales en números? |
| D05 | Rechazo completo de duplicados y SKU existentes, sin upsert | ¿La primera versión solo dará de alta productos nuevos? |
| D06 | 5 MiB, 10000 filas, 1 archivo, 100 detalles de error | ¿Cuáles son el volumen y el tamaño habituales de los archivos? |
| D07 | Fila física inicial, campo, códigos, motivos y truncamiento | ¿Sirve este formato para corregir archivos y para los futuros clientes? |
| D08 | Atomicidad con unicidad; sin registro persistente de intentos fallidos en V1 | La atomicidad es requisito; ¿hace falta auditar también los intentos fallidos? |
| D09 | SHA-256 de bytes originales y control de concurrencia | ¿Basta detectar archivos idénticos o debe reconocerse equivalencia de datos? |
| D10 | POST síncrono multipart y mapa de HTTP; repetición 409 | ¿Se aprueban ruta, campo `archivo`, tipos admitidos y respuesta 409 en vez de 200 para reintentos? |

Después de resolver estas cuestiones se actualizará el estado del contrato y
se prepararán los casos de prueba aprobados. La implementación, las dependencias
de parsing y el diseño PostgreSQL pertenecen a encargos posteriores.
