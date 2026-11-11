import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { createDatabasePool, requiredDatabaseUrl } from '../../src/persistence/database.js';
import { applyMigrations } from '../../src/persistence/migrate.js';

async function deadline<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error('La comprobación del proceso agotó su plazo.')), ms);
    })]);
  } finally { clearTimeout(timer); }
}

it('aceptación V1: servidor compilado, importación/consulta y cierre sin conexiones residuales', async () => {
  const url = requiredDatabaseUrl('TEST_DATABASE_URL');
  if (new URL(url).pathname !== '/importacion_validacion_datos_test' ||
      (process.env.DATABASE_URL && new URL(process.env.DATABASE_URL).pathname === new URL(url).pathname)) {
    throw new Error('La aceptación requiere la base exclusiva importacion_validacion_datos_test.');
  }
  const entry = new URL('../../dist/server.js', import.meta.url);
  if (!existsSync(fileURLToPath(entry))) throw new Error('Ejecuta npm run build antes de la integración.');
  const schema = 'csv_test_' + randomUUID().replaceAll('-', '');
  const applicationName = 'csv_acceptance_' + randomUUID().replaceAll('-', '');
  const admin = createDatabasePool(url);
  const pool = createDatabasePool(url, { schema });
  let created = false;
  let child: ChildProcess | undefined;
  let closed: Promise<{ code: number | null; signal: NodeJS.Signals | null }> | undefined;
  const reserve = createServer();
  try {
    expect((await admin.query('SELECT current_database() AS name')).rows[0].name).toBe('importacion_validacion_datos_test');
    await admin.query('CREATE SCHEMA "' + schema + '"');
    created = true;
    await applyMigrations(pool);
    const configured = new URL(url);
    configured.searchParams.set('options', '-c search_path=' + schema + ',pg_catalog');
    configured.searchParams.set('application_name', applicationName);

    reserve.listen(0, '127.0.0.1');
    await once(reserve, 'listening');
    const port = (reserve.address() as { port: number }).port;
    await new Promise<void>(resolve => reserve.close(() => resolve()));
    // Windows no entrega SIGTERM como POSIX: IPC invoca el mismo manejador.
    // En Linux se envía SIGTERM real. El canal IPC no mantiene vivo al servidor.
    const wrapper = "process.on('message', m => { if (m === 'stop') { process.emit('SIGTERM'); process.disconnect(); } });" +
      "process.channel?.unref(); await import(" + JSON.stringify(entry.href) + ");";
    child = spawn(process.execPath, ['--input-type=module', '--eval', wrapper], {
      windowsHide: true,
      env: { ...process.env, PORT: String(port), DATABASE_URL: configured.toString() },
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });
    closed = new Promise(resolve => child!.once('close', (code, signal) => resolve({ code, signal })));
    child.stderr!.resume(); // No publicar posibles mensajes de configuración en un fallo.
    await deadline(new Promise<void>((resolve, reject) => {
      let output = '';
      child!.stdout!.on('data', chunk => {
        output = (output + chunk.toString()).slice(-2048);
        if (output.includes('API disponible')) resolve();
      });
      child!.once('error', () => reject(new Error('No se pudo crear el proceso de la API.')));
      child!.once('exit', () => reject(new Error('La API terminó antes de quedar disponible.')));
    }), 10_000);
    const origin = 'http://127.0.0.1:' + port;
    async function get(path: string, status = 200) {
      const response = await fetch(origin + path, { signal: AbortSignal.timeout(5000) });
      expect(response.status).toBe(status);
      return response.json();
    }
    async function post(text: string, status: number) {
      const data = new FormData();
      data.append('archivo', new Blob([text], { type: 'text/csv' }), 'aceptacion.csv');
      const response = await fetch(origin + '/importaciones', {
        method: 'POST', body: data, signal: AbortSignal.timeout(5000),
      });
      expect(response.status).toBe(status);
      return response.json();
    }
    async function snapshot() {
      return {
        imports: (await pool.query('SELECT *, xmin::text AS row_version FROM importaciones ORDER BY id')).rows,
        products: (await pool.query('SELECT *, xmin::text AS row_version FROM productos ORDER BY sku')).rows,
      };
    }
    expect(await get('/health')).toEqual({ status: 'ok' });
    const csv = 'sku,nombre,precio_eur,stock\nB,Taza,12.50,0\nA,Café ☕,0.29,2';
    const first = await post(csv, 201);
    expect(first).toMatchObject({ estado: 'completada', productos_importados: 2 });
    expect(first.importacion_id).toMatch(/^[0-9a-f-]{36}$/);
    const saved = await snapshot();
    expect(saved.imports).toHaveLength(1);
    expect(saved.products.map(p => p.precio_centimos)).toEqual([29, 1250]);
    expect(await post(csv, 200)).toEqual(first);
    await post('sku,nombre,precio_eur,stock\nNUEVO,Nuevo,1,1\nA,Otro,2,2', 409);
    await post('sku,nombre,precio_eur,stock\nC,Inválido,-1,0', 422);
    const products = await get('/productos?limit=1&offset=1');
    expect(products.paginacion).toEqual({ limit: 1, offset: 1, total: 2 });
    expect(products.productos[0].sku).toBe('B');
    const filtered = await get('/productos?importacion_id=' + first.importacion_id);
    expect(filtered.productos.map((p: { nombre: string }) => p.nombre)).toEqual(['Café ☕', 'Taza']);
    expect((await get('/importaciones')).paginacion.total).toBe(1);
    expect(await get('/importaciones/' + first.importacion_id)).toMatchObject({
      id: first.importacion_id, version_contrato: 'csv-v1', productos_importados: 2,
    });
    expect((await get('/productos?limit=0', 400)).error.codigo).toBe('INVALID_REQUEST');
    expect((await get('/importaciones/' + randomUUID(), 404)).error.codigo).toBe('NOT_FOUND');
    expect(await snapshot()).toEqual(saved);

    expect((await admin.query('SELECT count(*)::int AS n FROM pg_stat_activity WHERE application_name=$1',
      [applicationName])).rows[0].n).toBeGreaterThan(0);
    if (process.platform === 'win32') child.send('stop');
    else child.kill('SIGTERM');
    expect(await deadline(closed, 10_000)).toEqual({ code: 0, signal: null });
    expect((await admin.query('SELECT count(*)::int AS n FROM pg_stat_activity WHERE application_name=$1',
      [applicationName])).rows[0].n).toBe(0);
  } finally {
    reserve.close();
    // Solo el proceso hijo de esta prueba, nunca procesos ajenos.
    if (child && child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL');
      if (closed) await deadline(closed, 5000);
    }
    await pool.end();
    try {
      if (created) {
        if (!/^csv_test_[a-f0-9]{32}$/.test(schema)) throw new Error('Esquema de limpieza inválido.');
        await admin.query('DROP SCHEMA "' + schema + '" CASCADE');
      }
    } finally { await admin.end(); }
  }
}, 30_000);
