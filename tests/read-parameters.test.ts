import { describe, expect, it } from 'vitest';
import { parseImportDetail, parseListQuery, parseUuid, ReadParameterError } from '../src/http/read-parameters.js';

const uuid = 'a2c10e86-a049-4d16-8f92-9023b3f44001';
describe('Contrato de parámetros de lectura', () => {
  it('aplica valores predeterminados', () => {
    expect(parseListQuery('')).toEqual({limit:20,offset:0});
  });
  it.each(['1','20','100'])('acepta limit=%s', limit => {
    expect(parseListQuery('limit='+limit).limit).toBe(Number(limit));
  });
  it.each(['0','1','9007199254740991'])('acepta offset=%s', offset => {
    expect(parseListQuery('offset='+offset).offset).toBe(Number(offset));
  });
  it.each(['', '0', '101', '-1', '1.5', '1e2', '+1', ' 1', '01', 'Infinity', 'NaN', '١', '9007199254740992'])(
    'rechaza limit=%j', value => { expect(() => parseListQuery('limit='+encodeURIComponent(value))).toThrow(ReadParameterError); },
  );
  it.each(['', '-1', '0.5', '1e2', '+1', ' 0', '00', '0x10', 'Infinity', '9007199254740992', '9'.repeat(500)])(
    'rechaza offset=%j', value => { expect(() => parseListQuery('offset='+encodeURIComponent(value))).toThrow(ReadParameterError); },
  );
  it.each(['limit=1&limit=2', 'limit=1&%6cimit=1', 'offset=0&offset=0',
    'limit[]=1', 'limit[a]=1', 'orden=sku', 'LIMIT=20', '=1', 'limit=%FF', '%ZZ=1', 'limit=%'])(
    'rechaza consulta ambigua o mal codificada %s', query => { expect(() => parseListQuery(query,true)).toThrow(ReadParameterError); },
  );
  it('normaliza UUID canónico, también tras decodificación de URL', () => {
    expect(parseUuid(uuid.toUpperCase(),'id')).toBe(uuid);
    expect(parseListQuery('importacion_id='+uuid.toUpperCase(),true)).toEqual({limit:20,offset:0,importacionId:uuid});
  });
  it.each(['', 'abc', uuid.replaceAll('-',''), '{'+uuid+'}', uuid+' ', uuid+' OR 1=1', uuid.replace('a','g')])(
    'rechaza UUID %j', id => { expect(() => parseUuid(id,'id')).toThrow(ReadParameterError); },
  );
  it('admite UUID nulo y no restringe la versión sintáctica', () => {
    expect(parseUuid('00000000-0000-0000-0000-000000000000','id')).toBe('00000000-0000-0000-0000-000000000000');
  });
  it('el filtro solo pertenece a productos y no puede repetirse', () => {
    expect(() => parseListQuery('importacion_id='+uuid)).toThrow(ReadParameterError);
    expect(() => parseListQuery('importacion_id='+uuid+'&importacion_id='+uuid,true)).toThrow(ReadParameterError);
  });
  it('detalle admite UUID y rechaza cualquier parámetro de consulta', () => {
    expect(parseImportDetail(uuid,'')).toBe(uuid);
    expect(() => parseImportDetail(uuid,'limit=1')).toThrow(ReadParameterError);
  });
});
