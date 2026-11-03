import {GuidanceVoicePicker} from './GuidanceVoicePicker';
import { useEffect, useState } from 'react';
import { s } from '../i18n/strings.en';
import { db } from '../storage/db';
import { preferences, type Preferences } from '../settings/preferences';
import { loadPreferences, savePreferences } from '../settings/store';
import { deleteAllData, deletionPending, resumeDeletion } from '../storage/deletion';
import { persistenceStatus, type PersistenceStatus } from '../storage/persistence';

export function SettingsScreen({ onBack }: { onBack: (state: { deleted: boolean; pending: boolean }) => void }) {
  const [values, setValues] = useState<Preferences>(preferences(undefined)), [loaded, setLoaded] = useState(false), [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(''), [error, setError] = useState(''), [confirming, setConfirming] = useState(false), [acknowledged, setAcknowledged] = useState(false), [keyword, setKeyword] = useState('');
  const [pending, setPending] = useState(false), [deleted, setDeleted] = useState(false), [counts, setCounts] = useState([0, 0]), [usage, setUsage] = useState<number>(), [persistence, setPersistence] = useState<PersistenceStatus>('unknown');
  async function load() {
    const [next, sessions, photos, pending, persistence, estimate] = await Promise.all([loadPreferences(), db.sessions.count(), db.photos.count(), deletionPending(), persistenceStatus(), navigator.storage?.estimate?.().catch(() => undefined)]);
    setValues(next); setCounts([sessions, photos]); setPending(pending); setPersistence(persistence); setUsage(estimate?.usage); setLoaded(true);
  }
  useEffect(() => { void load().catch(() => setError(s.settingsLoadError)); }, []);
  async function save() {
    if (busy || !loaded || pending) return; setBusy(true); setError(''); setMessage('');
    try { setValues(await savePreferences(values)); setMessage(s.settingsSaved); } catch { setError(s.settingsSaveError); } finally { setBusy(false); }
  }
  async function erase(resuming = false) {
    const allowed = acknowledged && keyword.trim() === s.eraseWord;
    if (busy || (!resuming && !allowed)) return; setBusy(true); setError(''); setMessage('');
    try {
      if (resuming) { if (!await resumeDeletion()) { await load(); setError(s.eraseNoPending); return; } } else await deleteAllData(allowed);
      setDeleted(true); setConfirming(false); setAcknowledged(false); setKeyword(''); await load(); setMessage(s.eraseSuccess);
    } catch { await load().catch(() => setPending(true)); setError(s.eraseError); }
    finally { setBusy(false); }
  }
  return <main className="workspace mx-auto settings-screen">
    <header className="review-header"><button className="secondary" disabled={busy} onClick={() => onBack({ deleted, pending })}>{s.back}</button></header>
    <div className="page-heading"><h1>{s.settingsTitle}</h1><p>{s.settingsHelp}</p></div>
    {error && <p className="review-error" role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    <section aria-label={s.preferenceTitle} className="settings-options">
      <label className="settings-row"><span><strong>{s.voiceGuidance}</strong><span>{s.voiceGuidanceHelp}</span></span><input type="checkbox" aria-label={s.voiceGuidance} checked={values.voice} disabled={!loaded || busy || pending} onChange={event => setValues({ ...values, voice: event.target.checked })}/></label>
      <label className="settings-row"><span><strong>{s.units}</strong><span>{s.unitsHelp}</span></span><select aria-label={s.units} value={values.units} disabled={!loaded || busy || pending} onChange={event => setValues({ ...values, units: event.target.value as Preferences['units'] })}><option value="metric">{s.metric}</option><option value="imperial">{s.imperial}</option></select></label>
      <GuidanceVoicePicker value={values.voiceURI} onChange={voiceURI=>setValues({...values,voiceURI})} disabled={!loaded||busy||pending}/>
      <details className="settings-thresholds"><summary>{s.advancedThresholds}</summary><p>{s.thresholdsDeferred}</p></details>
      <button className="primary" disabled={!loaded || busy || pending} onClick={() => void save()}>{s.saveSettings}</button>
    </section>
    <section className="settings-storage" aria-labelledby="settings-storage-title"><h2 id="settings-storage-title">{s.storageTitle}</h2><p>{loaded ? s.storedCounts(counts[0], counts[1]) : s.loadingStorage}</p>{usage !== undefined && <p>{s.bytes(usage)}</p>}<p>{s.persistence[persistence]}</p><p>{s.storageNotice}</p></section>
    <section className="settings-delete" aria-labelledby="settings-delete-title"><h2 id="settings-delete-title">{s.eraseTitle}</h2><p>{s.eraseHelp}</p>
      {pending ? <><p role="alert">{s.erasePending}</p><button className="danger" disabled={busy} onClick={() => void erase(true)}>{busy ? s.erasing : s.eraseRetry}</button></> : confirming ? <div className="erase-confirmation"><h3>{s.eraseConfirmTitle}</h3><p>{s.eraseConfirmHelp}</p><label className="ownership-check"><input type="checkbox" checked={acknowledged} disabled={busy} onChange={event => setAcknowledged(event.target.checked)}/><span>{s.eraseAcknowledgement}</span></label><label className="field">{s.eraseKeywordLabel}<input type="text" value={keyword} autoComplete="off" spellCheck={false} disabled={busy} onChange={event => setKeyword(event.target.value)}/></label><div className="review-actions"><button className="danger" disabled={busy || !acknowledged || keyword.trim() !== s.eraseWord} onClick={() => void erase()}>{busy ? s.erasing : s.eraseConfirm}</button><button className="secondary" disabled={busy} onClick={() => { setConfirming(false); setAcknowledged(false); setKeyword(''); }}>{s.cancel}</button></div></div> : <button className="danger" disabled={!loaded || busy} onClick={() => { setConfirming(true); setMessage(''); }}>{s.eraseStart}</button>}
    </section>
    <aside className="settings-privacy"><h2>{s.settingsPrivacyTitle}</h2><p>{s.settingsPrivacyHelp}</p><p>{s.exportPrivacyHelp}</p></aside>
    <section className="settings-guide"><h2>{s.scanGuideTitle}</h2><ul>{s.scanGuide.map(item => <li key={item}>{item}</li>)}</ul></section>
    <footer>{s.privateBuild}</footer>
  </main>;
}
