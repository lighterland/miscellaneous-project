import type { Photo } from '../storage/db';
import { datasetReadiness } from '../session/readiness';
import { s } from '../i18n/strings.en';

export function ReadinessPanel({ photos, onOpen }: { photos: Photo[]; onOpen: (id: string) => void }) {
  const report = datasetReadiness(photos), tips: string[] = [];
  if (report.components.consistency === null) tips.push(s.consistencyMissing);
  if (report.unknownHashes.length) tips.push(s.hashMissing);
  if (report.identity.unresolved.length) tips.push(s.outlierHelp);
  if (report.missingImportant.length) tips.push(s.coverageSuggestion(report.missingImportant.map(s.poseLabel).join(', ')));
  if ((report.components.variety ?? 0) < .8) tips.push(s.varietySuggestion);
  if (report.duplicateIds.length) tips.push(s.duplicateSuggestion);
  if (report.components.quality < .8) tips.push(s.qualitySuggestion);
  return <section className="readiness-panel" aria-labelledby="readiness-title">
    <h2 id="readiness-title">{s.readinessTitle}</h2>
    <p className="readiness-result"><strong>{s.readinessScore(report.score)}</strong><span>{s.readinessStatuses[report.status]}</span></p>
    <p>{s.readinessHelp}</p>
    <div className="readiness-components">{(Object.keys(report.components) as (keyof typeof report.components)[]).map(key => <div className="readiness-component" key={key}>
      <label htmlFor={`readiness-${key}`}>{s.readinessComponents[key]}</label><span>{report.components[key] === null ? s.notMeasured : s.percent(report.components[key]!)}</span>
      {report.components[key] !== null && <meter id={`readiness-${key}`} min={0} max={1} value={report.components[key]!} aria-label={s.readinessComponents[key]}/>}
    </div>)}</div>
    <p>{s.tierSummary(report.tiers, report.riskyCount)}</p>
    {tips.length > 0 && <ul className="readiness-tips">{tips.slice(0, 2).map(tip => <li key={tip}>{tip}</li>)}</ul>}
    {report.identity.unresolved.length > 0 && <button className="secondary" onClick={() => onOpen(report.identity.unresolved[0])}>{s.reviewFlagged}</button>}
  </section>;
}
