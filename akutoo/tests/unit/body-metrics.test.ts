import {expect,it} from 'vitest';
import {bodyRatios,bodyFraming} from '../../src/body/metrics';
function points() {
    const result=Array.from({length:33},()=>({x:.5,y:.3,z:0,visibility:1,presence:1}));
    for(const [index,x,y] of [[11,.3,.25],[12,.7,.25],[13,.25,.4],[14,.75,.4],[15,.2,.55],[16,.8,.55],[23,.4,.5],[24,.6,.5],[25,.4,.7],[26,.6,.7],[27,.4,.9],[28,.6,.9]]) result[index]={x,y,z:0,visibility:1,presence:1};
    return result;
}
it('uses pixel geometry for body ratios rather than treating unequal normalized axes as equal',()=>{
    const ratios=bodyRatios(points(),1000,2000,{x:.2,y:.1,width:.6,height:.8},180);
    expect(ratios.shoulderToHip).toBeCloseTo(2);expect(ratios.torsoToLeg).toBeCloseTo(.625);
    expect(ratios.armToHeight).toBeCloseTo(2*Math.hypot(50,300)/1600);
    expect(ratios.shoulderWidthCm).toBeCloseTo(45);expect(ratios.headToHeight).toBeNull();
    expect(ratios.source).toBe('2d-landmarks');expect(ratios.estimated).toBe(true);
});
it('keeps missing, low-confidence or out-of-frame anatomy unmeasured',()=>{
    const landmarks=points();landmarks[11].visibility=.1;
    expect(bodyRatios(landmarks,1000,2000,{x:.2,y:.1,width:.6,height:.8},null).shoulderToHip).toBeNull();
    expect(bodyRatios(points(),0,2000,null,180).armToHeight).toBeNull();
    landmarks[27].y=1.2;expect(bodyRatios(landmarks,1000,2000,null,180).torsoToLeg).toBeNull();
});
it('uses the measured hip-knee-ankle chain rather than shortening a bent leg to its endpoints',()=>{
    const landmarks=points();landmarks[25].x=.7;landmarks[26].x=.9;
    const ratios=bodyRatios(landmarks,1000,2000,null,null);
    expect(ratios.torsoToLeg).toBeCloseTo(500/(2*Math.hypot(300,400)));
    landmarks[25].visibility=.1;expect(bodyRatios(landmarks,1000,2000,null,null).torsoToLeg).toBeNull();
});
it('guides whole-body margins while refusing to infer complete framing from no measured mask',()=>{
    expect(bodyFraming(null)).toBe('unmeasured');expect(bodyFraming({x:.1,y:.06,width:.8,height:.88})).toBe('ready');
    expect(bodyFraming({x:.1,y:0,width:.8,height:1})).toBe('step-back');
    expect(bodyFraming({x:.2,y:.3,width:.6,height:.4})).toBe('step-forward');
    expect(bodyFraming({x:.8,y:.06,width:.3,height:.88})).toBe('step-back');
    expect(bodyFraming({x:.1,y:.06,width:.8,height:.94},'half',.85)).toBe('ready');
    expect(bodyFraming({x:.1,y:.06,width:.8,height:.94},'half')).toBe('unmeasured');
});
