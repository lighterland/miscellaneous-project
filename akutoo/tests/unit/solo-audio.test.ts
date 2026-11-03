import {it,expect,vi,afterEach} from 'vitest';
import {SoloEffects} from '../../src/solo/effects';
import {loadPreferences} from '../../src/settings/store';
vi.mock('../../src/settings/store',()=>({loadPreferences:vi.fn()}));
afterEach(()=>vi.unstubAllGlobals());
it('starts the audio context during the gesture rather than after preferences load',async()=>{
 let finish!:(value:any)=>void;let created=0;
 vi.mocked(loadPreferences).mockReturnValue(new Promise(resolve=>{finish=resolve;}));
 vi.stubGlobal('AudioContext',class {state='running';constructor(){created++;}async resume(){} });
 const effects=new SoloEffects();const enabling=effects.enable();
 expect(created).toBe(1);finish({voiceURI:null});await enabling;expect(effects.audioReady).toBe(true);
});
