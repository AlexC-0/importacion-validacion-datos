import { connect } from 'node:net';
import { request as httpRequest, type IncomingMessage } from 'node:http';
import { once } from 'node:events';
import { PassThrough } from 'node:stream';
import { afterEach, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { receiveCsv } from '../src/http/receive-csv.js';
import { MAX_CSV_BYTES } from '../src/csv/types.js';
import { rootType, goodCsv, multipart } from './helpers/multipart.js';

afterEach(() => { vi.useRealTimers(); });
it('recepción incompleta agota el plazo y devuelve error controlado', async () => {
  vi.useFakeTimers({ toFake:['setTimeout', 'clearTimeout'] });
  const source = Object.assign(new PassThrough(), { headers: {'content-type':rootType} });
  const result = receiveCsv(source as unknown as IncomingMessage).catch(error => error);
  source.write(multipart(goodCsv, {close:false}));
  await vi.advanceTimersByTimeAsync(30_000);
  expect(await result).toMatchObject({status:400, codigo:'INVALID_REQUEST'});
  source.destroy();
});
it('un error del stream se recoge sin rechazo no gestionado ni producto parcial', async () => {
  const source = Object.assign(new PassThrough(), { headers: {'content-type':rootType} });
  const result = receiveCsv(source as unknown as IncomingMessage).catch(error => error);
  source.write(multipart(goodCsv, {close:false}));
  source.destroy(new Error('dato sensible'));
  expect(await result).toMatchObject({status:400, codigo:'INVALID_REQUEST'});
});
it('desconectar el cliente a mitad de archivo no invoca el servicio; health sigue disponible', async () => {
  const importCsv = vi.fn();
  const server = createApp({ importCsv }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = (server.address() as {port:number}).port;
  try {
    const socket = connect(port, '127.0.0.1');
    await once(socket, 'connect');
    const received = once(server, 'request');
    socket.write('POST /importaciones HTTP/1.1\r\nHost: localhost\r\nContent-Type: ' + rootType +
      '\r\nContent-Length: 100000\r\n\r\n');
    socket.write(multipart(goodCsv, {close:false}));
    const [req] = await received;
    const closed = new Promise<void>(resolve => req.once('close', resolve));
    // La desconexión produce aborted y después error; ambos deben quedar atendidos.
    socket.destroy();
    await closed;
    expect(importCsv).not.toHaveBeenCalled();
    const health = await fetch('http://127.0.0.1:' + port + '/health');
    expect(await health.json()).toEqual({status:'ok'});
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
it('el límite del archivo interrumpe una subida chunked todavía abierta y responde 413', async () => {
  const importCsv = vi.fn();
  const server = createApp({ importCsv }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = (server.address() as {port:number}).port;
  try {
    const result = await new Promise<{status:number; text:string}>((resolve, reject) => {
      const req = httpRequest({host:'127.0.0.1',port,path:'/importaciones',method:'POST',
        headers:{'Content-Type':rootType, 'Transfer-Encoding':'chunked'}}, response => {
          let text='';
          response.on('data', chunk => {text+=chunk;});
          response.on('end', () => { resolve({status:response.statusCode!,text}); req.destroy(); });
        });
      req.on('error', reject);
      req.setTimeout(5000, () => req.destroy(new Error('No se abortó la recepción.')));
      req.write(multipart(Buffer.alloc(MAX_CSV_BYTES + 100, 65), {close:false}));
      // No enviar fin de HTTP ni cierre multipart: la respuesta debe llegar antes.
    });
    expect(result.status).toBe(413);
    expect(JSON.parse(result.text).error.codigo).toBe('FILE_TOO_LARGE');
    expect(importCsv).not.toHaveBeenCalled();
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
it('sin PostgreSQL, la validación CSV conserva prioridad sobre 503', async () => {
  const server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = (server.address() as {port:number}).port;
  try {
    const response = await fetch('http://127.0.0.1:' + port + '/importaciones', {
      method:'POST', headers:{'Content-Type':rootType}, body:Uint8Array.from(multipart(Buffer.from('cabecera incorrecta'))),
    });
    expect(response.status).toBe(400);
    expect((await response.json()).error.codigo).toBe('INVALID_HEADER');
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
