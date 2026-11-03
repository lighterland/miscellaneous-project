import {unzipSync,strFromU8} from 'fflate';
import {promptPackage} from '../../src/profile/package';
import {expect,it} from 'vitest';
import {physicalProfile,profileFields,profileDraft} from '../../src/profile/model';
import {contactPhotos} from '../../src/profile/contact';
import type {Photo} from '../../src/storage/db';
it('keeps all manual profile fields optional, bounded and explicitly user supplied',()=>{
 const p=physicalProfile({units:'imperial',values:{height:'72',weight:'180',eyes:' Brown ',unknown:'invented'}});
 expect(p.units).toBe('imperial');expect(p.source).toBe('user');expect(p.values).toEqual({height:'72',weight:'180',eyes:'Brown'});expect(physicalProfile(null).values).toEqual({});
 expect(()=>physicalProfile({values:{height:'-1'}})).toThrow();expect(()=>physicalProfile({values:{notes:'x'.repeat(2001)}})).toThrow();
 expect(profileFields.map(f=>f.id)).toContain('tiedBehavior');
});
it('drafts only supplied descriptions and preserves unknown measurements as absent',()=>{
 const p=physicalProfile({values:{eyes:'brown',distinctiveMarks:'Small mole on left cheek'}}),d=profileDraft(p);
 expect(d.character).toContain('brown');expect(d.character).toContain('Small mole on left cheek');expect(d.master).not.toContain('athletic');expect(d.master).not.toContain('Height:');expect(d.consistency).toContain('Small mole on left cheek');expect(d.scene).toContain('{scene}');expect(profileDraft(physicalProfile(null)).master).toBe('');
});
const photo=(id:string,pose:number):Photo=>({id,sessionId:'s',width:1280,height:1920,createdAt:1,opfsPath:id,quality:{tier:'A',score:90,hardFailure:false,reason:null},measurements:{occlusionVerified:true},pose:{yaw:pose,pitch:0,roll:0}} as Photo);
it('chooses bounded reviewed contact references with measured face-view variety, never risky evidence',()=>{
 const photos=[photo('front',0),photo('quarter',45),photo('profile',85),...Array.from({length:12},(_,i)=>photo('extra'+i,0))];photos[0].quality!.score=100;
 const risky=photo('risky',-45);risky.override=true;const unreviewed=photo('unreviewed',-85);unreviewed.measurements!.occlusionVerified=false;
 const chosen=contactPhotos([...photos,risky,unreviewed]);expect(chosen).toHaveLength(9);expect(chosen.slice(0,3).map(p=>p.id)).toEqual(['front','quarter','profile']);expect(new Set(chosen.map(p=>p.id)).size).toBe(9);expect(chosen.some(p=>p.override||p.id==='unreviewed')).toBe(false);expect(contactPhotos([])).toEqual([]);
});

it('packages editable English blocks, user provenance and bounded local sheet references',async()=>{
 const p=physicalProfile({values:{eyes:'brown'}}),draft=profileDraft(p),saved={revision:1,profile:p,draft};
 const archive=unzipSync(await promptPackage(saved,[photo('one',0)],[],[new Blob(['synthetic'],{type:'image/jpeg'})]));
 expect(Object.keys(archive)).toContain('contact_sheet_1.jpg');expect(strFromU8(archive['prompt_master.txt'])).toBe(draft.master);expect(JSON.parse(strFromU8(archive['profile.json'])).manual.source).toBe('user');
 await expect(promptPackage(saved,[],[],[])).rejects.toThrow();await expect(promptPackage({...saved,draft:{...draft,master:''}},[photo('one',0)],[],[new Blob([],{type:'image/jpeg'})])).rejects.toThrow();
});

it('does not give an unmeasured face priority as a measured profile view',()=>{
 const unknown=photo('unknown',NaN),side=photo('side',85);unknown.quality!.score=100;
 expect(contactPhotos([unknown,side])[0].id).toBe('side');
});
