import { useEffect, useRef, useState } from 'react';
import { HairController, type HairState } from '../hair/controller';
import { hairShots, permittedHairShots, type HairShot, type HairStyle } from '../hair/plan';
import { sampleMount, type MountState } from '../solo/mount';
import { angles, type Assistance, type Pace } from '../solo/round';
import { db, type Photo, type Session } from '../storage/db';
import { LocalPhoto } from './ReviewScreen';
import { s } from '../i18n/strings.en';
import type { HairSet } from '../hair/state';
import { patternSubtypes, hairCompletion, type PatternFamily } from '../hair/profile';
import { hairAttemptState } from '../hair/attempts';
function PatternExample({family}:{family:PatternFamily}) {
    const path={straight:'M20 8V72',wavy:'M20 8C4 16 36 24 20 32S36 48 20 56S36 72 20 76',curly:'M20 8C3 8 3 28 20 28S37 48 20 48S3 68 20 68',coily:'M20 8c-12 0-12 10 0 10s12 10 0 10s-12 10 0 10s12 10 0 10s-12 10 0 10s12 10 0 10'}[family];
    return <svg viewBox="0 0 64 84" aria-hidden="true">{[0,12,24].map(offset=><path key={offset} d={path} transform={`translate(${offset} 0)`}/>)}</svg>;
}
export function hairShotLabel(shot: HairShot) { return shot.angle && shot.kind === 'angle' ? s.hairAngles[shot.angle] : s.hairShotLabels[shot.id as keyof typeof s.hairShotLabels] ?? shot.id; }
export function HairScreen({ session, onLeave }: {
    session: Session;
    onLeave: () => void;
}) {
    const video = useRef<HTMLVideoElement>(null), controller = useRef<HairController | null>(null);
    const [state, setState] = useState<HairState | null>(null), [facing, setFacing] = useState<'user' | 'environment'>(session.camera ?? 'user'), [mounted, setMounted] = useState(false), [heard, setHeard] = useState(false), [error, setError] = useState(''), [mount, setMount] = useState<MountState | null>(null), [tilt, setTilt] = useState<number | null>(null), [audio, setAudio] = useState<boolean | null>(null);
    const selected = state?.selected ?? 'angle-front', isTop = selected === 'crown';
    const topRef = useRef(isTop);
    topRef.current = isTop;
    const [photos, setPhotos] = useState<Photo[]>([]);
    const mountRef = useRef<MountState | null>(null);
    useEffect(() => { void db.photos.where('sessionId').equals(session.id).toArray().then(setPhotos).catch(() => undefined); }, [session.id, state?.session.progress?.savedIds.join(',')]);
    useEffect(() => { if (state?.round && ['done', 'stopped'].includes(state.round.phase))
        setMounted(false); }, [state?.round?.phase]);
    useEffect(() => { const value = new HairController(video.current!, session, setState); controller.current = value; setState({ ...value.state }); const hide = () => { if (document.hidden)
        value.interrupt(); }; const leave = () => value.interrupt(); document.addEventListener('visibilitychange', hide); addEventListener('pagehide', leave); return () => { document.removeEventListener('visibilitychange', hide); removeEventListener('pagehide', leave); value.dispose(); }; }, [session.id]);
    useEffect(() => { const orient = (event: DeviceOrientationEvent) => { if (event.beta === null || event.gamma === null)
        return; const value = { tilt: 90 - Math.abs(event.beta), roll: event.gamma }, next = sampleMount(mountRef.current, value, performance.now(), topRef.current ? 'top' : 'upright'); if (mountRef.current?.locked && !next.level && controller.current?.state.round && !['done', 'stopped'].includes(controller.current.state.round.phase)) {
        controller.current.interrupt();
        setMounted(false);
    } mountRef.current = next; setTilt(value.tilt); setMount(next); }; addEventListener('deviceorientation', orient); return () => removeEventListener('deviceorientation', orient); }, []);
    async function enableOrientation() { try {
        const Constructor = DeviceOrientationEvent as typeof DeviceOrientationEvent & {
            requestPermission?: () => Promise<string>;
        };
        if (Constructor.requestPermission)
            await Constructor.requestPermission();
    }
    catch {
        setMount(null);
    } }
    async function act(work: () => Promise<unknown>) { setError(''); try {
        await work();
    }
    catch {
        setError(s.saveError);
    } }
    async function leave() { await act(async () => { await controller.current!.leave(); onLeave(); }); }
    const h = state?.session.hair ?? session.hair!, set:HairSet = h.sets[h.style] ?? { results: {}, colors: {} }, all = hairShots(h.style,!!set.includeLength||set.results.length?.status==='saved'), available = permittedHairShots(h.style, h.assistance,!!set.includeLength), shot = available.find(item => item.id === selected) ?? available[0];
    const busy = !!(state?.busy || state?.loading), round = state?.round, activeRound = state?.stage === 'scan' && round && !['done', 'stopped'].includes(round.phase), orange = round?.phase === 'hold' || round?.phase === 'capture', seconds = round ? (round.phase === 'capture' ? 1 : Math.max(1, Math.ceil((round.deadline - performance.now()) / 1000))) : 0;
    const completion=hairCompletion(h.style,set), saved=completion.saved;
    const attempt = hairAttemptState(set, shot.id);
    return <main className={state?.stage === 'choice' ? 'workspace mx-auto solo-choice' : activeRound ? 'hair-screen in-round' : 'hair-screen'}>
    <header className="review-header" inert={!!activeRound}><button className={state?.stage === 'choice' ? 'secondary' : 'quiet'} disabled={busy} onClick={() => void leave()}>{s.finish}</button><span>{s.hairCoverage(saved, completion.required)}</span></header>
    {error && <p role="alert">{error}</p>}
    {state?.stage === 'choice' && <section><div className="page-heading"><h1>{s.soloChoice}</h1><p>{s.soloHelp}</p></div><fieldset className="solo-options"><legend className="sr-only">{s.soloChoice}</legend>{(Object.keys(s.assistance) as Assistance[]).map(value => <label key={value} className={h.assistance === value ? 'solo-option selected' : 'solo-option'}><input type="radio" name="assistance" value={value} checked={h.assistance === value} onChange={() => { controller.current!.state.session.hair!.assistance = value; setState({ ...controller.current!.state }); }}/><span><strong>{s.assistance[value]}</strong><span>{s.assistanceHelp[value]}</span></span></label>)}</fieldset><button className="primary" onClick={() => controller.current?.mount()}>{s.continue}</button><button className="secondary" onClick={() => void controller.current?.begin(true)}>{s.practice}</button></section>}
    <div className={state?.stage === 'choice' ? 'is-hidden' : activeRound ? 'hair-workspace during-round' : 'hair-workspace'} inert={!!activeRound}>
      <div className="hair-heading"><h1>{state?.stage === 'mount' ? s.placePhone : s.hairTitle}</h1><p>{s.hairStyles[h.style]}</p></div>
      {!state?.running && <div className="hair-camera-start"><label className="field">{s.camera}<select value={facing} disabled={busy} onChange={event => setFacing(event.target.value as typeof facing)}><option value="user">{s.front}</option><option value="environment">{s.rear}</option></select></label><button className="primary" disabled={busy} onClick={() => void act(() => controller.current!.start(facing))}>{state?.loading ? s.cameraLoading : s.startCamera}</button></div>}
      <div className="hair-preview"><video ref={video} autoPlay muted playsInline className={state?.session.camera === 'user' ? 'mirror' : ''}/>{state?.stage==='mount'?<svg viewBox="0 0 300 400" aria-hidden="true"><path d="M 35 85 V 35 H 85 M 215 35 H 265 V 85 M 265 315 V 365 H 215 M 85 365 H 35 V 315"/></svg>:<svg className="hair-ring" viewBox="0 0 300 400" role="img" aria-label={s.hairCoverageHelp}><ellipse cx="150" cy="200" rx="120" ry="160"/>{angles.map((angle,index)=><circle key={angle} cx={150+120*Math.sin(index*Math.PI/4)} cy={200-160*Math.cos(index*Math.PI/4)} r="10" className={set.results[`angle-${angle}`]?.status==='saved'?'complete':''}/>)}</svg>}</div>
      <div className="hair-controls">
        <p>{isTop ? s.topMountHelp : s.hairMountHelp}</p><p className="capture-note">{s.hairUnverified}</p>
        {state?.message && <p role="status">{state.message}</p>}
        {state?.observation?.colorCast?.status==='possible-cast' && <p role="status">{s.hairCastWarning}</p>}
        {state?.running && !set.baseline && !state.modelFailed && <p>{s.calibrationTime(state.seconds)}</p>}
        <details className="hair-setup" open={state?.stage === 'mount'}><summary>{s.hairSetup}</summary><button className="quiet" disabled={busy} onClick={() => void enableOrientation()}>{s.enableOrientation}</button><p>{mount?.measured && tilt !== null ? s.levelStatus(tilt, mount.locked) : s.levelUnknown}</p>
        <label className="ownership-check"><input type="checkbox" checked={mounted} onChange={event => setMounted(event.target.checked)}/><span>{state?.round && state.running ? s.phoneUnmoved : s.mountChecked}</span></label>
        <button className="quiet" disabled={busy} onClick={() => void act(async () => { await controller.current!.effects.enable(); controller.current!.effects.tone('turn'); controller.current!.effects.speak(s.audioSentence); setAudio(controller.current!.effects.audioReady); })}>{s.audioTest}</button>{audio === false && <p>{s.audioUnavailable}</p>}
        <label className="ownership-check"><input type="checkbox" checked={heard} onChange={event => setHeard(event.target.checked)}/><span>{s.audioHeard}</span></label>
        <label className="field">{s.soloPace}<select value={h.pace} disabled={busy || !!activeRound} onChange={event => void act(() => controller.current!.configure({ pace: event.target.value as Pace }))}>{Object.entries(s.paces).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <div className="review-actions"><button className="primary" disabled={busy || !state?.running || !set.baseline || !mounted || (mount?.measured && !mount.locked) || (!heard && h.assistance === 'stand')} onClick={() => void act(() => controller.current!.begin(false, !!state?.round))}>{state?.round && !state.round.rehearsal ? s.redoRound : h.assistance === 'handheld' ? s.startFrontRound : s.startRound}</button><button className="quiet" disabled={busy} onClick={() => void controller.current?.begin(true)}>{s.practice}</button></div>
        <p className="capture-note">{controller.current?.effects.wakeReady ? s.wakeActive : s.wakeUnknown}</p><button className="quiet" disabled={busy} onClick={() => { setMounted(false); controller.current?.interrupt(); }}>{s.repositionPhone}</button></details>
        <fieldset className="hair-style-options"><legend>{s.hairStyle}</legend>{Object.entries(s.hairStyles).map(([value,label])=><button key={value} className={h.style===value?'hair-style-chip selected':'hair-style-chip'} aria-pressed={h.style===value} disabled={busy||!!activeRound} onClick={()=>{if(value!==h.style){setMounted(false);void act(()=>controller.current!.configure({style:value as HairStyle}));}}}>{label}</button>)}</fieldset><p>{s.hairNaturalRequired}</p>
        <details className="hair-profile"><summary>{s.hairPatternLength}</summary><p>{s.hairPatternHelp}</p><fieldset disabled={busy||!!activeRound} className="hair-patterns"><legend>{s.hairPattern}</legend><label className="ownership-check pattern-unspecified"><input type="radio" name={`pattern-${h.style}`} checked={!set.pattern} onChange={()=>void act(()=>controller.current!.pattern(''))}/>{s.unspecifiedPattern}</label>{(Object.keys(patternSubtypes) as PatternFamily[]).map(family=><label key={family} className={set.pattern?.family===family?'pattern-choice selected':'pattern-choice'}><input type="radio" name={`pattern-${h.style}`} checked={set.pattern?.family===family} onChange={()=>void act(()=>controller.current!.pattern(family))}/><PatternExample family={family}/><strong>{s.hairPatterns[family]}</strong><span>{s.hairPatternDescriptions[family]}</span></label>)}</fieldset>{set.pattern&&<label className="field">{s.hairSubtype}<select disabled={busy||!!activeRound} value={set.pattern.subtype??''} onChange={event=>void act(()=>controller.current!.pattern(set.pattern!.family,event.target.value))}><option value="">{s.unspecifiedPattern}</option>{patternSubtypes[set.pattern.family].map(subtype=><option key={subtype} value={subtype}>{subtype}</option>)}</select></label>}<label className="ownership-check"><input type="checkbox" checked={!!set.includeLength} disabled={busy||!!activeRound||h.assistance==='handheld'} onChange={event=>void act(()=>controller.current!.length(event.target.checked))}/>{s.includeHairLength}</label><p>{s.hairLengthHelp}</p></details>
        <label className="field">{s.hairNextShot}<select value={shot.id} disabled={busy || !!activeRound} onChange={event => { controller.current!.select(event.target.value); mountRef.current = null; setMount(null); if (event.target.value.startsWith('texture-'))
        setFacing('user'); }}>{available.map(item => <option key={item.id} value={item.id}>{hairShotLabel(item)}</option>)}</select></label>
        {h.assistance === 'helper' && <p>{s.helperAsk(hairShotLabel(shot))}</p>}
        {shot.kind === 'texture' && <p>{s.hairTextureHelp}</p>}{shot.kind==='length'&&<p>{s.hairLengthHelp}</p>}<button className="shutter" aria-label={s.capture} disabled={!state?.running || busy || !!state.pending || !!activeRound || attempt.exhausted} onClick={() => void controller.current?.capture(shot)}><span /></button>
        {attempt.exhausted && <section><p role="status">{s.hairAttemptLimit}</p>{attempt.canRevisit && <button className="quiet" disabled={busy || !!state?.pending || !!activeRound} onClick={() => void act(() => controller.current!.revisit(shot.id))}>{s.revisitHairShot}</button>}</section>}
        {busy && <p role="status">{s.saving}</p>}
        {state?.pending && <section className="pending-photo"><h2>{s.pendingTitle}</h2><img src={state.pending.url} alt={s.pendingTitle}/><p>{s.pendingHelp}</p><button className="primary" onClick={() => void controller.current?.keep()} disabled={busy}>{s.keepAnyway}</button><button className="quiet" onClick={() => controller.current?.clearPending()} disabled={busy}>{s.discard}</button></section>}
        <details className="hair-results" open={state?.stage === 'summary'}><summary>{s.hairShotList}</summary><p>{s.hairCoverageHelp}</p><ul>{all.map(item => { const result = set.results[item.id], photo = result?.status === 'saved' ? photos.find(photo => photo.id === result.photoId) : undefined; return <li key={item.id}>{item.kind === 'angle' && photo && <LocalPhoto photo={photo} label={hairShotLabel(item)}/>}<span>{hairShotLabel(item)}</span><strong>{result?.status === 'saved' ? s.photoSaved : result?.status === 'failed' ? s.hairFailure[result.reason as keyof typeof s.hairFailure] ?? s.needsReview : !available.some(allowed => allowed.id === item.id) ? s.assistanceHelp.handheld : s.needsReview}</strong></li>; })}</ul></details>
        {completion.optionalSaved>0&&<p>{s.optionalHairSaved(completion.optionalSaved)}</p>}
        {Object.keys(set.colors).length > 0 && <section className="hair-colors"><h2>{s.hairColors}</h2><p>{s.hairColorHelp}</p><p>{s.hairClusterHelp}</p>{state?.observation?.colorCast?.status!=='possible-cast'&&photos.some(photo=>photo.hair?.style===h.style&&photo.hair.analysis.colorCast?.status==='possible-cast')&&<p role="status">{s.hairCastWarning}</p>}{Object.entries(set.colors).map(([region, value]) => <div key={region}><label className="field">{s.hairColor(region)}<input type="color" value={value.hex} onChange={event => controller.current?.color(region, event.target.value)} disabled={busy}/><span>{value.hex}</span></label>{value.fraction!==undefined&&<p>{s.hairColorFraction(value.fraction)}</p>}<label className="field">{s.hairColorRole(region)}<select value={value.role??''} disabled={busy} onChange={event=>controller.current?.colorRole(region,event.target.value)}><option value="">{s.unspecifiedPattern}</option>{Object.entries(s.hairColorRoles).map(([role,label])=><option key={role} value={role}>{label}</option>)}</select></label><label className="field">{s.hairColorName(region)}<input type="text" maxLength={80} placeholder={s.hairColorNamePlaceholder} value={value.name??''} onChange={event=>controller.current?.colorName(region,event.target.value)} disabled={busy}/></label><button className="quiet" disabled={busy || value.confirmed} onClick={() => void act(() => controller.current!.confirmColor(region))}>{value.confirmed ? s.colorConfirmed : s.confirmColor}</button></div>)}</section>}
      </div>
    </div>
    {activeRound && <section className={orange ? 'solo-cue hold' : 'solo-cue turn'} aria-live="polite"><header><p>{s.soloStep(round.cursor + 1, round.queue.length)}</p><h1>{round.angle ? s.hairAngles[round.angle] : s.soloReady}</h1></header><div className={seconds >= 10 ? 'solo-number two-digits' : 'solo-number'}>{seconds}</div><h2>{round.phase === 'countdown' ? s.soloReady : orange ? s.soloHold : s.soloTurn}</h2><div className="solo-dots" aria-hidden="true">{angles.map(angle => <span key={angle} className={round.angle === angle ? 'current' : round.results[angle] ? 'complete' : ''}/>)}</div><p>{round.rehearsal ? s.practice : s.hairStyles[h.style]}</p><button className="quiet" autoFocus onClick={() => controller.current?.pause()}>{s.pause}</button></section>}
  </main>;
}
