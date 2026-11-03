import {it,expect} from 'vitest';
import {handsFreeStep} from '../../src/capture/hands-free';
it('gives an explicit turn countdown and settle second before a single burst',()=>{
 expect(handsFreeStep(1000,1000)).toEqual({remaining:7,capture:false});
 expect(handsFreeStep(1000,7999)).toEqual({remaining:1,capture:false});
 expect(handsFreeStep(1000,8000)).toEqual({remaining:0,capture:false});
 expect(handsFreeStep(1000,8999).capture).toBe(false);
 expect(handsFreeStep(1000,9000)).toEqual({remaining:0,capture:true});
});
