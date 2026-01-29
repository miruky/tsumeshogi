import { givesCheck, isCheckmate, legalMoves, makeMove } from './shogi';
import type { Move, Position } from './types';

// 詰将棋のAND-OR探索。攻め方は常に王手をかけ続け、玉方は最善で逃げる。
// 局面は小さいので素朴な全探索で足りる。

/** 攻め方(手番)が depth 手(攻め方の着手数=奇数)以内に詰ませられるか。 */
export function attackerCanMate(pos: Position, depth: number): boolean {
  if (depth <= 0) return false;
  for (const m of legalMoves(pos)) {
    if (!givesCheck(pos, m)) continue; // 攻め方は必ず王手
    if (defenderIsMated(makeMove(pos, m), depth - 1)) return true;
  }
  return false;
}

/** 玉方(手番・王手された状態)が、残り depth 手で必ず詰むか。 */
function defenderIsMated(pos: Position, depth: number): boolean {
  const moves = legalMoves(pos);
  if (moves.length === 0) return true; // すでに詰み
  if (depth <= 0) return false; // 逃げ切られた
  for (const m of moves) {
    if (!attackerCanMate(makeMove(pos, m), depth - 1)) return false; // 一つでも逃れれば不詰
  }
  return true;
}

/** 詰みにつながる攻め方の一手を、最短になるものから探す。ヒントにも使う。 */
export function findMatingMove(pos: Position, max: number): Move | null {
  for (let d = 1; d <= max; d += 2) {
    for (const m of legalMoves(pos)) {
      if (!givesCheck(pos, m)) continue;
      if (defenderIsMated(makeMove(pos, m), d - 1)) return m;
    }
  }
  return null;
}

/** 攻め方が詰ませられる最短手数(奇数)。maxまでに無ければ Infinity。 */
export function mateDistance(pos: Position, max: number): number {
  for (let d = 1; d <= max; d += 2) {
    if (attackerCanMate(pos, d)) return d;
  }
  return Infinity;
}

/** 攻め方の手mが「残り movesLeft 手での詰みにつながる正解手」か。 */
export function isSolvingMove(pos: Position, m: Move, movesLeft: number): boolean {
  if (!givesCheck(pos, m)) return false;
  return defenderIsMated(makeMove(pos, m), movesLeft - 1);
}

/**
 * 玉方の最善応手。粘れる(詰みまで遠い)手を選び、同じなら盤上の手を優先する。
 * 詰将棋として正しい問題では、どの応手も最終的に詰む。
 */
export function bestDefense(pos: Position, maxAttackerDepth: number): Move | null {
  const moves = legalMoves(pos);
  if (moves.length === 0) return null;
  let best: Move = moves[0]!;
  let bestScore = -1;
  for (const m of moves) {
    const d = mateDistance(makeMove(pos, m), maxAttackerDepth);
    const score = d === Infinity ? 1e9 : d;
    const prefersBoard = m.drop ? 0 : 1; // 同じ粘りなら合駒より盤上の応手を選ぶ
    const total = score * 2 + prefersBoard;
    if (total > bestScore) {
      bestScore = total;
      best = m;
    }
  }
  return best;
}

export { isCheckmate };
