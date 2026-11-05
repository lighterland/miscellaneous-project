import {expect,it,vi} from 'vitest';
import {haptic} from '../../src/audio/haptics';
it('uses distinct short cues and tolerates unsupported or denied vibration',()=>{
 const vibrate=vi.fn(()=>true);haptic('saved',{vibrate});expect(vibrate).toHaveBeenCalledWith(25);
 haptic('return',{vibrate});expect(vibrate).toHaveBeenLastCalledWith([35,70,35]);
 expect(()=>haptic('saved',{})).not.toThrow();expect(()=>haptic('saved',{vibrate:()=>{throw Error('denied');}})).not.toThrow();
});
