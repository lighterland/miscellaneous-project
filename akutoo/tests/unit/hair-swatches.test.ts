import {expect,it} from 'vitest';
import {hairColorSuggestions} from '../../src/hair/swatches';
import type {HairAnalysis} from '../../src/hair/protocol';
it('keeps separate region evidence and invalidates confirmations only for replaced region suggestions',()=>{
    const analysis={swatch:'#abcdef',colorClusters:[{hex:'#112233',fraction:.7},{hex:'#dedede',fraction:.3}]} as HairAnalysis;
    const old={roots:{hex:'#000000',confirmed:true,sourcePhotoId:'old'},ends:{hex:'#ffffff',confirmed:true,sourcePhotoId:'other'}};
    const next=hairColorSuggestions(old,'roots',analysis,'new');
    expect(next.roots).toMatchObject({hex:'#112233',confirmed:false,sourcePhotoId:'new',fraction:.7});
    expect(next['roots-candidate-2']).toMatchObject({hex:'#dedede',confirmed:false,fraction:.3});
    expect(next.ends).toEqual(old.ends);expect(old.roots.confirmed).toBe(true);
    expect(next['roots-candidate-2'].role).toBeUndefined();
    const reduced=hairColorSuggestions(next,'roots',{swatch:'#445566'} as HairAnalysis,'last');
    expect(reduced['roots-candidate-2']).toBeUndefined();expect(reduced.roots.hex).toBe('#445566');
});
