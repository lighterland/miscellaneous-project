import {expect,it} from 'vitest';
import {gradeBody} from '../../src/body/quality';
import type {BodyAnalysis} from '../../src/body/protocol';
const sample=():BodyAnalysis=>({detectedPoses:1,landmarks:Array.from({length:33},()=>({x:.5,y:.5,visibility:1,presence:1})),bounds:{x:.2,y:.06,width:.6,height:.88},targetArea:.4,metrics:{sharpness:100,exposure:100,clipped:.01},sourceDimensions:{width:1280,height:1920},durationMs:5,model:'pose-landmarker-lite-v1'});
it('keeps body review separate from measured landmarks and promotes only reviewed passing evidence',()=>{
    const m=sample();expect(gradeBody(m,{sharpness:100,exposure:100},'full').tier).toBe('C');
    expect(gradeBody(m,{sharpness:100,exposure:100},'full',true).tier).toBe('A');
    expect(m.detectedPoses).toBe(1);
});
it('retains body hard floors for people, clipping, resolution, unusable focus and head framing',()=>{
    for(const patch of [{detectedPoses:2},{detectedPoses:0},{targetArea:0},{targetArea:null},{targetArea:NaN},{metrics:{sharpness:1,exposure:100,clipped:.01}},{metrics:{sharpness:100,exposure:100,clipped:.11}},{sourceDimensions:{width:1023,height:1920}},{bounds:{x:.1,y:0,width:.8,height:.95}}]) expect(gradeBody({...sample(),...patch},{sharpness:100,exposure:100},'full',true).hardFailure).toBe(true);
    expect(gradeBody(sample(),null,'full').hardFailure).toBe(true);
});
it('allows cropped legs only in half-body mode while keeping missing required joints unmeasured',()=>{
    const m=sample();m.landmarks[27].visibility=0;m.landmarks[28].visibility=0;
    expect(gradeBody(m,{sharpness:100,exposure:100},'half').hardFailure).toBe(false);
    expect(gradeBody(m,{sharpness:100,exposure:100},'full').hardFailure).toBe(true);
    m.landmarks[23].visibility=0;expect(gradeBody(m,{sharpness:100,exposure:100},'half').hardFailure).toBe(true);
});

it('relaxes only body soft targets and preserves review and hard floors',()=>{
 const m=sample();m.metrics!.sharpness=40;
 expect(gradeBody(m,{sharpness:100,exposure:100},'full',true,true).score).toBeGreaterThan(gradeBody(m,{sharpness:100,exposure:100},'full',true).score);
 expect(gradeBody(m,{sharpness:100,exposure:100},'full',false,true).tier).toBe('C');
 m.metrics!.sharpness=1;expect(gradeBody(m,{sharpness:100,exposure:100},'full',true,true).hardFailure).toBe(true);
});
