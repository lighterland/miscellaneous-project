import { useEffect, useRef, useState } from 'react';
import { db, type Photo, type Session } from '../storage/db';
import { deletePhoto, loadPhoto, putSession } from '../storage/sessions';
import { evaluateQuality } from '../gates/quality';
import { datasetZip, exportable, type ExportPreset } from '../export/dataset';
import { s } from '../i18n/strings.en';
import { poseCoverage } from '../session/coverage';
import type { ExportFormat } from '../export/encode';
import { defaultExportSettings, exportLayout, normalizeExportSettings, selectExportPhotos, type ExportSettings } from '../export/settings';
import { datasetReadiness } from '../session/readiness';
import { shots } from '../session/shotlist';
import { ReadinessPanel } from './ReadinessPanel';
import { ExportOptions } from './ExportOptions';
import { suggestedRetake } from '../session/retake';
import { SessionConflict } from '../storage/recovery-plan';
import {gradeHair} from '../hair/quality';
import {hairShots,type HairStyle} from '../hair/plan';
import { beginDetails, detailPlan } from '../details/plan';
import { hairCompletion } from '../hair/profile';
import {gradeBody} from '../body/quality';
import {bodyShots,type BodyMode} from '../body/plan';
import {BodyRatiosPanel} from './BodyRatiosPanel';
import type {BodyCorrections} from '../body/corrections';

export function LocalPhoto({ photo, full = false, label }: { photo: Photo; full?: boolean; label: string }) {
  const [url, setUrl] = useState(''), [failed, setFailed] = useState(false);
  const [zoomed, setZoomed] = useState(false), viewport = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let active = true, objectUrl = ''; setUrl(''); setFailed(false); setZoomed(false);
    void loadPhoto(photo, !full).then(file => { if (active) { objectUrl = URL.createObjectURL(file); setUrl(objectUrl); } }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [photo.id, full]);
  useEffect(() => { if (zoomed && viewport.current) { const element = viewport.current; element.scrollLeft = (element.scrollWidth - element.clientWidth) / 2; element.scrollTop = (element.scrollHeight - element.clientHeight) / 2; } }, [zoomed]);
  if (!url) return <span>{failed ? s.photoMissing : s.loadingPhoto}</span>;
  if (!full) return <img src={url} alt={label}/>;
  return <div className="photo-viewer"><button className="secondary" aria-pressed={zoomed} onClick={() => setZoomed(value => !value)}>{zoomed ? s.fitPhoto : s.inspectPhoto}</button>
    <div ref={viewport} className={zoomed ? 'photo-viewport is-zoomed' : 'photo-viewport'} role="region" aria-label={s.photoInspection} tabIndex={0}>
      <img src={url} alt={label} style={zoomed ? { width: photo.width, height: photo.height } : undefined}/>
    </div>{zoomed && <p className="inspection-help">{s.panPhotoHelp}</p>}
  </div>;
}
export function ReviewScreen({ session: initial, onBack, onRetake, onContinue, onImport }: { session: Session; onBack: () => void; onRetake: (session: Session) => void; onContinue: (session: Session) => void; onImport: (session: Session) => void }) {
  const [session, setSession] = useState(initial), [photos, setPhotos] = useState<Photo[]>([]), [selected, setSelected] = useState<string | null>(null);
  const [preset, setPreset] = useState<ExportPreset>('recommended'), [busy, setBusy] = useState(false), [error, setError] = useState(''), [deleting, setDeleting] = useState(false);
  const [format, setFormat] = useState<ExportFormat>('jpeg');
  const [retakeChoice, setRetakeChoice] = useState('');
  const [detailMarks, setDetailMarks] = useState(false), [detailBeard, setDetailBeard] = useState(false);
  const [exportSettings, setExportSettings] = useState<ExportSettings>({ ...defaultExportSettings });
  const [archive, setArchive] = useState<{ url: string; file: File } | null>(null), archiveUrl = useRef('');
  async function refresh() { setPhotos(await db.photos.where('sessionId').equals(session.id).sortBy('createdAt')); }
  useEffect(() => { void refresh().catch(() => setError(s.photoMissing)); return () => { if (archiveUrl.current) URL.revokeObjectURL(archiveUrl.current); }; }, [session.id]);
  const photo = photos.find(photo => photo.id === selected);
  useEffect(() => { setRetakeChoice(photo ? suggestedRetake(photo) ?? '' : ''); }, [photo?.id]);
  const coverage = poseCoverage(photos);
  const FaceReadiness = session.details ? 'details' : 'div';
  const facePhotos = photos.filter(photo => !photo.detail);
  const readinessReport = datasetReadiness(facePhotos), shot = [...shots, ...detailPlan({marks:true,beard:true})].find(shot => shot.id === photo?.shotId);
  let selectedCount = 0, settingsInvalid = false;
  try { const selected = selectExportPhotos(exportable(photos, preset), exportSettings); selected.forEach(photo => exportLayout(photo.width, photo.height, exportSettings)); selectedCount = selected.length; } catch { settingsInvalid = true; }
  function invalidateArchive() { if (archiveUrl.current) URL.revokeObjectURL(archiveUrl.current); archiveUrl.current = ''; setArchive(null); }
  async function confirm(photo: Photo) {
    if(photo.body){setBusy(true);setError('');try{const data=photo.body;await db.photos.update(photo.id,{body:{...data,reviewed:true},identityConfirmed:true,contentConfirmed:true,quality:gradeBody(data.analysis,data.baseline,data.mode,true,photo.relaxed)});invalidateArchive();await refresh();}catch{setError(s.storageError);}finally{setBusy(false);}return;}
    if(photo.detail&&photo.measurements&&photo.baseline){setBusy(true);setError('');try{const measurements={...photo.measurements,occlusionVerified:true};await db.photos.update(photo.id,{measurements,quality:evaluateQuality(measurements,photo.baseline,photo.relaxed,.7),detail:{...photo.detail,reviewed:true},identityConfirmed:true,contentConfirmed:true});invalidateArchive();await refresh();}catch{setError(s.storageError);}finally{setBusy(false);}return;}
    if(photo.hair){setBusy(true);setError('');try{const data=photo.hair;await db.photos.update(photo.id,current=>{current.hair={...data,reviewed:true};current.identityConfirmed=true;current.contentConfirmed=true;current.quality=gradeHair(data.analysis,data.baseline,data.kind,true,data.visibleFaces,photo.relaxed);});invalidateArchive();await refresh();}catch{setError(s.storageError);}finally{setBusy(false);}return;}
    const baseline = photo.baseline ?? (photo.source === 'imported' ? undefined : session.baseline);
    if (!photo.measurements || !baseline) return;
    setBusy(true); setError('');
    try {
      const measurements = { ...photo.measurements, occlusionVerified: true };
      const quality = evaluateQuality(measurements, baseline, photo.relaxed);
      await db.photos.update(photo.id, { measurements, quality, identityConfirmed: true });
      invalidateArchive(); await refresh();
    } catch { setError(s.storageError); } finally { setBusy(false); }
  }
  async function remove(photo: Photo) {
    setBusy(true); setError('');
    try { setSession(await deletePhoto(session, photo)); setSelected(null); setDeleting(false); invalidateArchive(); await refresh(); }
    catch (error) { setError(error instanceof SessionConflict ? s.reviewChanged : s.storageError); } finally { setBusy(false); }
  }
  async function confirmAnnotation(photo: Photo, field: 'contentConfirmed' | 'consistencyReviewed') {
    setBusy(true); setError('');
    try { await db.photos.update(photo.id, current => { current[field] = true; }); invalidateArchive(); await refresh(); }
    catch { setError(s.storageError); } finally { setBusy(false); }
  }
  async function retake(photo: Photo) {
    if(photo.body&&session.body){setBusy(true);try{const next={...session,retakePhotoId:photo.id,retakeShotId:photo.body.instruction.id,body:{...session.body,mode:photo.body.mode}};await putSession(next);onRetake(next);}catch{setError(s.reviewChanged);setBusy(false);}return;}
    if(photo.detail&&session.details){setBusy(true);try{const next={...session,details:{...session.details,active:true},retakePhotoId:photo.id,retakeShotId:photo.shotId};await putSession(next);onRetake(next);}catch{setError(s.reviewChanged);setBusy(false);}return;}
    if(photo.hair&&session.hair){setBusy(true);try{const next={...session,retakePhotoId:photo.id,retakeShotId:photo.hair.shotId,hair:{...session.hair,style:photo.hair.style}};await putSession(next);onRetake(next);}catch{setError(s.reviewChanged);setBusy(false);}return;}
    const target = shots.find(shot => shot.id === (photo.shotId ?? retakeChoice)); if (!target) return;
    setBusy(true);
    try { const next = { ...session, retakePhotoId: photo.id, retakeShotId: target.id }; await putSession(next); onRetake(next); }
    catch (error) { setError(error instanceof SessionConflict ? s.reviewChanged : s.storageError); setBusy(false); }
  }
  async function createArchive() {
    setBusy(true); setError(''); invalidateArchive();
    try {
      const settings = normalizeExportSettings(exportSettings);
      const bytes = await datasetZip(session, photos, preset, loadPhoto, { format, settings });
      const file = new File([new Uint8Array(bytes)], `akutoo-${session.id}.zip`, { type: 'application/zip' });
      const url = URL.createObjectURL(file); archiveUrl.current = url; setArchive({ url, file });
    } catch { setError(s.exportError); } finally { setBusy(false); }
  }
  async function share() {
    if (!archive) return;
    try { await navigator.share({ files: [archive.file] }); }
    catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) setError(s.shareError); }
  }
  async function details(main = false) {
    setBusy(true); setError('');
    try { const next = main && session.details ? { ...session, details: { ...session.details, active: false }, retakePhotoId: undefined, retakeShotId: undefined } : beginDetails(session, session.details ?? { marks: detailMarks, beard: detailBeard }); await putSession(next); onContinue(next); }
    catch { setError(s.reviewChanged); setBusy(false); }
  }
  async function saveBodyCorrections(values:BodyCorrections){setBusy(true);try{const next={...session,body:{...session.body!,corrections:values,correctionsSource:'user' as const}};await putSession(next);setSession(next);invalidateArchive();}finally{setBusy(false);}}
  return <main className="workspace mx-auto review-screen">
    <header className="review-header"><button className="secondary" disabled={busy} onClick={photo ? () => { setSelected(null); setDeleting(false); } : onBack}>{photo ? s.backGrid : s.back}</button>{!photo && <button className="secondary" disabled={busy} onClick={() => onContinue(session)}>{s.openSession}</button>}</header>
    <div className="page-heading"><h1>{s.reviewTitle}</h1><p>{s.reviewHelp}</p></div>
    {error && <p role="alert" className="review-error">{error}</p>}
    {photo ? <section className="review-detail">
      <LocalPhoto photo={photo} full label={s.photoLabel(photos.indexOf(photo))}/>
      <p>{photo.override ? s.risky : photo.body?.reviewed||photo.hair?.reviewed||photo.measurements?.occlusionVerified ? photo.quality?.tier : s.needsReview}</p>
      {photo.body&&<><section><h2>{s.requestedShot}</h2><p>{s.bodyModes[photo.body.mode]} · {photo.body.instruction.kind==='angle'&&photo.body.instruction.angle?s.hairAngles[photo.body.instruction.angle]:s.bodyLabels[photo.body.instruction.id as keyof typeof s.bodyLabels]??photo.body.instruction.id}</p><p>{s.bodyUnknownHelp}</p></section>{!photo.body.reviewed&&<button className="primary" disabled={busy} onClick={()=>void confirm(photo)}>{s.bodyConfirm}</button>}</>}
      {photo.hair&&!photo.hair.reviewed&&<><p>{s.hairReviewHelp}</p><button className="primary" disabled={busy} onClick={()=>void confirm(photo)}>{s.hairConfirm}</button></>}
      {photo.hair&&<section><h2>{s.requestedShot}</h2><p>{s.hairStyles[photo.hair.style]} · {photo.hair.angle?s.hairAngles[photo.hair.angle as keyof typeof s.hairAngles]:s.hairShotLabels[photo.hair.shotId as keyof typeof s.hairShotLabels]??photo.hair.shotId}</p><p>{s.hairUnverified}</p></section>}
      {photo.detail&&!photo.detail.reviewed&&<><p>{s.detailReview}</p>{photo.measurements&&photo.baseline&&<button className="primary" disabled={busy} onClick={()=>void confirm(photo)}>{s.detailConfirm}</button>}</>}
      {!photo.detail&&photo.measurements && (photo.baseline || (photo.source !== 'imported' && session.baseline)) && !photo.identityConfirmed && <><p>{s.confirmHelp}</p><button className="primary" disabled={busy} onClick={() => void confirm(photo)}>{s.confirmClear}</button></>}
      {readinessReport.identity.unresolved.includes(photo.id) && <section className="consistency-warning"><h2>{s.proportionFlag}</h2><p>{s.outlierHelp}</p><button className="secondary" disabled={busy} onClick={() => void confirmAnnotation(photo, 'consistencyReviewed')}>{s.confirmConsistency}</button></section>}
      {shot && <section className="shot-confirmation"><h2>{s.requestedShot}</h2><p>{s.shotInstruction(shot)}</p>{!photo.detail&&<><p>{s.shotConfirmationHelp}</p>{photo.contentConfirmed ? <p>{s.shotConfirmed}</p> : <button className="secondary" disabled={busy} onClick={() => void confirmAnnotation(photo, 'contentConfirmed')}>{s.confirmShot}</button>}</>}</section>}
      {!photo.shotId && <div className="retake-choice"><label className="field">{s.retakeTarget}<select value={retakeChoice} disabled={busy} onChange={event => setRetakeChoice(event.target.value)}><option value="">{s.chooseRetake}</option>{shots.map(shot => <option key={shot.id} value={shot.id}>{s.shotInstruction(shot)}</option>)}</select></label><p>{s.importRetakeHelp}</p></div>}
      <div className="review-actions"><button className="secondary" disabled={busy || (!photo.shotId && !retakeChoice)} onClick={() => void retake(photo)}>{s.retake}</button><button className="secondary" disabled={busy} onClick={() => setDeleting(true)}>{s.delete}</button></div>
      {deleting && <section className="delete-confirm"><p>{s.deleteHelp}</p><button className="secondary" disabled={busy} onClick={() => void remove(photo)}>{s.deleteConfirm}</button><button className="secondary" disabled={busy} onClick={() => setDeleting(false)}>{s.cancel}</button></section>}
    </section> : <>
      <div className="review-summary"><p>{s.sessionSummary(photos.length)}</p>{session.mode==='face'&&<button className="secondary" disabled={busy} onClick={() => onImport(session)}>{s.importTitle}</button>}</div>
      {session.mode==='face'&&<section className="detail-entry"><h2>{s.detailTitle}</h2><p>{s.detailEntryHelp}</p>{!session.details&&<><label className="ownership-check"><input type="checkbox" checked={detailMarks} onChange={event=>setDetailMarks(event.target.checked)}/>{s.detailMarks}</label><label className="ownership-check"><input type="checkbox" checked={detailBeard} onChange={event=>setDetailBeard(event.target.checked)}/>{s.detailBeard}</label></>}{session.details&&<p>{s.detailProgress(session.details.progress.completed.length,detailPlan(session.details).length)}</p>}<button className="secondary" disabled={busy} onClick={()=>void details()}>{session.details?s.resumeDetails:s.startDetails}</button>{session.details?.active&&<button className="secondary" disabled={busy} onClick={()=>void details(true)}>{s.faceAgain}</button>}</section>}
      {session.mode==='face'&&<FaceReadiness className={session.details?'face-readiness-details':undefined}>{session.details&&<summary>{s.mainFaceReadiness}</summary>}<ReadinessPanel photos={facePhotos} onOpen={id => { setSelected(id); setDeleting(false); }}/>
      <section className="pose-coverage" aria-labelledby="coverage-title"><h2 id="coverage-title">{s.coverageTitle}</h2><p>{s.coverageCount(coverage.filled.length, coverage.bins.length)}</p><p>{s.coverageHelp}</p>
        {coverage.unknown > 0 && <p>{s.unknownPoses(coverage.unknown)}</p>}
        {coverage.missing.length > 0 && <details><summary>{s.missingAngles}</summary><ul>{coverage.missing.map(bin => <li key={bin}>{s.poseLabel(bin)}</li>)}</ul></details>}
      </section></FaceReadiness>}
      {session.mode==='hair'&&<section><h2>{s.hairTitle}</h2><p>{s.hairCoverageHelp}</p>{Object.entries(session.hair?.sets??{}).map(([style,set])=>{const progress=hairCompletion(style as HairStyle,set);return <div key={style}><p>{s.hairStyles[style as HairStyle]} · {s.hairCoverage(progress.saved,progress.required)}</p>{progress.optionalSaved>0&&<p>{s.optionalHairSaved(progress.optionalSaved)}</p>}{set.pattern&&<p>{s.hairPattern}: {s.hairPatterns[set.pattern.family]}{set.pattern.subtype?` · ${set.pattern.subtype}`:''}</p>}</div>;})}</section>}
      {session.mode==='body'&&<><section><h2>{s.bodyTitle}</h2><p>{s.bodyCoverageHelp}</p>{Object.entries(session.body?.sets??{}).map(([mode,set])=><p key={mode}>{s.bodyModes[mode as BodyMode]} · {s.bodyCoverage(bodyShots(mode as BodyMode).filter(shot=>set.results[shot.id]?.status==='saved').length,bodyShots(mode as BodyMode).length)}</p>)}</section></>}
      {photos.length ? <div className="photo-grid">{photos.map((photo, index) => <button key={photo.id} className="photo-tile" onClick={() => { setSelected(photo.id); setDeleting(false); }} aria-label={s.photoLabel(index)}><LocalPhoto photo={photo} label={s.photoLabel(index)}/><span>{photo.override ? s.risky : photo.body?.reviewed||photo.hair?.reviewed||photo.measurements?.occlusionVerified ? photo.quality?.tier ?? s.needsReview : s.needsReview}</span></button>)}</div> : <p>{s.noPhotos}</p>}
      {session.mode==='body'&&<BodyRatiosPanel session={session} photos={photos} busy={busy} onSave={saveBodyCorrections}/>}
      <section className="export-panel" aria-labelledby="export-title"><h2 id="export-title">{s.exportTitle}</h2><p>{s.exportHelp}</p>
        <label className="field">{s.preset}<select value={preset} disabled={busy} onChange={event => { setPreset(event.target.value as ExportPreset); invalidateArchive(); }}><option value="recommended">{s.recommended}</option><option value="all">{s.allPhotos}</option></select></label>
        <p>{preset === 'recommended' ? s.recommendedHelp : s.allHelp}</p><p>{s.exportCount(selectedCount)}</p><p className="export-note">{session.mode==='body'?s.bodyExportHelp:session.mode==='hair'?s.hairExportHelp:session.details?s.detailExportHelp:s.exportReadinessHelp}</p>
        <label className="field">{s.exportFormat}<select value={format} disabled={busy} onChange={event => { setFormat(event.target.value as ExportFormat); invalidateArchive(); }}><option value="jpeg">{s.jpeg}</option><option value="png">{s.png}</option></select></label>
        <ExportOptions settings={exportSettings} format={format} busy={busy} onChange={(settings, nextFormat) => { setExportSettings(settings); setFormat(nextFormat); invalidateArchive(); }}/>
        {settingsInvalid && <p role="alert">{s.invalidExportValues}</p>}
        {preset === 'recommended' && !exportable(photos, preset).length && <p>{s.noRecommended}</p>}
        <p className="export-note">{format === 'png' ? s.pngNote : s.jpegNote}</p><button className="primary" disabled={busy || !selectedCount} onClick={() => void createArchive()}>{busy ? s.creatingZip : s.createZip}</button>
        {archive && <div className="review-actions"><a className="download-link" href={archive.url} download={archive.file.name}>{s.saveZip}</a>{navigator.canShare?.({ files: [archive.file] }) && <button className="secondary" onClick={() => void share()}>{s.shareZip}</button>}</div>}
      </section>
    </>}
  </main>;
}
