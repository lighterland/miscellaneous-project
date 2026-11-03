import { describe, expect, it } from 'vitest';
import { detailPlan, detailMeasurements, beginDetails, capturePlan, captureProgress, syncDetailBudget } from '../../src/details/plan';
import type { AnalysisResult } from '../../src/analysis/protocol';
import { freshProgress, acceptSlot, advanceSlot, revisit } from '../../src/session/progress';
import type { Session } from '../../src/storage/db';
import { evaluateQuality } from '../../src/gates/quality';
import { recordFailure } from '../../src/session/attempts';
describe('facial detail instructions', () => {
  it('shares the ten-prompt session budget across face/detail switches without losing slot limits', () => {
    const progress=freshProgress(1);progress.attempts.prompts=9;progress.attempts.slotAttempts=2;
    let session=beginDetails({id:'s',mode:'face',createdAt:1,updatedAt:1,label:'Face',preset:'general',stage:1,status:'review',progress} as Session,{marks:false,beard:false});
    expect(session.details!.progress.attempts.prompts).toBe(9);expect(session.details!.progress.attempts.slotAttempts).toBe(0);
    session.details!.progress.attempts=recordFailure(session.details!.progress.attempts,'focus',10);
    session=syncDetailBudget(session);
    expect(session.progress!.attempts.prompts).toBe(10);expect(session.progress!.attempts.slotAttempts).toBe(2);
    expect(session.details!.progress.attempts.slotAttempts).toBe(1);
    expect(beginDetails(session,{marks:false,beard:false}).details!.progress.attempts.prompts).toBe(10);
    expect(recordFailure(session.progress!.attempts,'focus',11).promptRetake).toBe(false);
  });
  it('advances and revisits detail instructions without changing the original face progress', () => {
    const face = freshProgress(1); face.index = 3;
    const session = beginDetails({ id:'s',mode:'face',createdAt:1,updatedAt:1,label:'Face',preset:'general',stage:1,status:'review',progress:face } as Session,{marks:false,beard:false});
    const plan = capturePlan(session), detail = captureProgress(session);
    const saved = acceptSlot(detail,'photo',plan), skipped = advanceSlot(saved,'later',plan), again = revisit(skipped,plan);
    expect(saved.completed).toEqual(['detail-front']);expect(again.index).toBe(1);expect(again.missed).toEqual(['detail-eye-left']);
    expect(session.progress?.index).toBe(3);expect(session.progress?.completed).toEqual([]);
  });
  it('keeps all eleven required targets and adds optional marks and beard explicitly', () => {
    const required = detailPlan();
    expect(required).toHaveLength(11);
    expect(new Set(required.map(shot => shot.id)).size).toBe(11);
    expect(required.every(shot => shot.stage === 6 && shot.manual && shot.detail)).toBe(true);
    expect(detailPlan({ marks: true, beard: true })).toHaveLength(15);
  });
  it('never borrows whole-face sharpness when target evidence is absent', () => {
    const result = { measurements: { sharpness: 999 } } as AnalysisResult;
    expect(detailMeasurements(result)).toBeNull();
  });
  it('replaces only target-dependent metrics while preserving measured face evidence', () => {
    const result = { measurements: { faceCount: 1, faceRatio: .75, sharpness: 999, exposure: 150, clipped: .02 }, target: { metrics: { sharpness: 42, exposure: 90, clipped: .01 } } } as AnalysisResult;
    expect(detailMeasurements(result)).toMatchObject({ faceCount: 1, faceRatio: .75, sharpness: 42, exposure: 90, clipped: .02 });
    expect(result.measurements.sharpness).toBe(999);
  });
  it('keeps the clipping hard floor on both the target and the whole face', () => {
    for (const [face, target] of [[.11, .01], [.01, .11]]) {
      const result = { measurements: { faceCount:1,occluded:false,headCutOff:false,shortSide:1024,faceRatio:.8,angleError:0,expressionMatch:1,occlusionVerified:false,sharpness:999,exposure:120,clipped:face }, target:{metrics:{sharpness:50,exposure:90,clipped:target}} } as AnalysisResult;
      expect(evaluateQuality(detailMeasurements(result)!,{sharpness:50,exposure:90},false,.7)).toMatchObject({hardFailure:true,reason:'light'});
    }
  });
});
