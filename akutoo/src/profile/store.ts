import {db} from '../storage/db';
import {storageLock} from '../storage/lock';
import {deletionPending} from '../storage/deletion';
import {physicalProfile,type PhysicalProfile,type ProfileDraft} from './model';
export interface SavedProfile {revision:number;profile:PhysicalProfile;draft:ProfileDraft;}
const empty:ProfileDraft={character:'',master:'',scene:'',consistency:''};
export async function loadProfile():Promise<SavedProfile>{const raw=(await db.settings.get('physical-profile'))?.value as Partial<SavedProfile>|undefined;return {revision:raw?.revision??0,profile:physicalProfile(raw?.profile),draft:{...empty,...raw?.draft}};}
export async function saveProfile(value:SavedProfile):Promise<SavedProfile>{return storageLock(async()=>{if(await deletionPending())throw new Error('Deletion pending');const previous=await loadProfile();if(previous.revision!==value.revision)throw new Error('Profile changed');const draft={...value.draft};for(const text of Object.values(draft))if(typeof text!=='string'||text.length>20000)throw new Error('Invalid draft');const next={revision:previous.revision+1,profile:physicalProfile(value.profile),draft};await db.settings.put({key:'physical-profile',value:next});return next;});}
