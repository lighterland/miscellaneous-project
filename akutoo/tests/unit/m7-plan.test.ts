import { expect, it } from 'vitest';
import { hairShots, detailShots, permittedHairShots } from '../../src/hair/plan';
it('keeps the required down set at fourteen evidence shots and adds tied-hair details only for tied styles', () => {
  const down=hairShots('down');expect(down).toHaveLength(14);expect(down.filter(shot=>shot.kind==='angle')).toHaveLength(8);expect(down.filter(shot=>shot.kind==='texture').map(shot=>shot.region)).toEqual(['roots','middle','ends']);
  expect(hairShots('bun').filter(shot=>shot.kind==='tie')).toHaveLength(2);expect(hairShots('down',true)).toHaveLength(15);
  expect(new Set(hairShots('braid',true).map(shot=>shot.id)).size).toBe(17);
});
it('does not schedule rear/top/silhouette shots for an unsupported handheld session', () => {
  const shots=permittedHairShots('down','handheld');expect(shots.map(shot=>shot.id)).toEqual(['angle-front','texture-roots','texture-middle','texture-ends']);
  expect(permittedHairShots('down','stand')).toHaveLength(14);expect(permittedHairShots('down','helper')).toHaveLength(14);
});
it('includes every named facial-detail target and leaves distinguishing marks and beard optional', () => {
  const required=detailShots();expect(required).toHaveLength(11);expect(required.filter(shot=>shot.region==='eyes')).toHaveLength(2);expect(required.filter(shot=>shot.region==='ear')).toHaveLength(2);
  const all=detailShots({marks:true,beard:true});expect(all).toHaveLength(15);expect(all.filter(shot=>shot.optional)).toHaveLength(4);expect(new Set(all.map(shot=>shot.id)).size).toBe(15);
});
