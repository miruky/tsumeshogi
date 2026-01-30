import { describe, it, expect } from 'vitest';
import { buildPosition, givesCheck, legalMoves, makeMove } from './shogi';
import { attackerCanMate, bestDefense, findMatingMove, isSolvingMove, mateDistance } from './solve';

// 頭金の一手詰(打つ金を銀が支える)。
function headGold() {
  return buildPosition(
    [
      [0, 4, 'w', 'K'],
      [2, 3, 'b', 'S'],
    ],
    { G: 1 },
  );
}

describe('詰み探索', () => {
  it('一手詰を検出する', () => {
    const pos = headGold();
    expect(attackerCanMate(pos, 1)).toBe(true);
    const m = findMatingMove(pos, 1);
    expect(m).not.toBeNull();
    expect(m!.drop).toBe('G');
    expect(m!.to).toEqual({ r: 1, c: 4 });
  });

  it('正解手は詰みにつながり、王手でない手は退けられる', () => {
    const pos = headGold();
    const mate = findMatingMove(pos, 1)!;
    expect(isSolvingMove(pos, mate, 1)).toBe(true);
    // 王手にならない金打ち(遠くのマス)は不正解
    const idle = legalMoves(pos).find((m) => !givesCheck(pos, m));
    expect(idle).toBeDefined();
    expect(isSolvingMove(pos, idle!, 1)).toBe(false);
  });

  it('詰まない局面では最短手数がInfinity', () => {
    const lone = buildPosition([[4, 4, 'w', 'K']], { G: 1 }); // 玉だけ、盤の中央
    expect(mateDistance(lone, 5)).toBe(Infinity);
  });

  it('玉方の最善応手を返す(詰みでなければ逃げる)', () => {
    // 支えのない金で王手しても玉に取られる。bestDefenseは取る手を含め何か返す。
    const pos = buildPosition(
      [
        [0, 4, 'w', 'K'],
        [1, 4, 'b', 'G'],
      ],
      {},
      {},
      'w',
    );
    const def = bestDefense(pos, 3);
    expect(def).not.toBeNull();
    const np = makeMove(pos, def!);
    expect(np.turn).toBe('b');
  });
});
