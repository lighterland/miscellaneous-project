import { angles, type Angle, type Assistance } from '../solo/round';
export type HairStyle='down'|'high-ponytail'|'low-ponytail'|'bun'|'half-up'|'braid';
export interface HairShot { id:string; kind:'angle'|'crown'|'silhouette'|'texture'|'length'|'tie'; region:string; angle?:Angle; requiresSupport:boolean; optional?:boolean; }
export function hairShots(style:HairStyle, length=false):HairShot[] {
  return [
    ...angles.map(angle=>({id:`angle-${angle}`,kind:'angle' as const,region:'head',angle,requiresSupport:angle!=='front'})),
    {id:'crown',kind:'crown',region:'crown',requiresSupport:true},
    ...(['front','back'] as const).map(angle=>({id:`silhouette-${angle}`,kind:'silhouette' as const,region:'silhouette',angle,requiresSupport:true})),
    ...['roots','middle','ends'].map(region=>({id:`texture-${region}`,kind:'texture' as const,region,requiresSupport:false})),
    ...(style==='down'?[]:[{id:'tie-point',kind:'tie' as const,region:'tie',requiresSupport:true},{id:'tie-ends',kind:'tie' as const,region:'ends',requiresSupport:true}]),
    ...(length?[{id:'length',kind:'length' as const,region:'length',requiresSupport:true,optional:true}]:[]),
  ];
}
export function permittedHairShots(style:HairStyle, assistance:Assistance, length=false):HairShot[] { return hairShots(style,length).filter(shot=>assistance!=='handheld'||!shot.requiresSupport); }
export interface DetailShot { id:string; region:'face'|'eyes'|'lips'|'nose'|'ear'|'hairline'|'jaw'|'mark'|'beard'; side?:'left'|'right'|'front'|'under'|'side'; variant?:'closed'|'teeth'|'first'|'second'; optional?:boolean; }
export function detailShots(options:{marks?:boolean;beard?:boolean}={}):DetailShot[] {
  return [
    {id:'detail-front',region:'face',side:'front'},
    ...(['left','right'] as const).map(side=>({id:`detail-eye-${side}`,region:'eyes' as const,side})),
    ...(['closed','teeth'] as const).map(variant=>({id:`detail-lips-${variant}`,region:'lips' as const,variant})),
    ...(['under','side'] as const).map(side=>({id:`detail-nose-${side}`,region:'nose' as const,side})),
    ...(['left','right'] as const).map(side=>({id:`detail-ear-${side}`,region:'ear' as const,side})),
    {id:'detail-hairline',region:'hairline',side:'front'}, {id:'detail-jaw',region:'jaw',side:'side'},
    ...(options.marks?(['first','second'] as const).map(variant=>({id:`detail-mark-${variant}`,region:'mark' as const,variant,optional:true})):[]),
    ...(options.beard?(['front','side'] as const).map(side=>({id:`detail-beard-${side}`,region:'beard' as const,side,optional:true})):[]),
  ];
}
