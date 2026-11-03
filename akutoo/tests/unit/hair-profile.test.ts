import { expect, it } from 'vitest';
import { hairPattern, hairCompletion } from '../../src/hair/profile';
import type { HairSet } from '../../src/hair/state';
it('records a manual pattern with an optional matching subtype and permits an unspecified pattern',()=>{
  expect(hairPattern('wavy','2B')).toEqual({family:'wavy',subtype:'2B',source:'user'});
  expect(hairPattern('curly')).toEqual({family:'curly',source:'user'});
  expect(hairPattern('')).toBeNull();
  expect(()=>hairPattern('straight','4C')).toThrow();expect(()=>hairPattern('automatic')).toThrow();
});
it('does not make optional length evidence a required completion item',()=>{
  const set:HairSet={includeLength:true,colors:{},results:{'angle-front':{status:'saved',photoId:'front'},length:{status:'saved',photoId:'length'}}};
  expect(hairCompletion('down',set)).toEqual({saved:1,required:14,optionalSaved:1});
  expect(hairCompletion('bun',set)).toEqual({saved:1,required:16,optionalSaved:1});
  set.includeLength=false;expect(hairCompletion('down',set)).toEqual({saved:1,required:14,optionalSaved:1});
  expect(set.results.length.status).toBe('saved');
});
