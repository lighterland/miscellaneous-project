import {angles,type Angle} from '../solo/round';
export type BodyMode='half'|'full';
export interface BodyShot {id:string;kind:'angle'|'pose'|'outfit'|'proportion'|'detail';angle?:Angle;optional?:boolean;}
export function bodyShots(mode:BodyMode,details=false):BodyShot[] {
    const common:BodyShot[]=angles.map(angle=>({id:`angle-${angle}`,kind:'angle',angle}));
    const extras=mode==='half'?['hands-hips','arms-crossed','hand-chin','sitting-front','sitting-side']:['walking','sitting','low-camera','high-camera'];
    return [...common,...extras.map(id=>({id,kind:'pose' as const})),
        ...['formal','outerwear'].map(id=>({id:`outfit-${id}`,kind:'outfit' as const})),
        ...(mode==='full'?(['front','left','back'] as const).map(angle=>({id:`neutral-${angle}`,kind:'proportion' as const,angle})):[]),
        ...(details?['hands','feet'].map(id=>({id:`detail-${id}`,kind:'detail' as const,optional:true})):[]),
    ];
}
