import {expect,it} from 'vitest';
import {exportable,photoName,datasetMetadata} from '../../src/export/dataset';
import {freshHair} from '../../src/hair/state';
import type {Photo,Session} from '../../src/storage/db';
it('keeps unreviewed hair out of Recommended and exports instruction provenance without claiming face readiness',()=>{
  const session:Session={id:'s',mode:'hair',hair:freshHair(),label:'Hair',createdAt:1,updatedAt:1,preset:'general',stage:1,status:'review'};
  const photo:Photo={id:'p',sessionId:'s',opfsPath:'photo',width:2000,height:3000,createdAt:1,shotId:'hair-down-angle-back',quality:{tier:'A',score:90,hardFailure:false,reason:null},hair:{style:'down',shotId:'angle-back',kind:'angle',region:'head',angle:'back',labelSource:'instruction',reviewed:false,visibleFaces:0,baseline:{sharpness:100,exposure:100},analysis:{targetArea:.5,bounds:{x:0,y:0,width:1,height:1},sharpness:100,exposure:100,brightClipped:0,clipped:0,swatch:'#332211',personCount:null,occlusionVerified:false,sourceDimensions:{width:2000,height:3000},durationMs:1}}};
  expect(exportable([photo],'recommended')).toEqual([]);
  const reviewed={...photo,identityConfirmed:true,contentConfirmed:true,hair:{...photo.hair!,reviewed:true}};expect(exportable([reviewed],'recommended')).toHaveLength(1);expect(photoName(reviewed)).toMatch(/^hair\/down\//);
  const meta=datasetMetadata(session,[reviewed],'recommended');expect(meta.readiness).toBeNull();expect(meta.poseCoverage).toBeNull();expect(meta.images[0].hair?.labelSource).toBe('instruction');expect(meta.images[0].hair?.analysis.personCount).toBeNull();expect(meta.images[0].pose).toBeNull();
});
