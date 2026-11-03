import {useEffect,useState} from 'react';
import {chooseGuidanceVoice,speakGuidance} from '../audio/guidance';
import {s} from '../i18n/strings.en';
export function GuidanceVoicePicker({value,onChange,disabled}:{value:string|null;onChange:(uri:string|null)=>void;disabled:boolean}){
 const [voices,setVoices]=useState<SpeechSynthesisVoice[]>([]);
 useEffect(()=>{if(!('speechSynthesis'in window))return;const refresh=()=>setVoices(speechSynthesis.getVoices().filter(voice=>/^en(?:[-_]|$)/i.test(voice.lang)));refresh();speechSynthesis.addEventListener('voiceschanged',refresh);return()=>speechSynthesis.removeEventListener('voiceschanged',refresh);},[]);
 const selected=chooseGuidanceVoice(voices,value);
 return <div className="guidance-voice"><label className="field">{s.guidanceVoice}<select value={value??''} disabled={disabled} onChange={event=>onChange(event.target.value||null)}><option value="">{s.voiceAutomatic}</option>{value&&!voices.some(voice=>voice.voiceURI===value)&&<option value={value}>{s.voiceSystem}</option>}{voices.map(voice=><option key={voice.voiceURI} value={voice.voiceURI}>{voice.name} / {voice.lang} / {voice.localService?s.voiceDevice:s.voiceNetwork}</option>)}</select></label><p>{s.voiceChoiceHelp}</p><p>{s.voiceSelected(selected?.name??s.voiceSystem)}</p><button className="secondary" disabled={disabled} onClick={()=>speakGuidance(s.audioSentence,value)}>{s.voicePreview}</button></div>;
}
