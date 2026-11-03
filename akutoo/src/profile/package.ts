import {strToU8,zipSync} from 'fflate';
import type {Photo,Session} from '../storage/db';
import type {SavedProfile} from './store';
export async function promptPackage(saved:SavedProfile,photos:Photo[],sessions:Session[],sheets:Blob[]):Promise<Uint8Array>{
 if(!photos.length||photos.length>9||sheets.length!==Math.ceil(photos.length/6)||!saved.draft.master.trim())throw new Error('Package incomplete');
 const files:Record<string,Uint8Array>={};for(let i=0;i<sheets.length;i++){if(sheets[i].type!=='image/jpeg')throw new Error('Invalid contact sheet');files[`contact_sheet_${i+1}.jpg`]=new Uint8Array(await sheets[i].arrayBuffer());}
 const profile={schemaVersion:1,manual:saved.profile,provenance:'User-provided text; no image description was inferred by AI.',references:photos.map((photo,index)=>({number:index+1,photoId:photo.id,sessionId:photo.sessionId,mode:photo.body?'body':photo.hair?'hair':'face',pose:photo.pose??null,body:photo.body??null,hair:photo.hair??null})),supportingSessions:sessions.filter(session=>photos.some(photo=>photo.sessionId===session.id)).map(session=>({id:session.id,hair:session.hair??null,body:session.body??null}))};
 files['profile.json']=strToU8(JSON.stringify(profile,null,2));files['character_profile.md']=strToU8(saved.draft.character);files['prompt_master.txt']=strToU8(saved.draft.master);files['consistency_notes.md']=strToU8(saved.draft.consistency);if(saved.draft.scene.trim())files['scene_slots.md']=strToU8(saved.draft.scene);
 files['README.txt']=strToU8('Created entirely on this device. Contact sheets contain reviewed A/B references. Text is user-provided and editable, not AI vision analysis. Null means unmeasured. Body angles are instruction labels and proportions are estimates. Files have not been uploaded. Choose yourself where to use them. Keep original datasets as a separate backup.');return zipSync(files,{level:0});
}
