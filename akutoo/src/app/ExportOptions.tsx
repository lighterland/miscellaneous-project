import { useEffect, useState } from 'react';
import { db } from '../storage/db';
import { defaultExportSettings, normalizeExportSettings, type ExportSettings } from '../export/settings';
import type { ExportFormat } from '../export/encode';
import { s } from '../i18n/strings.en';
interface SavedPreset { name: string; format: ExportFormat; settings: ExportSettings; }
export function ExportOptions({ settings, format, busy, onChange }: { settings: ExportSettings; format: ExportFormat; busy: boolean; onChange: (settings: ExportSettings, format: ExportFormat) => void }) {
  const [profiles, setProfiles] = useState<SavedPreset[]>([]), [selected, setSelected] = useState('universal'), [name, setName] = useState('');
  const [saving, setSaving] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  useEffect(() => { let active = true; void db.settings.get('export-presets').then(record => {
    const parsed: SavedPreset[] = [];
    if (Array.isArray(record?.value)) for (const value of record.value) {
      try { if (typeof value.name === 'string' && value.name.trim() && ['jpeg','png'].includes(value.format)) parsed.push({ name: value.name.slice(0, 40), format: value.format, settings: normalizeExportSettings(value.settings) }); } catch { /* Ignore an invalid saved preset, never photo data. */ }
    }
    if (active) setProfiles(parsed);
  }).catch(() => { if (active) setError(s.storageError); }); return () => { active = false; }; }, []);
  function change(next: ExportSettings) { setSelected('custom'); setMessage(''); setError(''); onChange(next, format); }
  useEffect(() => { if (selected.startsWith('saved:') && profiles[Number(selected.split(':')[1])]?.format !== format) setSelected('custom'); }, [format, profiles, selected]);
  async function save() {
    if (!name.trim()) { setError(s.presetNameRequired); return; }
    setSaving(true); setError(''); setMessage('');
    try {
      const profile = { name: name.trim().slice(0, 40), format, settings: normalizeExportSettings(settings) };
      const next = [...profiles.filter(item => item.name.toLowerCase() !== profile.name.toLowerCase()), profile].slice(-20);
      await db.settings.put({ key: 'export-presets', value: next }); setProfiles(next); setSelected(`saved:${next.length - 1}`); setMessage(s.presetSaved);
    } catch { setError(s.exportSettingsError); } finally { setSaving(false); }
  }
  return <details className="export-options"><summary>{s.exportOptions}</summary>
    <p>{s.exportOptionsHelp}</p>
    <label className="field">{s.exportSetup}<select disabled={busy || saving} value={selected} onChange={event => {
      const value = event.target.value; setSelected(value); setMessage(''); setError('');
      if (value === 'universal') { setName(''); onChange({ ...defaultExportSettings }, 'jpeg'); }
      else if (value.startsWith('saved:')) { const profile = profiles[Number(value.split(':')[1])]; if (profile) { setName(profile.name); onChange({ ...profile.settings }, profile.format); } }
    }}><option value="universal">{s.universalSetup}</option><option value="custom">{s.customSetup}</option>{profiles.map((profile, index) => <option key={profile.name} value={`saved:${index}`}>{profile.name}</option>)}</select></label>
    <div className="export-fields">
      <label className="field">{s.photoLimit}<input type="number" inputMode="numeric" min={1} max={1000} step={1} value={settings.maxPhotos || ''} placeholder={s.allPhotosPlaceholder} disabled={busy || saving} onChange={event => change({ ...settings, maxPhotos: Number(event.target.value) })}/></label>
      <label className="field">{s.maxEdge}<select value={settings.maxEdge} disabled={busy || saving} onChange={event => change({ ...settings, maxEdge: Number(event.target.value) })}><option value={0}>{s.originalSize}</option>{[2048,3072,4096].map(value => <option value={value} key={value}>{s.pixels(value)}</option>)}</select></label>
    </div>
    <label className="field">{s.aspectRatio}<select value={settings.aspect} disabled={busy || saving} onChange={event => change({ ...settings, aspect: event.target.value as ExportSettings['aspect'] })}><option value="original">{s.originalRatio}</option><option value="square">{s.squareRatio}</option><option value="portrait-3-4">{s.portrait34}</option><option value="portrait-4-5">{s.portrait45}</option></select></label>
    <p className="export-note">{s.fitHelp}</p>
    <label className="field">{s.filePrefix}<input maxLength={40} value={settings.prefix} disabled={busy || saving} onChange={event => change({ ...settings, prefix: event.target.value })}/></label>
    <label className="field">{s.presetName}<input maxLength={40} value={name} disabled={busy || saving} onChange={event => setName(event.target.value)}/></label>
    <button className="secondary" disabled={busy || saving} onClick={() => void save()}>{saving ? s.savingPreset : s.savePreset}</button>
    {message && <p role="status">{message}</p>}{error && <p role="alert" className="options-error">{error}</p>}
  </details>;
}
