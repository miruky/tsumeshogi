import { describe, it, expect } from 'vitest';
import { PROBLEMS } from './problems';
import { attackerCanMate, mateDistance } from './solve';
import { inCheck, isCheckmate } from './shogi';

describe('問題の健全性', () => {
  it('IDが重複していない', () => {
    const ids = PROBLEMS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const p of PROBLEMS) {
    it(`${p.id}(${p.title})はちょうど${p.moves}手詰`, () => {
      // 開始局面は後手玉に王手がかかっておらず、詰んでもいない。
      expect(inCheck(p.position, 'w')).toBe(false);
      expect(isCheckmate(p.position)).toBe(false);
      // 宣言の手数で詰む。
      expect(mateDistance(p.position, p.moves)).toBe(p.moves);
      // それより短い手数では詰まない(余詰めの最短化防止)。
      if (p.moves > 1) {
        expect(attackerCanMate(p.position, p.moves - 2)).toBe(false);
      }
    });
  }
});
