import { randomUUID, createHash } from 'node:crypto';
import request from 'supertest';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { createApp } from '../../src/app.js';
import { ImportService } from '../../src/imports/import-service.js';
import { createDatabasePool, requiredDatabaseUrl } from '../../src/persistence/database.js';
import { ImportRepository } from '../../src/persistence/import-repository.js';
import { applyMigrations } from '../../src/persistence/migrate.js';
import { multipart, rootType } from '../helpers/multipart.js';

const url=requiredDatabaseUrl('TEST_DATABASE_URL');
if(new URL(url).pathname!=='/importacion_validacion_datos_test' ||
  (process.env.DATABASE_URL && new URL(process.env.DATABASE_URL).pathname===new URL(url).pathname)){
  throw new Error('Se requiere la base exclusiva importacion_validacion_datos_test.');
}
const admin=createDatabasePool(url);
let schema:string,pool:Pool,repo:ImportRepository,app:ReturnType<typeof createApp>;
let pools:Pool[]=[];
function connection(){
  const p=createDatabasePool(url,{schema,max:1});pools.push(p);return p;
}
const csv=(...rows:string[])=>Buffer.from(['sku,nombre,precio_eur,stock',...rows].join('\n'));
async function importCsv(...rows:string[]){
  const response=await request(app).post('/importaciones').set('Content-Type',rootType).send(multipart(csv(...rows))).expect(201);
  return response.body.importacion_id as string;
}
async function snapshot(){
  return {
    imports:(await pool.query('SELECT *, xmin::text AS row_version FROM importaciones ORDER BY id')).rows,
    products:(await pool.query('SELECT *, xmin::text AS row_version FROM productos ORDER BY id')).rows,
  };
}
beforeEach(async()=>{
  expect((await admin.query('SELECT current_database() AS name')).rows[0].name).toBe('importacion_validacion_datos_test');
  schema='csv_test_'+randomUUID().replaceAll('-','');
  await admin.query('CREATE SCHEMA "'+schema+'"');
  pool=connection();await applyMigrations(pool);repo=new ImportRepository(pool);
  app=createApp(new ImportService(repo),repo);
});
afterEach(async()=>{
  await Promise.all(pools.map(p=>p.end()));pools=[];
  if(!/^csv_test_[a-f0-9]{32}$/.test(schema))throw new Error('Esquema inválido.');
  await admin.query('DROP SCHEMA "'+schema+'" CASCADE');
});
afterAll(async()=>{await admin.end();});

describe('Consultas HTTP con PostgreSQL real',()=>{
  it('catálogo vacío: listas 200 y detalle inexistente 404',async()=>{
    for(const route of ['productos','importaciones']){
      expect((await request(app).get('/'+route).expect(200)).body).toEqual({
        [route]:[],paginacion:{limit:20,offset:0,total:0},
      });
    }
    expect((await request(app).get('/importaciones/'+randomUUID()).expect(404)).body.error.codigo).toBe('NOT_FOUND');
  });
  it('varios CSV: catálogo ordenado, Unicode y céntimos exactos, POST idempotente y health preservados',async()=>{
    const first=await importCsv('Z,Último,999999.99,1000000','A,Café ☕,0.29,2');
    const second=await importCsv('B,"Taza, azul",12.50,0');
    const products=(await request(app).get('/productos').expect(200)).body;
    expect(products.paginacion).toEqual({limit:20,offset:0,total:3});
    expect(products.productos.map((p:{sku:string})=>p.sku)).toEqual(['A','B','Z']);
    expect(products.productos[0]).toMatchObject({nombre:'Café ☕',precio_centimos:29,stock:2,importacion_id:first});
    expect(products.productos[1]).toMatchObject({nombre:'Taza, azul',precio_centimos:1250,importacion_id:second});
    expect(products.productos[2].precio_centimos).toBe(99999999);
    expect(Object.keys(products.productos[0]).sort()).toEqual(['id','importacion_id','nombre','precio_centimos','sku','stock']);
    const replay=await request(app).post('/importaciones').set('Content-Type',rootType)
      .send(multipart(csv('Z,Último,999999.99,1000000','A,Café ☕,0.29,2'))).expect(200);
    expect(replay.body).toEqual({importacion_id:first,estado:'completada',productos_importados:2});
    expect((await request(app).get('/health').expect(200)).body).toEqual({status:'ok'});
    expect((await request(app).get('/productos').expect(200)).body).toEqual(products);
  });
  it('página predeterminada de 20, siguiente página y límite máximo 100',async()=>{
    await importCsv(...Array.from({length:21},(_,i)=>'SKU-'+String(i).padStart(2,'0')+',Nombre,1,1'));
    const first=(await request(app).get('/productos').expect(200)).body;
    expect(first.productos).toHaveLength(20);expect(first.paginacion).toEqual({limit:20,offset:0,total:21});
    const next=(await request(app).get('/productos?offset=20').expect(200)).body;
    expect(next.productos.map((p:{sku:string})=>p.sku)).toEqual(['SKU-20']);
    expect(next.paginacion).toEqual({limit:20,offset:20,total:21});
    expect((await request(app).get('/productos?limit=100').expect(200)).body.productos).toHaveLength(21);
  });
  it('ordena SKU con la comparación C del esquema, incluyendo dígitos, guion y guion bajo',async()=>{
    const skus=['Z','AA','A_','A0','A-','A','10','2'];
    await importCsv(...skus.map(s=>s+',Nombre,1,1'));
    const response=await request(app).get('/productos').expect(200);
    expect(response.body.productos.map((p:{sku:string})=>p.sku)).toEqual([...skus].sort());
  });
  it.each(['productos','importaciones'])('offset superior al total conserva el total real en %s',async route=>{
    await importCsv('A,Nombre,1,1');
    for(const offset of [1,999,Number.MAX_SAFE_INTEGER]){
      expect((await request(app).get('/'+route+'?offset='+offset).expect(200)).body).toEqual({
        [route]:[],paginacion:{limit:20,offset,total:1},
      });
    }
  });
  it('filtra por UUID con total filtrado, páginas vacías y filtro inexistente',async()=>{
    const first=await importCsv('A,Uno,1,1','C,Tres,3,3');
    await importCsv('B,Dos,2,2');
    const response=(await request(app).get('/productos?limit=1&offset=1&importacion_id='+first.toUpperCase()).expect(200)).body;
    expect(response.productos.map((p:{sku:string})=>p.sku)).toEqual(['C']);
    expect(response.paginacion).toEqual({limit:1,offset:1,total:2});
    expect((await request(app).get('/productos?offset=2&importacion_id='+first).expect(200)).body)
      .toEqual({productos:[],paginacion:{limit:20,offset:2,total:2}});
    expect((await request(app).get('/productos?importacion_id='+randomUUID()).expect(200)).body)
      .toEqual({productos:[],paginacion:{limit:20,offset:0,total:0}});
  });
  it('detalle conserva hash, metadatos y cantidad sin incluir catálogo',async()=>{
    const id=await importCsv('A,Café,0.29,2','B,Otro,0,0');
    const result=(await request(app).get('/importaciones/'+id.toUpperCase()).expect(200)).body;
    const stored=await repo.findImportById(id);
    expect(result).toEqual({...stored,creada_en:stored!.creada_en.toISOString()});
    expect(result.sha256).toBe(createHash('sha256').update(csv('A,Café,0.29,2','B,Otro,0,0')).digest('hex'));
    expect(result.productos_importados).toBe(2);
    expect(Object.keys(result).sort()).toEqual(['creada_en','id','productos_importados','sha256','version_contrato']);
  });
  it('historial estable por fecha descendente e ID descendente, con paginación',async()=>{
    const ids=[await importCsv('A,Uno,1,1'),await importCsv('B,Dos,2,2'),await importCsv('C,Tres,3,3')];
    // Preparación controlada de fechas iguales: solo datos propios de este test.
    await pool.query("UPDATE importaciones SET creada_en='2026-11-11T12:00:00Z'");
    await pool.query("UPDATE importaciones SET creada_en='2026-11-10T12:00:00Z' WHERE id=$1",[ids[2]]);
    const expected=[...ids.slice(0,2)].sort().reverse().concat(ids[2]);
    const all=(await request(app).get('/importaciones').expect(200)).body;
    expect(all.importaciones.map((i:{id:string})=>i.id)).toEqual(expected);
    expect(all.importaciones.every((i:object)=>!('sha256' in i))).toBe(true);
    expect(all.paginacion.total).toBe(3);
    const second=(await request(app).get('/importaciones?limit=1&offset=1').expect(200)).body;
    expect(second.importaciones.map((i:{id:string})=>i.id)).toEqual([expected[1]]);
    expect(second.paginacion).toEqual({limit:1,offset:1,total:3});
    expect((await request(app).get('/importaciones').expect(200)).body).toEqual(all);
  });
  it('todas las consultas funcionan en modo SQL read-only y no alteran filas ni versiones',async()=>{
    const id=await importCsv('A,Café,0.29,2','B,Otro,1,0');
    const before=await snapshot();
    await pool.query('SET default_transaction_read_only=on');
    try {
      for(const path of ['/productos','/productos?limit=1&offset=1','/productos?importacion_id='+id,
        '/importaciones','/importaciones?offset=99','/importaciones/'+id]){
        await request(app).get(path).expect(200);
      }
      await request(app).get('/importaciones/'+randomUUID()).expect(404);
      expect(await snapshot()).toEqual(before);
    } finally {await pool.query('SET default_transaction_read_only=off');}
  });
  it('entradas SQL y UUID inválidos producen 400 sin alterar el catálogo',async()=>{
    await importCsv('A,Nombre,1,1');
    const before=await snapshot();
    for(const query of ['limit=1;DROP TABLE productos','offset=0 OR 1=1','importacion_id='+randomUUID()+"' OR '1'='1"]){
      const [key,...value]=query.split('=');
      await request(app).get('/productos?'+key+'='+encodeURIComponent(value.join('='))).expect(400);
    }
    await request(app).get('/importaciones/no-es-uuid').expect(400);
    expect(await snapshot()).toEqual(before);
  });
  it('errores SQL controlados no filtran nombres internos ni sentencias',async()=>{
    // Pool apunta a un esquema nuevo propio sin tablas; no se elimina ninguna tabla.
    const empty='csv_test_'+randomUUID().replaceAll('-','');
    await admin.query('CREATE SCHEMA "'+empty+'"');
    const missingPool=createDatabasePool(url,{schema:empty});
    try {
      const missing=createApp(undefined,new ImportRepository(missingPool));
      const response=await request(missing).get('/productos').expect(500);
      expect(response.body.error.codigo).toBe('PERSISTENCE_ERROR');
      expect(JSON.stringify(response.body)).not.toMatch(/SELECT|42P01|relation|stack|csv_test_/);
    } finally {
      await missingPool.end();
      await admin.query('DROP SCHEMA "'+empty+'" CASCADE');
    }
  });
  it.each(['COMMIT','ROLLBACK'])('no muestra una importación pendiente y refleja %s',async ending=>{
    const writer=await connection().connect();
    const id=randomUUID();
    try {
      await writer.query('BEGIN');
      await writer.query('INSERT INTO importaciones (id,sha256,version_contrato,productos_importados) VALUES ($1,$2,$3,$4)',
        [id,'a'.repeat(64),'csv-v1',1]);
      await writer.query('INSERT INTO productos (id,sku,nombre,precio_centimos,stock,importacion_id) VALUES ($1,$2,$3,$4,$5,$6)',
        [randomUUID(),'A','Café',29,2,id]);
      for(const path of ['/productos','/importaciones']){
        const pending=await request(app).get(path).expect(200);
        expect(pending.body.paginacion.total).toBe(0);
        expect(pending.body[path.slice(1)]).toEqual([]);
      }
      await request(app).get('/importaciones/'+id).expect(404);
      await writer.query(ending);
      for(const path of ['/productos','/importaciones']){
        const after=await request(app).get(path).expect(200);
        expect(after.body.paginacion.total).toBe(ending==='COMMIT'?1:0);
        expect(after.body[path.slice(1)]).toHaveLength(ending==='COMMIT'?1:0);
      }
      await request(app).get('/importaciones/'+id).expect(ending==='COMMIT'?200:404);
    } finally {await writer.query('ROLLBACK');writer.release();}
  });
});
