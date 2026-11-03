import {expect,it} from 'vitest';
import {bodyShots} from '../../src/body/plan';
it('keeps eight instruction angles in both modes and adds explicit proportion poses only to full body',()=>{
    for(const mode of ['half','full'] as const){const shots=bodyShots(mode);expect(shots.filter(shot=>shot.kind==='angle')).toHaveLength(8);expect(new Set(shots.map(shot=>shot.id)).size).toBe(shots.length);}
    expect(bodyShots('full').filter(shot=>shot.kind==='proportion').map(shot=>shot.angle)).toEqual(['front','left','back']);
    expect(bodyShots('half').some(shot=>shot.kind==='proportion')).toBe(false);
    expect(bodyShots('full',true).filter(shot=>shot.optional)).toHaveLength(2);
});
