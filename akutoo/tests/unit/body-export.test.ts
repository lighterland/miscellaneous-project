import {expect,it} from 'vitest';
import {datasetMetadata,exportable,photoName} from '../../src/export/dataset';
import type {Photo,Session} from '../../src/storage/db';
import {freshBody} from '../../src/body/state';
it('keeps body files and instruction evidence separate from face pose/readiness',()=>{
    const session={id:'body-session',label:'Body',mode:'body',createdAt:1,updatedAt:1,body:freshBody()} as Session;
    const photo={id:'one',sessionId:session.id,width:1280,height:1920,shotId:'body-full-angle-back',body:{mode:'full',instruction:{id:'angle-back',kind:'angle',angle:'back'},labelSource:'instruction',reviewed:false},quality:{tier:'A',score:90,hardFailure:false},identityConfirmed:true,contentConfirmed:true} as Photo;
    expect(photoName(photo)).toBe('body/full/body-full-angle-back_one.jpg');expect(exportable([photo],'recommended')).toEqual([]);
    photo.body!.reviewed=true;expect(exportable([photo],'recommended')).toEqual([photo]);
    const metadata=datasetMetadata(session,[photo],'recommended');expect(metadata.readiness).toBeNull();expect(metadata.poseCoverage).toBeNull();expect(metadata.body?.mode).toBe('full');expect(metadata.images[0].body?.labelSource).toBe('instruction');expect(metadata.images[0].requestedPose.yaw).toBeNull();
    photo.override=true;expect(exportable([photo],'recommended')).toEqual([]);
});
