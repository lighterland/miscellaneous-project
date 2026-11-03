import type {Photo} from '../storage/db';
import {exportable} from '../export/dataset';
function category(p:Photo):string {
 if(p.body)return `body-${p.body.mode}`;
 if(p.hair)return `hair-${p.hair.style}`;
 if(p.detail)return 'detail';
 if(!p.pose||![p.pose.yaw,p.pose.pitch,p.pose.roll].every(Number.isFinite))return 'face-unmeasured';
 const yaw=Math.abs(p.pose.yaw);return yaw<22.5?'face-front':yaw<67.5?'face-quarter':'face-profile';
}
export function contactPhotos(photos:Photo[]):Photo[]{
 const groups=new Map<string,Photo[]>();for(const photo of photos)groups.set(photo.sessionId,[...(groups.get(photo.sessionId)??[]),photo]);
 const eligible=[...groups.values()].flatMap(group=>exportable(group,'recommended')).sort((a,b)=>(b.quality?.score??0)-(a.quality?.score??0)||a.createdAt-b.createdAt||a.id.localeCompare(b.id));
 const selected:Photo[]=[],ids=new Set<string>(),categories=new Set<string>();
 const order=['face-front','face-quarter','face-profile','body-half','body-full','hair-down','hair-ponytail','hair-bun','detail','face-unmeasured'];
 for(const kind of [...order,...eligible.map(category)]){if(categories.has(kind))continue;const photo=eligible.find(p=>category(p)===kind&&!ids.has(p.id));if(!photo)continue;selected.push(photo);ids.add(photo.id);categories.add(kind);if(selected.length===9)return selected;}
 for(const photo of eligible){if(ids.has(photo.id))continue;selected.push(photo);ids.add(photo.id);if(selected.length===9)break;}
 return selected;
}
