import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { PersistenceError } from '../src/persistence/database.js';
import type { ReadStore } from '../src/http/read-routes.js';

const id='a2c10e86-a049-4d16-8f92-9023b3f44001';
const record={id,sha256:'a'.repeat(64),version_contrato:'csv-v1',productos_importados:1,creada_en:new Date('2026-11-11T12:00:00Z')};
function setup() {
  const store:ReadStore={
    listProducts:vi.fn(async()=>({items:[],total:0})),
    listImports:vi.fn(async()=>({items:[],total:0})),
    findImportById:vi.fn(async()=>null),
  };
  return {store,app:createApp(undefined,store)};
}
describe('Consultas HTTP: respuestas y errores',()=>{
  it.each(['/productos','/importaciones'])('catálogo vacío en %s',async path=>{
    const {app}=setup();
    const response=await request(app).get(path).expect('Content-Type',/json/).expect(200);
    expect(response.body).toEqual({[path.slice(1)]:[],paginacion:{limit:20,offset:0,total:0}});
  });
  it('proyecta los seis campos del producto y preserva céntimos y Unicode',async()=>{
    const {app,store}=setup();
    const product = {id,sku:'AB-001',nombre:'Café ☕',precio_centimos:29,stock:2,importacion_id:id,secreto:'no publicar'};
    vi.mocked(store.listProducts).mockResolvedValue({items:[product],total:1});
    const response=await request(app).get('/productos?limit=1&offset=0&importacion_id='+id.toUpperCase()).expect(200);
    expect(response.body).toEqual({productos:[{id,sku:'AB-001',nombre:'Café ☕',precio_centimos:29,stock:2,importacion_id:id}],
      paginacion:{limit:1,offset:0,total:1}});
    expect(store.listProducts).toHaveBeenCalledWith({limit:1,offset:0,importacionId:id});
  });
  it('el listado de importaciones no filtra sha256 ni propiedades internas',async()=>{
    const {app,store}=setup();
    vi.mocked(store.listImports).mockResolvedValue({items:[record],total:1});
    const response=await request(app).get('/importaciones').expect(200);
    expect(response.body.importaciones).toEqual([{id,version_contrato:'csv-v1',productos_importados:1,creada_en:'2026-11-11T12:00:00.000Z'}]);
  });
  it('detalle incluye hash y fecha UTC, sin productos ni datos internos',async()=>{
    const {app,store}=setup();
    vi.mocked(store.findImportById).mockResolvedValue(record);
    const response=await request(app).get('/importaciones/'+id.toUpperCase()).expect(200);
    expect(response.body).toEqual({...record,creada_en:'2026-11-11T12:00:00.000Z'});
    expect(store.findImportById).toHaveBeenCalledWith(id);
  });
  it('UUID inexistente devuelve NOT_FOUND con el formato general',async()=>{
    const {app}=setup();
    expect((await request(app).get('/importaciones/'+id).expect(404)).body).toEqual({
      error:{codigo:'NOT_FOUND',mensaje:'La importación no existe.',detalles:[],errores_truncados:false},
    });
  });
  it.each([
    '/productos?limit=0','/productos?limit=101','/productos?offset=-1',
    '/productos?offset=1.5','/productos?offset=9007199254740992',
    '/productos?limit=1&limit=1','/productos?offset[]=0','/productos?foo=1',
    '/productos?importacion_id=invalid','/productos?importacion_id='+id+'&importacion_id='+id,
    '/productos?limit=1%3BDROP%20TABLE%20productos','/productos?offset=0%20OR%201%3D1',
    '/importaciones?importacion_id='+id,'/importaciones?limit=',
    '/importaciones/invalid','/importaciones/'+id+'?limit=1',
    '/importaciones/%ZZ','/productos?limit=%FF',
  ])('400 antes de consultar PostgreSQL: %s',async path=>{
    const {app,store}=setup();
    const response=await request(app).get(path).expect('Content-Type',/json/).expect(400);
    expect(response.body.error).toMatchObject({codigo:'INVALID_REQUEST',errores_truncados:false});
    expect(response.body.error.detalles[0].fila).toBeNull();
    expect(store.listProducts).not.toHaveBeenCalled();
    expect(store.listImports).not.toHaveBeenCalled();
    expect(store.findImportById).not.toHaveBeenCalled();
  });
  it('un error de limit identifica el parámetro',async()=>{
    expect((await request(setup().app).get('/productos?limit=0').expect(400)).body.error.detalles[0].campo).toBe('limit');
  });
  it.each([
    ['ECONNREFUSED',503],['ECONNRESET',503],['ETIMEDOUT',503],['08006',503],
    ['57P01',503],['57014',503],['53300',503],['42P01',500],['UNKNOWN',500],
  ])('clasifica PostgreSQL %s como %s sin filtrar información interna',async(code,status)=>{
    const {app,store}=setup();
    const error=new PersistenceError(code as string,'secreto_interno');
    vi.mocked(store.listProducts).mockRejectedValue(error);
    vi.mocked(store.listImports).mockRejectedValue(error);
    vi.mocked(store.findImportById).mockRejectedValue(error);
    for(const path of ['/productos','/importaciones','/importaciones/'+id]){
      const response=await request(app).get(path).expect(status as number);
      expect(response.body.error.codigo).toBe(status===503?'SERVICE_UNAVAILABLE':'PERSISTENCE_ERROR');
      expect(JSON.stringify(response.body)).not.toMatch(/secreto|stack|SELECT|postgres:\/\//);
    }
  });
  it('una excepción no prevista conserva JSON seguro',async()=>{
    const {app,store}=setup();
    vi.mocked(store.listProducts).mockRejectedValue(new Error('postgres://usuario:secreto@host/base'));
    const response=await request(app).get('/productos').expect(500);
    expect(JSON.stringify(response.body)).not.toMatch(/usuario|secreto|stack/);
  });
  it('sin configuración: 503 para consultas válidas, 400 para inválidas y health 200',async()=>{
    const app=createApp();
    for(const path of ['/productos','/importaciones','/importaciones/'+id])await request(app).get(path).expect(503);
    await request(app).get('/productos?limit=0').expect(400);
    expect((await request(app).get('/health').expect(200)).body).toEqual({status:'ok'});
  });
});
