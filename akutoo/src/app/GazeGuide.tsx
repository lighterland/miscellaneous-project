import type {GazeDirection} from '../analysis/gaze';
import {s} from '../i18n/strings.en';

// Screen-space targets, outside the face. Labels always use subject directions.
export function GazeGuide({target,completed,mirror,active,ready}:{target:GazeDirection;completed:string[];mirror:boolean;active:boolean;ready:boolean}) {
 const points={left:[mirror?8:92,50],right:[mirror?92:8,50],up:[50,12],down:[50,88]};
 return <div className="gaze-guide" role="group" aria-label={s.gazeGuide}>
  {(Object.entries(points) as [GazeDirection,number[]][]).map(([direction,[x,y]])=>{
   const saved=completed.includes(`gaze-${direction}`),selected=direction===target&&active&&!saved;
   return <span key={direction} className={`gaze-point${saved?' is-saved':''}${selected?' is-target':''}${selected&&ready?' is-ready':''}`} style={{left:`${x}%`,top:`${y}%`}} data-direction={direction} data-saved={saved} aria-label={s.gazePoint(direction,saved,selected)}>
    <svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17"/>{saved?<path d="m12 20 6 6 11-12"/>:<circle className="gaze-core" cx="20" cy="20" r={selected?7:3}/>}</svg>
   </span>;
  })}
 </div>;
}
