import {expect,it} from 'vitest';
import {chooseGuidanceVoice} from '../../src/audio/guidance';
const voice=(name:string,localService=true,lang='en-US')=>({name,localService,lang,voiceURI:name,default:false});
it('prefers an identifiable female local voice and honors an available explicit choice',()=>{const list=[voice('David'),voice('Samantha Enhanced'),voice('Jenny Natural',false)];expect(chooseGuidanceVoice(list)?.name).toBe('Samantha Enhanced');expect(chooseGuidanceVoice(list,'David')?.name).toBe('David');});
it('handles late or missing voices without inventing gender or a nonexistent selected voice',()=>{expect(chooseGuidanceVoice([])).toBeUndefined();expect(chooseGuidanceVoice([voice('French',true,'fr-FR')])).toBeUndefined();expect(chooseGuidanceVoice([voice('English local')],'missing')?.name).toBe('English local');});
