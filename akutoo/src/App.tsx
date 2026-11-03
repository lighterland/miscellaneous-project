import { useEffect, useState } from 'react';
import { s } from './i18n/strings.en';
import { checkLocalStorage, storageAvailable } from './storage/foundation';
import { createTrialZip } from './export/zip';
import { useAppState } from './session/store';
import { db, type Session } from './storage/db';
import { newSession } from './storage/sessions';
import { CaptureScreen } from './app/CaptureScreen';
import { ReviewScreen } from './app/ReviewScreen';
import { ImportScreen } from './app/ImportScreen';
import { persistenceStatus, requestPersistence, type PersistenceStatus } from './storage/persistence';
import { recoverStorage } from './storage/recovery';
import { resumeDeletion } from './storage/deletion';
import { SettingsScreen } from './app/SettingsScreen';
import { HairScreen } from './app/HairScreen';
import {ProfileScreen} from './app/ProfileScreen';
import {BodyScreen} from './app/BodyScreen';
interface InstallEvent extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }>; }
export function App() {
  const { offlineReady, updateReady, offlineError } = useAppState();
  const [profile,setProfile]=useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [inventoryError, setInventoryError] = useState(''), [settings, setSettings] = useState(false);
  const [used, setUsed] = useState<number>();
  const [persistence, setPersistence] = useState<PersistenceStatus>('unknown');
  const [requestingStorage, setRequestingStorage] = useState(false);
  const [recovery, setRecovery] = useState('');
  const [install, setInstall] = useState<InstallEvent>();
  const [sessions, setSessions] = useState<Session[]>([]), [active, setActive] = useState<Session | null>(null);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [screen, setScreen] = useState<'capture' | 'review' | 'import'>('capture');
  async function refresh() { setSessionsLoaded(false); setSessions(await db.sessions.orderBy('updatedAt').reverse().toArray()); setSessionsLoaded(true); }
  const [installed, setInstalled] = useState(matchMedia('(display-mode: standalone)').matches || !!(navigator as Navigator & { standalone?: boolean }).standalone);
  useEffect(() => {
    void (async () => {
      if (await resumeDeletion()) setRecovery(s.eraseResumed);
      await refresh(); setReady(await storageAvailable());
      const report = await recoverStorage();
      if (report.missing) setInventoryError(s.missingFiles(report.missing));
      if (report.unlinked) setRecovery(s.unlinkedFiles(report.unlinked));
    })().catch(() => setInventoryError(s.housekeepingError));
    void navigator.storage?.estimate?.().then(estimate => setUsed(estimate.usage)).catch(() => undefined);
    void persistenceStatus().then(setPersistence);
    const before = (event: Event) => { event.preventDefault(); setInstall(event as InstallEvent); };
    const done = () => { setInstalled(true); setInstall(undefined); };
    addEventListener('beforeinstallprompt', before); addEventListener('appinstalled', done);
    return () => { removeEventListener('beforeinstallprompt', before); removeEventListener('appinstalled', done); };
  }, []);
  useEffect(() => { if (!active) { void persistenceStatus().then(setPersistence); void navigator.storage?.estimate?.().then(estimate => setUsed(estimate.usage)).catch(() => undefined); } }, [active]);
  async function check() {
    setBusy(true); setError(''); setReady(false);
    try { await checkLocalStorage(); setReady(true); setPersistence(await requestPersistence()); } catch { setError(s.storageError); }
    finally { setBusy(false); }
  }
  function download() {
    setError('');
    try {
      const bytes = createTrialZip({ id: crypto.randomUUID(), createdAt: Date.now(), label: s.trialLabel });
      const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/zip' }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'akutoo-storage-trial.zip';
      document.body.append(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch { setError(s.zipError); }
  }
  if (profile) return <ProfileScreen onBack={()=>setProfile(false)}/>;
  if (settings) return <SettingsScreen onBack={({ deleted, pending }) => { setSettings(false); void refresh(); if (deleted || pending) { setReady(false); setError(''); setInventoryError(pending ? s.erasePending : ''); setRecovery(''); } void navigator.storage?.estimate?.().then(estimate => setUsed(estimate.usage)).catch(() => undefined); }}/>;
  if (active && screen === 'import') return <ImportScreen session={active} onBack={() => setScreen('review')} onDone={session => { setActive(session); setScreen('review'); }}/>;
  if (active && screen === 'review') return <ReviewScreen session={active} onBack={() => { setActive(null); void refresh(); }} onRetake={session => { setActive(session); setScreen('capture'); }} onContinue={session => { setActive(session); setScreen('capture'); }} onImport={session => { setActive(session); setScreen('import'); }}/>;
  if (active) {const onLeave=()=>{void db.sessions.get(active.id).then(session=>{if(session){setActive(session);setScreen('review');}else{setActive(null);void refresh();}});};return active.mode==='body'?<BodyScreen session={active} onLeave={onLeave}/>:active.mode==='hair'?<HairScreen session={active} onLeave={onLeave}/>:<CaptureScreen session={active} onLeave={onLeave}/>;}
  return <main className="workspace mx-auto">
    <header className="flex items-center justify-between gap-4"><a className="brand flex items-center gap-3" href="./" aria-label={s.name}><span className="brand-mark" aria-hidden="true"><i/><i/></span>{s.name}</a><button className="secondary home-settings" onClick={() => setSettings(true)}>{s.settingsTitle}</button></header>
    <div className="page-heading"><h1>{s.title}</h1><p>{s.privacy}</p></div>
    {!sessionsLoaded ? <p role="status">{s.loadingSessions}</p> : sessions.length === 0 ? <section className="empty-state" aria-labelledby="empty-heading"><span className="empty-symbol" aria-hidden="true"><i/><i/></span><h2 id="empty-heading">{s.empty}</h2><p>{s.emptyHelp}</p></section> : <section className="session-list">{sessions.map(session => <article key={session.id}><h2>{session.label}</h2><p>{s.sessionSummary(new Set([...(session.progress?.savedIds ?? []), ...(session.details?.progress.savedIds ?? [])]).size)}</p><div className="review-actions"><button className="secondary" onClick={() => { setActive(session); setScreen('capture'); }}>{s.openSession}</button><button className="secondary" onClick={() => { setActive(session); setScreen('review'); }}>{s.review}</button></div></article>)}</section>}
    <button className="secondary look-entry" onClick={()=>setProfile(true)}>{s.lookOpen}</button>
    <div className="session-start-actions"><button className="primary start-session" onClick={async () => { try { setScreen('capture'); setActive(await newSession(s.sessionLabel(new Date()))); } catch { setError(s.storageError); } }}>{s.startSession}</button>
    <button className="secondary" onClick={async()=>{try{setActive(await newSession(s.hairTitle,'hair'));setScreen('capture');}catch{setError(s.storageError);}}}>{s.startHair}</button>
    <button className="secondary" onClick={async()=>{try{setActive(await newSession(s.bodyTitle,'body'));setScreen('capture');}catch{setError(s.storageError);}}}>{s.startBody}</button>
    <button className="secondary" onClick={async () => { try { setActive(await newSession(s.sessionLabel(new Date()))); setScreen('import'); } catch { setError(s.storageError); } }}>{s.importTitle}</button></div>
    <section className="foundation" aria-labelledby="foundation-heading">
      <h2 id="foundation-heading">{s.foundation}</h2><p>{s.foundationHelp}</p>
      <button className="primary" onClick={() => void check()} disabled={busy}>{busy ? s.checking : s.checkStorage}</button>
      <p role="status" className="storage-status">{ready ? s.storageReady : s.storageUnchecked}</p>
      {recovery && <p role="status">{recovery}</p>}
      <p role="status">{s.persistence[persistence]}</p>
      {persistence !== 'persistent' && persistence !== 'unsupported' && <button className="secondary" disabled={requestingStorage} onClick={async () => { setRequestingStorage(true); try { setPersistence(await requestPersistence()); } finally { setRequestingStorage(false); } }}>{requestingStorage ? s.requestingStorage : s.requestStorage}</button>}
      {ready && <div className="export-trial"><button className="secondary" onClick={download}>{s.download}</button><p>{s.zipHelp}</p></div>}
      {error && <p role="alert" className="error">{error}</p>}
      {inventoryError && <p role="alert" className="error">{inventoryError}</p>}
    </section>
    <aside className="install-panel"><h2>{installed ? s.installed : s.installTitle}</h2><p>{s.installHelp}</p>
      {!installed && (install ? <button className="secondary" onClick={async () => { await install.prompt(); await install.userChoice; setInstall(undefined); }}>{s.install}</button> : <p>{s.installManual}</p>)}
      <p className="backup-note">{s.storageNotice}</p></aside>
    <footer className="flex flex-wrap items-center justify-between gap-3"><span>{used !== undefined ? s.bytes(used) : s.privacy}</span><span role="status">{offlineError ? s.offlineError : offlineReady ? s.offlineReady : s.offlinePreparing}</span></footer>
    {updateReady && <p role="status">{s.update}</p>}
  </main>;
}
