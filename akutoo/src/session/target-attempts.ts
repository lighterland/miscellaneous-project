export interface TargetAttempts {attempts?:Record<string,number>;revisited?:Record<string,boolean>;}
export function targetAttemptState(set:TargetAttempts,id:string){const exhausted=(set.attempts?.[id]??0)>=3;return {exhausted,canRevisit:exhausted&&!set.revisited?.[id]};}
export function revisitTarget<T extends TargetAttempts>(set:T,id:string):T {
    if(!targetAttemptState(set,id).canRevisit)throw new Error('Target cannot be revisited');
    return {...set,attempts:{...set.attempts,[id]:0},revisited:{...set.revisited,[id]:true}};
}
