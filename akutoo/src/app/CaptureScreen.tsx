import {guidedActive,primaryIds,extraIds} from '../session/guided-scan';
import {ScanGuide} from './ScanGuide';
import {sweepActive} from '../session/free-sweep';
import {SoloEffects} from '../solo/effects';
import {PoseGuide} from './PoseGuide';
import {speechDelay} from '../capture/pose-guidance';
import {speakGuidance} from '../audio/guidance';
import { useEffect, useRef, useState } from 'react';
import {haptic} from '../audio/haptics';
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
  const plan = capturePlan(state?.session ?? session), p = state ? captureProgress(state.session) : undefined, shot = (state?.retakeFinished || (p?.guidedScan?.group==='summary'&&!p.revisiting&&!state?.session.retakePhotoId&&!state?.session.details?.active)) ? undefined : state?.session.retakeShotId ? plan.find(shot => shot.id === state.session.retakeShotId) : p ? plan[p.index] : undefined;
  const detail = !!state?.session.details?.active, baseline = detail ? state?.session.details?.baseline : state?.session.baseline;
  const guide = shot?.detail ? detailGuide(shot.detail) : null;
  const sourceRatio = (state?.session.stream?.width ?? 3) / (state?.session.stream?.height ?? 4);
  const guided=!!p&&guidedActive(p)&&!state?.retakeFinished&&!detail&&!state?.session.retakePhotoId;
  const summary=guided&&p?.guidedScan?.group==='summary';
  const primary=guided&&p?.guidedScan?.group!=='extra'&&!(summary&&p?.guidedScan?.summaryOf==='extra');
  const displayBins=guided?(primary?primaryIds:extraIds).map(id=>id==='chin-up'?'pitch:-15':id==='chin-down'?'pitch:15':`yaw:${id.slice(5)}`):poseBins;
  const savedCount=displayBins.filter(bin=>state?.coveredBins.includes(bin)).length;
  const instruction = shot ? s.shotInstruction(shot) : s.sessionComplete;
  const lastSpoken=useRef(-Infinity), lastShot=useRef('');
  const correction=state?.poseCue && state.poseCue!=='manual' ? state.poseCue==='expression' ? instruction : state.poseCue in s.fix ? s.fix[state.poseCue as keyof typeof s.fix] : s.poseCues[state.poseCue as keyof typeof s.poseCues] : null;
  const scanText=state?.scan?s.scanCues[state.scan.cue]:instruction;
  const scanCorrection=state?.scan?.status==='recovering'?scanText:state?.quality?.hardFailure&&state.quality.reason?s.fix[state.quality.reason]:scanText;
  const speechBlockedByBusy=!guided&&state?.busy;
  const spoken=guided?(baseline?scanCorrection:s.calibrating):baseline&&correction?correction:instruction;
  useEffect(() => {
    if(!voice){if('speechSynthesis' in window)speechSynthesis.cancel();return;}
    if(state?.countdown!==null&&state?.countdown!==undefined||state?.handsFreeReturning)return;
    if(!voice||!state?.running||state.paused||(!guided&&state.busy)||state.pending||state.loading||state.modelFailed||!('speechSynthesis' in window)) {
      if('speechSynthesis' in window) speechSynthesis.cancel();
      return;
    }
    const speechKey=guided?spoken:shot?.id;
    const changed=lastShot.current!==speechKey;
    const timer=window.setTimeout(()=>{
      speakGuidance(!guided&&changed&&spoken!==instruction?`${instruction} ${spoken}`:spoken,voiceURI);
      lastSpoken.current=performance.now();lastShot.current=speechKey??'';
    },guided&&(state?.scan?.status==='holding'||state?.scan?.status==='saving')?0:changed?350:speechDelay(performance.now(),lastSpoken.current));
    return ()=>window.clearTimeout(timer);
  },[spoken,guided,voice,voiceURI,state?.running,state?.paused,speechBlockedByBusy,state?.pending,state?.loading,state?.modelFailed,state?.countdown,state?.handsFreeReturning]);
  useEffect(()=>{
    if(!state)return;
    const count=state?.session.stats?.captures??0;
    if(count>previousCaptures.current){effects.current.tone('capture');haptic('saved');}
    previousCaptures.current=count;
  },[state?.session.stats?.captures]);
  const returnHaptic=useRef(false),lastReturnHaptic=useRef(-Infinity);
  useEffect(()=>{
    const returning=!!state?.running&&!state.paused&&!!baseline&&!!state.scan&&(state.scan.cue==='recover'||state.scan.cue==='back'||p?.guidedScan?.phase.startsWith('return')===true);
    if(returning&&!returnHaptic.current&&performance.now()-lastReturnHaptic.current>=3000){haptic('return');lastReturnHaptic.current=performance.now();}
    returnHaptic.current=returning;
  },[state?.running,state?.paused,state?.scan?.cue,p?.guidedScan?.phase,baseline]);
  useEffect(()=>{
    if(!voice)return;
    const count=state?.countdown;
    if(state?.handsFreeReturning){speakGuidance(s.handsFreeReturn,voiceURI);}
    else if(count===7)speakGuidance(s.handsFreeTurn(shot?.yaw??0),voiceURI);
    else if(count===3||count===2||count===1)speakGuidance(String(count),voiceURI);
    else if(count===0){speakGuidance(s.handsFreeHold,voiceURI);effects.current.tone('hold');}
  },[state?.countdown,state?.handsFreeReturning,voice,voiceURI]);
  const counting=state?.countdown!==null&&state?.countdown!==undefined;
  const sweeping=!!p&&!!shot&&sweepActive(p)&&!state?.retakeFinished&&!detail&&!state?.session.retakePhotoId;
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
  const autoLabel=counting?(state?.countdown===0?s.handsFreeHold:s.handsFreeCount(state?.countdown??0)):state?.busy?(guided?s.scanSavingFrame:s.autoSaving):state?.loading?s.autoPreparing:state?.modelFailed?s.autoUnavailable:state?.paused?s.autoPaused:shot?.manual?s.autoManual:!baseline?s.autoCalibrating:guided?(autoReady?s.scanCollecting:s.scanMoving):autoReady?s.autoReady:s.autoAlign;
  const feedback = counting?(state?.countdown===0?s.handsFreeHold:s.handsFreeAway):state?.handsFreeReturning?s.handsFreeReturnHelp:state?.message === s.cameraInterrupted ? s.cameraInterrupted : state?.paused ? s.paused : state?.message && (state.loading || state.modelFailed || !baseline || (!guided&&state.quality?.hardFailure)) ? state.message : guided?scanCorrection:correction??instruction;
  return <main className={fixing ? 'capture-screen fix-screen' : `capture-screen${guided?' guided-screen':shot&&!detail&&shot.stage<=2?' has-pose-guide':''}${summary?' scan-summary-screen':''}`}>
    <div className={fixing ? 'scan-layout is-hidden' : 'scan-layout'} inert={fixing}>
    <header className="capture-header"><button className="quiet" onClick={() => void leave()} disabled={!!busy}>{s.finish}</button><span>{guided?s.scanProgress(savedCount,displayBins.length):p ? s.progress(p.completed.length, plan.length) : s.setupTitle}</span></header>
    <div className="capture-heading">{!detail&&!guided && <p>{shot ? s.stage(shot.stage) : s.sessionComplete}</p>}<h1>{guided?(primary?s.scanTitle:s.scanExtraTitle):sweeping?s.freeSweepTitle:shot ? s.stageNames[shot.stage - 1] : s.sessionComplete}</h1></div>
    <div className={`scan-visual${summary?' is-hidden':''}`}><div className={`${state?.pending?'is-hidden ':''}${counting?'is-counting ':''}${detail?'camera-frame detail-camera':'camera-frame'}`} style={detail ? { aspectRatio: `${sourceRatio}`, width: `min(100%, 400px, ${38 * sourceRatio}svh)` } : undefined}>
      <video ref={video} autoPlay muted playsInline className={state?.camera === 'user' ? 'mirror' : ''} />
      {guide ? <div className="detail-guide" role="img" aria-label={s.detailGuide} style={{ left: `${guide.x * 100}%`, top: `${guide.y * 100}%`, width: `${guide.width * 100}%`, height: `${guide.height * 100}%` }}/> : <svg className="scan-ring" viewBox="0 0 300 400" role="img" aria-label={s.coverageCount(savedCount, displayBins.length)}>{displayBins.map((bin, segment) => {
        const complete = state?.coveredBins.includes(bin);
        const a = segment / displayBins.length * Math.PI * 2 - Math.PI / 2, b = (segment + .78) / displayBins.length * Math.PI * 2 - Math.PI / 2;
        return <path key={bin} data-pose-bin={bin} d={`M ${150 + 120 * Math.cos(a)} ${200 + 170 * Math.sin(a)} A 120 170 0 0 1 ${150 + 120 * Math.cos(b)} ${200 + 170 * Math.sin(b)}`} className={complete ? 'complete' : ''} />;
      })}</svg>}
      {!guided&&shot&&!detail&&shot.stage<=2&&<PoseGuide shot={shot} pose={state?.running&&!state.paused?state.result?.pose??null:null} ready={autoReady} mirror={state?.camera==='user'}/>}
      {counting&&<div className="handsfree-countdown" data-hold={state?.countdown===0?'true':'false'} role="status"><strong>{state?.countdown||s.handsFreeHoldLabel}</strong><p>{state?.countdown===0?s.handsFreeHold:s.handsFreePose(shot?.yaw??0)}</p></div>}
      {!state?.running && <div className="camera-placeholder"><p>{s.scanIntro}</p></div>}
    </div>
    {guided&&!summary&&!counting&&!state?.pending&&<ScanGuide target={state?.scan?.target} status={state?.scan?.status??'turning'} cue={state?.scan?.cue??'front'} mirror={state?.camera==='user'} active={!!state?.running&&!state.paused&&!!baseline&&!state.modelFailed&&!state.quality?.hardFailure}/>}
    </div>
    <section className="capture-controls">
      {summary&&<section className="scan-summary"><h2>{primary?s.scanSummary:s.scanExtraSummary}</h2><p>{s.scanProgress(savedCount,displayBins.length)}</p><p>{primary?s.scanSummaryHelp:s.scanExtraHelp}</p><button className="primary" onClick={()=>void controller.current?.chooseGroup('expressions')}>{s.scanExpressions}</button>{primary&&<button className="quiet" onClick={()=>void controller.current?.chooseGroup('extra')}>{s.scanExtras}</button>}{!primary&&!!p?.missed.length&&<button className="quiet" onClick={()=>void controller.current?.revisit()}>{s.revisit}</button>}<button className="quiet" onClick={()=>void leave()}>{s.review}</button></section>}
      <div className={summary?'is-hidden':undefined}>
      {guided&&state?.running&&p?.guidedScan&&!counting&&!state.pending&&<nav className="scan-journey" aria-label={s.scanExample}>{(primary?['front','left','right','up','down']as const:['left','right']as const).map(phase=><span key={phase} aria-current={p.guidedScan?.phase===phase||p.guidedScan?.phase===`return-${phase}`?'step':undefined}>{s.scanJourney[phase]}</span>)}</nav>}
      {state?.running&&!state.pending&&<div className={autoReady?'auto-status is-ready':'auto-status'} data-ready={autoReady?'true':'false'}><p role="status">{autoLabel}</p>{!guided&&!counting&&!shot?.manual&&!state.modelFailed&&baseline&&<div role="progressbar" aria-label={s.autoHoldProgress} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((state.holdProgress??0)*100)} className="auto-hold"><span style={{width:`${Math.round((state.holdProgress??0)*100)}%`}}/></div>}</div>}
      {detail && shot && <p className="instruction">{instruction}</p>}
      {(!detail || feedback !== instruction) && <p className={detail ? 'capture-note' : 'instruction'} aria-live="polite">{feedback}</p>}
      {detail && <details className="detail-tips"><summary>{s.detailPhotoTips}</summary><p className="capture-note">{s.detailHelp}</p></details>}
      {state?.running && !state.pending && !baseline && !state.modelFailed && <p role="status">{s.calibrationTime(state.seconds)}</p>}
      {!guided&&!counting&&!state?.paused&&!state?.pending&&shot&&!shot.manual&&!detail&&shot.stage<=2&&<p className="capture-note">{s.poseFollow}</p>}
      {!state?.running && shot && <><label className="field">{s.camera}<select value={camera} onChange={event => setCamera(event.target.value as typeof camera)} disabled={!!busy}><option value="user">{s.front}</option><option value="environment">{s.rear}</option></select></label><button className="primary" disabled={!!busy} onClick={() => {void effects.current.enable();if(guided){setVoice(true);speakGuidance(s.scanWelcome,voiceURI);}void controller.current?.start(camera);}}>{state?.loading ? s.cameraLoading : guided?s.scanStart:s.startCamera}</button>{guided&&<p className="capture-note">{s.scanStartHelp}</p>}</>}
      {state?.running && <>
        {!state.pending&&<div className="capture-actions"><button className="quiet" onClick={() => controller.current?.pause()} disabled={!!state.loading || (!!state.busy&&!guided)}>{state.paused ? s.resume : s.pause}</button>{guided&&!counting?<span className="auto-capture-mark">{s.scanAutomatic}</span>:counting?<button className="quiet" disabled={!!busy} onClick={()=>{controller.current?.cancelCountdown();controller.current?.pause();}}>{s.handsFreeCancel}</button>:<button className="shutter" aria-label={s.capture} onClick={() => void controller.current?.capture()} disabled={!!busy || !!state.pending || counting}><span /></button>}<button className="quiet" disabled={!voiceReady || voiceSaving} onClick={() => void toggleVoice()}>{voice ? s.voiceOn : s.voiceOff}</button></div>}
      {!guided&&sweeping&&state?.running&&!state.pending&&!counting&&<p className="sweep-instruction">{s.freeSweepHelp}<span>{s.sweepProgress(state.coveredBins.length)}</span></p>}
        {!guided&&!state.pending&&<p className="capture-note">{s.reviewNeeded}</p>}
        {busy && !guided && <p role="status">{s.saving}</p>}
        {shot?.manual && <p>{s.manualHint}</p>}
        {!state.pending&&!counting&&!state.paused&&!detail&&shot&&!guided&&<section className="handsfree-tools">
          {sweeping?<><div className="handsfree-buttons"><button className="quiet" disabled={!!busy||!voiceReady||(!baseline&&!state.modelFailed)||p?.completed.includes('turn--90')||p?.missed.includes('turn--90')} onClick={()=>void handsFree(-90)}>{s.handsFreeLeft}</button><button className="quiet" disabled={!!busy||!voiceReady||(!baseline&&!state.modelFailed)||p?.completed.includes('turn-90')||p?.missed.includes('turn-90')} onClick={()=>void handsFree(90)}>{s.handsFreeRight}</button></div>{guided&&<button className="quiet" disabled={!!busy||!voiceReady||(!baseline&&!state.modelFailed)} onClick={()=>void handsFree()}>{s.handsFreeStart}</button>}<p className="capture-note">{s.handsFreeHelp}</p><button className="quiet" disabled={!!busy} onClick={()=>void controller.current?.finishFreeSweep()}>{s.freeSweepContinue}</button><p className="capture-note">{s.freeSweepLater}</p></>:<button className="quiet" disabled={!!busy||!voiceReady||(!baseline&&!state.modelFailed)} onClick={()=>void handsFree()}>{s.handsFreeStart}</button>}
        </section>}
        {p&&!guided&&shot&&shot.stage<=2&&!state.pending&&!detail&&!state.session.retakePhotoId&&<button className="quiet" disabled={!!busy} onClick={()=>void controller.current?.enableFreeSweep()}>{s.freeSweepEnable}</button>}

        {!guided&&!counting&&!state.pending&&shot&&!shot.manual&&<p className="capture-note">{s.poseFallback}</p>}
        {!guided&&!state.pending && !p?.attempts.sessionFix && <div className="skip-controls"><label className="field">{s.skipReason}<select value={reason} onChange={event => setReason(event.target.value)}>{Object.entries(s.skipOptions).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><button className="quiet" disabled={!!busy||counting} onClick={() => void controller.current?.skip(reason)}>{s.nextPose}</button></div>}
      </>}
      {guided&&state?.running&&!state.pending&&!counting&&<>
        <p className="capture-note">{primary?s.scanHelp:s.scanExtraHelp}</p>
        {state.stall!=='none'&&<p className="scan-stall" role="status">{state.stall==='offer'?s.scanOffer:state.quality?.reason?s.fix[state.quality.reason]:s.scanStalled}</p>}
        <button className="quiet scan-continue" disabled={!!busy} onClick={()=>void controller.current?.chooseGroup('summary')}>{s.scanFinish}</button>
        <details className="scan-options"><summary>{s.scanOptions}</summary><button className="quiet" disabled={!!busy} onClick={()=>void controller.current?.capture()}>{s.capture}</button><button className="quiet" disabled={!!busy} onClick={()=>void controller.current?.skip('later')}>{s.nextPose}</button>{!primary&&<button className="quiet" disabled={!!busy||!voiceReady||(!baseline&&!state.modelFailed)} onClick={()=>void handsFree()}>{s.handsFreeStart}</button>}<p>{s.reviewNeeded}</p></details>
        <details className="scan-options"><summary>{s.scanMeasurements}</summary><p>{state.result?.pose?s.poseLive(state.result.pose.yaw,state.result.pose.pitch):s.poseWaiting}</p></details>
      </>}
      {state?.pending && <section className="pending-photo"><h2>{s.pendingTitle}</h2><img src={state.pending.url} alt={s.pendingTitle}/><p>{state.message}</p><p>{s.pendingHelp}</p><button className="primary" disabled={!!busy} onClick={() => void controller.current?.keepAnyway()}>{s.keepAnyway}</button><button className="quiet" disabled={!!busy} onClick={() => void controller.current?.retryCapture()}>{p?.attempts.promptRetake === false || p?.attempts.moveOn ? s.skip : s.discard}</button></section>}
      {!shot && state && <section><p>{s.sessionCompleteHelp}</p>{p && !p.revisiting && p.missed.length > 0 && <button className="primary" onClick={() => void controller.current?.revisit()}>{s.revisit}</button>}<button className="quiet" onClick={() => void leave()}>{s.review}</button></section>}
      {p?.attempts.offerFinish && <p>{s.longSession}</p>}
      {state?.message === s.cameraError || state?.message === s.saveError || state?.message === s.sessionChanged ? <p role="alert">{state.message}</p> : null}
      {leaveError && <p role="alert">{leaveError}</p>}
      {state?.message === s.earlierKept && <p role="status">{s.earlierKept}</p>}
      </div>
    </section>
    </div>
    {fixing && state && <section className="session-fix" role="alert"><h1>{s.sessionFixTitle}</h1><p>{state.message}</p><p>{s.safePhotos(p?.savedIds.length ?? 0)}</p><button className="primary" disabled={!!busy} onClick={() => void controller.current?.checkAgain()}>{s.checkAgain}</button><button className="quiet" disabled={!!busy} onClick={() => void controller.current?.skip('failed')}>{s.keepGoing}</button>{state.pending && <><p className="capture-note">{s.pendingHelp}</p><button className="quiet" disabled={!!busy} onClick={() => void controller.current?.keepAnyway()}>{s.keepAnyway}</button></>}<button className="quiet" disabled={!!busy} onClick={() => void leave()}>{s.finish}</button></section>}
  </main>;
}
