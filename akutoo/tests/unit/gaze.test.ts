import {expect,it} from 'vitest';
import {measuredGaze} from '../../src/analysis/gaze';
const base={eyeLookOutLeft:0,eyeLookInRight:0,eyeLookInLeft:0,eyeLookOutRight:0,eyeLookUpLeft:0,eyeLookUpRight:0,eyeLookDownLeft:0,eyeLookDownRight:0,eyeBlinkLeft:0,eyeBlinkRight:0};
it('uses subject-relative directions and requires both eyes',()=>{
 expect(measuredGaze({...base,eyeLookOutLeft:.8,eyeLookInRight:.8})).toBe('left');
 expect(measuredGaze({...base,eyeLookInLeft:.8,eyeLookOutRight:.8})).toBe('right');
 expect(measuredGaze({...base,eyeLookUpLeft:.8,eyeLookUpRight:.8})).toBe('up');
 expect(measuredGaze({...base,eyeLookDownLeft:.8,eyeLookDownRight:.8})).toBe('down');
 expect(measuredGaze({...base,eyeLookOutLeft:.8})).toBeNull();
});
it('rejects missing, nonfinite, blinking, neutral and ambiguous evidence',()=>{
 expect(measuredGaze({})).toBeNull();expect(measuredGaze(base)).toBeNull();
 const left={...base,eyeLookOutLeft:.8,eyeLookInRight:.8};
 expect(measuredGaze({...left,eyeBlinkLeft:.9})).toBeNull();
 expect(measuredGaze({...left,eyeLookInLeft:NaN})).toBeNull();
 expect(measuredGaze({...left,eyeLookUpLeft:.8,eyeLookUpRight:.8})).toBeNull();
});
