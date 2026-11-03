export interface GuidanceVoice {name:string;lang:string;voiceURI:string;localService:boolean;default:boolean;}
// Voice APIs expose names, not gender. These names are a best-effort preference.
export function chooseGuidanceVoice<T extends GuidanceVoice>(voices:readonly T[],uri:string|null=null):T|undefined {
 const english=voices.filter(voice=>/^en(?:[-_]|$)/i.test(voice.lang));const explicit=english.find(voice=>voice.voiceURI===uri);if(explicit)return explicit;
 const score=(voice:T)=>(voice.localService?100:0)+(/\b(samantha|karen|serena|moira|tessa|female|woman|zira|aria|jenny|sonia|libby|susan|ava|joanna|salli|kimberly|ivy|emma|amy|kendra|victoria|hazel)\b/i.test(voice.name)?40:0)+(/enhanced|premium|natural|neural/i.test(voice.name)?20:0)+(/^en-US$/i.test(voice.lang)?4:0)+(voice.default?1:0);
 return [...english].sort((a,b)=>score(b)-score(a))[0];
}
export function speakGuidance(text:string,uri:string|null=null){
 if(!('speechSynthesis'in window))return;try{speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(text),voice=chooseGuidanceVoice(speechSynthesis.getVoices(),uri);utterance.lang=voice?.lang??'en-US';if(voice)utterance.voice=voice;utterance.rate=.94;utterance.pitch=1;speechSynthesis.speak(utterance);}catch{/* Visible guidance remains available. */}
}
