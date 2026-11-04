import type {ScanCue,ScanStatus} from '../session/guided-scan';
import type {Shot} from '../session/shotlist';
import type {CSSProperties} from 'react';
import {s} from '../i18n/strings.en';

// A moving pose diagram, not a simulated reading of the user's face.
export function ScanGuide({target,status,cue,mirror,active}:{target:Shot|undefined;status:ScanStatus;cue:ScanCue;mirror:boolean;active:boolean}) {
 const yaw=target?.yaw??0,pitch=target?.pitch??0;
 const x=Math.sin(yaw*Math.PI/180)*(mirror?1:-1)*33;
 const y=Math.sin(pitch*Math.PI/180)*32;
 const moving=active&&status==='turning'&&cue!=='front'&&cue!=='back';
 const arrowX=cue==='back'?-x:x,arrowPitch=cue==='back'?-pitch:pitch;
 const arrow=arrowX<0?'M65 22 H18 l9 -8 M18 22 l9 8':arrowX>0?'M115 22 H162 l-9 -8 M162 22 l-9 8':arrowPitch<0?'M156 110 V65 l-8 9 M156 65 l8 9':arrowPitch>0?'M156 65 V110 l-8 -9 M156 110 l8 -9':'';
 return <aside className="scan-example" data-motion={moving?'moving':'still'} data-state={active?status:'idle'} aria-label={s.scanExample}>
  <svg viewBox="0 0 180 200" role="img" aria-label={s.scanCues[cue]} style={{'--demo-x':`${x}px`,'--demo-y':`${y}px`,'--demo-scale':1-Math.abs(x)/140} as CSSProperties}>
   <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M28 190 Q30 163 68 158 L71 145 M152 190 Q150 163 112 158 L109 145"/>
    <ellipse className="demo-outline" cx="90" cy="96" rx="44" ry="60"/>
    <g className="demo-features"><path d={`M90 86 L${90+x*.6} 110 L${84+x*.4} 114 M77 131 Q90 137 103 131`}/><path d="M66 81 Q72 77 78 81 M102 81 Q108 77 114 81"/></g>
    {arrow&&<path className="demo-arrow" d={arrow}/>}
   </g>
  </svg>
  <span>{s.scanExample}</span>
 </aside>;
}
