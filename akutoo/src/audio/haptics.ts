export function haptic(kind:'saved'|'return',device:Pick<Navigator,'vibrate'>|Partial<Pick<Navigator,'vibrate'>>=navigator){
 try{device.vibrate?.(kind==='saved'?25:[35,70,35]);}catch{/* Audio and visible cues remain available. */}
}
