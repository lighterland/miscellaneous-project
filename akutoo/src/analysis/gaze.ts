export type GazeDirection = 'left' | 'right' | 'up' | 'down';
const pairs:Record<GazeDirection,[string,string]>={
 left:['eyeLookOutLeft','eyeLookInRight'],right:['eyeLookInLeft','eyeLookOutRight'],
 up:['eyeLookUpLeft','eyeLookUpRight'],down:['eyeLookDownLeft','eyeLookDownRight'],
};
// Subject-relative blendshapes. Provisional gesture confidence, not a photo quality gate.
// Missing, blinking or conflicting eyes never become measured direction evidence.
export function measuredGaze(values:Record<string,number>):GazeDirection|null {
 const names=[...Object.values(pairs).flat(),'eyeBlinkLeft','eyeBlinkRight'];
 if(names.some(key=>!Number.isFinite(values[key])||values[key]<0||values[key]>1))return null;
 if(Math.max(values.eyeBlinkLeft,values.eyeBlinkRight)>=.5)return null;
 const ranked=(Object.entries(pairs) as [GazeDirection,[string,string]][])
  .map(([direction,keys])=>({direction,score:Math.min(...keys.map(key=>values[key]))}))
  .sort((a,b)=>b.score-a.score);
 return ranked[0].score>=.35&&ranked[0].score-ranked[1].score>=.15?ranked[0].direction:null;
}
