import {expect,it} from 'vitest';
import {hairAttemptState,revisitHairShot} from '../../src/hair/attempts';
import type {HairSet} from '../../src/hair/state';
it('stops a manual hair target after three failures instead of silently resetting its slot',()=>{
  const set:HairSet={colors:{},results:{},attempts:{crown:2}};
  expect(hairAttemptState(set,'crown')).toEqual({exhausted:false,canRevisit:false});
  set.attempts!.crown=3;expect(hairAttemptState(set,'crown')).toEqual({exhausted:true,canRevisit:true});
  expect(hairAttemptState(set,'texture-roots').exhausted).toBe(false);
});
it('permits one explicit revisit without deleting prior photo or color evidence',()=>{
  const set:HairSet={colors:{crown:{hex:'#332211',confirmed:true}},results:{crown:{status:'saved',photoId:'earlier'}},attempts:{crown:3}};
  const revisited=revisitHairShot(set,'crown');expect(revisited.attempts!.crown).toBe(0);expect(revisited.results.crown).toEqual(set.results.crown);expect(revisited.colors).toEqual(set.colors);expect(set.attempts!.crown).toBe(3);
  revisited.attempts!.crown=3;expect(hairAttemptState(revisited,'crown')).toEqual({exhausted:true,canRevisit:false});expect(()=>revisitHairShot(revisited,'crown')).toThrow();expect(()=>revisitHairShot(set,'texture-roots')).toThrow();
});
