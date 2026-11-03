// Seven seconds to turn, then one full second to settle before the burst.
export function handsFreeStep(started:number,now:number):{remaining:number;capture:boolean} {
 const elapsed=Math.max(0,now-started);
 return {remaining:Math.max(0,7-Math.floor(elapsed/1000)),capture:elapsed>=8000};
}
