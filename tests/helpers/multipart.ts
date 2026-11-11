export const boundary = 'csv-test-boundary';
export const rootType = 'multipart/form-data; boundary=' + boundary;
export const goodCsv = Buffer.from('sku,nombre,precio_eur,stock\nA,Café,0.29,2');
export function multipart(
  content: Buffer = goodCsv,
  options: { name?: string; filename?: string | null; type?: string | null; extraHeaders?: string; close?: boolean } = {},
): Buffer {
  const filename = options.filename === undefined ? 'productos.csv' : options.filename;
  const disposition = 'Content-Disposition: form-data; name="' + (options.name ?? 'archivo') + '"' +
    (filename === null ? '' : '; filename="' + filename + '"');
  const type = options.type === undefined ? 'text/csv' : options.type;
  const headers = disposition + (type === null ? '' : '\r\nContent-Type: ' + type) + (options.extraHeaders ?? '');
  return Buffer.concat([
    Buffer.from('--' + boundary + '\r\n' + headers + '\r\n\r\n'), content,
    Buffer.from(options.close === false ? '' : '\r\n--' + boundary + '--\r\n'),
  ]);
}
