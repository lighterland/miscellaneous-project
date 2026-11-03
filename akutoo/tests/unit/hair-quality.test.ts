import { expect,it } from 'vitest';
import { gradeHair,hairBaseline } from '../../src/hair/quality';
import type { HairAnalysis } from '../../src/hair/protocol';
const result:HairAnalysis={targetArea:.5,bounds:{x:.1,y:.1,width:.8,height:.8},sharpness:100,exposure:100,brightClipped:.01,clipped:.01,swatch:'#443322',personCount:null,occlusionVerified:false,sourceDimensions:{width:2000,height:3000},durationMs:1};
it('calibrates a hair-only median without fabricating face measurements',()=>{expect(hairBaseline([{sharpness:100,exposure:80},{sharpness:200,exposure:100},{sharpness:NaN,exposure:200}])).toEqual({sharpness:150,exposure:90});expect(hairBaseline([])).toBeNull();});
it('keeps unknown people/occlusion unverified until an explicit visual check',()=>{expect(gradeHair(result,{sharpness:100,exposure:100},'angle',false).tier).toBe('C');expect(gradeHair(result,{sharpness:100,exposure:100},'angle',true).tier).toBe('A');expect(result.personCount).toBeNull();expect(result.occlusionVerified).toBe(false);});
it('does not pass missing calibration, missing targets or hard-floor failures',()=>{
  expect(gradeHair(result,null,'angle',true).hardFailure).toBe(true);
  for(const patch of [{targetArea:0},{sharpness:1},{brightClipped:.03},{sourceDimensions:{width:800,height:1200}}]) expect(gradeHair({...result,...patch},{sharpness:100,exposure:100},'angle',true).hardFailure).toBe(true);
  expect(gradeHair(result,{sharpness:100,exposure:100},'angle',true,2).reason).toBe('face');
});
it('uses relative sharpness/exposure and the distinct texture coverage soft target',()=>{
  const baseline={sharpness:100,exposure:100};expect(gradeHair(result,baseline,'texture',true).score).toBeLessThan(gradeHair(result,baseline,'angle',true).score);
  expect(gradeHair({...result,sharpness:200,exposure:200},{sharpness:200,exposure:200},'angle',true)).toEqual(gradeHair(result,baseline,'angle',true));
});

it('keeps missing hair area unmeasured and relaxes only soft targets with the captured flag',()=>{
 const baseline={sharpness:100,exposure:100},soft={...result,sharpness:40,targetArea:.15};
 expect(gradeHair(soft,baseline,'angle',true,null,true).score).toBeGreaterThan(gradeHair(soft,baseline,'angle',true).score);
 expect(gradeHair(soft,baseline,'angle',false,null,true).tier).toBe('C');
 expect(gradeHair({...soft,sharpness:1},baseline,'angle',true,null,true).hardFailure).toBe(true);
 expect(gradeHair({...result,targetArea:null,durationMs:null},baseline,'angle',true,null,true).hardFailure).toBe(true);
});
