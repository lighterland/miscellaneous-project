import {sweepActive} from '../session/free-sweep';
import {SoloEffects} from '../solo/effects';
import {PoseGuide} from './PoseGuide';
import {speechDelay} from '../capture/pose-guidance';
import {speakGuidance} from '../audio/guidance';
import { useEffect, useRef, useState } from 'react';
import { CaptureController, type CaptureState } from '../capture/controller';
import { poseBins } from '../session/coverage';
import type { Session } from '../storage/db';
import { putSession } from '../storage/sessions';
import { s } from '../i18n/strings.en';
import { SessionConflict } from '../storage/recovery-plan';
import { loadPreferences, savePreferences } from '../settings/store';
import { capturePlan, captureProgress, detailGuide } from '../details/plan';

export function CaptureScreen({ session, onLeave }: { session: Session; onLeave: () => void }) {
  const video = useRef<HTMLVideoElement>(null), controller = useRef<CaptureController | null>(null);
  const effects=useRef(new SoloEffects());
  const previousCaptures=useRef(session.stats?.captures??0);
  useEffect(()=>()=>effects.current.close(),[]);
  const [state, setState] = useState<CaptureState | null>(null);
  const [camera, setCamera] = useState<'user' | 'environment'>(session.camera ?? 'user');
  const [voiceURI,setVoiceURI]=useState<string|null>(null);
  const [reason, setReason] = useState('later'), [voice, setVoice] = useState(false);
  const [leaveError, setLeaveError] = useState('');
  const [voiceReady, setVoiceReady] = useState(false), [voiceSaving, setVoiceSaving] = useState(false);
  useEffect(() => { let active = true; void loadPreferences().then(value => { if (active) {setVoice(value.voice);setVoiceURI(value.voiceURI);} }).catch(() => { if (active) setLeaveError(s.settingsLoadError); }).finally(() => { if (active) setVoiceReady(true); }); return () => { active = false; }; }, []);
  async function toggleVoice() {
    if (!voiceReady || voiceSaving) return; const next = !voice; setVoiceSaving(true); setVoice(next);
    try { await savePreferences({ voice: next }); } catch { setVoice(!next); setLeaveError(s.settingsSaveError); } finally { setVoiceSaving(false); }
  }
  useEffect(() => {
    const value = new CaptureController(video.current!, session, setState); controller.current = value; setState({ ...value.state });
    const hidden = () => { if (document.hidden) { value.interrupt(); if ('speechSynthesis' in window) speechSynthesis.cancel(); } };
    const leaving = () => value.interrupt();
    document.addEventListener('visibilitychange', hidden); window.addEventListener('pagehide', leaving);
    return () => { document.removeEventListener('visibilitychange', hidden); window.removeEventListener('pagehide', leaving); value.dispose(); if ('speechSynthesis' in window) speechSynthesis.cancel(); };
  }, [session.id]);
  const plan = capturePlan(state?.session ?? session), p = state ? captureProgress(state.session) : undefined, shot = state?.retakeFinished ? undefined : state?.session.retakeShotId ? plan.find(shot => shot.id === state.session.retakeShotId) : p ? plan[p.index] : undefined;
  const detail = !!state?.session.details?.active, baseline = detail ? state?.session.details?.baseline : state?.session.baseline;
  const guide = shot?.detail ? detailGuide(shot.detail) : null;
  const sourceRatio = (state?.session.stream?.width ?? 3) / (state?.session.stream?.height ?? 4);
  const instruction = shot ? s.shotInstruction(shot) : s.sessionComplete;
  const lastSpoken=useRef(-Infinity), lastShot=useRef('');
  const correction=state?.poseCue && state.poseCue!=='manual' ? state.poseCue==='expression' ? instruction : state.poseCue in s.fix ? s.fix[state.poseCue as keyof typeof s.fix] : s.poseCues[state.poseCue as keyof typeof s.poseCues] : null;
  const spoken=baseline&&correction?correction:instruction;
  useEffect(() => {
    if(!voice){if('speechSynthesis' in window)speechSynthesis.cancel();return;}
    if(state?.countdown!==null&&state?.countdown!==undefined||state?.handsFreeReturning)return;
    if(!voice||!state?.running||state.paused||state.busy||state.pending||state.loading||state.modelFailed||!('speechSynthesis' in window)) {
      if('speechSynthesis' in window) speechSynthesis.cancel();
      return;
    }
    const changed=lastShot.current!==shot?.id;
    const timer=window.setTimeout(()=>{
      speakGuidance(changed&&spoken!==instruction?`${instruction} ${spoken}`:spoken,voiceURI);
      lastSpoken.current=performance.now();lastShot.current=shot?.id??'';
    },changed?350:speechDelay(performance.now(),lastSpoken.current));
    return ()=>window.clearTimeout(timer);
  },[spoken,instruction,shot?.id,voice,voiceURI,state?.running,state?.paused,state?.busy,state?.pending,state?.loading,state?.modelFailed,state?.countdown,state?.handsFreeReturning]);
  useEffect(()=>{
    const count=state?.session.stats?.captures??0;
    if(count>previousCaptures.current)effects.current.tone('capture');
    previousCaptures.current=count;
  },[state?.session.stats?.captures]);
  useEffect(()=>{
    if(!voice)return;
    const count=state?.countdown;
    if(state?.handsFreeReturning){speakGuidance(s.handsFreeReturn,voiceURI);}
    else if(count===7)speakGuidance(s.handsFreeTurn(shot?.yaw??0),voiceURI);
    else if(count===3||count===2||count===1)speakGuidance(String(count),voiceURI);
    else if(count===0){speakGuidance(s.handsFreeHold,voiceURI);effects.current.tone('hold');}
  },[state?.countdown,state?.handsFreeReturning,voice,voiceURI]);
  const counting=state?.countdown!==null&&state?.countdown!==undefined;
  const sweeping=!!p&&sweepActive(p)&&!detail&&!state?.session.retakePhotoId;
  async function handsFree(yaw?:-90|90){if(!voiceReady)return;window.scrollTo({top:0,behavior:'auto'});setVoice(true);void effects.current.enable();await controller.current?.startHandsFree(yaw);}
  const busy = state?.busy || state?.loading;
  async function leave() {
    if (busy) return;
    controller.current?.stop();
    try { if (state) await putSession({ ...state.session, status: 'review', updatedAt: Date.now() }); onLeave(); }
    catch (error) { if (error instanceof SessionConflict) onLeave(); else setLeaveError(s.saveError); }
  }
  const fixing = !!p?.attempts.sessionFix;
  const autoReady=!!state?.autoReady&&!counting&&!busy&&!state.paused&&!state.modelFailed&&!shot?.manual;
  const autoLabel=counting?(state?.countdown===0?s.handsFreeHold:s.handsFreeCount(state?.countdown??0)):state?.busy?s.autoSaving:state?.loading?s.autoPreparing:state?.modelFailed?s.autoUnavailable:state?.paused?s.autoPaused:shot?.manual?s.autoManual:!baseline?s.autoCalibrating:autoReady?s.autoReady:s.autoAlign;
  const feedback = counting?(state?.countdown===0?s.handsFreeHold:s.handsFreeAway):state?.handsFreeReturning?s.handsFreeReturnHelp:state?.message === s.cameraInterrupted ? s.cameraInterrupted : state?.paused ? s.paused : state?.message && (state.loading || state.modelFailed || !baseline || state.quality?.hardFailure) ? state.message : correction??instruction;
  return <main className={fixing ? 'capture-screen fix-screen' : `capture-screen${shot&&!detail&&shot.stage<=2?' has-pose-guide':''}`}>
    <div className={fixing ? 'scan-layout is-hidden' : 'scan-layout'} inert={fixing}>
    <header className="capture-header"><button className="quiet" onClick={() => void leave()} disabled={!!busy}>{s.finish}</button><span>{p ? s.progress(p.completed.length, plan.length) : s.setupTitle}</span></header>
    <div className="capture-heading">{!detail && <p>{shot ? s.stage(shot.stage) : s.sessionComplete}</p>}<h1>{sweeping?s.freeSweepTitle:shot ? s.stageNames[shot.stage - 1] : s.sessionComplete}</h1></div>
    <div className={`${state?.pending?'is-hidden ':''}${counting?'is-counting ':''}${detail?'camera-frame detail-camera':'camera-frame'}`} style={detail ? { aspectRatio: `${sourceRatio}`, width: `min(100%, 400px, ${38 * sourceRatio}svh)` } : undefined}>
      <video ref={video} autoPlay muted playsInline className={state?.camera === 'user' ? 'mirror' : ''} />
      {guide ? <div className="detail-guide" role="img" aria-label={s.detailGuide} style={{ left: `${guide.x * 100}%`, top: `${guide.y * 100}%`, width: `${guide.width * 100}%`, height: `${guide.height * 100}%` }}/> : <svg className="scan-ring" viewBox="0 0 300 400" role="img" aria-label={s.coverageCount(state?.coveredBins.length ?? 0, poseBins.length)}>{poseBins.map((bin, segment) => {
        const complete = state?.coveredBins.includes(bin);
        const a = segment / poseBins.length * Math.PI * 2 - Math.PI / 2, b = (segment + .78) / poseBins.length * Math.PI * 2 - Math.PI / 2;
        return <path key={bin} data-pose-bin={bin} d={`M ${150 + 120 * Math.cos(a)} ${200 + 170 * Math.sin(a)} A 120 170 0 0 1 ${150 + 120 * Math.cos(b)} ${200 + 170 * Math.sin(b)}`} className={complete ? 'complete' : ''} />;
      })}</svg>}
      {shot&&!detail&&shot.stage<=2&&<PoseGuide shot={shot} pose={state?.running&&!state.paused?state.result?.pose??null:null} ready={autoReady} mirror={state?.camera==='user'}/>}
      {counting&&<div className="handsfree-countdown" data-hold={state?.countdown===0?'true':'false'} role="status"><strong>{state?.countdown||s.handsFreeHoldLabel}</strong><p>{state?.countdown===0?s.handsFreeHold:s.handsFreePose(shot?.yaw??0)}</p></div>}
      {!state?.running && <div className="camera-placeholder"><p>{s.scanIntro}</p></div>}
    </div>
    <section className="capture-controls">
      {state?.running&&!state.pending&&<div className={autoReady?'auto-status is-ready':'auto-status'} data-ready={autoReady?'true':'false'}><p role="status">{autoLabel}</p>{!counting&&!shot?.manual&&!state.modelFailed&&baseline&&<div role="progressbar" aria-label={s.autoHoldProgress} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((state.holdProgress??0)*100)} className="auto-hold"><span style={{width:`${Math.round((state.holdProgress??0)*100)}%`}}/></div>}</div>}
      {detail && shot && <p className="instruction">{instruction}</p>}
      {(!detail || feedback !== instruction) && <p className={detail ? 'capture-note' : 'instruction'} aria-live="polite">{feedback}</p>}
      {detail && <details className="detail-tips"><summary>{s.detailPhotoTips}</summary><p className="capture-note">{s.detailHelp}</p></details>}
      {state?.running && !state.pending && !baseline && !state.modelFailed && <p role="status">{s.calibrationTime(state.seconds)}</p>}
      {!counting&&!state?.paused&&!state?.pending&&shot&&!shot.manual&&!detail&&shot.stage<=2&&<p className="capture-note">{s.poseFollow}</p>}
      {!state?.running && shot && <><label className="field">{s.camera}<select value={camera} onChange={event => setCamera(event.target.value as typeof camera)} disabled={!!busy}><option value="user">{s.front}</option><option value="environment">{s.rear}</option></select></label><button className="primary" disabled={!!busy} onClick={() => {void effects.current.enable();void controller.current?.start(camera);}}>{state?.loading ? s.cameraLoading : s.startCamera}</button></>}
      {state?.running && <>
        {!state.pending&&<div className="capture-actions"><button className="quiet" onClick={() => controller.current?.pause()} disabled={!!busy}>{state.paused ? s.resume : s.pause}</button>{counting?<button className="quiet" disabled={!!busy} onClick={()=>{controller.current?.cancelCountdown();controller.current?.pause();}}>{s.handsFreeCancel}</button>:<button className="shutter" aria-label={s.capture} onClick={() => void controller.current?.capture()} disabled={!!busy || !!state.pending || counting}><span /></button>}<button className="quiet" disabled={!voiceReady || voiceSaving} onClick={() => void toggleVoice()}>{voice ? s.voiceOn : s.voiceOff}</button></div>}
      {sweeping&&state?.running&&!state.pending&&!counting&&<p className="sweep-instruction">{s.freeSweepHelp}<span>{s.sweepProgress(state.coveredBins.length)}</span></p>}
        {!state.pending&&<p className="capture-note">{s.reviewNeeded}</p>}
        {busy && <p role="status">{s.saving}</p>}
        {shot?.manual && <p>{s.manualHint}</p>}
        {!state.pending&&!counting&&!state.paused&&!detail&&shot&&<section className="handsfree-tools">
          {sweeping?<><div className="handsfree-buttons"><button className="quiet" disabled={!!busy||!voiceReady||(!baseline&&!state.modelFailed)||p?.completed.includes('turn--90')||p?.missed.includes('turn--90')} onClick={()=>void handsFree(-90)}>{s.handsFreeLeft}</button><button className="quiet" disabled={!!busy||!voiceReady||(!baseline&&!state.modelFailed)||p?.completed.includes('turn-90')||p?.missed.includes('turn-90')} onClick={()=>void handsFree(90)}>{s.handsFreeRight}</button></div><p className="capture-note">{s.handsFreeHelp}</p><button className="quiet" disabled={!!busy} onClick={()=>void controller.current?.finishFreeSweep()}>{s.freeSweepContinue}</button><p className="capture-note">{s.freeSweepLater}</p></>:<button className="quiet" disabled={!!busy||!voiceReady||(!baseline&&!state.modelFailed)} onClick={()=>void handsFree()}>{s.handsFreeStart}</button>}
        </section>}
        {p&&!p.freeSweep&&shot&&shot.stage<=2&&!state.pending&&!detail&&!state.session.retakePhotoId&&<button className="quiet" disabled={!!busy} onClick={()=>void controller.current?.enableFreeSweep()}>{s.freeSweepEnable}</button>}

        {!counting&&!state.pending&&shot&&!shot.manual&&<p className="capture-note">{s.poseFallback}</p>}
        {!state.pending && !p?.attempts.sessionFix && <div className="skip-controls"><label className="field">{s.skipReason}<select value={reason} onChange={event => setReason(event.target.value)}>{Object.entries(s.skipOptions).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><button className="quiet" disabled={!!busy||counting} onClick={() => void controller.current?.skip(reason)}>{s.nextPose}</button></div>}
      </>}
      {state?.pending && <section className="pending-photo"><h2>{s.pendingTitle}</h2><img src={state.pending.url} alt={s.pendingTitle}/><p>{state.message}</p><p>{s.pendingHelp}</p><button className="primary" disabled={!!busy} onClick={() => void controller.current?.keepAnyway()}>{s.keepAnyway}</button><button className="quiet" disabled={!!busy} onClick={() => void controller.current?.retryCapture()}>{p?.attempts.promptRetake === false || p?.attempts.moveOn ? s.skip : s.discard}</button></section>}
      {!shot && state && <section><p>{s.sessionCompleteHelp}</p>{p && !p.revisiting && p.missed.length > 0 && <button className="primary" onClick={() => void controller.current?.revisit()}>{s.revisit}</button>}<button className="quiet" onClick={() => void leave()}>{s.review}</button></section>}
      {p?.attempts.offerFinish && <p>{s.longSession}</p>}
      {state?.message === s.cameraError || state?.message === s.saveError || state?.message === s.sessionChanged ? <p role="alert">{state.message}</p> : null}
      {leaveError && <p role="alert">{leaveError}</p>}
      {state?.message === s.earlierKept && <p role="status">{s.earlierKept}</p>}
    </section>
    </div>
    {fixing && state && <section className="session-fix" role="alert"><h1>{s.sessionFixTitle}</h1><p>{state.message}</p><p>{s.safePhotos(p?.savedIds.length ?? 0)}</p><button className="primary" disabled={!!busy} onClick={() => void controller.current?.checkAgain()}>{s.checkAgain}</button><button className="quiet" disabled={!!busy} onClick={() => void controller.current?.skip('failed')}>{s.keepGoing}</button>{state.pending && <><p className="capture-note">{s.pendingHelp}</p><button className="quiet" disabled={!!busy} onClick={() => void controller.current?.keepAnyway()}>{s.keepAnyway}</button></>}<button className="quiet" disabled={!!busy} onClick={() => void leave()}>{s.finish}</button></section>}
  </main>;
}
