import type { IncomingMessage } from 'node:http';
import { Transform, type Writable } from 'node:stream';
import { parse, format } from 'content-type';
import multiparty from 'multiparty';
import { MAX_CSV_BYTES } from '../csv/types.js';

export const MAX_MULTIPART_BYTES = MAX_CSV_BYTES + 64 * 1024;
const RECEIVE_TIMEOUT_MS = 30_000;

export class UploadError extends Error {
  constructor(
    public readonly status: 400 | 413 | 415,
    public readonly codigo: 'INVALID_REQUEST' | 'FILE_TOO_LARGE' | 'UNSUPPORTED_MEDIA_TYPE',
    message: string,
  ) { super(message); }

  body() {
    return { error: {
      codigo: this.codigo, mensaje: this.message,
      detalles: [{ fila: null, campo: null, codigo: this.codigo, motivo: this.message }],
      errores_truncados: false,
    } };
  }
}
const invalid = () => new UploadError(400, 'INVALID_REQUEST', 'Envía exactamente un archivo en el campo archivo mediante multipart válido.');
const large = () => new UploadError(413, 'FILE_TOO_LARGE', 'El archivo o el cuerpo multipart supera el límite permitido.');
const media = () => new UploadError(415, 'UNSUPPORTED_MEDIA_TYPE', 'El tipo de contenido o charset declarado no está admitido.');

function contentType(value: string) {
  try {
    const result = parse(value);
    if (result.parameters.charset !== undefined && result.parameters.charset.toLowerCase() !== 'utf-8') throw media();
    return result;
  } catch (error) {
    if (error instanceof UploadError) throw error;
    throw media();
  }
}

/** Conserva bytes originales; no escribe en disco ni interpreta datos CSV. */
export function receiveCsv(request: IncomingMessage): Promise<Buffer> {
  const root = contentType(request.headers['content-type'] ?? '');
  if (root.type !== 'multipart/form-data' ||
      (request.headers['content-encoding'] && request.headers['content-encoding'].toLowerCase() !== 'identity')) throw media();
  const boundary = root.parameters.boundary;
  // Gramática MIME del boundary; evita diferencias entre analizadores de cabeceras.
  if (!boundary || boundary.length > 70 || !/^[0-9A-Za-z'()+_,./:=? -]*[0-9A-Za-z'()+_,./:=?-]$/.test(boundary)) throw invalid();
  const declared = request.headers['content-length'];
  if (declared && Number(declared) > MAX_MULTIPART_BYTES) throw large();

  return new Promise((resolve, reject) => {
    let total = 0, fileBytes = 0, parts = 0;
    let settled = false;
    const chunks: Buffer[] = [];
    const active = new Set<multiparty.Part>();
    // Los tipos publicados omiten Writable y maxHeaderSize, presentes en multiparty 4.3.
    const options = { autoFiles: false, autoFields: false, maxFields: 2, maxHeaderSize: MAX_MULTIPART_BYTES };
    const form = new multiparty.Form(options) as multiparty.Form & Writable;
    const input = Object.assign(new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        total += chunk.length;
        if (total > MAX_MULTIPART_BYTES) callback(large());
        else callback(null, chunk);
      },
    }), { headers: { ...request.headers, 'content-type': format({ type: root.type, parameters: { boundary } }) } });
    const timer = setTimeout(() => fail(new UploadError(400, 'INVALID_REQUEST', 'La recepción del archivo no se completó a tiempo.')), RECEIVE_TIMEOUT_MS);
    timer.unref();

    function cleanup() {
      clearTimeout(timer);
      request.unpipe(input);
      request.removeListener('aborted', aborted);
      if (request.complete) request.removeListener('error', aborted);
    }
    function fail(error: UploadError) {
      if (settled) return;
      settled = true;
      cleanup();
      request.pause();
      input.unpipe(form);
      input.destroy();
      form.destroy();
      for (const part of active) part.destroy();
      chunks.length = 0;
      reject(error);
    }
    function aborted() { fail(invalid()); }
    input.on('error', error => fail(error instanceof UploadError ? error : invalid()));
    form.on('error', () => fail(invalid()));
    request.once('aborted', aborted);
    request.once('error', aborted);

    form.on('part', part => {
      active.add(part);
      part.on('error', aborted);
      part.once('close', () => active.delete(part));
      if (settled) { part.destroy(); return; }
      const headers = part.headers as Record<string, string | undefined>;
      if (++parts !== 1 || part.name !== 'archivo' || part.filename == null ||
          !/^form-data(?:;|$)/i.test(headers['content-disposition'] ?? '')) { fail(invalid()); return; }
      try {
        if (headers['content-type'] !== undefined) {
          const type = contentType(headers['content-type']);
          if (!['text/csv', 'application/octet-stream'].includes(type.type)) throw media();
        }
        // No descomprimir ni decodificar base64: el hash debe recibir los bytes originales.
        if (headers['content-encoding'] && headers['content-encoding'].toLowerCase() !== 'identity') throw media();
        if (headers['content-transfer-encoding'] &&
            !['binary', '7bit', '8bit'].includes(headers['content-transfer-encoding'].toLowerCase())) throw media();
      } catch (error) { fail(error instanceof UploadError ? error : invalid()); return; }
      part.on('data', (chunk: Buffer) => {
        if (settled) return;
        fileBytes += chunk.length;
        if (fileBytes > MAX_CSV_BYTES) { fail(large()); return; }
        chunks.push(chunk);
      });
    });
    // close sucede tras el fin completo del cuerpo y de todas las partes, incluido epílogo.
    form.once('close', () => {
      if (settled) return;
      if (parts !== 1) { fail(invalid()); return; }
      settled = true;
      cleanup();
      resolve(Buffer.concat(chunks, fileBytes));
    });
    form.parse(input as unknown as IncomingMessage);
    request.pipe(input);
  });
}
