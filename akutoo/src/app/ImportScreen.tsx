import { useEffect, useRef, useState } from 'react';
import { db, type Session } from '../storage/db';
import { analyzeImports, prepareImports, releaseImport, type ImportBatch } from '../import/processor';
import { saveImportedBatch } from '../storage/imports';
import { s } from '../i18n/strings.en';
import { requestPersistence } from '../storage/persistence';

export function ImportScreen({ session, onBack, onDone }: { session: Session; onBack: () => void; onDone: (session: Session) => void }) {
  const [files, setFiles] = useState<File[]>([]), [owner, setOwner] = useState(false), [batch, setBatch] = useState<ImportBatch | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set()), [mode, setMode] = useState<'analyzing' | 'saving' | null>(null), [progress, setProgress] = useState([0, 0]);
  const [error, setError] = useState(''), current = useRef<ImportBatch | null>(null), abort = useRef<AbortController | null>(null), working = useRef(false);
  useEffect(() => () => { abort.current?.abort(); releaseImport(current.current); }, []);
  function choose(next: File[]) { releaseImport(current.current); current.current = null; setBatch(null); setSelected(new Set()); setFiles(next); setOwner(false); setError(''); }
  async function analyze() {
    if (working.current || !owner || !files.length) return;
    if (files.length > 100) { setError(s.importBatchLimit); return; }
    working.current = true; setMode('analyzing'); setError(''); setProgress([0, files.length]);
    releaseImport(current.current); current.current = null; setBatch(null); setSelected(new Set()); const controller = new AbortController(); abort.current = controller;
    try {
      const existing = await db.photos.where('sessionId').equals(session.id).toArray();
      const next = await analyzeImports(files, existing, owner, (done, total) => setProgress([done, total]), controller.signal);
      if (controller.signal.aborted) { releaseImport(next); return; }
      current.current = next; setBatch(next); setSelected(new Set(next.items.filter(item => item.decision.accepted).map(item => item.id)));
    } catch (error) { setError(error instanceof DOMException && error.name === 'AbortError' ? s.importStopped : s.importAnalysisError); }
    finally { working.current = false; abort.current = null; setMode(null); }
  }
  async function save() {
    if (working.current || !batch || !owner || !selected.size) return;
    working.current = true; setMode('saving'); setError(''); setProgress([0, selected.size]);
    try {
      const next = await saveImportedBatch(session.id, prepareImports(session.id, batch, selected, owner, (done, total) => setProgress([done, total])));
      void requestPersistence();
      onDone(next);
    } catch { setError(s.importSaveError); }
    finally { working.current = false; setMode(null); }
  }
  return <main className="workspace mx-auto import-screen">
    <header className="review-header"><button className="secondary" disabled={!!mode} onClick={onBack}>{s.importBack}</button></header>
    <div className="page-heading"><h1>{s.importTitle}</h1><p>{s.importHelp}</p></div>
    <p>{s.importOriginals}</p>
    <label className="file-picker">{s.importChoose}<input type="file" multiple accept="image/*" disabled={!!mode} onChange={event => choose(Array.from(event.target.files ?? []))}/></label>
    {files.length > 0 && <p>{s.importFileCount(files.length)}</p>}
    <label className="ownership-check"><input type="checkbox" checked={owner} disabled={!!mode} onChange={event => setOwner(event.target.checked)}/><span>{s.importOwnership}</span></label>
    <p className="import-note">{s.importReferenceHelp}</p>
    <button className={batch ? 'secondary' : 'primary'} disabled={!!mode || !files.length || !owner} onClick={() => void analyze()}>{s.importAnalyze}</button>
    {mode && <p className="import-progress" role="status">{s.importProgress(mode, progress[0], progress[1])}</p>}
    {mode === 'analyzing' && <button className="secondary" onClick={() => abort.current?.abort()}>{s.importCancelAnalysis}</button>}
    {error && <p role="alert" className="review-error import-error">{error}</p>}
    {batch && <section aria-labelledby="import-results-title"><h2 id="import-results-title">{s.importResults}</h2><p>{s.importResultHelp}</p>
      <ul className="import-results">{batch.items.map(item => <li key={item.id} className="import-result">
        {item.preview ? <img src={item.preview} alt={s.importPreview(item.file.name)}/> : <div className="import-no-preview">{s.importNoPreview}</div>}
        <div><h3>{item.file.name}</h3><p>{item.decision.accepted ? s.importReady : s.importNotAdded}</p>
          {item.decision.reason && <p className="import-note">{s.importReasons[item.decision.reason]}</p>}
          {item.decision.binId && <p className="import-note">{s.poseLabel(item.decision.binId)}</p>}
          {item.preview && item.digest && <label className="import-selection"><input type="checkbox" disabled={!!mode} checked={selected.has(item.id)} aria-label={item.decision.accepted ? s.importSelect(item.file.name) : s.importSelectRisky(item.file.name)} onChange={event => setSelected(previous => { const next = new Set(previous); if (event.target.checked) next.add(item.id); else next.delete(item.id); return next; })}/><span>{item.decision.accepted ? s.importInclude : s.importKeepRisky}</span></label>}
        </div>
      </li>)}</ul>
      <p className="import-note">{s.importRiskHelp}</p><button className="primary" disabled={!!mode || !owner || !selected.size} onClick={() => void save()}>{s.importAdd(selected.size)}</button>
    </section>}
  </main>;
}
