import {expect,it} from 'vitest';
import {parseBodyCorrections} from '../../src/body/corrections';
it('keeps blank corrections absent and accepts only finite positive user values',()=>{
    expect(parseBodyCorrections({headToHeight:' .14 ',shoulderToHip:''})).toEqual({headToHeight:.14});
    expect(parseBodyCorrections({})).toEqual({});
    for(const value of ['0','-1','NaN','Infinity','abc'])expect(()=>parseBodyCorrections({armToHeight:value})).toThrow();
});
