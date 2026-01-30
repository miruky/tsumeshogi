import { describe, it, expect } from 'vitest';
import { buildPosition, destinationsFrom, inCheck, isCheckmate, legalMoves } from './shogi';
import type { Sq } from './types';

function sortKeys(sqs: Sq[]): string[] {
  return sqs.map((s) => `${s.r},${s.c}`).sort();
}

describe('駒の利き', () => {
  it('金は前・斜め前・横・真後ろの6方向', () => {
    const pos = buildPosition([[4, 4, 'b', 'G']]);
    expect(sortKeys(destinationsFrom(pos, 4, 4))).toEqual(
      sortKeys([
        { r: 3, c: 4 },
        { r: 3, c: 3 },
        { r: 3, c: 5 },
        { r: 4, c: 3 },
        { r: 4, c: 5 },
        { r: 5, c: 4 },
      ]),
    );
  });

  it('歩は前1マス、先手は上へ', () => {
    const pos = buildPosition([[4, 4, 'b', 'P']]);
    expect(sortKeys(destinationsFrom(pos, 4, 4))).toEqual(['3,4']);
  });

  it('香は前方に走る', () => {
    const pos = buildPosition([[8, 4, 'b', 'L']]);
    expect(destinationsFrom(pos, 8, 4)).toHaveLength(8);
  });

  it('桂は2つ前の斜め', () => {
    const pos = buildPosition([[4, 4, 'b', 'N']]);
    expect(sortKeys(destinationsFrom(pos, 4, 4))).toEqual(
      sortKeys([
        { r: 2, c: 3 },
        { r: 2, c: 5 },
      ]),
    );
  });

  it('角は4方向の斜めに走る', () => {
    const pos = buildPosition([[4, 4, 'b', 'B']]);
    // 中央からは各斜め4マスずつ=16
    expect(destinationsFrom(pos, 4, 4)).toHaveLength(16);
  });

  it('竜(成飛)は飛車の動きに斜め1歩を足す', () => {
    const pos = buildPosition([[4, 4, 'b', 'R', true]]);
    const keys = sortKeys(destinationsFrom(pos, 4, 4));
    // 縦横16 + 斜め4 = 20
    expect(keys).toHaveLength(20);
    expect(keys).toContain('3,3');
    expect(keys).toContain('5,5');
  });

  it('と金(成歩)は金と同じ動き', () => {
    const promoted = buildPosition([[4, 4, 'b', 'P', true]]);
    const gold = buildPosition([[4, 4, 'b', 'G']]);
    expect(sortKeys(destinationsFrom(promoted, 4, 4))).toEqual(
      sortKeys(destinationsFrom(gold, 4, 4)),
    );
  });

  it('自分の駒は飛び越えず、相手の駒は取れる位置まで', () => {
    const pos = buildPosition([
      [4, 4, 'b', 'R'],
      [4, 6, 'b', 'P'], // 右は自駒で(4,5)まで
      [2, 4, 'w', 'P'], // 上は相手駒(2,4)を取れる
    ]);
    const keys = sortKeys(destinationsFrom(pos, 4, 4));
    expect(keys).toContain('4,5');
    expect(keys).not.toContain('4,6');
    expect(keys).toContain('2,4');
    expect(keys).not.toContain('1,4');
  });
});

describe('王手', () => {
  it('筋が通った飛車は王手、間に駒が入ると外れる', () => {
    const checking = buildPosition([
      [0, 4, 'w', 'K'],
      [8, 4, 'b', 'R'],
    ]);
    expect(inCheck(checking, 'w')).toBe(true);
    const blocked = buildPosition([
      [0, 4, 'w', 'K'],
      [8, 4, 'b', 'R'],
      [4, 4, 'b', 'P'],
    ]);
    expect(inCheck(blocked, 'w')).toBe(false);
  });
});

describe('詰み', () => {
  it('頭金(支えあり)は詰み、支えが無ければ玉に取られて不詰', () => {
    const mate = buildPosition(
      [
        [0, 4, 'w', 'K'],
        [1, 4, 'b', 'G'],
        [2, 3, 'b', 'S'], // 金を支える銀(玉には利かない)
      ],
      {},
      {},
      'w',
    );
    expect(inCheck(mate, 'w')).toBe(true);
    expect(isCheckmate(mate)).toBe(true);

    const escapable = buildPosition(
      [
        [0, 4, 'w', 'K'],
        [1, 4, 'b', 'G'],
      ],
      {},
      {},
      'w',
    );
    expect(isCheckmate(escapable)).toBe(false); // 玉が金を取れる
  });
});

describe('打つ手の制限', () => {
  it('二歩: 同じ筋に自分の歩があると歩を打てない', () => {
    const pos = buildPosition([[4, 4, 'b', 'P']], { P: 1 });
    const pawnDrops = legalMoves(pos).filter((m) => m.drop === 'P');
    expect(pawnDrops.some((m) => m.to.c === 4)).toBe(false); // 4筋には打てない
    expect(pawnDrops.some((m) => m.to.c !== 4)).toBe(true); // 他の筋には打てる
  });

  it('打ち歩詰め: 歩を打って詰ますのは反則、金を打って詰ますのは合法', () => {
    const pos = buildPosition(
      [
        [0, 0, 'w', 'K'],
        [1, 2, 'b', 'G'], // (0,1)(1,1)を抑える。玉には利かない
        [2, 1, 'b', 'S'], // (1,0)を支える。玉には利かない
      ],
      { P: 1, G: 1 },
    );
    expect(inCheck(pos, 'w')).toBe(false); // 開始時は王手でない
    const moves = legalMoves(pos);
    // (1,0)へ歩を打つと詰みになるため、その手は除かれる
    expect(moves.some((m) => m.drop === 'P' && m.to.r === 1 && m.to.c === 0)).toBe(false);
    // 歩は他の場所には打てる
    expect(moves.some((m) => m.drop === 'P')).toBe(true);
    // 金を(1,0)へ打つ詰みは合法
    expect(moves.some((m) => m.drop === 'G' && m.to.r === 1 && m.to.c === 0)).toBe(true);
  });
});
