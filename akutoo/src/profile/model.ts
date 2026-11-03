import {s} from '../i18n/strings.en';
export const profileFields = [
 {id:'height',group:'body',numeric:true},
 {id:'weight',group:'body',numeric:true},
 {id:'apparentAge',group:'general',numeric:false},
 {id:'build',group:'body',numeric:false},
 {id:'posture',group:'body',numeric:false},
 {id:'shoulderWidth',group:'body',numeric:true},
 {id:'chest',group:'body',numeric:true},
 {id:'waist',group:'body',numeric:true},
 {id:'hips',group:'body',numeric:true},
 {id:'inseam',group:'body',numeric:true},
 {id:'shoeSize',group:'body',numeric:false},
 {id:'faceShape',group:'face',numeric:false},
 {id:'eyes',group:'face',numeric:false},
 {id:'eyebrows',group:'face',numeric:false},
 {id:'nose',group:'face',numeric:false},
 {id:'lipsTeeth',group:'face',numeric:false},
 {id:'jawChin',group:'face',numeric:false},
 {id:'ears',group:'face',numeric:false},
 {id:'eyelashes',group:'face',numeric:false},
 {id:'skin',group:'face',numeric:false},
 {id:'hairPattern',group:'hair',numeric:false},
 {id:'hairStrands',group:'hair',numeric:false},
 {id:'hairDensity',group:'hair',numeric:false},
 {id:'hairShineFrizz',group:'hair',numeric:false},
 {id:'hairColor',group:'hair',numeric:false},
 {id:'hairTreatment',group:'hair',numeric:false},
 {id:'naturalLength',group:'hair',numeric:false},
 {id:'stretchedLength',group:'hair',numeric:false},
 {id:'hairShape',group:'hair',numeric:false},
 {id:'downBehavior',group:'hair',numeric:false},
 {id:'tiedBehavior',group:'hair',numeric:false},
 {id:'facialHair',group:'hair',numeric:false},
 {id:'distinctiveMarks',group:'general',numeric:false},
 {id:'notes',group:'general',numeric:false},
] as const;
export type ProfileKey=typeof profileFields[number]['id'];
export interface PhysicalProfile {version:1;source:'user';units:'metric'|'imperial';values:Partial<Record<ProfileKey,string>>;}
export interface ProfileDraft {character:string;master:string;scene:string;consistency:string;}
export function physicalProfile(raw:unknown):PhysicalProfile {
 const input=raw&&typeof raw==='object'?raw as Partial<PhysicalProfile>:{},values:PhysicalProfile['values']={};
 for(const field of profileFields){const value=input.values?.[field.id];if(typeof value!=='string'||!value.trim())continue;const text=value.trim();if(text.length>2000||field.numeric&&(!Number.isFinite(Number(text))||Number(text)<=0))throw new Error('Invalid profile field');values[field.id]=text;}
 return {version:1,source:'user',units:input.units==='imperial'?'imperial':'metric',values};
}
export function profileDraft(profile:PhysicalProfile):ProfileDraft {
 const lines=profileFields.flatMap(field=>{const value=profile.values[field.id];if(!value)return [];const unit=field.numeric?(field.id==='weight'?(profile.units==='metric'?' kg':' lb'):(profile.units==='metric'?' cm':' in')):'';return [`${s.profileLabels[field.id]}: ${value}${unit}`];});
 return {character:lines.length?`# Character profile\n\nUser-provided description. Unlisted attributes are unspecified.\n\n${lines.join('\n')}`:'',master:lines.length?`Use the accompanying reference photos for this person's visible identity. User-provided description: ${lines.join('; ')}. Preserve the reference appearance; leave unspecified attributes to the references.`:'',scene:'Scene: {scene}. Outfit: {outfit}. Pose: {pose}. Lighting: {lighting}.',consistency:profile.values.distinctiveMarks?`Preserve these user-provided details: ${profile.values.distinctiveMarks}`:''};
}
